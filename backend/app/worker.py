from datetime import datetime, timedelta, timezone

from arq.connections import RedisSettings
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.models import Booking, MessageOutbox


def _redis() -> RedisSettings:
    s = get_settings()
    return RedisSettings(host=s.REDIS_HOST, port=s.REDIS_PORT)


def _session_factory():
    s = get_settings()
    url = s.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
    engine = create_async_engine(url)
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def process_pending_outbox(ctx):
    from app.services.outbox import process_outbox_item
    factory = _session_factory()
    async with factory() as db:
        rows = (
            await db.execute(
                select(MessageOutbox).where(MessageOutbox.status == "PENDING").limit(50)
            )
        ).scalars().all()
        for row in rows:
            await process_outbox_item(db, row.id)


async def sync_ical_feeds(ctx):
    """Pull an OTA iCal URL into InventoryBlock every 15 minutes when ICAL_IMPORT_URL is set."""
    import httpx
    from app.routers.ical import _parse_ics_dt, _parse_ics_events
    from app.models import InventoryBlock

    settings = get_settings()
    url = (settings.ICAL_IMPORT_URL or "").strip()
    if not url:
        return
    factory = _session_factory()
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ics = resp.text
    except Exception:
        return
    async with factory() as db:
        created = 0
        for ev in _parse_ics_events(ics):
            uid = ev.get("UID")
            start_s = ev.get("DTSTART")
            end_s = ev.get("DTEND")
            if not start_s or not end_s:
                continue
            if uid:
                existing = await db.execute(select(InventoryBlock).where(InventoryBlock.externalUid == uid))
                if existing.scalar_one_or_none():
                    continue
            db.add(InventoryBlock(
                start=_parse_ics_dt(start_s),
                end=_parse_ics_dt(end_s),
                source="OTA_AIRBNB",
                externalUid=uid,
                notes=ev.get("SUMMARY"),
            ))
            created += 1
        if created:
            await db.commit()


async def enqueue_prearrival(ctx):
    from app.services.outbox import enqueue_message, guest_can_message
    from app.config import get_settings
    factory = _session_factory()
    settings = get_settings()
    now = datetime.now(timezone.utc)
    window_start = now + timedelta(hours=20)
    window_end = now + timedelta(hours=28)
    async with factory() as db:
        rows = (
            await db.execute(
                select(Booking)
                .options(selectinload(Booking.guest), selectinload(Booking.room))
                .where(
                    Booking.status == "CONFIRMED",
                    Booking.deletedAt.is_(None),
                    Booking.checkIn >= window_start,
                    Booking.checkIn < window_end,
                )
            )
        ).scalars().all()
        for booking in rows:
            guest = booking.guest
            phone, consent, dnd = guest_can_message(guest, guest.phone if guest else None)
            try:
                await enqueue_message(
                    db,
                    template_key="checkin-reminder",
                    to_phone=phone,
                    payload={
                        "guestName": guest.firstName if guest else "",
                        "bookingCode": booking.bookingCode,
                        "checkIn": booking.checkIn.isoformat() if booking.checkIn else "",
                        "mapUrl": settings.RESORT_MAP_URL,
                    },
                    related_type="BOOKING",
                    related_id=booking.id,
                    consent=consent,
                    dnd=dnd,
                )
            except Exception:
                continue
        await db.commit()


class WorkerSettings:
    redis_settings = _redis()
    functions = [process_pending_outbox, enqueue_prearrival, sync_ical_feeds]
    cron_jobs = [
        # every 5 minutes
        # arq cron format via cron()
    ]

    @staticmethod
    async def on_startup(ctx):
        pass


try:
    from arq.cron import cron
    WorkerSettings.cron_jobs = [
        cron(process_pending_outbox, minute={0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55}),
        cron(enqueue_prearrival, hour={8}, minute={0}),
        cron(sync_ical_feeds, minute={0, 15, 30, 45}),
    ]
except Exception:
    pass
