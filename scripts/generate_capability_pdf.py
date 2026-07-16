#!/usr/bin/env python3
"""Generate the LeCrown Development capability statement PDF."""

from __future__ import annotations

import json
import shutil
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Flowable,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "src" / "content" / "capability-statement.json"
OUTPUT = ROOT / "output" / "pdf" / "lecrown-development-capability-statement.pdf"
PUBLIC = ROOT / "public" / "downloads" / "lecrown-development-capability-statement.pdf"
LOGO_DIR = ROOT / "public" / "client-partner-logos" / "pdf"

NAVY = colors.HexColor("#0F1726")
DEEP_BLUE = colors.HexColor("#073C57")
TEAL = colors.HexColor("#0B8790")
LIME = colors.HexColor("#B8D328")
CREAM = colors.HexColor("#F7F4EC")
PALE_TEAL = colors.HexColor("#E8F5F3")
MUTED = colors.HexColor("#596273")
LINE = colors.HexColor("#D8D9D4")
WHITE = colors.white


class BrandMark(Flowable):
    def __init__(self, width=1.35 * inch, height=0.42 * inch):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        canvas = self.canv
        canvas.saveState()
        canvas.setFillColor(DEEP_BLUE)
        canvas.setStrokeColor(DEEP_BLUE)
        canvas.setLineWidth(1)
        canvas.path = None
        canvas.setFillColor(colors.HexColor("#0C3556"))
        canvas.triangle = None
        canvas.drawPath(_triangle_path(canvas, 0, 2, 20, 29, 34, 2), fill=1, stroke=0)
        canvas.setFillColor(TEAL)
        canvas.drawPath(_triangle_path(canvas, 17, 2, 36, 22, 48, 2), fill=1, stroke=0)
        canvas.setFillColor(LIME)
        canvas.drawPath(_triangle_path(canvas, 29, 2, 50, 28, 47, 2), fill=1, stroke=0)
        canvas.setFillColor(NAVY)
        canvas.setFont("Times-Bold", 15)
        canvas.drawString(58, 15, "LeCrown")
        canvas.setFillColor(TEAL)
        canvas.setFont("Helvetica-Bold", 5.5)
        canvas.drawString(59, 5, "D E V E L O P M E N T")
        canvas.restoreState()


def _triangle_path(canvas, x1, y1, x2, y2, x3, y3):
    path = canvas.beginPath()
    path.moveTo(x1, y1)
    path.lineTo(x2, y2)
    path.lineTo(x3, y3)
    path.close()
    return path


class HeroPlanes(Flowable):
    def __init__(self, width=2.15 * inch, height=1.78 * inch):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        c.saveState()
        c.setLineWidth(1.2)
        planes = [
            (4, 4, 42, 64, TEAL, colors.HexColor("#D8F0ED")),
            (35, 4, 47, 102, DEEP_BLUE, colors.HexColor("#E7EFF2")),
            (76, 4, 54, 126, TEAL, colors.HexColor("#DDF2F1")),
            (116, 4, 38, 80, LIME, colors.HexColor("#F0F5CF")),
        ]
        for x, y, w, h, stroke, fill in planes:
            c.setStrokeColor(stroke)
            c.setFillColor(fill)
            c.roundRect(x, y, w, h, 10, fill=1, stroke=1)
            c.setFillColor(colors.Color(1, 1, 1, alpha=0.36))
            c.roundRect(x + 5, y + 6, w * 0.28, h - 12, 5, fill=1, stroke=0)
        c.restoreState()


def paragraph(text, style):
    return Paragraph(text.replace("&", "&amp;"), style)


def build_styles():
    styles = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle(
            "h1", parent=styles["Title"], fontName="Times-Bold", fontSize=29,
            leading=30, textColor=NAVY, alignment=TA_LEFT, spaceAfter=10,
        ),
        "h2": ParagraphStyle(
            "h2", parent=styles["Heading2"], fontName="Times-Bold", fontSize=18,
            leading=19, textColor=NAVY, spaceAfter=8,
        ),
        "h3": ParagraphStyle(
            "h3", parent=styles["Heading3"], fontName="Times-Bold", fontSize=10.5,
            leading=12, textColor=NAVY, spaceAfter=3,
        ),
        "body": ParagraphStyle(
            "body", parent=styles["BodyText"], fontName="Helvetica", fontSize=8.2,
            leading=12.2, textColor=MUTED,
        ),
        "small": ParagraphStyle(
            "small", parent=styles["BodyText"], fontName="Helvetica", fontSize=6.8,
            leading=9.4, textColor=MUTED,
        ),
        "label": ParagraphStyle(
            "label", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=6.4,
            leading=8, textColor=MUTED, tracking=1.5,
        ),
        "metric": ParagraphStyle(
            "metric", parent=styles["BodyText"], fontName="Times-Bold", fontSize=20,
            leading=21, textColor=TEAL, alignment=TA_CENTER,
        ),
        "logo_status": ParagraphStyle(
            "logo_status", parent=styles["BodyText"], fontName="Helvetica-Bold", fontSize=5.2,
            leading=6, textColor=DEEP_BLUE, tracking=1, alignment=TA_CENTER,
        ),
    }


def section_heading(title, styles):
    return KeepTogether([
        paragraph(title, styles["h2"]),
        Table([[""]], colWidths=[0.38 * inch], rowHeights=[2], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), LIME),
        ])),
        Spacer(1, 0.12 * inch),
    ])


def client_partner_mark(item, styles):
    logo_path = LOGO_DIR / f"{Path(item['logo']).stem}.png"
    logo = Image(str(logo_path))
    max_width = 0.96 * inch
    max_height = 0.28 * inch if item.get("logoClass") else 0.22 * inch
    scale = min(max_width / logo.imageWidth, max_height / logo.imageHeight)
    logo.drawWidth = logo.imageWidth * scale
    logo.drawHeight = logo.imageHeight * scale
    mark = [logo]
    if item.get("status"):
        mark += [Spacer(1, 0.025 * inch), paragraph(item["status"].upper(), styles["logo_status"])]
    return mark


def make_doc(path):
    doc = BaseDocTemplate(
        str(path), pagesize=letter, leftMargin=0.5 * inch, rightMargin=0.5 * inch,
        topMargin=0.48 * inch, bottomMargin=0.46 * inch,
        title="LeCrown Development Capability Statement",
        author="LeCrown Development",
        subject="Enterprise AI, data platforms, cloud engineering, architecture, governance, and custom digital systems",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates(PageTemplate(id="capability", frames=frame, onPage=draw_page))
    return doc


def draw_page(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(CREAM)
    canvas.rect(0, 0, letter[0], letter[1], fill=1, stroke=0)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica", 6.5)
    canvas.drawString(0.5 * inch, 0.25 * inch, "LECROWN DEVELOPMENT  |  CAPABILITY STATEMENT")
    canvas.setFillColor(MUTED)
    canvas.drawRightString(letter[0] - 0.5 * inch, 0.25 * inch, f"{doc.page}")
    canvas.restoreState()


def build_story(data, styles):
    story = []
    brand_row = Table([[BrandMark(), paragraph("HOUSTON, TEXAS  |  FOUNDER-LED ENTERPRISE DELIVERY", styles["label"])]],
                      colWidths=[2.1 * inch, 4.9 * inch], rowHeights=[0.42 * inch])
    brand_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (1, 0), (1, 0), "RIGHT")]))
    story += [brand_row, Spacer(1, 0.2 * inch)]

    hero_copy = [paragraph(data["headline"], styles["h1"]), paragraph(data["summary"], styles["body"])]
    hero = Table([[hero_copy, HeroPlanes()]], colWidths=[4.65 * inch, 2.35 * inch], rowHeights=[2.14 * inch])
    hero.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0), ("RIGHTPADDING", (0, 0), (0, 0), 20),
        ("LEFTPADDING", (1, 0), (1, 0), 0), ("RIGHTPADDING", (1, 0), (1, 0), 0),
    ]))
    story += [hero, Spacer(1, 0.18 * inch)]

    snapshot_cells = []
    for item in data["snapshot"]:
        snapshot_cells.append([paragraph(item["value"], styles["h3"]), paragraph(item["label"], styles["small"])])
    snapshot = Table([snapshot_cells], colWidths=[1.75 * inch] * 4)
    snapshot.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10), ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story += [snapshot, Spacer(1, 0.23 * inch), section_heading("Core capabilities", styles)]

    capability_rows = []
    for item in data["capabilities"]:
        capability_rows.append([
            paragraph(item["number"], styles["label"]),
            [paragraph(item["title"], styles["h3"]), paragraph(item["text"], styles["small"])],
        ])
    cap_table = Table(capability_rows, colWidths=[0.55 * inch, 6.45 * inch])
    cap_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINE),
        ("TEXTCOLOR", (0, 0), (0, -1), TEAL), ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ]))
    story += [cap_table, Spacer(1, 0.22 * inch)]

    outcome_cells = []
    for item in data["outcomes"]:
        outcome_cells.append([paragraph(item["value"], styles["metric"]), paragraph(item["text"], styles["small"])])
    outcomes = Table([outcome_cells], colWidths=[1.75 * inch] * 4)
    outcomes.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE_TEAL), ("BOX", (0, 0), (-1, -1), 0.6, colors.HexColor("#BFDCD8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#BFDCD8")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [outcomes, PageBreak()]

    story += [BrandMark(), Spacer(1, 0.18 * inch), section_heading("Industries and operating contexts", styles)]
    industry_cells = [paragraph(item, styles["h3"]) for item in data["industries"]]
    industries = Table([industry_cells[:4], industry_cells[4:] + [""]], colWidths=[1.75 * inch] * 4)
    industries.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, LINE), ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BACKGROUND", (0, 0), (-1, -1), colors.white), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story += [industries, Spacer(1, 0.25 * inch), section_heading("What sets LeCrown apart", styles)]

    diff_cells = []
    for item in data["differentiators"]:
        diff_cells.append([paragraph(item["title"], styles["h3"]), paragraph(item["text"], styles["small"])])
    diffs = Table([diff_cells[:2], diff_cells[2:]], colWidths=[3.5 * inch, 3.5 * inch])
    diffs.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, LINE), ("BACKGROUND", (0, 0), (-1, -1), colors.white),
        ("LEFTPADDING", (0, 0), (-1, -1), 11), ("RIGHTPADDING", (0, 0), (-1, -1), 11),
        ("TOPPADDING", (0, 0), (-1, -1), 9), ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
    ]))
    story += [diffs, Spacer(1, 0.24 * inch)]

    creds = "<br/>".join(f"- {item}" for item in data["credentials"])
    tech = "  |  ".join(data["technologies"])
    knowledge = Table([
        [paragraph("Credentials", styles["h2"]), paragraph("Technology depth", styles["h2"])],
        [paragraph(creds, styles["small"]), paragraph(tech, styles["body"])],
    ], colWidths=[3.5 * inch, 3.5 * inch])
    knowledge.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (0, -1), 16), ("LEFTPADDING", (1, 0), (1, -1), 16),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, LINE),
    ]))
    story += [knowledge, Spacer(1, 0.25 * inch)]

    contact = Table([
        [paragraph("Let's build what's next - together.", ParagraphStyle("contact", parent=styles["h2"], textColor=WHITE, fontSize=20)),
         paragraph("benjamin.lagrone@lecrowndevelopment.com<br/>(910) 236-9853<br/>Houston, Texas", ParagraphStyle("contactbody", parent=styles["body"], textColor=WHITE, fontSize=7.2, alignment=TA_LEFT))]
    ], colWidths=[4.3 * inch, 2.7 * inch])
    contact.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), DEEP_BLUE), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 14), ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 12), ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
    ]))
    story += [contact, Spacer(1, 0.24 * inch), paragraph("CLIENT PARTNERS", styles["label"]), Spacer(1, 0.08 * inch)]

    marks = [client_partner_mark(item, styles) for item in data["experience"]]
    marks += [""] * (12 - len(marks))
    logo_table = Table([marks[:6], marks[6:]], colWidths=[7 * inch / 6] * 6, rowHeights=[0.42 * inch, 0.42 * inch])
    logo_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story += [logo_table, Spacer(1, 0.07 * inch), paragraph(
        "Company marks identify client and partner organizations represented in Benjamin LaGrone's resume and project history. "
        "'Former' denotes prior Accenture and Avanade experience; no current endorsement is implied.",
        ParagraphStyle("legal", parent=styles["small"], fontSize=5.8, alignment=TA_CENTER),
    )]
    return story


def main():
    # Compatibility entrypoint: the government-facing one-page statement is
    # now the canonical downloadable document.
    from generate_government_capability_statement import build_pdf

    build_pdf()
    print(OUTPUT)
    print(PUBLIC)


if __name__ == "__main__":
    main()
