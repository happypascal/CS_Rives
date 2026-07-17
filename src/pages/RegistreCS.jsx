import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Spinner, EmptyState, Modal } from '../components/ui'
import { StatutBadge, SignatureBadge } from '../components/badges'
import { decisionResume } from '../lib/decisionResume'
import { formatDate, formatDateTime, todayISO, moisCourant } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadRegistrePDF } from '../lib/pdf'
import { signatureProvider, isMockSignature } from '../lib/signatureProvider'

// Plan gratuit Youtrust : 2 demandes/mois, 5 signataires max par demande.
// Ces deux nombres ne sont pas décoratifs — ils bornent ce que le président peut
// faire dans le mois (cf. docs/SPEC_SIGNATURE.md §5).
const YOUTRUST_FREE_DEMANDES_MOIS = 2
const YOUTRUST_FREE_SIGNATAIRES = 5

export default function RegistreCS() {
  const { isAdmin, user } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [batches, setBatches] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [allVotes, setAllVotes] = useState([])
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [year, setYear] = useState('all')
  const [statut, setStatut] = useState('all')
  const [q, setQ] = useState('')
  const [onlyToVote, setOnlyToVote] = useState(false)
  const [exporting, setExporting] = useState(false)
  // Groupe en cours de préparation pour signature (null = modale fermée). Un
  // groupe = un ensemble de décisions au MÊME ensemble de votants ; on n'envoie
  // jamais une sélection libre (art. 15), donc pas de Set de cases cochées.
  const [sigGroup, setSigGroup] = useState(null)
  const [sigTitle, setSigTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(null)

  const reload = async () => {
    const [d, m, b, mv, av, p, ab] = await Promise.all([
      repo.listDecisions(),
      repo.listMembres(),
      repo.listSignatureBatches(),
      user?.membre_id ? repo.listMyVotes(user.membre_id) : Promise.resolve([]),
      // Tous les votes : nécessaires pour grouper les décisions par ensemble de
      // signataires. Secondaire pour l'écran de vote — un échec ne doit pas vider
      // la page, juste priver la section « À faire signer ».
      repo.listVotes().catch(() => []),
      // Nom du projet / libellé de l'enveloppe : sans eux le résumé dirait
      // « Engage 20 000 € » sans dire sur quoi. Secondaires — un échec ne doit
      // pas vider l'écran, le résumé se dégrade proprement.
      repo.listProjets().catch(() => []),
      repo.listAGBudgets().catch(() => []),
    ])
    setDecisions(d)
    setMembers(m)
    setBatches(b)
    setMyVotes(mv)
    setAllVotes(av)
    setProjets(p)
    setAgBudgets(ab)
    setLoading(false)
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

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

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

  // Votants de chaque décision, par id de membre. Le SENS du vote ne compte pas :
  // un Contre était présent, donc signataire (art. 15).
  const votersByDecision = useMemo(() => {
    const map = {}
    for (const v of allVotes) (map[v.decision_id] ||= new Set()).add(v.membre_id)
    return map
  }, [allVotes])

  // Groupes de signature : décisions éligibles regroupées par ensemble EXACT de
  // votants. Le cœur de la conformité art. 15 (cf. docs/SPEC_SIGNATURE.md §3) :
  // l'écran ne propose que des groupes homogènes, donc un lot non conforme (des
  // décisions aux présents différents mélangées) est impossible à construire —
  // on n'a rien à détecter ni à refuser.
  //
  // Éligible = enregistrée, adoptée, pas déjà dans un lot signé.
  const signatureGroups = useMemo(() => {
    const groups = {}
    for (const d of decisions) {
      if (!(d.enregistree && d.statut === 'adoptee' && batchByDecision[d.id]?.statut !== 'signe')) continue
      const voterIds = [...(votersByDecision[d.id] || [])].sort()
      // Une décision adoptée et enregistrée a forcément des votes (quorum) ; ce
      // garde-fou ne sert qu'à ne pas fabriquer un groupe sans signataire.
      if (voterIds.length === 0) continue
      const key = voterIds.join('|')
      ;(groups[key] ||= { key, voterIds, decisions: [] }).decisions.push(d)
    }
    return Object.values(groups)
      .map((g) => ({ ...g, decisions: g.decisions.sort((a, b) => a.numero.localeCompare(b.numero)) }))
      .sort((a, b) => a.decisions[0].numero.localeCompare(b.decisions[0].numero))
  }, [decisions, votersByDecision, batchByDecision])

  // Demandes déjà créées ce mois-ci : le plan gratuit en autorise 2 (cf. quota).
  const demandesCeMois = useMemo(() => {
    const mois = todayISO().slice(0, 7)
    return batches.filter((b) => (b.created_at || '').slice(0, 7) === mois).length
  }, [batches])

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

  // PDF d'un lot : ses décisions seulement. C'est le document que le président
  // dépose dans Youtrust (mode manuel, cf. SPEC §6).
  const downloadBatchPDF = async (batch) => {
    setPdfBusy(batch.id)
    try {
      const ds = decisions.filter((d) => batch.decision_ids.includes(d.id))
      const details = await Promise.all(ds.map((d) => repo.getDecision(d.id)))
      const byId = Object.fromEntries(details.map((d) => [d.id, d]))
      downloadRegistrePDF(ds, {
        members,
        getDetail: (d) => ({ votes: byId[d.id]?.votes || [], qa: byId[d.id]?.qa || [] }),
        getContexte: contexteOf,
      })
    } finally {
      setPdfBusy(null)
    }
  }

  // Titre par défaut « juillet 2026 lot 3 » : le rang est celui de la demande
  // dans le mois, cohérent avec le quota affiché. Éditable — le président peut
  // le remplacer par « Décisions du 1er trimestre ». Recalculé à chaque
  // ouverture, pas figé, pour rester juste si un lot est créé entre-temps.
  const openSigModal = (group) => {
    setSigGroup(group)
    setSigTitle(`${moisCourant()} lot ${demandesCeMois + 1}`)
  }

  const sendForSignature = async () => {
    if (!sigGroup) return
    setBusy(true)
    try {
      const ids = sigGroup.decisions.map((d) => d.id)
      // Signataires = les votants du groupe. Tous partagent le même ensemble par
      // construction — c'est ce qui garantit qu'aucun ne signe une délibération
      // à laquelle il n'a pas participé.
      const emails = sigGroup.voterIds.map((mid) => memberById[mid]?.email).filter(Boolean)
      const signers = emails.map((email) => ({ email }))
      const res = await signatureProvider.createSignatureRequest({ decisionNumero: 'lot-' + Date.now().toString(36), signers })
      await repo.createSignatureBatch({
        titre: sigTitle.trim() || `Lot du ${formatDate(new Date().toISOString())}`,
        decision_ids: ids,
        yousign_request_id: res.requestId,
        statut: res.statut,
        // Figé à l'envoi : la composition du CS peut changer, le registre doit
        // rester fidèle à ce qui a été signé.
        signataires: emails,
      })
      setSigGroup(null)
      setSigTitle('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const simulateSigned = async (batchId) => {
    await repo.markBatchSigned(batchId, 'mock://signed.pdf')
    await reload()
  }

  if (loading) return <Spinner />

  const membersLabel = (ids) => ids.map((id) => { const m = memberById[id]; return m ? `${m.prenom} ${m.nom}` : '?' }).join(', ')

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
                  {(toVote || toNotify) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {toVote && (
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${overdue ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                          {overdue ? 'à voter — en retard' : 'à voter'}
                        </span>
                      )}
                      {toNotify && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600">à notifier</span>}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <span>Publiée le {formatDate(d.date_publication)}</span>
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
                  <th className="px-4 py-2.5 font-medium">Publication</th>
                  <th className="px-4 py-2.5 font-medium">Limite réponse</th>
                  <th className="px-4 py-2.5 font-medium">Titre</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(d.date_publication)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${overdue ? 'font-semibold text-red-700' : 'text-slate-600'}`}>
                      {d.date_limite_reponse ? formatDate(d.date_limite_reponse) : '—'}
                      {overdue && <span className="ml-1 text-xs">⚠ dépassée</span>}
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
                      {resumeOf(d).action && (
                        <span className="mt-0.5 block text-xs font-medium text-navy-700">{resumeOf(d).action}</span>
                      )}
                      {resumeOf(d).extrait && (
                        <span className="mt-0.5 block text-xs leading-snug text-slate-500">{resumeOf(d).extrait}</span>
                      )}
                    </td>
                    <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
                    <td className="px-4 py-3">{batchByDecision[d.id] ? <SignatureBadge statut={batchByDecision[d.id].statut} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* À faire signer — un bloc par ensemble de signataires. On n'envoie qu'un
          groupe entier : l'art. 15 signe par délibération, et proposer une
          sélection libre rouvrirait la porte au lot non conforme. */}
      {canManage && signatureGroups.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="À faire signer"
            subtitle="Décisions adoptées et enregistrées, groupées par membres présents (art. 15). Un envoi = une demande Youtrust."
          />
          <ul className="divide-y divide-navy-50">
            {signatureGroups.map((g) => (
              <li key={g.key} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Signataires ({g.voterIds.length})</p>
                    <p className="text-sm font-medium text-navy-800">{membersLabel(g.voterIds)}</p>
                    <ul className="mt-2 space-y-1">
                      {g.decisions.map((d) => (
                        <li key={d.id} className="text-sm text-slate-600">
                          <Link to={`/registre/${d.id}`} className="text-navy-700 hover:underline">{d.numero}</Link>
                          {' — '}{resumeOf(d).titre}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={() => openSigModal(g)}>Préparer la demande</Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Lots de signature déjà créés */}
      {canManage && batches.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Lots de signature" subtitle="Demandes préparées. Déposer le PDF dans Youtrust, puis marquer le lot signé." />
          <ul className="divide-y divide-navy-50">
            {batches.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-navy-800">{b.titre || b.yousign_request_id}</p>
                  <p className="text-xs text-slate-500">{b.decision_ids.length} décision(s) · créé le {formatDateTime(b.created_at)}</p>
                  {(b.signataires || []).length > 0 && (
                    <p className="mt-1 break-all text-xs text-slate-500">Signataires : {(b.signataires).join(', ')}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <SignatureBadge statut={b.statut} />
                  <Button size="sm" variant="secondary" disabled={pdfBusy === b.id} onClick={() => downloadBatchPDF(b)}>
                    {pdfBusy === b.id ? 'Génération…' : 'PDF du lot'}
                  </Button>
                  {isMockSignature && b.statut !== 'signe' && (
                    <Button size="sm" variant="ghost" onClick={() => simulateSigned(b.id)}>Simuler signé (démo)</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={Boolean(sigGroup)}
        onClose={() => setSigGroup(null)}
        title="Préparer la demande de signature"
        footer={<><Button variant="secondary" onClick={() => setSigGroup(null)}>Annuler</Button><Button onClick={sendForSignature} disabled={busy}>{busy ? 'Préparation…' : 'Créer la demande'}</Button></>}
      >
        {sigGroup && (
          <div className="space-y-3 text-sm text-slate-600">
            <p>
              <strong>{sigGroup.decisions.length} décision(s)</strong> seront regroupées dans une seule demande, signée par les
              {' '}<strong>{sigGroup.voterIds.length} membre(s) présent(s)</strong> à ces délibérations — tous ceux ayant voté, y compris « Contre » (art. 15).
            </p>
            <p className="text-xs">{membersLabel(sigGroup.voterIds)}</p>
            <Input label="Titre du lot" value={sigTitle} onChange={(e) => setSigTitle(e.target.value)} placeholder="ex : Décisions du 1er trimestre 2026" />
            {/* Quota Youtrust : le nombre de demandes du mois EST le budget. */}
            <p className={`rounded px-2 py-1 text-xs ${demandesCeMois >= YOUTRUST_FREE_DEMANDES_MOIS ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-600'}`}>
              {demandesCeMois + 1}ᵉ demande ce mois-ci. Le plan gratuit Youtrust en autorise {YOUTRUST_FREE_DEMANDES_MOIS}.
              {demandesCeMois >= YOUTRUST_FREE_DEMANDES_MOIS && ' Plafond dépassé — le plan One (9 €/mois) en donne 10.'}
            </p>
            {sigGroup.voterIds.length > YOUTRUST_FREE_SIGNATAIRES && (
              <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-700">
                {sigGroup.voterIds.length} signataires — le plan gratuit en accepte {YOUTRUST_FREE_SIGNATAIRES} au maximum par demande.
              </p>
            )}
            {isMockSignature && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Mode démo : aucun email réel n’est envoyé (stub Yousign).</p>}
          </div>
        )}
      </Modal>
    </div>
  )
}
