import { useEffect, useMemo, useState } from 'react'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Select, Input, Spinner, EmptyState, eur } from '../components/ui'
import { BudgetStatutBadge } from '../components/badges'
import { CLE_REPARTITION_LABELS } from '../lib/agLogic'
import { formatDate } from '../lib/format'
import { budgetsToCSV, downloadCSV } from '../lib/csv'

export default function BudgetsConsolidated() {
  const [loading, setLoading] = useState(true)
  const [budgets, setBudgets] = useState([])
  const [statut, setStatut] = useState('all')
  const [ag, setAg] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    repo.listBudgets().then((data) => {
      setBudgets(data)
      setLoading(false)
    })
  }, [])

  const agOptions = useMemo(
    () => [...new Set(budgets.map((b) => b.ag_numero))].filter(Boolean).sort(),
    [budgets],
  )

  const filtered = useMemo(
    () =>
      budgets.filter((b) => {
        if (statut !== 'all' && b.statut !== statut) return false
        if (ag !== 'all' && b.ag_numero !== ag) return false
        if (q && !b.intitule.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [budgets, statut, ag, q],
  )

  const totals = filtered.reduce(
    (acc, b) => {
      acc.vote += Number(b.montant_vote || 0)
      acc.appele += Number(b.montant_appele || 0)
      acc.encaisse += Number(b.montant_encaisse || 0)
      return acc
    },
    { vote: 0, appele: 0, encaisse: 0 },
  )
  const reste = totals.appele - totals.encaisse

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Budgets — vue consolidée"
        subtitle="Tous les budgets votés en AG, toutes assemblées confondues."
        actions={
          <Button variant="secondary" onClick={() => downloadCSV(`budgets-CS-Rives-${new Date().getFullYear()}.csv`, budgetsToCSV(filtered))} disabled={filtered.length === 0}>
            Export CSV (Foncia)
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Total voté</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totals.vote)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Appelé</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totals.appele)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Encaissé</p><p className="mt-1 text-xl font-semibold text-emerald-700">{eur(totals.encaisse)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Reste à encaisser</p><p className="mt-1 text-xl font-semibold text-amber-700">{eur(reste)}</p></Card>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Rechercher un intitulé…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={ag} onChange={(e) => setAg(e.target.value)}>
            <option value="all">Toutes les AG</option>
            {agOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
          <Select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="vote">Voté</option>
            <option value="appele">Appelé</option>
            <option value="encaisse">Encaissé</option>
            <option value="solde">Soldé</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun budget" hint="Aucun budget ne correspond aux filtres." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">AG</th>
                  <th className="px-4 py-2.5 font-medium">Intitulé</th>
                  <th className="px-4 py-2.5 font-medium">Voté</th>
                  <th className="px-4 py-2.5 font-medium">Répartition</th>
                  <th className="px-4 py-2.5 font-medium">Appel prévu</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Encaissé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">{b.ag_numero}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{b.intitule}</td>
                    <td className="whitespace-nowrap px-4 py-3">{eur(b.montant_vote)}</td>
                    <td className="px-4 py-3 text-slate-600">{CLE_REPARTITION_LABELS[b.cle_repartition]}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{b.date_appel_prevu ? formatDate(b.date_appel_prevu) : '—'}</td>
                    <td className="px-4 py-3"><BudgetStatutBadge statut={b.statut} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{eur(b.montant_encaisse)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
