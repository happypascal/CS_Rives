import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import { nextNumero } from '../lib/decisionLogic'
import { todayISO, addBusinessDaysISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'

const MAX_DOC_BYTES = 2 * 1024 * 1024 // 2 Mo / fichier (démo localStorage)

export default function DecisionForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [numero, setNumero] = useState('')
  const [datePublication, setDatePublication] = useState(todayISO())
  const [dateLimite, setDateLimite] = useState(addBusinessDaysISO(todayISO(), 7))
  const [limiteEdited, setLimiteEdited] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [budget, setBudget] = useState('')
  const [budgetIntitule, setBudgetIntitule] = useState('')
  const [agId, setAgId] = useState('')
  const [resolutionId, setResolutionId] = useState('')
  const [documents, setDocuments] = useState([])
  const [ags, setAgs] = useState([])
  const [resolutions, setResolutions] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const [all, agList] = await Promise.all([repo.listDecisions(), repo.listAG()])
      setAgs(agList)
      if (editing) {
        const d = await repo.getDecision(id)
        if (d) {
          if (d.enregistree) {
            setError('locked')
          }
          setNumero(d.numero)
          setDatePublication(d.date_publication)
          setDateLimite(d.date_limite_reponse || '')
          setLimiteEdited(true)
          setTitre(d.titre)
          setDescription(d.description)
          setBudget(d.budget_alloue ?? '')
          setBudgetIntitule(d.budget_intitule || '')
          setAgId(d.ag_id || '')
          setResolutionId(d.resolution_id || '')
          setDocuments(d.documents || [])
        }
      } else {
        setNumero(nextNumero(new Date().getFullYear(), all))
      }
      setLoading(false)
    }
    init()
  }, [id, editing])

  // Charge les résolutions de l'AG rattachée.
  useEffect(() => {
    if (!agId) {
      setResolutions([])
      return
    }
    repo.getAG(agId).then((ag) => setResolutions(ag?.resolutions || []))
  }, [agId])

  // Recalcule la date limite (+7 jours ouvrables) tant qu'elle n'a pas été éditée à la main.
  useEffect(() => {
    if (!limiteEdited && datePublication) setDateLimite(addBusinessDaysISO(datePublication, 7))
  }, [datePublication, limiteEdited])

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seul le président peut créer ou modifier une décision.</Card>
      </div>
    )
  }
  if (loading) return <Spinner />
  if (error === 'locked') {
    return (
      <div>
        <PageHeader title="Décision enregistrée" />
        <Card className="p-6 text-sm text-slate-600">
          Cette décision est enregistrée : elle n’est plus modifiable.{' '}
          <button className="text-navy-600 underline" onClick={() => navigate(`/registre/${id}`)}>Retour au détail</button>
        </Card>
      </div>
    )
  }

  const onFile = async (e) => {
    setError('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_DOC_BYTES) {
      setError(`Fichier trop volumineux (max ${Math.round(MAX_DOC_BYTES / 1024 / 1024)} Mo en mode démo).`)
      return
    }
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
    setDocuments((docs) => [...docs, { id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, dataUrl, uploaded_at: new Date().toISOString() }])
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!titre.trim()) return setError('Le titre est obligatoire.')
    if (!description.trim() || description === '<br>') return setError('La description est obligatoire.')
    setSaving(true)
    try {
      const payload = {
        date_publication: datePublication,
        date_limite_reponse: dateLimite || null,
        titre,
        description,
        budget_alloue: budget === '' ? null : Number(budget),
        budget_intitule: budgetIntitule || null,
        ag_id: agId || null,
        resolution_id: resolutionId || null,
        documents,
      }
      if (editing) {
        await repo.updateDecision(id, payload)
        navigate(`/registre/${id}`)
      } else {
        const created = await repo.createDecision({ numero, ...payload })
        navigate(`/registre/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={editing ? 'Modifier la décision' : 'Nouvelle décision'} />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Numéro" value={numero} readOnly className="bg-slate-50" />
            <Input label="Date de publication" type="date" value={datePublication} onChange={(e) => setDatePublication(e.target.value)} required />
            <Input
              label="Date limite de réponse"
              type="date"
              value={dateLimite}
              onChange={(e) => { setDateLimite(e.target.value); setLimiteEdited(true) }}
            />
          </div>
          <p className="-mt-2 text-xs text-slate-400">Date limite par défaut : publication + 7 jours ouvrables (modifiable).</p>

          <Input label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} required placeholder="Objet de la décision" />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Corps de la décision…" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Budget alloué (€) — optionnel" type="number" min="0" step="0.01" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="ex : 5800" />
            <Input label="Intitulé du budget" value={budgetIntitule} onChange={(e) => setBudgetIntitule(e.target.value)} placeholder="ex : Entretien espaces verts" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Rattacher à une AG — optionnel" value={agId} onChange={(e) => { setAgId(e.target.value); setResolutionId('') }}>
              <option value="">— Aucune (décision CS) —</option>
              {ags.map((ag) => <option key={ag.id} value={ag.id}>{ag.numero} · {ag.type}</option>)}
            </Select>
            <Select label="Résolution AG liée" value={resolutionId} onChange={(e) => setResolutionId(e.target.value)} disabled={!agId}>
              <option value="">— Aucune —</option>
              {resolutions.map((r) => <option key={r.id} value={r.id}>N° {r.numero} — {r.titre}</option>)}
            </Select>
          </div>

          {/* Pièces jointes */}
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Pièces jointes (offres, devis…)</span>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{doc.name} <span className="text-xs text-slate-400">({Math.round((doc.size || 0) / 1024)} Ko)</span></span>
                  <button type="button" onClick={() => setDocuments((d) => d.filter((x) => x.id !== doc.id))} className="text-xs text-red-600 underline">Retirer</button>
                </div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 hover:bg-navy-100">
                + Ajouter un fichier
                <input type="file" className="hidden" onChange={onFile} />
              </label>
            </div>
          </div>

          {error && error !== 'locked' && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer le brouillon'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
