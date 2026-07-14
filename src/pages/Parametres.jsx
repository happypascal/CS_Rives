import { useEffect, useState } from 'react'
import { repo, BACKEND } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Badge } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { SIGNATURE_PROVIDER, ORG } from '../lib/config'
import { resetMockDb } from '../lib/mockDb'

export default function Parametres() {
  const { user, isAdmin } = useAuth()
  const [audit, setAudit] = useState([])

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

  const handleReset = () => {
    if (!confirm('Réinitialiser les données de démonstration ? Toutes les modifications locales seront perdues.')) return
    resetMockDb()
    window.location.reload()
  }

  return (
    <div>
      <PageHeader title="Paramètres" subtitle="Configuration de l’application et journal d’audit." />

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
    </div>
  )
}
