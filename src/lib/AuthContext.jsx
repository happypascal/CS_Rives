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

  // L'utilisateur en mémoire est figé à l'ouverture de session (`resolveUser`).
  // Une acceptation RGPD écrite en base n'y apparaîtrait qu'au prochain
  // rechargement complet : l'écran d'acceptation reviendrait à chaque fois qu'on
  // remonte `RgpdGate`, exactement comme quand l'écriture échouait. On recopie
  // donc la date ici. ⚠ C'est un REFLET de ce que la base vient de confirmer,
  // pas une supposition : on ne pose que la valeur renvoyée par l'écriture.
  const marquerRgpdAccepte = useCallback((date) => {
    setUser((u) => (u ? { ...u, registre_rgpd_accepte_le: date || new Date().toISOString() } : u))
  }, [])

  // isAdmin = président (rôle d'auth). isSecretaire / isTresorier lisent le rôle
  // du bureau exposé par resolveUser. Distincts : un secrétaire n'est pas admin.
  const isAdmin = user?.role === 'admin'
  const isSecretaire = user?.membre_role === 'secretaire'
  const isTresorier = user?.membre_role === 'tresorier'

  return (
    <AuthContext.Provider value={{ user, loading, isAdmin, isSecretaire, isTresorier, signIn, signOut, resetPassword, marquerRgpdAccepte }}>
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
