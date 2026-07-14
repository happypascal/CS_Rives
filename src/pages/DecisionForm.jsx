import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Spinner } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import { nextNumero } from '../lib/decisionLogic'
import { todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'

export default function DecisionForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [numero, setNumero] = useState('')
  const [dateDecision, setDateDecision] = useState(todayISO())
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const all = await repo.listDecisions()
      if (editing) {
        const d = await repo.getDecision(id)
        if (d) {
          setNumero(d.numero)
          setDateDecision(d.date_decision)
          setTitre(d.titre)
          setDescription(d.description)
        }
      } else {
        const year = new Date().getFullYear()
        setNumero(nextNumero(year, all))
      }
      setLoading(false)
    }
    init()
  }, [id, editing])

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seul le président peut créer ou modifier une décision.</Card>
      </div>
    )
  }

  if (loading) return <Spinner />

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!titre.trim()) return setError('Le titre est obligatoire.')
    if (!description.trim() || description === '<br>') return setError('La description est obligatoire.')
    setSaving(true)
    try {
      if (editing) {
        await repo.updateDecision(id, { date_decision: dateDecision, titre, description })
        navigate(`/registre/${id}`)
      } else {
        const created = await repo.createDecision({ numero, date_decision: dateDecision, titre, description })
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Numéro" value={numero} readOnly className="bg-slate-50" />
            <Input
              label="Date de la décision"
              type="date"
              value={dateDecision}
              onChange={(e) => setDateDecision(e.target.value)}
              required
            />
          </div>
          <Input label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} required placeholder="Objet de la décision" />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description</span>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Corps de la décision…" />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
