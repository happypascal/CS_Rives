import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Select, Input, Spinner, EmptyState, Badge, eur } from '../components/ui'
import { formatDate } from '../lib/format'
import { budgetsToCSV, downloadCSV } from '../lib/csv'

export default function BudgetsConsolidated() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState([])
  const [source, setSource] = useState('all')
  const [q, setQ] = useState('')

  useEffect(() => {
    repo.listBudgets().then((data) => {
      setRows(data.sort((a, b) => (a.date < b.date ? 1 : -1)))
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(
    () =>
      rows.filter((b) => {
        if (source !== 'all' && b.source !== source) return false
        if (q && !`${b.reference} ${b.intitule}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [rows, source, q],
  )

  const total = filtered.reduce((s, b) => s + (Number(b.montant_alloue) || 0), 0)
  const totalAG = filtered.filter((b) => b.source === 'AG').reduce((s, b) => s + Number(b.montant_alloue || 0), 0)
  const totalCS = filtered.filter((b) => b.source === 'CS').reduce((s, b) => s + Number(b.montant_alloue || 0), 0)

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Budgets — vue consolidée"
        subtitle="Montants alloués par les décisions (AG et CS), toutes sources confondues."
        actions={<Button variant="secondary" onClick={() => downloadCSV(`budgets-CS-Rives-${new Date().getFullYear()}.csv`, budgetsToCSV(filtered))} disabled={filtered.length === 0}>Export CSV (Foncia)</Button>}
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Total alloué</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(total)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Dont AG</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totalAG)}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Dont CS</p><p className="mt-1 text-xl font-semibold text-navy-800">{eur(totalCS)}</p></Card>
      </div>

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Rechercher (référence ou intitulé)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">Toutes les sources</option>
            <option value="AG">Assemblées Générales</option>
            <option value="CS">Décisions CS</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState title="Aucun budget alloué" hint="Ajoutez un budget sur une décision ou une résolution d’AG." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Référence</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Intitulé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant alloué</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((b) => (
                  <tr key={b.source + b.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3"><Badge tone={b.source === 'AG' ? 'navy' : 'blue'}>{b.source}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {b.source === 'CS' ? <Link to={`/registre/${b.id}`} className="text-navy-700 hover:underline">{b.reference}</Link> : b.reference}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{b.date ? formatDate(b.date) : '—'}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{b.intitule}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium text-navy-800">{eur(b.montant_alloue)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-navy-100 bg-navy-50/40 text-sm font-semibold">
                  <td className="px-4 py-2.5" colSpan={4}>Total</td>
                  <td className="px-4 py-2.5 text-right text-navy-800">{eur(total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
