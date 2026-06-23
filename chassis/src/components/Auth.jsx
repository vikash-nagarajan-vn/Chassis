// Auth.jsx — the login / signup screen (mock auth).
import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { DEMO_LOGIN } from '../lib/seed'
import { Button, Field, inputClass } from './ui'
import { ArrowRight, Wrench } from 'lucide-react'

export default function Auth() {
  const { login, signup } = useAuth()
  const [mode, setMode] = useState('login')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    setError('')
    try {
      if (mode === 'login') login({ name, password })
      else signup({ name, password })
    } catch (err) {
      setError(err.message)
    }
  }

  const useDemo = () => {
    setError('')
    try {
      login(DEMO_LOGIN)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel — the "thesis": knowledge that stays bolted to the team. */}
      <div className="relative hidden lg:flex flex-col justify-between bg-ink text-white p-12 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-rail">
            <Wrench size={18} />
          </div>
          <span className="font-display text-xl font-semibold tracking-tight">Chassis</span>
        </div>

        <div className="relative">
          {/* signature rail motif */}
          <div className="absolute -left-12 top-0 bottom-0 w-1.5 bg-rail rounded-full" />
          <p className="font-mono text-xs uppercase tracking-widest text-rail mb-4">
            Knowledge log · robotics teams
          </p>
          <h1 className="font-display text-4xl font-semibold leading-tight">
            Your team's hard-won
            <br />
            knowledge, kept on the
            <br />
            frame instead of in
            <br />
            someone's head.
          </h1>
          <p className="mt-5 max-w-md text-white/60 leading-relaxed">
            Members graduate every few years and take their fixes, strategies, and lessons with
            them. Chassis is where the team writes it down once — searchable, taggable, and shareable
            with other teams.
          </p>
        </div>

        <p className="font-mono text-xs text-white/40">
          Prototype · data is stored locally in your browser
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-rail text-white">
              <Wrench size={18} />
            </div>
            <span className="font-display text-xl font-semibold">Chassis</span>
          </div>

          <h2 className="font-display text-2xl font-semibold">
            {mode === 'login' ? 'Open your team board' : 'Start a team board'}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {mode === 'login'
              ? 'Boards are private to your team by default.'
              : 'Pick a team name and a password your members will share.'}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Team name">
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team 6328"
                autoFocus
              />
            </Field>
            <Field label="Team password">
              <input
                className={inputClass}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
            )}

            <Button type="submit" size="lg" className="w-full">
              {mode === 'login' ? 'Open board' : 'Create board'}
              <ArrowRight size={16} />
            </Button>
          </form>

          <div className="mt-5 flex items-center justify-between text-sm">
            <button
              className="text-muted hover:text-ink"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setError('')
              }}
            >
              {mode === 'login' ? "New team? Create a board" : 'Have a board? Open it'}
            </button>
            <button className="font-medium text-rail hover:text-rail-dark" onClick={useDemo}>
              Explore the demo →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
