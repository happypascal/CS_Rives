import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Badge, Spinner, Modal } from '../components/ui'
import { StatutBadge, VoteBadge } from '../components/badges'
import { formatDate, formatDateTime } from '../lib/format'
import { tally, tallySummary, VOTE_VALUES, VOTE_LABELS } from '../lib/decisionLogic'
import { useAuth } from '../lib/AuthContext'
import { downloadDecisionPDF } from '../lib/pdf'
import { signatureProvider, isMockSignature } from '../lib/signatureProvider'

// Members active at a given ISO date (date_election <= date <= date_fin|∞).
function activeMembersAt(members, dateISO) {
  return members.filter((m) => {
    const elected = !m.date_election || m.date_election <= dateISO
    const ended = m.date_fin && m.date_fin < dateISO
    return elected && !ended
  })
}

export default function DecisionDetail() {
  const { id } = useParams()
  const { user, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [decision, setDecision] = useState(null)
  const [members, setMembers] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [qText, setQText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')

  const reload = useCallback(async () => {
    const [d, m] = await Promise.all([repo.getDecision(id), repo.listMembres()])
    setDecision(d)
    setMembers(m)
    setLoading(false)
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

  // Composition to use: frozen snapshot once closed, else live active members.
  const composition = decision.composition_snapshot?.length
    ? decision.composition_snapshot
    : activeMembersAt(members, decision.date_decision)
  const compIds = composition.map((m) => m.id)
  const memberById = Object.fromEntries(members.map((m) => [m.id, m]))
  const snapById = Object.fromEntries(composition.map((m) => [m.id, m]))
  const nameOf = (mid) => {
    const m = snapById[mid] || memberById[mid]
    return m ? `${m.prenom} ${m.nom}` : 'Membre'
  }

  const voteByMember = Object.fromEntries(decision.votes.map((v) => [v.membre_id, v]))
  const t = tally(decision.votes.filter((v) => compIds.includes(v.membre_id)), composition.length)

  const canEditVote = (mid) =>
    !decision.cloture && (isAdmin || mid === user?.membre_id)

  const setVote = async (mid, vote) => {
    setBusy(true)
    const existing = voteByMember[mid]
    await repo.upsertVote(id, mid, vote, existing?.commentaire || '')
    await reload()
    setBusy(false)
  }

  const setComment = async (mid, commentaire) => {
    const existing = voteByMember[mid]
    await repo.upsertVote(id, mid, existing?.vote || 'absent', commentaire)
    await reload()
  }

  const doClose = async () => {
    setBusy(true)
    const snapshot = composition.map((m) => ({
      id: m.id,
      nom: m.nom,
      prenom: m.prenom,
      role: m.role,
      ag_election: m.ag_election,
      date_election: m.date_election,
    }))
    await repo.closeDecision(id, {
      statut: t.statut,
      quorum_atteint: t.quorumAtteint,
      composition_snapshot: snapshot,
    })
    setConfirmClose(false)
    await reload()
    setBusy(false)
  }

  const doReopen = async () => {
    setBusy(true)
    await repo.reopenDecision(id)
    await reload()
    setBusy(false)
  }

  const addQuestion = async () => {
    if (!qText.trim()) return
    await repo.addQA({ decision_id: id, auteur_id: user.membre_id, type: 'question', parent_id: null, texte: qText.trim() })
    setQText('')
    await reload()
  }

  const addReponse = async (parentId) => {
    if (!replyText.trim()) return
    await repo.addQA({ decision_id: id, auteur_id: user.membre_id, type: 'reponse', parent_id: parentId, texte: replyText.trim() })
    setReplyText('')
    setReplyTo(null)
    await reload()
  }

  const sendForSignature = async () => {
    setBusy(true)
    try {
      const signers = decision.votes
        .filter((v) => v.vote === 'pour' || v.vote === 'abstention')
        .map((v) => ({ email: memberById[v.membre_id]?.email, name: nameOf(v.membre_id) }))
        .filter((s) => s.email)
      const res = await signatureProvider.createSignatureRequest({ decisionNumero: decision.numero, signers })
      await repo.saveSignatureRequest({
        decision_id: id,
        yousign_request_id: res.requestId,
        statut: res.statut,
        pdf_url: null,
        signataires: signers.map((s) => s.email),
        signed_at: null,
      })
      await reload()
    } finally {
      setBusy(false)
    }
  }

  const simulateSigned = async () => {
    setBusy(true)
    const res = await signatureProvider.simulateSigned()
    await repo.saveSignatureRequest({
      decision_id: id,
      yousign_request_id: decision.signature?.yousign_request_id,
      statut: 'signe',
      pdf_url: res.pdf_url,
      signataires: decision.signature?.signataires || [],
      signed_at: res.signed_at,
    })
    await reload()
    setBusy(false)
  }

  const questions = decision.qa.filter((q) => q.type === 'question')
  const reponsesByParent = decision.qa
    .filter((q) => q.type === 'reponse')
    .reduce((acc, r) => {
      ;(acc[r.parent_id] ||= []).push(r)
      return acc
    }, {})

  return (
    <div>
      <PageHeader
        title={
          <span>
            <span className="text-slate-400">{decision.numero}</span> · {decision.titre}
          </span>
        }
        subtitle={`Décision du ${formatDate(decision.date_decision)}`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                downloadDecisionPDF(decision, {
                  members,
                  votes: decision.votes.filter((v) => compIds.includes(v.membre_id)),
                  qa: decision.qa,
                })
              }
            >
              Export PDF
            </Button>
            {isAdmin && (
              <Link to={`/registre/${id}/modifier`}>
                <Button variant="ghost">Modifier</Button>
              </Link>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardHeader title="Décision" actions={<StatutBadge statut={decision.statut} />} />
            <div
              className="rich-text px-5 py-4 text-sm text-slate-700"
              dangerouslySetInnerHTML={{ __html: decision.description }}
            />
          </Card>

          {/* Votes */}
          <Card>
            <CardHeader
              title="Vote du Conseil Syndical"
              subtitle={
                decision.cloture
                  ? 'Vote clôturé — composition figée.'
                  : 'Saisissez le vote de chaque membre actif à la date de la décision.'
              }
              actions={
                isAdmin &&
                (decision.cloture ? (
                  <Button variant="ghost" size="sm" onClick={doReopen} disabled={busy}>Rouvrir</Button>
                ) : (
                  <Button size="sm" onClick={() => setConfirmClose(true)} disabled={busy}>Clôturer le vote</Button>
                ))
              }
            />
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
                    const editable = canEditVote(m.id)
                    return (
                      <tr key={m.id}>
                        <td className="px-4 py-3">
                          <span className="font-medium text-slate-700">{m.prenom} {m.nom}</span>
                          {m.role === 'president' && <span className="ml-2 text-xs text-slate-400">(président)</span>}
                        </td>
                        <td className="px-4 py-3">
                          {editable ? (
                            <div className="flex flex-wrap gap-1">
                              {VOTE_VALUES.map((val) => (
                                <button
                                  key={val}
                                  onClick={() => setVote(m.id, val)}
                                  disabled={busy}
                                  className={[
                                    'rounded px-2 py-1 text-xs font-medium transition-colors',
                                    v?.vote === val
                                      ? 'bg-navy-600 text-white'
                                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                  ].join(' ')}
                                >
                                  {VOTE_LABELS[val]}
                                </button>
                              ))}
                            </div>
                          ) : v ? (
                            <VoteBadge vote={v.vote} />
                          ) : (
                            <span className="text-xs text-slate-400">non voté</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {editable ? (
                            <input
                              defaultValue={v?.commentaire || ''}
                              onBlur={(e) => e.target.value !== (v?.commentaire || '') && setComment(m.id, e.target.value)}
                              placeholder="—"
                              className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-navy-400 focus:outline-none"
                            />
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
          </Card>

          {/* Q&A */}
          <Card>
            <CardHeader title="Questions & réponses" subtitle="Fil de discussion lié à la décision." />
            <div className="space-y-4 px-5 py-4">
              {questions.length === 0 && <p className="text-sm text-slate-500">Aucune question pour l’instant.</p>}
              {questions.map((question) => (
                <div key={question.id} className="rounded-md border border-navy-100 bg-navy-50/30 p-3">
                  <p className="text-sm text-slate-800">
                    <span className="font-medium text-navy-700">{nameOf(question.auteur_id)}</span>
                    <span className="ml-2 text-xs text-slate-400">{formatDateTime(question.created_at)}</span>
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{question.texte}</p>
                  {(reponsesByParent[question.id] || []).map((r) => (
                    <div key={r.id} className="mt-2 ml-4 border-l-2 border-navy-200 pl-3">
                      <p className="text-xs">
                        <span className="font-medium text-navy-700">{nameOf(r.auteur_id)}</span>
                        <span className="ml-2 text-slate-400">{formatDateTime(r.created_at)}</span>
                      </p>
                      <p className="text-sm text-slate-700">{r.texte}</p>
                    </div>
                  ))}
                  {replyTo === question.id ? (
                    <div className="mt-2 ml-4 flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Votre réponse…"
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-navy-400 focus:outline-none"
                      />
                      <Button size="sm" onClick={() => addReponse(question.id)}>Répondre</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText('') }}>Annuler</Button>
                    </div>
                  ) : (
                    <button onClick={() => setReplyTo(question.id)} className="mt-2 ml-4 text-xs text-navy-600 underline">
                      Répondre
                    </button>
                  )}
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <input
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="Poser une question…"
                  className="flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-navy-400 focus:outline-none"
                />
                <Button onClick={addQuestion}>Publier</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Sidebar: result + signature + history */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="Résultat" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                {VOTE_VALUES.map((val) => (
                  <div key={val} className="rounded bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-500">{VOTE_LABELS[val]}</p>
                    <p className="text-lg font-semibold text-navy-800">{t.counts[val]}</p>
                  </div>
                ))}
              </div>
              <div className="rounded border border-navy-100 px-3 py-2">
                <p className="text-xs text-slate-500">Quorum ({t.present}/{t.activeCount} présents)</p>
                <p className={t.quorumAtteint ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>
                  {t.quorumAtteint ? 'Atteint' : 'Non atteint'}
                </p>
              </div>
              <div className="text-center">
                {decision.cloture ? (
                  <StatutBadge statut={decision.statut} />
                ) : (
                  <Badge tone={t.adoptee && t.quorumAtteint ? 'green' : 'red'}>
                    Projection : {t.adoptee && t.quorumAtteint ? 'Adoptée' : 'Rejetée'}
                  </Badge>
                )}
                <p className="mt-1 text-xs text-slate-400">{tallySummary(t.counts)}</p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Signature électronique" />
            <div className="space-y-3 px-5 py-4 text-sm">
              {decision.signature ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Statut</span>
                    <Badge tone={decision.signature.statut === 'signe' ? 'green' : 'amber'}>
                      {decision.signature.statut === 'signe' ? 'Signé' : decision.signature.statut === 'expire' ? 'Expiré' : 'En attente'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">
                    Demande : {decision.signature.yousign_request_id}
                  </p>
                  {decision.signature.signed_at && (
                    <p className="text-xs text-slate-500">Signé le {formatDateTime(decision.signature.signed_at)}</p>
                  )}
                  {isAdmin && isMockSignature && decision.signature.statut !== 'signe' && (
                    <Button size="sm" variant="secondary" onClick={simulateSigned} disabled={busy}>
                      Simuler la signature (démo)
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-xs text-slate-500">
                    {decision.cloture
                      ? 'Envoyer la décision à la signature des membres ayant voté « Pour » ou « Abstention ».'
                      : 'Clôturez le vote avant d’envoyer à la signature.'}
                  </p>
                  {isAdmin && (
                    <Button size="sm" onClick={sendForSignature} disabled={busy || !decision.cloture || decision.statut !== 'adoptee'}>
                      Envoyer pour signature
                    </Button>
                  )}
                  {isMockSignature && (
                    <p className="rounded bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
                      Mode démo : aucun email réel n’est envoyé (stub Yousign).
                    </p>
                  )}
                </>
              )}
            </div>
          </Card>

          {decision.status_history?.length > 0 && (
            <Card>
              <CardHeader title="Historique des statuts" />
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

      <Modal
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        title="Clôturer le vote"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClose(false)}>Annuler</Button>
            <Button onClick={doClose} disabled={busy}>Confirmer la clôture</Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-slate-600">
          <p>La clôture fige la composition du CS et le résultat du vote. Résultat calculé :</p>
          <ul className="list-disc pl-5">
            <li>{tallySummary(t.counts)}</li>
            <li>Quorum : {t.quorumAtteint ? 'atteint' : 'non atteint'} ({t.present}/{t.activeCount})</li>
            <li>Statut final : <strong>{t.statut === 'adoptee' ? 'Adoptée' : 'Rejetée'}</strong></li>
          </ul>
          <p className="text-xs text-slate-400">Vous pourrez rouvrir le vote si nécessaire.</p>
        </div>
      </Modal>
    </div>
  )
}
