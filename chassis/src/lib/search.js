// search.js
// -----------------------------------------------------------------------------
// Forgiving keyword search powered by Fuse.js.
//
// Why fuzzy? Robotics knowledge gets logged fast and messy. Someone searching
// "gearbx" should still find the "Gearbox slipping under load" entry. Fuse does
// approximate matching and scores each result by how close it is, so near-misses
// and typos still surface. We run it on the client because a single team's board
// is small (hundreds of entries, not millions) — no search server needed.
// -----------------------------------------------------------------------------

import Fuse from 'fuse.js'

const OPTIONS = {
  // Lower threshold = stricter. 0.0 is exact, 1.0 matches anything.
  threshold: 0.4,
  ignoreLocation: true, // match anywhere in the field, not just the start
  includeScore: true,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 0.5 },
    { name: 'description', weight: 0.3 },
    { name: 'tagName', weight: 0.15 },
    { name: 'author', weight: 0.05 },
  ],
}

// `entries` are already enriched with `tagName` by the caller so tags are
// searchable by their human label rather than an internal id.
export function searchEntries(entries, query) {
  const q = query.trim()
  if (!q) return entries
  const fuse = new Fuse(entries, OPTIONS)
  return fuse.search(q).map((r) => r.item)
}
