// ui.jsx — small, reusable presentation primitives.
import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Button({ variant = 'primary', size = 'md', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'text-sm px-3 py-1.5',
    md: 'text-sm px-4 py-2',
    lg: 'text-base px-5 py-2.5',
  }
  const variants = {
    primary: 'bg-rail text-white hover:bg-rail-dark',
    ghost: 'text-ink hover:bg-black/5',
    outline: 'border border-hairline text-ink hover:bg-black/5 bg-surface',
    subtle: 'bg-black/5 text-ink hover:bg-black/10',
    danger: 'text-red-600 hover:bg-red-50',
  }
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
}

export function IconButton({ className = '', label, ...props }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-ink transition-colors ${className}`}
      {...props}
    />
  )
}

export function Modal({ open, onClose, title, subtitle, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={`relative z-10 w-full ${width} bg-surface rounded-t-2xl sm:rounded-2xl shadow-lift max-h-[92vh] overflow-y-auto scroll-slim`}
      >
        <div className="sticky top-0 bg-surface/95 backdrop-blur border-b border-hairline px-5 py-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="text-sm text-muted mt-0.5">{subtitle}</p>}
          </div>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  )
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-ink">{label}</span>
        {hint && <span className="text-xs text-muted">{hint}</span>}
      </div>
      <div className="mt-1.5">{children}</div>
    </label>
  )
}

export const inputClass =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm placeholder:text-muted/70 focus:border-rail'

export function TagChip({ tag, active, onClick, size = 'md' }) {
  if (!tag) return null
  const pad = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1'
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        backgroundColor: active ? tag.color : `${tag.color}1A`,
        color: active ? '#fff' : tag.color,
        borderColor: `${tag.color}40`,
      }}
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono font-medium ${pad} ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      }`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: active ? '#fff' : tag.color }}
      />
      {tag.name}
    </button>
  )
}

export function StatusPill({ status }) {
  const solved = status === 'solved'
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-mono font-medium ${
        solved ? 'bg-solved/10 text-solved' : 'bg-progress/10 text-progress'
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${solved ? 'bg-solved' : 'bg-progress'}`} />
      {solved ? 'Solved' : 'In progress'}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {Icon && (
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-black/5 text-muted">
          <Icon size={24} />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
