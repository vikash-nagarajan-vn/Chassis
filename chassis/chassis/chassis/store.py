"""Data store for Chassis.

Two kinds of board live here:

* Real teams are persisted to a JSON file on disk. They have accounts and a
  stable share URL.
* Demo boards live only in memory, keyed by a per-tab token. A fresh tab gets a
  freshly seeded demo, and closing the tab abandons it (see app.py for how the
  token is minted per tab). This is what makes the demo reset every new tab.

Everything is plain dicts so it serializes to JSON with no ceremony. In a real
product this module is the seam you would point at a database instead.
"""

from __future__ import annotations

import json
import os
import time
import uuid
import threading
from datetime import datetime, timezone

from werkzeug.security import generate_password_hash, check_password_hash

_LOCK = threading.RLock()
_DB = {"teams": {}, "by_share": {}}
_DB_PATH = None

# token -> {"board": dict, "last_access": float}
_DEMO = {}
_DEMO_TTL = 6 * 3600  # forget abandoned demo boards after a while


def _uid(prefix="id"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def _now():
    return datetime.now(timezone.utc).isoformat()


def default_tags():
    # Deliberately high-contrast, mutually distinct colors.
    return [
        {"id": _uid("tag"), "name": "Mechanical", "color": "#4F9DFF"},
        {"id": _uid("tag"), "name": "Electrical", "color": "#FFC23D"},
        {"id": _uid("tag"), "name": "Programming", "color": "#43D17A"},
        {"id": _uid("tag"), "name": "Strategy", "color": "#C77DFF"},
    ]


def new_board(display_name, team_number, competition, password=None):
    return {
        "id": _uid("team"),
        "display_name": display_name,
        "team_number": team_number,
        "competition": competition,
        "password_hash": generate_password_hash(password) if password else None,
        "created_at": _now(),
        "share_token": uuid.uuid4().hex[:12],
        "tags": default_tags(),
        "entries": [],
        "calendar": {"competition_date": None, "work_days": {}},
    }


# --- persistence -------------------------------------------------------------

def init_db(path):
    global _DB_PATH, _DB
    _DB_PATH = path
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            _DB = json.load(fh)
    _DB.setdefault("teams", {})
    _DB.setdefault("by_share", {})


def _save():
    if not _DB_PATH:
        return
    tmp = _DB_PATH + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(_DB, fh, indent=2)
    os.replace(tmp, _DB_PATH)


# --- accounts ----------------------------------------------------------------

def team_exists(team_number):
    with _LOCK:
        return any(t["team_number"] == team_number for t in _DB["teams"].values())


def create_team(display_name, team_number, competition, password):
    with _LOCK:
        if team_exists(team_number):
            raise ValueError("A board for that team number already exists. Try signing in.")
        board = new_board(display_name, team_number, competition, password)
        _DB["teams"][board["id"]] = board
        _DB["by_share"][board["share_token"]] = board["id"]
        _save()
        return board


def authenticate(team_number, password):
    with _LOCK:
        for t in _DB["teams"].values():
            if t["team_number"] == team_number:
                if t["password_hash"] and check_password_hash(t["password_hash"], password):
                    return t
                raise ValueError("Team number or password is incorrect.")
        raise ValueError("No board found for that team number.")


def get_team(team_id):
    return _DB["teams"].get(team_id)


def get_team_by_share(token):
    tid = _DB["by_share"].get(token)
    return _DB["teams"].get(tid) if tid else None


# --- demo --------------------------------------------------------------------

def get_demo(token):
    """Return the demo board for a tab token, seeding a fresh one if needed."""
    from .seed import seed_demo_board
    with _LOCK:
        _gc_demos()
        rec = _DEMO.get(token)
        if rec is None:
            board = seed_demo_board(new_board, default_tags, _uid, _now)
            rec = {"board": board, "last_access": time.time()}
            _DEMO[token] = rec
        rec["last_access"] = time.time()
        return rec["board"]


def _gc_demos():
    cutoff = time.time() - _DEMO_TTL
    for tok in [k for k, v in _DEMO.items() if v["last_access"] < cutoff]:
        _DEMO.pop(tok, None)


# --- board context -----------------------------------------------------------

class BoardCtx:
    """Bundles a board with how to persist it and how to build URLs for it."""

    def __init__(self, board, is_demo, token=None):
        self.board = board
        self.is_demo = is_demo
        self.token = token

    @property
    def base(self):
        """Section root for building links and HTMX targets in templates."""
        return f"/demo/{self.token}/board" if self.is_demo else "/board"

    def persist(self):
        if not self.is_demo:
            with _LOCK:
                _save()


# --- entries -----------------------------------------------------------------

def _find(board, key, item_id):
    for it in board[key]:
        if it["id"] == item_id:
            return it
    return None


def add_entry(board, data):
    now = _now()
    entry = {
        "id": _uid("entry"),
        "title": data.get("title", "").strip() or "Untitled",
        "description": data.get("description", "").strip(),
        "tag_ids": data.get("tag_ids", []),
        "status": data.get("status", "in_progress"),
        "progress": int(data.get("progress", 0) or 0),
        "author": data.get("author", "").strip(),
        "contact_email": data.get("contact_email", "").strip(),
        "pinned": bool(data.get("pinned", False)),
        "linked_ids": [],
        "comments": [],
        "created_at": now,
        "updated_at": now,
    }
    board["entries"].insert(0, entry)
    return entry


def update_entry(board, entry_id, patch):
    e = _find(board, "entries", entry_id)
    if not e:
        return None
    e.update({k: v for k, v in patch.items() if k in e})
    if e["status"] == "solved":
        e["progress"] = 100
    e["updated_at"] = _now()
    return e


def delete_entry(board, entry_id):
    board["entries"] = [e for e in board["entries"] if e["id"] != entry_id]
    for e in board["entries"]:
        e["linked_ids"] = [l for l in e.get("linked_ids", []) if l != entry_id]


def add_comment(board, entry_id, author, text):
    e = _find(board, "entries", entry_id)
    if not e:
        return None
    c = {"id": _uid("cmt"), "author": author.strip() or "anonymous",
         "text": text.strip(), "created_at": _now()}
    e["comments"].append(c)
    e["updated_at"] = _now()
    return c


# --- tags --------------------------------------------------------------------

def add_tag(board, name, color):
    tag = {"id": _uid("tag"), "name": name.strip(), "color": color}
    board["tags"].append(tag)
    return tag


def update_tag(board, tag_id, patch):
    t = _find(board, "tags", tag_id)
    if t:
        t.update({k: v for k, v in patch.items() if k in ("name", "color")})
    return t


def delete_tag(board, tag_id):
    board["tags"] = [t for t in board["tags"] if t["id"] != tag_id]
    for e in board["entries"]:
        e["tag_ids"] = [tid for tid in e.get("tag_ids", []) if tid != tag_id]


def tag_map(board):
    return {t["id"]: t for t in board["tags"]}


# --- calendar ----------------------------------------------------------------

def set_competition_date(board, date_str):
    board["calendar"]["competition_date"] = date_str or None


def set_day(board, date_str, available, details=None):
    days = board["calendar"]["work_days"]
    if not available:
        days.pop(date_str, None)
        return
    cur = days.get(date_str, {"duration": "", "time": "", "timezone": "", "location": ""})
    if details:
        cur.update({k: v for k, v in details.items()
                    if k in ("duration", "time", "timezone", "location")})
    days[date_str] = cur


def quick_select(board, dates, action):
    days = board["calendar"]["work_days"]
    if action == "all":
        for d in dates:
            days.setdefault(d, {"duration": "", "time": "", "timezone": "", "location": ""})
    elif action == "weekends":
        for d in dates:
            wd = datetime.strptime(d, "%Y-%m-%d").weekday()
            if wd >= 5:
                days.setdefault(d, {"duration": "", "time": "", "timezone": "", "location": ""})
    elif action == "none":
        for d in dates:
            days.pop(d, None)


# --- share / fork ------------------------------------------------------------

def export_snapshot(board):
    return {
        "format": "chassis.board.v1",
        "shared_from": board["display_name"],
        "tags": board["tags"],
        "entries": board["entries"],
    }
