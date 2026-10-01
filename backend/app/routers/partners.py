from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models import Commission, Partner
from app.serialize import row_to_dict
from app.services.phone import normalize_phone

router = APIRouter(prefix="/api/partners", tags=["Partners"])


class PartnerBody(BaseModel):
    name: str
    type: str = "OTHER"
    phone: Optional[str] = None
    email: Optional[str] = None
    firm: Optional[str] = None
    location: Optional[str] = None
    tier: Optional[str] = None
    instagram: Optional[str] = None
    commissionRate: Optional[float] = 10
    notes: Optional[str] = None
    isActive: Optional[bool] = True


def _hide_rate(data: dict, user) -> dict:
    if getattr(user, "role", None) != "ADMIN" and getattr(user, "role", None) != "ADMIN":
        role = user.role.value if hasattr(user.role, "value") else user.role
        if role != "ADMIN":
            data.pop("commissionRate", None)
    return data


@router.get("")
async def list_partners(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Partner).order_by(Partner.name.asc()))).scalars().all()
    return [_hide_rate(row_to_dict(p), user) for p in rows]


@router.post("", dependencies=[Depends(require_admin)])
async def create_partner(body: PartnerBody, db: AsyncSession = Depends(get_db)):
    p = Partner(
        name=body.name,
        type=body.type,
        phone=normalize_phone(body.phone) if body.phone else None,
        email=body.email,
        firm=body.firm,
        location=body.location,
        tier=body.tier,
        instagram=body.instagram.strip().lstrip("@") if body.instagram else None,
        commissionRate=Decimal(str(body.commissionRate or 10)),
        notes=body.notes,
        isActive=True if body.isActive is None else body.isActive,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return row_to_dict(p)


@router.get("/commissions")
async def list_commissions(
    status: Optional[str] = None,
    user=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Commission).options(selectinload(Commission.partner)).order_by(Commission.createdAt.desc())
    if status:
        stmt = stmt.where(Commission.status == status)
    rows = (await db.execute(stmt)).scalars().all()
    due = sum(float(c.amount) for c in rows if (c.status.value if hasattr(c.status, "value") else c.status) == "DUE")
    return {"data": [row_to_dict(c, rels={"partner"}) for c in rows], "dueTotal": due}


@router.get("/{id}")
async def get_partner(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    p = await db.get(Partner, id)
    if not p:
        raise HTTPException(404, "Partner not found")
    return _hide_rate(row_to_dict(p), user)


@router.patch("/{id}", dependencies=[Depends(require_admin)])
async def update_partner(id: str, body: PartnerBody, db: AsyncSession = Depends(get_db)):
    p = await db.get(Partner, id)
    if not p:
        raise HTTPException(404, "Partner not found")
    p.name = body.name
    p.type = body.type
    p.phone = normalize_phone(body.phone) if body.phone else p.phone
    p.email = body.email
    p.firm = body.firm
    p.location = body.location
    p.tier = body.tier
    if body.instagram is not None:
        p.instagram = body.instagram.strip().lstrip("@") or None
    if body.commissionRate is not None:
        p.commissionRate = Decimal(str(body.commissionRate))
    p.notes = body.notes
    if body.isActive is not None:
        p.isActive = body.isActive
    await db.commit()
    await db.refresh(p)
    return row_to_dict(p)


@router.post("/commissions/{id}/pay", dependencies=[Depends(require_admin)])
async def pay_commission(id: str, db: AsyncSession = Depends(get_db)):
    c = await db.get(Commission, id)
    if not c:
        raise HTTPException(404, "Commission not found")
    c.status = "PAID"
    c.paidAt = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(c)
    return row_to_dict(c)
