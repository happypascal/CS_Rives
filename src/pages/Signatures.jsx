import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Spinner, EmptyState, Modal, DesktopOnly } from '../components/ui'
import { SignatureBadge } from '../components/badges'
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

// Flux de signature, séparé du registre : président seul, desktop seul, cycle
// préparer → déposer dans Youtrust → marquer signé. Le registre reste centré sur
// consultation + vote, utilisé par tous ; la signature ne concerne qu'une
// personne (décision de placement, Pascal 2026-07-17).
export default function Signatures() {
  const { isAdmin, isSecretaire } = useAuth()
  const isMobile = useIsMobile()
  // Faire signer = président OU secrétaire (art. 14 : le secrétaire tient le
  // registre ; arbitrage Pascal). Le trésorier, lui, ne gère pas les signatures.
  const canSign = isAdmin || isSecretaire
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [batches, setBatches] = useState([])
  const [allVotes, setAllVotes] = useState([])
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  // Groupe en cours de préparation (null = modale fermée). Un groupe = un
  // ensemble de décisions au MÊME ensemble de votants ; on n'envoie jamais une
  // sélection libre (art. 15), donc pas de cases à cocher.
  const [sigGroup, setSigGroup] = useState(null)
  const [sigTitle, setSigTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(null)

  const reload = async () => {
    const [d, m, b, av, p, ab] = await Promise.all([
      repo.listDecisions(),
      repo.listMembres(),
      repo.listSignatureBatches(),
      repo.listVotes().catch(() => []),
      repo.listProjets().catch(() => []),
      repo.listAGBudgets().catch(() => []),
    ])
    setDecisions(d)
    setMembers(m)
    setBatches(b)
    setAllVotes(av)
    setProjets(p)
    setAgBudgets(ab)
    setLoading(false)
  }
  useEffect(() => {
    if (canSign && !isMobile) reload()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSign, isMobile])

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  const batchByDecision = useMemo(() => {
    const map = {}
    for (const b of batches) for (const did of b.decision_ids) map[did] = b
    return map
  }, [batches])

  // Contexte du résumé : de quoi nommer la cible d'un engagement. Défini ici
  // parce que seule la page a les projets et les enveloppes.
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

  // Votants de chaque décision, par id de membre. Le SENS du vote ne compte pas :
  // un Contre était présent, donc signataire (art. 15).
  const votersByDecision = useMemo(() => {
    const map = {}
    for (const v of allVotes) (map[v.decision_id] ||= new Set()).add(v.membre_id)
    return map
  }, [allVotes])

  // Groupes de signature : décisions éligibles (enregistrée, adoptée, pas déjà
  // envoyée) regroupées par ensemble EXACT de votants. Cœur de la conformité
  // art. 15 : l'écran ne propose que des groupes homogènes, donc un lot mêlant
  // des présents différents est impossible à construire — rien à détecter.
  const signatureGroups = useMemo(() => {
    const groups = {}
    for (const d of decisions) {
      if (!(d.enregistree && d.statut === 'adoptee')) continue
      // « Déjà envoyée » = dans un lot en attente ou signé. Le critère porte sur
      // envoyée, PAS signée : sinon une décision dont le lot est en attente
      // réapparaît et peut être renvoyée une 2e fois (bug relevé par Pascal). Un
      // lot `expire` la rend à nouveau éligible — la demande n'a pas abouti.
      const b = batchByDecision[d.id]
      if (b && b.statut !== 'expire') continue
      const voterIds = [...(votersByDecision[d.id] || [])].sort()
      if (voterIds.length === 0) continue
      const key = voterIds.join('|')
      ;(groups[key] ||= { key, voterIds, decisions: [] }).decisions.push(d)
    }
    return Object.values(groups)
      .map((g) => ({ ...g, decisions: g.decisions.sort((a, b) => a.numero.localeCompare(b.numero)) }))
      .sort((a, b) => a.decisions[0].numero.localeCompare(b.decisions[0].numero))
  }, [decisions, votersByDecision, batchByDecision])

  const demandesCeMois = useMemo(() => {
    const mois = todayISO().slice(0, 7)
    return batches.filter((b) => (b.created_at || '').slice(0, 7) === mois).length
  }, [batches])

  const membersLabel = (ids) => ids.map((id) => { const m = memberById[id]; return m ? `${m.prenom} ${m.nom}` : '?' }).join(', ')

  // PDF d'un lot : ses décisions seulement. Document déposé dans Youtrust (§6).
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

  // Titre par défaut « juillet 2026 lot 3 » : rang de la demande dans le mois,
  // cohérent avec le quota. Recalculé à l'ouverture, pas figé.
  const openSigModal = (group) => {
    setSigGroup(group)
    setSigTitle(`${moisCourant()} lot ${demandesCeMois + 1}`)
  }

  const sendForSignature = async () => {
    if (!sigGroup) return
    setBusy(true)
    try {
      const ids = sigGroup.decisions.map((d) => d.id)
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

  if (isMobile) {
    return (
      <div>
        <PageHeader title="Signatures" />
        <DesktopOnly what="La gestion des signatures" />
      </div>
    )
  }
  if (!canSign) {
    return (
      <div>
        <PageHeader title="Signatures" />
        <Card className="p-6 text-sm text-slate-600">La gestion des signatures est réservée au président et au secrétaire du Conseil Syndical.</Card>
      </div>
    )
  }
  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Signatures"
        subtitle="Signature du registre par les membres présents à chaque délibération (art. 15 des statuts)."
      />

      {/* À faire signer — un bloc par ensemble de signataires. On n'envoie qu'un
          groupe entier : l'art. 15 signe par délibération, une sélection libre
          rouvrirait la porte au lot non conforme. */}
      {signatureGroups.length === 0 ? (
        <EmptyState
          title="Rien à faire signer"
          hint="Les décisions adoptées et enregistrées apparaîtront ici, regroupées par membres présents, dès qu'elles ne sont pas déjà dans une demande."
        />
      ) : (
        <Card>
          <CardHeader
            title="À faire signer"
            subtitle="Décisions adoptées et enregistrées, groupées par membres présents. Un envoi = une demande Youtrust."
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

      {/* Lots déjà créés */}
      {batches.length > 0 && (
        <Card className="mt-6">
          <CardHeader title="Demandes préparées" subtitle="Déposer le PDF dans Youtrust, puis marquer le lot signé une fois la signature revenue." />
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
