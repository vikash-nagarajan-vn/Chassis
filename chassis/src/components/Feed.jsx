// Feed.jsx — the live feed: search, filters, pinned entries, and the list.
import { useMemo, useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { searchEntries } from '../lib/search'
import { exportEntriesToPdf } from '../lib/pdf'
import EntryCard from './EntryCard'
import { TagChip, Button, EmptyState } from './ui'
import { Search, FileDown, Pin, Inbox, X } from 'lucide-react'

export default function Feed({ onOpenEntry, onNewEntry }) {
  const { entries, tags, tagById, togglePin } = useData()
  const { team } = useAuth()
  const [query, setQuery] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [status, setStatus] = useState('all') // all | in_progress | solved

  // Enrich with tagName so search can match the tag's label, then filter, then search.
  const visible = useMemo(() => {
    let list = entries.map((e) => ({ ...e, tagName: e.tagId ? tagById[e.tagId]?.name || '' : '' }))
    if (activeTag) list = list.filter((e) => e.tagId === activeTag)
    if (status !== 'all') list = list.filter((e) => e.status === status)
    list = searchEntries(list, query)
    return list
  }, [entries, tagById, activeTag, status, query])

  // Pinned float to the top (only when not actively searching/filtering).
  const isFiltering = query.trim() || activeTag || status !== 'all'
  const pinned = visible.filter((e) => e.pinned)
  const rest = visible.filter((e) => !e.pinned)

  const exportBoardPdf = () => {
    exportEntriesToPdf({
      teamName: team.name,
      entries: visible,
      tags,
      title: isFiltering ? 'Filtered entries' : 'Full knowledge log',
    })
  }

  const clearFilters = () => {
    setQuery('')
    setActiveTag(null)
    setStatus('all')
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* search */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search entries — typos are fine (try “gearbx”)"
          className="w-full rounded-xl border border-hairline bg-surface py-3 pl-11 pr-10 text-[15px] shadow-card focus:border-rail"
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            aria-label="Clear search"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* filter row */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-hairline bg-surface p-0.5 text-sm">
          {[
            ['all', 'All'],
            ['in_progress', 'In progress'],
            ['solved', 'Solved'],
          ].map(([val, label]) => (
            <button
              key={val}
              onClick={() => setStatus(val)}
              className={`rounded-md px-3 py-1.5 font-medium transition-colors ${
                status === val ? 'bg-ink text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-hairline" />

        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => (
            <TagChip
              key={t.id}
              tag={t}
              active={activeTag === t.id}
              onClick={() => setActiveTag(activeTag === t.id ? null : t.id)}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {isFiltering && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear
            </Button>
          )}
          {visible.length > 0 && (
            <Button variant="outline" size="sm" onClick={exportBoardPdf}>
              <FileDown size={14} /> Export PDF
            </Button>
          )}
        </div>
      </div>

      {/* results */}
      <div className="mt-6">
        {visible.length === 0 ? (
          entries.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Your board is empty"
              action={<Button onClick={onNewEntry}>Log your first entry</Button>}
            >
              Start capturing the problems you solve. Future teammates will thank you.
            </EmptyState>
          ) : (
            <EmptyState icon={Search} title="No matches">
              Nothing fits that search or filter. Try fewer words or clear the filters.
            </EmptyState>
          )
        ) : (
          <div className="space-y-6">
            {!isFiltering && pinned.length > 0 && (
              <section>
                <h3 className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wide text-muted">
                  <Pin size={12} /> Pinned
                </h3>
                <div className="space-y-3">
                  {pinned.map((e) => (
                    <EntryCard
                      key={e.id}
                      entry={e}
                      tag={e.tagId ? tagById[e.tagId] : null}
                      onOpen={() => onOpenEntry(e)}
                      onTogglePin={() => togglePin(e.id)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section>
              {!isFiltering && pinned.length > 0 && (
                <h3 className="mb-2 font-mono text-xs uppercase tracking-wide text-muted">
                  All entries
                </h3>
              )}
              <div className="space-y-3">
                {(isFiltering ? visible : rest).map((e) => (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    tag={e.tagId ? tagById[e.tagId] : null}
                    onOpen={() => onOpenEntry(e)}
                    onTogglePin={() => togglePin(e.id)}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
