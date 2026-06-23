"""PDF export, generated server-side in Python with fpdf2.

Produces an Engineering Notebook style document so teams can drop their logged
knowledge straight into the documentation they already have to keep.
"""

from io import BytesIO
from datetime import datetime
from fpdf import FPDF

from .text import board_title, full_team_name


def _hex(h):
    h = (h or "#6B7280").lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _fmt_date(iso):
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00")).strftime("%b %d, %Y")
    except Exception:
        return iso or ""


def build_pdf(board, entries, heading=None):
    tags = {t["id"]: t for t in board["tags"]}
    title = heading or board_title(board["competition"])
    team = full_team_name(board["display_name"], board["team_number"])

    pdf = FPDF(format="letter", unit="pt")
    pdf.set_auto_page_break(auto=True, margin=56)
    pdf.add_page()
    w = pdf.w
    margin = 56
    content_w = w - margin * 2

    # Header band
    pdf.set_fill_color(20, 22, 28)
    pdf.rect(0, 0, w, 76, "F")
    pdf.set_fill_color(255, 92, 43)
    pdf.rect(margin, 26, 6, 28, "F")
    pdf.set_xy(margin + 16, 24)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(300, 18, "CHASSIS")
    pdf.set_xy(margin + 16, 44)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(200, 200, 205)
    pdf.cell(400, 14, f"{team}  -  {title}")

    pdf.set_y(100)
    pdf.set_text_color(20, 22, 28)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(content_w - 140, 16, title)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(110, 110, 120)
    n = len(entries)
    pdf.cell(140, 16, f"{n} entr{'y' if n == 1 else 'ies'}  -  {_fmt_date(datetime.utcnow().isoformat())}",
             align="R")
    pdf.ln(22)
    pdf.set_draw_color(221, 225, 230)
    pdf.line(margin, pdf.get_y(), w - margin, pdf.get_y())
    pdf.ln(16)

    for i, e in enumerate(entries):
        etags = [tags[t] for t in e.get("tag_ids", []) if t in tags]
        rail = _hex(etags[0]["color"]) if etags else (203, 210, 217)

        y = pdf.get_y()
        pdf.set_fill_color(*rail)
        pdf.rect(margin, y, 4, 16, "F")

        pdf.set_xy(margin + 14, y)
        pdf.set_text_color(20, 22, 28)
        pdf.set_font("Helvetica", "B", 12)
        pdf.multi_cell(content_w - 14, 15, e["title"])

        status = "SOLVED" if e["status"] == "solved" else f"IN PROGRESS ({e.get('progress', 0)}%)"
        tagnames = ", ".join(t["name"].upper() for t in etags) or "UNTAGGED"
        meta = f"{status}   |   {tagnames}"
        if e.get("author"):
            meta += f"   |   @{e['author']}"
        meta += f"   |   {_fmt_date(e['created_at'])}"
        pdf.set_x(margin + 14)
        pdf.set_font("Courier", "", 8.5)
        pdf.set_text_color(110, 110, 120)
        pdf.multi_cell(content_w - 14, 12, meta)
        pdf.ln(2)

        if e.get("description"):
            pdf.set_x(margin + 14)
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(40, 42, 48)
            pdf.multi_cell(content_w - 14, 14, e["description"])

        for c in e.get("comments", []):
            pdf.set_x(margin + 22)
            pdf.set_font("Helvetica", "I", 9)
            pdf.set_text_color(110, 110, 120)
            pdf.multi_cell(content_w - 28, 13, f"- {c['text']}  ({c['author']})")

        pdf.ln(8)
        if i < len(entries) - 1:
            pdf.set_draw_color(232, 235, 238)
            pdf.line(margin, pdf.get_y(), w - margin, pdf.get_y())
            pdf.ln(12)

    out = pdf.output()
    return BytesIO(bytes(out))
