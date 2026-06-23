# Chassis

**A shared knowledge log built for robotics teams.**

Robotics team members usually stay for only 2–4 years. When they graduate, the
fixes, strategies, and hard-won lessons in their heads leave with them — because
none of it was ever written down anywhere searchable. The next generation
re-solves the same problems from scratch. Chassis is where a team writes that
knowledge down **once**: tagged, searchable, and shareable with other teams.

> ⚠️ **This is a prototype** built to explore the concept. It runs entirely in
> the browser and stores data in `localStorage` — no backend, no real accounts.
> See [Prototype notes](#prototype-notes) before treating any of it as
> production-ready.

---

## Features

| Area | What it does |
|------|--------------|
| **Entries** | Log a problem with title, description, category, status (in progress / solved), author, and date |
| **Live feed** | All entries in one place, newest first, with pinned entries floated to the top |
| **Color-coded tags** | Mechanical / Electrical / Code / Strategy by default, plus any custom tags your team adds |
| **Forgiving search** | Fuzzy, typo-tolerant search across titles, descriptions, tags, and authors (powered by Fuse.js) |
| **Filters** | Narrow by category and by status |
| **Team accounts** | Boards are private to a team by default (mock auth in this prototype) |
| **Share & fork** | Export a board snapshot and let another team fork it into their own space — like sharing a doc |
| **Pin / star** | Keep important reference entries at the top |
| **Linked entries** | Manually connect related entries to each other |
| **Comments** | Notes & corrections so knowledge improves over time |
| **Stats dashboard** | Totals, solved vs. open, entries this season, and most active categories |
| **PDF export** | Export the board (or a single entry) to an Engineering-Notebook-style PDF |
| **Opt-in contact** | Authors can optionally add a contact email, visible only to logged-in teammates |

Responsive: works on desktop and in a phone browser.

---

## Run it locally

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). On first load the app
seeds a demo team so there's something to explore — click **"Explore the demo →"**
on the login screen, or sign up to start an empty board.

To make a production build:

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

---

## Tech stack

- **React + Vite** — fast, simple, no framework overhead
- **Tailwind CSS** — utility styling with a small custom design system
- **Fuse.js** — client-side fuzzy search
- **jsPDF** — PDF generation in the browser
- **lucide-react** — icons

Everything runs client-side. There is no server in this prototype.

---

## Project structure

```
src/
├── main.jsx              # entry point
├── App.jsx               # app shell: auth gate, responsive nav, modal orchestration
├── index.css             # Tailwind + base styles
├── context/
│   ├── AuthContext.jsx   # current team / session (mock auth)
│   └── DataContext.jsx   # board state (entries + tags) + all CRUD
├── lib/
│   ├── storage.js        # the data layer — localStorage today, backend tomorrow
│   ├── search.js         # Fuse.js fuzzy search config
│   ├── pdf.js            # Engineering-Notebook PDF export
│   └── seed.js           # first-run demo content
└── components/
    ├── ui.jsx            # shared primitives (Button, Modal, TagChip, …)
    ├── Auth.jsx          # login / signup screen
    ├── Sidebar.jsx       # navigation panel
    ├── Feed.jsx          # search + filters + entry list
    ├── EntryCard.jsx     # one entry in the feed
    ├── EntryModal.jsx    # create / edit an entry
    ├── EntryDetail.jsx   # full entry view: comments, links, contact, export
    ├── TagManager.jsx    # add / recolor / delete tags
    ├── Stats.jsx         # season dashboard
    └── ShareModal.jsx    # export / fork a board
```

## How the data flows

The whole app reads and writes through one module: `src/lib/storage.js`. The UI
never touches `localStorage` directly — it calls functions like `addEntry()` or
`forkBoard()`. `DataContext` holds the board in React state and re-syncs from
storage after every change, so components stay simple.

That single seam is the point: to make this real, you'd replace the bodies of the
functions in `storage.js` with calls to a backend (for example **Supabase** —
Postgres + Auth + row-level security) and keep the same function names. The
components and contexts wouldn't have to change.

---

## Prototype notes

- **Auth is mock and not secure.** Team passwords are stored in plain text in
  `localStorage` purely to demonstrate the "private team board" idea. A real
  build must use a proper auth provider and never store passwords on the client.
- **Sharing is local.** Real cross-team sharing needs a server. Here, "share"
  exports a board snapshot to a file and "fork" imports it as an independent
  copy — the same idea, demonstrated without a backend.
- **Data lives in your browser.** Clearing site data wipes the boards. Nothing is
  sent anywhere.
- Because users may be minors, contact email is strictly opt-in and only shown to
  logged-in teammates. Keep data collection minimal if you build on this.

---

## License

MIT — do whatever you like with it.
