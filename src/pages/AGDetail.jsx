import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Modal, Spinner, Badge, eur } from '../components/ui'
import { AGStatutBadge, ResolutionStatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { nextResolutionNumero, MAJORITE_VALUES, MAJORITE_LABELS } from '../lib/agLogic'

export default function AGDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [ag, setAg] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [loading, setLoading] = useState(true)
  const [resModal, setResModal] = useState(null)

  const reload = useCallback(async () => {
    const [data, ds] = await Promise.all([repo.getAG(id), repo.listDecisions()])
    setAg(data)
    setDecisions(ds)
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

  const budgetTotal = ag.resolutions.reduce((s, r) => s + (Number(r.budget_alloue) || 0), 0)
  const linkedCount = (resolutionId) => decisions.filter((d) => d.resolution_id === resolutionId).length
  const agLocked = decisions.some((d) => d.ag_id === id)

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
        actions={isAdmin && (<><Link to={`/ag/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link><Button variant="danger" onClick={deleteAG} disabled={agLocked} title={agLocked ? 'Des décisions sont rattachées à cette AG' : ''}>Supprimer</Button></>)}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><AGStatutBadge statut={ag.statut} /></div>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Président de séance</p>
          <p className="mt-1 text-sm font-medium text-navy-800">{ag.president_seance}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budgets alloués</p>
          <p className="mt-1 text-lg font-semibold text-navy-800">{eur(budgetTotal)}</p>
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
          subtitle="Résultat du vote (au prorata des superficies — détail au PV) et budget alloué."
          actions={isAdmin && <Button size="sm" onClick={() => setResModal({ numero: nextResolutionNumero(ag.resolutions), majorite_requise: 'simple', statut: 'adoptee', titre: '', description: '', budget_alloue: '', budget_intitule: '', observations: '' })}>+ Résolution</Button>}
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
                  {isAdmin && (linkedCount(r.id) > 0
                    ? <span className="text-xs text-slate-400" title="Verrouillée : décision rattachée">🔒 {linkedCount(r.id)} décision(s)</span>
                    : <button onClick={() => setResModal(r)} className="text-xs text-navy-600 underline">Modifier</button>)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <Badge tone="gray">{MAJORITE_LABELS[r.majorite_requise]}</Badge>
                {r.budget_alloue != null && r.budget_alloue !== '' && (
                  <span className="font-medium text-navy-700">Budget : {eur(r.budget_alloue)}{r.budget_intitule ? ` · ${r.budget_intitule}` : ''}</span>
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
    </div>
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
          <Select label="Résultat" value={form.statut} onChange={set('statut')}>
            <option value="adoptee">Adoptée</option>
            <option value="rejetee">Rejetée</option>
            <option value="retiree">Retirée</option>
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
