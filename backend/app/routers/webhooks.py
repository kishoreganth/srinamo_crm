from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.config import get_settings
from app.database import get_db
from app.models import MessageOutbox
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

router = APIRouter(prefix="/api/webhooks", tags=["Webhooks"])


class WhatsAppCallback(BaseModel):
    messageId: str
    status: str
    providerMessageId: Optional[str] = None
    error: Optional[str] = None


@router.post("/whatsapp")
async def whatsapp_callback(
    body: WhatsAppCallback,
    x_webhook_secret: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    settings = get_settings()
    if settings.N8N_WEBHOOK_SECRET and x_webhook_secret != settings.N8N_WEBHOOK_SECRET:
        raise HTTPException(401, "Invalid webhook secret")
    row = await db.get(MessageOutbox, body.messageId)
    if not row:
        raise HTTPException(404, "Message not found")
    status = body.status.upper()
    if status in ("SENT", "FAILED", "SKIPPED"):
        row.status = status
    if body.providerMessageId:
        row.providerMessageId = body.providerMessageId
    if body.error:
        row.error = body.error
    await db.commit()
    return {"ok": True}
