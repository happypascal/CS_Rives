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
  nom: '', est_societe: false, dirigeant_nom: '', dirigeant_fonction: '',
  adresse_communication: '', adresse_dirigeant: '', email: '', telephone: '',
  dirigeant_nom_2: '', dirigeant_fonction_2: '', dirigeant_email_2: '', dirigeant_telephone_2: '',
  dirigeant_email: '', dirigeant_telephone: '',
  mandataire_nom: '', mandataire_email: '', mandataire_telephone: '',
  nom_2: '', email_2: '', telephone_2: '', est_indivision: false,
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
  const [lotForm, setLotForm] = useState({ numero: '', adresse_lotissement: '', superficie: '', nombre_lots: '1', numero_syndic: '', observations: '' })
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
        setLotForm({ numero: l.numero || '', adresse_lotissement: l.adresse_lotissement || '', superficie: l.superficie ?? '', nombre_lots: l.nombre_lots ?? '1', numero_syndic: l.numero_syndic || '', observations: l.observations || '' })
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
        <PageHeader title="Parcelle introuvable" />
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
      // Le nombre de lots ne peut pas être vide : il entre dans le total du
      // registre, et une valeur absente y ferait un trou silencieux.
      const nombreLots = parseMontant(lotForm.nombre_lots)
      if (nombreLots == null || nombreLots <= 0) {
        setBusy(false)
        return setError('Le nombre de lots doit être un nombre positif (1 dans la quasi-totalité des cas).')
      }
      await repo.updateLot(id, {
        numero: lotForm.numero.trim(),
        adresse_lotissement: lotForm.adresse_lotissement || null,
        superficie,
        nombre_lots: nombreLots,
        numero_syndic: lotForm.numero_syndic || null,
        observations: lotForm.observations || null,
      })
      await repo.saveProprietaire(id, {
        ...form,
        nom: form.nom.trim(),
        date_acquisition: form.date_acquisition || null,
        dirigeant_nom: form.dirigeant_nom || null,
        dirigeant_fonction: form.dirigeant_fonction || null,
        dirigeant_email: form.dirigeant_email || null,
        dirigeant_telephone: form.dirigeant_telephone || null,
        dirigeant_nom_2: form.dirigeant_nom_2 || null,
        dirigeant_fonction_2: form.dirigeant_fonction_2 || null,
        dirigeant_email_2: form.dirigeant_email_2 || null,
        dirigeant_telephone_2: form.dirigeant_telephone_2 || null,
        mandataire_nom: form.mandataire_nom || null,
        mandataire_email: form.mandataire_email || null,
        mandataire_telephone: form.mandataire_telephone || null,
        nom_2: form.nom_2 || null,
        email_2: form.email_2 || null,
        telephone_2: form.telephone_2 || null,
        est_indivision: Boolean(form.est_indivision),
        adresse_communication: form.adresse_communication || null,
        adresse_dirigeant: form.adresse_dirigeant || null,
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
        dirigeant_nom: nouveau.dirigeant_nom || null,
        dirigeant_fonction: nouveau.dirigeant_fonction || null,
        dirigeant_email: nouveau.dirigeant_email || null,
        dirigeant_telephone: nouveau.dirigeant_telephone || null,
        dirigeant_nom_2: nouveau.dirigeant_nom_2 || null,
        dirigeant_fonction_2: nouveau.dirigeant_fonction_2 || null,
        dirigeant_email_2: nouveau.dirigeant_email_2 || null,
        dirigeant_telephone_2: nouveau.dirigeant_telephone_2 || null,
        mandataire_nom: nouveau.mandataire_nom || null,
        mandataire_email: nouveau.mandataire_email || null,
        mandataire_telephone: nouveau.mandataire_telephone || null,
        nom_2: nouveau.nom_2 || null,
        email_2: nouveau.email_2 || null,
        telephone_2: nouveau.telephone_2 || null,
        est_indivision: Boolean(nouveau.est_indivision),
        adresse_communication: nouveau.adresse_communication || null,
        adresse_dirigeant: nouveau.adresse_dirigeant || null,
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
            <CardHeader title="La parcelle" subtitle="Ce qui ne change pas quand le propriétaire change." />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              {/* ⚠ `numero` porte la PARCELLE cadastrale : le lotissement n'a pas
                  de numérotation de lots exploitable aujourd'hui, et l'inventer
                  dans un registre légal serait pire que de s'en passer. */}
              <Input label="Parcelle cadastrale" value={lotForm.numero} onChange={setLotChamp('numero')} readOnly={!peutSaisir} placeholder="ex : 0B 220" />
              <Input label="Adresse dans le lotissement" value={lotForm.adresse_lotissement} onChange={setLotChamp('adresse_lotissement')} readOnly={!peutSaisir} />
              {/* Référence du syndic : elle revient dans tous les appels de
                  fonds. Ce n'est PAS l'identifiant de la parcelle — celui de la
                  Mairie est au-dessus — mais sans elle, rapprocher une ligne de
                  charges d'une parcelle se fait de tête. */}
              <div className="sm:col-span-2">
                <Input label="N° syndic (Foncia)" value={lotForm.numero_syndic} onChange={setLotChamp('numero_syndic')} readOnly={!peutSaisir} placeholder="ex : 209" />
                <p className="mt-1 text-xs text-slate-500">
                  Référence utilisée par le syndic dans ses appels de fonds. Le numéro officiel de la
                  parcelle est celui du <strong>cadastre transmis par la Mairie</strong>, ci-dessus.
                </p>
              </div>
              {/* Nombre de lots : 1 sauf exception, mais deux parcelles du
                  lotissement en portent 1,81 et 1,19 — d'où 51 lots pour 50
                  parcelles. Sans ce champ, le registre ne pouvait pas compter
                  les lots sans mentir. */}
              <div className="sm:col-span-2">
                <Input label="Nombre de lots" type="text" inputMode="decimal" value={lotForm.nombre_lots} onChange={setLotChamp('nombre_lots')} readOnly={!peutSaisir} placeholder="1" />
                <p className="mt-1 text-xs text-slate-500">
                  <strong>1</strong> dans la quasi-totalité des cas. Une parcelle peut en porter une
                  fraction supplémentaire (1,81 ou 1,19 dans le lotissement) — c’est ce champ, et lui
                  seul, qui permet au registre d’afficher le vrai total.
                </p>
              </div>
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
                  Le propriétaire est une société (SCI)
                </label>
              </div>
              {/* DIRIGEANTS : organes de la société propriétaire, affichés
                  seulement si le propriétaire EST une société. Sur une personne
                  physique ces champs n'ont aucun sens.

                  ⚠ « Dirigeant » est la CATÉGORIE, « gérant » une FONCTION parmi
                  d'autres (président, associé) — c'est le champ Fonction qui la
                  porte. Nommer le champ « gérant » puis y ranger un président
                  écrivait dans un registre légal une qualité que l'intéressé n'a
                  pas (correction Pascal, migration 042).

                  ⚠ La Fonction RECOPIE le registre officiel (gouv.fr), « autre »
                  compris — c'est une transcription, pas un champ à compléter au
                  jugé. Deux dirigeants du lotissement la portent réellement.

                  ⚠ À ne pas confondre avec le mandataire plus bas : le dirigeant
                  ENGAGE la société, le mandataire ne fait que relayer.

                  Deux colonnes parce que la CO-DIRECTION est le cas ordinaire
                  d'une SCI familiale, et qu'elle a des effets concrets pour
                  l'ASL : l'un comme l'autre peut voter et signer pour la société.
                  N'en nommer qu'un laissait le registre muet sur celui qui se
                  présenterait à l'assemblée. */}
              {form.est_societe && (
                <div className="sm:col-span-2 rounded-md border border-navy-100 bg-navy-50/40 p-3">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Dirigeant(s) de la société
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-3">
                      <Input label="Nom du dirigeant" value={form.dirigeant_nom} onChange={set('dirigeant_nom')} readOnly={!peutSaisir} />
                      <Input label="Fonction" value={form.dirigeant_fonction} onChange={set('dirigeant_fonction')} readOnly={!peutSaisir} placeholder="gérant, président, autre…" />
                      <Input label="Email" type="email" value={form.dirigeant_email} onChange={set('dirigeant_email')} readOnly={!peutSaisir} />
                      <Input label="Téléphone" value={form.dirigeant_telephone} onChange={set('dirigeant_telephone')} readOnly={!peutSaisir} />
                    </div>
                    <div className="space-y-3">
                      <Input label="Nom du second dirigeant" value={form.dirigeant_nom_2} onChange={set('dirigeant_nom_2')} readOnly={!peutSaisir} />
                      <Input label="Fonction" value={form.dirigeant_fonction_2} onChange={set('dirigeant_fonction_2')} readOnly={!peutSaisir} placeholder="gérant, associé, autre…" />
                      <Input label="Email" type="email" value={form.dirigeant_email_2} onChange={set('dirigeant_email_2')} readOnly={!peutSaisir} />
                      <Input label="Téléphone" value={form.dirigeant_telephone_2} onChange={set('dirigeant_telephone_2')} readOnly={!peutSaisir} />
                    </div>
                  </div>
                  {/* Une seule adresse : en pratique deux dirigeants d'une même
                      SCI se joignent au même siège. */}
                  <div className="mt-3">
                    <Input label="Adresse de la société" value={form.adresse_dirigeant} onChange={set('adresse_dirigeant')} readOnly={!peutSaisir} />
                  </div>
                </div>
              )}
              <div className="sm:col-span-2">
                {/* Textarea et non Input : l'adresse s'écrit comme sur une
                    enveloppe — voie, puis code postal et ville, puis le pays
                    seulement s'il n'est pas la France. Un champ d'une ligne ne
                    peut ni saisir ni restituer ces retours. */}
                <Textarea
                  label="Adresse de communication officielle"
                  rows={3}
                  value={form.adresse_communication}
                  onChange={set('adresse_communication')}
                  readOnly={!peutSaisir}
                  placeholder={'12 rte de Messery\n74140 Nernier'}
                />
              </div>
              <Input label="Email" type="email" value={form.email} onChange={set('email')} readOnly={!peutSaisir} />
              <Input label="Téléphone" value={form.telephone} onChange={set('telephone')} readOnly={!peutSaisir} />
              {/* INDIVISION — deux personnes, mais UNE propriété : une part de
                  charges, une voix, une période. C'est pourquoi le second
                  indivisaire tient sur la MÊME ligne du registre : le mettre sur
                  une seconde ligne compterait la parcelle, la superficie et les
                  voix en double.
                  ⚠ Placé APRÈS les coordonnées officielles du premier
                  propriétaire (demande de Pascal) : l'adresse de communication,
                  l'e-mail et le téléphone valent pour la propriété entière, et
                  les couper par un second nom faisait douter de qui ils sont. */}
              <div className="sm:col-span-2 rounded-md border border-navy-100 bg-navy-50/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Second propriétaire
                </p>
                <p className="mb-3 text-xs text-slate-500">
                  À renseigner si le bien est détenu par deux personnes. Il reste{' '}
                  <strong>une seule propriété</strong> : une part de charges et une voix, au prorata
                  d’une seule superficie.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Nom du second propriétaire" value={form.nom_2} onChange={set('nom_2')} readOnly={!peutSaisir} />
                  <Input label="Email" type="email" value={form.email_2} onChange={set('email_2')} readOnly={!peutSaisir} />
                  <Input label="Téléphone" value={form.telephone_2} onChange={set('telephone_2')} readOnly={!peutSaisir} />
                </div>
                {/* La QUALIFICATION, distincte du fait d'être deux : on peut
                    détenir à deux sans être en indivision (communauté entre
                    époux, tontine). Non cochée, la case dit « on ne l'affirme
                    pas », pas « ce n'en est pas une ». */}
                <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" checked={form.est_indivision} onChange={set('est_indivision')} disabled={!peutSaisir} />
                  Le bien est détenu en <strong>indivision</strong>
                </label>
              </div>
              {/* MANDATAIRE — l'intermédiaire à qui l'on parle quand on n'atteint
                  pas le propriétaire lui-même (colotis étrangers surtout).
                  Affiché pour TOUT propriétaire, société ou non : un particulier
                  résidant à l'étranger passe par un intermédiaire tout autant
                  qu'une SCI, et une SCI peut avoir ses dirigeants au loin ET
                  un mandataire sur place. Ce n'est PAS un dirigeant. */}
              <div className="sm:col-span-2 rounded-md border border-navy-100 bg-navy-50/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Mandataire (intermédiaire)
                </p>
                <p className="mb-3 text-xs text-slate-500">
                  La personne à contacter à la place du propriétaire. Distincte d’un dirigeant :
                  le dirigeant engage la société, le mandataire ne fait que relayer.
                </p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input label="Nom du mandataire" value={form.mandataire_nom} onChange={set('mandataire_nom')} readOnly={!peutSaisir} />
                  <Input label="Email du mandataire" type="email" value={form.mandataire_email} onChange={set('mandataire_email')} readOnly={!peutSaisir} />
                  <Input label="Téléphone du mandataire" value={form.mandataire_telephone} onChange={set('mandataire_telephone')} readOnly={!peutSaisir} />
                </div>
              </div>
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
                      <p className="text-sm font-medium text-navy-800">
                        {p.nom}{p.nom_2 ? ` et ${p.nom_2}` : ''}
                        {p.est_indivision && <span className="ml-1 text-xs font-normal text-slate-500">(indivision)</span>}
                      </p>
                      {p.est_societe && <Badge tone="gray">société</Badge>}
                    </div>
                    {p.dirigeant_nom && <p className="text-xs text-slate-500">{p.dirigeant_fonction ? `${p.dirigeant_fonction} : ` : ''}{p.dirigeant_nom}</p>}
                    {p.dirigeant_nom_2 && <p className="text-xs text-slate-500">{p.dirigeant_fonction_2 ? `${p.dirigeant_fonction_2} : ` : ''}{p.dirigeant_nom_2}</p>}
                    {p.mandataire_nom && <p className="text-xs text-slate-500">mandataire : {p.mandataire_nom}</p>}
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
                  <Input label="Nom du dirigeant" value={mutation.dirigeant_nom} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_nom: e.target.value }))} />
                  <Input label="Fonction" value={mutation.dirigeant_fonction} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_fonction: e.target.value }))} />
                  <div className="sm:col-span-2">
                    <Input label="Adresse de la société" value={mutation.adresse_dirigeant} onChange={(e) => setMutation((m) => ({ ...m, adresse_dirigeant: e.target.value }))} />
                  </div>
                  <Input label="Email du dirigeant" type="email" value={mutation.dirigeant_email} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_email: e.target.value }))} />
                  <Input label="Téléphone du dirigeant" value={mutation.dirigeant_telephone} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_telephone: e.target.value }))} />
                  {/* Co-direction : cas ordinaire d'une SCI familiale. */}
                  <Input label="Nom du second dirigeant" value={mutation.dirigeant_nom_2} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_nom_2: e.target.value }))} />
                  <Input label="Fonction" value={mutation.dirigeant_fonction_2} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_fonction_2: e.target.value }))} />
                  <Input label="Email du second dirigeant" type="email" value={mutation.dirigeant_email_2} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_email_2: e.target.value }))} />
                  <Input label="Téléphone du second dirigeant" value={mutation.dirigeant_telephone_2} onChange={(e) => setMutation((m) => ({ ...m, dirigeant_telephone_2: e.target.value }))} />
                </>
              )}
              <div className="sm:col-span-2">
                <Textarea
                  label="Adresse de communication officielle"
                  rows={3}
                  value={mutation.adresse_communication}
                  onChange={(e) => setMutation((m) => ({ ...m, adresse_communication: e.target.value }))}
                />
              </div>
              <Input label="Email" type="email" value={mutation.email} onChange={(e) => setMutation((m) => ({ ...m, email: e.target.value }))} />
              <Input label="Téléphone" value={mutation.telephone} onChange={(e) => setMutation((m) => ({ ...m, telephone: e.target.value }))} />
              {/* Second indivisaire APRÈS les coordonnées officielles, même ordre
                  que la fiche : celles du dessus valent pour la propriété
                  entière, les couper par un second nom faisait douter de qui
                  elles sont. */}
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                <Input label="Second propriétaire" value={mutation.nom_2} onChange={(e) => setMutation((m) => ({ ...m, nom_2: e.target.value }))} />
                <Input label="Email" type="email" value={mutation.email_2} onChange={(e) => setMutation((m) => ({ ...m, email_2: e.target.value }))} />
                <Input label="Téléphone" value={mutation.telephone_2} onChange={(e) => setMutation((m) => ({ ...m, telephone_2: e.target.value }))} />
                <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600 sm:col-span-3">
                  <input type="checkbox" checked={mutation.est_indivision} onChange={(e) => setMutation((m) => ({ ...m, est_indivision: e.target.checked }))} />
                  Le bien est détenu en indivision
                </label>
              </div>
              {/* Le mandataire suit le PROPRIÉTAIRE, pas le lot : le nouveau
                  venu a le sien, ou n'en a pas. Il ne s'hérite jamais. */}
              <div className="sm:col-span-2 grid gap-3 sm:grid-cols-3">
                <Input label="Nom du mandataire" value={mutation.mandataire_nom} onChange={(e) => setMutation((m) => ({ ...m, mandataire_nom: e.target.value }))} />
                <Input label="Email du mandataire" type="email" value={mutation.mandataire_email} onChange={(e) => setMutation((m) => ({ ...m, mandataire_email: e.target.value }))} />
                <Input label="Téléphone du mandataire" value={mutation.mandataire_telephone} onChange={(e) => setMutation((m) => ({ ...m, mandataire_telephone: e.target.value }))} />
              </div>
            </div>
          </div>
        )}
      </Modal>

      {confirmModal}
    </div>
  )
}
