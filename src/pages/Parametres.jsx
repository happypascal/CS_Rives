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
import { activityNotifsEnabled, setActivityNotifs } from '../lib/useActivityNotifications'

// État initial des notifs de bureau : non géré / bloqué par le navigateur / activé / éteint.
function initialNotifState() {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  return activityNotifsEnabled() ? 'on' : 'off'
}

export default function Parametres() {
  const { user, isAdmin, isSecretaire } = useAuth()
  const [audit, setAudit] = useState([])
  const [confirm, confirmModal] = useConfirm()
  const [notifState, setNotifState] = useState(initialNotifState)
  const canNotify = isAdmin || isSecretaire

  const enableNotifs = async () => {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') { setActivityNotifs(true); setNotifState('on') }
    else setNotifState('blocked')
  }
  const disableNotifs = () => { setActivityNotifs(false); setNotifState('off') }

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

      {canNotify && (
        <Card className="mb-6">
          <CardHeader title="Notifications de bureau" subtitle="Réservé au président et au secrétaire." />
          <div className="px-5 py-4 text-sm text-slate-600">
            <p>
              Tant que l’application reste <strong>ouverte</strong> dans le navigateur, recevez une notification à
              chaque <strong>nouveau vote</strong> ou <strong>nouvelle question</strong> sur une décision (vérification
              toutes les 30 s). Onglet fermé = pas de notification. C’est un confort d’alerte, pas une preuve de
              notification (celle-ci reste l’e-mail / le PV).
            </p>
            {notifState === 'unsupported' && (
              <p className="mt-3 text-amber-700">Votre navigateur ne gère pas les notifications.</p>
            )}
            {notifState === 'blocked' && (
              <p className="mt-3 text-amber-700">Notifications bloquées par le navigateur — autorisez-les via le cadenas dans la barre d’adresse, puis réessayez.</p>
            )}
            {notifState === 'off' && (
              <div className="mt-3"><Button onClick={enableNotifs}>Activer les notifications</Button></div>
            )}
            {notifState === 'on' && (
              <div className="mt-3 flex items-center gap-3">
                <span className="font-medium text-emerald-700">✓ Activées</span>
                <Button variant="secondary" size="sm" onClick={disableNotifs}>Désactiver</Button>
              </div>
            )}
          </div>
        </Card>
      )}

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
