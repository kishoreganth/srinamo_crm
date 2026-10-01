from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from enum import Enum
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Booking, FolioItem, Payment, Invoice, Guest, Room, RoomType
from app.dependencies import get_current_user
from app.serialize import row_to_dict


class PaymentMethod(str, Enum):
    CASH = "CASH"
    UPI = "UPI"
    CARD = "CARD"
    RAZORPAY = "RAZORPAY"
    BANK_TRANSFER = "BANK_TRANSFER"


class CreateFolioItemRequest(BaseModel):
    description: str
    category: str
    amount: float
    quantity: int = 1


class CreatePaymentRequest(BaseModel):
    bookingId: str
    amount: float
    method: PaymentMethod
    paymentType: Optional[str] = None
    transactionId: Optional[str] = None
    notes: Optional[str] = None


class CreateInvoiceRequest(BaseModel):
    isGstInvoice: bool = False
    guestGstin: Optional[str] = None


router = APIRouter(prefix="/api/billing", tags=["Billing"])


@router.get("/folio/{bookingId}")
async def get_folio(bookingId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FolioItem).where(FolioItem.bookingId == bookingId).order_by(FolioItem.createdAt.asc())
    )
    items = result.scalars().all()
    grouped = {}
    total = Decimal("0")
    items_list = []
    for item in items:
        d = row_to_dict(item, rels=set())
        items_list.append(d)
        cat = item.category
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(d)
        total += Decimal(str(item.amount)) * item.quantity
    return {"items": items_list, "grouped": grouped, "total": float(total)}


@router.post("/folio/{bookingId}/item")
async def add_folio_item(bookingId: str, body: CreateFolioItemRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, bookingId)
    if not booking:
        raise HTTPException(404, "Booking not found")
    item = FolioItem(bookingId=bookingId, description=body.description, category=body.category, amount=body.amount, quantity=body.quantity)
    db.add(item)
    booking.totalAmount = Decimal(str(booking.totalAmount or 0)) + Decimal(str(body.amount)) * body.quantity
    await db.commit()
    await db.refresh(item)
    return row_to_dict(item, rels=set())


@router.get("/payments/{bookingId}")
async def get_payments(bookingId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    booking = await db.get(Booking, bookingId)
    if not booking:
        raise HTTPException(404, "Booking not found")
    result = await db.execute(
        select(Payment).where(Payment.bookingId == bookingId).order_by(Payment.createdAt.desc())
    )
    return [row_to_dict(p, rels=set()) for p in result.scalars().all()]


@router.post("/payments")
async def record_payment(body: CreatePaymentRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    from datetime import datetime
    booking = await db.get(Booking, body.bookingId)
    if not booking:
        raise HTTPException(404, "Booking not found")
    payment = Payment(
        bookingId=body.bookingId,
        amount=body.amount,
        method=body.method,
        status="COMPLETED",
        paymentType=body.paymentType or "PARTIAL",
        transactionId=body.transactionId,
        paidAt=datetime.now(),
        notes=body.notes,
    )
    db.add(payment)

    guest = await db.get(Guest, booking.guestId)
    if guest:
        guest.totalSpent = Decimal(str(guest.totalSpent or 0)) + Decimal(str(body.amount))

    await db.commit()
    await db.refresh(payment)
    return row_to_dict(payment, rels=set())


@router.get("/summary/{bookingId}")
async def get_payment_summary(bookingId: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    folio_q = await db.execute(select(FolioItem).where(FolioItem.bookingId == bookingId))
    folio_items = folio_q.scalars().all()
    pay_q = await db.execute(select(Payment).where(Payment.bookingId == bookingId, Payment.status == "COMPLETED"))
    payments = pay_q.scalars().all()

    total_charges = sum(Decimal(str(i.amount)) * i.quantity for i in folio_items)
    total_paid = sum(Decimal(str(p.amount)) for p in payments)
    balance = total_charges - total_paid
    return {
        "totalCharges": float(total_charges),
        "totalPaid": float(total_paid),
        "balance": float(balance),
        "payments": [row_to_dict(p, rels=set()) for p in payments],
    }


@router.post("/invoices/{bookingId}")
async def generate_invoice(bookingId: str, body: CreateInvoiceRequest, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Booking)
        .options(selectinload(Booking.guest), selectinload(Booking.room).selectinload(Room.roomType), selectinload(Booking.folioItems))
        .where(Booking.id == bookingId)
    )
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(404, "Booking not found")

    subtotal = sum(Decimal(str(i.amount)) * i.quantity for i in booking.folioItems)

    if body.isGstInvoice:
        room_rate = float(booking.room.roomType.basePrice) if booking.room and booking.room.roomType else 0
        rate = Decimal("6") if room_rate <= 7500 else Decimal("9")
    else:
        rate = Decimal("0")

    cgst = subtotal * rate / 100
    sgst = subtotal * rate / 100
    total_amount = subtotal + cgst + sgst

    from datetime import datetime
    now = datetime.now()
    fy = now.year if now.month >= 4 else now.year - 1
    prefix = f"SNF-INV-{fy}{(fy + 1) % 100:02d}"
    last_q = await db.execute(
        select(Invoice).where(Invoice.invoiceNumber.startswith(prefix)).order_by(Invoice.invoiceNumber.desc()).limit(1)
    )
    last = last_q.scalar_one_or_none()
    seq = 1
    if last:
        parts = last.invoiceNumber.split("-")
        seq = int(parts[-1]) + 1
    invoice_number = f"{prefix}-{seq:05d}"

    invoice = Invoice(
        bookingId=bookingId,
        invoiceNumber=invoice_number,
        subtotal=subtotal,
        cgst=cgst,
        sgst=sgst,
        igst=Decimal("0"),
        totalAmount=total_amount,
        guestGstin=body.guestGstin,
        isGstInvoice=body.isGstInvoice,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return row_to_dict(invoice, rels=set())


@router.get("/invoices/{id}")
async def get_invoice(id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).options(
            selectinload(Invoice.booking).selectinload(Booking.guest),
            selectinload(Invoice.booking).selectinload(Booking.room).selectinload(Room.roomType),
            selectinload(Invoice.booking).selectinload(Booking.folioItems),
        ).where(Invoice.id == id)
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return row_to_dict(invoice, rels={"booking"})
