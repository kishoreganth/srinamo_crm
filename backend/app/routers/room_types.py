from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import RoomType, Room
from app.dependencies import get_current_user, require_admin
from app.schemas.rooms import CreateRoomTypeRequest
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/room-types", tags=["Room Types"])


@router.post("", dependencies=[Depends(require_admin)])
async def create_room_type(body: CreateRoomTypeRequest, db: AsyncSession = Depends(get_db)):
    rt = RoomType(
        name=body.name,
        description=body.description,
        maxOccupancy=body.maxOccupancy,
        basePrice=body.basePrice,
        amenities=body.amenities or [],
        images=body.images or [],
    )
    db.add(rt)
    await db.commit()
    await db.refresh(rt)
    return row_to_dict(rt)


@router.get("")
async def get_room_types(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoomType).options(selectinload(RoomType.rooms)).order_by(RoomType.name.asc())
    )
    room_types = result.scalars().all()
    out = []
    for rt in room_types:
        d = row_to_dict(rt, rels=set())
        d["_count"] = {"rooms": len(rt.rooms) if rt.rooms else 0}
        out.append(d)
    return out


@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def update_room_type(id: str, body: CreateRoomTypeRequest, db: AsyncSession = Depends(get_db)):
    rt = await db.get(RoomType, id)
    if not rt:
        raise HTTPException(404, "Room type not found")
    if body.name is not None:
        rt.name = body.name
    if body.description is not None:
        rt.description = body.description
    if body.maxOccupancy is not None:
        rt.maxOccupancy = body.maxOccupancy
    if body.basePrice is not None:
        rt.basePrice = body.basePrice
    if body.amenities is not None:
        rt.amenities = body.amenities
    if body.images is not None:
        rt.images = body.images
    await db.commit()
    await db.refresh(rt)
    return row_to_dict(rt, rels=set())


@router.delete("/{id}", dependencies=[Depends(require_admin)])
async def delete_room_type(id: str, db: AsyncSession = Depends(get_db)):
    count_result = await db.execute(select(func.count()).select_from(Room).where(Room.roomTypeId == id))
    room_count = count_result.scalar()
    if room_count > 0:
        raise HTTPException(409, "Cannot delete room type with existing rooms")
    rt = await db.get(RoomType, id)
    if not rt:
        raise HTTPException(404, "Room type not found")
    await db.delete(rt)
    await db.commit()
    return row_to_dict(rt, rels=set())
