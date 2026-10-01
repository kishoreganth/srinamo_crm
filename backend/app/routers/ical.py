from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies import require_admin
from app.models import Booking, InventoryBlock

router = APIRouter(prefix="/api/ical", tags=["iCal"])


def _ics_dt(dt: datetime) -> str:
    if dt.tzinfo:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt.strftime("%Y%m%dT%H%M%SZ")


def _escape(text: str) -> str:
    return (text or "").replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


@router.get("/export")
async def export_ical(token: str = Query(...), db: AsyncSession = Depends(get_db)):
    settings = get_settings()
    if token != settings.ICAL_FEED_TOKEN:
        raise HTTPException(401, "Invalid feed token")
    bookings = (
        await db.execute(
            select(Booking).where(
                Booking.status.in_(["CONFIRMED", "CHECKED_IN"]),
                Booking.deletedAt.is_(None),
            )
        )
    ).scalars().all()
    blocks = (await db.execute(select(InventoryBlock))).scalars().all()
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Srinamo Farms//PMS//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
    ]
    now = _ics_dt(datetime.now(timezone.utc))
    for b in bookings:
        lines += [
            "BEGIN:VEVENT",
            f"UID:booking-{b.id}@srinamofarms.com",
            f"DTSTAMP:{now}",
            f"DTSTART:{_ics_dt(b.checkIn)}",
            f"DTEND:{_ics_dt(b.checkOut)}",
            f"SUMMARY:{_escape(b.bookingCode)}",
            "END:VEVENT",
        ]
    now_ts = datetime.now(timezone.utc)
    for blk in blocks:
        if blk.expiresAt and blk.expiresAt < now_ts:
            continue
        lines += [
            "BEGIN:VEVENT",
            f"UID:block-{blk.id}@srinamofarms.com",
            f"DTSTAMP:{now}",
            f"DTSTART:{_ics_dt(blk.start)}",
            f"DTEND:{_ics_dt(blk.end)}",
            f"SUMMARY:{_escape(blk.source if isinstance(blk.source, str) else blk.source.value)}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return PlainTextResponse("\r\n".join(lines), media_type="text/calendar")


class ImportBody(BaseModel):
    ics: str
    source: str = "OTA_AIRBNB"
    roomId: str | None = None


def _parse_ics_events(text: str) -> list[dict]:
    events = []
    current = None
    for raw in text.splitlines():
        line = raw.strip()
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT" and current is not None:
            events.append(current)
            current = None
        elif current is not None and ":" in line:
            key, val = line.split(":", 1)
            key = key.split(";")[0]
            current[key] = val
    return events


def _parse_ics_dt(val: str) -> datetime:
    val = val.strip()
    if val.endswith("Z"):
        return datetime.strptime(val, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
    if "T" in val:
        return datetime.strptime(val[:15], "%Y%m%dT%H%M%S")
    return datetime.strptime(val[:8], "%Y%m%d")


@router.post("/import", dependencies=[Depends(require_admin)])
async def import_ical(body: ImportBody, db: AsyncSession = Depends(get_db)):
    created = 0
    skipped = 0
    for ev in _parse_ics_events(body.ics):
        uid = ev.get("UID")
        start_s = ev.get("DTSTART")
        end_s = ev.get("DTEND")
        if not start_s or not end_s:
            skipped += 1
            continue
        start = _parse_ics_dt(start_s)
        end = _parse_ics_dt(end_s)
        if uid:
            existing = await db.execute(select(InventoryBlock).where(InventoryBlock.externalUid == uid))
            if existing.scalar_one_or_none():
                skipped += 1
                continue
        db.add(InventoryBlock(
            roomId=body.roomId,
            start=start,
            end=end,
            source=body.source,
            externalUid=uid,
            notes=ev.get("SUMMARY"),
        ))
        created += 1
    await db.commit()
    return {"created": created, "skipped": skipped}
