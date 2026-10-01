from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Room, Booking, RoomStatus as RoomStatusEnum
from app.dependencies import get_current_user, require_admin
from app.schemas.rooms import CreateRoomRequest, UpdateRoomStatusRequest
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.post("", dependencies=[Depends(require_admin)])
async def create_room(body: CreateRoomRequest, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Room).where(Room.roomNumber == body.roomNumber))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Room number already exists")
    room = Room(roomTypeId=body.roomTypeId, roomNumber=body.roomNumber, floor=body.floor)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return row_to_dict(room, rels={"roomType"})


@router.get("")
async def get_rooms(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Room).options(selectinload(Room.roomType)).order_by(Room.roomNumber.asc())
    )
    return [row_to_dict(r, rels={"roomType"}) for r in result.scalars().all()]


@router.get("/available")
async def get_available_rooms(
    checkIn: str = Query(...),
    checkOut: str = Query(...),
    roomTypeId: str = Query(None),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import datetime
    ci = datetime.fromisoformat(checkIn)
    co = datetime.fromisoformat(checkOut)

    from app.services.inventory import blocked_room_ids
    booked_ids = list(await blocked_room_ids(db, ci, co))

    stmt = select(Room).options(selectinload(Room.roomType)).where(
        Room.status.in_(["AVAILABLE", "INSPECTED"]),
    )
    if booked_ids:
        stmt = stmt.where(Room.id.not_in(booked_ids))
    if roomTypeId:
        stmt = stmt.where(Room.roomTypeId == roomTypeId)
    stmt = stmt.order_by(Room.roomNumber.asc())

    result = await db.execute(stmt)
    return [row_to_dict(r, rels={"roomType"}) for r in result.scalars().all()]


@router.get("/status-board")
async def get_status_board(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Room)
        .options(selectinload(Room.roomType), selectinload(Room.bookings).selectinload(Booking.guest))
        .order_by(Room.floor.asc(), Room.roomNumber.asc())
    )
    rooms = result.scalars().all()
    out = []
    for r in rooms:
        guest = None
        checked_in = [b for b in r.bookings if b.status == "CHECKED_IN"]
        if checked_in:
            g = checked_in[0].guest
            if g:
                guest = f"{g.firstName} {g.lastName}"
        out.append({
            "id": r.id,
            "roomNumber": r.roomNumber,
            "floor": r.floor,
            "status": r.status,
            "roomType": r.roomType.name if r.roomType else None,
            "currentGuest": guest,
        })
    return out


@router.get("/by-type/{roomTypeId}")
async def get_rooms_by_type(roomTypeId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Room).options(selectinload(Room.roomType)).where(Room.roomTypeId == roomTypeId).order_by(Room.roomNumber.asc())
    )
    return [row_to_dict(r, rels={"roomType"}) for r in result.scalars().all()]


@router.patch("/{id}/status")
async def update_room_status(id: str, body: UpdateRoomStatusRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, id)
    if not room:
        raise HTTPException(404, "Room not found")
    room.status = body.status
    await db.commit()
    await db.refresh(room)
    return row_to_dict(room)
