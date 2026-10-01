import re


def normalize_phone(raw: str | None) -> str:
    if not raw:
        return ""
    text = raw.strip()
    explicit_country = text.startswith("+")
    digits = re.sub(r"\D", "", text)
    if not digits:
        return ""
    if explicit_country:
        return digits
    if len(digits) == 11 and digits.startswith("0"):
        return "91" + digits[1:]
    if len(digits) == 10:
        return "91" + digits
    return digits


def e164(raw: str | None) -> str:
    n = normalize_phone(raw)
    return f"+{n}" if n else ""
