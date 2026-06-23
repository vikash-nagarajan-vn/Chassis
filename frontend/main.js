/*
  Chassis frontend logic, all in one file.

  One module serves three pages (landing, app, share). At load we branch on
  document.body.dataset.page and wire up only what that page needs. Keeping it
  together means the fetch wrapper, theme toggle, and small helpers are written
  once and shared.

  Auth model: a real session uses a Bearer token in localStorage. A demo
  session uses a token in sessionStorage and is sent as a ?demo= query param
  instead of a header. The api() wrapper hides this difference from callers.

  No em dashes anywhere in this file. Hyphens only.
*/

import { API_BASE } from "./config.js";

/* ======================================================================= */
/* Storage keys and session helpers                                        */
/* ======================================================================= */

const TOKEN_KEY = "chassis_token";       // real session, persists across tabs
const DEMO_KEY = "chassis_demo";         // demo session, clears on tab close
const THEME_KEY = "chassis_theme";       // "light" or "dark"

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getDemoToken() {
  return sessionStorage.getItem(DEMO_KEY);
}

function isDemo() {
  return Boolean(getDemoToken());
}

function signOut() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(DEMO_KEY);
  window.location.href = "index.html";
}

/* ======================================================================= */
/* Fetch wrapper                                                           */
/* ======================================================================= */

/*
  Every API call goes through here. It attaches the right credential, parses
  JSON, and on a 401 for a real session it clears the token and bounces to the
  landing page. Demo calls never carry a Bearer header; they append ?demo=.
*/
async function api(path, options = {}) {
  const demo = getDemoToken();
  let url = API_BASE + path;

  const headers = Object.assign(
    { "Content-Type": "application/json" },
    options.headers || {}
  );

  if (demo) {
    // Append the demo token, respecting any existing query string.
    url += (url.includes("?") ? "&" : "?") + "demo=" + encodeURIComponent(demo);
  } else {
    const token = getToken();
    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }
  }

  const response = await fetch(url, Object.assign({}, options, { headers }));

  if (response.status === 401 && !demo) {
    // The token is stale or missing. Send the user back to sign in.
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "index.html";
    throw new Error("Not authorized");
  }

  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Request failed");
    }
    return data;
  }
  return response;
}

/* Fetch a PDF as a blob (auth header cannot ride on a plain link) and trigger
   a download. The demo case appends ?demo= just like api(). */
async function downloadPdf(path, filename) {
  const demo = getDemoToken();
  let url = API_BASE + path;
  const headers = {};
  if (demo) {
    url += (url.includes("?") ? "&" : "?") + "demo=" + encodeURIComponent(demo);
  } else {
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  const response = await fetch(url, { headers });
  if (!response.ok) {
    toast("Could not generate PDF");
    return;
  }
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/* ======================================================================= */
/* Small shared helpers                                                    */
/* ======================================================================= */

/* Escape user text before putting it into innerHTML. Every dynamic string in
   this app passes through here to keep entries from injecting markup. */
function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Map a status string to its slug class used in the stylesheet. */
function statusClass(status) {
  if (status === "Solved") return "status-solved";
  if (status === "In Progress") return "status-progress";
  return "status-open";
}

/* Format an ISO timestamp as a short readable date, or a dash if absent. */
function shortDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

/* Lightweight toast. One at a time is plenty for this app. */
let toastTimer = null;
function toast(message) {
  let el = document.querySelector(".toast");
  if (!el) {
    el = document.createElement("div");
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = message;
  // Force a reflow so the transition runs even on rapid repeat calls.
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

/* Render a tag pill given a tag object. Custom colors come straight from the
   stored hex, so no stylesheet lookup is needed. */
function tagPill(tag) {
  if (!tag) return "";
  return '<span class="tag-pill" style="background:' + esc(tag.color) + '">' +
    esc(tag.name) + "</span>";
}

/* Build a quick id-to-tag lookup from the cached board tags. */
function tagLookup() {
  const map = {};
  (boardCache.tags || []).forEach((t) => { map[t.id] = t; });
  return map;
}

/* ======================================================================= */
/* Theme                                                                   */
/* ======================================================================= */

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "light") {
    root.setAttribute("data-theme", "light");
  } else {
    root.setAttribute("data-theme", "dark");
  }
  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.textContent = theme === "light" ? "L" : "D";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(saved);
  const toggle = document.getElementById("theme-toggle");
  if (toggle) {
    toggle.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
  }
}

/* ======================================================================= */
/* Board cache                                                             */
/* ======================================================================= */

/* Holds the most recent board payload so renderers can read tags and team
   meta without refetching. Refreshed by loadBoard(). */
let boardCache = { tags: [], entries: [], team: {} };

async function loadBoard() {
  const data = await api("/api/board");
  boardCache = data;
  return data;
}

/* ======================================================================= */
/* LANDING PAGE                                                            */
/* ======================================================================= */

function initLanding() {
  // If the user is already signed in or in a demo, skip straight to the app.
  if (getToken() || isDemo()) {
    window.location.href = "app.html";
    return;
  }

  const heroSection = document.getElementById("hero-section");
  const authSection = document.getElementById("auth-section");
  const authTitle = document.getElementById("auth-title");
  const authSubtitle = document.getElementById("auth-subtitle");
  const switchText = document.getElementById("switch-text");
  const switchMode = document.getElementById("switch-mode");
  const errorBox = document.getElementById("auth-error");
  const submitBtn = document.getElementById("auth-submit");

  let mode = "signin"; // or "signup"

  function showAuth(nextMode) {
    mode = nextMode;
    heroSection.hidden = true;
    authSection.hidden = false;
    errorBox.textContent = "";
    const signupOnly = document.querySelectorAll(".signup-only");
    if (mode === "signup") {
      authTitle.textContent = "Create a Notebook";
      authSubtitle.textContent = "Set up your team board";
      switchText.textContent = "Already have a team?";
      switchMode.textContent = "Sign in instead";
      signupOnly.forEach((el) => (el.hidden = false));
    } else {
      authTitle.textContent = "Sign In";
      authSubtitle.textContent = "Access your team board";
      switchText.textContent = "New team?";
      switchMode.textContent = "Create a notebook";
      signupOnly.forEach((el) => (el.hidden = true));
    }
  }

  document.getElementById("show-signin").addEventListener("click", () => showAuth("signin"));
  document.getElementById("show-signup").addEventListener("click", () => showAuth("signup"));
  document.getElementById("hero-signup").addEventListener("click", () => showAuth("signup"));

  switchMode.addEventListener("click", (e) => {
    e.preventDefault();
    showAuth(mode === "signin" ? "signup" : "signin");
  });

  // Explore the demo: ask the server for a fresh in-memory board, stash the
  // token in sessionStorage, and enter the app in demo mode.
  document.getElementById("explore-demo").addEventListener("click", async () => {
    try {
      const data = await api("/api/demo/seed");
      sessionStorage.setItem(DEMO_KEY, data.demo_token);
      window.location.href = "app.html";
    } catch (err) {
      toast("Could not start the demo. Is the backend running?");
    }
  });

  async function submit() {
    errorBox.textContent = "";
    const number = document.getElementById("f-number").value.trim();
    const password = document.getElementById("f-password").value;

    if (!number || !password) {
      errorBox.textContent = "Team number and password are required.";
      return;
    }

    try {
      let data;
      if (mode === "signup") {
        const display = document.getElementById("f-display").value.trim();
        const competition = document.getElementById("f-competition").value;
        if (!display) {
          errorBox.textContent = "Team display name is required.";
          return;
        }
        data = await api("/api/auth/signup", {
          method: "POST",
          body: JSON.stringify({
            display_name: display,
            team_number: number,
            password: password,
            competition: competition,
          }),
        });
      } else {
        data = await api("/api/auth/signin", {
          method: "POST",
          body: JSON.stringify({ team_number: number, password: password }),
        });
      }
      localStorage.setItem(TOKEN_KEY, data.session_token);
      window.location.href = "app.html";
    } catch (err) {
      errorBox.textContent = err.message || "Something went wrong.";
    }
  }

  submitBtn.addEventListener("click", submit);
  // Enter key submits from any field in the auth card.
  authSection.addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

/* ======================================================================= */
/* APP SHELL                                                               */
/* ======================================================================= */

async function initApp() {
  // Guard: no credential at all means the user does not belong here.
  if (!getToken() && !isDemo()) {
    window.location.href = "index.html";
    return;
  }

  setupSidebar();

  try {
    await loadBoard();
  } catch (err) {
    document.getElementById("view").innerHTML =
      '<div class="empty-state"><p class="eyebrow">Cannot reach the backend</p>' +
      "<p>Check that the Flask server is running and that config.js points at it.</p></div>";
    return;
  }

  paintTeamChip();
  setupTopActions();

  // Hash router. Re-render whenever the hash changes, and once on load.
  window.addEventListener("hashchange", route);
  route();
}

function paintTeamChip() {
  const chip = document.getElementById("team-chip");
  const fullName = boardCache.full_name || "Team";
  const title = boardCache.board_title || "Notebook";
  document.title = fullName + " - Chassis";
  let demoFlag = "";
  if (isDemo()) {
    demoFlag = '<span class="demo-flag">Demo board</span>';
  }
  chip.innerHTML =
    "<strong>" + esc(fullName) + "</strong>" +
    "<span>" + esc(title) + "</span>" +
    demoFlag;
}

function setupSidebar() {
  const sidebar = document.getElementById("sidebar");
  const hamburger = document.getElementById("hamburger");
  const scrim = document.getElementById("scrim");

  function close() {
    sidebar.classList.remove("open");
    scrim.hidden = true;
  }
  hamburger.addEventListener("click", () => {
    sidebar.classList.add("open");
    scrim.hidden = false;
  });
  scrim.addEventListener("click", close);
  // Tapping any nav item on mobile should also close the drawer.
  sidebar.addEventListener("click", (e) => {
    if (e.target.closest(".nav-link")) close();
  });
}

function setupTopActions() {
  document.getElementById("nav-signout").addEventListener("click", signOut);

  document.getElementById("nav-export").addEventListener("click", () => {
    downloadPdf("/api/export/board.pdf", "chassis-board.pdf");
  });

  document.getElementById("nav-share").addEventListener("click", async () => {
    if (isDemo()) {
      toast("Demo boards cannot be shared. Create a team to share.");
      return;
    }
    try {
      const data = await api("/api/share/generate", { method: "POST" });
      const base = window.location.href.replace(/app\.html.*$/, "");
      const link = base + "share.html?token=" + data.share_token;
      await copyToClipboard(link);
      toast("Share link copied to clipboard");
    } catch (err) {
      toast(err.message || "Could not generate a share link");
    }
  });
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    // Clipboard API can be blocked outside HTTPS. Fall back to a prompt so the
    // user can still copy the link by hand.
    window.prompt("Copy this share link:", text);
  }
}

function setActiveNav(name) {
  document.querySelectorAll(".nav-link[data-nav]").forEach((link) => {
    link.classList.toggle("active", link.getAttribute("data-nav") === name);
  });
}

/* ----------------------------------------------------------------------- */
/* Router                                                                  */
/* ----------------------------------------------------------------------- */

function route() {
  const hash = window.location.hash || "#feed";
  const view = document.getElementById("view");

  if (hash.startsWith("#entry/")) {
    const id = hash.slice("#entry/".length);
    setActiveNav("feed");
    renderEntryDetail(view, id);
  } else if (hash === "#new") {
    setActiveNav("new");
    renderEntryForm(view, null);
  } else if (hash.startsWith("#edit/")) {
    const id = hash.slice("#edit/".length);
    setActiveNav("feed");
    renderEntryForm(view, id);
  } else if (hash === "#stats") {
    setActiveNav("stats");
    renderStats(view);
  } else if (hash === "#calendar") {
    setActiveNav("calendar");
    renderCalendar(view);
  } else {
    setActiveNav("feed");
    renderFeed(view);
  }
}

/* ----------------------------------------------------------------------- */
/* Feed                                                                    */
/* ----------------------------------------------------------------------- */

// Current filter state. Search and filters compose, so we keep both and the
// active tag and status alongside the latest entry list.
let feedState = { query: "", tag: "", status: "" };

async function renderFeed(view) {
  view.innerHTML =
    '<div class="view-head"><div><h1>Feed</h1>' +
    '<div class="sub">All entries, pinned first</div></div>' +
    '<a class="btn btn-primary" href="#new">New entry</a></div>' +
    '<div class="toolbar">' +
    '<div class="search-box"><input type="search" id="feed-search" ' +
    'placeholder="Search entries (typos forgiven)" value="' + esc(feedState.query) + '"></div>' +
    "</div>" +
    '<div class="filter-bar" id="filter-bar"></div>' +
    '<div class="feed" id="feed-list"></div>';

  renderFilterBar();

  const search = document.getElementById("feed-search");
  // Debounce so we are not firing a request on every keystroke.
  let debounce = null;
  search.addEventListener("input", (e) => {
    feedState.query = e.target.value;
    clearTimeout(debounce);
    debounce = setTimeout(applyFeedQuery, 220);
  });

  await applyFeedQuery();
}

function renderFilterBar() {
  const bar = document.getElementById("filter-bar");
  const tags = boardCache.tags || [];
  const statuses = ["Open", "In Progress", "Solved"];

  let html = "";
  // Status chips.
  statuses.forEach((s) => {
    const active = feedState.status === s ? " active" : "";
    html += '<button class="chip' + active + '" data-status="' + esc(s) + '">' +
      esc(s) + "</button>";
  });
  // A divider then tag chips.
  tags.forEach((t) => {
    const active = feedState.tag === t.id ? " active" : "";
    html += '<button class="chip' + active + '" data-tag="' + esc(t.id) + '">' +
      '<span class="dot" style="background:' + esc(t.color) + '"></span>' +
      esc(t.name) + "</button>";
  });
  bar.innerHTML = html;

  bar.querySelectorAll("[data-status]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const s = chip.getAttribute("data-status");
      feedState.status = feedState.status === s ? "" : s;
      renderFilterBar();
      applyFeedQuery();
    });
  });
  bar.querySelectorAll("[data-tag]").forEach((chip) => {
    chip.addEventListener("click", () => {
      const t = chip.getAttribute("data-tag");
      feedState.tag = feedState.tag === t ? "" : t;
      renderFilterBar();
      applyFeedQuery();
    });
  });
}

/* Resolve the current search and filters into a single entry list, then paint
   only the list node. This is where search and filter compose: we start from
   the search endpoint (or the plain board) and then apply tag and status
   filters client side so both can be active at once. */
async function applyFeedQuery() {
  const listEl = document.getElementById("feed-list");
  if (!listEl) return;

  let entries;
  try {
    if (feedState.query.trim()) {
      const data = await api("/api/search?q=" + encodeURIComponent(feedState.query.trim()));
      entries = data.entries;
    } else {
      const data = await api("/api/board");
      boardCache = data;
      entries = data.entries;
    }
  } catch (err) {
    listEl.innerHTML = '<div class="empty-state"><p>Could not load entries.</p></div>';
    return;
  }

  // Apply tag and status filters on top of the search result.
  if (feedState.tag) {
    entries = entries.filter((e) => (e.tag_ids || []).includes(feedState.tag));
  }
  if (feedState.status) {
    entries = entries.filter((e) => e.status === feedState.status);
  }

  paintEntryList(listEl, entries);
}

function paintEntryList(listEl, entries) {
  if (!entries.length) {
    listEl.innerHTML =
      '<div class="empty-state"><p class="eyebrow">Nothing here yet</p>' +
      "<p>No entries match. Try clearing a filter or add a new entry.</p></div>";
    return;
  }
  const tags = tagLookup();
  listEl.innerHTML = entries.map((e) => entryCard(e, tags)).join("");
  wireEntryCards(listEl);
}

function entryCard(entry, tags) {
  const primaryTag = (entry.tag_ids || []).map((id) => tags[id]).find(Boolean);
  const rail = primaryTag ? primaryTag.color : "var(--accent)";
  const tagHtml = (entry.tag_ids || [])
    .map((id) => tagPill(tags[id]))
    .join("");
  const pin = entry.pinned ? '<span class="pin-flag">Pinned</span>' : "";

  return (
    '<article class="entry-card" data-id="' + esc(entry.id) + '" style="--rail:' + esc(rail) + '">' +
    '<div class="card-top">' +
    "<h3 data-open>" + esc(entry.title) + "</h3>" + pin +
    "</div>" +
    '<p class="desc">' + esc(entry.description) + "</p>" +
    '<div class="entry-meta">' +
    tagHtml +
    '<span class="status-pill ' + statusClass(entry.status) + '">' + esc(entry.status) + "</span>" +
    '<span class="meta-sep">/</span>' +
    "<span>" + esc(entry.author) + "</span>" +
    '<span class="meta-sep">/</span>' +
    "<span>" + esc(shortDate(entry.created_at)) + "</span>" +
    "</div>" +
    "</article>"
  );
}

function wireEntryCards(scope) {
  scope.querySelectorAll(".entry-card").forEach((card) => {
    const id = card.getAttribute("data-id");
    card.querySelector("[data-open]").addEventListener("click", () => {
      window.location.hash = "#entry/" + id;
    });
  });
}

/* ----------------------------------------------------------------------- */
/* Entry detail                                                            */
/* ----------------------------------------------------------------------- */

async function renderEntryDetail(view, id) {
  view.innerHTML = '<div class="empty-state"><p class="eyebrow">Loading entry</p></div>';
  let entry;
  try {
    entry = await api("/api/entries/" + id);
  } catch (err) {
    view.innerHTML = '<div class="empty-state"><p>Entry not found.</p>' +
      '<a class="btn btn-ghost" href="#feed">Back to feed</a></div>';
    return;
  }

  const tags = tagLookup();
  const primaryTag = (entry.tag_ids || []).map((tid) => tags[tid]).find(Boolean);
  const rail = primaryTag ? primaryTag.color : "var(--accent)";
  const tagHtml = (entry.tag_ids || []).map((tid) => tagPill(tags[tid])).join("");

  const comments = (entry.comments || []).map((c) =>
    '<div class="comment"><div class="who">' + esc(c.author) +
    ' <span style="color:var(--text-faint)">' + esc(shortDate(c.created_at)) + "</span></div>" +
    '<div class="body">' + esc(c.body) + "</div></div>"
  ).join("") || '<p style="color:var(--text-muted)">No comments yet.</p>';

  const related = (entry.related || []).map((r) =>
    '<a class="related-link" href="#entry/' + esc(r.id) + '">' +
    esc(r.title) + ' <span class="status-pill ' + statusClass(r.status) +
    '" style="margin-left:6px">' + esc(r.status) + "</span></a>"
  ).join("") || '<p style="color:var(--text-muted)">No related entries linked.</p>';

  // Other entries available to relate (exclude self and already-related).
  const relatedIds = new Set((entry.related_ids || []).concat([entry.id]));
  const relateOptions = (boardCache.entries || [])
    .filter((e) => !relatedIds.has(e.id))
    .map((e) => '<option value="' + esc(e.id) + '">' + esc(e.title) + "</option>")
    .join("");

  const solveBtn = entry.status === "Solved"
    ? ""
    : '<button class="btn" id="btn-solve">Mark solved</button>';

  view.innerHTML =
    '<a class="btn btn-ghost" href="#feed" style="margin-bottom:18px">Back to feed</a>' +
    '<div class="detail-panel" style="--rail:' + esc(rail) + '">' +
    "<h1>" + esc(entry.title) + "</h1>" +
    '<div class="entry-meta" style="margin-bottom:10px">' + tagHtml +
    '<span class="status-pill ' + statusClass(entry.status) + '">' + esc(entry.status) + "</span>" +
    '<span class="meta-sep">/</span><span>' + esc(entry.author) + "</span>" +
    '<span class="meta-sep">/</span><span>' + esc(shortDate(entry.created_at)) + "</span>" +
    (entry.pinned ? '<span class="pin-flag">Pinned</span>' : "") +
    "</div>" +
    '<p class="desc-full">' + esc(entry.description) + "</p>" +

    '<div class="detail-actions">' +
    solveBtn +
    '<button class="btn" id="btn-pin">' + (entry.pinned ? "Unpin" : "Pin") + "</button>" +
    '<a class="btn" href="#edit/' + esc(entry.id) + '">Edit</a>' +
    '<button class="btn" id="btn-entry-pdf">Export PDF</button>' +
    '<button class="btn btn-danger" id="btn-delete">Delete</button>' +
    "</div>" +

    '<div class="section-label">Comments and corrections</div>' +
    '<div id="comment-list">' + comments + "</div>" +
    '<div class="field" style="margin-top:14px">' +
    '<input type="text" id="comment-author" placeholder="Your name" style="margin-bottom:8px">' +
    '<textarea id="comment-body" placeholder="Add a correction or note" style="min-height:70px"></textarea>' +
    '<button class="btn btn-primary" id="btn-comment" style="margin-top:8px">Post comment</button>' +
    "</div>" +

    '<div class="section-label">Related entries</div>' +
    '<div id="related-list">' + related + "</div>" +
    (relateOptions
      ? '<div class="new-tag-row"><select id="relate-select"><option value="">Link a related entry...</option>' +
        relateOptions + "</select>" +
        '<button class="btn" id="btn-relate">Link</button></div>'
      : "") +
    "</div>";

  // Wire actions.
  const solve = document.getElementById("btn-solve");
  if (solve) {
    solve.addEventListener("click", async () => {
      await api("/api/entries/" + id + "/solve", { method: "POST" });
      playSolveAnimation();
      await loadBoard();
      renderEntryDetail(view, id);
    });
  }

  document.getElementById("btn-pin").addEventListener("click", async () => {
    await api("/api/entries/" + id + "/pin", { method: "POST" });
    await loadBoard();
    renderEntryDetail(view, id);
  });

  document.getElementById("btn-delete").addEventListener("click", async () => {
    if (!window.confirm("Delete this entry permanently?")) return;
    await api("/api/entries/" + id, { method: "DELETE" });
    await loadBoard();
    toast("Entry deleted");
    window.location.hash = "#feed";
  });

  document.getElementById("btn-entry-pdf").addEventListener("click", () => {
    downloadPdf("/api/export/entries/" + id + ".pdf", "chassis-entry.pdf");
  });

  document.getElementById("btn-comment").addEventListener("click", async () => {
    const author = document.getElementById("comment-author").value.trim() || "Anonymous";
    const body = document.getElementById("comment-body").value.trim();
    if (!body) {
      toast("Write a comment first");
      return;
    }
    await api("/api/entries/" + id + "/comments", {
      method: "POST",
      body: JSON.stringify({ author: author, body: body }),
    });
    renderEntryDetail(view, id);
  });

  const relateBtn = document.getElementById("btn-relate");
  if (relateBtn) {
    relateBtn.addEventListener("click", async () => {
      const otherId = document.getElementById("relate-select").value;
      if (!otherId) return;
      await api("/api/entries/" + id + "/relate", {
        method: "POST",
        body: JSON.stringify({ related_id: otherId }),
      });
      await loadBoard();
      renderEntryDetail(view, id);
    });
  }
}

/* ----------------------------------------------------------------------- */
/* Entry form (create and edit)                                           */
/* ----------------------------------------------------------------------- */

async function renderEntryForm(view, editId) {
  // For an edit we need the current values; for a new entry we start blank.
  let existing = {
    title: "", description: "", tag_ids: [], status: "Open", author: "",
  };
  if (editId) {
    try {
      existing = await api("/api/entries/" + editId);
    } catch (err) {
      view.innerHTML = '<div class="empty-state"><p>Entry not found.</p></div>';
      return;
    }
  }

  const selected = new Set(existing.tag_ids || []);
  const tags = boardCache.tags || [];
  const tagToggles = tags.map((t) =>
    '<button type="button" class="tag-toggle' + (selected.has(t.id) ? " on" : "") +
    '" data-tag="' + esc(t.id) + '" style="background:' +
    (selected.has(t.id) ? esc(t.color) : "var(--panel)") + '">' + esc(t.name) + "</button>"
  ).join("");

  const statusOptions = ["Open", "In Progress", "Solved"]
    .map((s) => '<option value="' + s + '"' + (existing.status === s ? " selected" : "") + ">" + s + "</option>")
    .join("");

  view.innerHTML =
    '<div class="view-head"><div><h1>' + (editId ? "Edit Entry" : "New Entry") + "</h1>" +
    '<div class="sub">' + (editId ? "Update the record" : "Log a fix, a decision, or a dead end") + "</div></div></div>" +
    '<div class="detail-panel">' +
    '<div class="field"><label for="e-title">Title</label>' +
    '<input type="text" id="e-title" value="' + esc(existing.title) + '" placeholder="Gearbox slipping under load"></div>' +
    '<div class="field"><label for="e-desc">Description</label>' +
    '<textarea id="e-desc" placeholder="What happened, what you tried, what worked">' + esc(existing.description) + "</textarea></div>" +
    '<div class="field"><label>Tags</label><div class="tag-select" id="tag-select">' + tagToggles + "</div>" +
    '<div class="new-tag-row"><input type="text" id="new-tag-name" placeholder="New tag name">' +
    '<input type="color" id="new-tag-color" value="#e8650a">' +
    '<button class="btn" id="btn-add-tag" type="button">Add tag</button></div></div>' +
    '<div class="field"><label for="e-status">Status</label><select id="e-status">' + statusOptions + "</select></div>" +
    '<div class="field"><label for="e-author">Author</label>' +
    '<input type="text" id="e-author" value="' + esc(existing.author) + '" placeholder="Your name"></div>' +
    '<div style="display:flex;gap:8px;margin-top:8px">' +
    '<button class="btn btn-primary" id="btn-save">' + (editId ? "Save changes" : "Create entry") + "</button>" +
    '<a class="btn btn-ghost" href="' + (editId ? "#entry/" + esc(editId) : "#feed") + '">Cancel</a>' +
    "</div></div>";

  // Tag toggles flip selection and color.
  const tagSelect = document.getElementById("tag-select");
  tagSelect.querySelectorAll(".tag-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-tag");
      const tag = (boardCache.tags || []).find((t) => t.id === id);
      if (selected.has(id)) {
        selected.delete(id);
        btn.classList.remove("on");
        btn.style.background = "var(--panel)";
      } else {
        selected.add(id);
        btn.classList.add("on");
        btn.style.background = tag ? tag.color : "var(--accent)";
      }
    });
  });

  // Create a custom tag inline. Rather than re-rendering the whole form (which
  // would reset the in-progress selection), we append a new toggle button for
  // the tag, mark it selected, and clear the name input. This keeps everything
  // the user has already typed intact.
  document.getElementById("btn-add-tag").addEventListener("click", async () => {
    const nameInput = document.getElementById("new-tag-name");
    const name = nameInput.value.trim();
    const color = document.getElementById("new-tag-color").value;
    if (!name) {
      toast("Give the tag a name");
      return;
    }
    const tag = await api("/api/tags", {
      method: "POST",
      body: JSON.stringify({ name: name, color: color }),
    });
    await loadBoard();

    // If the tag already existed the server returns it; avoid a duplicate
    // toggle in that case.
    if (!tagSelect.querySelector('[data-tag="' + tag.id + '"]')) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-toggle on";
      btn.setAttribute("data-tag", tag.id);
      btn.style.background = tag.color;
      btn.textContent = tag.name;
      btn.addEventListener("click", () => {
        if (selected.has(tag.id)) {
          selected.delete(tag.id);
          btn.classList.remove("on");
          btn.style.background = "var(--panel)";
        } else {
          selected.add(tag.id);
          btn.classList.add("on");
          btn.style.background = tag.color;
        }
      });
      tagSelect.appendChild(btn);
    }
    selected.add(tag.id);
    nameInput.value = "";
    toast("Tag added");
  });

  document.getElementById("btn-save").addEventListener("click", async () => {
    const payload = {
      title: document.getElementById("e-title").value.trim(),
      description: document.getElementById("e-desc").value.trim(),
      tag_ids: Array.from(selected),
      status: document.getElementById("e-status").value,
      author: document.getElementById("e-author").value.trim() || "Anonymous",
    };
    if (!payload.title) {
      toast("A title is required");
      return;
    }
    let result;
    if (editId) {
      result = await api("/api/entries/" + editId, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      result = await api("/api/entries", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    await loadBoard();
    toast(editId ? "Entry updated" : "Entry created");
    window.location.hash = "#entry/" + result.id;
  });
}

/* ----------------------------------------------------------------------- */
/* Stats                                                                   */
/* ----------------------------------------------------------------------- */

let statsState = { filter: "All", allTime: true };

async function renderStats(view) {
  view.innerHTML = '<div class="empty-state"><p class="eyebrow">Loading stats</p></div>';
  let stats;
  try {
    stats = await api("/api/stats");
  } catch (err) {
    view.innerHTML = '<div class="empty-state"><p>Could not load stats.</p></div>';
    return;
  }

  // Countdown and progress, based on the competition date.
  let progressHtml;
  if (stats.competition_date) {
    const now = new Date();
    const target = new Date(stats.competition_date + "T00:00:00");
    const msLeft = target.getTime() - now.getTime();
    const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

    // Progress is time elapsed in a 120 day season window leading to the date.
    const seasonMs = 120 * 24 * 60 * 60 * 1000;
    const start = target.getTime() - seasonMs;
    let pct = ((now.getTime() - start) / seasonMs) * 100;
    pct = Math.max(0, Math.min(100, pct));

    const countdownLabel = daysLeft >= 0
      ? daysLeft + " days remaining"
      : "Competition has passed";

    progressHtml =
      '<div class="progress-shell">' +
      '<div class="eyebrow">Countdown to competition</div>' +
      '<div style="font-family:var(--font-mono);font-size:26px;color:var(--accent-text);margin-top:6px">' +
      esc(countdownLabel) + "</div>" +
      '<div class="progress-track"><div class="progress-fill" style="width:' + pct.toFixed(1) + '%"></div></div>' +
      '<div class="progress-legend"><span>Season start</span><span>' +
      esc(shortDate(stats.competition_date)) + "</span></div></div>";
  } else {
    progressHtml =
      '<div class="progress-shell"><div class="eyebrow">Countdown</div>' +
      '<p style="margin:8px 0 0;color:var(--text-muted)">Complete the calendar to see the countdown.</p></div>';
  }

  view.innerHTML =
    '<div class="view-head"><div><h1>Stats</h1><div class="sub">Board at a glance</div></div></div>' +
    '<div class="stat-grid">' +
    '<div class="stat-tile"><div class="num">' + stats.total + "</div>" +
    '<div class="cap">Total entries</div></div>' +
    '<div class="stat-tile"><div class="num">' + stats.recent_120 + "</div>" +
    '<div class="cap">Added in the last 120 days</div></div>' +
    '<div class="stat-tile"><div class="num">' + stats.by_status.Solved + "</div>" +
    '<div class="cap">Solved</div></div>' +
    "</div>" +
    progressHtml +
    '<div class="view-head" style="margin-top:8px"><div><h2 style="font-family:var(--font-mono);font-size:18px;margin:0">Entries by Category</h2></div></div>' +
    '<div class="cat-controls" id="cat-controls"></div>' +
    '<div id="cat-list"></div>';

  renderCatControls();
  await renderCategories();
}

function renderCatControls() {
  const wrap = document.getElementById("cat-controls");
  const filters = ["All", "Completed", "In Progress"];
  let html = filters.map((f) =>
    '<button class="chip' + (statsState.filter === f ? " active" : "") +
    '" data-filter="' + esc(f) + '">' + esc(f) + "</button>"
  ).join("");
  html += '<span class="meta-sep" style="margin:0 4px">|</span>';
  html += '<button class="chip' + (statsState.allTime ? " active" : "") +
    '" data-scope="all">All time</button>';
  html += '<button class="chip' + (!statsState.allTime ? " active" : "") +
    '" data-scope="season">This season</button>';
  wrap.innerHTML = html;

  wrap.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      statsState.filter = chip.getAttribute("data-filter");
      renderCatControls();
      renderCategories();
    });
  });
  wrap.querySelectorAll("[data-scope]").forEach((chip) => {
    chip.addEventListener("click", () => {
      statsState.allTime = chip.getAttribute("data-scope") === "all";
      renderCatControls();
      renderCategories();
    });
  });
}

async function renderCategories() {
  const list = document.getElementById("cat-list");
  if (!list) return;
  const data = await api(
    "/api/stats/categories?filter=" + encodeURIComponent(statsState.filter) +
    "&alltime=" + (statsState.allTime ? "true" : "false")
  );
  if (!data.categories.length) {
    list.innerHTML = '<div class="empty-state"><p>No entries in this view.</p></div>';
    return;
  }
  list.innerHTML = data.categories.map((c) =>
    '<div class="cat-row"><div class="cat-head">' +
    '<span class="cat-name">' + esc(c.name) + "</span>" +
    '<span class="mono" style="color:var(--text-muted)">' + c.count + " / " + c.percent + "%</span></div>" +
    '<div class="cat-track"><div class="cat-fill" style="width:' + c.percent +
    "%;background:" + esc(c.color) + '"></div></div></div>'
  ).join("");
}

/* ----------------------------------------------------------------------- */
/* Calendar                                                                */
/* ----------------------------------------------------------------------- */

// The month currently shown in the grid. Defaults to the current month.
let calMonth = new Date();
calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth(), 1);
let calData = { competition_date: null, work_days: {} };
let openDayKey = null; // which day popup is open, if any

async function renderCalendar(view) {
  try {
    calData = await api("/api/calendar");
  } catch (err) {
    view.innerHTML = '<div class="empty-state"><p>Could not load the calendar.</p></div>';
    return;
  }

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  view.innerHTML =
    '<div class="view-head"><div><h1>Calendar</h1>' +
    '<div class="sub">Competition date and work days</div></div></div>' +
    '<div class="cal-controls">' +
    '<div class="field" style="margin:0"><label for="comp-date">Competition date</label>' +
    '<input type="date" id="comp-date" value="' + esc(calData.competition_date || "") + '"></div>' +
    '<button class="btn btn-primary" id="save-comp-date">Save date</button>' +
    "</div>" +
    '<div class="cal-quick">' +
    '<button class="btn btn-ghost" id="q-all">Select all days</button>' +
    '<button class="btn btn-ghost" id="q-weekends">Select weekends</button>' +
    '<button class="btn btn-ghost" id="q-none">Unselect all</button>' +
    "</div>" +
    '<div class="cal-controls" style="margin-bottom:10px">' +
    '<button class="btn" id="cal-prev">Prev</button>' +
    '<strong class="mono" id="cal-label" style="min-width:160px;text-align:center"></strong>' +
    '<button class="btn" id="cal-next">Next</button>' +
    '<span class="sub" style="margin-left:auto">Detected zone: ' + esc(detected) + "</span>" +
    "</div>" +
    '<div class="cal-grid" id="cal-grid"></div>';

  // Stash the detected timezone so the day popup can pre-fill it.
  view.dataset.tz = detected;

  document.getElementById("save-comp-date").addEventListener("click", async () => {
    const value = document.getElementById("comp-date").value;
    calData = await api("/api/calendar", {
      method: "POST",
      body: JSON.stringify({ competition_date: value }),
    });
    toast("Competition date saved");
    paintCalGrid(view);
  });

  document.getElementById("cal-prev").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1);
    openDayKey = null;
    paintCalGrid(view);
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1);
    openDayKey = null;
    paintCalGrid(view);
  });

  document.getElementById("q-all").addEventListener("click", () => bulkSelect(view, "all"));
  document.getElementById("q-weekends").addEventListener("click", () => bulkSelect(view, "weekends"));
  document.getElementById("q-none").addEventListener("click", () => bulkSelect(view, "none"));

  paintCalGrid(view);
}

// Format a Date as a YYYY-MM-DD key in local time (not UTC) so day cells match
// what the user actually clicked.
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
}

function paintCalGrid(view) {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-label");
  const monthName = calMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  label.textContent = monthName;

  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0 Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  let html = dow.map((d) => '<div class="cal-dow">' + d + "</div>").join("");

  // Leading blanks for alignment.
  for (let i = 0; i < firstDay; i++) {
    html += '<div class="cal-day empty"></div>';
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dayKey(date);
    const selected = Boolean(calData.work_days[key]) ? " selected" : "";
    const isComp = calData.competition_date === key ? " comp-date" : "";
    html += '<button class="cal-day' + selected + isComp + '" data-key="' + key + '">' + day + "</button>";

    // If this day's popup is open, render it spanning the row right after.
    if (openDayKey === key) {
      html += dayPopupHtml(key, view.dataset.tz);
    }
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".cal-day:not(.empty)").forEach((cell) => {
    cell.addEventListener("click", () => {
      const key = cell.getAttribute("data-key");
      openDayKey = openDayKey === key ? null : key;
      paintCalGrid(view);
    });
  });

  wireDayPopup(view);
}

function dayPopupHtml(key, tz) {
  const detail = calData.work_days[key] || {};
  const isSelected = Boolean(calData.work_days[key]);
  return (
    '<div class="day-popup" data-day="' + key + '">' +
    '<div class="eyebrow" style="margin-bottom:10px">Work day - ' + esc(key) + "</div>" +
    '<div class="row">' +
    '<div class="field" style="margin:0"><label>Duration (minutes)</label>' +
    '<input type="number" id="d-duration" min="0" value="' + esc(detail.duration_minutes || 120) + '"></div>' +
    '<div class="field" style="margin:0"><label>Meeting time</label>' +
    '<input type="time" id="d-time" value="' + esc(detail.meeting_time || "17:00") + '"></div>' +
    "</div>" +
    '<div class="row" style="margin-top:12px">' +
    '<div class="field" style="margin:0"><label>Timezone</label>' +
    '<input type="text" id="d-tz" value="' + esc(detail.timezone || tz || "UTC") + '"></div>' +
    '<div class="field" style="margin:0"><label>Location (optional)</label>' +
    '<input type="text" id="d-location" value="' + esc(detail.location || "") + '" placeholder="Build room"></div>' +
    "</div>" +
    '<div style="display:flex;gap:8px;margin-top:14px">' +
    '<button class="btn btn-primary" id="d-save">' + (isSelected ? "Update day" : "Add work day") + "</button>" +
    (isSelected ? '<button class="btn btn-danger" id="d-remove">Remove day</button>' : "") +
    '<button class="btn btn-ghost" id="d-close">Close</button>' +
    "</div></div>"
  );
}

function wireDayPopup(view) {
  const popup = document.querySelector(".day-popup");
  if (!popup) return;
  const key = popup.getAttribute("data-day");

  document.getElementById("d-close").addEventListener("click", () => {
    openDayKey = null;
    paintCalGrid(view);
  });

  document.getElementById("d-save").addEventListener("click", async () => {
    const detail = {
      duration_minutes: parseInt(document.getElementById("d-duration").value, 10) || 0,
      meeting_time: document.getElementById("d-time").value,
      timezone: document.getElementById("d-tz").value.trim() || "UTC",
    };
    const location = document.getElementById("d-location").value.trim();
    if (location) detail.location = location;

    const workDays = Object.assign({}, calData.work_days);
    workDays[key] = detail;
    calData = await api("/api/calendar", {
      method: "POST",
      body: JSON.stringify({ work_days: workDays }),
    });
    toast("Work day saved");
    openDayKey = null;
    paintCalGrid(view);
  });

  const removeBtn = document.getElementById("d-remove");
  if (removeBtn) {
    removeBtn.addEventListener("click", async () => {
      const workDays = Object.assign({}, calData.work_days);
      delete workDays[key];
      calData = await api("/api/calendar", {
        method: "POST",
        body: JSON.stringify({ work_days: workDays }),
      });
      toast("Work day removed");
      openDayKey = null;
      paintCalGrid(view);
    });
  }
}

// Quick-select helpers operate on the visible month for clarity.
async function bulkSelect(view, kind) {
  const year = calMonth.getFullYear();
  const month = calMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const workDays = Object.assign({}, calData.work_days);
  const tz = view.dataset.tz || "UTC";
  const defaultDetail = { duration_minutes: 120, meeting_time: "17:00", timezone: tz };

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const key = dayKey(date);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (kind === "all") {
      if (!workDays[key]) workDays[key] = Object.assign({}, defaultDetail);
    } else if (kind === "weekends") {
      if (isWeekend && !workDays[key]) workDays[key] = Object.assign({}, defaultDetail);
    } else if (kind === "none") {
      delete workDays[key];
    }
  }

  calData = await api("/api/calendar", {
    method: "POST",
    body: JSON.stringify({ work_days: workDays }),
  });
  openDayKey = null;
  paintCalGrid(view);
}

/* ----------------------------------------------------------------------- */
/* Solve animation                                                         */
/* ----------------------------------------------------------------------- */

// A one-shot full-screen green checkmark. The SVG draws a ring plus a tick via
// the keyframes in style.css, then the overlay removes itself.
function playSolveAnimation() {
  const burst = document.createElement("div");
  burst.className = "solve-burst";
  burst.innerHTML =
    '<svg viewBox="0 0 100 100">' +
    '<circle class="ring" cx="50" cy="50" r="40"></circle>' +
    '<path class="tick" d="M30 52 L45 66 L72 36"></path>' +
    "</svg>";
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
  toast("Marked solved");
}

/* ======================================================================= */
/* SHARE PAGE (read only)                                                  */
/* ======================================================================= */

async function initShare() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const view = document.getElementById("share-view");
  const meta = document.getElementById("share-meta");

  if (!token) {
    view.innerHTML = '<div class="empty-state"><p>No share token in the link.</p></div>';
    return;
  }

  let data;
  try {
    const response = await fetch(API_BASE + "/api/share/" + encodeURIComponent(token));
    if (!response.ok) throw new Error("not found");
    data = await response.json();
  } catch (err) {
    view.innerHTML =
      '<div class="empty-state"><p class="eyebrow">Link not found</p>' +
      "<p>This share link is invalid or has been revoked.</p></div>";
    return;
  }

  document.title = data.full_name + " - Shared Board";
  meta.innerHTML =
    '<span class="read-only">Read only</span>' +
    '<h1 style="font-family:var(--font-mono);font-size:24px;margin:4px 0 2px">' + esc(data.full_name) + "</h1>" +
    '<div class="sub mono" style="color:var(--text-muted)">' + esc(data.board_title) + "</div>";

  // Build a tag lookup from the shared payload (the cache is not populated on
  // this page since there is no auth session).
  const tags = {};
  (data.tags || []).forEach((t) => { tags[t.id] = t; });

  if (!data.entries.length) {
    view.innerHTML = '<div class="empty-state"><p>This board has no entries yet.</p></div>';
    return;
  }

  view.innerHTML = '<div class="feed">' +
    data.entries.map((e) => shareCard(e, tags)).join("") + "</div>";
}

// A read-only entry card: same shape as the feed card but with no controls and
// the full description shown.
function shareCard(entry, tags) {
  const primaryTag = (entry.tag_ids || []).map((id) => tags[id]).find(Boolean);
  const rail = primaryTag ? primaryTag.color : "var(--accent)";
  const tagHtml = (entry.tag_ids || []).map((id) => tagPill(tags[id])).join("");
  const pin = entry.pinned ? '<span class="pin-flag">Pinned</span>' : "";
  const comments = (entry.comments || []).length
    ? '<div class="entry-meta" style="margin-top:8px"><span>' +
      (entry.comments || []).length + " comment(s)</span></div>"
    : "";

  return (
    '<article class="entry-card" style="--rail:' + esc(rail) + '">' +
    '<div class="card-top"><h3 style="cursor:default">' + esc(entry.title) + "</h3>" + pin + "</div>" +
    '<p class="desc" style="-webkit-line-clamp:unset;display:block">' + esc(entry.description) + "</p>" +
    '<div class="entry-meta">' + tagHtml +
    '<span class="status-pill ' + statusClass(entry.status) + '">' + esc(entry.status) + "</span>" +
    '<span class="meta-sep">/</span><span>' + esc(entry.author) + "</span>" +
    '<span class="meta-sep">/</span><span>' + esc(shortDate(entry.created_at)) + "</span></div>" +
    comments +
    "</article>"
  );
}

/* ======================================================================= */
/* Boot                                                                    */
/* ======================================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  const page = document.body.dataset.page;
  if (page === "landing") {
    initLanding();
  } else if (page === "app") {
    initApp();
  } else if (page === "share") {
    initShare();
  }
});
