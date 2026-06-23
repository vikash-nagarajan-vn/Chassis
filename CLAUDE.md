# CLAUDE.md

Orientation for a future Claude session working on this codebase.

## What This App Does

Chassis is a shared engineering notebook for competitive robotics teams. A team
signs up, then logs entries describing problems, fixes, and decisions. Entries
carry tags, a status, an author, comments, and links to related entries. The app
supports fuzzy search, tag and status filtering, a build calendar with a
countdown, board stats, PDF export styled as an Engineering Notebook, and
read-only public share links. There is also a demo mode that needs no account.

## Architecture Summary

Two pieces that connect over HTTPS:

- Frontend: static HTML, CSS, and vanilla JS in `frontend/`, served by GitHub
  Pages. No framework, no build step. It reads one config value, `API_BASE`,
  from `config.js`.
- Backend: a Flask JSON API in `backend/`, served by Render with gunicorn.

The frontend calls the API with `fetch()`. CORS on the backend is open in
development and restricted to the GitHub Pages origin in production via the
`ALLOWED_ORIGIN` environment variable. Real sessions authenticate with an
`Authorization: Bearer <token>` header. Demo sessions pass `?demo=<token>`
instead.

## Key Files and What Each One Owns

- `backend/app.py` owns every HTTP route and is the only Flask-aware file. It
  resolves whether a request acts on a real team or a demo board, then delegates
  to the package functions.
- `backend/chassis/store.py` owns all persistence and CRUD. It is the single
  seam to where data lives.
- `backend/chassis/seed.py` owns the demo board seed content.
- `backend/chassis/search.py` owns fuzzy search using `difflib`.
- `backend/chassis/text.py` owns competition framing and title casing.
- `backend/chassis/pdf.py` owns the Engineering Notebook PDF export.
- `frontend/main.js` owns all frontend logic for all three pages. It branches on
  `document.body.dataset.page`.
- `frontend/config.js` owns the single environment value, `API_BASE`.
- `frontend/style.css` owns theming. Dark is the `:root` default; light overrides
  the same custom properties under `[data-theme="light"]`.

## Data Model

A team record as stored in `db.json`:

```python
{
    "id": "a1b2c3d4e5f6",
    "display_name": "Iron Claws",
    "team_number": "6328",
    "competition": "FRC",
    "password": "plaintext-prototype-only",
    "session_token": "32-char-hex",
    "share_token": None,            # minted on first share
    "entries": [ ... ],
    "tags": [ ... ],
    "calendar": { ... },
    "created_at": "2026-01-15T12:00:00+00:00"
}
```

An entry:

```python
{
    "id": "11aa22bb33cc",
    "title": "Gearbox Slipping Under Load",
    "description": "Tightened the set screw and added a key slot.",
    "tag_ids": ["drivetrainTagId"],
    "status": "Solved",            # Open, In Progress, or Solved
    "author": "Marcus T.",
    "pinned": True,
    "comments": [
        {"id": "c1", "author": "Priya S.", "body": "Confirmed on the practice field.",
         "created_at": "2026-01-16T00:00:00+00:00"}
    ],
    "related_ids": ["otherEntryId"],
    "created_at": "2026-01-15T12:00:00+00:00",
    "updated_at": "2026-01-16T00:00:00+00:00"
}
```

A tag:

```python
{"id": "drivetrainTagId", "name": "Drivetrain", "color": "#e8650a"}
```

A calendar:

```python
{
    "competition_date": "2026-03-15",   # ISO date string or None
    "work_days": {
        "2026-03-01": {
            "duration_minutes": 120,
            "meeting_time": "17:00",
            "timezone": "America/Phoenix",
            "location": "Build room"     # optional
        }
    }
}
```

## API Pattern

A typical create from the frontend:

```javascript
const entry = await api("/api/entries", {
    method: "POST",
    body: JSON.stringify({
        title: "Vision target alignment bug",
        description: "Loses the target under bright light.",
        tag_ids: [softwareTagId],
        status: "Open",
        author: "Priya S."
    })
});
```

The `api()` wrapper in `main.js` adds the right credential, parses JSON, and
redirects to sign in on a 401 for real sessions. The response is the created
entry as JSON:

```json
{
    "id": "newEntryId",
    "title": "Vision target alignment bug",
    "status": "Open",
    "pinned": false,
    "comments": [],
    "related_ids": [],
    "created_at": "2026-01-20T00:00:00+00:00",
    "updated_at": "2026-01-20T00:00:00+00:00"
}
```

## Demo Mode Architecture

Demo boards live in a module-level dict in `store.py` called `_DEMO_BOARDS`,
keyed by a token. They are seeded by `seed.py` and never written to disk. The
frontend stores the token in sessionStorage and sends it on every call as a
`?demo=<token>` query parameter, which `app.py` reads in `_resolve_board`. The
token clears when the tab closes, so the demo resets. Because the dict is per
process, the server runs with a single gunicorn worker; see the gotchas below.

## Auth Flow

Signup creates a team and returns a `session_token`. The frontend stores it in
localStorage and sends it as `Authorization: Bearer <token>` on every request.
The backend validates by looking the token up in the team records. Sign in
checks team number and password, then returns the same token.

## Where Supabase Would Slot In

`store.py` is the only file that touches persistence. Real teams are read and
written through `_read_db` and `_write_db`, and every other function in the file
operates on plain dicts. Replacing those two functions, plus the lookups that
call `_read_db` directly, with Supabase client calls is the entire migration
path. No route in `app.py` and nothing in the frontend would need to change,
because they all go through the store's function interface, not the JSON file.

## Things to Know Before Touching the Code

- CORS must be updated when the GitHub Pages URL changes. Set `ALLOWED_ORIGIN`
  on Render to the new origin.
- The demo dict is per process and not thread-safe under heavy load. Run a single
  gunicorn worker so demo boards stay on one process. This is set in the Procfile
  and render.yaml.
- The PDF layout in `pdf.py` uses cursor-based and absolute positioning. Changing
  fonts or margins means rechecking the height math in `_entry_block`, since
  block placement depends on the current values.
- No em dashes anywhere in this repository, by project rule. Use hyphens.
- The frontend escapes all dynamic strings through `esc()` before inserting them
  into innerHTML. Keep new rendering paths consistent with that.
