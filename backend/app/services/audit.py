"""Append-only audit rows. A failure here must not fail the request."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent


async def record_audit(
    db: AsyncSession,
    *,
    user_id: str | None,
    action: str,
    entity: str,
    entity_id: str | None,
    detail: str | None = None,
) -> None:
    try:
        async with db.begin_nested():
            db.add(AuditEvent(
                userId=user_id,
                action=action,
                entity=entity,
                entityId=entity_id,
                detail=detail,
            ))
    except Exception:
        return
