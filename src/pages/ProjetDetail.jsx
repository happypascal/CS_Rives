import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Spinner, eur } from '../components/ui'
import { ProjetStatutBadge, StatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadDocument } from '../lib/documents'

export default function ProjetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [projet, setProjet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [docError, setDocError] = useState('')

  // Bucket privé : l'URL est signée au clic, un échec doit se voir.
  const openDoc = async (doc) => {
    setDocError('')
    try {
      await downloadDocument(doc)
    } catch (err) {
      setDocError(`« ${doc.name} » n’a pas pu être ouvert : ${err.message}`)
    }
  }

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

  // Dès qu'une décision ENREGISTRÉE est rattachée, le projet n'est plus effaçable.
  // Deux raisons qui se rejoignent : l'argent engagé vient forcément d'une décision
  // enregistrée et adoptée ; et la suppression détache les décisions (projet_id à
  // null), ce qui MODIFIERAIT une délibération figée au registre légal.
  const decisionsEnregistrees = projet.decisions.filter((d) => d.enregistree)
  const canDelete = canManage && decisionsEnregistrees.length === 0

  const del = async () => {
    if (!confirm(`Supprimer le projet « ${projet.nom} » ? Les décisions et les résolutions rattachées seront détachées (elles ne sont pas supprimées).`)) return
    try {
      await repo.deleteProjet(id)
      navigate('/projets')
    } catch (e) {
      alert(e.message)
    }
  }

  const pct = projet.alloue > 0 ? Math.min(100, Math.round((projet.engage / projet.alloue) * 100)) : 0

  return (
    <div>
      <PageHeader
        title={projet.nom}
        subtitle={projet.ags?.length ? `Financé par ${projet.ags.map((a) => a.numero).join(' · ')}` : 'Aucune résolution rattachée'}
        actions={
          canManage && (
            <>
              <Link to={`/projets/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>
              {canDelete ? (
                <Button variant="danger" onClick={del}>Supprimer</Button>
              ) : (
                <span className="text-xs text-slate-400" title="Une décision enregistrée y est rattachée">
                  🔒 non supprimable
                </span>
              )}
            </>
          )
        }
      />

      {canManage && !canDelete && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          Projet non supprimable : {decisionsEnregistrees.length} décision(s) enregistrée(s) y sont rattachées
          {projet.engage > 0 && <> et {eur(projet.engage)} y sont engagés</>}. Une décision enregistrée est figée au
          registre : elle ne peut pas être détachée de son projet.
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><ProjetStatutBadge statut={projet.statut} /></div>
          {/* Le statut est dérivé : dire d'où il vient, sinon il paraît arbitraire. */}
          {projet.statut_decision ? (
            <p className="mt-1 text-xs text-slate-500">
              Par la décision{' '}
              <Link to={`/registre/${projet.statut_decision.decision_id}`} className="text-navy-600 underline">
                {projet.statut_decision.numero}
              </Link>
              {projet.statut_decision.date && <> du {formatDate(projet.statut_decision.date)}</>}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              {projet.engage > 0 ? 'Des décisions y engagent de l’argent' : 'Rien d’engagé à ce jour'}
            </p>
          )}
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

      {/* D'où vient l'alloué : le budget n'est stocké nulle part, il est la somme
          des enveloppes votées. L'afficher ligne à ligne est le seul moyen de
          rendre ce total vérifiable — et de montrer qu'une rallonge non encore
          votée ne compte pas. */}
      <Card className="mb-6">
        <CardHeader
          title="Résolutions qui financent ce projet"
          subtitle="Le budget alloué est la somme des enveloppes votées en AG. Il ne se saisit pas : il se rattache."
        />
        <ul className="divide-y divide-navy-50">
          {(!projet.resolutions || projet.resolutions.length === 0) && (
            <li className="px-5 py-6 text-center text-sm text-slate-500">
              Aucune résolution rattachée : ce projet n’a aucun budget. Rattachez-lui une résolution adoptée depuis la fiche de l’AG.
            </li>
          )}
          {projet.resolutions?.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link to={`/ag/${r.ag_id}`} className="text-sm font-medium text-navy-700 hover:underline">
                  {r.ag_numero} — résolution n° {r.numero}
                </Link>
                <p className="truncate text-xs text-slate-500">{r.titre}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${r.compte_dans_alloue ? 'text-navy-800' : 'text-slate-400 line-through'}`}>
                  {r.budget_alloue == null ? '—' : eur(r.budget_alloue)}
                </p>
                {!r.compte_dans_alloue && (
                  <p className="text-xs text-amber-700">non voté — hors budget</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

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
                    <button type="button" onClick={() => openDoc(doc)} className="flex w-full cursor-pointer items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-navy-50/50">
                      <span className="truncate text-navy-700">{doc.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-slate-400">{Math.round((doc.size || 0) / 1024)} Ko</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {docError && <p className="mt-2 text-xs text-red-600">{docError}</p>}
            {canManage && <p className="mt-2 text-xs text-slate-400">Ajout / retrait via « Modifier ».</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
