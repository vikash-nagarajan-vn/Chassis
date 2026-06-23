// Stats.jsx — a lightweight season dashboard. Great demo-video visuals and a
// real "is our knowledge growing?" signal for the team.
import { useMemo } from 'react'
import { useData } from '../context/DataContext'
import { EmptyState } from './ui'
import { BarChart3, CheckCircle2, Loader, Tag as TagIcon, FileText } from 'lucide-react'

function Stat({ icon: Icon, label, value, sub }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 shadow-card">
      <div className="flex items-center gap-2 text-muted">
        <Icon size={16} />
        <span className="font-mono text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tabular">{value}</p>
      {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
    </div>
  )
}

export default function Stats() {
  const { entries, tags, tagById } = useData()

  const data = useMemo(() => {
    const total = entries.length
    const solved = entries.filter((e) => e.status === 'solved').length
    const inProgress = total - solved
    const byTag = {}
    for (const e of entries) if (e.tagId) byTag[e.tagId] = (byTag[e.tagId] || 0) + 1
    const ranked = Object.entries(byTag)
      .map(([id, n]) => ({ tag: tagById[id], n }))
      .filter((x) => x.tag)
      .sort((a, b) => b.n - a.n)
    const max = ranked[0]?.n || 1

    const thisSeason = entries.filter((e) => {
      const days = (Date.now() - new Date(e.createdAt).getTime()) / 86400000
      return days <= 120 // a rough FRC "season" window
    }).length

    return { total, solved, inProgress, ranked, max, thisSeason }
  }, [entries, tagById])

  if (entries.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState icon={BarChart3} title="No stats yet">
          Log a few entries and this dashboard fills in — most active categories, solved vs. open,
          and how much your team has captured this season.
        </EmptyState>
      </div>
    )
  }

  const solvedPct = Math.round((data.solved / data.total) * 100)

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h2 className="font-display text-2xl font-semibold">Season dashboard</h2>
        <p className="text-sm text-muted">How much knowledge your team is banking.</p>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat icon={FileText} label="Total entries" value={data.total} />
        <Stat icon={CheckCircle2} label="Solved" value={data.solved} sub={`${solvedPct}% of all`} />
        <Stat icon={Loader} label="In progress" value={data.inProgress} />
        <Stat icon={TagIcon} label="Logged this season" value={data.thisSeason} />
      </div>

      {/* solved progress bar */}
      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5 shadow-card">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Solved vs. in progress</span>
          <span className="font-mono text-muted">{solvedPct}% solved</span>
        </div>
        <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-progress/20">
          <div className="bg-solved" style={{ width: `${solvedPct}%` }} />
        </div>
      </div>

      {/* most active categories */}
      <div className="mt-6 rounded-xl border border-hairline bg-surface p-5 shadow-card">
        <h3 className="flex items-center gap-2 font-display font-semibold">
          <BarChart3 size={16} /> Most active categories
        </h3>
        <div className="mt-4 space-y-3">
          {data.ranked.map(({ tag, n }) => (
            <div key={tag.id} className="flex items-center gap-3">
              <span className="w-24 shrink-0 truncate font-mono text-xs" style={{ color: tag.color }}>
                {tag.name}
              </span>
              <div className="h-6 flex-1 rounded-md bg-black/[0.04]">
                <div
                  className="flex h-6 items-center justify-end rounded-md px-2 text-[11px] font-mono font-medium text-white"
                  style={{
                    width: `${Math.max(12, (n / data.max) * 100)}%`,
                    backgroundColor: tag.color,
                  }}
                >
                  {n}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
