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


async def _booking_payload(db: AsyncSession, booking: Booking) -> dict:
    settings = get_settings()
    guest = booking.guest
    room = booking.room
    paid = 0.0
    if booking.payments:
        paid = sum(float(p.amount) for p in booking.payments if (p.status.value if hasattr(p.status, "value") else p.status) == "COMPLETED")
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
