from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import get_settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models import Booking, Guest, MessageOutbox, Payment
from app.serialize import row_to_dict
from app.services.outbox import dispatch_after_commit, enqueue_message, guest_can_message
from app.services.phone import normalize_phone

router = APIRouter(prefix="/api/actions", tags=["Actions"])

BOOKING_TEMPLATES = {
    "confirmation": "booking-confirmed",
    "pre-arrival": "checkin-reminder",
    "payment-reminder": "payment-reminder",
    "review": "review-ask",
    "upsell": "in-stay-upsell",
    "winback": "win-back",
}


class ActionBody(BaseModel):
    force: bool = False


class ReviewBulkBody(BaseModel):
    ids: list[str]
    force: bool = False


async def _booking_payload(db: AsyncSession, booking: Booking) -> dict:
    settings = get_settings()
    guest = booking.guest
    room = booking.room
    paid = 0.0
    if booking.payments:
        from app.services.folio import net_paid
        paid = float(net_paid(booking.payments))
    return {
        "guestName": guest.firstName if guest else "",
        "phone": guest.phone if guest else "",
        "bookingCode": booking.bookingCode,
        "roomNumber": room.roomNumber if room else "",
        "checkIn": booking.checkIn.isoformat() if booking.checkIn else "",
        "checkOut": booking.checkOut.isoformat() if booking.checkOut else "",
        "totalAmount": float(booking.totalAmount or 0),
        "paidAmount": paid,
        "balance": float(booking.totalAmount or 0) - paid,
        "mapUrl": settings.RESORT_MAP_URL,
        "reviewUrl": settings.REVIEW_URL,
    }


async def _load_booking(db: AsyncSession, booking_id: str) -> Booking:
    result = await db.execute(
        select(Booking).options(
            selectinload(Booking.guest),
            selectinload(Booking.room),
            selectinload(Booking.payments),
        ).where(Booking.id == booking_id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    return booking


def _assert_force(user, force: bool) -> None:
    if not force:
        return
    role = user.role.value if hasattr(user.role, "value") else user.role
    if role != "ADMIN":
        raise HTTPException(403, "Only admin can force-resend")


async def _send_booking(db, booking: Booking, template_key: str, user, force: bool):
    _assert_force(user, force)
    guest = booking.guest
    phone, consent, dnd = guest_can_message(guest, guest.phone if guest else None)
    payload = await _booking_payload(db, booking)
    msg = await enqueue_message(
        db,
        template_key=template_key,
        to_phone=phone,
        payload=payload,
        related_type="BOOKING",
        related_id=booking.id,
        user_id=getattr(user, "id", None),
        force=force,
        consent=consent,
        dnd=dnd,
    )
    await db.commit()
    msg = await dispatch_after_commit(db, msg)
    return {"queued": True, "message": row_to_dict(msg)}


@router.post("/bookings/{id}/confirmation")
async def send_confirmation(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _send_booking(db, await _load_booking(db, id), "booking-confirmed", user, body.force)


@router.post("/bookings/{id}/pre-arrival")
async def send_pre_arrival(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _send_booking(db, await _load_booking(db, id), "checkin-reminder", user, body.force)


@router.post("/bookings/{id}/payment-reminder")
async def send_payment(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _send_booking(db, await _load_booking(db, id), "payment-reminder", user, body.force)


@router.post("/bookings/{id}/review")
async def send_review(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _send_booking(db, await _load_booking(db, id), "review-ask", user, body.force)


def _skip_review(booking_id: str, reason: str) -> dict:
    return {"id": booking_id, "outcome": "skipped", "reason": reason}


async def _review_one(db: AsyncSession, booking_id: str, user, force: bool) -> dict:
    try:
        booking = await _load_booking(db, booking_id)
    except HTTPException as exc:
        if exc.status_code == 404:
            return _skip_review(booking_id, "not_found")
        raise
    status = booking.status.value if hasattr(booking.status, "value") else str(booking.status)
    if status != "CHECKED_OUT":
        return _skip_review(booking_id, "not_checked_out")
    guest = booking.guest
    phone, consent, dnd = guest_can_message(guest, guest.phone if guest else None)
    if not normalize_phone(phone):
        return _skip_review(booking_id, "no_phone")
    if consent is False:
        return _skip_review(booking_id, "no_consent")
    if dnd:
        return _skip_review(booking_id, "dnd")
    existing = await db.execute(
        select(MessageOutbox.id).where(
            MessageOutbox.templateKey == "review-ask",
            MessageOutbox.relatedType == "BOOKING",
            MessageOutbox.relatedId == booking.id,
        ).limit(1)
    )
    if existing.first() and not force:
        return _skip_review(booking_id, "already_asked")
    try:
        msg = await enqueue_message(
            db,
            template_key="review-ask",
            to_phone=phone,
            payload=await _booking_payload(db, booking),
            related_type="BOOKING",
            related_id=booking.id,
            user_id=getattr(user, "id", None),
            force=force,
            consent=consent,
            dnd=dnd,
        )
        await db.commit()
        msg = await dispatch_after_commit(db, msg)
    except Exception:
        await db.rollback()
        return _skip_review(booking_id, "error")
    sent_status = msg.status.value if hasattr(msg.status, "value") else str(msg.status)
    return {"id": booking_id, "outcome": "queued", "status": sent_status}


@router.post("/bookings/review-bulk")
async def review_bulk(body: ReviewBulkBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if len(body.ids) > 20:
        raise HTTPException(400, "Select at most 20 bookings")
    _assert_force(user, body.force)
    results = []
    for booking_id in body.ids:
        results.append(await _review_one(db, booking_id, user, body.force))
    return {"results": results}


@router.post("/bookings/{id}/upsell")
async def send_upsell(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _send_booking(db, await _load_booking(db, id), "in-stay-upsell", user, body.force)


@router.post("/guests/{id}/review")
async def guest_review(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    guest = await db.get(Guest, id)
    if not guest:
        raise HTTPException(404, "Guest not found")
    _assert_force(user, body.force)
    phone, consent, dnd = guest_can_message(guest, guest.phone)
    settings = get_settings()
    msg = await enqueue_message(
        db,
        template_key="review-ask",
        to_phone=phone,
        payload={"guestName": guest.firstName, "reviewUrl": settings.REVIEW_URL},
        related_type="GUEST",
        related_id=guest.id,
        user_id=user.id,
        force=body.force,
        consent=consent,
        dnd=dnd,
    )
    await db.commit()
    msg = await dispatch_after_commit(db, msg)
    return {"queued": True, "message": row_to_dict(msg)}


@router.post("/guests/{id}/winback")
async def guest_winback(id: str, body: ActionBody = ActionBody(), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    guest = await db.get(Guest, id)
    if not guest:
        raise HTTPException(404, "Guest not found")
    _assert_force(user, body.force)
    phone, consent, dnd = guest_can_message(guest, guest.phone)
    msg = await enqueue_message(
        db,
        template_key="win-back",
        to_phone=phone,
        payload={"guestName": guest.firstName, "code": "RETURN10"},
        related_type="GUEST",
        related_id=guest.id,
        user_id=user.id,
        force=body.force,
        consent=consent,
        dnd=dnd,
    )
    await db.commit()
    msg = await dispatch_after_commit(db, msg)
    return {"queued": True, "message": row_to_dict(msg)}


@router.get("/messages")
async def list_messages(relatedType: str, relatedId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = await db.execute(
        select(MessageOutbox)
        .where(MessageOutbox.relatedType == relatedType, MessageOutbox.relatedId == relatedId)
        .order_by(MessageOutbox.createdAt.desc())
    )
    return [row_to_dict(m) for m in q.scalars().all()]
