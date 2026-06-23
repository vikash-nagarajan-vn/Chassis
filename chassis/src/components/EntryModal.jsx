// EntryModal.jsx — create or edit a knowledge entry.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { Modal, Button, Field, inputClass, TagChip } from './ui'

const blank = {
  title: '',
  description: '',
  tagId: null,
  status: 'in_progress',
  author: '',
  contactEmail: '',
}

export default function EntryModal({ open, onClose, existing }) {
  const { tags, createEntry, editEntry } = useData()
  const [form, setForm] = useState(existing || blank)
  const [showContact, setShowContact] = useState(!!existing?.contactEmail)

  // Re-sync the form when a different entry is opened for editing.
  const [lastId, setLastId] = useState(existing?.id)
  if ((existing?.id || null) !== lastId) {
    setLastId(existing?.id || null)
    setForm(existing || blank)
    setShowContact(!!existing?.contactEmail)
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }))

  const save = () => {
    if (!form.title.trim()) return
    const payload = { ...form, contactEmail: showContact ? form.contactEmail : '' }
    if (existing) editEntry(existing.id, payload)
    else createEntry(payload)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit entry' : 'Log a new entry'}
      subtitle="Capture the problem and what you learned while it's fresh."
    >
      <div className="space-y-5">
        <Field label="Title">
          <input
            className={inputClass}
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="e.g. Gearbox slipping under load"
            autoFocus
          />
        </Field>

        <Field label="What happened / what you learned" hint="the useful part for next year">
          <textarea
            className={`${inputClass} min-h-[120px] resize-y`}
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Symptoms, root cause, the fix, and anything the next person should know."
          />
        </Field>

        <Field label="Category">
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <TagChip
                key={t.id}
                tag={t}
                active={form.tagId === t.id}
                onClick={() => set({ tagId: form.tagId === t.id ? null : t.id })}
              />
            ))}
            {tags.length === 0 && (
              <span className="text-sm text-muted">Add tags from the Tags page first.</span>
            )}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <div className="flex rounded-lg border border-hairline overflow-hidden">
              {[
                ['in_progress', 'In progress'],
                ['solved', 'Solved'],
              ].map(([val, label]) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => set({ status: val })}
                  className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                    form.status === val ? 'bg-ink text-white' : 'bg-surface text-muted hover:bg-black/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Author">
            <input
              className={inputClass}
              value={form.author}
              onChange={(e) => set({ author: e.target.value })}
              placeholder="your name / handle"
            />
          </Field>
        </div>

        {/* Opt-in contact — privacy-conscious because users may be minors. */}
        <div className="rounded-lg border border-hairline p-3">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showContact}
              onChange={(e) => setShowContact(e.target.checked)}
              className="h-4 w-4 accent-rail"
            />
            <span className="font-medium">Let teammates contact me about this entry</span>
          </label>
          {showContact && (
            <div className="mt-3">
              <input
                className={inputClass}
                value={form.contactEmail}
                onChange={(e) => set({ contactEmail: e.target.value })}
                placeholder="email (optional)"
              />
              <p className="mt-1.5 text-xs text-muted">
                Only visible to logged-in members of your team. Leave unchecked to stay private.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!form.title.trim()}>
            {existing ? 'Save changes' : 'Add entry'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
