import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { BACKEND } from '../lib/config'
import { Button, Input, Card } from '../components/ui'
import { ORG } from '../lib/config'

// Page atterrissage du lien "mot de passe oublié" / invitation Supabase.
// supabase-js récupère automatiquement la session de récupération depuis l'URL
// (detectSessionInUrl). L'utilisateur définit ici son nouveau mot de passe.
export default function ResetPassword() {
  const navigate = useNavigate()
  const [ready, setReady] = useState(BACKEND === 'mock' ? true : false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (BACKEND !== 'supabase') return
    // Attendre que supabase ait posé la session issue du lien email.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.')
    if (password !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    if (BACKEND !== 'supabase') return setError('Réinitialisation indisponible en mode démo.')
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw new Error(err.message)
      setDone(true)
      setTimeout(() => navigate('/'), 1500)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold">Nouveau mot de passe</h1>
          <p className="mt-1 text-sm text-navy-200">{ORG.fullName}</p>
        </div>
        <Card className="p-6">
          {done ? (
            <p className="text-sm text-emerald-700">Mot de passe mis à jour. Redirection…</p>
          ) : BACKEND === 'mock' ? (
            <p className="text-sm text-slate-600">
              Réinitialisation indisponible en mode démo (mot de passe : <strong>demo</strong>).
              <button onClick={() => navigate('/login')} className="ml-1 text-navy-600 underline">Retour</button>
            </p>
          ) : !ready ? (
            <p className="text-sm text-slate-600">
              Lien invalide ou expiré. Redemandez un email de réinitialisation depuis l’écran de connexion.
              <button onClick={() => navigate('/login')} className="ml-1 text-navy-600 underline">Connexion</button>
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Enregistrement…' : 'Définir le mot de passe'}</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
