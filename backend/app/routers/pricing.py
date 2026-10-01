from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import RatePlan
from app.dependencies import get_current_user, require_admin
from app.serialize import row_to_dict


class DayType(str, Enum):
    WEEKDAY = "WEEKDAY"
    WEEKEND = "WEEKEND"
    ALL = "ALL"


class CreateRatePlanRequest(BaseModel):
    roomTypeId: str
    name: str
    startDate: str
    endDate: str
    dayType: DayType = DayType.ALL
    price: float
    priority: int = 0
    isActive: bool = True


router = APIRouter(prefix="/api/pricing", tags=["Pricing"])


@router.post("/rate-plans", dependencies=[Depends(require_admin)])
async def create_rate_plan(body: CreateRatePlanRequest, db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    plan = RatePlan(
        roomTypeId=body.roomTypeId,
        name=body.name,
        startDate=datetime.fromisoformat(body.startDate),
        endDate=datetime.fromisoformat(body.endDate),
        dayType=body.dayType,
        price=body.price,
        priority=body.priority,
        isActive=body.isActive,
    )
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return row_to_dict(plan, rels={"roomType"})


@router.get("/rate-plans")
async def get_rate_plans(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RatePlan).options(selectinload(RatePlan.roomType))
        .order_by(RatePlan.roomTypeId.asc(), RatePlan.priority.desc())
    )
    return [row_to_dict(rp, rels={"roomType"}) for rp in result.scalars().all()]


@router.patch("/rate-plans/{id}", dependencies=[Depends(require_admin)])
async def update_rate_plan(id: str, body: CreateRatePlanRequest, db: AsyncSession = Depends(get_db)):
    plan = await db.get(RatePlan, id)
    if not plan:
        raise HTTPException(404, "Rate plan not found")
    from datetime import datetime
    if body.name is not None:
        plan.name = body.name
    if body.startDate is not None:
        plan.startDate = datetime.fromisoformat(body.startDate)
    if body.endDate is not None:
        plan.endDate = datetime.fromisoformat(body.endDate)
    if body.dayType is not None:
        plan.dayType = body.dayType
    if body.price is not None:
        plan.price = body.price
    if body.priority is not None:
        plan.priority = body.priority
    if body.isActive is not None:
        plan.isActive = body.isActive
    await db.commit()
    await db.refresh(plan)
    return row_to_dict(plan, rels={"roomType"})


@router.delete("/rate-plans/{id}", dependencies=[Depends(require_admin)])
async def delete_rate_plan(id: str, db: AsyncSession = Depends(get_db)):
    plan = await db.get(RatePlan, id)
    if not plan:
        raise HTTPException(404, "Rate plan not found")
    await db.delete(plan)
    await db.commit()
    return row_to_dict(plan, rels={"roomType"})
