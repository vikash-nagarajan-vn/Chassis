"""PDF export styled as an Engineering Notebook, built with fpdf2.

The layout is cursor based: we track the vertical position and draw blocks one
after another, asking for a new page before anything that would overflow. This
is simple and predictable, but it means font or margin changes require
re-checking the height math, which is called out in CLAUDE.md.

No em dashes appear in any generated text. fpdf2's core fonts are Latin-1 only,
so we also sanitize strings to stay inside that range and never crash on a
stray character pasted into an entry.
"""

from datetime import datetime, timezone

from fpdf import FPDF

from . import text as text_helpers

# Page geometry in millimeters. A4 is the fpdf2 default.
PAGE_WIDTH = 210
MARGIN = 18
CONTENT_WIDTH = PAGE_WIDTH - (2 * MARGIN)

# The notebook accent. A muted industrial orange that prints cleanly.
ACCENT = (200, 86, 12)
INK = (30, 30, 30)
MUTED = (110, 110, 110)
RAIL = (210, 210, 210)


def _sanitize(value):
    """Make a string safe for fpdf2 core fonts and free of em dashes.

    We replace em and en dashes with a hyphen, smart quotes with straight ones,
    then drop anything still outside Latin-1 so encoding never fails mid export.
    """
    if value is None:
        return ""
    text = str(value)
    replacements = {
        "\u2014": "-",   # em dash
        "\u2013": "-",   # en dash
        "\u2018": "'",   # left single quote
        "\u2019": "'",   # right single quote
        "\u201c": '"',   # left double quote
        "\u201d": '"',   # right double quote
        "\u2026": "...",  # ellipsis
        "\u00a0": " ",   # non-breaking space
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    return text.encode("latin-1", "replace").decode("latin-1")


def _export_date():
    """Today's date as a plain readable string for the header."""
    return datetime.now(timezone.utc).strftime("%B %d, %Y")


class NotebookPDF(FPDF):
    """An FPDF subclass that draws the notebook header on every page."""

    def __init__(self, board):
        super().__init__(format="A4")
        self.board = board
        self.set_auto_page_break(auto=True, margin=MARGIN)
        self.set_margins(MARGIN, MARGIN, MARGIN)

    def header(self):
        competition = self.board.get("competition", "")
        title = text_helpers.board_title(competition)
        team = text_helpers.full_team_name(
            self.board.get("display_name", ""),
            self.board.get("team_number", ""),
        )

        # Title line.
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*INK)
        self.cell(0, 9, _sanitize(title), new_x="LMARGIN", new_y="NEXT")

        # Team and export date on one muted line.
        self.set_font("Helvetica", "", 10)
        self.set_text_color(*MUTED)
        meta = "{}   |   Exported {}".format(team, _export_date())
        self.cell(0, 6, _sanitize(meta), new_x="LMARGIN", new_y="NEXT")

        # Accent rule under the header.
        self.set_draw_color(*ACCENT)
        self.set_line_width(0.6)
        y = self.get_y() + 1
        self.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
        self.ln(6)


def _label_value(pdf, label, value):
    """Draw a 'Label: value' line with the label in the accent color."""
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(*ACCENT)
    label_text = _sanitize(label + ": ")
    pdf.cell(pdf.get_string_width(label_text) + 1, 5, label_text)
    pdf.set_font("Helvetica", "", 9)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 5, _sanitize(value), new_x="LMARGIN", new_y="NEXT")


def _entry_block(pdf, board, entry, tag_map, include_related):
    """Render one entry. Shared by full board and single entry exports."""
    # Keep a block from splitting awkwardly: if little room remains, break.
    if pdf.get_y() > 250:
        pdf.add_page()

    # Title with a colored rail to echo the on-screen card.
    start_y = pdf.get_y()
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(*INK)
    pdf.set_x(MARGIN + 3)
    pdf.multi_cell(CONTENT_WIDTH - 3, 7, _sanitize(entry.get("title", "")),
                   new_x="LMARGIN", new_y="NEXT")
    end_y = pdf.get_y()
    pdf.set_draw_color(*ACCENT)
    pdf.set_line_width(1.2)
    pdf.line(MARGIN, start_y + 1, MARGIN, end_y)
    pdf.ln(1)

    # Metadata lines.
    tag_names = ", ".join(
        tag_map[tid]["name"] for tid in entry.get("tag_ids", []) if tid in tag_map
    ) or "None"
    _label_value(pdf, "Tags", tag_names)
    _label_value(pdf, "Status", entry.get("status", "Open"))
    _label_value(pdf, "Author", entry.get("author", "Unknown"))
    _label_value(pdf, "Logged", _format_date(entry.get("created_at")))

    # Description.
    pdf.ln(1)
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(*INK)
    pdf.multi_cell(0, 5.5, _sanitize(entry.get("description", "")),
                   new_x="LMARGIN", new_y="NEXT")

    # Comments, if any.
    comments = entry.get("comments", [])
    if comments:
        pdf.ln(1)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 5, "Comments and Corrections", new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(*INK)
        for comment in comments:
            line = "{}: {}".format(
                comment.get("author", "Anon"), comment.get("body", "")
            )
            pdf.multi_cell(0, 5, _sanitize("- " + line),
                           new_x="LMARGIN", new_y="NEXT")

    # Related entries, only on the single entry export.
    if include_related:
        related = entry.get("related", [])
        if related:
            pdf.ln(1)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(*MUTED)
            pdf.cell(0, 5, "Related Entries", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(*INK)
            for rel in related:
                pdf.multi_cell(0, 5, _sanitize("- " + rel.get("title", "")),
                               new_x="LMARGIN", new_y="NEXT")

    # Divider between entries.
    pdf.ln(3)
    pdf.set_draw_color(*RAIL)
    pdf.set_line_width(0.2)
    y = pdf.get_y()
    pdf.line(MARGIN, y, PAGE_WIDTH - MARGIN, y)
    pdf.ln(5)


def _format_date(iso_value):
    """Turn an ISO timestamp into a short readable date, or a dash if absent."""
    if not iso_value:
        return "-"
    try:
        cleaned = iso_value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(cleaned)
        return parsed.strftime("%B %d, %Y")
    except (ValueError, AttributeError):
        return "-"


def _tag_map(board):
    return {tag["id"]: tag for tag in board.get("tags", [])}


def board_pdf(board):
    """Return the full board as PDF bytes, one block per entry."""
    pdf = NotebookPDF(board)
    pdf.add_page()
    tag_map = _tag_map(board)

    entries = board.get("entries", [])
    if not entries:
        pdf.set_font("Helvetica", "I", 11)
        pdf.set_text_color(*MUTED)
        pdf.cell(0, 8, "This notebook has no entries yet.",
                 new_x="LMARGIN", new_y="NEXT")
    else:
        # Pinned first, then newest, matching the on-screen feed order.
        ordered = sorted(entries, key=lambda e: e.get("created_at", ""), reverse=True)
        ordered.sort(key=lambda e: not e.get("pinned", False))
        for entry in ordered:
            _entry_block(pdf, board, entry, tag_map, include_related=False)

    return _as_bytes(pdf)


def entry_pdf(board, entry_with_related):
    """Return a single entry, including related entries, as PDF bytes."""
    pdf = NotebookPDF(board)
    pdf.add_page()
    tag_map = _tag_map(board)
    _entry_block(pdf, board, entry_with_related, tag_map, include_related=True)
    return _as_bytes(pdf)


def _as_bytes(pdf):
    """Coerce fpdf2 output to bytes across library versions.

    Newer fpdf2 returns a bytearray from output(); we normalize to bytes so the
    Flask layer can hand it straight to a Response.
    """
    raw = pdf.output()
    if isinstance(raw, (bytes, bytearray)):
        return bytes(raw)
    # Very old fpdf returned a str; encode as Latin-1 to preserve byte values.
    return raw.encode("latin-1")
