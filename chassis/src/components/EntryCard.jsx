// EntryCard.jsx — one entry in the feed. The colored left "rail" is the
// signature element: it's the entry's tag color, like a labeled bin in the shop.
import { Pin, MessageSquare, Link2 } from 'lucide-react'
import { TagChip, StatusPill, timeAgo, IconButton } from './ui'

export default function EntryCard({ entry, tag, onOpen, onTogglePin }) {
  const railColor = tag ? tag.color : '#CBD2D9'
  return (
    <article
      onClick={onOpen}
      className="group relative cursor-pointer rounded-xl bg-surface shadow-card hover:shadow-lift transition-shadow border border-hairline/60 overflow-hidden"
    >
      {/* signature tag rail */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: railColor }} />

      <div className="pl-5 pr-3 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {entry.pinned && (
                <Pin size={13} className="shrink-0 text-rail" fill="currentColor" />
              )}
              <h3 className="font-display font-semibold text-ink leading-snug truncate">
                {entry.title}
              </h3>
            </div>
            <p className="mt-1 text-sm text-muted line-clamp-2 leading-relaxed">
              {entry.description || 'No description yet.'}
            </p>
          </div>
          <IconButton
            label={entry.pinned ? 'Unpin' : 'Pin'}
            onClick={(e) => {
              e.stopPropagation()
              onTogglePin()
            }}
            className={`opacity-0 group-hover:opacity-100 ${entry.pinned ? 'opacity-100 text-rail' : ''}`}
          >
            <Pin size={15} fill={entry.pinned ? 'currentColor' : 'none'} />
          </IconButton>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusPill status={entry.status} />
          {tag && <TagChip tag={tag} size="sm" />}
          <span className="ml-auto flex items-center gap-3 font-mono text-[11px] text-muted">
            {entry.linkedIds?.length > 0 && (
              <span className="flex items-center gap-1">
                <Link2 size={12} /> {entry.linkedIds.length}
              </span>
            )}
            {entry.comments?.length > 0 && (
              <span className="flex items-center gap-1">
                <MessageSquare size={12} /> {entry.comments.length}
              </span>
            )}
            {entry.author && <span>@{entry.author}</span>}
            <span>{timeAgo(entry.createdAt)}</span>
          </span>
        </div>
      </div>
    </article>
  )
}
