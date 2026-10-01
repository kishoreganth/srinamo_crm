from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import Guest, MessageOutbox, OutboxStatus
from app.serialize import row_to_dict
from app.services.phone import e164, normalize_phone

TWELVE_HOURS = timedelta(hours=12)
MAX_ATTEMPTS = 3


def _status_val(val) -> str:
    return val.value if hasattr(val, "value") else str(val)


async def enqueue_message(
    db: AsyncSession,
    *,
    template_key: str,
    to_phone: str,
    payload: dict[str, Any],
    related_type: str,
    related_id: str,
    user_id: str | None = None,
    force: bool = False,
    consent: bool | None = True,
    dnd: bool = False,
) -> MessageOutbox:
    phone = normalize_phone(to_phone)
    if not phone:
        raise HTTPException(400, "Guest has no phone number")
    if dnd or consent is False:
        raise HTTPException(400, "Guest has not consented to WhatsApp")

    idem = f"{template_key}:{related_id}"
    existing_q = await db.execute(
        select(MessageOutbox).where(MessageOutbox.idempotencyKey == idem)
    )
    existing = existing_q.scalar_one_or_none()
    if existing and not force:
        age = datetime.now(timezone.utc) - (existing.createdAt.replace(tzinfo=timezone.utc) if existing.createdAt.tzinfo is None else existing.createdAt)
        if age < TWELVE_HOURS:
            return existing
        idem = f"{template_key}:{related_id}:{int(datetime.now(timezone.utc).timestamp())}"

    settings = get_settings()
    status = OutboxStatus.PENDING if settings.WHATSAPP_ENABLED else OutboxStatus.SKIPPED
    row = MessageOutbox(
        templateKey=template_key,
        toPhone=e164(phone),
        payload=payload,
        status=status,
        relatedType=related_type,
        relatedId=related_id,
        idempotencyKey=idem,
        createdByUserId=user_id,
    )
    db.add(row)
    await db.flush()
    return row


async def process_outbox_item(db: AsyncSession, message_id: str) -> MessageOutbox | None:
    row = await db.get(MessageOutbox, message_id)
    if not row:
        return None
    if _status_val(row.status) not in ("PENDING", "FAILED"):
        return row

    settings = get_settings()
    if not settings.WHATSAPP_ENABLED:
        row.status = OutboxStatus.SKIPPED
        await db.commit()
        await db.refresh(row)
        return row

    row.attempts = (row.attempts or 0) + 1
    url = f"{settings.N8N_WEBHOOK_BASE.rstrip('/')}/{row.templateKey}"
    body = {
        "event": row.templateKey,
        "idempotencyKey": row.idempotencyKey,
        "messageId": row.id,
        "phone": row.toPhone,
        "templateKey": row.templateKey,
        **(row.payload or {}),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    headers = {}
    if settings.N8N_WEBHOOK_SECRET:
        headers["X-Webhook-Secret"] = settings.N8N_WEBHOOK_SECRET
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(url, json=body, headers=headers)
        if resp.is_success:
            row.status = OutboxStatus.SENT
            row.error = None
            data = {}
            try:
                data = resp.json()
            except Exception:
                pass
            row.providerMessageId = data.get("providerMessageId") or data.get("id")
        else:
            row.error = f"HTTP {resp.status_code}: {resp.text[:400]}"
            row.status = OutboxStatus.FAILED if row.attempts >= MAX_ATTEMPTS else OutboxStatus.PENDING
    except Exception as exc:
        row.error = str(exc)[:500]
        row.status = OutboxStatus.FAILED if row.attempts >= MAX_ATTEMPTS else OutboxStatus.PENDING
    await db.commit()
    await db.refresh(row)
    return row


async def dispatch_after_commit(db: AsyncSession, message: MessageOutbox) -> MessageOutbox:
    if _status_val(message.status) != "PENDING":
        return message
    return await process_outbox_item(db, message.id) or message


def guest_can_message(guest: Guest | None, phone: str | None) -> tuple[str, bool, bool]:
    raw = phone or (guest.phone if guest else "")
    consent = True if guest is None else bool(guest.whatsappConsent)
    dnd = False if guest is None else bool(guest.dnd)
    return raw, consent, dnd


def serialize_outbox(row: MessageOutbox) -> dict:
    return row_to_dict(row)
