import { useEffect, useRef, useState } from 'react'
import { repo } from '../lib/api'
import { Button, Input, Textarea, Modal, Select } from './ui'
import PiecesJointes from './PiecesJointes'
import { formatDate, todayISO } from '../lib/format'
import {
  SCENARIOS, scenarioDe, titulairesDeMutation, erreurDeMutation, versPayload,
  MUTATION_USUFRUIT, MUTATION_SUCCESSION, ROLE_LABELS, ROLE_NU,
} from '../lib/titulaireLogic'

// ============================================================================
// L'ASSISTANT DE MUTATION (brief du 22 octobre, livré le 31)
//
// ⚠ IL REMPLACE L'ANCIENNE MODALE, et ce n'est pas cosmétique. Celle-ci créait
// une période décrite par les colonnes de 044 — nom_2, dirigeant_*,
// mandataire_*, contacts_officiels — sans aucun titulaire. Comme
// `destinatairesDuLot` bascule PÉRIODE PAR PÉRIODE, le lot vendu serait
// silencieusement retombé sur l'ancien modèle : le registre repartait en
// arrière à la première vente.
//
// ⚠ QUATRE FORMES, QUI NE SE TRAITENT PAS PAREIL. Une donation avec réserve
// d'usufruit n'est pas une vente à deux noms : l'usufruitier prend SEUL la
// qualité de membre et porte la voix, le nu-propriétaire est informé par lui
// (art. 6). L'ancien formulaire, avec ses deux cases indifférenciées, ne savait
// pas l'écrire.
//
// ⚠ LE DÉLAI DE QUINZE JOURS N'EST PAS AFFICHÉ PARTOUT. L'art. 22 ne vise que
// la vente et la donation EN PLEINE PROPRIÉTÉ. Le montrer sur une succession
// inventerait une obligation statutaire.
// ============================================================================

const PERSONNE_VIDE = {
  nom: '', prenom: '', civilite: '', email: '', telephone: '', adresse_postale: '',
  est_personne_morale: false,
  second: false,
}

export default function AssistantMutation({ lot, open, onClose, onFait }) {
  const [scenario, setScenario] = useState(SCENARIOS[0].cle)
  const [date, setDate] = useState(todayISO())
  const [personnes, setPersonnes] = useState([{ ...PERSONNE_VIDE }])
  const [adresseCommune, setAdresseCommune] = useState('')
  const [observations, setObservations] = useState('')
  const [documents, setDocuments] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // ⚠ LE REFUS DOIT SE VOIR, et il ne se voyait pas. Le bandeau d'erreur est en
  // tête de la modale — c'est la convention du dépôt — tandis que le bouton est
  // en bas d'un formulaire qui défile : on cliquait « Enregistrer », le refus
  // s'affichait deux écrans plus haut, et à l'œil il ne se passait rien.
  // Constaté en éprouvant l'écran, pas en le relisant.
  const bandeau = useRef(null)
  useEffect(() => {
    if (error) bandeau.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [error])

  // ⚠ LA SAISIE SE VIDE À CHAQUE OUVERTURE, et ce n'est pas une politesse
  // d'interface. Sans cela, rouvrir l'assistant après une mutation ressortait
  // la précédente INTÉGRALEMENT RENSEIGNÉE — même forme, mêmes personnes, même
  // date — et un clic sur « Enregistrer » inscrivait une seconde fois la vente
  // qui venait d'avoir lieu. Dans un registre où une période chasse l'autre, ce
  // second enregistrement clôt la période qu'on vient d'ouvrir le jour même.
  // Constaté en enchaînant deux mutations sur le même lot.
  useEffect(() => {
    if (!open) return
    setScenario(SCENARIOS[0].cle)
    setDate(todayISO())
    setPersonnes([{ ...PERSONNE_VIDE }])
    setAdresseCommune('')
    setObservations('')
    setDocuments([])
    setError('')
  }, [open])

  const s = scenarioDe(scenario)
  const actuel = lot?.proprietaire

  const majPersonne = (i, patch) =>
    setPersonnes((ps) => ps.map((p, j) => (i === j ? { ...p, ...patch } : p)))

  const enregistrer = async () => {
    const faute = erreurDeMutation(scenario, personnes, date)
    if (faute) { setError(faute); return }
    setBusy(true)
    setError('')
    try {
      // ⚠ `versPayload` N'EST PAS UNE COQUETTERIE : `date_fin` est une colonne
      // `date` et vaut la chaîne vide dans le modèle de saisie. Passée telle
      // quelle, Postgres refuse l'insertion ENTIÈRE (22007) et toute la mutation
      // tombe — là où le mock l'avalerait sans rien dire.
      const titulaires = titulairesDeMutation(scenario, personnes, { date_debut: date })
        .map((t) => versPayload({
          ...t,
          // ⚠ L'adresse commune ne REMPLACE jamais une adresse propre : c'est
          // celle du bien, et on la pose seulement là où la personne n'en a pas
          // donné. L'art. 28 fait élection de domicile en la demeure de chacun.
          adresse_postale: (t.adresse_postale || '').trim() || adresseCommune,
          // ⚠ Marquée « à confirmer » quand on l'a posée pour elle : c'est
          // l'adresse du BIEN, et rien ne dit que la personne y habite.
          adresse_a_verifier: !(t.adresse_postale || '').trim() && Boolean(adresseCommune.trim()),
        }))
      // ⚠ Le NOM de la période est DÉRIVÉ des détenteurs, jamais ressaisi :
      // c'est le libellé qui part dans les listes, les exports et les PDF, et
      // deux champs pour la même chose divergent dès la première correction.
      // Le nu-propriétaire n'y figure pas — il n'est pas membre (art. 6).
      const detenteurs = titulaires.filter((t) => t.role !== ROLE_NU)
      const nom = detenteurs.map((t) => [t.prenom, t.nom].filter(Boolean).join(' ')).join(' / ')
      await repo.enregistrerMutationAvecTitulaires(lot.id, {
        date_mutation: date,
        periode: {
          nom,
          adresse_communication: adresseCommune.trim() || null,
          observations: observations.trim() || null,
          // ⚠ `est_societe` qualifie la PÉRIODE, et il est dérivé des détenteurs
          // au lieu d'être demandé une seconde fois : la question est déjà posée
          // ligne par ligne, et deux réponses pour la même chose se contredisent.
          est_societe: detenteurs.some((t) => t.est_personne_morale),
          // La pièce qui prouve la période (070).
          documents,
          // ⚠ LES COLONNES DE 044 RESTENT VIDES, et c'est tout l'objet de cet
          // écran : `nom_2`, `dirigeant_*`, `mandataire_*` et `contacts_officiels`
          // décrivaient une période à deux personnes et une adresse. Les
          // remplir ici ferait retomber le lot sur l'ancien modèle — le registre
          // repartirait en arrière à la première vente. `contacts_officiels`
          // garde son défaut de base, que `destinatairesDuLot` n'interroge plus
          // dès qu'une période a des titulaires.
        },
        titulaires,
      })
      await onFait?.()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Échec de l’enregistrement.')
    } finally {
      setBusy(false)
    }
  }

  const titulairesPrevus = titulairesDeMutation(scenario, personnes, {})

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Lot ${lot?.numero} — mutation`}
      wide
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Annuler</Button>
          <Button onClick={enregistrer} disabled={busy}>
            {busy ? 'Enregistrement…' : 'Enregistrer la mutation'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div ref={bandeau} className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}

        <p className="text-sm text-slate-600">
          {actuel
            ? <>Le propriétaire actuel, <strong>{actuel.nom}</strong>, passera à l’historique.
                Ses titulaires seront clos à la date de la mutation.</>
            : <>Ce lot n’a pas de propriétaire enregistré : cette mutation en pose un premier.</>}
        </p>

        <div>
          <Select label="Nature de la mutation" value={scenario} onChange={(e) => setScenario(e.target.value)}>
            {SCENARIOS.map((x) => <option key={x.cle} value={x.cle}>{x.titre}</option>)}
          </Select>
          <p className="mt-1 text-xs text-slate-500">{s.aide}</p>
        </div>

        <Input label="Date de la mutation" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />

        {/* ⚠ L'ART. 22 NE VISE QUE LA VENTE ET LA DONATION EN PLEINE PROPRIÉTÉ.
            Le rappel ne s'affiche donc pas sur une succession ni sur un
            démembrement : y annoncer quinze jours inventerait une obligation. */}
        {s.delaiQuinzeJours && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            ⚠ <strong>Quinze jours</strong> : le vendeur doit faire connaître la mutation au syndicat
            au plus tard quinze jours après la signature, « faute de quoi il reste personnellement
            engagé envers l’association » (art. 22).
            {date && <> Échéance : <strong>{formatDate(ajouterJours(date, 15))}</strong>.</>}
          </p>
        )}

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {scenario === MUTATION_USUFRUIT ? 'Usufruitier(s)' : 'Nouveau(x) propriétaire(s)'}
          </p>
          {personnes.filter((p) => !p.second).map((p) => {
            const i = personnes.indexOf(p)
            return <Personne key={i} p={p} onChange={(patch) => majPersonne(i, patch)}
              onRetirer={personnes.filter((x) => !x.second).length > 1 ? () => setPersonnes((ps) => ps.filter((_, j) => j !== i)) : null} />
          })}
          <Button variant="ghost" size="sm" onClick={() => setPersonnes((ps) => [...ps, { ...PERSONNE_VIDE }])}>
            + {scenario === MUTATION_SUCCESSION ? 'Héritier' : 'Personne'}
          </Button>
        </div>

        {scenario === MUTATION_USUFRUIT && (
          <div className="space-y-3 rounded-md border border-navy-100 bg-navy-50/40 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nu-propriétaire(s)</p>
            <p className="text-xs text-slate-500">
              Ils ne votent pas, mais l’usufruitier doit les <strong>informer des décisions</strong>
              {' '}(art. 6) — le registre doit donc savoir où les joindre.
            </p>
            {personnes.filter((p) => p.second).map((p) => {
              const i = personnes.indexOf(p)
              return <Personne key={i} p={p} onChange={(patch) => majPersonne(i, patch)}
                onRetirer={() => setPersonnes((ps) => ps.filter((_, j) => j !== i))} />
            })}
            <Button variant="ghost" size="sm" onClick={() => setPersonnes((ps) => [...ps, { ...PERSONNE_VIDE, second: true }])}>
              + Nu-propriétaire
            </Button>
          </div>
        )}

        <div>
          <Textarea label="Adresse de communication du lot" rows={2} value={adresseCommune}
            onChange={(e) => setAdresseCommune(e.target.value)} placeholder={'12 rte de Messery\n74140 Nernier'} />
          <p className="mt-1 text-xs text-slate-500">
            Posée sur les personnes qui n’ont pas donné la leur, et marquée « à confirmer » chez
            elles — les statuts font élection de domicile en la <strong>demeure respective</strong> de
            chacun (art. 28).
          </p>
        </div>

        {/* La pièce qui prouve la mutation. ⚠ Chemin `proprietaires/<lot>/…` : il
            n'y a pas encore d'id de période au moment de l'envoi, et le préfixe
            est fermé au bureau par les deux policies de la 068. */}
        <PiecesJointes
          scope="proprietaires"
          entityId={lot?.id}
          label={s.piece}
          documents={documents}
          onChange={setDocuments}
        />

        <Textarea label="Observations" rows={2} value={observations} onChange={(e) => setObservations(e.target.value)} />

        {/* Ce qui sera écrit, avant de l'écrire : une mutation ne se reprend pas
            d'un clic, et les rôles décidés par le scénario doivent se voir. */}
        {titulairesPrevus.length > 0 && (
          <div className="rounded-md border border-navy-200 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Seront inscrits</p>
            <ul className="mt-1 space-y-0.5 text-sm text-navy-800">
              {titulairesPrevus.map((t, i) => (
                <li key={i}>
                  {[t.civilite, t.prenom, t.nom].filter(Boolean).join(' ')}
                  {' — '}<span className="text-slate-600">{ROLE_LABELS[t.role]}</span>
                  {t.est_membre_votant && <span className="text-emerald-700"> · porte la voix du lot</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  )
}

function Personne({ p, onChange, onRetirer }) {
  const morale = Boolean(p.est_personne_morale)
  return (
    <div className="rounded-md border border-navy-100 p-3">
      {/* ⚠ UNE SCI ACHÈTE AUSSI, et c'est le cas ordinaire ici — douze des
          cinquante parcelles sont détenues par une société. La case est posée
          sur la PERSONNE et non sur la période : dans une indivision, une
          société peut côtoyer une personne physique. */}
      <label className="mb-2 flex items-center gap-2 text-sm text-navy-800">
        <input type="checkbox" checked={morale}
          onChange={(e) => onChange({ est_personne_morale: e.target.checked, civilite: '', prenom: '' })}
          className="h-4 w-4 rounded border-navy-300" />
        Société (SCI, SARL…)
      </label>
      <div className="grid gap-3 sm:grid-cols-4">
        {/* Une société n'a ni civilité ni prénom : les montrer invite à écrire
            dans un registre légal une qualité que la personne n'a pas. */}
        {!morale && (
          <>
            <Input label="Civilité" value={p.civilite} onChange={(e) => onChange({ civilite: e.target.value })} placeholder="M., Mme" />
            <Input label="Prénom" value={p.prenom} onChange={(e) => onChange({ prenom: e.target.value })} />
          </>
        )}
        <div className={morale ? 'sm:col-span-4' : 'sm:col-span-2'}>
          <Input label={morale ? 'Raison sociale' : 'Nom'} value={p.nom} onChange={(e) => onChange({ nom: e.target.value })} />
        </div>
      </div>
      {morale && (
        <p className="mt-2 text-xs text-slate-500">
          ⚠ Son <strong>dirigeant</strong> s’ajoute sur la fiche une fois la mutation
          enregistrée, comme <em>représentant légal</em> — c’est lui qui engage la société, donc
          qui vote et signe pour elle. À vérifier au registre officiel des entreprises : six des
          douze sociétés du lotissement ne portent pas « SCI » dans leur nom, et trois dirigeants
          que nous tenions du syndic étaient faux.
        </p>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Input label="Adresse électronique" type="email" value={p.email} onChange={(e) => onChange({ email: e.target.value })} />
        <Input label="Téléphone" value={p.telephone} onChange={(e) => onChange({ telephone: e.target.value })} />
      </div>
      <div className="mt-3">
        <Textarea label="Adresse postale (si différente de celle du lot)" rows={2}
          value={p.adresse_postale} onChange={(e) => onChange({ adresse_postale: e.target.value })} />
      </div>
      {onRetirer && (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onRetirer}>Retirer</Button>
        </div>
      )}
    </div>
  )
}

// ⚠ Quinze jours de CALENDRIER, pas ouvrés : l'art. 22 dit « quinze jours »
// sans autre précision, contrairement au délai de vote des décisions qui se
// compte en jours ouvrés (`addBusinessDaysISO`). Les confondre déplacerait une
// échéance statutaire.
function ajouterJours(iso, n) {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}
