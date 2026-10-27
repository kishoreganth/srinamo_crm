"""One-page GST or simple invoice. Stored outside the public static mount."""

import os
from decimal import Decimal

from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from app.config import get_settings

INVOICE_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "invoices")


def write_invoice_pdf(invoice, booking) -> str:
    os.makedirs(INVOICE_DIR, exist_ok=True)
    path = os.path.join(INVOICE_DIR, f"{invoice.id}.pdf")
    settings = get_settings()
    guest = booking.guest
    guest_name = f"{guest.firstName} {guest.lastName}".strip() if guest else "Guest"
    pdf = canvas.Canvas(path, pagesize=A4)
    width, height = A4
    y = height - 48
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(48, y, settings.RESORT_NAME)
    y -= 22
    pdf.setFont("Helvetica", 11)
    title = "Tax invoice" if invoice.isGstInvoice else "Invoice"
    pdf.drawString(48, y, f"{title}  {invoice.invoiceNumber}")
    y -= 18
    pdf.drawString(48, y, f"Guest: {guest_name}")
    if invoice.guestGstin:
        y -= 16
        pdf.drawString(48, y, f"Guest GSTIN: {invoice.guestGstin}")
    y -= 28
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(48, y, "Description")
    pdf.drawRightString(width - 48, y, "Amount")
    y -= 8
    pdf.line(48, y, width - 48, y)
    y -= 16
    pdf.setFont("Helvetica", 10)
    for item in booking.folioItems or []:
        category = (item.category or "").upper()
        if category in ("TAX", "CANCELLED"):
            continue
        qty = int(item.quantity or 1)
        line = Decimal(str(item.amount or 0)) * (qty if qty > 0 else 1)
        label = item.description
        if qty > 1:
            label = f"{label}  x{qty}"
        pdf.drawString(48, y, label[:80])
        pdf.drawRightString(width - 48, y, f"{line:.2f}")
        y -= 16
        if y < 120:
            pdf.showPage()
            y = height - 48
    y -= 8
    pdf.line(48, y, width - 48, y)
    y -= 18
    pdf.drawString(48, y, "Subtotal")
    pdf.drawRightString(width - 48, y, f"{Decimal(str(invoice.subtotal)):.2f}")
    y -= 16
    pdf.drawString(48, y, "CGST")
    pdf.drawRightString(width - 48, y, f"{Decimal(str(invoice.cgst)):.2f}")
    y -= 16
    pdf.drawString(48, y, "SGST")
    pdf.drawRightString(width - 48, y, f"{Decimal(str(invoice.sgst)):.2f}")
    y -= 18
    pdf.setFont("Helvetica-Bold", 12)
    pdf.drawString(48, y, "Total")
    pdf.drawRightString(width - 48, y, f"{Decimal(str(invoice.totalAmount)):.2f}")
    pdf.save()
    return path
