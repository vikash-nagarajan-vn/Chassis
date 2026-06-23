"""Chassis Flask API.

This is the only Flask-aware file. It maps HTTP routes onto the plain functions
in the chassis package, handles auth, and resolves whether a request is acting
on a real team board or an in-memory demo board.

Running locally:
    python app.py            (serves on 0.0.0.0:5000, reachable on your LAN)
In production:
    gunicorn app:app         (Render uses this via the Procfile)

CORS: open during development. In production set ALLOWED_ORIGIN to your GitHub
Pages origin and only that origin is allowed.
"""

import os

from flask import Flask, Response, jsonify, request
from flask_cors import CORS

from chassis import pdf as pdf_export
from chassis import search as search_module
from chassis import store
from chassis import text as text_helpers

app = Flask(__name__)

# ALLOWED_ORIGIN is injected by Render in production. When it is unset (local
# development) we allow every origin so opening index.html from a file path or
# a different port just works. When it is set we lock CORS to that one origin.
_allowed_origin = os.environ.get("ALLOWED_ORIGIN")
if _allowed_origin:
    CORS(app, resources={r"/api/*": {"origins": _allowed_origin}})
else:
    CORS(app)


# ---------------------------------------------------------------------------
# Request context: resolve which board this request acts on
# ---------------------------------------------------------------------------

def _bearer_token():
    """Pull the token out of an 'Authorization: Bearer <token>' header."""
    header = request.headers.get("Authorization", "")
    if header.startswith("Bearer "):
        return header[len("Bearer "):].strip()
    return None


def _resolve_board():
    """Return (board, save, is_demo) for the current request, or (None, ...).

    Demo requests carry a ?demo=<token> query param and operate on a board that
    lives only in memory; their save callback is a no-op because mutating the
    dict already updates the live object. Real requests carry a Bearer token;
    their save persists the owning team to disk. A request matching neither
    yields (None, None, False) and the caller returns 401.
    """
    demo_token = request.args.get("demo")
    if demo_token:
        board = store.get_demo_board(demo_token)
        if board is None:
            return None, None, True
        # Demo boards are live dicts already, so saving is a no-op.
        return board, (lambda: None), True

    token = _bearer_token()
    team = store.find_team_by_token(token)
    if team is None:
        return None, None, False
    # Real board: persist the whole team on save.
    return team, (lambda: store._persist_team(team)), False


def _require_board():
    """Resolve the board or raise a 401 by returning an error response.

    Returns a tuple (board, save, error_response). When error_response is not
    None the caller should return it immediately.
    """
    board, save, _is_demo = _resolve_board()
    if board is None:
        return None, None, (jsonify({"error": "Not authorized"}), 401)
    return board, save, None


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    """A tiny landing response so hitting the Render URL directly is friendly."""
    return jsonify({"app": "Chassis API", "status": "ok"})


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@app.post("/api/auth/signup")
def signup():
    """Create a team account and return the session token plus board info."""
    data = request.get_json(silent=True) or {}
    display_name = (data.get("display_name") or "").strip()
    team_number = (str(data.get("team_number") or "")).strip()
    password = data.get("password") or ""
    competition = (data.get("competition") or "Other").strip()

    if not display_name or not team_number or not password:
        return jsonify({"error": "Display name, team number, and password are required"}), 400

    team = store.create_team(display_name, team_number, password, competition)
    return jsonify({
        "session_token": team["session_token"],
        "team": _team_summary(team),
    }), 201


@app.post("/api/auth/signin")
def signin():
    """Verify credentials and return the session token."""
    data = request.get_json(silent=True) or {}
    team_number = (str(data.get("team_number") or "")).strip()
    password = data.get("password") or ""

    team = store.find_team_by_credentials(team_number, password)
    if team is None:
        return jsonify({"error": "Team number or password is incorrect"}), 401

    return jsonify({
        "session_token": team["session_token"],
        "team": _team_summary(team),
    })


def _team_summary(team):
    """Public-safe summary of a team. Never includes password or token."""
    return {
        "display_name": team["display_name"],
        "team_number": team["team_number"],
        "competition": team["competition"],
        "full_name": text_helpers.full_team_name(team["display_name"], team["team_number"]),
        "board_title": text_helpers.board_title(team["competition"]),
        "doc_type": text_helpers.doc_type(team["competition"]),
    }


# ---------------------------------------------------------------------------
# Board
# ---------------------------------------------------------------------------

@app.get("/api/board")
def get_board():
    """Return the full board: team meta, entries (sorted), and tags."""
    board, _save, error = _require_board()
    if error:
        return error
    view = store.public_board_view(board)
    view["entries"] = store.list_entries(board)
    view["full_name"] = text_helpers.full_team_name(
        board.get("display_name"), board.get("team_number")
    )
    view["board_title"] = text_helpers.board_title(board.get("competition"))
    view["doc_type"] = text_helpers.doc_type(board.get("competition"))
    return jsonify(view)


# ---------------------------------------------------------------------------
# Entries
# ---------------------------------------------------------------------------

@app.post("/api/entries")
def create_entry():
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Title is required"}), 400
    entry = store.add_entry(
        board, save,
        title=title,
        description=(data.get("description") or "").strip(),
        tag_ids=data.get("tag_ids") or [],
        status=data.get("status") or "Open",
        author=(data.get("author") or "Anonymous").strip(),
    )
    return jsonify(entry), 201


@app.get("/api/entries/<entry_id>")
def get_entry(entry_id):
    board, _save, error = _require_board()
    if error:
        return error
    detail = store.entry_detail(board, entry_id)
    if detail is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(detail)


@app.put("/api/entries/<entry_id>")
def edit_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    entry = store.update_entry(board, save, entry_id, data)
    if entry is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(entry)


@app.delete("/api/entries/<entry_id>")
def remove_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    ok = store.delete_entry(board, save, entry_id)
    if not ok:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify({"deleted": True})


@app.post("/api/entries/<entry_id>/pin")
def pin_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    entry = store.toggle_pin(board, save, entry_id)
    if entry is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify({"pinned": entry["pinned"]})


@app.post("/api/entries/<entry_id>/solve")
def solve_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    entry = store.mark_solved(board, save, entry_id)
    if entry is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify({"solved": True, "status": entry["status"]})


@app.post("/api/entries/<entry_id>/comments")
def comment_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "Comment body is required"}), 400
    comment = store.add_comment(
        board, save, entry_id,
        author=(data.get("author") or "Anonymous").strip(),
        body=body,
    )
    if comment is None:
        return jsonify({"error": "Entry not found"}), 404
    return jsonify(comment), 201


@app.post("/api/entries/<entry_id>/relate")
def relate_entry(entry_id):
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    other_id = (data.get("related_id") or "").strip()
    if not other_id:
        return jsonify({"error": "related_id is required"}), 400
    entry = store.relate_entries(board, save, entry_id, other_id)
    if entry is None:
        return jsonify({"error": "Could not relate those entries"}), 400
    return jsonify(store.entry_detail(board, entry_id))


# ---------------------------------------------------------------------------
# Search and filter
# ---------------------------------------------------------------------------

@app.get("/api/search")
def search():
    board, _save, error = _require_board()
    if error:
        return error
    query = request.args.get("q", "")
    tag_map = {tag["id"]: tag for tag in board.get("tags", [])}
    # Search the feed-ordered list so equal-score ties keep a sensible order.
    results = search_module.search_entries(store.list_entries(board), tag_map, query)
    return jsonify({"entries": results})


@app.get("/api/filter")
def filter_entries():
    """Filter by tag and status. Both are optional and compose with AND."""
    board, _save, error = _require_board()
    if error:
        return error
    tag_id = request.args.get("tag")
    status = request.args.get("status")

    results = []
    for entry in store.list_entries(board):
        if tag_id and tag_id not in entry.get("tag_ids", []):
            continue
        if status and entry.get("status") != status:
            continue
        results.append(entry)
    return jsonify({"entries": results})


# ---------------------------------------------------------------------------
# Tags
# ---------------------------------------------------------------------------

@app.get("/api/tags")
def get_tags():
    board, _save, error = _require_board()
    if error:
        return error
    return jsonify({"tags": store.list_tags(board)})


@app.post("/api/tags")
def create_tag():
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    color = (data.get("color") or "#888888").strip()
    if not name:
        return jsonify({"error": "Tag name is required"}), 400
    tag = store.add_tag(board, save, name, color)
    return jsonify(tag), 201


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

@app.get("/api/stats")
def stats():
    board, _save, error = _require_board()
    if error:
        return error
    return jsonify(store.board_stats(board))


@app.get("/api/stats/categories")
def stats_categories():
    board, _save, error = _require_board()
    if error:
        return error
    status_filter = request.args.get("filter", "All")
    # alltime defaults to true; any value other than the string 'false' counts.
    all_time = request.args.get("alltime", "true").lower() != "false"
    return jsonify(store.category_breakdown(board, status_filter, all_time))


# ---------------------------------------------------------------------------
# Calendar
# ---------------------------------------------------------------------------

@app.get("/api/calendar")
def get_calendar():
    board, _save, error = _require_board()
    if error:
        return error
    return jsonify(store.get_calendar(board))


@app.post("/api/calendar")
def update_calendar():
    board, save, error = _require_board()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    # Both fields are optional so the frontend can update just the date or just
    # the work days. Passing None leaves that field untouched in the store.
    calendar = store.update_calendar(
        board, save,
        competition_date=data.get("competition_date", None) if "competition_date" in data else None,
        work_days=data.get("work_days", None) if "work_days" in data else None,
    )
    return jsonify(calendar)


# ---------------------------------------------------------------------------
# Share
# ---------------------------------------------------------------------------

@app.post("/api/share/generate")
def generate_share():
    """Mint or return the share token. Demo boards cannot be shared."""
    board, _save, _is_demo = _resolve_board()
    if board is None:
        return jsonify({"error": "Not authorized"}), 401
    if "demo_token" in board:
        return jsonify({"error": "Demo boards cannot be shared"}), 400
    token = store.ensure_share_token(board)
    return jsonify({"share_token": token})


@app.get("/api/share/<token>")
def public_share(token):
    """Public read-only board data. No auth required by design."""
    team = store.find_team_by_share_token(token)
    if team is None:
        return jsonify({"error": "Share link not found"}), 404
    view = store.public_board_view(team)
    view["entries"] = store.list_entries(team)
    view["full_name"] = text_helpers.full_team_name(
        team.get("display_name"), team.get("team_number")
    )
    view["board_title"] = text_helpers.board_title(team.get("competition"))
    # Strip the share token from a public payload; viewers do not need it.
    view.pop("share_token", None)
    return jsonify(view)


# ---------------------------------------------------------------------------
# PDF export
# ---------------------------------------------------------------------------

def _pdf_response(data, filename):
    """Wrap PDF bytes in a download response with the right headers."""
    return Response(
        data,
        mimetype="application/pdf",
        headers={"Content-Disposition": "attachment; filename={}".format(filename)},
    )


@app.get("/api/export/board.pdf")
def export_board_pdf():
    board, _save, error = _require_board()
    if error:
        return error
    data = pdf_export.board_pdf(board)
    return _pdf_response(data, "chassis-board.pdf")


@app.get("/api/export/entries/<entry_id>.pdf")
def export_entry_pdf(entry_id):
    board, _save, error = _require_board()
    if error:
        return error
    detail = store.entry_detail(board, entry_id)
    if detail is None:
        return jsonify({"error": "Entry not found"}), 404
    data = pdf_export.entry_pdf(board, detail)
    return _pdf_response(data, "chassis-entry.pdf")


# ---------------------------------------------------------------------------
# Demo
# ---------------------------------------------------------------------------

@app.get("/api/demo/seed")
def demo_seed():
    """Create a brand new in-memory demo board and return its token."""
    token = store.create_demo_board()
    return jsonify({"demo_token": token})


@app.get("/api/demo/<token>/board")
def demo_board(token):
    """Return a demo board by token. Used as a direct fetch path if needed.

    The main app fetches the board through /api/board?demo=<token>, but this
    explicit route exists for clarity and quick checks.
    """
    board = store.get_demo_board(token)
    if board is None:
        return jsonify({"error": "Demo board expired"}), 404
    view = store.public_board_view(board)
    view["entries"] = store.list_entries(board)
    view["full_name"] = text_helpers.full_team_name(
        board.get("display_name"), board.get("team_number")
    )
    view["board_title"] = text_helpers.board_title(board.get("competition"))
    return jsonify(view)


if __name__ == "__main__":
    # Bind to 0.0.0.0 so the API is reachable from other devices on the LAN,
    # which is handy when testing the frontend from a phone during a build
    # session. Render ignores this block and uses gunicorn via the Procfile.
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
