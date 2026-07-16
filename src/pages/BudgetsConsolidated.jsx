import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Spinner, EmptyState, eur } from '../components/ui'
import { ProjetStatutBadge } from '../components/badges'
import { budgetsToCSV, downloadCSV } from '../lib/csv'

export default function BudgetsConsolidated() {
  const [loading, setLoading] = useState(true)
  const [envelopes, setEnvelopes] = useState([]) // résolutions AG (enveloppes votées)
  const [projets, setProjets] = useState([])

  useEffect(() => {
    Promise.all([repo.listAGBudgets().catch(() => []), repo.listProjets().catch(() => [])])
      .then(([e, p]) => {
        setEnvelopes(e.sort((a, b) => (a.ag_date < b.ag_date ? 1 : -1)))
        setProjets(p)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  // Trois natures distinctes, jamais une seule étiquette « engagé » : une enveloppe
  // allouée à un projet n'est pas dépensée, elle est affectée. Cf. Dashboard.
  const totalVote = envelopes.reduce((s, b) => s + Number(b.alloue || 0), 0)
  const totalProjetsAlloue = envelopes.reduce((s, b) => s + Number(b.projets_alloue || 0), 0)
  const totalEngageDirect = envelopes.reduce((s, b) => s + Number(b.engage_direct || 0), 0)
  // Le restant vit à deux endroits : non affecté (côté AG) et disponible sur les
  // projets. Une enveloppe entièrement allouée a un restant AG nul alors qu'il
  // reste de quoi dépenser sur le projet — cf. Dashboard.
  const totalRestantNonAffecte = envelopes.reduce((s, b) => s + Number(b.restant || 0), 0)
  const totalRestantProjets = projets.reduce((s, p) => s + Number(p.restant || 0), 0)
  const totalRestantDispo = totalRestantNonAffecte + totalRestantProjets

  return (
    <div>
      <PageHeader
        title="Budgets"
        subtitle="Enveloppes votées en AG, budgets alloués aux projets et engagements des décisions."
        actions={<Button variant="secondary" onClick={() => downloadCSV(`budgets-CS-Rives-${new Date().getFullYear()}.csv`, budgetsToCSV(envelopes))} disabled={envelopes.length === 0}>Export CSV (Foncia)</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Voté en AG</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totalVote)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Alloué aux projets</p><p className="mt-1 text-xl font-semibold text-navy-600">{eur(totalProjetsAlloue)}</p><p className="mt-0.5 text-xs text-slate-400">affecté, pas encore dépensé</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Engagé direct</p><p className="mt-1 text-xl font-semibold text-amber-700">{eur(totalEngageDirect)}</p><p className="mt-0.5 text-xs text-slate-400">décisions hors projet</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Restant disponible</p><p className="mt-1 text-xl font-semibold text-emerald-700">{eur(totalRestantDispo)}</p><p className="mt-0.5 text-xs text-slate-400">{totalRestantProjets > 0 ? `dont ${eur(totalRestantProjets)} sur les projets` : 'non affecté à un projet'}</p></Card>
      </div>

      {/* Enveloppes votées en AG */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader title="Enveloppes votées en AG" subtitle="Par résolution : voté, part allouée aux projets, engagements directs, restant." />
        {envelopes.length === 0 ? (
          <div className="p-6"><EmptyState title="Aucune enveloppe" hint="Dote une résolution d’AG d’un budget." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">AG</th>
                  <th className="px-4 py-2.5 font-medium">Enveloppe</th>
                  <th className="px-4 py-2.5 text-right font-medium">Voté</th>
                  <th className="px-4 py-2.5 text-right font-medium">Projets</th>
                  <th className="px-4 py-2.5 text-right font-medium">Engagé direct</th>
                  <th className="px-4 py-2.5 text-right font-medium">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {envelopes.map((b) => (
                  <tr key={b.resolution_id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3"><Link to={`/ag/${b.ag_id}`} className="text-slate-500 hover:text-navy-700 hover:underline">{b.ag_numero}</Link></td>
                    <td className="px-4 py-3 font-medium text-slate-700">{b.intitule}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{eur(b.alloue)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-600">{eur(b.projets_alloue)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-amber-700">{eur(b.engage_direct)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${b.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(b.restant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Projets */}
      <Card className="overflow-hidden">
        <CardHeader title="Projets" subtitle="Budget par projet : alloué, engagé par les décisions, restant." actions={<Link to="/projets"><Button variant="ghost" size="sm">Tous les projets</Button></Link>} />
        {projets.length === 0 ? (
          <div className="p-6"><EmptyState title="Aucun projet" hint="Ouvre un projet depuis une résolution d’AG." /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Projet</th>
                  <th className="px-4 py-2.5 font-medium">Chef</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Alloué</th>
                  <th className="px-4 py-2.5 text-right font-medium">Engagé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {projets.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3"><Link to={`/projets/${p.id}`} className="font-medium text-navy-700 hover:underline">{p.nom}</Link></td>
                    <td className="px-4 py-3 text-slate-600">{p.chef_nom || '—'}</td>
                    <td className="px-4 py-3"><ProjetStatutBadge statut={p.statut} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{eur(p.alloue)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-amber-700">{eur(p.engage)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${p.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(p.restant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
