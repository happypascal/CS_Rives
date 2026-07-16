import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Modal, Spinner, Badge, eur } from '../components/ui'
import { AGStatutBadge, ResolutionStatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { nextResolutionNumero, MAJORITE_VALUES, MAJORITE_LABELS, RESOLUTION_STATUT_VALUES, RESOLUTION_STATUT_LABELS } from '../lib/agLogic'

export default function AGDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [ag, setAg] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [projets, setProjets] = useState([])
  const [loading, setLoading] = useState(true)
  const [resModal, setResModal] = useState(null)
  const [rattachModal, setRattachModal] = useState(null)

  const reload = useCallback(async () => {
    const [data, ds, ps] = await Promise.all([
      repo.getAG(id),
      repo.listDecisions(),
      repo.listProjets().catch(() => []),
    ])
    setAg(data)
    setDecisions(ds)
    setProjets(ps)
    setLoading(false)
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />
  if (!ag) {
    return (
      <div>
        <PageHeader title="AG introuvable" />
        <Link to="/ag" className="text-navy-600 underline">← Retour aux AG</Link>
      </div>
    )
  }

  // Seule une résolution ADOPTÉE alloue un budget : tant qu'elle est à voter (ou si
  // elle est rejetée/retirée), le montant n'est qu'une proposition.
  const budgetTotal = ag.resolutions.filter((r) => r.statut === 'adoptee').reduce((s, r) => s + (Number(r.budget_alloue) || 0), 0)
  const budgetPropose = ag.resolutions.filter((r) => r.statut === 'a_voter').reduce((s, r) => s + (Number(r.budget_alloue) || 0), 0)
  const linkedCount = (resolutionId) => decisions.filter((d) => d.resolution_id === resolutionId).length
  const agLocked = decisions.some((d) => d.ag_id === id)
  const projetById = Object.fromEntries(projets.map((p) => [p.id, p]))
  // Une résolution ne finance un projet que si l'AG l'a adoptée ET dotée.
  const peutFinancer = (r) => r.statut === 'adoptee' && r.budget_alloue != null && r.budget_alloue !== ''

  const deleteAG = async () => {
    if (!confirm(`Supprimer l’AG ${ag.numero} et toutes ses résolutions ?`)) return
    try {
      await repo.deleteAG(id)
      navigate('/ag')
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title={<span><span className="text-slate-400">{ag.numero}</span> · {ag.type === 'AGO' ? 'Ordinaire' : 'Extraordinaire'}</span>}
        subtitle={`${formatDate(ag.date_ag)}${ag.lieu ? ' · ' + ag.lieu : ''}`}
        actions={canManage && (<><Link to={`/ag/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link><Button variant="danger" onClick={deleteAG} disabled={agLocked} title={agLocked ? 'Des décisions sont rattachées à cette AG' : ''}>Supprimer</Button></>)}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><AGStatutBadge statut={ag.statut} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Président de séance</p>
          <p className={`mt-1 text-sm font-medium ${ag.president_seance ? 'text-navy-800' : 'italic text-slate-400'}`}>{ag.president_seance || 'Désigné en séance'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budgets alloués</p>
          <p className="mt-1 text-lg font-semibold text-navy-800">{eur(budgetTotal)}</p>
          {budgetPropose > 0 && <p className="mt-0.5 text-xs text-amber-700">dont {eur(budgetPropose)} soumis au vote</p>}
        </Card>
      </div>

      {ag.ordre_du_jour && (
        <Card className="mb-6">
          <CardHeader title="Ordre du jour" />
          <pre className="whitespace-pre-wrap px-5 py-4 font-sans text-sm text-slate-700">{ag.ordre_du_jour}</pre>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Résolutions"
          subtitle="À voter tant que l’AG ne s’est pas tenue, puis résultat du vote (au prorata des superficies — détail au PV)."
          actions={canManage && <Button size="sm" onClick={() => setResModal({ numero: nextResolutionNumero(ag.resolutions), majorite_requise: 'simple', statut: 'a_voter', titre: '', description: '', budget_alloue: '', budget_intitule: '', observations: '' })}>+ Résolution</Button>}
        />
        <div className="divide-y divide-navy-50">
          {ag.resolutions.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Aucune résolution.</p>}
          {ag.resolutions.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800">Résolution n° {r.numero} — {r.titre}</p>
                  <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <ResolutionStatutBadge statut={r.statut} />
                  {canManage && (linkedCount(r.id) > 0
                    ? <span className="text-xs text-slate-400" title="Verrouillée : décision rattachée">🔒 {linkedCount(r.id)} décision(s)</span>
                    : <button onClick={() => setResModal(r)} className="text-xs text-navy-600 underline">Modifier</button>)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <Badge tone="gray">{MAJORITE_LABELS[r.majorite_requise]}</Badge>
                {r.budget_alloue != null && r.budget_alloue !== '' && (
                  <span className="font-medium text-navy-700">Budget : {eur(r.budget_alloue)}{r.budget_intitule ? ` · ${r.budget_intitule}` : ''}</span>
                )}
                {/* Le rattachement se pilote ICI : l'AG vote l'enveloppe, puis on
                    décide si elle ouvre un projet ou en abonde un existant. */}
                {peutFinancer(r) && r.projet_id && (
                  <span className="text-slate-600">
                    Finance le projet <Link to={`/projets/${r.projet_id}`} className="font-medium text-navy-600 underline">{projetById[r.projet_id]?.nom || 'projet'}</Link>
                    {canManage && (
                      <button onClick={() => setRattachModal(r)} className="ml-2 text-navy-600 underline">changer</button>
                    )}
                  </span>
                )}
                {canManage && peutFinancer(r) && !r.projet_id && (
                  <>
                    <Link to={`/projets/nouveau?resolution=${r.id}`} className="text-navy-600 underline">Ouvrir un projet</Link>
                    {projets.length > 0 && (
                      <button onClick={() => setRattachModal(r)} className="text-navy-600 underline">Rattacher à un projet existant</button>
                    )}
                  </>
                )}
              </div>
              {r.observations && <p className="mt-2 text-xs italic text-slate-400">{r.observations}</p>}
            </div>
          ))}
        </div>
      </Card>

      {resModal && (
        <ResolutionModal ag={ag} resolution={resModal} onClose={() => setResModal(null)} onSaved={async () => { setResModal(null); await reload() }} />
      )}
      {rattachModal && (
        <RattachementModal
          resolution={rattachModal}
          projets={projets}
          onClose={() => setRattachModal(null)}
          onSaved={async () => { setRattachModal(null); await reload() }}
        />
      )}
    </div>
  )
}

// Rattache l'enveloppe d'une résolution à un projet — ou l'en détache.
// Une résolution ne pointant qu'un projet, choisir en remplace un autre : la règle
// « une résolution ne finance qu'un projet » n'a pas à être vérifiée, elle tient à
// la forme de la donnée. L'inverse est libre : plusieurs résolutions par projet.
function RattachementModal({ resolution, projets, onClose, onSaved }) {
  const [projetId, setProjetId] = useState(resolution.projet_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await repo.setResolutionProjet(resolution.id, projetId || null)
      await onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const cible = projets.find((p) => p.id === projetId)

  return (
    <Modal title={`Résolution n° ${resolution.numero} — rattachement`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          L’enveloppe de <strong>{eur(resolution.budget_alloue)}</strong> votée par cette résolution finance :
        </p>
        <Select label="Projet financé" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
          <option value="">— Aucun (enveloppe non affectée) —</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Select>
        {cible && (
          <p className="text-xs text-slate-500">
            Budget de « {cible.nom} » après rattachement :{' '}
            <strong>{eur(cible.id === resolution.projet_id ? cible.alloue : cible.alloue + Number(resolution.budget_alloue || 0))}</strong>
            {cible.id !== resolution.projet_id && <> (aujourd’hui {eur(cible.alloue)})</>}
          </p>
        )}
        {!projetId && resolution.projet_id && (
          <p className="text-xs text-amber-700">
            L’enveloppe sera retirée du budget du projet, qui diminuera d’autant. La résolution, elle, reste intacte.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
        </div>
      </div>
    </Modal>
  )
}

function ResolutionModal({ ag, resolution, onClose, onSaved }) {
  const editing = Boolean(resolution.id)
  const [form, setForm] = useState(resolution)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const save = async () => {
    setSaving(true)
    const payload = {
      ag_id: ag.id,
      numero: Number(form.numero),
      titre: form.titre,
      description: form.description,
      majorite_requise: form.majorite_requise,
      statut: form.statut,
      budget_alloue: form.budget_alloue === '' ? null : Number(form.budget_alloue),
      budget_intitule: form.budget_intitule || null,
      observations: form.observations,
    }
    try {
      if (editing) await repo.updateResolution(resolution.id, payload)
      else await repo.createResolution(payload)
      await onSaved()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!confirm('Supprimer cette résolution ?')) return
    try {
      await repo.deleteResolution(resolution.id)
      await onSaved()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <Modal
      open onClose={onClose} wide
      title={editing ? `Résolution n° ${form.numero}` : 'Nouvelle résolution'}
      footer={<>{editing && <Button variant="danger" onClick={del} className="mr-auto">Supprimer</Button>}<Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={saving || !form.titre}>{saving ? '…' : 'Enregistrer'}</Button></>}
    >
      <div className="space-y-3">
        <Input label="Titre" value={form.titre} onChange={set('titre')} required />
        <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Majorité requise" value={form.majorite_requise} onChange={set('majorite_requise')}>
            {MAJORITE_VALUES.map((v) => <option key={v} value={v}>{MAJORITE_LABELS[v]}</option>)}
          </Select>
          <Select label="Statut / résultat" value={form.statut} onChange={set('statut')}>
            {RESOLUTION_STATUT_VALUES.map((v) => <option key={v} value={v}>{RESOLUTION_STATUT_LABELS[v]}</option>)}
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Budget alloué (€) — optionnel" type="number" min="0" step="0.01" value={form.budget_alloue ?? ''} onChange={set('budget_alloue')} />
          <Input label="Intitulé du budget" value={form.budget_intitule || ''} onChange={set('budget_intitule')} />
        </div>
        <Textarea label="Observations" value={form.observations || ''} onChange={set('observations')} rows={2} />
      </div>
    </Modal>
  )
}
