// ShareModal.jsx — the "spread knowledge beyond one team" feature.
//
// True multi-team sharing needs a backend; in this serverless prototype we
// demonstrate the same idea with a board snapshot: a team exports its board and
// hands the snapshot to another team, who forks it into their own space as an
// independent copy. A generated invite code stands in for the share link a real
// build would produce.
import { useState } from 'react'
import { useData } from '../context/DataContext'
import { useAuth } from '../context/AuthContext'
import { Modal, Button } from './ui'
import { Copy, Download, Upload, Check, GitFork, Share2 } from 'lucide-react'

export default function ShareModal({ open, onClose }) {
  const { exportBoard, forkBoard } = useData()
  const { team } = useAuth()
  const [tab, setTab] = useState('share')
  const [copied, setCopied] = useState(false)
  const [paste, setPaste] = useState('')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const snapshot = open ? exportBoard() : null
  const inviteCode = team ? `${team.name.replace(/\s+/g, '-').toLowerCase()}-${team.id.slice(-6)}` : ''

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard may be blocked; ignore in prototype */
    }
  }

  const downloadSnapshot = () => {
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inviteCode}-board.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doFork = () => {
    setError('')
    setResult(null)
    try {
      const snap = JSON.parse(paste)
      const r = forkBoard(snap)
      setResult(r)
      setPaste('')
    } catch (err) {
      setError(
        err.message.includes('JSON')
          ? "That isn't valid board data. Paste the full contents of a board export."
          : err.message
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share this board"
      subtitle="Let another team learn from your knowledge — or pull in theirs."
    >
      <div className="mb-5 flex rounded-lg border border-hairline p-1">
        {[
          ['share', 'Share ours', Share2],
          ['fork', 'Fork another', GitFork],
        ].map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              tab === id ? 'bg-ink text-white' : 'text-muted hover:bg-black/5'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === 'share' ? (
        <div className="space-y-5">
          <div>
            <label className="text-sm font-medium">Invite code</label>
            <p className="text-xs text-muted">Share this so another team can find your board.</p>
            <div className="mt-2 flex gap-2">
              <code className="flex-1 truncate rounded-lg border border-hairline bg-paper px-3 py-2 font-mono text-sm">
                {inviteCode}
              </code>
              <Button variant="outline" onClick={copyInvite}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-hairline bg-paper/60 p-4">
            <h4 className="flex items-center gap-2 font-display font-semibold">
              <Download size={16} /> Export a snapshot
            </h4>
            <p className="mt-1 text-sm text-muted">
              Download your board as a file. Another team imports it under “Fork another” to get
              their own editable copy — like sharing a doc.
            </p>
            <Button className="mt-3" onClick={downloadSnapshot}>
              <Download size={15} /> Download board file
            </Button>
          </div>

          <p className="font-mono text-[11px] leading-relaxed text-muted">
            In production this would be a real share link backed by a server, with view-only or fork
            permissions and row-level security so private boards stay private.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Paste a board export</label>
            <p className="text-xs text-muted">
              Open the file another team shared, copy its contents, and paste here to fork it into
              your board.
            </p>
            <textarea
              className="mt-2 h-36 w-full resize-y rounded-lg border border-hairline bg-surface px-3 py-2 font-mono text-xs"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder='{ "format": "chassis.board.v1", ... }'
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
          {result && (
            <p className="rounded-lg bg-solved/10 px-3 py-2 text-sm text-solved">
              Forked {result.entries} entr{result.entries === 1 ? 'y' : 'ies'} and {result.tags}{' '}
              tag{result.tags === 1 ? '' : 's'} into your board.
            </p>
          )}

          <Button onClick={doFork} disabled={!paste.trim()}>
            <Upload size={15} /> Fork into our board
          </Button>
        </div>
      )}
    </Modal>
  )
}
