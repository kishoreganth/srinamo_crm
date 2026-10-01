from datetime import datetime, timezone, timedelta
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import (
    Booking, Room, RoomType, Guest, RatePlan, FolioItem,
    HousekeepingTask, FoodOrder, FoodOrderItem, MenuItem,
    ActivityBooking as ActivityBookingModel, Activity,
    Payment, BookingGuest, BookingRoom, BookingAmenity, Amenity, DayPackage,
)
from app.dependencies import get_current_user
from app.serialize import row_to_dict
import math


class BookingSource(str, Enum):
    WALK_IN = "WALK_IN"
    PHONE = "PHONE"
    ONLINE = "ONLINE"
    OTA = "OTA"
    WHATSAPP = "WHATSAPP"
    REFERRAL = "REFERRAL"
    PARTNER = "PARTNER"
    IMPORT = "IMPORT"


class BookingStatus(str, Enum):
    CONFIRMED = "CONFIRMED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"
    CANCELLED = "CANCELLED"
    NO_SHOW = "NO_SHOW"


class CompanionData(BaseModel):
    guestName: str
    idType: Optional[str] = None
    idNumber: Optional[str] = None
    idDocumentUrl: Optional[str] = None


class AmenityPick(BaseModel):
    amenityId: str
    quantity: int = 1


class CreateBookingRequest(BaseModel):
    guestId: str
    roomId: str
    roomIds: Optional[list[str]] = None
    packageId: Optional[str] = None
    amenityIds: Optional[list[str]] = None
    amenitySelections: Optional[list[AmenityPick]] = None
    checkIn: str
    checkOut: str
    adults: int = 1
    children: int = 0
    source: BookingSource = BookingSource.WALK_IN
    partnerId: Optional[str] = None
    specialRequests: Optional[str] = None
    companions: Optional[list[CompanionData]] = None


class UpdateBookingStatusRequest(BaseModel):
    status: BookingStatus
    actualAdults: Optional[int] = None
    actualChildren: Optional[int] = None
    primaryIdDocumentUrl: Optional[str] = None
    companions: Optional[list[CompanionData]] = None


class UpdateBookingRequest(BaseModel):
    checkIn: Optional[str] = None
    checkOut: Optional[str] = None
    roomId: Optional[str] = None
    adults: Optional[int] = None
    children: Optional[int] = None
    specialRequests: Optional[str] = None


ALLOWED_TRANSITIONS = {
    "CONFIRMED": ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
    "CHECKED_IN": ["CHECKED_OUT"],
    "CHECKED_OUT": [],
    "CANCELLED": [],
    "NO_SHOW": [],
}

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


async def _calculate_price(db: AsyncSession, room_type_id: str, check_in: datetime, check_out: datetime) -> Decimal:
    rt = await db.get(RoomType, room_type_id)
    if not rt:
        raise HTTPException(404, "Room type not found")

    total = Decimal("0")
    current = datetime(check_in.year, check_in.month, check_in.day)
    end = datetime(check_out.year, check_out.month, check_out.day)

    while current < end:
        is_weekend = current.weekday() >= 5
        day_type = "WEEKEND" if is_weekend else "WEEKDAY"

        result = await db.execute(
            select(RatePlan).where(
                RatePlan.roomTypeId == room_type_id,
                RatePlan.isActive == True,
                RatePlan.startDate <= current,
                RatePlan.endDate >= current,
                RatePlan.dayType.in_([day_type, "ALL"]),
            ).order_by(RatePlan.priority.desc()).limit(1)
        )
        rate_plan = result.scalar_one_or_none()
        night_price = Decimal(str(rate_plan.price)) if rate_plan else Decimal(str(rt.basePrice))
        total += night_price
        current += timedelta(days=1)

    return total


async def _generate_booking_code(db: AsyncSession) -> str:
    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    prefix = f"SNF-{date_str}"
    result = await db.execute(
        select(Booking).where(Booking.bookingCode.startswith(prefix)).order_by(Booking.bookingCode.desc()).limit(1)
    )
    last = result.scalar_one_or_none()
    seq = 1
    if last:
        parts = last.bookingCode.split("-")
        seq = int(parts[-1]) + 1
    return f"{prefix}-{seq:03d}"


async def _booking_room_ids(db, booking) -> list[str]:
    rows = await db.execute(select(BookingRoom.roomId).where(BookingRoom.bookingId == booking.id))
    ids = [row[0] for row in rows.all()]
    if booking.roomId and booking.roomId not in ids:
        ids.insert(0, booking.roomId)
    return ids


async def _set_booking_rooms_status(db, booking, status: str, housekeeping: bool = False):
    for room_id in await _booking_room_ids(db, booking):
        room = await db.get(Room, room_id)
        if room:
            room.status = status
        if housekeeping:
            db.add(HousekeepingTask(roomId=room_id, taskType="CLEANING", status="PENDING"))


async def _enqueue_booking_message(db, booking, template_key: str, user_id=None):
    from sqlalchemy.orm import selectinload
    from app.services.outbox import dispatch_after_commit, enqueue_message, guest_can_message
    from app.config import get_settings
    result = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room)).where(Booking.id == booking.id)
    )
    booking = result.scalar_one_or_none() or booking
    guest = booking.guest
    settings = get_settings()
    try:
        phone, consent, dnd = guest_can_message(guest, guest.phone if guest else None)
        msg = await enqueue_message(
            db,
            template_key=template_key,
            to_phone=phone,
            payload={
                "guestName": guest.firstName if guest else "",
                "bookingCode": booking.bookingCode,
                "roomNumber": booking.room.roomNumber if booking.room else "",
                "checkIn": booking.checkIn.isoformat() if booking.checkIn else "",
                "checkOut": booking.checkOut.isoformat() if booking.checkOut else "",
                "totalAmount": float(booking.totalAmount or 0),
                "mapUrl": settings.RESORT_MAP_URL,
                "reviewUrl": settings.REVIEW_URL,
            },
            related_type="BOOKING",
            related_id=booking.id,
            user_id=user_id,
            consent=consent,
            dnd=dnd,
        )
        await db.commit()
        await dispatch_after_commit(db, msg)
    except Exception:
        pass


@router.post("")
async def create_booking(body: CreateBookingRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    ci = datetime.fromisoformat(body.checkIn)
    co = datetime.fromisoformat(body.checkOut)
    if ci >= co:
        raise HTTPException(400, "Check-out must be after check-in")

    from app.services.inventory import allocate_room
    from app.services.commission import accrue_commission

    room_ids: list[str] = []
    for rid in (body.roomIds or [body.roomId]):
        if rid and rid not in room_ids:
            room_ids.append(rid)
    if not room_ids:
        raise HTTPException(400, "Choose at least one room")

    if not body.packageId:
        raise HTTPException(400, "Choose a day package")
    package = await db.get(DayPackage, body.packageId)
    if not package or not package.isActive:
        raise HTTPException(400, "Choose a day package")

    rooms = []
    for rid in room_ids:
        rooms.append(await allocate_room(db, rid, ci, co))

    paying = max(body.adults, 0)
    total_amount = Decimal(str(package.pricePerPerson)) * paying

    picks: dict[str, int] = {}
    for pick in body.amenitySelections or []:
        if pick.amenityId:
            picks[pick.amenityId] = max(int(pick.quantity or 1), 1)
    for aid in body.amenityIds or []:
        if aid and aid not in picks:
            picks[aid] = 1
    amenities = []
    amenity_qty: dict[str, int] = {}
    if picks:
        found = await db.execute(select(Amenity).where(Amenity.id.in_(list(picks)), Amenity.isActive == True))
        by_id = {a.id: a for a in found.scalars().all()}
        if set(picks) - set(by_id):
            raise HTTPException(400, "One of the add-ons is not available")
        for amenity_id, qty in picks.items():
            amenity = by_id[amenity_id]
            if amenity.included:
                continue
            amenities.append(amenity)
            amenity_qty[amenity.id] = qty
            total_amount += Decimal(str(amenity.price or 0)) * qty

    booking_code = await _generate_booking_code(db)
    room = rooms[0]

    booking = Booking(
        bookingCode=booking_code,
        guestId=body.guestId,
        roomId=room.id,
        checkIn=ci,
        checkOut=co,
        adults=body.adults,
        children=body.children,
        status="CONFIRMED",
        source=body.source,
        partnerId=body.partnerId,
        packageId=package.id,
        totalAmount=total_amount,
        specialRequests=body.specialRequests,
    )
    db.add(booking)
    await db.flush()

    for comp in body.companions or []:
        name = (comp.guestName or "").strip()
        if not name:
            continue
        db.add(BookingGuest(
            bookingId=booking.id,
            guestName=name,
            idType=comp.idType,
            idNumber=comp.idNumber,
        ))

    for booked_room in rooms:
        db.add(BookingRoom(bookingId=booking.id, roomId=booked_room.id))
    for amenity in amenities:
        db.add(BookingAmenity(
            bookingId=booking.id,
            amenityId=amenity.id,
            quantity=amenity_qty.get(amenity.id, 1),
        ))

    package_amount = Decimal(str(package.pricePerPerson)) * paying
    folio = FolioItem(
        bookingId=booking.id,
        description=f"{package.name} · {paying} paying guest{'s' if paying != 1 else ''}",
        category="PACKAGE",
        amount=package_amount,
        quantity=paying,
    )
    db.add(folio)
    for amenity in amenities:
        qty = amenity_qty.get(amenity.id, 1)
        amount = Decimal(str(amenity.price or 0)) * qty
        if amount > 0:
            db.add(FolioItem(
                bookingId=booking.id,
                description=amenity.name,
                category="AMENITY",
                amount=amount,
                quantity=qty,
            ))
    await accrue_commission(db, partner_id=body.partnerId, base_amount=total_amount, booking_id=booking.id)
    await db.commit()
    await db.refresh(booking)

    await _enqueue_booking_message(db, booking, "booking-confirmed", getattr(user, "id", None))
    return row_to_dict(booking, rels={"guest", "room"})


@router.get("")
async def get_bookings(
    status: Optional[str] = None,
    guestId: Optional[str] = None,
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    skip = (page - 1) * limit
    stmt = select(Booking).options(
        selectinload(Booking.guest),
        selectinload(Booking.room).selectinload(Room.roomType),
    ).where(Booking.deletedAt.is_(None))

    if status:
        stmt = stmt.where(Booking.status == status)
    if guestId:
        stmt = stmt.where(Booking.guestId == guestId)
    if from_date and to_date:
        stmt = stmt.where(Booking.checkIn >= datetime.fromisoformat(from_date), Booking.checkOut <= datetime.fromisoformat(to_date))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_q = await db.execute(count_stmt)
    total = total_q.scalar()

    stmt = stmt.order_by(Booking.createdAt.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    bookings_list = result.scalars().all()
    data = [row_to_dict(b, rels={"guest", "room"}) for b in bookings_list]

    booking_ids = [b.id for b in bookings_list]
    if booking_ids:
        paid_q = await db.execute(
            select(Payment.bookingId, func.sum(Payment.amount))
            .where(Payment.bookingId.in_(booking_ids), Payment.status == "COMPLETED")
            .group_by(Payment.bookingId)
        )
        paid_map = {row[0]: float(row[1]) for row in paid_q.all()}
        for d in data:
            d["paidAmount"] = paid_map.get(d["id"], 0)
    else:
        for d in data:
            d["paidAmount"] = 0

    return {"data": data, "meta": {"total": total, "page": page, "limit": limit, "totalPages": math.ceil(total / limit) if total > 0 else 0}}


@router.get("/today")
async def get_today_bookings(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + timedelta(days=1)

    arrivals_q = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room).selectinload(Room.roomType))
        .where(Booking.checkIn >= today, Booking.checkIn < tomorrow, Booking.status.in_(["CONFIRMED", "CHECKED_IN"]))
        .order_by(Booking.checkIn.asc())
    )
    departures_q = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room).selectinload(Room.roomType))
        .where(Booking.checkOut >= today, Booking.checkOut < tomorrow, Booking.status == "CHECKED_IN")
        .order_by(Booking.checkOut.asc())
    )
    return {
        "arrivals": [row_to_dict(b, rels={"guest", "room"}) for b in arrivals_q.scalars().all()],
        "departures": [row_to_dict(b, rels={"guest", "room"}) for b in departures_q.scalars().all()],
    }


@router.get("/calendar")
async def get_calendar(
    from_date: str = Query(..., alias="from"),
    to_date: str = Query(..., alias="to"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    f = datetime.fromisoformat(from_date)
    t = datetime.fromisoformat(to_date)
    result = await db.execute(
        select(Booking).options(selectinload(Booking.guest), selectinload(Booking.room))
        .where(Booking.status.in_(["CONFIRMED", "CHECKED_IN"]), Booking.checkIn <= t, Booking.checkOut >= f)
        .order_by(Booking.checkIn.asc())
    )
    from app.models import InventoryBlock
    from sqlalchemy import or_
    now = datetime.now(timezone.utc)
    blocks_q = await db.execute(
        select(InventoryBlock).options(selectinload(InventoryBlock.room)).where(
            InventoryBlock.start <= t,
            InventoryBlock.end >= f,
            or_(InventoryBlock.expiresAt.is_(None), InventoryBlock.expiresAt > now),
        )
    )
    bookings = result.scalars().all()
    booking_ids = [b.id for b in bookings]
    extra_map: dict[str, list[str]] = {}
    if booking_ids:
        extra_rows = await db.execute(select(BookingRoom).where(BookingRoom.bookingId.in_(booking_ids)))
        for row in extra_rows.scalars().all():
            extra_map.setdefault(row.bookingId, []).append(row.roomId)
    calendar_bookings = []
    for b in bookings:
        data = row_to_dict(b, rels={"guest", "room"})
        calendar_bookings.append(data)
        for room_id in extra_map.get(b.id, []):
            if room_id != b.roomId:
                clone = dict(data)
                clone["roomId"] = room_id
                calendar_bookings.append(clone)
    return {
        "bookings": calendar_bookings,
        "blocks": [row_to_dict(b, rels={"room"}) for b in blocks_q.scalars().all()],
    }


@router.get("/{id}")
async def get_booking(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking).options(
            selectinload(Booking.guest),
            selectinload(Booking.room).selectinload(Room.roomType),
            selectinload(Booking.payments),
            selectinload(Booking.folioItems),
            selectinload(Booking.foodOrders).selectinload(FoodOrder.items).selectinload(FoodOrderItem.menuItem),
            selectinload(Booking.activityBookings).selectinload(ActivityBookingModel.activity),
            selectinload(Booking.bookingGuests),
        ).where(Booking.id == id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    data = row_to_dict(booking, rels={"guest", "room", "payments", "folioItems", "foodOrders", "activityBookings", "bookingGuests"})
    data["paidAmount"] = sum(
        float(p.amount) for p in booking.payments if p.status == "COMPLETED"
    )
    room_rows = await db.execute(
        select(BookingRoom).options(selectinload(BookingRoom.room).selectinload(Room.roomType)).where(BookingRoom.bookingId == booking.id)
    )
    data["rooms"] = [row_to_dict(row.room, rels={"roomType"}) for row in room_rows.scalars().all() if row.room]
    amenity_rows = await db.execute(
        select(BookingAmenity).options(selectinload(BookingAmenity.amenity)).where(BookingAmenity.bookingId == booking.id)
    )
    data["amenities"] = [row_to_dict(row.amenity, rels=set()) for row in amenity_rows.scalars().all() if row.amenity]
    if booking.packageId:
        package = await db.get(DayPackage, booking.packageId)
        if package:
            data["package"] = row_to_dict(package, rels=set())
    return data


@router.patch("/{id}/status")
async def update_booking_status(id: str, body: UpdateBookingStatusRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking).options(selectinload(Booking.room)).where(Booking.id == id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")

    allowed = ALLOWED_TRANSITIONS.get(booking.status, [])
    if body.status not in allowed:
        raise HTTPException(400, f"Cannot transition from {booking.status} to {body.status}")

    booking.status = body.status
    await db.flush()

    if body.status == "CHECKED_IN":
        if body.actualAdults is not None:
            booking.actualAdults = body.actualAdults
        if body.actualChildren is not None:
            booking.actualChildren = body.actualChildren

        if body.primaryIdDocumentUrl:
            guest = await db.get(Guest, booking.guestId)
            if guest:
                guest.idDocumentUrl = body.primaryIdDocumentUrl

        if body.companions:
            for comp in body.companions:
                bg = BookingGuest(
                    bookingId=booking.id,
                    guestName=comp.guestName,
                    idType=comp.idType,
                    idNumber=comp.idNumber,
                    idDocumentUrl=comp.idDocumentUrl,
                )
                db.add(bg)

        await _set_booking_rooms_status(db, booking, "OCCUPIED")
        await db.commit()
        await db.refresh(booking)
        await _enqueue_booking_message(db, booking, "in-stay-upsell", getattr(user, "id", None))

    elif body.status == "CHECKED_OUT":
        await _set_booking_rooms_status(db, booking, "CLEANING", housekeeping=True)
        guest = await db.get(Guest, booking.guestId)
        if guest:
            guest.totalStays = (guest.totalStays or 0) + 1
        await db.commit()
        await db.refresh(booking)
        await _enqueue_booking_message(db, booking, "review-ask", getattr(user, "id", None))

    elif body.status == "CANCELLED":
        await _set_booking_rooms_status(db, booking, "AVAILABLE")
        await db.commit()
        await db.refresh(booking)
    else:
        await db.commit()
        await db.refresh(booking)

    return row_to_dict(booking, rels={"guest", "room"})


@router.put("/{id}")
async def update_booking(id: str, body: UpdateBookingRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking).options(selectinload(Booking.room)).where(Booking.id == id)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")
    if booking.status != "CONFIRMED":
        raise HTTPException(400, "Only confirmed bookings can be edited")

    ci = datetime.fromisoformat(body.checkIn) if body.checkIn else booking.checkIn
    co = datetime.fromisoformat(body.checkOut) if body.checkOut else booking.checkOut
    target_room = body.roomId or booking.roomId

    if body.roomId or body.checkIn or body.checkOut:
        from app.services.inventory import allocate_room
        await allocate_room(db, target_room, ci, co, exclude_booking_id=id)

    if body.checkIn:
        booking.checkIn = ci
    if body.checkOut:
        booking.checkOut = co
    if body.roomId:
        room = await db.get(Room, body.roomId)
        if not room:
            raise HTTPException(404, "Room not found")
        booking.roomId = body.roomId
    if body.adults is not None:
        booking.adults = body.adults
    if body.children is not None:
        booking.children = body.children
    if body.specialRequests is not None:
        booking.specialRequests = body.specialRequests

    if body.checkIn or body.checkOut or body.roomId:
        room = await db.get(Room, booking.roomId)
        if room:
            booking.totalAmount = await _calculate_price(db, room.roomTypeId, booking.checkIn, booking.checkOut)

    await db.commit()
    await db.refresh(booking)
    return row_to_dict(booking, rels={"guest", "room"})
