"""Text helpers: competition framing and proper title casing.

Centralizes how the competition name is woven through the app so every page,
the PDF, and the share view stay consistent.
"""

# Competitions that judge a formal documentation artifact. For these we frame
# the whole board as an "Engineering Notebook" rather than a "Knowledge Log".
NOTEBOOK_COMPETITIONS = {"FLL", "FTC", "FRC", "VEX"}

COMPETITION_CHOICES = [
    ("FLL", "FLL (FIRST LEGO League)"),
    ("FTC", "FTC (FIRST Tech Challenge)"),
    ("FRC", "FRC (FIRST Robotics Competition)"),
    ("VEX", "VEX Robotics"),
    ("Other", "Other / custom"),
]


def doc_type(competition: str) -> str:
    """'Engineering Notebook' for documentation competitions, else 'Knowledge Log'."""
    return "Engineering Notebook" if (competition or "").upper() in NOTEBOOK_COMPETITIONS else "Knowledge Log"


def is_notebook(competition: str) -> bool:
    return (competition or "").upper() in NOTEBOOK_COMPETITIONS


def board_title(competition: str) -> str:
    """e.g. 'FRC Robotics Engineering Notebook' or 'Sumo Bots Robotics Knowledge Log'."""
    comp = (competition or "Robotics").strip()
    return f"{comp} Robotics {doc_type(comp)}"


def full_team_name(display_name: str, team_number: str) -> str:
    """'Cool Coders' + '32883' -> 'Cool Coders Team 32883'."""
    display = (display_name or "").strip()
    number = (team_number or "").strip()
    if display and number:
        return f"{display} Team {number}"
    if number:
        return f"Team {number}"
    return display or "Untitled Team"


def smart_title(text: str) -> str:
    """Title-case a heading while keeping small words and known acronyms sensible."""
    small = {"a", "an", "and", "as", "at", "but", "by", "for", "in", "of", "on", "or", "the", "to", "vs"}
    acronyms = {"FLL", "FTC", "FRC", "VEX", "PDF", "PID", "CAD", "CAN"}
    words = (text or "").split()
    out = []
    for i, w in enumerate(words):
        if w.upper() in acronyms:
            out.append(w.upper())
        elif i != 0 and w.lower() in small:
            out.append(w.lower())
        else:
            out.append(w[:1].upper() + w[1:])
    return " ".join(out)
