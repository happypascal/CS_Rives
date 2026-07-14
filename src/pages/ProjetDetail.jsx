import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Spinner, eur } from '../components/ui'
import { ProjetStatutBadge, StatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

export default function ProjetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [projet, setProjet] = useState(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const p = await repo.getProjet(id)
      setProjet(p)
    } catch {
      setProjet(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />
  if (!projet) {
    return (
      <div>
        <PageHeader title="Projet introuvable" />
        <Link to="/projets" className="text-navy-600 underline">← Retour aux projets</Link>
      </div>
    )
  }

  const del = async () => {
    if (!confirm(`Supprimer le projet « ${projet.nom} » ? Les décisions rattachées seront détachées.`)) return
    await repo.deleteProjet(id)
    navigate('/projets')
  }

  const pct = projet.alloue > 0 ? Math.min(100, Math.round((projet.engage / projet.alloue) * 100)) : 0

  return (
    <div>
      <PageHeader
        title={projet.nom}
        subtitle={`${projet.ag_numero ? projet.ag_numero + ' · ' : ''}${projet.resolution_titre ? 'Résolution : ' + projet.resolution_titre : ''}`}
        actions={
          canManage && (
            <>
              <Link to={`/projets/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>
              <Button variant="danger" onClick={del}>Supprimer</Button>
            </>
          )
        }
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><ProjetStatutBadge statut={projet.statut} /></div>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Chef de projet</p>
          <p className="text-sm font-medium text-navy-800">{projet.chef_nom || '— à définir —'}</p>
          {projet.date_ouverture && <p className="mt-2 text-xs text-slate-500">Ouvert le {formatDate(projet.date_ouverture)}</p>}
        </Card>

        <Card className="p-4 lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budget</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-slate-500">Alloué</p><p className="text-lg font-semibold text-navy-800">{eur(projet.alloue)}</p></div>
            <div><p className="text-xs text-slate-500">Engagé</p><p className="text-lg font-semibold text-amber-700">{eur(projet.engage)}{projet.engage_en_cours > 0 && <span className="block text-xs font-normal text-slate-400">+{eur(projet.engage_en_cours)} en cours</span>}</p></div>
            <div><p className="text-xs text-slate-500">Restant</p><p className={`text-lg font-semibold ${projet.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(projet.restant)}</p></div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${projet.restant < 0 ? 'bg-red-500' : 'bg-navy-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </Card>
      </div>

      {projet.description && (
        <Card className="mb-6">
          <CardHeader title="Description" />
          <p className="whitespace-pre-wrap px-5 py-4 text-sm text-slate-700">{projet.description}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Décisions rattachées */}
        <Card>
          <CardHeader title="Décisions rattachées" subtitle={`${projet.decisions.length} décision(s)`} />
          <ul className="divide-y divide-navy-50">
            {projet.decisions.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Aucune décision rattachée.</li>}
            {projet.decisions.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link to={`/registre/${d.id}`} className="min-w-0 truncate text-sm font-medium text-navy-700 hover:underline">
                  <span className="text-slate-400">{d.numero}</span> · {d.titre}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {d.montant_engage != null && <span className="text-sm text-slate-600">{eur(d.montant_engage)}</span>}
                  <StatutBadge statut={d.statut} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Documents partagés */}
        <Card>
          <CardHeader title="Documents partagés" />
          <div className="px-5 py-4">
            {(projet.documents || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucun document.</p>
            ) : (
              <ul className="space-y-2">
                {projet.documents.map((doc) => (
                  <li key={doc.id}>
                    <a href={doc.dataUrl} download={doc.name} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm hover:bg-navy-50/50">
                      <span className="truncate text-navy-700">{doc.name}</span>
                      <span className="text-xs text-slate-400">{Math.round((doc.size || 0) / 1024)} Ko</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            {canManage && <p className="mt-2 text-xs text-slate-400">Ajout / retrait via « Modifier ».</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
