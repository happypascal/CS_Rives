import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Badge, Spinner, Modal, eur } from '../components/ui'
import { StatutBadge, VoteBadge, SignatureBadge } from '../components/badges'
import { formatDate, formatDateTime, todayISO } from '../lib/format'
import { tally, tallySummary, VOTE_VALUES, VOTE_LABELS } from '../lib/decisionLogic'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadDecisionPDF } from '../lib/pdf'
import { decisionShareText, whatsappShareUrl } from '../lib/share'
import { TEST_VOTES } from '../lib/config'

// Membres actifs à une date ISO (date_election <= date <= date_fin|∞).
function activeMembersAt(members, dateISO) {
  return members.filter((m) => {
    const elected = !m.date_election || m.date_election <= dateISO
    const ended = m.date_fin && m.date_fin < dateISO
    return elected && !ended
  })
}

export default function DecisionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState(null)
  const [members, setMembers] = useState([])
  const [ag, setAg] = useState(null)
  const [agBudgets, setAgBudgets] = useState([])
  const [projets, setProjets] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmRecord, setConfirmRecord] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [share, setShare] = useState(false)
  const [qText, setQText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')

  const reload = useCallback(async () => {
    try {
      const [d, m, budgets, projs] = await Promise.all([
        repo.getDecision(id),
        repo.listMembres().catch(() => []),
        repo.listAGBudgets().catch(() => []),
        repo.listProjets().catch(() => []),
      ])
      setDecision(d)
      setMembers(m)
      setAgBudgets(budgets)
      setProjets(projs)
      if (d?.ag_id) {
        const a = await repo.getAG(d.ag_id).catch(() => null)
        setAg(a)
      } else {
        setAg(null)
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />
  if (!decision) {
    return (
      <div>
        <PageHeader title="Décision introuvable" />
        <Link to="/registre" className="text-navy-600 underline">← Retour au registre</Link>
      </div>
    )
  }

  const locked = decision.enregistree
  const isOwner = decision.created_by && decision.created_by === user?.membre_id
  const resolution = ag?.resolutions?.find((r) => r.id === decision.resolution_id) || null
  const budget = agBudgets.find((b) => b.resolution_id === decision.resolution_id) || null
  const projet = decision.projet_id ? projets.find((p) => p.id === decision.projet_id) : null
  const composition = decision.composition_snapshot?.length
    ? decision.composition_snapshot
    : activeMembersAt(members, decision.date_publication)
  const compIds = composition.map((m) => m.id)
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))
  const snapById = Object.fromEntries(composition.map((m) => [m.id, m]))
  const nameOf = (mid) => {
    const m = snapById[mid] || memberById[mid]
    return m ? `${m.prenom} ${m.nom}` : 'Membre'
  }

  const voteByMember = Object.fromEntries(decision.votes.map((v) => [v.membre_id, v]))
  // Art. 15 : la voix du président départage un partage — il faut donc son vote.
  const presidentId = composition.find((m) => m.role === 'president')?.id
  const t = tally(
    decision.votes.filter((v) => compIds.includes(v.membre_id)),
    composition.length,
    voteByMember[presidentId]?.vote ?? null,
  )

  // L'utilisateur courant vote uniquement pour lui-même, tant que non enregistrée.
  const myId = user?.membre_id
  const iAmInComposition = compIds.includes(myId)
  const myVote = voteByMember[myId]

  // MODE TEST : le président pose le vote de n'importe quel membre. Hors de ce
  // mode, `canVoteFor` se referme sur soi-même — la règle self-only est intacte.
  // La RLS autorise déjà l'écriture (policy `votes_admin`) : seul l'écran filtrait.
  const testVotes = TEST_VOTES && isAdmin && !locked
  const canVoteFor = (membreId) => !locked && (membreId === myId || testVotes)

  const setVoteFor = async (membreId, vote) => {
    setBusy(true)
    const existing = voteByMember[membreId]
    await repo.upsertVote(id, membreId, vote, existing?.commentaire ?? '')
    await reload()
    setBusy(false)
  }
  // Retirer un vote = rendre le membre ABSENT (l'absence est l'absence de ligne,
  // pas une valeur). Indispensable pour éprouver le quorum et le partage des voix.
  const clearVoteFor = async (membreId) => {
    setBusy(true)
    await repo.deleteVote(id, membreId)
    await reload()
    setBusy(false)
  }
  const setMyVote = (vote) => setVoteFor(myId, vote)
  const setCommentFor = async (membreId, commentaire) => {
    const existing = voteByMember[membreId]
    if (!existing) return // il faut d'abord voter
    await repo.upsertVote(id, membreId, existing.vote, commentaire)
    await reload()
  }

  // Suppression : président uniquement, décision NON ENREGISTRÉE, et au plus UN vote.
  //
  // L'enregistrement est le verrou dur : il fait entrer la délibération au registre
  // légal, elle n'est plus effaçable — jamais, par personne.
  // Le seuil « au plus 1 vote » (arbitrage Pascal 2026-07-16, auparavant « aucun vote »)
  // est un garde-fou de saisie, pas une règle statutaire : une décision mal rédigée
  // dont un seul membre a eu le temps de voter reste corrigeable en la supprimant.
  // Au 2e vote, la délibération est réellement engagée à plusieurs → on ne l'efface plus.
  const canDelete = isAdmin && !isMobile && !locked && decision.votes.length <= 1
  const doDelete = async () => {
    setBusy(true)
    try {
      await repo.deleteDecision(id)
      navigate('/registre')
    } catch (e) {
      alert(e.message)
      setBusy(false)
    }
  }

  const doRecord = async () => {
    setBusy(true)
    const snapshot = composition.map((m) => ({ id: m.id, nom: m.nom, prenom: m.prenom, role: m.role, ag_election: m.ag_election, date_election: m.date_election }))
    await repo.recordDecision(id, {
      statut: t.statut,
      quorum_atteint: t.quorumAtteint,
      composition_snapshot: snapshot,
      date_enregistrement: todayISO(),
    })
    setConfirmRecord(false)
    await reload()
    setBusy(false)
  }

  const addQuestion = async () => {
    if (!qText.trim()) return
    await repo.addQA({ decision_id: id, auteur_id: myId, type: 'question', parent_id: null, texte: qText.trim() })
    setQText('')
    await reload()
  }
  const addReponse = async (parentId) => {
    if (!replyText.trim()) return
    await repo.addQA({ decision_id: id, auteur_id: myId, type: 'reponse', parent_id: parentId, texte: replyText.trim() })
    setReplyText('')
    setReplyTo(null)
    await reload()
  }

  const questions = decision.qa.filter((q) => q.type === 'question')
  const reponsesByParent = decision.qa.filter((q) => q.type === 'reponse').reduce((acc, r) => { (acc[r.parent_id] ||= []).push(r); return acc }, {})

  return (
    <div>
      <PageHeader
        title={<span><span className="text-slate-400">{decision.numero}</span> · {decision.titre}</span>}
        subtitle={`Publiée le ${formatDate(decision.date_publication)} · créée par ${nameOf(decision.created_by)}${decision.date_enregistrement ? ' · enregistrée le ' + formatDate(decision.date_enregistrement) : ''}`}
        actions={
          <>
            {/* L'owner porte sa décision : lui seul prévient et relance le CS. */}
            {isOwner && !locked && (
              <Button variant={decision.date_notification ? 'secondary' : 'primary'} onClick={() => setShare(true)}>
                {decision.date_notification ? 'Notifier à nouveau' : 'Prévenir le CS'}
              </Button>
            )}
            <Button variant="secondary" onClick={() => downloadDecisionPDF(decision, { members, votes: decision.votes.filter((v) => compIds.includes(v.membre_id)), qa: decision.qa })}>
              Export PDF
            </Button>
            {isOwner && !locked && !isMobile && (
              <Link to={`/registre/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>
            )}
            {canDelete && (
              <Button variant="danger" onClick={() => setConfirmDelete(true)}>Supprimer</Button>
            )}
          </>
        }
      />

      {/* Bandeau volontairement voyant : une décision votée en mode test puis
          ENREGISTRÉE entrerait au registre légal avec une présence fabriquée, et
          l'enregistrement est irréversible. Le mode doit sauter aux yeux. */}
      {testVotes && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">⚠ Mode test — vote par procuration actif</p>
          <p className="mt-1 text-xs">
            Vous pouvez poser le vote de n’importe quel membre. C’est contraire au vote self-only et à l’article 15
            (« signé par tous les membres présents »). N’enregistrez pas une décision réelle votée ainsi : le registre
            attesterait une présence qui n’a pas eu lieu, et l’enregistrement est définitif.
          </p>
          <p className="mt-1 text-xs font-medium">
            Ce mode est ouvert PAR DÉFAUT le temps de la recette. Pour le refermer dès que les comptes membres existent :
            poser <code className="rounded bg-amber-100 px-1">VITE_TEST_VOTES=false</code> dans Vercel.
          </p>
        </div>
      )}

      {locked && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          Décision enregistrée le {formatDate(decision.date_enregistrement)} — verrouillée (non modifiable).
        </div>
      )}

      {/* Mon vote — bloc proéminent (voter facilement, y compris au mobile). */}
      {iAmInComposition && !locked && (
        <Card className="mb-6 border-navy-200">
          <div className="px-5 py-4">
            <p className="text-sm font-semibold text-navy-800">Votre vote</p>
            <p className="mb-3 text-xs text-slate-500">Modifiable jusqu’à l’enregistrement par le président.</p>
            <div className="grid grid-cols-3 gap-2">
              {VOTE_VALUES.map((val) => {
                const active = myVote?.vote === val
                const activeColor = { pour: 'bg-emerald-600', contre: 'bg-red-600', abstention: 'bg-amber-500' }[val]
                return (
                  <button
                    key={val}
                    onClick={() => setMyVote(val)}
                    disabled={busy}
                    className={[
                      'rounded-md py-3 text-sm font-semibold transition-colors',
                      active ? `${activeColor} text-white shadow` : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
                    ].join(' ')}
                  >
                    {VOTE_LABELS[val]}
                  </button>
                )
              })}
            </div>
            <input
              defaultValue={myVote?.commentaire || ''}
              onBlur={(e) => myVote && e.target.value !== (myVote.commentaire || '') && setMyComment(e.target.value)}
              placeholder={myVote ? 'Commentaire (optionnel)…' : 'Votez d’abord pour ajouter un commentaire'}
              disabled={!myVote}
              className="mt-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-navy-400 focus:outline-none disabled:bg-slate-50"
            />
            {myVote && <p className="mt-2 text-xs text-emerald-700">Vote enregistré : {VOTE_LABELS[myVote.vote]}.</p>}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Décision" actions={<StatutBadge statut={decision.statut} />} />
            <div className="rich-text px-5 py-4 text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: decision.description }} />
            <div className="grid gap-px border-t border-navy-100 bg-navy-100 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Publication" value={formatDate(decision.date_publication)} />
              <Info label="Limite de réponse" value={formatDate(decision.date_limite_reponse)} />
              <Info label="Notifié au CS" value={decision.date_notification ? formatDate(decision.date_notification) : '—'} />
              <Info label="Enregistrement" value={decision.date_enregistrement ? formatDate(decision.date_enregistrement) : '—'} />
            </div>
          </Card>

          {/* Votes */}
          <Card>
            <CardHeader
              title="Vote du Conseil Syndical"
              subtitle={locked ? 'Vote clos — composition figée.' : 'Chaque membre vote pour lui-même. Le président enregistre la décision.'}
              actions={
                isAdmin && !locked && !isMobile && (
                  <Button size="sm" onClick={() => setConfirmRecord(true)} disabled={busy || !t.quorumAtteint} title={!t.quorumAtteint ? 'Quorum non atteint' : ''}>
                    Enregistrer la décision
                  </Button>
                )
              }
            />
            {isAdmin && !locked && !t.quorumAtteint && (
              <p className="border-b border-amber-100 bg-amber-50 px-5 py-2 text-xs text-amber-700">
                Quorum non atteint : {t.votants}/{t.activeCount} membres ont voté. L’enregistrement sera possible dès que &gt; 50 % auront voté.
              </p>
            )}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Membre</th>
                    <th className="px-4 py-2.5 font-medium">Vote</th>
                    <th className="px-4 py-2.5 font-medium">Commentaire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-50">
                  {composition.map((m) => {
                    const v = voteByMember[m.id]
                    const isMe = m.id === myId
                    const editable = canVoteFor(m.id)
                    const parProcuration = editable && !isMe
                    return (
                      <tr key={m.id} className={isMe ? 'bg-navy-50/40' : parProcuration ? 'bg-amber-50/40' : ''}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-700">{m.prenom} {m.nom}</span>
                          {m.role === 'president' && <span className="ml-2 text-xs text-slate-400">(président)</span>}
                          {isMe && <span className="ml-2 text-xs text-navy-500">— vous</span>}
                        </td>
                        <td className="px-4 py-3">
                          {editable ? (
                            <div className="flex flex-wrap gap-1">
                              {VOTE_VALUES.map((val) => (
                                <button key={val} onClick={() => setVoteFor(m.id, val)} disabled={busy}
                                  className={['rounded px-2 py-1 text-xs font-medium transition-colors', v?.vote === val ? 'bg-navy-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'].join(' ')}>
                                  {VOTE_LABELS[val]}
                                </button>
                              ))}
                              {/* Rendre le membre absent : sans ça, impossible de
                                  tester un quorum manqué ou un partage des voix. */}
                              {v && (
                                <button onClick={() => clearVoteFor(m.id)} disabled={busy} title="Retirer le vote (membre absent)"
                                  className="rounded px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600">
                                  ✕
                                </button>
                              )}
                            </div>
                          ) : v ? (
                            <VoteBadge vote={v.vote} />
                          ) : (
                            <span className="text-xs text-slate-400">non voté</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editable && v ? (
                            <input defaultValue={v?.commentaire || ''} onBlur={(e) => e.target.value !== (v?.commentaire || '') && setCommentFor(m.id, e.target.value)} placeholder="Commentaire…"
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-navy-400 focus:outline-none" />
                          ) : (
                            <span className="text-xs text-slate-500">{v?.commentaire || '—'}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {!iAmInComposition && !locked && (
              <p className="border-t border-navy-100 px-5 py-2 text-xs text-slate-400">Vous n’étiez pas membre actif du CS à la date de publication : vous ne pouvez pas voter cette décision.</p>
            )}
          </Card>

          {/* Q&A */}
          <Card>
            <CardHeader title="Questions & réponses" />
            <div className="space-y-4 px-5 py-4">
              {questions.length === 0 && <p className="text-sm text-slate-500">Aucune question.</p>}
              {questions.map((question) => (
                <div key={question.id} className="rounded-md border border-navy-100 bg-navy-50/30 p-3">
                  <p className="text-sm text-slate-800"><span className="font-medium text-navy-700">{nameOf(question.auteur_id)}</span><span className="ml-2 text-xs text-slate-400">{formatDateTime(question.created_at)}</span></p>
                  <p className="mt-1 text-sm text-slate-700">{question.texte}</p>
                  {(reponsesByParent[question.id] || []).map((r) => (
                    <div key={r.id} className="mt-2 ml-4 border-l-2 border-navy-200 pl-3">
                      <p className="text-xs"><span className="font-medium text-navy-700">{nameOf(r.auteur_id)}</span><span className="ml-2 text-slate-400">{formatDateTime(r.created_at)}</span></p>
                      <p className="text-sm text-slate-700">{r.texte}</p>
                    </div>
                  ))}
                  {replyTo === question.id ? (
                    <div className="mt-2 ml-4 flex flex-wrap gap-2">
                      <input value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Votre réponse…" className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-navy-400 focus:outline-none" />
                      <Button size="sm" onClick={() => addReponse(question.id)}>Répondre</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText('') }}>Annuler</Button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyTo(question.id)} className="mt-2 ml-4 text-xs text-navy-600 underline">Répondre</button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Poser une question…" className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-navy-400 focus:outline-none" />
                <Button onClick={addQuestion}>Publier</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Résultat" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="grid grid-cols-3 gap-2">
                {VOTE_VALUES.map((val) => (
                  <div key={val} className="rounded bg-slate-50 px-2 py-2 text-center">
                    <p className="text-xs text-slate-500">{VOTE_LABELS[val]}</p>
                    <p className="text-lg font-semibold text-navy-800">{t.counts[val]}</p>
                  </div>
                ))}
              </div>
              <div className="rounded border border-navy-100 px-3 py-2">
                <p className="text-xs text-slate-500">Quorum ({t.votants}/{t.activeCount} ont voté)</p>
                <p className={t.quorumAtteint ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{t.quorumAtteint ? 'Atteint' : 'Non atteint'}</p>
              </div>
              <div className="text-center">
                {locked ? <StatutBadge statut={decision.statut} /> : (
                  <Badge tone={t.quorumAtteint ? (t.adoptee ? 'green' : 'red') : 'gray'}>
                    {t.quorumAtteint ? `Projection : ${t.adoptee ? 'Adoptée' : 'Rejetée'}` : 'En attente de quorum'}
                  </Badge>
                )}
                <p className="mt-1 text-xs text-slate-400">{tallySummary(t.counts)}</p>
              </div>
            </div>
          </Card>

          {(decision.montant_engage != null || decision.ag_id || projet) && (
            <Card>
              <CardHeader title="Budget & rattachement" />
              <dl className="divide-y divide-navy-50 text-sm">
                {projet && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <dt className="text-slate-500">Projet</dt>
                    <dd><Link to={`/projets/${projet.id}`} className="font-medium text-navy-700 hover:underline">{projet.nom}</Link></dd>
                  </div>
                )}
                {ag && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <dt className="text-slate-500">AG rattachée</dt>
                    <dd><Link to={`/ag/${ag.id}`} className="font-medium text-navy-700 hover:underline">{ag.numero}</Link></dd>
                  </div>
                )}
                {resolution && (
                  <div className="flex items-center justify-between gap-3 px-5 py-3">
                    <dt className="text-slate-500">Résolution</dt>
                    <dd className="text-right text-slate-700">N° {resolution.numero} — {resolution.titre}</dd>
                  </div>
                )}
                {decision.montant_engage != null && (
                  <div className="flex items-center justify-between px-5 py-3">
                    <dt className="text-slate-500">Montant engagé</dt>
                    <dd className="font-medium text-navy-800">{eur(decision.montant_engage)}</dd>
                  </div>
                )}
              </dl>
              {(projet || budget) && (
                <div className="border-t border-navy-100 px-5 py-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
                    {projet ? `Projet « ${projet.nom} »` : `Budget « ${budget.intitule} »`}
                  </p>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="text-slate-500">Alloué</p><p className="font-semibold text-navy-800">{eur((projet || budget).alloue)}</p></div>
                    <div><p className="text-slate-500">Engagé</p><p className="font-semibold text-amber-700">{eur((projet || budget).engage)}</p></div>
                    <div><p className="text-slate-500">Restant</p><p className="font-semibold text-emerald-700">{eur((projet || budget).restant)}</p></div>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Documents */}
          <Card>
            <CardHeader title="Pièces jointes" />
            <div className="px-5 py-4">
              {(decision.documents || []).length === 0 ? (
                <p className="text-sm text-slate-500">Aucune pièce jointe.</p>
              ) : (
                <ul className="space-y-2">
                  {decision.documents.map((doc) => (
                    <li key={doc.id}>
                      <a href={doc.dataUrl} download={doc.name} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm hover:bg-navy-50/50">
                        <span className="truncate text-navy-700">{doc.name}</span>
                        <span className="text-xs text-slate-400">{Math.round((doc.size || 0) / 1024)} Ko</span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              {isAdmin && !locked && <p className="mt-2 text-xs text-slate-400">Ajout / retrait via « Modifier ».</p>}
            </div>
          </Card>

          <Card>
            <CardHeader title="Signature électronique" />
            <div className="space-y-2 px-5 py-4 text-sm">
              {decision.signature_batch ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Lot</span>
                    <SignatureBadge statut={decision.signature_batch.statut} />
                  </div>
                  <p className="text-xs text-slate-500">{decision.signature_batch.titre || decision.signature_batch.yousign_request_id}</p>
                  {decision.signature_batch.signed_at && <p className="text-xs text-slate-500">Signé le {formatDateTime(decision.signature_batch.signed_at)}</p>}
                </>
              ) : (
                <p className="text-xs text-slate-500">
                  La signature se fait <strong>par lot</strong> depuis le registre : sélectionnez les décisions puis « Envoyer pour signature ».{' '}
                  <Link to="/registre" className="text-navy-600 underline">Aller au registre</Link>
                </p>
              )}
            </div>
          </Card>

          {decision.status_history?.length > 0 && (
            <Card>
              <CardHeader title="Historique" />
              <ul className="space-y-2 px-5 py-4 text-xs text-slate-600">
                {decision.status_history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-2">
                    <span>{h.ancien_statut} → <strong>{h.nouveau_statut}</strong></span>
                    <span className="text-slate-400">{formatDate(h.changed_at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <ShareModal
        open={share}
        onClose={() => setShare(false)}
        decision={decision}
        onShared={async () => { await repo.markDecisionNotified(id); await reload() }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Supprimer la décision"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Annuler</Button>
            <Button variant="danger" onClick={doDelete} disabled={busy}>Supprimer définitivement</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-600">
          <p>Supprimer définitivement la décision <strong>{decision.numero}</strong> « {decision.titre} » ?</p>
          <p className="text-xs text-slate-400">Cette action est irréversible. Seules les décisions sans aucun vote peuvent être supprimées.</p>
        </div>
      </Modal>

      <Modal
        open={confirmRecord}
        onClose={() => setConfirmRecord(false)}
        title="Enregistrer la décision"
        footer={<><Button variant="secondary" onClick={() => setConfirmRecord(false)}>Annuler</Button><Button onClick={doRecord} disabled={busy || !t.quorumAtteint}>Confirmer l’enregistrement</Button></>}
      >
        <div className="space-y-2 text-sm text-slate-600">
          <p>L’enregistrement <strong>acte définitivement</strong> la décision : composition et vote figés, plus aucune modification possible.</p>
          <ul className="list-disc pl-5">
            <li>{tallySummary(t.counts)}</li>
            <li>Quorum : {t.quorumAtteint ? 'atteint' : 'NON atteint'} ({t.votants}/{t.activeCount})</li>
            <li>Majorité requise : {Math.floor(t.votants / 2) + 1} voix sur {t.votants} présents (art. 15 — abstentions comprises)</li>
            {t.partage && (
              <li>
                Partage des voix → <strong>voix prépondérante du président</strong> ({t.presidentVote ? VOTE_LABELS[t.presidentVote] : 'n’a pas voté → rejet'}).
              </li>
            )}
            <li>Statut final : <strong>{t.statut === 'adoptee' ? 'Adoptée' : 'Rejetée'}</strong></li>
          </ul>
        </div>
      </Modal>
    </div>
  )
}

// Partage manuel dans le groupe WhatsApp du CS : le texte est affiché tel qu'il
// sera envoyé, avec une copie presse-papier en repli (WhatsApp Web non connecté,
// envoi par un autre canal…).
function ShareModal({ open, onClose, decision, onShared }) {
  const [copied, setCopied] = useState(false)
  const text = decisionShareText(decision)
  const dejaNotifiee = Boolean(decision.date_notification)

  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    await onShared()
  }

  const openWhatsApp = async () => {
    window.open(whatsappShareUrl(text), '_blank', 'noopener')
    onClose()
    await onShared()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={dejaNotifiee ? 'Notifier à nouveau le CS' : 'Prévenir le Conseil Syndical'}
      footer={
        <>
          <Button variant="secondary" onClick={copy}>{copied ? 'Copié ✓' : 'Copier le message'}</Button>
          <Button onClick={openWhatsApp}>Ouvrir WhatsApp</Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        {dejaNotifiee && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Déjà notifiée le {formatDateTime(decision.date_notification)}. Continuer enverra une <strong>relance</strong>.
          </p>
        )}
        <p>WhatsApp s’ouvre avec ce message pré-rempli : choisissez le groupe du CS, puis envoyez.</p>
        <pre className="whitespace-pre-wrap rounded-md border border-navy-100 bg-navy-50/60 px-3 py-2 font-sans text-xs text-slate-700">{text}</pre>
        <p className="text-xs text-slate-400">Le lien exige une connexion à l’app : seuls les membres du CS peuvent ouvrir la décision.</p>
      </div>
    </Modal>
  )
}

function Info({ label, value }) {
  return (
    <div className="bg-white px-4 py-2.5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-700">{value}</p>
    </div>
  )
}
