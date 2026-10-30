from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import require_admin
from app.models import ResortProfile

router = APIRouter(prefix="/api/settings", tags=["Settings"])

PROFILE_ID = "default"
DEFAULT_NAME = "SriNamo Farms Resort"


class ResortBody(BaseModel):
    name: str
    gstin: Optional[str] = ""
    address: Optional[str] = ""
    phone: Optional[str] = ""
    email: Optional[str] = ""


def _blank(value: Optional[str]) -> Optional[str]:
    text = (value or "").strip()
    return text or None


def _public(row: ResortProfile | None) -> dict:
    if row is None:
        return {"name": DEFAULT_NAME, "gstin": "", "address": "", "phone": "", "email": ""}
    return {
        "name": row.name,
        "gstin": row.gstin or "",
        "address": row.address or "",
        "phone": row.phone or "",
        "email": row.email or "",
    }


@router.get("/resort")
async def get_resort(user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return _public(await db.get(ResortProfile, PROFILE_ID))


@router.put("/resort")
async def save_resort(body: ResortBody, user=Depends(require_admin), db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Resort name is required")
    row = await db.get(ResortProfile, PROFILE_ID)
    if row is None:
        row = ResortProfile(id=PROFILE_ID, name=name)
        db.add(row)
    row.name = name
    row.gstin = _blank(body.gstin)
    row.address = _blank(body.address)
    row.phone = _blank(body.phone)
    row.email = _blank(body.email)
    await db.commit()
    await db.refresh(row)
    return _public(row)
