# Chassis

**A shared knowledge log and engineering notebook for robotics teams.**

Robotics team members usually stay two to four years. When they graduate, the
fixes, strategies, and lessons they worked out leave with them, and the next
group re-solves the same problems from scratch. Chassis is where a team writes it
down once: tagged, searchable, and easy to share with other teams.

> This is a prototype built to explore the concept. Accounts are simple and the
> database is a local JSON file. See [Notes](#notes) before treating it as
> production ready.

---

## Run it

You need [Python](https://www.python.org/downloads/) 3.10 or newer.

```bash
pip install -r requirements.txt
python app.py
```

Then open the address it prints:

```
  Chassis is running.
    On this computer:   http://localhost:5000
    On your network:    http://192.168.x.x:5000
```

Open `localhost` to land on the home page. Click **Explore the demo** to poke
around a seeded board, or **Sign up** to start your own.

### Open it on your team's network

`python app.py` already serves on every interface, so teammates on the same
Wi-Fi can open the **On your network** address above on their own phones and
laptops. No deploy step needed.

---

## About the code (Python first)

Nearly everything runs in Python. This is a [Flask](https://flask.palletsprojects.com/)
app: the data model, all the logic, persistence, fuzzy search, sharing, and PDF
generation are Python. Pages are rendered server side with Jinja templates.

Browsers can only run JavaScript, not Python, so the small amount of JS that
remains is the part that genuinely cannot be done from the server:

* remembering your light or dark theme choice,
* giving each browser tab its own fresh demo,
* detecting your timezone for the calendar,
* playing the completion checkmark animation.

In-page actions (mark solved, comment, pin, filter, edit a tag, update the
calendar) use [HTMX](https://htmx.org/), which swaps small server-rendered
fragments. On localhost and a local network these round trips take a few
milliseconds, so the interface updates instantly. HTMX is vendored in
`static/js/htmx.min.js`, so the app needs no internet connection to run.

## Project structure

```
app.py                     # all the routes and request handling
chassis/
  store.py                 # the data layer: teams, entries, tags, calendar, demo
  search.py                # typo-tolerant search (pure Python, replaces Fuse.js)
  pdf_export.py            # Engineering Notebook PDF, built with fpdf2
  text.py                  # competition framing and title helpers
  seed.py                  # demo board content
templates/                 # Jinja pages and HTMX partials
static/css/styles.css      # one stylesheet, dark by default with a light theme
static/js/app.js           # the small bit of unavoidable JavaScript
static/js/htmx.min.js      # vendored library
```

## Features

* Entries with title, description, multiple color-coded tags, status, author, and date
* Live feed with typo-tolerant search and filters by status and tag
* Pin important entries, link related entries, add notes and corrections
* Team accounts, private by default, with a real shareable read-only link
* A new board asks which competition it is for; FLL, FTC, FRC, and VEX boards are
  framed as an Engineering Notebook and the competition name appears throughout
* Calendar: set the competition date and your work days, with per-day meeting
  time, duration, timezone, and location; quick select all days or weekends
* Stats: a countdown to competition, solved versus in progress, entries this
  season, and an entries-by-category chart you can filter
* One-click Engineering Notebook PDF export
* Dark mode by default with a light toggle, and a layout that works on phones

## Notes

* **Accounts are basic.** Passwords are hashed, but this is a single shared team
  password and a local file, not a hardened auth system. Do not reuse a real
  password.
* **Data lives in `data/db.json`** next to the app. Delete that file to reset.
* **The demo is per tab.** Each new tab seeds a fresh demo and resets when closed.
* Because users may be minors, contact email is opt in and only shown inside the
  team board.

## License

MIT
