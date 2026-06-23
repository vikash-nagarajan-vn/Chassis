// EntryDetail.jsx — full entry view: description, linked entries, comments,
// opt-in contact, and per-entry actions (pin, status, edit, delete, export).
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { exportEntriesToPdf } from '../lib/pdf'
import { useAuth } from '../context/AuthContext'
import {
  Modal,
  Button,
  TagChip,
  StatusPill,
  inputClass,
  timeAgo,
} from './ui'
import {
  Pin,
  Pencil,
  Trash2,
  FileDown,
  Mail,
  CornerDownRight,
  Link2,
} from 'lucide-react'

export default function EntryDetail({ entry, onClose, onEdit, onOpenEntry }) {
  const { tags, tagById, entries, togglePin, toggleStatus, removeEntry, comment, linkEntries } =
    useData()
  const { team } = useAuth()
  const [commentText, setCommentText] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [linking, setLinking] = useState(false)

  if (!entry) return null
  const tag = entry.tagId ? tagById[entry.tagId] : null
  const linked = (entry.linkedIds || []).map((id) => entries.find((e) => e.id === id)).filter(Boolean)
  const linkable = entries.filter((e) => e.id !== entry.id)

  const submitComment = () => {
    if (!commentText.trim()) return
    comment(entry.id, { author: commentAuthor.trim() || 'anonymous', text: commentText.trim() })
    setCommentText('')
  }

  const toggleLink = (id) => {
    const set = new Set(entry.linkedIds || [])
    set.has(id) ? set.delete(id) : set.add(id)
    linkEntries(entry.id, [...set])
  }

  const exportOne = () => {
    exportEntriesToPdf({
      teamName: team.name,
      entries: [entry],
      tags,
      title: entry.title,
    })
  }

  const del = () => {
    if (confirm('Delete this entry? This cannot be undone.')) {
      removeEntry(entry.id)
      onClose()
    }
  }

  return (
    <Modal open={!!entry} onClose={onClose} title={entry.title} width="max-w-2xl">
      <div className="space-y-6">
        {/* meta row */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={entry.status} />
          {tag && <TagChip tag={tag} size="sm" />}
          <span className="font-mono text-xs text-muted">
            {entry.author ? `@${entry.author} · ` : ''}
            {timeAgo(entry.createdAt)}
          </span>
        </div>

        {/* actions */}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => togglePin(entry.id)}>
            <Pin size={14} fill={entry.pinned ? 'currentColor' : 'none'} />
            {entry.pinned ? 'Pinned' : 'Pin'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => toggleStatus(entry.id)}>
            Mark {entry.status === 'solved' ? 'in progress' : 'solved'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onEdit(entry)}>
            <Pencil size={14} /> Edit
          </Button>
          <Button size="sm" variant="outline" onClick={exportOne}>
            <FileDown size={14} /> Export PDF
          </Button>
          <Button size="sm" variant="danger" onClick={del} className="ml-auto">
            <Trash2 size={14} /> Delete
          </Button>
        </div>

        {/* description */}
        <div className="rounded-xl bg-paper/60 border border-hairline p-4">
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">
            {entry.description || 'No description yet.'}
          </p>
        </div>

        {/* opt-in contact */}
        {entry.contactEmail && (
          <div className="flex items-center gap-2 rounded-lg bg-rail-tint px-3 py-2 text-sm">
            <Mail size={15} className="text-rail" />
            <span className="text-muted">Follow up with the author:</span>
            <a href={`mailto:${entry.contactEmail}`} className="font-medium text-rail hover:underline">
              {entry.contactEmail}
            </a>
          </div>
        )}

        {/* linked entries */}
        <section>
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 font-display font-semibold">
              <Link2 size={16} /> Related entries
            </h4>
            <Button size="sm" variant="ghost" onClick={() => setLinking((v) => !v)}>
              {linking ? 'Done' : 'Link entries'}
            </Button>
          </div>

          {linking && (
            <div className="mt-3 max-h-44 overflow-y-auto scroll-slim rounded-lg border border-hairline divide-y divide-hairline">
              {linkable.map((e) => {
                const on = (entry.linkedIds || []).includes(e.id)
                return (
                  <label
                    key={e.id}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-black/5"
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggleLink(e.id)}
                      className="h-4 w-4 accent-rail"
                    />
                    <span className="truncate">{e.title}</span>
                  </label>
                )
              })}
              {linkable.length === 0 && (
                <p className="px-3 py-3 text-sm text-muted">No other entries to link yet.</p>
              )}
            </div>
          )}

          {!linking && (
            <div className="mt-3 space-y-2">
              {linked.length === 0 && (
                <p className="text-sm text-muted">Nothing linked yet.</p>
              )}
              {linked.map((e) => (
                <button
                  key={e.id}
                  onClick={() => onOpenEntry(e)}
                  className="flex w-full items-center gap-2 rounded-lg border border-hairline px-3 py-2 text-left text-sm hover:bg-black/5"
                >
                  <CornerDownRight size={14} className="text-muted" />
                  <span className="truncate">{e.title}</span>
                  <StatusPill status={e.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* comments / corrections */}
        <section>
          <h4 className="font-display font-semibold">
            Notes &amp; corrections{' '}
            <span className="font-mono text-xs text-muted">({entry.comments?.length || 0})</span>
          </h4>
          <p className="text-xs text-muted">
            Knowledge gets better over time — add what changed or what you'd do differently.
          </p>

          <div className="mt-3 space-y-2">
            {(entry.comments || []).map((c) => (
              <div key={c.id} className="rounded-lg bg-paper/60 border border-hairline px-3 py-2">
                <p className="text-sm text-ink">{c.text}</p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {c.author} · {timeAgo(c.createdAt)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
            <input
              className={inputClass}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a note or correction…"
              onKeyDown={(e) => e.key === 'Enter' && submitComment()}
            />
            <div className="flex gap-2">
              <input
                className={`${inputClass} w-28`}
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                placeholder="you"
              />
              <Button onClick={submitComment} disabled={!commentText.trim()}>
                Post
              </Button>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  )
}
