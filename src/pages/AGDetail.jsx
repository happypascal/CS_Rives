import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Modal, Spinner, Badge, eur, num } from '../components/ui'
import { AGStatutBadge, ResolutionStatutBadge, BudgetStatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import {
  evaluateResolution,
  nextResolutionNumero,
  MAJORITE_LABELS,
  CLE_REPARTITION_LABELS,
  BUDGET_STATUT_LABELS,
  agQuorum,
} from '../lib/agLogic'

export default function AGDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [ag, setAg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [resModal, setResModal] = useState(null) // resolution being edited/created
  const [budgetModal, setBudgetModal] = useState(null)

  const reload = useCallback(async () => {
    const data = await repo.getAG(id)
    setAg(data)
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

  const quorum = agQuorum(ag)
  const budgetTotals = ag.budgets.reduce(
    (acc, b) => {
      acc.vote += Number(b.montant_vote || 0)
      acc.appele += Number(b.montant_appele || 0)
      acc.encaisse += Number(b.montant_encaisse || 0)
      return acc
    },
    { vote: 0, appele: 0, encaisse: 0 },
  )

  const deleteAG = async () => {
    if (!confirm(`Supprimer l’AG ${ag.numero} et toutes ses résolutions/budgets ?`)) return
    await repo.deleteAG(id)
    navigate('/ag')
  }

  return (
    <div>
      <PageHeader
        title={<span><span className="text-slate-400">{ag.numero}</span> · {ag.type === 'AGO' ? 'Ordinaire' : 'Extraordinaire'}</span>}
        subtitle={`${formatDate(ag.date_ag)}${ag.lieu ? ' · ' + ag.lieu : ''}`}
        actions={
          isAdmin && (
            <>
              <Link to={`/ag/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>
              <Button variant="danger" onClick={deleteAG}>Supprimer</Button>
            </>
          )
        }
      />

      {/* AG summary */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><AGStatutBadge statut={ag.statut} /></div>
          <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Président de séance</p>
          <p className="text-sm font-medium text-navy-800">{ag.president_seance}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Quorum</p>
          <p className="mt-1 text-lg font-semibold text-navy-800">
            {quorum.present} / {quorum.total}
          </p>
          <p className="text-xs text-slate-500">
            {ag.nombre_presents} présents + {ag.nombre_representes} représentés ·{' '}
            <Badge tone={quorum.atteint ? 'green' : 'red'}>{quorum.atteint ? 'Atteint' : 'Non atteint'}</Badge>
          </p>
          <p className="mt-2 text-xs text-slate-500">Superficie représentée : {num(ag.superficie_representee)} m²</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budgets</p>
          <p className="mt-1 text-lg font-semibold text-navy-800">{eur(budgetTotals.vote)}</p>
          <p className="text-xs text-slate-500">{eur(budgetTotals.encaisse)} encaissé · {ag.budgets.length} ligne(s)</p>
        </Card>
      </div>

      {ag.ordre_du_jour && (
        <Card className="mb-6">
          <CardHeader title="Ordre du jour" />
          <pre className="whitespace-pre-wrap px-5 py-4 font-sans text-sm text-slate-700">{ag.ordre_du_jour}</pre>
        </Card>
      )}

      {/* Résolutions */}
      <Card className="mb-6">
        <CardHeader
          title="Résolutions"
          subtitle="Votes des colotis et majorité requise."
          actions={
            isAdmin && (
              <Button size="sm" onClick={() => setResModal({ numero: nextResolutionNumero(ag.resolutions), majorite_requise: 'simple', titre: '', description: '', votes_pour: 0, votes_contre: 0, votes_abstention: 0, votes_absents: 0, superficie_pour: 0, observations: '' })}>
                + Résolution
              </Button>
            )
          }
        />
        <div className="divide-y divide-navy-50">
          {ag.resolutions.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Aucune résolution.</p>}
          {ag.resolutions.map((r) => {
            const ev = evaluateResolution(r, ag)
            return (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-800">Résolution n° {r.numero} — {r.titre}</p>
                    <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <ResolutionStatutBadge statut={r.statut} />
                    {isAdmin && (
                      <button onClick={() => setResModal(r)} className="text-xs text-navy-600 underline">Modifier</button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>Pour <strong>{r.votes_pour}</strong></span>
                  <span>Contre <strong>{r.votes_contre}</strong></span>
                  <span>Abst. <strong>{r.votes_abstention}</strong></span>
                  <span>Absents <strong>{r.votes_absents}</strong></span>
                  <Badge tone="gray">{MAJORITE_LABELS[r.majorite_requise]}</Badge>
                  {r.majorite_requise === 'double_qualifiee' && (
                    <span className="text-slate-500">
                      Prop. {(ev.ratioProprietaires * 100).toFixed(0)}% · Superf. {(ev.ratioSuperficie * 100).toFixed(0)}%
                    </span>
                  )}
                  <Badge tone={ev.adoptee ? 'green' : 'red'}>{ev.adoptee ? 'Adoptée (calcul)' : 'Rejetée (calcul)'}</Badge>
                </div>
                {r.observations && <p className="mt-2 text-xs italic text-slate-400">{r.observations}</p>}
              </div>
            )
          })}
        </div>
      </Card>

      {/* Budgets */}
      <Card>
        <CardHeader
          title="Budgets alloués"
          subtitle="Suivi voté → appelé → encaissé → soldé."
          actions={isAdmin && <Button size="sm" onClick={() => setBudgetModal({ intitule: '', montant_vote: 0, cle_repartition: 'superficie', statut: 'vote', resolution_id: '', date_appel_prevu: '', montant_appele: 0, montant_encaisse: 0, observations: '' })}>+ Budget</Button>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Intitulé</th>
                <th className="px-4 py-2.5 font-medium">Voté</th>
                <th className="px-4 py-2.5 font-medium">Répartition</th>
                <th className="px-4 py-2.5 font-medium">Statut</th>
                <th className="px-4 py-2.5 font-medium">Encaissé</th>
                {isAdmin && <th className="px-4 py-2.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-50">
              {ag.budgets.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">Aucun budget.</td></tr>
              )}
              {ag.budgets.map((b) => (
                <tr key={b.id} className="hover:bg-navy-50/40">
                  <td className="px-4 py-3 font-medium text-slate-700">{b.intitule}</td>
                  <td className="whitespace-nowrap px-4 py-3">{eur(b.montant_vote)}</td>
                  <td className="px-4 py-3 text-slate-600">{CLE_REPARTITION_LABELS[b.cle_repartition]}</td>
                  <td className="px-4 py-3"><BudgetStatutBadge statut={b.statut} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{eur(b.montant_encaisse)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setBudgetModal(b)} className="text-xs text-navy-600 underline">Modifier</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {ag.budgets.length > 0 && (
              <tfoot>
                <tr className="border-t border-navy-100 bg-navy-50/40 text-sm font-medium">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5">{eur(budgetTotals.vote)}</td>
                  <td />
                  <td className="px-4 py-2.5 text-xs text-slate-500">Appelé {eur(budgetTotals.appele)}</td>
                  <td className="px-4 py-2.5">{eur(budgetTotals.encaisse)}</td>
                  {isAdmin && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {resModal && (
        <ResolutionModal
          ag={ag}
          resolution={resModal}
          onClose={() => setResModal(null)}
          onSaved={async () => { setResModal(null); await reload() }}
        />
      )}
      {budgetModal && (
        <BudgetModal
          ag={ag}
          budget={budgetModal}
          onClose={() => setBudgetModal(null)}
          onSaved={async () => { setBudgetModal(null); await reload() }}
        />
      )}
    </div>
  )
}

function ResolutionModal({ ag, resolution, onClose, onSaved }) {
  const editing = Boolean(resolution.id)
  const [form, setForm] = useState(resolution)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }
  const ev = evaluateResolution(form, ag)

  const save = async () => {
    setSaving(true)
    const payload = {
      ag_id: ag.id,
      numero: form.numero,
      titre: form.titre,
      description: form.description,
      majorite_requise: form.majorite_requise,
      votes_pour: form.votes_pour,
      votes_contre: form.votes_contre,
      votes_abstention: form.votes_abstention,
      votes_absents: form.votes_absents,
      superficie_pour: form.superficie_pour,
      statut: ev.statut,
      observations: form.observations,
    }
    if (editing) await repo.updateResolution(resolution.id, payload)
    else await repo.createResolution(payload)
    await onSaved()
    setSaving(false)
  }

  const del = async () => {
    if (!confirm('Supprimer cette résolution ?')) return
    await repo.deleteResolution(resolution.id)
    await onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={editing ? `Résolution n° ${form.numero}` : 'Nouvelle résolution'}
      footer={
        <>
          {editing && <Button variant="danger" onClick={del} className="mr-auto">Supprimer</Button>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !form.titre}>{saving ? '…' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Titre" value={form.titre} onChange={set('titre')} required />
        <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />
        <Select label="Majorité requise" value={form.majorite_requise} onChange={set('majorite_requise')}>
          <option value="simple">Majorité simple</option>
          <option value="double_qualifiee">Double majorité qualifiée (2/3 + 2/3)</option>
          <option value="unanimite">Unanimité</option>
        </Select>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Input label="Pour" type="number" min="0" value={form.votes_pour} onChange={set('votes_pour')} />
          <Input label="Contre" type="number" min="0" value={form.votes_contre} onChange={set('votes_contre')} />
          <Input label="Abstention" type="number" min="0" value={form.votes_abstention} onChange={set('votes_abstention')} />
          <Input label="Absents" type="number" min="0" value={form.votes_absents} onChange={set('votes_absents')} />
        </div>
        {form.majorite_requise === 'double_qualifiee' && (
          <Input label="Superficie « pour » (m²)" type="number" min="0" step="0.01" value={form.superficie_pour} onChange={set('superficie_pour')} />
        )}
        <Textarea label="Observations" value={form.observations} onChange={set('observations')} rows={2} />
        <div className="rounded-md bg-navy-50 px-3 py-2 text-sm">
          <p className="font-medium text-navy-800">Résultat calculé : {ev.adoptee ? 'ADOPTÉE' : 'REJETÉE'}</p>
          <p className="text-xs text-slate-600">{ev.detail}</p>
        </div>
      </div>
    </Modal>
  )
}

function BudgetModal({ ag, budget, onClose, onSaved }) {
  const editing = Boolean(budget.id)
  const [form, setForm] = useState({ ...budget, resolution_id: budget.resolution_id || '' })
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  const save = async () => {
    setSaving(true)
    const payload = {
      ag_id: ag.id,
      resolution_id: form.resolution_id || null,
      intitule: form.intitule,
      montant_vote: form.montant_vote,
      cle_repartition: form.cle_repartition,
      statut: form.statut,
      date_appel_prevu: form.date_appel_prevu || null,
      montant_appele: form.montant_appele,
      montant_encaisse: form.montant_encaisse,
      observations: form.observations,
    }
    if (editing) await repo.updateBudget(budget.id, payload)
    else await repo.createBudget(payload)
    await onSaved()
    setSaving(false)
  }

  const del = async () => {
    if (!confirm('Supprimer ce budget ?')) return
    await repo.deleteBudget(budget.id)
    await onSaved()
  }

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={editing ? 'Modifier le budget' : 'Nouveau budget'}
      footer={
        <>
          {editing && <Button variant="danger" onClick={del} className="mr-auto">Supprimer</Button>}
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={saving || !form.intitule}>{saving ? '…' : 'Enregistrer'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Intitulé" value={form.intitule} onChange={set('intitule')} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Montant voté (€)" type="number" min="0" step="0.01" value={form.montant_vote} onChange={set('montant_vote')} />
          <Select label="Clé de répartition" value={form.cle_repartition} onChange={set('cle_repartition')}>
            <option value="superficie">Superficie</option>
            <option value="facade">Façade</option>
            <option value="egal">Égalitaire</option>
          </Select>
        </div>
        <Select label="Résolution liée (optionnel)" value={form.resolution_id} onChange={set('resolution_id')}>
          <option value="">— Budget général —</option>
          {ag.resolutions.map((r) => (
            <option key={r.id} value={r.id}>N° {r.numero} — {r.titre}</option>
          ))}
        </Select>
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Statut" value={form.statut} onChange={set('statut')}>
            {Object.entries(BUDGET_STATUT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
          <Input label="Date appel prévu" type="date" value={form.date_appel_prevu || ''} onChange={set('date_appel_prevu')} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Montant appelé (€)" type="number" min="0" step="0.01" value={form.montant_appele} onChange={set('montant_appele')} />
          <Input label="Montant encaissé (€)" type="number" min="0" step="0.01" value={form.montant_encaisse} onChange={set('montant_encaisse')} />
        </div>
        <Textarea label="Observations" value={form.observations} onChange={set('observations')} rows={2} />
      </div>
    </Modal>
  )
}
