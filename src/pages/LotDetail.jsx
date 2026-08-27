import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Textarea, Modal, Spinner, Badge } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { RgpdGate } from '../components/RgpdGate'
import { formatDate, todayISO, parseMontant } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

// Champs du propriétaire, déclarés une fois : la saisie du propriétaire actuel
// et celle du nouveau propriétaire lors d'une mutation demandent EXACTEMENT les
// mêmes informations. Deux formulaires écrits séparément finiraient par diverger.
const CHAMPS_VIDES = {
  nom: '', est_societe: false, gerant_nom: '', gerant_fonction: '',
  adresse_communication: '', adresse_gerant: '', email: '', telephone: '',
  gerant_email: '', gerant_telephone: '',
  date_acquisition: '', observations: '',
}

export default function LotDetail() {
  return (
    <RgpdGate>
      <Contenu />
    </RgpdGate>
  )
}

function Contenu() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const [lot, setLot] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [form, setForm] = useState(CHAMPS_VIDES)
  const [lotForm, setLotForm] = useState({ numero: '', adresse_lotissement: '', superficie: '', observations: '' })
  const [busy, setBusy] = useState(false)
  const [mutation, setMutation] = useState(null) // { date_mutation, ...champs } quand la modale est ouverte
  const [confirm, confirmModal] = useConfirm()

  const peutSaisir = !isMobile

  const reload = useCallback(async () => {
    setError('')
    try {
      const l = await repo.getLot(id)
      setLot(l)
      if (l) {
        setLotForm({ numero: l.numero || '', adresse_lotissement: l.adresse_lotissement || '', superficie: l.superficie ?? '', observations: l.observations || '' })
        setForm({ ...CHAMPS_VIDES, ...Object.fromEntries(Object.keys(CHAMPS_VIDES).map((k) => [k, l.proprietaire?.[k] ?? CHAMPS_VIDES[k]])) })
      }
    } catch (e) {
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { reload() }, [reload])

  if (loading) return <Spinner />
  if (error) {
    return (
      <div>
        <PageHeader title="Registre des propriétaires" />
        <Card className="p-6"><p className="text-sm text-red-700">{error}</p></Card>
      </div>
    )
  }
  if (!lot) {
    return (
      <div>
        <PageHeader title="Lot introuvable" />
        <Link to="/proprietaires" className="text-navy-600 underline">← Retour au registre</Link>
      </div>
    )
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setLotChamp = (k) => (e) => setLotForm((f) => ({ ...f, [k]: e.target.value }))

  const enregistrer = async () => {
    if (!form.nom.trim()) return setError('Le nom du propriétaire est obligatoire.')
    setBusy(true)
    setError('')
    try {
      // Superficie : `parseMontant` tolère la virgule décimale et les espaces —
      // une surface se saisit « 612,50 » en français, pas « 612.5 ».
      const superficie = parseMontant(lotForm.superficie)
      if (lotForm.superficie !== '' && (superficie == null || superficie <= 0)) {
        setBusy(false)
        return setError('La superficie doit être un nombre positif (ex : 612,50).')
      }
      await repo.updateLot(id, {
        numero: lotForm.numero.trim(),
        adresse_lotissement: lotForm.adresse_lotissement || null,
        superficie,
        observations: lotForm.observations || null,
      })
      await repo.saveProprietaire(id, {
        ...form,
        nom: form.nom.trim(),
        date_acquisition: form.date_acquisition || null,
        gerant_nom: form.gerant_nom || null,
        gerant_fonction: form.gerant_fonction || null,
        gerant_email: form.gerant_email || null,
        gerant_telephone: form.gerant_telephone || null,
        adresse_communication: form.adresse_communication || null,
        adresse_gerant: form.adresse_gerant || null,
        email: form.email || null,
        telephone: form.telephone || null,
        observations: form.observations || null,
      })
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const enregistrerMutation = async () => {
    if (!mutation.nom.trim() || !mutation.date_mutation) return
    setBusy(true)
    try {
      const { date_mutation, ...nouveau } = mutation
      await repo.enregistrerMutation(id, {
        date_mutation,
        ...nouveau,
        nom: nouveau.nom.trim(),
        gerant_nom: nouveau.gerant_nom || null,
        gerant_fonction: nouveau.gerant_fonction || null,
        gerant_email: nouveau.gerant_email || null,
        gerant_telephone: nouveau.gerant_telephone || null,
        adresse_communication: nouveau.adresse_communication || null,
        adresse_gerant: nouveau.adresse_gerant || null,
        email: nouveau.email || null,
        telephone: nouveau.telephone || null,
        observations: nouveau.observations || null,
      })
      setMutation(null)
      await reload()
    } catch (e) {
      alert(e.message)
    } finally {
      setBusy(false)
    }
  }

  const supprimer = async () => {
    if (!(await confirm({
      title: `Supprimer le lot ${lot.numero} ?`,
      message: 'Le propriétaire actuel ET tout l’historique des anciens propriétaires seront supprimés. Cette action est irréversible.',
      confirmLabel: 'Supprimer', danger: true,
    }))) return
    try {
      await repo.deleteLot(id)
      navigate('/proprietaires')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title={<span>Lot <span className="text-navy-800">{lot.numero}</span></span>}
        subtitle={lot.proprietaire ? lot.proprietaire.nom : 'Aucun propriétaire enregistré'}
        actions={
          <>
            <Link to="/proprietaires"><Button variant="ghost">Retour au registre</Button></Link>
            {peutSaisir && (
              <Button variant="secondary" onClick={() => setMutation({ ...CHAMPS_VIDES, date_mutation: todayISO() })}>
                Enregistrer une mutation
              </Button>
            )}
            {isAdmin && !isMobile && <Button variant="danger" onClick={supprimer}>Supprimer le lot</Button>}
          </>
        }
      />

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Le lot" subtitle="Ce qui ne change pas quand le propriétaire change." />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <Input label="Numéro de lot" value={lotForm.numero} onChange={setLotChamp('numero')} readOnly={!peutSaisir} />
              <Input label="Adresse dans le lotissement" value={lotForm.adresse_lotissement} onChange={setLotChamp('adresse_lotissement')} readOnly={!peutSaisir} />
              {/* type="text" à dessein, comme les montants ailleurs dans l'app :
                  un input number capte la molette et modifie la valeur sans
                  qu'on s'en aperçoive — sur l'assiette des voix, c'est exclu. */}
              <div className="sm:col-span-2">
                <Input label="Superficie (m²)" type="text" inputMode="decimal" value={lotForm.superficie} onChange={setLotChamp('superficie')} readOnly={!peutSaisir} placeholder="ex : 612,50" />
                <p className="mt-1 text-xs text-slate-500">
                  Assiette du <strong>poids de vote en AG</strong> (vote au prorata des superficies) et de la{' '}
                  <strong>répartition des charges</strong>. Une superficie fausse fausse les deux.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Observations sur le lot" rows={2} value={lotForm.observations} onChange={setLotChamp('observations')} readOnly={!peutSaisir} />
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Propriétaire actuel"
              subtitle="Pour changer de propriétaire, utilisez « Enregistrer une mutation » — l’ancien passe alors à l’historique."
            />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Nom du propriétaire (ou raison sociale)" value={form.nom} onChange={set('nom')} readOnly={!peutSaisir} required />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.est_societe} onChange={set('est_societe')} disabled={!peutSaisir} />
                  Le propriétaire est une société (SCI, indivision…)
                </label>
              </div>
              {/* Gérant : affiché seulement pour une société. Sur une personne
                  physique, ces deux champs n'ont pas de sens et encombrent. */}
              {form.est_societe && (
                <>
                  <Input label="Nom du gérant / mandataire" value={form.gerant_nom} onChange={set('gerant_nom')} readOnly={!peutSaisir} />
                  <Input label="Fonction" value={form.gerant_fonction} onChange={set('gerant_fonction')} readOnly={!peutSaisir} placeholder="gérant, président…" />
                  <div className="sm:col-span-2">
                    <Input label="Adresse du mandataire" value={form.adresse_gerant} onChange={set('adresse_gerant')} readOnly={!peutSaisir} />
                  </div>
                  <Input label="Email du mandataire" type="email" value={form.gerant_email} onChange={set('gerant_email')} readOnly={!peutSaisir} />
                  <Input label="Téléphone du mandataire" value={form.gerant_telephone} onChange={set('gerant_telephone')} readOnly={!peutSaisir} />
                </>
              )}
              <div className="sm:col-span-2">
                <Input label="Adresse de communication officielle" value={form.adresse_communication} onChange={set('adresse_communication')} readOnly={!peutSaisir} />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={set('email')} readOnly={!peutSaisir} />
              <Input label="Téléphone" value={form.telephone} onChange={set('telephone')} readOnly={!peutSaisir} />
              <Input label="Propriétaire depuis le" type="date" value={form.date_acquisition} onChange={set('date_acquisition')} readOnly={!peutSaisir} />
              <div className="sm:col-span-2">
                <Textarea label="Observations" rows={2} value={form.observations} onChange={set('observations')} readOnly={!peutSaisir} />
              </div>
            </div>
            {peutSaisir && (
              <div className="flex justify-end border-t border-navy-100 px-5 py-3">
                <Button onClick={enregistrer} disabled={busy || !form.nom.trim()}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Anciens propriétaires" subtitle="Du plus récent au plus ancien." />
            {lot.historique?.length ? (
              <ul className="divide-y divide-navy-50">
                {lot.historique.map((p) => (
                  <li key={p.id} className="px-5 py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium text-navy-800">{p.nom}</p>
                      {p.est_societe && <Badge tone="gray">société</Badge>}
                    </div>
                    {p.gerant_nom && <p className="text-xs text-slate-500">{p.gerant_fonction ? `${p.gerant_fonction} : ` : ''}{p.gerant_nom}</p>}
                    {/* Les deux dates portent la mutation : il n'y a pas de
                        table « mutations » à tenir en plus. */}
                    <p className="mt-1 text-xs text-slate-500">
                      {p.date_acquisition ? <>du {formatDate(p.date_acquisition)}</> : <>jusqu’au</>}{' '}
                      {p.date_acquisition && <>au </>}{formatDate(p.date_cession)}
                    </p>
                    {p.observations && <p className="mt-1 text-xs italic text-slate-400">{p.observations}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">Aucune mutation enregistrée.</p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        open={Boolean(mutation)}
        onClose={() => setMutation(null)}
        title={`Lot ${lot.numero} — mutation`}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setMutation(null)}>Annuler</Button>
            <Button onClick={enregistrerMutation} disabled={busy || !mutation?.nom?.trim() || !mutation?.date_mutation}>
              Enregistrer la mutation
            </Button>
          </>
        }
      >
        {mutation && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {lot.proprietaire
                ? <>À cette date, <strong>{lot.proprietaire.nom}</strong> cesse d’être propriétaire et passe à l’historique. Le nouveau propriétaire prend sa suite.</>
                : <>Le lot n’a pas de propriétaire enregistré : cette mutation en pose un premier.</>}
            </p>
            <Input label="Date de la mutation" type="date" value={mutation.date_mutation} onChange={(e) => setMutation((m) => ({ ...m, date_mutation: e.target.value }))} required />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Input label="Nom du nouveau propriétaire (ou raison sociale)" value={mutation.nom} onChange={(e) => setMutation((m) => ({ ...m, nom: e.target.value }))} required />
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={mutation.est_societe} onChange={(e) => setMutation((m) => ({ ...m, est_societe: e.target.checked }))} />
                  Le nouveau propriétaire est une société
                </label>
              </div>
              {mutation.est_societe && (
                <>
                  <Input label="Nom du gérant / mandataire" value={mutation.gerant_nom} onChange={(e) => setMutation((m) => ({ ...m, gerant_nom: e.target.value }))} />
                  <Input label="Fonction" value={mutation.gerant_fonction} onChange={(e) => setMutation((m) => ({ ...m, gerant_fonction: e.target.value }))} />
                  <div className="sm:col-span-2">
                    <Input label="Adresse du mandataire" value={mutation.adresse_gerant} onChange={(e) => setMutation((m) => ({ ...m, adresse_gerant: e.target.value }))} />
                  </div>
                  <Input label="Email du mandataire" type="email" value={mutation.gerant_email} onChange={(e) => setMutation((m) => ({ ...m, gerant_email: e.target.value }))} />
                  <Input label="Téléphone du mandataire" value={mutation.gerant_telephone} onChange={(e) => setMutation((m) => ({ ...m, gerant_telephone: e.target.value }))} />
                </>
              )}
              <div className="sm:col-span-2">
                <Input label="Adresse de communication officielle" value={mutation.adresse_communication} onChange={(e) => setMutation((m) => ({ ...m, adresse_communication: e.target.value }))} />
              </div>
              <Input label="Email" type="email" value={mutation.email} onChange={(e) => setMutation((m) => ({ ...m, email: e.target.value }))} />
              <Input label="Téléphone" value={mutation.telephone} onChange={(e) => setMutation((m) => ({ ...m, telephone: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>

      {confirmModal}
    </div>
  )
}
