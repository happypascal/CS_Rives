import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Textarea, Spinner, DesktopOnly, eur } from '../components/ui'
import { todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

const MAX_DOC_BYTES = 2 * 1024 * 1024

// Le projet ne porte ni budget ni AG : ce sont les résolutions qui le financent
// (resolutions_ag.projet_id) et le budget s'en dérive. Ce formulaire ne saisit
// donc QUE l'exécution : nom, description, chef, statut, dates, documents.
// Le rattachement des résolutions se fait depuis la fiche AG — c'est le sens réel :
// l'AG vote une enveloppe, puis on décide si elle ouvre un projet ou en abonde un.
// Pas de `statut` : suspendre ou terminer un projet est une délibération du CS,
// pas une case de formulaire (cf. projetLogic + migration 011). Le statut se
// dérive des engagements et des décisions portant un `projet_action`.
const EMPTY = {
  nom: '', description: '', chef_projet_id: '',
  date_ouverture: todayISO(), date_cloture: '', documents: [],
}

export default function ProjetForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [membres, setMembres] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  // Création depuis « Ouvrir un projet » sur une résolution (AGDetail) : la
  // résolution d'origine est le seul rattachement posé à la création.
  const resolutionOrigine = params.get('resolution')

  useEffect(() => {
    async function init() {
      const [mem, budgets] = await Promise.all([
        repo.listMembres().catch(() => []),
        repo.listAGBudgets().catch(() => []),
      ])
      setMembres(mem)
      setAgBudgets(budgets)
      if (editing) {
        const p = await repo.getProjet(id)
        if (p) {
          setForm({
            nom: p.nom, description: p.description || '', chef_projet_id: p.chef_projet_id || '',
            date_ouverture: p.date_ouverture || '', date_cloture: p.date_cloture || '',
            documents: p.documents || [],
          })
        }
      }
      setLoading(false)
    }
    init()
  }, [id, editing])

  const budgetOrigine = useMemo(
    () => agBudgets.find((b) => b.resolution_id === resolutionOrigine) || null,
    [agBudgets, resolutionOrigine],
  )

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

  // Un projet naît toujours d'une résolution : sans elle il n'aurait aucun budget
  // et aucune AG ne l'aurait voté. On refuse la création à vide plutôt que de
  // laisser ouvrir une coquille à 0 €.
  if (!editing && !budgetOrigine) {
    return (
      <div>
        <PageHeader title="Nouveau projet" />
        <Card className="p-6 text-sm text-slate-600">
          <p>Un projet s’ouvre depuis une <strong>résolution d’AG adoptée et dotée d’un budget</strong> : c’est elle qui le finance.</p>
          <p className="mt-2">Ouvrez la fiche de l’AG concernée, puis « Ouvrir un projet » sur la résolution voulue.</p>
          <Button variant="secondary" className="mt-4" onClick={() => navigate('/ag')}>Aller aux Assemblées Générales</Button>
        </Card>
      </div>
    )
  }

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
    setSaving(true)
    try {
      const payload = {
        nom: form.nom,
        description: form.description || null,
        chef_projet_id: form.chef_projet_id || null,
        date_ouverture: form.date_ouverture || null,
        date_cloture: form.date_cloture || null,
        documents: form.documents,
      }
      if (editing) {
        await repo.updateProjet(id, payload)
        navigate(`/projets/${id}`)
      } else {
        // resolution_ids : champ virtuel, consommé par le repo pour poser
        // resolutions_ag.projet_id — ce n'est pas une colonne de `projets`.
        const created = await repo.createProjet({ ...payload, resolution_ids: [resolutionOrigine] })
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
          {!editing && budgetOrigine && (
            <div className="rounded-md border border-navy-100 bg-navy-50 p-3 text-sm">
              <p className="font-medium text-navy-800">
                Financé par : {budgetOrigine.ag_numero} — résolution n° {budgetOrigine.resolution_numero}
              </p>
              <p className="mt-0.5 text-navy-700">{budgetOrigine.intitule} · <strong>{eur(budgetOrigine.alloue)}</strong></p>
              <p className="mt-1 text-xs text-slate-500">
                Le budget du projet est la somme des résolutions qui le financent. Pour l’augmenter, rattachez-lui une autre
                résolution adoptée depuis la fiche de l’AG — il ne se saisit pas ici.
              </p>
            </div>
          )}
          {editing && (
            <p className="text-xs text-slate-500">
              Budget et AG d’origine se dérivent des résolutions rattachées : ils se modifient depuis la fiche AG, pas ici.
            </p>
          )}

          <Input label="Nom du projet" value={form.nom} onChange={set('nom')} required placeholder="ex : Réfection du réseau d’eaux pluviales" />
          <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />

          <Select label="Chef de projet" value={form.chef_projet_id} onChange={set('chef_projet_id')}>
            <option value="">— À définir —</option>
            {membres.filter((m) => m.actif).map((m) => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
          </Select>

          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Le <strong>statut</strong> ne se saisit pas : un projet est « ouvert » tant que rien n’y est engagé, « en cours »
            dès qu’une décision y engage de l’argent. Le <strong>suspendre</strong> ou le <strong>terminer</strong> est une
            délibération du Conseil Syndical — cela se fait depuis une décision, après vote.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Date d’ouverture" type="date" value={form.date_ouverture} onChange={set('date_ouverture')} />
            <Input label="Date de clôture" type="date" value={form.date_cloture} onChange={set('date_cloture')} />
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
