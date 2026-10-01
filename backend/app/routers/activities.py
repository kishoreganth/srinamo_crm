from decimal import Decimal
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Activity, ActivityBooking, Guest, FolioItem
from app.dependencies import get_current_user, require_admin
from app.serialize import row_to_dict


class ActivityBookingStatusEnum(str, Enum):
    CONFIRMED = "CONFIRMED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class CreateActivityRequest(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    maxParticipants: int
    duration: Optional[str] = None
    isActive: bool = True


class BookActivityRequest(BaseModel):
    activityId: str
    guestId: str
    bookingId: Optional[str] = None
    scheduledDate: str
    participants: int = 1
    notes: Optional[str] = None


router = APIRouter(prefix="/api/activities", tags=["Activities"])


@router.get("")
async def get_activities(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).where(Activity.isActive == True).order_by(Activity.name.asc()))
    return [row_to_dict(a, rels=set()) for a in result.scalars().all()]


@router.post("", dependencies=[Depends(require_admin)])
async def create_activity(body: CreateActivityRequest, db: AsyncSession = Depends(get_db)):
    activity = Activity(**body.model_dump())
    db.add(activity)
    await db.commit()
    await db.refresh(activity)
    return row_to_dict(activity, rels=set())


@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def update_activity(id: str, body: CreateActivityRequest, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(activity, k, v)
    await db.commit()
    await db.refresh(activity)
    return row_to_dict(activity, rels=set())


@router.delete("/{id}", dependencies=[Depends(require_admin)])
async def delete_activity(id: str, db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, id)
    if not activity:
        raise HTTPException(404, "Activity not found")
    activity.isActive = False
    await db.commit()
    await db.refresh(activity)
    return row_to_dict(activity, rels=set())


@router.post("/bookings")
async def book_activity(body: BookActivityRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    activity = await db.get(Activity, body.activityId)
    if not activity:
        raise HTTPException(404, "Activity not found")
    if not activity.isActive:
        raise HTTPException(400, "Activity is not available")

    guest = await db.get(Guest, body.guestId)
    if not guest:
        raise HTTPException(404, "Guest not found")

    scheduled = datetime.fromisoformat(body.scheduledDate)
    start_of_day = scheduled.replace(hour=0, minute=0, second=0, microsecond=0)
    end_of_day = scheduled.replace(hour=23, minute=59, second=59, microsecond=999999)

    existing_q = await db.execute(
        select(ActivityBooking).where(
            ActivityBooking.activityId == body.activityId,
            ActivityBooking.scheduledDate >= start_of_day,
            ActivityBooking.scheduledDate <= end_of_day,
            ActivityBooking.status == "CONFIRMED",
        )
    )
    existing = existing_q.scalars().all()
    total_booked = sum(b.participants for b in existing)
    if total_booked + body.participants > activity.maxParticipants:
        raise HTTPException(400, f"Capacity exceeded. Available spots: {activity.maxParticipants - total_booked}")

    ab = ActivityBooking(
        activityId=body.activityId,
        guestId=body.guestId,
        bookingId=body.bookingId,
        scheduledDate=scheduled,
        participants=body.participants,
        notes=body.notes,
    )
    db.add(ab)
    await db.commit()
    await db.refresh(ab)

    if body.bookingId:
        total_cost = Decimal(str(activity.price)) * body.participants
        folio = FolioItem(
            bookingId=body.bookingId,
            description=f"{activity.name} (x{body.participants})",
            category="ACTIVITY",
            amount=float(total_cost),
            quantity=1,
        )
        db.add(folio)
        await db.commit()

    return row_to_dict(ab, rels={"activity", "guest"})


@router.get("/bookings")
async def get_activity_bookings(
    activityId: Optional[str] = None,
    guestId: Optional[str] = None,
    status: Optional[str] = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ActivityBooking).options(
        selectinload(ActivityBooking.activity),
        selectinload(ActivityBooking.guest),
        selectinload(ActivityBooking.booking),
    )
    if activityId:
        stmt = stmt.where(ActivityBooking.activityId == activityId)
    if guestId:
        stmt = stmt.where(ActivityBooking.guestId == guestId)
    if status:
        stmt = stmt.where(ActivityBooking.status == status)
    stmt = stmt.order_by(ActivityBooking.scheduledDate.desc())
    result = await db.execute(stmt)
    return [row_to_dict(ab, rels={"activity", "guest", "booking"}) for ab in result.scalars().all()]


@router.patch("/bookings/{id}/status")
async def update_activity_booking_status(id: str, status: str = Body(..., embed=True), user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ab = await db.get(ActivityBooking, id)
    if not ab:
        raise HTTPException(404, "Activity booking not found")
    ab.status = status
    await db.commit()
    await db.refresh(ab)
    return row_to_dict(ab, rels={"activity", "guest"})
