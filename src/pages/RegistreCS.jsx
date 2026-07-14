import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Spinner, EmptyState, Modal } from '../components/ui'
import { StatutBadge, SignatureBadge } from '../components/badges'
import { formatDate, formatDateTime } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { downloadRegistrePDF } from '../lib/pdf'
import { signatureProvider, isMockSignature } from '../lib/signatureProvider'

export default function RegistreCS() {
  const { isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [decisions, setDecisions] = useState([])
  const [members, setMembers] = useState([])
  const [batches, setBatches] = useState([])
  const [year, setYear] = useState('all')
  const [statut, setStatut] = useState('all')
  const [q, setQ] = useState('')
  const [exporting, setExporting] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [sigModal, setSigModal] = useState(false)
  const [sigTitle, setSigTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    const [d, m, b] = await Promise.all([repo.listDecisions(), repo.listMembres(), repo.listSignatureBatches()])
    setDecisions(d)
    setMembers(m)
    setBatches(b)
    setLoading(false)
  }
  useEffect(() => {
    reload()
  }, [])

  const batchByDecision = useMemo(() => {
    const map = {}
    for (const b of batches) for (const did of b.decision_ids) map[did] = b
    return map
  }, [batches])

  const years = useMemo(() => [...new Set(decisions.map((d) => d.date_publication?.slice(0, 4)))].filter(Boolean).sort().reverse(), [decisions])

  const filtered = useMemo(
    () =>
      decisions.filter((d) => {
        if (year !== 'all' && d.date_publication?.slice(0, 4) !== year) return false
        if (statut !== 'all' && d.statut !== statut) return false
        if (q && !`${d.numero} ${d.titre}`.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [decisions, year, statut, q],
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
      downloadRegistrePDF(filtered, { members, getDetail: (d) => ({ votes: byId[d.id]?.votes || [], qa: byId[d.id]?.qa || [] }) })
    } finally {
      setExporting(false)
    }
  }

  const sendForSignature = async () => {
    setBusy(true)
    try {
      const ids = [...selected]
      const chosen = decisions.filter((d) => ids.includes(d.id))
      // Signataires = membres ayant voté "pour" ou "abstention" sur les décisions choisies.
      const details = await Promise.all(chosen.map((d) => repo.getDecision(d.id)))
      const emails = new Set()
      for (const d of details) {
        for (const v of d.votes) {
          if (v.vote === 'pour' || v.vote === 'abstention') {
            const m = members.find((x) => x.id === v.membre_id)
            if (m?.email) emails.add(m.email)
          }
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
        title="Registre du Conseil Syndical"
        subtitle="Décisions courantes du CS (hors résolutions d’AG)."
        actions={
          <>
            <Button variant="secondary" onClick={exportAll} disabled={exporting || filtered.length === 0}>{exporting ? 'Génération…' : 'Export PDF registre'}</Button>
            <Link to="/registre/nouvelle"><Button>+ Nouvelle décision</Button></Link>
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

      {isAdmin && selectedCount > 0 && (
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
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  {isAdmin && <th className="px-4 py-2.5" />}
                  <th className="px-4 py-2.5 font-medium">N°</th>
                  <th className="px-4 py-2.5 font-medium">Publication</th>
                  <th className="px-4 py-2.5 font-medium">Titre</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 font-medium">Signature</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtered.map((d) => (
                  <tr key={d.id} className="hover:bg-navy-50/40">
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <input type="checkbox" disabled={!selectable(d)} checked={selected.has(d.id)} onChange={() => toggle(d.id)} title={selectable(d) ? '' : 'Sélectionnable seulement si adoptée, enregistrée et non signée'} />
                      </td>
                    )}
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-500">{d.numero}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(d.date_publication)}</td>
                    <td className="px-4 py-3"><Link to={`/registre/${d.id}`} className="font-medium text-navy-700 hover:underline">{d.titre}</Link></td>
                    <td className="px-4 py-3"><StatutBadge statut={d.statut} /></td>
                    <td className="px-4 py-3">{batchByDecision[d.id] ? <SignatureBadge statut={batchByDecision[d.id].statut} /> : <span className="text-xs text-slate-400">—</span>}</td>
                  </tr>
                ))}
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
                  {isAdmin && isMockSignature && b.statut !== 'signe' && (
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
          <p>{selectedCount} décision(s) seront regroupées dans une seule demande de signature. Les signataires sont les membres ayant voté « Pour » ou « Abstention ».</p>
          <Input label="Titre du lot" value={sigTitle} onChange={(e) => setSigTitle(e.target.value)} placeholder="ex : Décisions du 1er trimestre 2026" />
          {isMockSignature && <p className="rounded bg-amber-50 px-2 py-1 text-xs text-amber-700">Mode démo : aucun email réel n’est envoyé (stub Yousign).</p>}
        </div>
      </Modal>
    </div>
  )
}
