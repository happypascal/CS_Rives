import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, DesktopOnly } from '../components/ui'
import { todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

// Les clés de EMPTY = exactement les colonnes éditables de assemblees_generales.
// `ordre_du_jour` en est volontairement absent : l'ordre du jour, ce sont les
// résolutions « à voter » saisies sur la fiche de l'AG (choix Pascal 2026-07-18).
// La colonne existe encore en base mais n'est plus ni éditée ni affichée — un
// ancien texte y est simplement laissé tel quel, jamais réécrit.
// `repo.getAG()` renvoie EN PLUS un tableau `resolutions` (jointure) : il ne doit
// jamais repartir dans un update, sinon PostgREST rejette la colonne inconnue.
const EMPTY = { numero: '', type: 'AGO', date_ag: todayISO(), lieu: '', president_seance: '', statut: 'en_cours', pv_url: '' }

// Ne garde que les colonnes réelles, et normalise les champs vides en null.
function toPayload(form) {
  const payload = {}
  for (const k of Object.keys(EMPTY)) {
    const v = form[k]
    payload[k] = typeof v === 'string' && v.trim() === '' ? null : v
  }
  return payload
}

export default function AGForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { isAdmin, isSecretaire } = useAuth()
  const isMobile = useIsMobile()
  // Créer/modifier une AG : président OU secrétaire (art. 14 — le secrétaire
  // tient les assemblées). Point 5.
  const canManage = isAdmin || isSecretaire
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

  if (isMobile) {
    return (
      <div>
        <PageHeader title={editing ? 'Modifier l’AG' : 'Nouvelle Assemblée Générale'} />
        <DesktopOnly what="La création et la modification des AG" onBack={() => navigate(-1)} />
      </div>
    )
  }
  if (!canManage) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seuls le président et le secrétaire peuvent créer ou modifier une AG.</Card>
      </div>
    )
  }
  if (loading) return <Spinner />

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.numero.trim()) return setError('Le numéro est obligatoire (ex: AGO-2026-01).')
    // Le président de séance est élu EN séance : inconnu tant que l'AG n'a pas eu
    // lieu. On ne l'exige donc jamais à la saisie ; il se renseigne après coup.
    setSaving(true)
    try {
      const payload = toPayload(form)
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
            <Input label="Président de séance (désigné en séance)" value={form.president_seance || ''} onChange={set('president_seance')} placeholder="À renseigner après l’AG" />
          </div>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
            L’ordre du jour se compose en ajoutant des <strong>résolutions « à voter »</strong> sur la fiche de l’AG, une fois celle-ci créée.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Statut" value={form.statut} onChange={set('statut')}>
              <option value="en_cours">En cours</option>
              <option value="cloturee">Clôturée</option>
              <option value="annulee">Annulée</option>
            </Select>
            <Input label="Lien PV signé (optionnel)" value={form.pv_url || ''} onChange={set('pv_url')} placeholder="https://…" />
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
