from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Commission, Partner


async def accrue_commission(
    db: AsyncSession,
    *,
    partner_id: str | None,
    base_amount,
    booking_id: str | None = None,
    event_id: str | None = None,
) -> Commission | None:
    if not partner_id:
        return None
    partner = await db.get(Partner, partner_id)
    if not partner or not partner.isActive:
        return None
    if booking_id:
        existing = await db.execute(
            select(Commission).where(Commission.partnerId == partner_id, Commission.bookingId == booking_id)
        )
        if existing.scalar_one_or_none():
            return None
    if event_id:
        existing = await db.execute(
            select(Commission).where(Commission.partnerId == partner_id, Commission.eventId == event_id)
        )
        if existing.scalar_one_or_none():
            return None
    base = Decimal(str(base_amount or 0))
    rate = Decimal(str(partner.commissionRate or 0))
    amount = (base * rate / Decimal("100")).quantize(Decimal("0.01"))
    row = Commission(
        partnerId=partner_id,
        bookingId=booking_id,
        eventId=event_id,
        baseAmount=base,
        rate=rate,
        amount=amount,
        status="DUE",
    )
    db.add(row)
    await db.flush()
    return row
