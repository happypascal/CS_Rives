import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { BACKEND } from '../lib/config'
import { Button, Input, Card } from '../components/ui'
import { ORG } from '../lib/config'

export default function Login() {
  const { signIn, resetPassword } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState(BACKEND === 'mock' ? 'pfavre25@gmail.com' : '')
  const [password, setPassword] = useState(BACKEND === 'mock' ? 'demo' : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState('')

  const onSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      await signIn(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Connexion impossible.')
    } finally {
      setBusy(false)
    }
  }

  const onForgot = async () => {
    if (!email) {
      setError('Saisissez votre email pour recevoir le lien de réinitialisation.')
      return
    }
    try {
      await resetPassword(email)
      setInfo('Si un compte existe, un email de réinitialisation a été envoyé.')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <h1 className="text-2xl font-semibold">Registre des Décisions</h1>
          <p className="mt-1 text-sm text-navy-200">{ORG.fullName}</p>
        </div>
        <Card className="p-6">
          <form onSubmit={onSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Mot de passe"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            {info && <p className="text-sm text-emerald-700">{info}</p>}
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy ? 'Connexion…' : 'Se connecter'}
            </Button>
            <button
              type="button"
              onClick={onForgot}
              className="block w-full text-center text-xs text-navy-600 underline"
            >
              Mot de passe oublié ?
            </button>
          </form>
        </Card>
        {BACKEND === 'mock' && (
          <p className="mt-4 rounded-md bg-amber-500/20 px-3 py-2 text-center text-xs text-amber-100">
            Mode démo — comptes de test préremplis (mot de passe : <strong>demo</strong>).
            Les données sont stockées localement dans le navigateur.
          </p>
        )}
      </div>
    </div>
  )
}
