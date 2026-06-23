// storage.js
// -----------------------------------------------------------------------------
// The data layer for the Chassis prototype.
//
// Everything persists to the browser's localStorage so the app runs with ZERO
// backend setup — you can clone, `npm install`, `npm run dev`, and immediately
// see a working board. Each function below is the seam where a real backend
// would slot in: in production you'd swap these bodies for calls to something
// like Supabase (Postgres + Auth + row-level security) and keep the same
// function signatures, so the UI code wouldn't have to change.
// -----------------------------------------------------------------------------

const KEYS = {
  teams: 'chassis.teams',
  session: 'chassis.session',
  entries: (teamId) => `chassis.entries.${teamId}`,
  tags: (teamId) => `chassis.tags.${teamId}`,
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// Small id helper. Good enough for a prototype; a real DB issues its own ids.
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

// --- Teams & session (mock auth) ---------------------------------------------
// NOTE: This is intentionally simple, NOT secure. Passwords live in
// localStorage in plain text purely so the prototype can demonstrate the
// "team accounts, private by default" concept. A real build would use a proper
// auth provider and never store a password on the client.

export function getTeams() {
  return read(KEYS.teams, [])
}

export function createTeam({ name, password }) {
  const teams = getTeams()
  if (teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('A team with that name already exists on this device.')
  }
  const team = { id: uid('team'), name, password, createdAt: new Date().toISOString() }
  teams.push(team)
  write(KEYS.teams, teams)
  return team
}

export function authenticate({ name, password }) {
  const team = getTeams().find((t) => t.name.toLowerCase() === name.toLowerCase())
  if (!team || team.password !== password) {
    throw new Error('Team name or password is incorrect.')
  }
  return team
}

export function getSession() {
  const teamId = read(KEYS.session, null)
  if (!teamId) return null
  return getTeams().find((t) => t.id === teamId) || null
}

export function setSession(teamId) {
  write(KEYS.session, teamId)
}

export function clearSession() {
  localStorage.removeItem(KEYS.session)
}

// --- Tags --------------------------------------------------------------------

const DEFAULT_TAGS = [
  { name: 'Mechanical', color: '#3B6EA5' },
  { name: 'Electrical', color: '#E0A800' },
  { name: 'Code', color: '#1F9D79' },
  { name: 'Strategy', color: '#7C5CBF' },
]

export function getTags(teamId) {
  return read(KEYS.tags(teamId), [])
}

export function saveTags(teamId, tags) {
  write(KEYS.tags(teamId), tags)
}

export function ensureDefaultTags(teamId) {
  let tags = getTags(teamId)
  if (tags.length === 0) {
    tags = DEFAULT_TAGS.map((t) => ({ id: uid('tag'), ...t }))
    saveTags(teamId, tags)
  }
  return tags
}

export function addTag(teamId, { name, color }) {
  const tags = getTags(teamId)
  const tag = { id: uid('tag'), name, color }
  tags.push(tag)
  saveTags(teamId, tags)
  return tag
}

export function updateTag(teamId, id, patch) {
  const tags = getTags(teamId).map((t) => (t.id === id ? { ...t, ...patch } : t))
  saveTags(teamId, tags)
  return tags
}

export function deleteTag(teamId, id) {
  saveTags(teamId, getTags(teamId).filter((t) => t.id !== id))
}

// --- Entries -----------------------------------------------------------------

export function getEntries(teamId) {
  return read(KEYS.entries(teamId), [])
}

export function saveEntries(teamId, entries) {
  write(KEYS.entries(teamId), entries)
}

export function addEntry(teamId, data) {
  const entries = getEntries(teamId)
  const now = new Date().toISOString()
  const entry = {
    id: uid('entry'),
    title: '',
    description: '',
    tagId: null,
    status: 'in_progress', // 'in_progress' | 'solved'
    author: '',
    contactEmail: '', // opt-in; only shown to logged-in team members
    pinned: false,
    linkedIds: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
    ...data,
  }
  entries.unshift(entry)
  saveEntries(teamId, entries)
  return entry
}

export function updateEntry(teamId, id, patch) {
  const entries = getEntries(teamId).map((e) =>
    e.id === id ? { ...e, ...patch, updatedAt: new Date().toISOString() } : e
  )
  saveEntries(teamId, entries)
  return entries.find((e) => e.id === id)
}

export function deleteEntry(teamId, id) {
  // Also remove this entry from any other entry's linked list.
  const entries = getEntries(teamId)
    .filter((e) => e.id !== id)
    .map((e) => ({ ...e, linkedIds: (e.linkedIds || []).filter((l) => l !== id) }))
  saveEntries(teamId, entries)
}

export function addComment(teamId, entryId, { author, text }) {
  const comment = { id: uid('cmt'), author, text, createdAt: new Date().toISOString() }
  const entry = getEntries(teamId).find((e) => e.id === entryId)
  const comments = [...(entry?.comments || []), comment]
  updateEntry(teamId, entryId, { comments })
  return comment
}

// --- Share / fork ------------------------------------------------------------
// A real product would share via the backend with row-level security. In this
// serverless prototype, "sharing" is export/import of a board snapshot: a team
// exports its board, hands the snapshot to another team, and that team forks it
// into their own space as an independent copy.

export function exportBoard(team) {
  return {
    format: 'chassis.board.v1',
    sharedFrom: team.name,
    sharedAt: new Date().toISOString(),
    tags: getTags(team.id),
    entries: getEntries(team.id),
  }
}

export function forkBoard(targetTeamId, snapshot) {
  if (!snapshot || snapshot.format !== 'chassis.board.v1') {
    throw new Error('That doesn\'t look like a Chassis board export.')
  }
  // Remap tag ids so the forked copy is fully independent.
  const tagIdMap = {}
  const newTags = (snapshot.tags || []).map((t) => {
    const id = uid('tag')
    tagIdMap[t.id] = id
    return { ...t, id }
  })
  const existing = getTags(targetTeamId)
  saveTags(targetTeamId, [...existing, ...newTags])

  const existingEntries = getEntries(targetTeamId)
  const newEntries = (snapshot.entries || []).map((e) => ({
    ...e,
    id: uid('entry'),
    tagId: e.tagId ? tagIdMap[e.tagId] || null : null,
    linkedIds: [], // links don't survive a fork cleanly; start fresh
    pinned: false,
    forkedFrom: snapshot.sharedFrom,
  }))
  saveEntries(targetTeamId, [...newEntries, ...existingEntries])
  return { tags: newTags.length, entries: newEntries.length }
}
