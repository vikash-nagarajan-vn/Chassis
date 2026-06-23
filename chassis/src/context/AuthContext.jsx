// AuthContext.jsx
// Holds the current "logged-in" team and exposes login / signup / logout.
// Mock only — see storage.js for the security caveat.

import { createContext, useContext, useEffect, useState } from 'react'
import {
  getSession,
  setSession,
  clearSession,
  authenticate,
  createTeam,
  ensureDefaultTags,
} from '../lib/storage'
import { seedIfEmpty } from '../lib/seed'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [team, setTeam] = useState(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    seedIfEmpty()
    setTeam(getSession())
    setReady(true)
  }, [])

  const login = ({ name, password }) => {
    const t = authenticate({ name, password })
    setSession(t.id)
    setTeam(t)
    return t
  }

  const signup = ({ name, password }) => {
    const t = createTeam({ name, password })
    ensureDefaultTags(t.id)
    setSession(t.id)
    setTeam(t)
    return t
  }

  const logout = () => {
    clearSession()
    setTeam(null)
  }

  return (
    <AuthContext.Provider value={{ team, ready, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
