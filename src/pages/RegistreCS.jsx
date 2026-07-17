import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Spinner, EmptyState, Modal } from '../components/ui'
import { StatutBadge, SignatureBadge } from '../components/badges'
import { decisionResume } from '../lib/decisionResume'
import { formatDate, formatDateTime, todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadRegistrePDF } from '../lib/pdf'
import { signatureProvider, isMockSignature } from '../lib/signatureProvider'

export default function RegistreCS() {
  const { isAdmin, user } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [batches, setBatches] = useState([])
  const [myVotes, setMyVotes] = useState([])
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [year, setYear] = useState('all')
  const [statut, setStatut] = useState('all')
  const [q, setQ] = useState('')
  const [onlyToVote, setOnlyToVote] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [sigModal, setSigModal] = useState(false)
  const [sigTitle, setSigTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [d, m, b, mv, p, ab] = await Promise.all([
      repo.listDecisions(),
      repo.listMembres(),
      repo.listSignatureBatches(),
      user?.membre_id ? repo.listMyVotes(user.membre_id) : Promise.resolve([]),
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

  // Sélectionnable pour signature : décision enregistrée, adoptée, pas déjà signée.
  const selectable = (d) => d.enregistree && d.statut === 'adoptee' && batchByDecision[d.id]?.statut !== 'signe'

  const toggle = (idv) => {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(idv)) n.delete(idv)
      else n.add(idv)
      return n
    })
  }

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

  const sendForSignature = async () => {
    setBusy(true)
    try {
      const ids = [...selected]
      const chosen = decisions.filter((d) => ids.includes(d.id))
      // Art. 15 des statuts : le registre est signé par « tous les membres
      // présents à la délibération » — donc tout membre ayant voté, y compris
      // Contre. (Avant : pour/abstention seulement, ce qui violait l'art. 15.)
      const details = await Promise.all(chosen.map((d) => repo.getDecision(d.id)))
      const emails = new Set()
      for (const d of details) {
        for (const v of d.votes) {
          const m = members.find((x) => x.id === v.membre_id)
          if (m?.email) emails.add(m.email)
        }
      }
      const signers = [...emails].map((email) => ({ email }))
      const res = await signatureProvider.createSignatureRequest({ decisionNumero: 'lot-' + Date.now().toString(36), signers })
      await repo.createSignatureBatch({
        titre: sigTitle || `Lot du ${formatDate(new Date().toISOString())}`,
        decision_ids: ids,
        yousign_request_id: res.requestId,
        statut: res.statut,
        signataires: [...emails],
      })
      setSelected(new Set())
      setSigModal(false)
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

  const selectedCount = selected.size

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

      {canManage && selectedCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md border border-navy-200 bg-navy-50 px-4 py-2.5 text-sm">
          <span className="text-navy-800">{selectedCount} décision(s) sélectionnée(s)</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Désélectionner</Button>
            <Button size="sm" onClick={() => setSigModal(true)}>Envoyer pour signature</Button>
          </div>
        </div>
      )}

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
                  {canManage && <th className="px-4 py-2.5" />}
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
                    {canManage && (
                      <td className="px-4 py-3">
                        <input type="checkbox" disabled={!selectable(d)} checked={selected.has(d.id)} onChange={() => toggle(d.id)} title={selectable(d) ? '' : 'Sélectionnable seulement si adoptée, enregistrée et non signée'} />
                      </td>
                    )}
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

      {/* Lots de signature */}
      {batches.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Lots de signature" subtitle="Demandes de signature groupées." />
          <ul className="divide-y divide-navy-50">
            {batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-medium text-navy-800">{b.titre || b.yousign_request_id}</p>
                  <p className="text-xs text-slate-500">{b.decision_ids.length} décision(s) · {(b.signataires || []).length} signataire(s) · créé le {formatDateTime(b.created_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <SignatureBadge statut={b.statut} />
                  {canManage && isMockSignature && b.statut !== 'signe' && (
                    <Button size="sm" variant="secondary" onClick={() => simulateSigned(b.id)}>Simuler signé (démo)</Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={sigModal}
        onClose={() => setSigModal(false)}
        title="Envoyer pour signature"
        footer={<><Button variant="secondary" onClick={() => setSigModal(false)}>Annuler</Button><Button onClick={sendForSignature} disabled={busy}>{busy ? 'Envoi…' : 'Envoyer'}</Button></>}
      >
        <div className="space-y-3 text-sm text-slate-600">
          <p>{selectedCount} décision(s) seront regroupées dans une seule demande de signature. Les signataires sont les membres présents à la délibération, c’est-à-dire tous ceux ayant voté — y compris « Contre » (art. 15).</p>
          <Input label="Titre du lot" value={sigTitle} onChange={(e) => setSigTitle(e.target.value)} placeholder="ex : Décisions du 1er trimestre 2026" />
          {isMockSignature && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Mode démo : aucun email réel n’est envoyé (stub Yousign).</p>}
        </div>
      </Modal>
    </div>
  )
}
