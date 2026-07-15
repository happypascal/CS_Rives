import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { Button, Input, Card } from '../components/ui'
import { ORG } from '../lib/config'

// Écran bloquant au 1er accès : le membre DOIT définir son mot de passe
// (remplace le mot de passe provisoire) avant d'utiliser l'app.
export default function ForcePasswordChange() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (pwd.length < 8) return setError('Le mot de passe doit faire au moins 8 caractères.')
    if (pwd !== confirm) return setError('Les deux mots de passe ne correspondent pas.')
    setBusy(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password: pwd, data: { password_changed: true } })
      if (err) throw new Error(err.message)
      // onAuthStateChange (USER_UPDATED) rafraîchit l'utilisateur -> le drapeau
      // password_changed devient true et l'écran se libère automatiquement.
    } catch (e2) {
      setError(e2.message)
      setBusy(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold">Bienvenue {user?.prenom}</h1>
          <p className="mt-1 text-sm text-navy-200">{ORG.fullName}</p>
        </div>
        <Card className="p-6">
          <p className="mb-4 text-sm text-slate-600">
            Pour votre première connexion, veuillez définir <strong>votre</strong> mot de passe personnel
            (il remplace le mot de passe provisoire).
          </p>
          <form onSubmit={submit} className="space-y-4">
            <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} required />
            <Input label="Confirmer le mot de passe" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? 'Enregistrement…' : 'Définir mon mot de passe'}</Button>
            <button type="button" onClick={handleSignOut} className="block w-full text-center text-xs text-navy-600 underline">Se déconnecter</button>
          </form>
        </Card>
      </div>
    </div>
  )
}
