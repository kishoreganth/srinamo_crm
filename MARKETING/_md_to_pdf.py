"""Render MARKETING/*.md to A4 PDFs (Calibri, page numbers, wrapping tables)."""
from __future__ import annotations

import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    Preformatted,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "pdf"
FONTS = Path(r"C:\Windows\Fonts")


def register_fonts() -> tuple[str, str]:
    candidates = [
        ("Calibri", FONTS / "calibri.ttf", FONTS / "calibrib.ttf"),
        ("SegoeUI", FONTS / "segoeui.ttf", FONTS / "segoeuib.ttf"),
        ("Arial", FONTS / "arial.ttf", FONTS / "arialbd.ttf"),
    ]
    for name, regular, bold in candidates:
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont(name, str(regular)))
            pdfmetrics.registerFont(TTFont(f"{name}-Bold", str(bold)))
            return name, f"{name}-Bold"
    return "Helvetica", "Helvetica-Bold"


FONT, FONT_BOLD = register_fonts()
GREEN = colors.HexColor("#1B4D3E")
RULE = colors.HexColor("#C5C8C4")
ROW_ALT = colors.HexColor("#F4F6F4")
HEADER_BG = colors.HexColor("#E8EDE9")


def styles():
    base = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "H1", parent=base["Heading1"], fontName=FONT_BOLD, fontSize=18,
            leading=22, textColor=GREEN, spaceAfter=8, spaceBefore=0,
        ),
        "h2": ParagraphStyle(
            "H2", parent=base["Heading2"], fontName=FONT_BOLD, fontSize=13,
            leading=17, textColor=GREEN, spaceBefore=12, spaceAfter=6,
        ),
        "h3": ParagraphStyle(
            "H3", parent=base["Heading3"], fontName=FONT_BOLD, fontSize=11,
            leading=14, textColor=colors.HexColor("#2A3A32"), spaceBefore=9, spaceAfter=4,
        ),
        "h4": ParagraphStyle(
            "H4", parent=base["Heading4"], fontName=FONT_BOLD, fontSize=10.5,
            leading=13, spaceBefore=7, spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "Body", parent=base["BodyText"], fontName=FONT, fontSize=10,
            leading=14, alignment=TA_JUSTIFY, spaceAfter=6,
        ),
        "meta": ParagraphStyle(
            "Meta", parent=base["BodyText"], fontName=FONT, fontSize=9,
            leading=12, textColor=colors.HexColor("#4A5550"), spaceAfter=3,
        ),
        "quote": ParagraphStyle(
            "Quote", parent=base["BodyText"], fontName=FONT, fontSize=10,
            leading=14, leftIndent=10, textColor=colors.HexColor("#2A3A32"),
            spaceBefore=4, spaceAfter=8, borderPadding=4,
        ),
        "th": ParagraphStyle(
            "Th", fontName=FONT_BOLD, fontSize=8, leading=11, textColor=GREEN,
        ),
        "td": ParagraphStyle(
            "Td", fontName=FONT, fontSize=8, leading=11,
        ),
        "code": ParagraphStyle(
            "Code", fontName="Courier", fontSize=8, leading=11, spaceAfter=8,
        ),
        "footer": ParagraphStyle(
            "Footer", fontName=FONT, fontSize=8, alignment=TA_CENTER,
            textColor=colors.HexColor("#6A736E"),
        ),
    }


INLINE = [
    (re.compile(r"`([^`]+)`"), r"<font face='Courier' size='8'>\1</font>"),
    (re.compile(r"\*\*(.+?)\*\*"), r"<b>\1</b>"),
    (re.compile(r"(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)"), r"<i>\1</i>"),
]


def inline(text: str) -> str:
    text = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    for pat, repl in INLINE:
        text = pat.sub(repl, text)
    return text.replace("\\", "")


def strip_front_matter(src: str) -> str:
    if src.startswith("---"):
        end = src.find("\n---", 3)
        if end != -1:
            return src[end + 4 :].lstrip("\n")
    return src


def parse_table(lines: list[str], i: int, s: dict):
    rows = []
    while i < len(lines) and lines[i].startswith("|"):
        raw = [c.strip() for c in lines[i].strip().strip("|").split("|")]
        if not re.match(r"^[\s:\-]+$", "".join(raw)):
            rows.append(raw)
        i += 1
    if not rows:
        return [], i
    width = max(len(r) for r in rows)
    for r in rows:
        while len(r) < width:
            r.append("")
    usable = 178 * mm
    col_w = [usable / width] * width
    styled = []
    for ri, row in enumerate(rows):
        style = s["th"] if ri == 0 else s["td"]
        styled.append([Paragraph(inline(c), style) for c in row])
    table = Table(styled, colWidths=col_w, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_BG),
        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("GRID", (0, 0), (-1, -1), 0.3, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW_ALT]),
    ]))
    return [Spacer(1, 4), table, Spacer(1, 8)], i


def md_to_flowables(src: str, s: dict):
    src = strip_front_matter(src)
    lines = src.replace("\r\n", "\n").split("\n")
    flow = []
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped == "<!-- pagebreak -->":
            flow.append(PageBreak())
            i += 1
            continue
        if not stripped:
            i += 1
            continue
        if stripped == "---":
            flow.append(HRFlowable(width="100%", thickness=0.6, color=RULE, spaceAfter=8, spaceBefore=4))
            i += 1
            continue
        if stripped.startswith("```"):
            buf = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                buf.append(lines[i])
                i += 1
            i += 1
            flow.append(Preformatted("\n".join(buf), s["code"]))
            continue
        if stripped.startswith("|"):
            bits, i = parse_table(lines, i, s)
            flow.extend(bits)
            continue
        if stripped.startswith(">"):
            quote = [stripped[1:].strip()]
            i += 1
            while i < len(lines) and lines[i].strip().startswith(">"):
                quote.append(lines[i].strip()[1:].strip())
                i += 1
            flow.append(Paragraph(inline(" ".join(quote)), s["quote"]))
            continue
        if re.match(r"^#{1,4} ", stripped):
            hashes = len(stripped) - len(stripped.lstrip("#"))
            text = stripped[hashes + 1 :].strip()
            key = {1: "h1", 2: "h2", 3: "h3", 4: "h4"}[hashes]
            flow.append(Paragraph(inline(text), s[key]))
            i += 1
            continue
        if re.match(r"^[-*] \[[ xX]\] ", stripped) or stripped.startswith("- ") or stripped.startswith("* "):
            items = []
            while i < len(lines) and (re.match(r"^[-*] ", lines[i].strip()) or re.match(r"^[-*] \[[ xX]\] ", lines[i].strip())):
                t = re.sub(r"^[-*] \[[ xX]\] ", "", lines[i].strip())
                t = re.sub(r"^[-*] ", "", t)
                items.append(ListItem(Paragraph(inline(t), s["body"]), leftIndent=12))
                i += 1
            flow.append(ListFlowable(items, bulletType="bullet", start="•", leftIndent=16, spaceAfter=6))
            continue
        if re.match(r"^\d+\. ", stripped):
            items = []
            n = 1
            while i < len(lines) and re.match(r"^\d+\. ", lines[i].strip()):
                t = re.sub(r"^\d+\. ", "", lines[i].strip())
                items.append(ListItem(Paragraph(inline(t), s["body"]), leftIndent=12))
                i += 1
                n += 1
            flow.append(ListFlowable(items, bulletType="1", leftIndent=18, spaceAfter=6))
            continue

        para = [stripped]
        i += 1
        while i < len(lines):
            nxt = lines[i].strip()
            if not nxt or nxt.startswith("#") or nxt.startswith("|") or nxt.startswith(">") \
                    or nxt.startswith("- ") or nxt.startswith("* ") or nxt.startswith("```") \
                    or nxt == "---" or re.match(r"^\d+\. ", nxt) or nxt == "<!-- pagebreak -->":
                break
            para.append(nxt)
            i += 1
        style = s["meta"] if para[0].startswith("**Owner:**") or para[0].startswith("**Property:**") \
            or para[0].startswith("**Phone:**") or para[0].startswith("**Plan date:**") \
            or para[0].startswith("**Horizon:**") or para[0].startswith("**Print:**") else s["body"]
        flow.append(Paragraph(inline(" ".join(para)), style))
    return flow


def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(GREEN)
    canvas.setLineWidth(1.2)
    canvas.line(16 * mm, A4[1] - 12 * mm, A4[0] - 16 * mm, A4[1] - 12 * mm)
    canvas.setFont(FONT, 8)
    canvas.setFillColor(GREEN)
    canvas.drawString(16 * mm, A4[1] - 10 * mm, "Srinamo Farms  ·  Marketing pack")
    canvas.drawRightString(A4[0] - 16 * mm, A4[1] - 10 * mm, "Confidential  ·  31 Aug 2026")
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.4)
    canvas.line(16 * mm, 12 * mm, A4[0] - 16 * mm, 12 * mm)
    canvas.setFillColor(colors.HexColor("#6A736E"))
    canvas.drawCentredString(A4[0] / 2, 7 * mm, f"{doc.page}")
    canvas.restoreState()


def render(md_path: Path, pdf_path: Path, s: dict):
    doc = SimpleDocTemplate(
        str(pdf_path),
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=18 * mm,
        bottomMargin=16 * mm,
        title=md_path.stem,
        author="Srinamo Farms",
    )
    flow = md_to_flowables(md_path.read_text(encoding="utf-8"), s)
    doc.build(flow, onFirstPage=header_footer, onLaterPages=header_footer)


def main():
    OUT.mkdir(exist_ok=True)
    s = styles()
    files = [
        "00_MASTER_PLAN.md",
        "01_90_DAY_SPRINT.md",
        "02_PARTNER_PROGRAM.md",
        "03_PACKAGES_AND_POSITIONING.md",
        "04_START_CHECKLIST.md",
    ]
    for name in files:
        src = ROOT / name
        dest = OUT / (src.stem + ".pdf")
        render(src, dest, s)
        print(f"wrote {dest}")


if __name__ == "__main__":
    main()
