import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Spinner, Button, eur } from '../components/ui'
import { StatutBadge, AGStatutBadge } from '../components/badges'
import { formatDate, formatDateLong } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

export default function Dashboard() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [ags, setAgs] = useState([])
  const [budgets, setBudgets] = useState([])
  const [batches, setBatches] = useState([])
  const [projets, setProjets] = useState([])

  useEffect(() => {
    Promise.all([
      repo.listDecisions().catch(() => []),
      repo.listAG().catch(() => []),
      repo.listAGBudgets().catch(() => []),
      repo.listSignatureBatches().catch(() => []),
      repo.listProjets().catch(() => []),
    ])
      .then(([d, a, b, s, p]) => {
        setDecisions(d)
        setAgs(a)
        setBudgets(b)
        setBatches(s)
        setProjets(p)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const recent = decisions.slice(0, 5)
  const enCours = decisions.filter((d) => !d.enregistree)
  const nextAG = ags.filter((a) => a.statut === 'en_cours').sort((x, y) => (x.date_ag < y.date_ag ? -1 : 1))[0]
  const anyBatchDecisionIds = new Set(batches.flatMap((b) => b.decision_ids))
  const toSign = decisions.filter((d) => d.enregistree && d.statut === 'adoptee' && !anyBatchDecisionIds.has(d.id))
  // ALLOUER ≠ ENGAGER. Le `engage` d'une enveloppe AG additionne deux choses de
  // nature différente : les décisions qui engagent directement, et l'enveloppe
  // transférée à un projet — laquelle n'est pas dépensée, juste affectée. Les
  // présenter sous une seule étiquette « engagé » fait lire comme dépensé un
  // argent qui ne l'est pas. On sépare donc les trois étapes du cheminement :
  // voté en AG → alloué à un projet (ou engagé direct) → engagé par décision.
  const totalVote = budgets.reduce((s, b) => s + Number(b.alloue || 0), 0)
  const totalProjetsAlloue = budgets.reduce((s, b) => s + Number(b.projets_alloue || 0), 0)
  const totalEngageDirect = budgets.reduce((s, b) => s + Number(b.engage_direct || 0), 0)
  // Argent réellement engagé par des décisions : les engagements directs sur une
  // enveloppe + ceux portés par les projets. Les deux ensembles sont disjoints
  // (une décision a un projet_id OU un resolution_id seul) : pas de double compte.
  const totalEngageDecisions = totalEngageDirect + projets.reduce((s, p) => s + Number(p.engage || 0), 0)

  // Le restant se lit à DEUX endroits, et n'en montrer qu'un ment.
  //  - côté AG (`b.restant`) : ce qui n'est ni alloué à un projet, ni engagé direct ;
  //  - côté projet (`p.restant`) : l'enveloppe reçue, moins ce que les décisions
  //    y ont engagé.
  // Une enveloppe entièrement allouée à un projet a un restant AG NUL — l'argent
  // n'a pas disparu, il est disponible sur le projet. N'afficher que le restant AG
  // annonçait donc 0 € alors qu'il restait de quoi dépenser.
  // Identité vérifiée : restantAG + restantProjets == voté − engagé.
  const totalRestantNonAffecte = budgets.reduce((s, b) => s + Number(b.restant || 0), 0)
  const totalRestantProjets = projets.reduce((s, p) => s + Number(p.restant || 0), 0)
  const totalRestantDispo = totalRestantNonAffecte + totalRestantProjets

  const stats = [
    { label: 'Décisions', value: decisions.length, sub: `${enCours.length} en cours` },
    { label: 'Assemblées Générales', value: ags.length, sub: nextAG ? 'prochaine planifiée' : 'aucune à venir' },
    { label: 'Voté en AG', value: eur(totalVote), sub: `${budgets.length} enveloppe(s) adoptée(s)` },
    { label: 'Alloué aux projets', value: eur(totalProjetsAlloue), sub: `${projets.length} projet(s)` },
    { label: 'Engagé par décisions', value: eur(totalEngageDecisions), sub: totalEngageDirect > 0 ? `dont ${eur(totalEngageDirect)} hors projet` : 'décisions enregistrées et adoptées' },
    {
      label: 'Restant disponible',
      value: eur(totalRestantDispo),
      sub: totalRestantProjets > 0 ? `dont ${eur(totalRestantProjets)} sur les projets` : 'non affecté à un projet',
    },
  ]

  return (
    <div>
      <PageHeader
        title={`Bonjour ${user?.prenom || ''}`}
        subtitle="Vue d’ensemble du registre du Conseil Syndical."
        actions={!isMobile && <Link to="/registre/nouvelle"><Button>+ Nouvelle décision</Button></Link>}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
                    <p className="text-xs text-slate-500">{formatDate(d.date_publication)}{d.enregistree ? '' : ' · à enregistrer'}</p>
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
