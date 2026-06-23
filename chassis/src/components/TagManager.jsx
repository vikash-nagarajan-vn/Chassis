// TagManager.jsx — view, add, recolor, rename, and delete category tags.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Button, inputClass, EmptyState } from './ui'
import { Tags, Trash2, Plus } from 'lucide-react'

const SWATCHES = [
  '#3B6EA5', '#E0A800', '#1F9D79', '#7C5CBF',
  '#E8541E', '#D6336C', '#0CA5B0', '#7048E8',
  '#5C940D', '#495057',
]

export default function TagManager() {
  const { tags, entries, createTag, editTag, removeTag } = useData()
  const [name, setName] = useState('')
  const [color, setColor] = useState(SWATCHES[4])

  const counts = entries.reduce((acc, e) => {
    if (e.tagId) acc[e.tagId] = (acc[e.tagId] || 0) + 1
    return acc
  }, {})

  const add = () => {
    if (!name.trim()) return
    createTag({ name: name.trim(), color })
    setName('')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h2 className="font-display text-2xl font-semibold">Tags</h2>
        <p className="text-sm text-muted">
          Color-code entries by category. Start with the defaults or make your own.
        </p>
      </header>

      {/* create */}
      <div className="rounded-xl border border-hairline bg-surface p-4 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="text-sm font-medium">New tag</label>
            <input
              className={`${inputClass} mt-1.5`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Pneumatics"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </div>
          <Button onClick={add} disabled={!name.trim()} size="lg">
            <Plus size={16} /> Add
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              aria-label={`Use color ${c}`}
              style={{ backgroundColor: c }}
              className={`h-7 w-7 rounded-full transition-transform ${
                color === c ? 'ring-2 ring-offset-2 ring-ink scale-110' : 'hover:scale-105'
              }`}
            />
          ))}
        </div>
      </div>

      {/* list */}
      <div className="mt-6 space-y-2">
        {tags.length === 0 && (
          <EmptyState icon={Tags} title="No tags yet">
            Add your first category above to start color-coding entries.
          </EmptyState>
        )}
        {tags.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 shadow-card"
          >
            <input
              type="color"
              value={t.color}
              onChange={(e) => editTag(t.id, { color: e.target.value })}
              className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-hairline bg-transparent p-0"
              aria-label={`Color for ${t.name}`}
            />
            <input
              value={t.name}
              onChange={(e) => editTag(t.id, { name: e.target.value })}
              className="flex-1 bg-transparent font-display font-medium focus:outline-none"
            />
            <span className="font-mono text-xs text-muted">
              {counts[t.id] || 0} {counts[t.id] === 1 ? 'entry' : 'entries'}
            </span>
            <button
              onClick={() => {
                if (confirm(`Delete "${t.name}"? Entries using it will become untagged.`))
                  removeTag(t.id)
              }}
              className="grid h-8 w-8 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600"
              aria-label={`Delete ${t.name}`}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
