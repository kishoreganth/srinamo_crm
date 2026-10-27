from decimal import Decimal
from types import SimpleNamespace

from app.config import get_settings
from app.services.folio import folio_total, gst_for_items, gst_half, line_total


def _half() -> Decimal:
    return Decimal(str(get_settings().GST_TOTAL_PERCENT or 0)) / Decimal("2")


def _item(amount, quantity, category="PACKAGE"):
    return SimpleNamespace(amount=amount, quantity=quantity, category=category)


def test_two_guest_package_is_not_double_counted():
    price = Decimal("2200")
    items = [_item(price, 2, "PACKAGE")]
    assert line_total(price, 2) == Decimal("4400.00")
    assert folio_total(items) == Decimal("4400.00")


def test_gst_is_one_rate_on_the_total_including_food():
    items = [_item(Decimal("2200"), 2, "PACKAGE"), _item(Decimal("50"), 1, "FOOD")]
    subtotal, cgst, sgst = gst_for_items(items, True)
    assert subtotal == Decimal("4450.00")
    expected = (Decimal("4450.00") * _half() / Decimal("100")).quantize(Decimal("0.01"))
    assert cgst == expected
    assert sgst == expected
    assert cgst == sgst


def test_food_has_no_separate_gst_rate():
    food = [_item(Decimal("100"), 1, "FOOD")]
    stay = [_item(Decimal("100"), 1, "PACKAGE")]
    _, food_cgst, _ = gst_for_items(food, True)
    _, stay_cgst, _ = gst_for_items(stay, True)
    expected = (Decimal("100.00") * gst_half() / Decimal("100")).quantize(Decimal("0.01"))
    assert food_cgst == stay_cgst == expected


def test_simple_invoice_has_no_tax():
    items = [_item(Decimal("2200"), 2, "PACKAGE")]
    subtotal, cgst, sgst = gst_for_items(items, False)
    assert subtotal == Decimal("4400.00")
    assert cgst == Decimal("0.00")
    assert sgst == Decimal("0.00")
