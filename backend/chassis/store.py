"""All persistence and CRUD for Chassis.

This module is the single seam between the app and where data lives. Real teams
are written to a JSON file on disk; demo boards live only in a process-local
dict and vanish when the server restarts. Everything else in the codebase goes
through the functions here, which is what makes the Supabase migration note in
CLAUDE.md true: swap the read/write helpers in this file and nothing else needs
to change.

Note on concurrency: the JSON file is written atomically (temp file plus
rename) so a crash mid-write cannot corrupt it. The demo dict is plain and not
thread-safe, which is fine for a low-traffic prototype but documented as a
known limitation.
"""

import json
import os
import threading
import uuid
from datetime import datetime, timezone

# Absolute path to backend/data/db.json regardless of where the process starts.
# We resolve from this file's location so 'python app.py' and gunicorn both
# find the same file.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_DATA_DIR = os.path.normpath(os.path.join(_THIS_DIR, "..", "data"))
_DB_PATH = os.path.join(_DATA_DIR, "db.json")

# One lock guards every read-modify-write of the JSON file. Without it two
# requests editing different teams could race and one would clobber the other,
# because each rewrites the whole file.
_DB_LOCK = threading.Lock()

# Demo boards by token. Module-level so it persists across requests within one
# running process but never touches disk.
_DEMO_BOARDS = {}

# Default tags every new board starts with. Colors map to CSS custom properties
# of the same intent in the frontend, but the backend stores concrete hex so
# the PDF export and share view do not need the stylesheet.
DEFAULT_TAGS = [
    {"name": "Drivetrain", "color": "#e8650a"},
    {"name": "Software", "color": "#4f9dde"},
    {"name": "Mechanism Design", "color": "#9b59b6"},
    {"name": "Electrical", "color": "#e0c020"},
    {"name": "Chassis", "color": "#5fb878"},
    {"name": "Strategy", "color": "#d4566f"},
]

VALID_STATUSES = ("Open", "In Progress", "Solved")


# ---------------------------------------------------------------------------
# Small shared helpers
# ---------------------------------------------------------------------------

def _now():
    """Current UTC time as an ISO 8601 string. One format everywhere."""
    return datetime.now(timezone.utc).isoformat()


def _new_id():
    """Short unique id for entries, tags, and comments."""
    return uuid.uuid4().hex[:12]


def _new_token():
    """Full UUID hex used for session and share and demo tokens."""
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# JSON file access for real teams
# ---------------------------------------------------------------------------

def _read_db():
    """Load the whole database dict from disk, or an empty shell if absent.

    The shape is {"teams": [ ... ]}. We tolerate a missing file (fresh deploy)
    by returning the empty shell so the first signup can create it.
    """
    if not os.path.exists(_DB_PATH):
        return {"teams": []}
    with open(_DB_PATH, "r", encoding="utf-8") as handle:
        try:
            return json.load(handle)
        except json.JSONDecodeError:
            # A truncated or hand-edited file should not take the server down.
            # We treat an unreadable db as empty rather than crashing on boot.
            return {"teams": []}


def _write_db(db):
    """Write the database atomically.

    We write to a temp file in the same directory then os.replace onto the real
    path. os.replace is atomic on the same filesystem, so readers always see
    either the old complete file or the new complete file, never a half write.
    """
    os.makedirs(_DATA_DIR, exist_ok=True)
    tmp_path = _DB_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as handle:
        json.dump(db, handle, indent=2)
    os.replace(tmp_path, _DB_PATH)


# ---------------------------------------------------------------------------
# Board construction and lookup
# ---------------------------------------------------------------------------

def _build_default_calendar():
    """A blank calendar: no competition date and no work days chosen yet."""
    return {"competition_date": None, "work_days": {}}


def _make_tag(name, color):
    return {"id": _new_id(), "name": name, "color": color}


def create_team(display_name, team_number, password, competition):
    """Create and persist a new team, returning the full team record.

    The session_token is generated here so signup can hand it straight back to
    the client. The share_token starts empty and is minted lazily the first
    time someone generates a public link.
    """
    team = {
        "id": _new_id(),
        "display_name": display_name,
        "team_number": team_number,
        "competition": competition,
        # Plaintext on purpose for this prototype. The README and CLAUDE.md
        # both warn about this loudly. Do not ship real secrets here.
        "password": password,
        "session_token": _new_token(),
        "share_token": None,
        "entries": [],
        "tags": [_make_tag(t["name"], t["color"]) for t in DEFAULT_TAGS],
        "calendar": _build_default_calendar(),
        "created_at": _now(),
    }
    with _DB_LOCK:
        db = _read_db()
        db["teams"].append(team)
        _write_db(db)
    return team


def find_team_by_credentials(team_number, password):
    """Return the team matching number and password, or None.

    Sign in is by team number rather than display name because numbers are
    unique within a program and teams remember them.
    """
    db = _read_db()
    target = str(team_number).strip()
    for team in db["teams"]:
        if str(team["team_number"]).strip() == target and team["password"] == password:
            return team
    return None


def find_team_by_token(session_token):
    """Return the team whose session_token matches, or None. Used for auth."""
    if not session_token:
        return None
    db = _read_db()
    for team in db["teams"]:
        if team.get("session_token") == session_token:
            return team
    return None


def find_team_by_share_token(share_token):
    """Return the team for a public share token, or None."""
    if not share_token:
        return None
    db = _read_db()
    for team in db["teams"]:
        if team.get("share_token") == share_token:
            return team
    return None


def _persist_team(updated_team):
    """Write a single modified team back into the database.

    Callers mutate a team dict in memory then hand it here. We find it by id and
    replace it, all under the lock, so concurrent edits to different teams stay
    consistent.
    """
    with _DB_LOCK:
        db = _read_db()
        for index, team in enumerate(db["teams"]):
            if team["id"] == updated_team["id"]:
                db["teams"][index] = updated_team
                break
        _write_db(db)


# ---------------------------------------------------------------------------
# Demo boards (in memory only)
# ---------------------------------------------------------------------------

def create_demo_board():
    """Create a fresh seeded demo board and return its token.

    Demo boards mirror the team shape closely enough that the same entry and
    tag helpers work on both. They are stored only in _DEMO_BOARDS, so they are
    gone on restart and never written to disk.
    """
    from .seed import build_demo_board  # local import avoids a cycle at import

    token = _new_token()
    board = build_demo_board(_make_tag, _new_id, _now)
    board["demo_token"] = token
    _DEMO_BOARDS[token] = board
    return token


def get_demo_board(token):
    """Return the demo board for a token, or None if it has expired."""
    return _DEMO_BOARDS.get(token)


# ---------------------------------------------------------------------------
# Generic board operations that work on either a team or a demo board
# ---------------------------------------------------------------------------
# Both record shapes carry 'entries', 'tags', and 'calendar', so the operations
# below take a board dict and a 'save' callback. For real teams the callback
# persists to disk; for demo boards it is a no-op because the dict is already
# the live object.

def _tag_map(board):
    """Index a board's tags by id for quick lookup."""
    return {tag["id"]: tag for tag in board.get("tags", [])}


def _find_entry(board, entry_id):
    for entry in board.get("entries", []):
        if entry["id"] == entry_id:
            return entry
    return None


def public_board_view(board):
    """Shape a board for the API: team info, entries, and tags together.

    We never leak the password or session_token. The share_token is included
    only so the owner's app can show an existing link; it is harmless to the
    owner and absent on demo boards.
    """
    return {
        "display_name": board.get("display_name"),
        "team_number": board.get("team_number"),
        "competition": board.get("competition"),
        "share_token": board.get("share_token"),
        "entries": board.get("entries", []),
        "tags": board.get("tags", []),
        "calendar": board.get("calendar", _build_default_calendar()),
    }


def list_entries(board):
    """Return entries sorted for the feed: pinned first, then newest first."""
    entries = list(board.get("entries", []))
    # Sort is stable, so we sort by date first then by pinned to get the
    # combined ordering with a single final sort key.
    entries.sort(key=lambda e: e.get("created_at", ""), reverse=True)
    entries.sort(key=lambda e: not e.get("pinned", False))
    return entries


def add_entry(board, save, title, description, tag_ids, status, author):
    """Create an entry on a board and return it."""
    if status not in VALID_STATUSES:
        status = "Open"
    entry = {
        "id": _new_id(),
        "title": title,
        "description": description,
        "tag_ids": list(tag_ids or []),
        "status": status,
        "author": author,
        "pinned": False,
        "comments": [],
        "related_ids": [],
        "created_at": _now(),
        "updated_at": _now(),
    }
    board.setdefault("entries", []).append(entry)
    save()
    return entry


def update_entry(board, save, entry_id, fields):
    """Apply a partial update to an entry and return it, or None if missing.

    Only known, editable fields are copied across so a client cannot rewrite
    ids, timestamps, or comment history through this path.
    """
    entry = _find_entry(board, entry_id)
    if not entry:
        return None
    editable = ("title", "description", "tag_ids", "status", "author")
    for key in editable:
        if key in fields:
            if key == "status" and fields[key] not in VALID_STATUSES:
                continue
            entry[key] = fields[key]
    entry["updated_at"] = _now()
    save()
    return entry


def delete_entry(board, save, entry_id):
    """Remove an entry and scrub it from other entries' related lists."""
    entries = board.get("entries", [])
    remaining = [e for e in entries if e["id"] != entry_id]
    if len(remaining) == len(entries):
        return False
    # Clean up dangling relations so we never point at a deleted entry.
    for entry in remaining:
        entry["related_ids"] = [r for r in entry.get("related_ids", []) if r != entry_id]
    board["entries"] = remaining
    save()
    return True


def toggle_pin(board, save, entry_id):
    """Flip an entry's pinned flag and return the new state, or None."""
    entry = _find_entry(board, entry_id)
    if not entry:
        return None
    entry["pinned"] = not entry.get("pinned", False)
    entry["updated_at"] = _now()
    save()
    return entry


def mark_solved(board, save, entry_id):
    """Set an entry's status to Solved and return it, or None."""
    entry = _find_entry(board, entry_id)
    if not entry:
        return None
    entry["status"] = "Solved"
    entry["updated_at"] = _now()
    save()
    return entry


def add_comment(board, save, entry_id, author, body):
    """Append a comment to an entry and return the comment dict, or None."""
    entry = _find_entry(board, entry_id)
    if not entry:
        return None
    comment = {
        "id": _new_id(),
        "author": author,
        "body": body,
        "created_at": _now(),
    }
    entry.setdefault("comments", []).append(comment)
    entry["updated_at"] = _now()
    save()
    return comment


def relate_entries(board, save, entry_id, other_id):
    """Link two entries to each other. Relations are symmetric.

    Returns the updated source entry, or None if either id is unknown or they
    are the same entry.
    """
    if entry_id == other_id:
        return None
    entry = _find_entry(board, entry_id)
    other = _find_entry(board, other_id)
    if not entry or not other:
        return None
    for source, target_id in ((entry, other_id), (other, entry_id)):
        related = source.setdefault("related_ids", [])
        if target_id not in related:
            related.append(target_id)
    entry["updated_at"] = _now()
    save()
    return entry


def entry_detail(board, entry_id):
    """Return an entry plus its resolved related entries for the detail view.

    Related entries are returned as light summaries (id, title, status) so the
    detail page can render links without a second round trip per relation.
    """
    entry = _find_entry(board, entry_id)
    if not entry:
        return None
    related = []
    for rid in entry.get("related_ids", []):
        other = _find_entry(board, rid)
        if other:
            related.append({
                "id": other["id"],
                "title": other["title"],
                "status": other["status"],
            })
    detail = dict(entry)
    detail["related"] = related
    return detail


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

def list_tags(board):
    return list(board.get("tags", []))


def add_tag(board, save, name, color):
    """Create a custom tag and return it. Names are deduplicated case-folded."""
    existing = {tag["name"].strip().lower() for tag in board.get("tags", [])}
    if name.strip().lower() in existing:
        # Already have this tag. Return the existing one rather than erroring,
        # which keeps the frontend logic simple.
        for tag in board["tags"]:
            if tag["name"].strip().lower() == name.strip().lower():
                return tag
    tag = _make_tag(name.strip(), color)
    board.setdefault("tags", []).append(tag)
    save()
    return tag


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

def get_calendar(board):
    return board.get("calendar", _build_default_calendar())


def update_calendar(board, save, competition_date, work_days):
    """Replace calendar settings. Either field may be omitted to leave it.

    work_days is the full dict of selected days; the frontend sends the whole
    set each save so we can store it directly. A day's detail carries duration,
    meeting time, timezone, and optional location.
    """
    calendar = board.setdefault("calendar", _build_default_calendar())
    if competition_date is not None:
        # An empty string clears the date; a real ISO date sets it.
        calendar["competition_date"] = competition_date or None
    if work_days is not None:
        calendar["work_days"] = work_days
    save()
    return calendar


# ---------------------------------------------------------------------------
# Share tokens
# ---------------------------------------------------------------------------

def ensure_share_token(team):
    """Return the team's share token, minting one on first use.

    Idempotent: calling it twice returns the same token, so the 'generate'
    button can be pressed repeatedly without spawning new links.
    """
    if not team.get("share_token"):
        team["share_token"] = _new_token()
        _persist_team(team)
    return team["share_token"]


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

def _parse_iso(value):
    """Parse an ISO timestamp, tolerating a trailing Z, or return None."""
    if not value:
        return None
    try:
        text = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def board_stats(board):
    """Headline counts for the stats view.

    'recent' counts entries created in the last 120 days, which is roughly a
    build season. The status counts feed the progress readout.
    """
    entries = board.get("entries", [])
    now = datetime.now(timezone.utc)
    recent = 0
    by_status = {"Open": 0, "In Progress": 0, "Solved": 0}
    for entry in entries:
        created = _parse_iso(entry.get("created_at"))
        if created and (now - created).days <= 120:
            recent += 1
        status = entry.get("status", "Open")
        by_status[status] = by_status.get(status, 0) + 1

    return {
        "total": len(entries),
        "recent_120": recent,
        "by_status": by_status,
        "competition_date": board.get("calendar", {}).get("competition_date"),
    }


def category_breakdown(board, status_filter="All", all_time=True):
    """Entries grouped by tag, optionally narrowed by status and season.

    status_filter is one of All, Completed (Solved), or In Progress. all_time
    False limits to entries from the last 120 days. Each bucket reports a count
    and a percentage of the filtered total so the bars can be drawn directly.
    """
    tag_map = _tag_map(board)
    entries = board.get("entries", [])
    now = datetime.now(timezone.utc)

    def keep(entry):
        if not all_time:
            created = _parse_iso(entry.get("created_at"))
            if not created or (now - created).days > 120:
                return False
        if status_filter == "Completed":
            return entry.get("status") == "Solved"
        if status_filter == "In Progress":
            return entry.get("status") == "In Progress"
        return True

    filtered = [e for e in entries if keep(e)]
    total = len(filtered)

    counts = {}
    for entry in filtered:
        for tag_id in entry.get("tag_ids", []):
            tag = tag_map.get(tag_id)
            if not tag:
                continue
            bucket = counts.setdefault(tag["name"], {"count": 0, "color": tag["color"]})
            bucket["count"] += 1

    categories = []
    for name, data in counts.items():
        percent = round((data["count"] / total) * 100) if total else 0
        categories.append({
            "name": name,
            "count": data["count"],
            "color": data["color"],
            "percent": percent,
        })
    # Biggest categories first so the chart reads top to bottom.
    categories.sort(key=lambda c: c["count"], reverse=True)

    return {"total": total, "categories": categories}
