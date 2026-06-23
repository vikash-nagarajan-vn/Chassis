// DataContext.jsx
// Holds the current team's board (entries + tags) in React state and keeps it
// in sync with the storage layer. Every mutation updates both state (so the UI
// re-renders) and localStorage (so it persists). Centralizing it here keeps the
// components clean and means there's one obvious place to swap in a real backend.

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import * as db from '../lib/storage'

const DataContext = createContext(null)

export function DataProvider({ children }) {
  const { team } = useAuth()
  const [entries, setEntries] = useState([])
  const [tags, setTags] = useState([])

  // Load (and re-load) whenever the active team changes.
  useEffect(() => {
    if (!team) {
      setEntries([])
      setTags([])
      return
    }
    db.ensureDefaultTags(team.id)
    setEntries(db.getEntries(team.id))
    setTags(db.getTags(team.id))
  }, [team])

  const refresh = () => {
    if (!team) return
    setEntries(db.getEntries(team.id))
    setTags(db.getTags(team.id))
  }

  // --- entry operations ---
  const createEntry = (data) => {
    db.addEntry(team.id, data)
    refresh()
  }
  const editEntry = (id, patch) => {
    db.updateEntry(team.id, id, patch)
    refresh()
  }
  const removeEntry = (id) => {
    db.deleteEntry(team.id, id)
    refresh()
  }
  const togglePin = (id) => {
    const e = entries.find((x) => x.id === id)
    if (e) editEntry(id, { pinned: !e.pinned })
  }
  const toggleStatus = (id) => {
    const e = entries.find((x) => x.id === id)
    if (e) editEntry(id, { status: e.status === 'solved' ? 'in_progress' : 'solved' })
  }
  const comment = (entryId, payload) => {
    db.addComment(team.id, entryId, payload)
    refresh()
  }
  const linkEntries = (id, linkedIds) => editEntry(id, { linkedIds })

  // --- tag operations ---
  const createTag = (payload) => {
    db.addTag(team.id, payload)
    refresh()
  }
  const editTag = (id, patch) => {
    db.updateTag(team.id, id, patch)
    refresh()
  }
  const removeTag = (id) => {
    // Untag any entries that used it, then delete the tag.
    entries.filter((e) => e.tagId === id).forEach((e) => db.updateEntry(team.id, e.id, { tagId: null }))
    db.deleteTag(team.id, id)
    refresh()
  }

  // --- share / fork ---
  const exportBoard = () => db.exportBoard(team)
  const forkBoard = (snapshot) => {
    const result = db.forkBoard(team.id, snapshot)
    refresh()
    return result
  }

  const tagById = useMemo(() => {
    const m = {}
    for (const t of tags) m[t.id] = t
    return m
  }, [tags])

  const value = {
    entries,
    tags,
    tagById,
    refresh,
    createEntry,
    editEntry,
    removeEntry,
    togglePin,
    toggleStatus,
    comment,
    linkEntries,
    createTag,
    editTag,
    removeTag,
    exportBoard,
    forkBoard,
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
