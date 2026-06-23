# Chassis

A shared knowledge log and engineering notebook for competitive robotics teams.
Teams log fixes, decisions, and dead ends as entries that are tagged,
searchable, and linkable. Any entry can be marked solved, pinned, commented on,
exported to PDF, or shared with another team through a read-only link. Built for
FLL, FTC, FRC, and VEX.

## Architecture

The frontend is static HTML, CSS, and vanilla JavaScript with no build step,
hosted on GitHub Pages. The backend is a Python and Flask JSON API hosted on
Render. The two talk over HTTPS: the frontend calls the API with `fetch()` and
carries a Bearer token for real sessions or a demo token for demo sessions. All
logic, search, auth, and PDF generation live in the backend.

## Deploy the Backend (Render)

1. Fork this repo on GitHub.
2. Go to render.com, create a new Web Service, and connect your forked repo. Set
   the root directory to `backend/`.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app --workers 1`
5. Add an environment variable `ALLOWED_ORIGIN` set to
   `https://<your-github-username>.github.io`
6. Click Deploy. When it finishes, copy the `.onrender.com` URL.

The start command pins a single worker on purpose. Demo boards live in memory
inside one process, so more than one worker would split them across processes
and a demo request could land on a worker that does not hold the board. Real
team data is stored on disk and is not affected by worker count.

## Configure and Deploy the Frontend (GitHub Pages)

1. Open `frontend/config.js` and replace the placeholder with your Render URL.
   No trailing slash.
2. Commit and push.
3. In your GitHub repo settings, open Pages and set the source to the `main`
   branch and the `/frontend` folder.
4. Your app is live at `https://<your-github-username>.github.io/<repo-name>/`.

## Project Structure

```
chassis/
  frontend/
    index.html        Landing page, sign in, sign up, and demo entry point
    app.html          Single-page app shell loaded after sign in
    share.html        Read-only public board view
    config.js         API_BASE constant, the one line to change per environment
    style.css         All styles, dark and light theme via CSS custom properties
    main.js           All frontend logic, routing, fetch, rendering, demo mode
    favicon.svg       Wrench icon, also embedded inline in each HTML head
  backend/
    app.py            Flask app, all routes, CORS, auth, PDF responses
    chassis/
      __init__.py     Package marker and overview
      text.py         Competition framing, title casing, full team name
      store.py        All CRUD, JSON persistence, in-memory demo boards
      seed.py         Demo board seed content
      search.py       Standard-library fuzzy search using difflib
      pdf.py          Engineering Notebook PDF export using fpdf2
    data/
      .gitkeep        Keeps the data folder in git; db.json is gitignored
    requirements.txt  flask, flask-cors, fpdf2, gunicorn
    render.yaml       Render deployment config
    Procfile          gunicorn start command
  README.md
  CLAUDE.md
  .gitignore
```

## Data Flow

The frontend is fully static with no build step. Every action calls the Flask
API with `fetch()`, and all logic runs server side. Real sessions send a Bearer
token stored in localStorage; demo sessions send a token from sessionStorage as
a `?demo=` query parameter instead. Switching the API URL for any environment
means changing one line in `config.js`.

## Demo Mode

Clicking "Explore the demo" on the landing page calls the server to create an
in-memory board seeded with six realistic FRC entries. That board is never
written to disk. Its token lives in sessionStorage, so the demo resets
automatically when the browser tab closes.

## Auth Note

Team passwords are stored in plaintext in a JSON file on the server. This is a
prototype meant for learning and local or small-team use. Do not store real
sensitive information in it. A production version would hash passwords and move
storage to a real database.

## Known Limitations and Stretch Ideas

- No email verification on signup.
- One shared password per team rather than per-member accounts.
- Comments are flat, not threaded.
- The PDF layout is intentionally simple and uses fixed positioning.
- No real-time sync; two open sessions will not see each other's changes until
  they reload.
- Demo boards are single process and reset on server restart.
- A natural next step is swapping the JSON store for a hosted database. See
  CLAUDE.md for exactly where that change would go.
