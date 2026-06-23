import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { DataProvider } from './context/DataContext'
import Auth from './components/Auth'
import Sidebar from './components/Sidebar'
import Feed from './components/Feed'
import Stats from './components/Stats'
import TagManager from './components/TagManager'
import EntryModal from './components/EntryModal'
import EntryDetail from './components/EntryDetail'
import ShareModal from './components/ShareModal'
import { Menu, Wrench } from 'lucide-react'

const TITLES = { feed: 'Feed', stats: 'Stats', tags: 'Tags' }

function Workspace() {
  const [view, setView] = useState('feed')
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, obj = edit
  const [detail, setDetail] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)

  const openNew = () => setEditing(null)
  const openEdit = (entry) => {
    setDetail(null)
    setEditing(entry)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-paper">
      {/* desktop sidebar */}
      <aside className="hidden md:block md:w-64 shrink-0">
        <Sidebar view={view} setView={setView} onNewEntry={openNew} onShare={() => setSharing(true)} />
      </aside>

      {/* mobile sidebar drawer */}
      {mobileNav && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNav(false)} />
          <div className="absolute left-0 top-0 h-full w-64">
            <Sidebar
              view={view}
              setView={setView}
              onNewEntry={() => {
                setMobileNav(false)
                openNew()
              }}
              onShare={() => {
                setMobileNav(false)
                setSharing(true)
              }}
              onNavigate={() => setMobileNav(false)}
            />
          </div>
        </div>
      )}

      {/* main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* mobile top bar */}
        <header className="flex items-center gap-3 border-b border-hairline bg-surface px-4 py-3 md:hidden">
          <button onClick={() => setMobileNav(true)} aria-label="Open menu" className="text-ink">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-rail text-white">
              <Wrench size={14} />
            </div>
            <span className="font-display font-semibold">{TITLES[view]}</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scroll-slim px-4 py-6 sm:px-8 sm:py-8">
          {view === 'feed' && <Feed onOpenEntry={setDetail} onNewEntry={openNew} />}
          {view === 'stats' && <Stats />}
          {view === 'tags' && <TagManager />}
        </main>
      </div>

      {/* modals */}
      <EntryModal
        open={editing !== undefined}
        existing={editing || undefined}
        onClose={() => setEditing(undefined)}
      />
      <EntryDetail
        entry={detail}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
        onOpenEntry={(e) => setDetail(e)}
      />
      <ShareModal open={sharing} onClose={() => setSharing(false)} />
    </div>
  )
}

function Gate() {
  const { team, ready } = useAuth()
  if (!ready) {
    return (
      <div className="grid h-screen place-items-center bg-paper">
        <div className="animate-pulse font-mono text-sm text-muted">Loading board…</div>
      </div>
    )
  }
  if (!team) return <Auth />
  return (
    <DataProvider>
      <Workspace />
    </DataProvider>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
