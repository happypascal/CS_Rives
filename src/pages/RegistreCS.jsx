import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, EmptyState } from '../components/ui'
import { StatutBadge, SignatureBadge } from '../components/badges'
import { decisionResume } from '../lib/decisionResume'
import { formatDate, todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadRegistrePDF } from '../lib/pdf'

export default function RegistreCS() {
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [batches, setBatches] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [allVotes, setAllVotes] = useState([])
  const [allQA, setAllQA] = useState([])
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [year, setYear] = useState('all')
  const [statut, setStatut] = useState('all')
  const [q, setQ] = useState('')
  const [onlyToVote, setOnlyToVote] = useState(false)
  const [exporting, setExporting] = useState(false)

  const reload = async () => {
    setError('')
    try {
      const [d, m, b, mv, p, ab, av, qa] = await Promise.all([
        repo.listDecisions(),
        repo.listMembres(),
        // Les lots servent uniquement à afficher le statut de signature dans la
        // colonne dédiée — la gestion des signatures vit sur sa propre page.
        repo.listSignatureBatches(),
        user?.membre_id ? repo.listMyVotes(user.membre_id) : Promise.resolve([]),
        // Nom du projet / libellé de l'enveloppe : sans eux le résumé dirait
        // « Engage 20 000 € » sans dire sur quoi. Secondaires — un échec ne doit
        // pas vider l'écran, le résumé se dégrade proprement.
        repo.listProjets().catch(() => []),
        repo.listAGBudgets().catch(() => []),
        // Tous les votes : sert juste à afficher « votants / actifs » par ligne.
        // Secondaire — un échec dégrade le compteur, pas la page.
        repo.listVotes().catch(() => []),
        // Toutes les Q/R : pour compter les questions sans réponse. Secondaire.
        repo.listQA().catch(() => []),
      ])
      setDecisions(d)
      setMembers(m)
      setBatches(b)
      setMyVotes(mv)
      setProjets(p)
      setAgBudgets(ab)
      setAllVotes(av)
      setAllQA(qa)
    } catch (e) {
      // Sans ce catch, l'échec d'UNE lecture (session expirée, RLS, réseau) faisait
      // rejeter tout le Promise.all : la page restait VIDE en silence et l'utilisateur
      // croyait « aucune décision » alors que le chargement avait planté. On rend
      // l'échec visible — c'est un registre légal, l'invisible est le pire.
      setError(e?.message || 'Erreur inconnue au chargement des décisions.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Suis-je membre actif à une date ISO donnée ?
  const me = members.find((m) => m.id === user?.membre_id)
  const iAmActiveAt = (dateISO) => {
    if (!me) return false
    const elected = !me.date_election || me.date_election <= dateISO
    const ended = me.date_fin && me.date_fin < dateISO
    return elected && !ended
  }
  const myVotedSet = useMemo(() => new Set(myVotes.map((v) => v.decision_id)), [myVotes])
  // Décision qui attend MON vote : ouverte, je suis actif, je n'ai pas voté.
  const needsMyVote = (d) => !d.enregistree && iAmActiveAt(d.date_publication) && !myVotedSet.has(d.id)
  // En retard pour moi : mon vote est attendu et la date limite est dépassée.
  const overdueForMe = (d) => needsMyVote(d) && d.date_limite_reponse && d.date_limite_reponse < todayISO()

  const batchByDecision = useMemo(() => {
    const map = {}
    for (const b of batches) for (const did of b.decision_ids) map[did] = b
    return map
  }, [batches])

  // Progression du vote par décision : votants (lignes de vote) / membres actifs
  // concernés. Même dénominateur que le quorum du détail (art. 15) : composition
  // FIGÉE si la décision est enregistrée, sinon actifs à la date de publication.
  const votesBreakdownByDecision = useMemo(() => {
    const map = {}
    for (const v of allVotes) {
      const b = (map[v.decision_id] ||= { pour: 0, contre: 0, abstention: 0 })
      if (v.vote === 'pour') b.pour++
      else if (v.vote === 'contre') b.contre++
      else if (v.vote === 'abstention') b.abstention++
    }
    return map
  }, [allVotes])
  const activeCountFor = (d) =>
    d.composition_snapshot?.length
      ? d.composition_snapshot.length
      : members.filter((m) => (!m.date_election || m.date_election <= d.date_publication) && !(m.date_fin && m.date_fin < d.date_publication)).length

  // Détail des votes d'une décision : « P pour · C contre · A abst. · N non voté ».
  // « non voté » = actifs concernés − (pour + contre + abstention).
  const renderVotes = (d) => {
    const b = votesBreakdownByDecision[d.id] || { pour: 0, contre: 0, abstention: 0 }
    const nonVote = Math.max(0, activeCountFor(d) - b.pour - b.contre - b.abstention)
    return (
      <span className="text-xs leading-tight text-slate-500">
        <span className="font-medium text-emerald-700">{b.pour}</span> pour · <span className="font-medium text-red-700">{b.contre}</span> contre · <span className="font-medium text-amber-700">{b.abstention}</span> abst. · <span className="font-medium text-slate-400">{nonVote}</span> non voté
      </span>
    )
  }

  // Questions sans réponse par décision : une question (type 'question') sans
  // aucune réponse (type 'reponse' pointant sur elle via parent_id). Utile pour
  // signaler à l'owner qu'on attend une réponse avant le vote.
  const unansweredByDecision = useMemo(() => {
    const answered = new Set(allQA.filter((x) => x.type === 'reponse' && x.parent_id).map((x) => x.parent_id))
    const map = {}
    for (const x of allQA) {
      if (x.type === 'question' && !answered.has(x.id)) map[x.decision_id] = (map[x.decision_id] || 0) + 1
    }
    return map
  }, [allQA])

  const years = useMemo(() => [...new Set(decisions.map((d) => d.date_publication?.slice(0, 4)))].filter(Boolean).sort().reverse(), [decisions])

  const toVoteCount = useMemo(() => decisions.filter(needsMyVote).length, [decisions, myVotedSet, me]) // eslint-disable-line react-hooks/exhaustive-deps

  // Contexte du résumé : de quoi nommer la cible d'un engagement. Défini ici parce
  // que seule la page a les projets et les enveloppes ; les libs n'y accèdent pas.
  const contexteOf = useMemo(() => {
    const projetById = Object.fromEntries(projets.map((p) => [p.id, p]))
    const budgetByRes = Object.fromEntries(agBudgets.map((b) => [b.resolution_id, b]))
    return (d) => {
      const projet = d.projet_id ? projetById[d.projet_id] : null
      const budget = d.resolution_id ? budgetByRes[d.resolution_id] : null
      return {
        projetNom: projet?.nom,
        cibleLabel: projet
          ? `le projet « ${projet.nom} »`
          : budget
            ? `l’enveloppe « ${budget.intitule} » (${budget.ag_numero})`
            : undefined,
      }
    }
  }, [projets, agBudgets])
  const resumeOf = (d) => decisionResume(d, contexteOf(d))

  const filtered = useMemo(
    () =>
      decisions.filter((d) => {
        if (onlyToVote && !needsMyVote(d)) return false
        if (year !== 'all' && d.date_publication?.slice(0, 4) !== year) return false
        if (statut !== 'all' && d.statut !== statut) return false
        if (q && !`${d.numero} ${d.titre}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [decisions, year, statut, q, onlyToVote, myVotedSet, me], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const exportAll = async () => {
    setExporting(true)
    try {
      const details = await Promise.all(filtered.map((d) => repo.getDecision(d.id)))
      const byId = Object.fromEntries(details.map((d) => [d.id, d]))
      downloadRegistrePDF(filtered, {
        members,
        getDetail: (d) => ({ votes: byId[d.id]?.votes || [], qa: byId[d.id]?.qa || [] }),
        getContexte: contexteOf,
      })
    } finally {
      setExporting(false)
    }
  }

  if (loading) return <Spinner />

  // Chargement en échec : on l'affiche au lieu de laisser un écran vide qui se
  // lit à tort comme « aucune décision ». Cas typique : session expirée côté
  // client — un « Réessayer » après reconnexion suffit souvent.
  if (error) {
    return (
      <div>
        <PageHeader title="Décisions du Conseil Syndical" subtitle="Cœur du registre : décisions courantes du CS (hors résolutions d’AG)." />
        <Card className="p-6">
          <p className="text-sm font-semibold text-red-700">Impossible de charger les décisions.</p>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
          <p className="mt-2 text-xs text-slate-500">Si le problème persiste : déconnectez-vous puis reconnectez-vous, ou rafraîchissez la page (Ctrl/Cmd + Maj + R).</p>
          <div className="mt-4"><Button onClick={() => { setLoading(true); reload() }}>Réessayer</Button></div>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Décisions du Conseil Syndical"
        subtitle="Cœur du registre : décisions courantes du CS (hors résolutions d’AG)."
        actions={
          <>
            <Button variant={onlyToVote ? 'primary' : 'secondary'} onClick={() => setOnlyToVote((v) => !v)}>
              À voter{toVoteCount > 0 ? ` (${toVoteCount})` : ''}
            </Button>
            {!isMobile && <Button variant="secondary" onClick={exportAll} disabled={exporting || filtered.length === 0}>{exporting ? 'Génération…' : 'Export PDF'}</Button>}
            {!isMobile && <Link to="/registre/nouvelle"><Button>+ Nouvelle décision</Button></Link>}
          </>
        }
      />

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input placeholder="Rechercher (n° ou titre)…" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="all">Toutes les années</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
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
        <EmptyState title="Aucune décision" hint="Aucune décision ne correspond aux filtres." action={<Link to="/registre/nouvelle"><Button>Créer une décision</Button></Link>} />
      ) : isMobile ? (
        /* Mobile : une carte par décision, tapable en entier. Le tableau à 7
           colonnes ne tenait pas dans l'écran et défilait horizontalement — or
           c'est au téléphone que les membres votent réellement. Même contenu et
           même hiérarchie que la colonne « Titre » du tableau (résumé sur trois
           niveaux) ; les dates passent en pied de carte, en clair. */
        <ul className="space-y-3">
          {filtered.map((d) => {
            const r = resumeOf(d)
            const overdue = overdueForMe(d)
            const toVote = needsMyVote(d)
            const toNotify = d.created_by === user?.membre_id && !d.enregistree && !d.date_notification
            const batch = batchByDecision[d.id]
            return (
              <li key={d.id}>
                <Link
                  to={`/registre/${d.id}`}
                  className={`block rounded-lg border p-4 shadow-sm active:bg-navy-50 ${overdue ? 'border-red-200 bg-red-50' : 'border-navy-100 bg-white'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-slate-500">{d.numero}</span>
                    <StatutBadge statut={d.statut} />
                  </div>
                  <p className="mt-1 font-medium text-navy-800">{r.titre}</p>
                  {r.action && <p className="mt-0.5 text-xs font-medium text-navy-700">{r.action}</p>}
                  {r.extrait && <p className="mt-1 text-xs leading-snug text-slate-500">{r.extrait}</p>}
                  {(toVote || toNotify || unansweredByDecision[d.id] > 0) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {toVote && (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {overdue ? 'à voter — en retard' : 'à voter'}
                        </span>
                      )}
                      {toNotify && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">à notifier</span>}
                      {unansweredByDecision[d.id] > 0 && <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">{unansweredByDecision[d.id]} question{unansweredByDecision[d.id] > 1 ? 's' : ''} sans réponse</span>}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>Publiée le {formatDate(d.date_publication)}</span>
                    {renderVotes(d)}
                    {d.date_limite_reponse && (
                      <span className={overdue ? 'font-semibold text-red-700' : undefined}>
                        Réponse avant le {formatDate(d.date_limite_reponse)}
                      </span>
                    )}
                    {batch && <SignatureBadge statut={batch.statut} />}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium">Dates</th>
                  <th className="px-4 py-2.5 font-medium">Titre</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Votes</th>
                  <th className="px-4 py-2.5 font-medium">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((d) => {
                  const overdue = overdueForMe(d)
                  const toVote = needsMyVote(d)
                  return (
                  <tr key={d.id} className={overdue ? 'bg-red-50 hover:bg-red-100/60' : 'hover:bg-navy-50/40'}>
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">{d.numero}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                      <div>{formatDate(d.date_publication)}</div>
                      <div className={`text-xs ${overdue ? 'font-semibold text-red-700' : 'text-slate-400'}`}>
                        {d.date_limite_reponse ? <>limite {formatDate(d.date_limite_reponse)}{overdue ? ' ⚠ dépassée' : ''}</> : 'sans limite'}
                      </div>
                    </td>
                    {/* Résumé sur trois niveaux — titre, ce que la décision FAIT,
                        puis un extrait de la description. Le titre seul ne dit ni
                        qu'on engage 20 000 €, ni qu'on suspend un projet. Même
                        résumé que le PDF envoyé en signature (decisionResume). */}
                    <td className="max-w-md px-4 py-3">
                      <Link to={`/registre/${d.id}`} className="font-medium text-navy-700 hover:underline">{resumeOf(d).titre}</Link>
                      {toVote && !overdue && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">à voter</span>}
                      {d.created_by === user?.membre_id && !d.enregistree && !d.date_notification && (
                        <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">à notifier</span>
                      )}
                      {unansweredByDecision[d.id] > 0 && (
                        <span className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 text-xs font-medium text-orange-800">{unansweredByDecision[d.id]} question{unansweredByDecision[d.id] > 1 ? 's' : ''} sans réponse</span>
                      )}
                      {resumeOf(d).action && (
                        <span className="mt-0.5 block text-xs font-medium text-navy-700">{resumeOf(d).action}</span>
                      )}
                      {resumeOf(d).extrait && (
                        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{resumeOf(d).extrait}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
                    <td className="px-4 py-3">{renderVotes(d)}</td>
                    <td className="px-4 py-3">{batchByDecision[d.id] ? <SignatureBadge statut={batchByDecision[d.id].statut} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
