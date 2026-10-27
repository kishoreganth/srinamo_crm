"""Folio money.

`amount` is the unit price. `quantity` is how many units. The line total is
`amount * quantity`. Summary, invoice, and the screens all use that product.

GST: one rate on the TOTAL bill. Food is in that total and has no separate
rate. A GST invoice applies GST_TOTAL_PERCENT (CGST and SGST each half)
to the folio subtotal. TAX and CANCELLED lines are skipped. A simple
invoice applies 0%.
"""

from decimal import Decimal, ROUND_HALF_UP

from app.config import get_settings


def gst_half() -> Decimal:
    return Decimal(str(get_settings().GST_TOTAL_PERCENT or 0)) / Decimal("2")


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def line_total(amount, quantity) -> Decimal:
    qty = int(quantity or 1)
    if qty < 1:
        qty = 1
    return money(money(amount) * qty)


def folio_total(items) -> Decimal:
    return money(sum((line_total(i.amount, i.quantity) for i in items if (i.category or "").upper() != "TAX"), Decimal("0")))


def gst_for_items(items, is_gst: bool):
    subtotal = Decimal("0")
    for item in items:
        category = (item.category or "").upper()
        if category in ("TAX", "CANCELLED"):
            continue
        subtotal += line_total(item.amount, item.quantity)
    subtotal = money(subtotal)
    if not is_gst:
        return subtotal, money(0), money(0)
    tax = money(subtotal * gst_half() / Decimal("100"))
    return subtotal, tax, tax


def payment_status(payment) -> str:
    status = payment.status
    return status.value if hasattr(status, "value") else str(status)


def net_paid(payments) -> Decimal:
    total = Decimal("0")
    for payment in payments:
        status = payment_status(payment)
        amount = Decimal(str(payment.amount or 0))
        if status == "COMPLETED":
            total += amount
        elif status == "REFUNDED":
            total -= amount
    return money(total)
