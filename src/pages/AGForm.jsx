import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Textarea, Spinner } from '../components/ui'
import { todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'

const EMPTY = {
  numero: '',
  type: 'AGO',
  date_ag: todayISO(),
  lieu: '',
  president_seance: '',
  ordre_du_jour: '',
  nombre_presents: 0,
  nombre_representes: 0,
  nombre_total: 50,
  superficie_representee: 0,
  statut: 'en_cours',
}

export default function AGForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(editing)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (editing) {
      repo.getAG(id).then((ag) => {
        if (ag) setForm({ ...EMPTY, ...ag })
        setLoading(false)
      })
    }
  }, [id, editing])

  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seul le président peut créer ou modifier une AG.</Card>
      </div>
    )
  }
  if (loading) return <Spinner />

  const set = (k) => (e) => {
    const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value
    setForm((f) => ({ ...f, [k]: val }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.numero.trim()) return setError('Le numéro est obligatoire (ex: AGO-2026-01).')
    if (!form.president_seance.trim()) return setError('Le président de séance est obligatoire.')
    setSaving(true)
    try {
      const quorum = form.nombre_total > 0
        ? (Number(form.nombre_presents) + Number(form.nombre_representes)) * 2 > form.nombre_total
        : null
      const payload = { ...form, quorum_atteint: quorum }
      if (editing) {
        await repo.updateAG(id, payload)
        navigate(`/ag/${id}`)
      } else {
        const created = await repo.createAG(payload)
        navigate(`/ag/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={editing ? 'Modifier l’AG' : 'Nouvelle Assemblée Générale'} />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Numéro" value={form.numero} onChange={set('numero')} placeholder="AGO-2026-01" required />
            <Select label="Type" value={form.type} onChange={set('type')}>
              <option value="AGO">AGO — ordinaire</option>
              <option value="AGE">AGE — extraordinaire</option>
            </Select>
            <Input label="Date" type="date" value={form.date_ag} onChange={set('date_ag')} required />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Lieu" value={form.lieu} onChange={set('lieu')} placeholder="Salle des fêtes de Nernier" />
            <Input label="Président de séance" value={form.president_seance} onChange={set('president_seance')} required />
          </div>
          <Textarea label="Ordre du jour" value={form.ordre_du_jour} onChange={set('ordre_du_jour')} rows={4} placeholder="1. …&#10;2. …" />
          <div className="grid gap-4 sm:grid-cols-4">
            <Input label="Présents" type="number" min="0" value={form.nombre_presents} onChange={set('nombre_presents')} />
            <Input label="Représentés" type="number" min="0" value={form.nombre_representes} onChange={set('nombre_representes')} />
            <Input label="Total colotis" type="number" min="0" value={form.nombre_total} onChange={set('nombre_total')} />
            <Input label="Superficie repr. (m²)" type="number" min="0" step="0.01" value={form.superficie_representee} onChange={set('superficie_representee')} />
          </div>
          <Select label="Statut" value={form.statut} onChange={set('statut')}>
            <option value="en_cours">En cours</option>
            <option value="cloturee">Clôturée</option>
            <option value="annulee">Annulée</option>
          </Select>
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
