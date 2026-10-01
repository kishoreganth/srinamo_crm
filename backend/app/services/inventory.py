from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Booking, BookingRoom, InventoryBlock, Room


ACTIVE_BOOKING = ("CONFIRMED", "CHECKED_IN")


async def allocate_room(
    db: AsyncSession,
    room_id: str,
    check_in: datetime,
    check_out: datetime,
    *,
    exclude_booking_id: str | None = None,
) -> Room:
    if check_in >= check_out:
        raise HTTPException(400, "Check-out must be after check-in")

    result = await db.execute(
        select(Room)
        .options(selectinload(Room.roomType))
        .where(Room.id == room_id)
        .with_for_update()
    )
    room = result.scalar_one_or_none()
    if not room:
        raise HTTPException(404, "Room not found")

    conflict_q = select(Booking).where(
        Booking.roomId == room_id,
        Booking.status.in_(list(ACTIVE_BOOKING)),
        Booking.deletedAt.is_(None),
        Booking.checkIn < check_out,
        Booking.checkOut > check_in,
    )
    if exclude_booking_id:
        conflict_q = conflict_q.where(Booking.id != exclude_booking_id)
    existing = await db.execute(conflict_q.limit(1))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Room is not available for the selected dates")

    extra_q = select(BookingRoom).join(Booking, Booking.id == BookingRoom.bookingId).where(
        BookingRoom.roomId == room_id,
        Booking.status.in_(list(ACTIVE_BOOKING)),
        Booking.deletedAt.is_(None),
        Booking.checkIn < check_out,
        Booking.checkOut > check_in,
    )
    if exclude_booking_id:
        extra_q = extra_q.where(Booking.id != exclude_booking_id)
    extra = await db.execute(extra_q.limit(1))
    if extra.scalar_one_or_none():
        raise HTTPException(409, "Room is not available for the selected dates")

    now = datetime.now(timezone.utc)
    block_q = await db.execute(
        select(InventoryBlock).where(
            or_(InventoryBlock.roomId == room_id, InventoryBlock.roomId.is_(None)),
            InventoryBlock.start < check_out,
            InventoryBlock.end > check_in,
            or_(InventoryBlock.expiresAt.is_(None), InventoryBlock.expiresAt > now),
        ).limit(1)
    )
    if block_q.scalar_one_or_none():
        raise HTTPException(409, "Room is blocked for the selected dates")

    return room


async def blocked_room_ids(
    db: AsyncSession,
    check_in: datetime,
    check_out: datetime,
) -> set[str]:
    now = datetime.now(timezone.utc)
    booked_q = await db.execute(
        select(Booking.roomId).where(
            Booking.status.in_(list(ACTIVE_BOOKING)),
            Booking.deletedAt.is_(None),
            Booking.checkIn < check_out,
            Booking.checkOut > check_in,
        )
    )
    ids = {row[0] for row in booked_q.all()}

    extra_q = await db.execute(
        select(BookingRoom.roomId)
        .join(Booking, Booking.id == BookingRoom.bookingId)
        .where(
            Booking.status.in_(list(ACTIVE_BOOKING)),
            Booking.deletedAt.is_(None),
            Booking.checkIn < check_out,
            Booking.checkOut > check_in,
        )
    )
    ids.update(row[0] for row in extra_q.all())

    block_q = await db.execute(
        select(InventoryBlock).where(
            InventoryBlock.start < check_out,
            InventoryBlock.end > check_in,
            or_(InventoryBlock.expiresAt.is_(None), InventoryBlock.expiresAt > now),
        )
    )
    all_rooms = False
    for block in block_q.scalars().all():
        if block.roomId is None:
            all_rooms = True
            break
        ids.add(block.roomId)
    if all_rooms:
        rooms_q = await db.execute(select(Room.id))
        return {row[0] for row in rooms_q.all()}
    return ids
