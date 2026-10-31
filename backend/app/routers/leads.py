from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Booking, FolioItem, Guest, GuestSource, Lead, LeadOccasion, LeadStage, Room, User
from app.serialize import row_to_dict
from app.services.commission import accrue_commission
from app.services.inventory import allocate_room
from app.services.outbox import dispatch_after_commit, enqueue_message, guest_can_message
from app.services.phone import normalize_phone

router = APIRouter(prefix="/api/leads", tags=["Leads"])

IST = ZoneInfo("Asia/Kolkata")
HIGH_VALUE = Decimal("50000")
OPEN_STAGES = Lead.stage.notin_(["WON", "LOST"])
SORTS = {"newest", "oldest", "followUp", "value", "name"}
PRESETS = {"followUpToday", "overdue", "new", "mine", "highValue", "wonThisMonth"}
FOLLOW_UPS = {"overdue", "today", "week", "none"}


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


class BulkBody(BaseModel):
    ids: list[str]
    action: str
    stage: Optional[str] = None
    ownerUserId: Optional[str] = None
    lostReason: Optional[str] = None


def _bounds():
    now = datetime.now(IST)
    start_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_tomorrow = start_today + timedelta(days=1)
    start_week = start_today - timedelta(days=start_today.weekday())
    end_week = start_week + timedelta(days=7)
    start_month = start_today.replace(day=1)
    end_month = (start_month + timedelta(days=32)).replace(day=1)
    return start_today, start_tomorrow, start_week, end_week, start_month, end_month


def _date_bound(value: str, end: bool) -> datetime:
    try:
        day = datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Use a date like 2026-10-31")
    start = day.replace(tzinfo=IST)
    return start + timedelta(days=1) if end else start


def _one_of(enum_cls, value: str, label: str):
    try:
        return enum_cls(value)
    except ValueError:
        raise HTTPException(400, f"Unknown {label}")


def _preset_conditions(preset: str, user) -> list:
    if preset not in PRESETS:
        raise HTTPException(400, "Unknown view")
    start_today, start_tomorrow, start_week, end_week, start_month, end_month = _bounds()
    if preset == "followUpToday":
        return [Lead.nextFollowUpAt >= start_today, Lead.nextFollowUpAt < start_tomorrow, OPEN_STAGES]
    if preset == "overdue":
        return [Lead.nextFollowUpAt.is_not(None), Lead.nextFollowUpAt < start_today, OPEN_STAGES]
    if preset == "new":
        return [Lead.stage == LeadStage.NEW]
    if preset == "mine":
        return [Lead.ownerUserId == user.id]
    if preset == "highValue":
        return [Lead.expectedValue >= HIGH_VALUE]
    return [Lead.stage == LeadStage.WON, Lead.updatedAt >= start_month, Lead.updatedAt < end_month]


def _conditions(
    *,
    stage: Optional[str],
    due: bool,
    q: Optional[str],
    source: Optional[str],
    occasion: Optional[str],
    owner_id: Optional[str],
    partner_id: Optional[str],
    follow_up: Optional[str],
    created_from: Optional[str],
    created_to: Optional[str],
    min_value: Optional[float],
    max_value: Optional[float],
    preset: Optional[str],
    user,
) -> list:
    conds: list = []
    if preset:
        conds.extend(_preset_conditions(preset, user))
    if stage:
        conds.append(Lead.stage == _one_of(LeadStage, stage, "stage"))
    if due:
        conds.extend([
            Lead.nextFollowUpAt.is_not(None),
            Lead.nextFollowUpAt <= datetime.utcnow(),
            OPEN_STAGES,
        ])
    if q and q.strip():
        pattern = f"%{q.strip()}%"
        conds.append(or_(
            Lead.name.ilike(pattern),
            Lead.phone.ilike(pattern),
            Lead.email.ilike(pattern),
            Lead.notes.ilike(pattern),
        ))
    if source:
        conds.append(Lead.source == _one_of(GuestSource, source, "source"))
    if occasion:
        conds.append(Lead.occasion == _one_of(LeadOccasion, occasion, "occasion"))
    if owner_id:
        conds.append(Lead.ownerUserId == owner_id)
    if partner_id:
        conds.append(Lead.partnerId == partner_id)
    if follow_up:
        if follow_up not in FOLLOW_UPS:
            raise HTTPException(400, "Unknown follow-up")
        start_today, start_tomorrow, start_week, end_week, _, _ = _bounds()
        if follow_up == "overdue":
            conds.extend([Lead.nextFollowUpAt.is_not(None), Lead.nextFollowUpAt < start_today, OPEN_STAGES])
        elif follow_up == "today":
            conds.extend([Lead.nextFollowUpAt >= start_today, Lead.nextFollowUpAt < start_tomorrow, OPEN_STAGES])
        elif follow_up == "week":
            conds.extend([Lead.nextFollowUpAt >= start_week, Lead.nextFollowUpAt < end_week, OPEN_STAGES])
        else:
            conds.extend([Lead.nextFollowUpAt.is_(None), OPEN_STAGES])
    if created_from:
        conds.append(Lead.createdAt >= _date_bound(created_from, False))
    if created_to:
        conds.append(Lead.createdAt < _date_bound(created_to, True))
    if min_value is not None:
        conds.append(Lead.expectedValue >= Decimal(str(min_value)))
    if max_value is not None:
        conds.append(Lead.expectedValue <= Decimal(str(max_value)))
    return conds


def _order(sort: Optional[str]):
    if not sort:
        return Lead.updatedAt.desc()
    if sort not in SORTS:
        raise HTTPException(400, "Unknown sort")
    if sort == "newest":
        return Lead.createdAt.desc()
    if sort == "oldest":
        return Lead.createdAt.asc()
    if sort == "followUp":
        return Lead.nextFollowUpAt.asc().nulls_last()
    if sort == "value":
        return Lead.expectedValue.desc().nulls_last()
    return Lead.name.asc()


def _where(stmt, conds: list):
    for cond in conds:
        stmt = stmt.where(cond)
    return stmt


async def _count(db: AsyncSession, conds: list) -> int:
    stmt = _where(select(func.count()).select_from(Lead), conds)
    return (await db.execute(stmt)).scalar() or 0


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
    q: Optional[str] = None,
    source: Optional[str] = None,
    occasion: Optional[str] = None,
    ownerUserId: Optional[str] = None,
    partnerId: Optional[str] = None,
    followUp: Optional[str] = None,
    createdFrom: Optional[str] = None,
    createdTo: Optional[str] = None,
    minValue: Optional[float] = None,
    maxValue: Optional[float] = None,
    preset: Optional[str] = None,
    sort: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conds = _conditions(
        stage=stage, due=due, q=q, source=source, occasion=occasion, owner_id=ownerUserId,
        partner_id=partnerId, follow_up=followUp, created_from=createdFrom, created_to=createdTo,
        min_value=minValue, max_value=maxValue, preset=preset, user=user,
    )
    order = _order(sort)
    stmt = _where(select(Lead).options(selectinload(Lead.partner)), conds).order_by(order)
    total = await _count(db, conds)
    rows = (await db.execute(stmt.offset((page - 1) * limit).limit(limit))).scalars().all()
    return {
        "data": [row_to_dict(r, rels={"partner"}) for r in rows],
        "total": total,
        "page": page,
        "limit": limit,
    }


@router.get("/views")
async def lead_views(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    names = ("followUpToday", "overdue", "newUncontacted", "mine", "highValue", "wonThisMonth")
    keys = ("followUpToday", "overdue", "new", "mine", "highValue", "wonThisMonth")
    counts = {}
    for name, key in zip(names, keys):
        counts[name] = await _count(db, _preset_conditions(key, user))
    return counts


@router.get("/board")
async def lead_board(
    stage: Optional[str] = None,
    due: bool = False,
    q: Optional[str] = None,
    source: Optional[str] = None,
    occasion: Optional[str] = None,
    ownerUserId: Optional[str] = None,
    partnerId: Optional[str] = None,
    followUp: Optional[str] = None,
    createdFrom: Optional[str] = None,
    createdTo: Optional[str] = None,
    minValue: Optional[float] = None,
    maxValue: Optional[float] = None,
    preset: Optional[str] = None,
    sort: Optional[str] = None,
    perColumn: Optional[int] = Query(None, ge=1, le=200),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conds = _conditions(
        stage=stage, due=due, q=q, source=source, occasion=occasion, owner_id=ownerUserId,
        partner_id=partnerId, follow_up=followUp, created_from=createdFrom, created_to=createdTo,
        min_value=minValue, max_value=maxValue, preset=preset, user=user,
    )
    legacy = perColumn is None and not conds
    if legacy:
        rows = (await db.execute(select(Lead).options(selectinload(Lead.partner)).order_by(Lead.updatedAt.desc()))).scalars().all()
        board = {s.value: [] for s in LeadStage}
        counts = {s.value: 0 for s in LeadStage}
        for lead in rows:
            key = lead.stage.value if hasattr(lead.stage, "value") else str(lead.stage)
            board.setdefault(key, []).append(row_to_dict(lead, rels={"partner"}))
            counts[key] = counts.get(key, 0) + 1
        due_rows = [
            row_to_dict(l, rels={"partner"})
            for l in rows
            if l.nextFollowUpAt and (l.stage.value if hasattr(l.stage, "value") else l.stage) not in ("WON", "LOST")
            and l.nextFollowUpAt.replace(tzinfo=None) <= datetime.utcnow()
        ]
        return {"board": board, "dueToday": due_rows, "counts": counts}

    order = _order(sort)
    count_stmt = _where(select(Lead.stage, func.count()).group_by(Lead.stage), conds)
    counts = {s.value: 0 for s in LeadStage}
    for stage_value, total in (await db.execute(count_stmt)).all():
        key = stage_value.value if hasattr(stage_value, "value") else str(stage_value)
        counts[key] = total
    board = {s.value: [] for s in LeadStage}
    has_more = {}
    for item in LeadStage:
        column = _where(
            select(Lead).options(selectinload(Lead.partner)).where(Lead.stage == item),
            conds,
        ).order_by(order)
        if perColumn is not None:
            column = column.limit(perColumn)
        found = (await db.execute(column)).scalars().all()
        board[item.value] = [row_to_dict(lead, rels={"partner"}) for lead in found]
        if perColumn is not None:
            has_more[item.value] = counts.get(item.value, 0) > len(found)
    due_rows = (await db.execute(
        select(Lead).options(selectinload(Lead.partner)).where(
            Lead.nextFollowUpAt.is_not(None),
            Lead.stage.notin_(["WON", "LOST"]),
        ).order_by(Lead.updatedAt.desc())
    )).scalars().all()
    due_today = [
        row_to_dict(lead, rels={"partner"})
        for lead in due_rows
        if lead.nextFollowUpAt.replace(tzinfo=None) <= datetime.utcnow()
    ]
    payload = {"board": board, "dueToday": due_today, "counts": counts}
    if perColumn is not None:
        payload["hasMore"] = has_more
    return payload


@router.post("/bulk")
async def bulk_leads(body: BulkBody, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    if len(body.ids) > 20:
        raise HTTPException(400, "Select at most 20 leads")
    if body.action not in ("stage", "assign", "lost"):
        raise HTTPException(400, "Unknown action")
    if body.action == "lost" and not (body.lostReason or "").strip():
        raise HTTPException(400, "A reason is required")
    if body.action == "stage":
        _one_of(LeadStage, body.stage or "", "stage")
    if body.action == "assign":
        if not body.ownerUserId:
            raise HTTPException(400, "Choose an owner")
        owner = await db.get(User, body.ownerUserId)
        if not owner or not owner.isActive:
            raise HTTPException(400, "Owner not found")
    results = []
    for lead_id in body.ids:
        lead = await db.get(Lead, lead_id)
        if not lead:
            results.append({"id": lead_id, "outcome": "skipped", "reason": "not_found"})
            continue
        if body.action == "stage":
            lead.stage = body.stage
        elif body.action == "assign":
            lead.ownerUserId = body.ownerUserId
        else:
            lead.stage = LeadStage.LOST
            lead.lostReason = body.lostReason.strip()
        results.append({"id": lead_id, "outcome": "updated"})
    await db.commit()
    return {"results": results}


@router.post("")
async def create_lead(body: LeadBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    lead = Lead()
    _apply(lead, body)
    if not body.ownerUserId:
        lead.ownerUserId = user.id
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
