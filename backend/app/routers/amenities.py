from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Amenity
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/amenities", tags=["Amenities"])


class AmenityBody(BaseModel):
    name: str
    description: Optional[str] = None
    price: float = 0
    chargeType: str = "FLAT"
    included: bool = False
    isActive: bool = True


@router.get("")
async def list_amenities(
    all: int = Query(0),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Amenity).order_by(Amenity.name.asc())
    if not all or getattr(user, "role", None) != "ADMIN":
        stmt = stmt.where(Amenity.isActive == True)
    result = await db.execute(stmt)
    return [row_to_dict(a, rels=set()) for a in result.scalars().all()]


@router.post("", dependencies=[Depends(require_admin)])
async def create_amenity(body: AmenityBody, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    existing = await db.execute(select(Amenity).where(Amenity.name == name))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "An amenity with this name already exists")
    amenity = Amenity(
        name=name,
        description=body.description,
        price=Decimal(str(body.price or 0)),
        chargeType="PER_PERSON" if body.chargeType == "PER_PERSON" else "FLAT",
        included=body.included,
        isActive=body.isActive,
    )
    db.add(amenity)
    await db.commit()
    await db.refresh(amenity)
    return row_to_dict(amenity, rels=set())


@router.patch("/{amenity_id}", dependencies=[Depends(require_admin)])
async def update_amenity(amenity_id: str, body: AmenityBody, db: AsyncSession = Depends(get_db)):
    amenity = await db.get(Amenity, amenity_id)
    if not amenity:
        raise HTTPException(404, "Amenity not found")
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name is required")
    amenity.name = name
    amenity.description = body.description
    amenity.price = Decimal(str(body.price or 0))
    amenity.chargeType = "PER_PERSON" if body.chargeType == "PER_PERSON" else "FLAT"
    amenity.included = body.included
    amenity.isActive = body.isActive
    await db.commit()
    await db.refresh(amenity)
    return row_to_dict(amenity, rels=set())


@router.delete("/{amenity_id}", dependencies=[Depends(require_admin)])
async def disable_amenity(amenity_id: str, db: AsyncSession = Depends(get_db)):
    amenity = await db.get(Amenity, amenity_id)
    if not amenity:
        raise HTTPException(404, "Amenity not found")
    amenity.isActive = False
    await db.commit()
    return row_to_dict(amenity, rels=set())
