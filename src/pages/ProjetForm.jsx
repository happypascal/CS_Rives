import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Textarea, Spinner, DesktopOnly, eur } from '../components/ui'
import { todayISO } from '../lib/format'
import { PROJET_STATUT_VALUES, PROJET_STATUT_LABELS } from '../lib/projetLogic'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

const MAX_DOC_BYTES = 2 * 1024 * 1024

export default function ProjetForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [ags, setAgs] = useState([])
  const [membres, setMembres] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [resolutions, setResolutions] = useState([])
  const [form, setForm] = useState({
    nom: '', description: '', ag_id: '', resolution_id: '', chef_projet_id: '',
    budget_alloue: '', statut: 'ouvert', date_ouverture: todayISO(), documents: [],
  })
  const [budgetTouched, setBudgetTouched] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const [agList, mem, budgets] = await Promise.all([
        repo.listAG().catch(() => []),
        repo.listMembres().catch(() => []),
        repo.listAGBudgets().catch(() => []),
      ])
      setAgs(agList)
      setMembres(mem)
      setAgBudgets(budgets)
      if (editing) {
        const p = await repo.getProjet(id)
        if (p) {
          setForm({
            nom: p.nom, description: p.description || '', ag_id: p.ag_id || '', resolution_id: p.resolution_id || '',
            chef_projet_id: p.chef_projet_id || '', budget_alloue: p.budget_alloue ?? '', statut: p.statut,
            date_ouverture: p.date_ouverture || '', date_cloture: p.date_cloture || '', documents: p.documents || [],
          })
          setBudgetTouched(true)
        }
      } else {
        // Pré-remplissage depuis "Ouvrir un projet" (AGDetail).
        const rId = params.get('resolution')
        const aId = params.get('ag')
        if (rId) setForm((f) => ({ ...f, resolution_id: rId, ag_id: aId || '' }))
      }
      setLoading(false)
    }
    init()
  }, [id, editing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!form.ag_id) {
      setResolutions([])
      return
    }
    repo.getAG(form.ag_id).then((ag) => setResolutions(ag?.resolutions || []))
  }, [form.ag_id])

  const resBudget = useMemo(() => agBudgets.find((b) => b.resolution_id === form.resolution_id) || null, [agBudgets, form.resolution_id])

  // Prefill budget avec le restant disponible de la résolution (création).
  useEffect(() => {
    if (!editing && !budgetTouched && resBudget) {
      setForm((f) => ({ ...f, budget_alloue: String(resBudget.restant) }))
    }
  }, [resBudget, editing, budgetTouched])

  if (isMobile) {
    return (
      <div>
        <PageHeader title={editing ? 'Modifier le projet' : 'Nouveau projet'} />
        <DesktopOnly what="La création et la modification des projets" onBack={() => navigate(-1)} />
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seul le président peut créer ou modifier un projet.</Card>
      </div>
    )
  }
  if (loading) return <Spinner />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const onFile = async (e) => {
    setError('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_DOC_BYTES) return setError(`Fichier trop volumineux (max ${MAX_DOC_BYTES / 1024 / 1024} Mo).`)
    const dataUrl = await new Promise((res) => {
      const r = new FileReader()
      r.onload = () => res(r.result)
      r.readAsDataURL(file)
    })
    setForm((f) => ({ ...f, documents: [...f.documents, { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, dataUrl, uploaded_at: new Date().toISOString() }] }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.nom.trim()) return setError('Le nom du projet est obligatoire.')
    if (!form.resolution_id) return setError('Un projet doit être issu d’une résolution d’AG.')
    setSaving(true)
    try {
      const payload = {
        nom: form.nom,
        description: form.description || null,
        ag_id: form.ag_id || null,
        resolution_id: form.resolution_id,
        chef_projet_id: form.chef_projet_id || null,
        budget_alloue: form.budget_alloue === '' ? null : Number(form.budget_alloue),
        statut: form.statut,
        date_ouverture: form.date_ouverture || null,
        date_cloture: form.date_cloture || null,
        documents: form.documents,
      }
      if (editing) {
        await repo.updateProjet(id, payload)
        navigate(`/projets/${id}`)
      } else {
        const created = await repo.createProjet(payload)
        navigate(`/projets/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={editing ? 'Modifier le projet' : 'Nouveau projet'} />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <Input label="Nom du projet" value={form.nom} onChange={set('nom')} required placeholder="ex : Réfection du réseau d’eaux pluviales" />
          <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Assemblée Générale d’origine" value={form.ag_id} onChange={(e) => setForm((f) => ({ ...f, ag_id: e.target.value, resolution_id: '' }))} required>
              <option value="">— Choisir —</option>
              {ags.map((ag) => <option key={ag.id} value={ag.id}>{ag.numero} · {ag.type}</option>)}
            </Select>
            <Select label="Résolution votée" value={form.resolution_id} onChange={set('resolution_id')} disabled={!form.ag_id} required>
              <option value="">— Choisir —</option>
              {resolutions.map((r) => {
                const hasBudget = agBudgets.some((b) => b.resolution_id === r.id)
                return <option key={r.id} value={r.id}>N° {r.numero} — {r.titre}{hasBudget ? ' 💰' : ''}</option>
              })}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Chef de projet" value={form.chef_projet_id} onChange={set('chef_projet_id')}>
              <option value="">— À définir —</option>
              {membres.filter((m) => m.actif).map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
            </Select>
            <Select label="Statut" value={form.statut} onChange={set('statut')}>
              {PROJET_STATUT_VALUES.map((s) => <option key={s} value={s}>{PROJET_STATUT_LABELS[s]}</option>)}
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Input label="Budget alloué (€)" type="number" min="0" step="0.01" value={form.budget_alloue} onChange={(e) => { setBudgetTouched(true); set('budget_alloue')(e) }} />
              {resBudget && <p className="mt-1 text-xs text-slate-400">Résolution : {eur(resBudget.alloue)} votés · {eur(resBudget.restant)} encore disponibles.</p>}
            </div>
            <Input label="Date d’ouverture" type="date" value={form.date_ouverture} onChange={set('date_ouverture')} />
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Documents partagés</span>
            <div className="space-y-2">
              {form.documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{doc.name} <span className="text-xs text-slate-400">({Math.round((doc.size || 0) / 1024)} Ko)</span></span>
                  <button type="button" onClick={() => setForm((f) => ({ ...f, documents: f.documents.filter((x) => x.id !== doc.id) }))} className="text-xs text-red-600 underline">Retirer</button>
                </div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 hover:bg-navy-100">
                + Ajouter un fichier
                <input type="file" className="hidden" onChange={onFile} />
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Ouvrir le projet'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
