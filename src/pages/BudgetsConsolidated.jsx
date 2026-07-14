import { useEffect, useMemo, useState, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Select, Input, Spinner, EmptyState, Badge, eur } from '../components/ui'
import { budgetsToCSV, downloadCSV } from '../lib/csv'

export default function BudgetsConsolidated() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [ag, setAg] = useState('all')
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    repo.listAGBudgets().then((data) => {
      setRows(data.sort((a, b) => (a.ag_date < b.ag_date ? 1 : -1)))
      setLoading(false)
    })
  }, [])

  const agOptions = useMemo(() => [...new Set(rows.map((b) => b.ag_numero))].filter(Boolean).sort(), [rows])

  const filtered = useMemo(
    () =>
      rows.filter((b) => {
        if (ag !== 'all' && b.ag_numero !== ag) return false
        if (q && !`${b.ag_numero} ${b.intitule}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [rows, ag, q],
  )

  const sum = (k) => filtered.reduce((s, b) => s + (Number(b[k]) || 0), 0)
  const totalAlloue = sum('alloue')
  const totalEngage = sum('engage')
  const totalRestant = sum('restant')
  const totalEnCours = sum('engage_en_cours')

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Budgets — alloués, engagés, restant"
        subtitle="Budgets votés en AG et engagements pris par les décisions du CS."
        actions={<Button variant="secondary" onClick={() => downloadCSV(`budgets-CS-Rives-${new Date().getFullYear()}.csv`, budgetsToCSV(filtered))} disabled={filtered.length === 0}>Export CSV (Foncia)</Button>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Total alloué</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totalAlloue)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Engagé</p><p className="mt-1 text-xl font-semibold text-amber-700">{eur(totalEngage)}</p>{totalEnCours > 0 && <p className="text-xs text-slate-400">+ {eur(totalEnCours)} en cours</p>}</Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Restant</p><p className="mt-1 text-xl font-semibold text-emerald-700">{eur(totalRestant)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Budgets</p><p className="mt-1 text-xl font-semibold text-navy-800">{filtered.length}</p></Card>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Rechercher (AG ou intitulé)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={ag} onChange={(e) => setAg(e.target.value)}>
            <option value="all">Toutes les AG</option>
            {agOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun budget" hint="Dotez une résolution d’AG d’un budget pour le voir apparaître ici." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">AG</th>
                  <th className="px-4 py-2.5 font-medium">Budget</th>
                  <th className="px-4 py-2.5 text-right font-medium">Alloué</th>
                  <th className="px-4 py-2.5 text-right font-medium">Engagé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Restant</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((b) => {
                  const over = b.restant < 0
                  const isOpen = expanded === b.resolution_id
                  return (
                    <Fragment key={b.resolution_id}>
                      <tr className="hover:bg-navy-50/40">
                        <td className="whitespace-nowrap px-4 py-3">
                          <Link to={`/ag/${b.ag_id}`} className="text-slate-500 hover:text-navy-700 hover:underline">{b.ag_numero}</Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-700">{b.intitule}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right">{eur(b.alloue)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-amber-700">{eur(b.engage)}{b.engage_en_cours > 0 && <span className="text-xs text-slate-400"> (+{eur(b.engage_en_cours)})</span>}</td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${over ? 'text-red-700' : 'text-emerald-700'}`}>{eur(b.restant)}</td>
                        <td className="px-4 py-3 text-right">
                          {b.engagements.length > 0 && (
                            <button onClick={() => setExpanded(isOpen ? null : b.resolution_id)} className="text-xs text-navy-600 underline">
                              {isOpen ? 'Masquer' : `${b.engagements.length} engagement(s)`}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isOpen && b.engagements.map((e) => (
                        <tr key={e.id} className="bg-navy-50/30 text-xs">
                          <td />
                          <td className="px-4 py-2" colSpan={1}>
                            <Link to={`/registre/${e.id}`} className="text-navy-700 hover:underline">{e.numero} — {e.titre}</Link>
                          </td>
                          <td />
                          <td className="px-4 py-2 text-right text-slate-600">{eur(e.montant)}</td>
                          <td className="px-4 py-2 text-right">
                            <Badge tone={e.statut === 'adoptee' ? 'green' : e.statut === 'rejetee' ? 'red' : 'amber'}>
                              {e.enregistree ? (e.statut === 'adoptee' ? 'Engagé' : 'Rejeté') : 'En cours'}
                            </Badge>
                          </td>
                          <td />
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-navy-100 bg-navy-50/40 text-sm font-semibold">
                  <td className="px-4 py-2.5" colSpan={2}>Total</td>
                  <td className="px-4 py-2.5 text-right">{eur(totalAlloue)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-700">{eur(totalEngage)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">{eur(totalRestant)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
