"""Competition framing helpers.

These functions decide how a board is labeled based on the competition.
FIRST programs (FLL, FTC, FRC) and VEX both judge an Engineering Notebook,
so for those programs we use that exact phrase. Anything else is framed as a
more general Knowledge Log. Keeping this logic in one place means the API, the
PDF export, and the public share view all agree on wording.
"""

# Programs that judge a formal Engineering Notebook. Kept as a set so the
# membership check below reads clearly and stays cheap.
NOTEBOOK_COMPETITIONS = {"FLL", "FTC", "FRC", "VEX"}

# Small words that should stay lowercase inside a title unless they lead it.
# This is intentionally short. Title casing is a presentation nicety, not a
# linguistics engine, so we cover the common cases and move on.
_SMALL_WORDS = {
    "a", "an", "and", "as", "at", "but", "by", "for", "if", "in",
    "nor", "of", "on", "or", "per", "the", "to", "vs", "via", "with",
}


def is_notebook(competition):
    """Return True when this competition is judged on an Engineering Notebook."""
    if not competition:
        return False
    return competition.strip().upper() in NOTEBOOK_COMPETITIONS


def doc_type(competition):
    """Return the human label for what this board represents.

    We split on is_notebook rather than checking the set twice so the rule
    lives in exactly one spot.
    """
    return "Engineering Notebook" if is_notebook(competition) else "Knowledge Log"


def board_title(competition):
    """Build a page title like 'FRC Robotics Engineering Notebook'.

    For a known program we prefix the competition code. For 'Other' or a blank
    competition we drop the prefix so we do not print an empty word.
    """
    label = doc_type(competition)
    code = (competition or "").strip()
    if is_notebook(competition):
        # Known program: 'FRC Robotics Engineering Notebook'.
        return "{} Robotics {}".format(code.upper(), label)
    # Unknown or 'Other': a clean 'Robotics Knowledge Log' with no stray code.
    return "Robotics {}".format(label)


def full_team_name(display_name, team_number):
    """Render a team as 'Cool Coders Team 32883'.

    Robotics teams almost always refer to themselves by name and number
    together, so we standardize that here. A missing number just yields the
    display name so we never print a dangling 'Team'.
    """
    name = (display_name or "").strip()
    number = str(team_number).strip() if team_number is not None else ""
    if not number:
        return name
    return "{} Team {}".format(name, number)


def smart_title(text):
    """Title-case a string while respecting small words and acronyms.

    Rules, in order of priority for each word:
    1. A token that is already all uppercase and longer than one character is
       treated as an acronym (PID, CAD, HSV) and left exactly as is.
    2. Small connecting words stay lowercase unless they are the first or last
       word of the title.
    3. Everything else gets its first letter capitalized.
    """
    if not text:
        return ""

    tokens = text.split()
    last_index = len(tokens) - 1
    result = []

    for index, token in enumerate(tokens):
        # Preserve acronyms exactly. We check the raw token so 'PID' survives
        # but 'pid' (lowercase) still gets normal title casing below.
        if len(token) > 1 and token.isupper():
            result.append(token)
            continue

        lowered = token.lower()
        is_edge = index == 0 or index == last_index
        if lowered in _SMALL_WORDS and not is_edge:
            result.append(lowered)
        else:
            result.append(lowered[:1].upper() + lowered[1:])

    return " ".join(result)
