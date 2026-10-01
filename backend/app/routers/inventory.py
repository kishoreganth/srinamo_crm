from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import InventoryBlock
from app.serialize import row_to_dict

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


class BlockBody(BaseModel):
    roomId: Optional[str] = None
    start: str
    end: str
    source: str = "MANUAL"
    notes: Optional[str] = None
    holdMinutes: Optional[int] = None
    leadId: Optional[str] = None


@router.get("/blocks")
async def list_blocks(
    from_date: Optional[str] = Query(None, alias="from"),
    to_date: Optional[str] = Query(None, alias="to"),
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(InventoryBlock).options(selectinload(InventoryBlock.room)).order_by(InventoryBlock.start.asc())
    if from_date and to_date:
        f = datetime.fromisoformat(from_date)
        t = datetime.fromisoformat(to_date)
        stmt = stmt.where(InventoryBlock.start < t, InventoryBlock.end > f)
    now = datetime.now(timezone.utc)
    stmt = stmt.where(or_(InventoryBlock.expiresAt.is_(None), InventoryBlock.expiresAt > now))
    rows = (await db.execute(stmt)).scalars().all()
    return [row_to_dict(b, rels={"room"}) for b in rows]


@router.post("/blocks")
async def create_block(body: BlockBody, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    start = datetime.fromisoformat(body.start)
    end = datetime.fromisoformat(body.end)
    expires = None
    source = body.source
    if body.holdMinutes:
        source = "HOLD"
        expires = datetime.now(timezone.utc) + timedelta(minutes=body.holdMinutes)
    block = InventoryBlock(
        roomId=body.roomId,
        start=start,
        end=end,
        source=source,
        notes=body.notes,
        expiresAt=expires,
        leadId=body.leadId,
        createdByUserId=user.id,
    )
    db.add(block)
    await db.commit()
    await db.refresh(block)
    return row_to_dict(block)


@router.delete("/blocks/{id}")
async def release_block(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    block = await db.get(InventoryBlock, id)
    if not block:
        raise HTTPException(404, "Block not found")
    await db.delete(block)
    await db.commit()
    return {"ok": True}
