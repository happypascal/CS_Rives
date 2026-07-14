import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Spinner, EmptyState, eur } from '../components/ui'
import { ProjetStatutBadge } from '../components/badges'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

export default function ProjetList() {
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [loading, setLoading] = useState(true)
  const [projets, setProjets] = useState([])

  useEffect(() => {
    repo
      .listProjets()
      .then((p) => setProjets(p))
      .catch(() => setProjets([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Projets"
        subtitle="Chantiers issus des résolutions d’AG : chef de projet, documents, décisions et budget."
        actions={canManage && <Link to="/projets/nouveau"><Button>+ Nouveau projet</Button></Link>}
      />
      {projets.length === 0 ? (
        <EmptyState
          title="Aucun projet"
          hint="Ouvre un projet depuis une résolution d’AG dotée d’un budget."
          action={canManage && <Link to="/projets/nouveau"><Button>Créer un projet</Button></Link>}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Projet</th>
                  <th className="px-4 py-2.5 font-medium">Chef de projet</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Alloué</th>
                  <th className="px-4 py-2.5 text-right font-medium">Engagé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {projets.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/projets/${p.id}`} className="font-medium text-navy-700 hover:underline">{p.nom}</Link>
                      {p.ag_numero && <span className="block text-xs text-slate-400">{p.ag_numero}</span>}
                    </td>
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
        </Card>
      )}
    </div>
  )
}
