// Sidebar.jsx — the left instrument panel: team identity, navigation, actions.
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import {
  LayoutList,
  BarChart3,
  Tags,
  Share2,
  LogOut,
  Plus,
  Wrench,
} from 'lucide-react'

const NAV = [
  { id: 'feed', label: 'Feed', icon: LayoutList },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'tags', label: 'Tags', icon: Tags },
]

export default function Sidebar({ view, setView, onNewEntry, onShare, onNavigate }) {
  const { team, logout } = useAuth()
  const { entries } = useData()

  const go = (id) => {
    setView(id)
    onNavigate?.()
  }

  return (
    <div className="flex h-full flex-col bg-ink text-white">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-rail">
          <Wrench size={16} />
        </div>
        <span className="font-display text-lg font-semibold tracking-tight">Chassis</span>
      </div>

      {/* team */}
      <div className="mx-3 mb-4 rounded-xl bg-white/5 px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-widest text-white/40">Team board</p>
        <p className="mt-0.5 truncate font-display font-medium">{team?.name}</p>
        <p className="font-mono text-[11px] text-white/40">
          {entries.length} {entries.length === 1 ? 'entry' : 'entries'} · private
        </p>
      </div>

      <div className="px-3">
        <button
          onClick={onNewEntry}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg bg-rail px-3 py-2.5 text-sm font-medium hover:bg-rail-dark transition-colors"
        >
          <Plus size={16} /> New entry
        </button>
      </div>

      {/* nav */}
      <nav className="flex-1 px-3">
        {NAV.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => go(id)}
            className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              view === id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Icon size={17} />
            {label}
          </button>
        ))}
        <button
          onClick={onShare}
          className="mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white transition-colors"
        >
          <Share2 size={17} /> Share board
        </button>
      </nav>

      {/* footer */}
      <div className="px-3 pb-4">
        <button
          onClick={logout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/50 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={17} /> Sign out
        </button>
      </div>
    </div>
  )
}
