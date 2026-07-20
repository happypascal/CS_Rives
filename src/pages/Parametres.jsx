import { useEffect, useState } from 'react'
import { repo, BACKEND } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Badge, Input } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { formatDateTime } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { SIGNATURE_PROVIDER, ORG } from '../lib/config'
import { resetMockDb } from '../lib/mockDb'
import { supabase } from '../lib/supabase'

export default function Parametres() {
  const { user, isAdmin } = useAuth()
  const [audit, setAudit] = useState([])
  const [confirm, confirmModal] = useConfirm()

  useEffect(() => {
    repo.listAudit(50).then(setAudit).catch(() => setAudit([]))
  }, [])

  const rows = [
    ['Association', ORG.fullName],
    ['Backend', BACKEND === 'supabase' ? 'Supabase (cloud)' : 'Mode démo (localStorage)'],
    ['Signature', SIGNATURE_PROVIDER === 'yousign' ? 'Yousign' : 'Stub / démo'],
    ['Utilisateur', `${user?.prenom} ${user?.nom} — ${isAdmin ? 'Président (admin)' : 'Membre'}`],
    ['Langue', 'Français'],
  ]

  const handleReset = async () => {
    if (!(await confirm({ title: 'Réinitialiser les données de démonstration ?', message: 'Toutes les modifications locales seront perdues.', confirmLabel: 'Réinitialiser', danger: true }))) return
    resetMockDb()
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de l’application et journal d’audit." />

      <div className="mb-6"><ChangePassword /></div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Informations" />
          <dl className="divide-y divide-navy-50">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-medium text-navy-800">{v}</dd>
              </div>
            ))}
          </dl>
          {BACKEND === 'mock' && (
            <div className="border-t border-navy-100 px-5 py-4">
              <p className="mb-2 text-xs text-slate-500">
                Mode démo : les données sont locales à ce navigateur. Configurez Supabase (voir README) pour la production.
              </p>
              <Button variant="secondary" size="sm" onClick={handleReset}>Réinitialiser les données démo</Button>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Journal d’audit" subtitle="50 dernières actions." />
          <ul className="max-h-[28rem] divide-y divide-navy-50 overflow-y-auto">
            {audit.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Aucune entrée.</li>}
            {audit.map((a) => (
              <li key={a.id} className="px-5 py-2.5 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-700">{a.details || `${a.action} · ${a.entite}`}</span>
                  <Badge tone="gray">{a.action}</Badge>
                </div>
                <p className="text-xs text-slate-400">{formatDateTime(a.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>
      {confirmModal}
    </div>
  )
}

// Changement de mot de passe (utilisateur connecté). Sert notamment à remplacer
// le mot de passe provisoire du premier accès.
function ChangePassword() {
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setErr('')
    setMsg('')
    if (pwd.length < 8) return setErr('Le mot de passe doit faire au moins 8 caractères.')
    if (pwd !== confirm) return setErr('Les deux mots de passe ne correspondent pas.')
    if (BACKEND !== 'supabase') return setErr('Indisponible en mode démo.')
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd, data: { password_changed: true } })
      if (error) throw new Error(error.message)
      setMsg('Mot de passe mis à jour.')
      setPwd('')
      setConfirm('')
    } catch (e2) {
      setErr(e2.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <CardHeader title="Mon mot de passe" subtitle="Changez votre mot de passe (ex. après un premier accès avec mot de passe provisoire)." />
      <form onSubmit={submit} className="space-y-3 px-5 py-4 sm:max-w-md">
        {BACKEND !== 'supabase' && (
          <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Mode démo : la modification du mot de passe est disponible uniquement en production (Supabase).</p>
        )}
        <Input label="Nouveau mot de passe" type="password" autoComplete="new-password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
        <Input label="Confirmer" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && <p className="text-sm text-emerald-700">{msg}</p>}
        <Button type="submit" disabled={busy || BACKEND !== 'supabase'}>{busy ? 'Enregistrement…' : 'Changer le mot de passe'}</Button>
      </form>
    </Card>
  )
}
