import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { BACKEND, authApi } from './api'
import { supabase } from './supabase'
import { resolveUser } from './supabaseDb'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    if (BACKEND === 'supabase') {
      supabase.auth.getSession().then(async ({ data }) => {
        const u = await resolveUser(data.session?.user)
        if (active) {
          setUser(u)
          setLoading(false)
        }
      })
      const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
        const u = await resolveUser(session?.user)
        if (active) setUser(u)
      })
      return () => {
        active = false
        sub.subscription.unsubscribe()
      }
    }
    // mock
    setUser(authApi.getSession())
    setLoading(false)
    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async (email, password) => {
    const u = await authApi.signIn(email, password)
    if (u) setUser(u)
    return u
  }, [])

  const signOut = useCallback(async () => {
    await authApi.signOut()
    setUser(null)
  }, [])

  const resetPassword = useCallback((email) => authApi.resetPassword(email), [])

  const isAdmin = user?.role === 'admin'

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
