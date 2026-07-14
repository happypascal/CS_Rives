import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Spinner, Button, eur } from '../components/ui'
import { StatutBadge, AGStatutBadge } from '../components/badges'
import { formatDate, formatDateLong } from '../lib/format'
import { useAuth } from '../lib/AuthContext'

export default function Dashboard() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [ags, setAgs] = useState([])
  const [budgets, setBudgets] = useState([])
  const [batches, setBatches] = useState([])

  useEffect(() => {
    Promise.all([repo.listDecisions(), repo.listAG(), repo.listBudgets(), repo.listSignatureBatches()]).then(
      ([d, a, b, s]) => {
        setDecisions(d)
        setAgs(a)
        setBudgets(b)
        setBatches(s)
        setLoading(false)
      },
    )
  }, [])

  if (loading) return <Spinner />

  const recent = decisions.slice(0, 5)
  const enCours = decisions.filter((d) => !d.enregistree)
  const nextAG = ags.filter((a) => a.statut === 'en_cours').sort((x, y) => (x.date_ag < y.date_ag ? -1 : 1))[0]
  const anyBatchDecisionIds = new Set(batches.flatMap((b) => b.decision_ids))
  const toSign = decisions.filter((d) => d.enregistree && d.statut === 'adoptee' && !anyBatchDecisionIds.has(d.id))
  const totalBudget = budgets.reduce((s, b) => s + Number(b.montant_alloue || 0), 0)

  const stats = [
    { label: 'Décisions', value: decisions.length, sub: `${enCours.length} en cours` },
    { label: 'Assemblées Générales', value: ags.length, sub: nextAG ? 'prochaine planifiée' : 'aucune à venir' },
    { label: 'Budgets alloués', value: eur(totalBudget), sub: `${budgets.length} ligne(s)` },
    { label: 'À signer', value: toSign.length, sub: 'décisions adoptées' },
  ]

  return (
    <div>
      <PageHeader title={`Bonjour ${user?.prenom || ''}`} subtitle="Vue d’ensemble du registre du Conseil Syndical." />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-semibold text-navy-800">{s.value}</p>
            <p className="mt-0.5 text-xs text-slate-500">{s.sub}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dernières décisions" actions={<Link to="/registre"><Button variant="ghost" size="sm">Tout voir</Button></Link>} />
          <ul className="divide-y divide-navy-50">
            {recent.map((d) => (
              <li key={d.id}>
                <Link to={`/registre/${d.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-navy-50/50">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-800"><span className="text-slate-400">{d.numero}</span> · {d.titre}</p>
                    <p className="text-xs text-slate-500">{formatDate(d.date_publication)}{d.enregistree ? '' : ' · brouillon'}</p>
                  </div>
                  <StatutBadge statut={d.statut} />
                </Link>
              </li>
            ))}
            {recent.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Aucune décision.</li>}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Prochaine Assemblée Générale" />
            <div className="px-5 py-4">
              {nextAG ? (
                <Link to={`/ag/${nextAG.id}`} className="block rounded-md p-2 hover:bg-navy-50/50">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-navy-800">{nextAG.numero} · {nextAG.type}</p>
                    <AGStatutBadge statut={nextAG.statut} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{formatDateLong(nextAG.date_ag)}</p>
                  <p className="text-xs text-slate-500">{nextAG.lieu}</p>
                </Link>
              ) : (
                <p className="text-sm text-slate-500">Aucune AG planifiée.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Décisions à signer" actions={<Link to="/registre"><Button variant="ghost" size="sm">Registre</Button></Link>} />
            <ul className="divide-y divide-navy-50">
              {toSign.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link to={`/registre/${d.id}`} className="min-w-0 truncate text-sm font-medium text-navy-700 hover:underline">
                    <span className="text-slate-400">{d.numero}</span> · {d.titre}
                  </Link>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(d.date_enregistrement)}</span>
                </li>
              ))}
              {toSign.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Aucune décision en attente de signature.</li>}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  )
}
