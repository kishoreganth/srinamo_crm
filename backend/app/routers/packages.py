from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import DayPackage
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/packages", tags=["Day packages"])


class PackageBody(BaseModel):
    name: str
    pricePerPerson: float
    startsAt: str
    endsAt: str
    includes: str
    sortOrder: int = 0
    isActive: bool = True


@router.get("")
async def list_packages(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    stmt = select(DayPackage).order_by(DayPackage.sortOrder.asc(), DayPackage.pricePerPerson.asc())
    if getattr(user, "role", None) != "ADMIN":
        stmt = stmt.where(DayPackage.isActive == True)
    result = await db.execute(stmt)
    return [row_to_dict(p, rels=set()) for p in result.scalars().all()]


@router.patch("/{package_id}", dependencies=[Depends(require_admin)])
async def update_package(package_id: str, body: PackageBody, db: AsyncSession = Depends(get_db)):
    package = await db.get(DayPackage, package_id)
    if not package:
        raise HTTPException(404, "Package not found")
    package.name = body.name.strip()
    package.pricePerPerson = Decimal(str(body.pricePerPerson))
    package.startsAt = body.startsAt.strip()
    package.endsAt = body.endsAt.strip()
    package.includes = body.includes.strip()
    package.sortOrder = body.sortOrder
    package.isActive = body.isActive
    await db.commit()
    await db.refresh(package)
    return row_to_dict(package, rels=set())
