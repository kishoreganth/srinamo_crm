from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import EventDeal, InventoryBlock
from app.serialize import row_to_dict
from app.services.commission import accrue_commission

router = APIRouter(prefix="/api/events", tags=["Events"])


class EventBody(BaseModel):
    type: str = "WEDDING"
    eventDate: str
    venue: str = "LAWN"
    pax: int = 50
    status: Optional[str] = None
    quotedAmount: Optional[float] = None
    exclusiveBuyout: bool = False
    leadId: Optional[str] = None
    guestId: Optional[str] = None
    partnerId: Optional[str] = None
    notes: Optional[str] = None


class RoomHoldBody(BaseModel):
    roomId: Optional[str] = None
    nights: int = 1
    exclusive: bool = False


@router.get("")
async def list_events(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (
        await db.execute(
            select(EventDeal)
            .options(selectinload(EventDeal.guest), selectinload(EventDeal.partner), selectinload(EventDeal.lead))
            .order_by(EventDeal.eventDate.desc())
        )
    ).scalars().all()
    return [row_to_dict(e, rels={"guest", "partner", "lead"}) for e in rows]


@router.post("")
async def create_event(body: EventBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = EventDeal(
        type=body.type,
        eventDate=datetime.fromisoformat(body.eventDate),
        venue=body.venue,
        pax=body.pax,
        status=body.status or "INQUIRY",
        quotedAmount=Decimal(str(body.quotedAmount)) if body.quotedAmount is not None else None,
        exclusiveBuyout=body.exclusiveBuyout,
        leadId=body.leadId,
        guestId=body.guestId,
        partnerId=body.partnerId,
        notes=body.notes,
    )
    db.add(event)
    await db.flush()
    if event.partnerId and event.quotedAmount:
        await accrue_commission(db, partner_id=event.partnerId, base_amount=event.quotedAmount, event_id=event.id)
    await db.commit()
    await db.refresh(event)
    return row_to_dict(event)


@router.get("/{id}")
async def get_event(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(EventDeal)
        .options(
            selectinload(EventDeal.guest),
            selectinload(EventDeal.partner),
            selectinload(EventDeal.lead),
            selectinload(EventDeal.roomHolds),
        )
        .where(EventDeal.id == id)
    )
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(404, "Event not found")
    return row_to_dict(event, rels={"guest", "partner", "lead", "roomHolds"})


@router.patch("/{id}")
async def update_event(id: str, body: EventBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(EventDeal, id)
    if not event:
        raise HTTPException(404, "Event not found")
    event.type = body.type
    event.eventDate = datetime.fromisoformat(body.eventDate)
    event.venue = body.venue
    event.pax = body.pax
    if body.status:
        event.status = body.status
    event.quotedAmount = Decimal(str(body.quotedAmount)) if body.quotedAmount is not None else event.quotedAmount
    event.exclusiveBuyout = body.exclusiveBuyout
    event.leadId = body.leadId
    event.guestId = body.guestId
    event.partnerId = body.partnerId
    event.notes = body.notes
    await db.commit()
    await db.refresh(event)
    return row_to_dict(event)


@router.post("/{id}/hold-rooms")
async def hold_rooms(id: str, body: RoomHoldBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    event = await db.get(EventDeal, id)
    if not event:
        raise HTTPException(404, "Event not found")
    start = event.eventDate
    end = start + timedelta(days=max(body.nights, 1))
    block = InventoryBlock(
        roomId=None if (body.exclusive or event.exclusiveBuyout) else body.roomId,
        start=start,
        end=end,
        source="EVENT",
        eventId=event.id,
        createdByUserId=user.id,
        notes=f"Event hold {event.id}",
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return row_to_dict(block)
