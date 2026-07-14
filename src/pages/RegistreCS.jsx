import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, EmptyState } from '../components/ui'
import { StatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { downloadRegistrePDF } from '../lib/pdf'

export default function RegistreCS() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [year, setYear] = useState('all')
  const [statut, setStatut] = useState('all')
  const [q, setQ] = useState('')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    Promise.all([repo.listDecisions(), repo.listMembres()]).then(([d, m]) => {
      setDecisions(d)
      setMembers(m)
      setLoading(false)
    })
  }, [])

  const years = useMemo(
    () => [...new Set(decisions.map((d) => d.date_decision?.slice(0, 4)))].filter(Boolean).sort().reverse(),
    [decisions],
  )

  const filtered = useMemo(
    () =>
      decisions.filter((d) => {
        if (year !== 'all' && d.date_decision?.slice(0, 4) !== year) return false
        if (statut !== 'all' && d.statut !== statut) return false
        if (q && !`${d.numero} ${d.titre}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [decisions, year, statut, q],
  )

  const exportAll = async () => {
    setExporting(true)
    try {
      // Resolve vote/qa detail per decision for the full PDF.
      const details = await Promise.all(filtered.map((d) => repo.getDecision(d.id)))
      const byId = Object.fromEntries(details.map((d) => [d.id, d]))
      downloadRegistrePDF(filtered, {
        members,
        getDetail: (d) => ({ votes: byId[d.id]?.votes || [], qa: byId[d.id]?.qa || [] }),
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Registre du Conseil Syndical"
        subtitle="Décisions courantes du CS (hors résolutions d’AG)."
        actions={
          <>
            <Button variant="secondary" onClick={exportAll} disabled={exporting || filtered.length === 0}>
              {exporting ? 'Génération…' : 'Export PDF registre'}
            </Button>
            {isAdmin && (
              <Link to="/registre/nouvelle">
                <Button>+ Nouvelle décision</Button>
              </Link>
            )}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Rechercher (n° ou titre)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">Toutes les années</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </Select>
          <Select value={statut} onChange={(e) => setStatut(e.target.value)}>
            <option value="all">Tous les statuts</option>
            <option value="en_cours">En cours</option>
            <option value="adoptee">Adoptée</option>
            <option value="rejetee">Rejetée</option>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucune décision"
          hint="Aucune décision ne correspond aux filtres."
          action={isAdmin && <Link to="/registre/nouvelle"><Button>Créer une décision</Button></Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Titre</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">{d.numero}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(d.date_decision)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/registre/${d.id}`} className="font-medium text-navy-700 hover:underline">
                        {d.titre}
                      </Link>
                    </td>
                    <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
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
