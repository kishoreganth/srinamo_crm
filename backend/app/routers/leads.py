from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Booking, FolioItem, Guest, Lead, LeadOccasion, LeadStage, Room
from app.serialize import row_to_dict
from app.services.commission import accrue_commission
from app.services.inventory import allocate_room
from app.services.outbox import dispatch_after_commit, enqueue_message, guest_can_message
from app.services.phone import normalize_phone

router = APIRouter(prefix="/api/leads", tags=["Leads"])


class LeadBody(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    source: str = "PHONE"
    occasion: str = "STAY"
    stage: Optional[str] = None
    expectedValue: Optional[float] = None
    lostReason: Optional[str] = None
    nextFollowUpAt: Optional[str] = None
    ownerUserId: Optional[str] = None
    partnerId: Optional[str] = None
    notes: Optional[str] = None


class ConvertBookingBody(BaseModel):
    roomId: str
    checkIn: str
    checkOut: str
    adults: int = 1
    children: int = 0


class ConvertEventBody(BaseModel):
    eventDate: str
    venue: str = "LAWN"
    pax: int = 50
    quotedAmount: Optional[float] = None
    exclusiveBuyout: bool = False
    notes: Optional[str] = None


class LostBody(BaseModel):
    lostReason: str


class LogCallBody(BaseModel):
    notes: Optional[str] = None
    nextFollowUpAt: Optional[str] = None
    stage: Optional[str] = "CONTACTED"


def _apply(lead: Lead, body: LeadBody):
    lead.name = body.name
    lead.phone = normalize_phone(body.phone)
    lead.email = body.email
    lead.source = body.source
    lead.occasion = body.occasion
    if body.stage:
        lead.stage = body.stage
    lead.expectedValue = Decimal(str(body.expectedValue)) if body.expectedValue is not None else None
    lead.lostReason = body.lostReason
    lead.nextFollowUpAt = datetime.fromisoformat(body.nextFollowUpAt) if body.nextFollowUpAt else None
    lead.ownerUserId = body.ownerUserId
    lead.partnerId = body.partnerId
    lead.notes = body.notes


@router.get("")
async def list_leads(
    stage: Optional[str] = None,
    due: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Lead).options(selectinload(Lead.partner)).order_by(Lead.updatedAt.desc())
    if stage:
        stmt = stmt.where(Lead.stage == stage)
    if due:
        stmt = stmt.where(Lead.nextFollowUpAt.is_not(None), Lead.nextFollowUpAt <= datetime.utcnow(), Lead.stage.notin_(["WON", "LOST"]))
    total = (await db.execute(select(func.count()).select_from(stmt.order_by(None).subquery()))).scalar()
    rows = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "data": [row_to_dict(r, rels={"partner"}) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/board")
async def lead_board(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Lead).options(selectinload(Lead.partner)).order_by(Lead.updatedAt.desc()))).scalars().all()
    board = {s.value: [] for s in LeadStage}
    for lead in rows:
        key = lead.stage.value if hasattr(lead.stage, "value") else str(lead.stage)
        board.setdefault(key, []).append(row_to_dict(lead, rels={"partner"}))
    due = [
        row_to_dict(l, rels={"partner"})
        for l in rows
        if l.nextFollowUpAt and (l.stage.value if hasattr(l.stage, "value") else l.stage) not in ("WON", "LOST")
        and l.nextFollowUpAt.replace(tzinfo=None) <= datetime.utcnow()
    ]
    return {"board": board, "dueToday": due}


@router.post("")
async def create_lead(body: LeadBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = Lead()
    _apply(lead, body)
    if not lead.stage:
        lead.stage = LeadStage.NEW
    db.add(lead)
    await db.commit()
    await db.refresh(lead)
    return row_to_dict(lead)


@router.get("/{id}")
async def get_lead(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Lead).options(selectinload(Lead.partner)).where(Lead.id == id))
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(404, "Lead not found")
    return row_to_dict(lead, rels={"partner"})


@router.patch("/{id}")
async def update_lead(id: str, body: LeadBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    _apply(lead, body)
    await db.commit()
    await db.refresh(lead)
    return row_to_dict(lead)


@router.post("/{id}/log-call")
async def log_call(id: str, body: LogCallBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    if body.stage:
        lead.stage = body.stage
    if body.nextFollowUpAt:
        lead.nextFollowUpAt = datetime.fromisoformat(body.nextFollowUpAt)
    if body.notes:
        lead.notes = (lead.notes or "") + f"\n[{datetime.utcnow().isoformat(timespec='minutes')}] {body.notes}"
    await db.commit()
    await db.refresh(lead)
    return row_to_dict(lead)


@router.post("/{id}/lost")
async def mark_lost(id: str, body: LostBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    lead.stage = LeadStage.LOST
    lead.lostReason = body.lostReason
    await db.commit()
    await db.refresh(lead)
    return row_to_dict(lead)


@router.post("/{id}/convert-booking")
async def convert_booking(id: str, body: ConvertBookingBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.routers.bookings import _calculate_price, _generate_booking_code

    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    phone = normalize_phone(lead.phone)
    existing = await db.execute(select(Guest).where(Guest.phone == phone, Guest.deletedAt.is_(None)))
    guest = existing.scalar_one_or_none()
    if not guest:
        parts = (lead.name or "Guest").split(" ", 1)
        guest = Guest(
            firstName=parts[0],
            lastName=parts[1] if len(parts) > 1 else "",
            phone=phone,
            email=lead.email,
            source=lead.source or "PHONE",
            lastStayOccasion=lead.occasion.value if hasattr(lead.occasion, "value") else str(lead.occasion),
        )
        db.add(guest)
        await db.flush()

    ci = datetime.fromisoformat(body.checkIn)
    co = datetime.fromisoformat(body.checkOut)
    room = await allocate_room(db, body.roomId, ci, co)
    total = await _calculate_price(db, room.roomTypeId, ci, co)
    code = await _generate_booking_code(db)
    booking = Booking(
        bookingCode=code,
        guestId=guest.id,
        roomId=room.id,
        checkIn=ci,
        checkOut=co,
        adults=body.adults,
        children=body.children,
        status="CONFIRMED",
        source="PARTNER" if lead.partnerId else "WHATSAPP",
        partnerId=lead.partnerId,
        totalAmount=total,
    )
    db.add(booking)
    await db.flush()
    db.add(FolioItem(
        bookingId=booking.id,
        description=f"Room Charges - {room.roomType.name if room.roomType else 'Room'}",
        category="ROOM",
        amount=total,
        quantity=1,
    ))
    await accrue_commission(db, partner_id=lead.partnerId, base_amount=total, booking_id=booking.id)
    lead.stage = LeadStage.WON
    lead.convertedGuestId = guest.id
    lead.convertedBookingId = booking.id
    await db.commit()
    await db.refresh(booking)
    return row_to_dict(booking, rels={"guest", "room"})


@router.post("/{id}/convert-event")
async def convert_event(id: str, body: ConvertEventBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from app.models import EventDeal

    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    event = EventDeal(
        type=lead.occasion or LeadOccasion.WEDDING,
        eventDate=datetime.fromisoformat(body.eventDate),
        venue=body.venue,
        pax=body.pax,
        status="QUOTED",
        quotedAmount=Decimal(str(body.quotedAmount)) if body.quotedAmount is not None else lead.expectedValue,
        exclusiveBuyout=body.exclusiveBuyout,
        leadId=lead.id,
        partnerId=lead.partnerId,
        notes=body.notes,
    )
    db.add(event)
    await db.flush()
    if event.quotedAmount and lead.partnerId:
        await accrue_commission(db, partner_id=lead.partnerId, base_amount=event.quotedAmount, event_id=event.id)
    lead.stage = LeadStage.WON
    lead.convertedEventId = event.id
    await db.commit()
    await db.refresh(event)
    return row_to_dict(event)


@router.post("/{id}/send-quote")
async def send_quote(id: str, force: bool = False, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    phone, consent, dnd = guest_can_message(None, lead.phone)
    msg = await enqueue_message(
        db,
        template_key="lead-quote",
        to_phone=phone,
        payload={
            "guestName": lead.name,
            "occasion": lead.occasion.value if hasattr(lead.occasion, "value") else lead.occasion,
            "expectedValue": float(lead.expectedValue) if lead.expectedValue else None,
            "notes": lead.notes,
        },
        related_type="LEAD",
        related_id=lead.id,
        user_id=user.id,
        force=force,
        consent=consent,
        dnd=dnd,
    )
    if lead.stage in (LeadStage.NEW, "NEW"):
        lead.stage = LeadStage.QUOTED
    await db.commit()
    msg = await dispatch_after_commit(db, msg)
    return {"queued": True, "message": row_to_dict(msg)}
