import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Textarea, Select, Spinner, Badge } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { RgpdGate } from '../components/RgpdGate'
import { formatDate, parseMontant } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
// ⚠ `CONTACTS`, `CONTACT_LABELS`, `destinataires` et `apportDe` ne sont plus
// importés ici : les cases de 044 ont quitté cet écran. Ils servent encore
// ailleurs — `destinatairesDuLot` les emploie comme REPLI pour les périodes
// sans titulaires, et la liste des parcelles les lit. Ne pas les supprimer de
// `proprietaireLogic` au motif que la fiche ne s'en sert plus.
import { CONTACT_PROPRIETAIRE, sourcesCochees, lireTri, trierLots, aDesTitulaires, libelleDeLaPeriode, adresseDeLaPeriode } from '../lib/proprietaireLogic'
import TitulairesLot from '../components/TitulairesLot'
import AssistantMutation from '../components/AssistantMutation'
import PiecesJointes from '../components/PiecesJointes'
import {
  TITRE_ETATS, TITRE_LABELS, TITRE_AIDES, TITRE_TONS, TITRE_NON_ENVOYE,
  TITRE_A_VERIFIER, TITRE_A_VERIFIER_SANS_DATE, TITRE_ENVOI_CONSTATE,
  statutDuTitre, etatDuTitre, erreurDeTitre, titreRecuParLeNotaire,
} from '../lib/titreLogic'

// Les tons de `titreLogic` rendus en classes Tailwind. ⚠ Ici et non dans la
// logique : celle-ci est partagée avec le PDF et le classeur, qui ne
// connaissent pas Tailwind.
const COULEUR_AIDE = {
  green: 'text-slate-500',
  blue: 'text-navy-700',
  amber: 'text-amber-700',
  red: 'text-amber-700',
}

// Champs de la période de propriété.
//
// ⚠ LES COLONNES DE 044 Y SONT ENCORE, ALORS QUE PLUS AUCUN CHAMP DE L'ÉCRAN
// NE LES MONTRE — `nom_2`, `dirigeant_*`, `mandataire_*`, `contacts_officiels`,
// `email`, `telephone`, `est_indivision`. C'est délibéré et c'est ce qui rend
// le retrait du 31 octobre SÛR : le formulaire les charge et les renvoie
// telles quelles, si bien qu'un enregistrement de la fiche ne les efface pas.
// Les retirer d'ici, en revanche, viderait ces colonnes au premier clic sur
// « Enregistrer » — sur cinquante périodes d'un registre légal, en silence.
//
// Ce que l'écran montre encore : le nom (libellé de la période), l'adresse de
// communication, la date d'acquisition, les observations, le suivi du titre
// (059) et la pièce (070). Les PERSONNES sont dans la carte Titulaires du lot.
const CHAMPS_VIDES = {
  nom: '', est_societe: false, dirigeant_nom: '', dirigeant_fonction: '',
  adresse_communication: '', adresse_dirigeant: '', email: '', telephone: '',
  dirigeant_nom_2: '', dirigeant_fonction_2: '', dirigeant_email_2: '', dirigeant_telephone_2: '',
  dirigeant_email: '', dirigeant_telephone: '',
  mandataire_nom: '', mandataire_email: '', mandataire_telephone: '',
  nom_2: '', email_2: '', telephone_2: '', est_indivision: false,
  contacts_officiels: [CONTACT_PROPRIETAIRE],
  date_acquisition: '', observations: '',
  acte_transmis_le: '', acte_observations: '',
  // OÙ EN EST LE TITRE (071). ⚠ Le défaut est `non_envoye` et non une chaîne
  // vide : la colonne est `not null`, et un formulaire qui naîtrait vide
  // enverrait une valeur que la contrainte refuse.
  acte_statut: TITRE_NON_ENVOYE, acte_declare_le: '',
  // La pièce qui prouve la période (migration 070). Elle, se saisit bien ici :
  // l'assistant ne la demande qu'à la mutation, et les 51 périodes déjà au
  // registre n'ont jamais eu d'endroit où la ranger.
  documents: [],
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
  const [lotForm, setLotForm] = useState({ numero: '', adresse_lotissement: '', superficie: '', nombre_lots: '1', numero_syndic: '', observations: '', zone: '', numero_origine: '', origine_source: '' })
  const [busy, setBusy] = useState(false)
  // Une mutation ne se saisit plus ici : c'est `AssistantMutation` qui la mène,
  // du choix de la forme (vente, donation, démembrement, succession) jusqu'aux
  // titulaires de la période neuve. La page n'a plus qu'à l'ouvrir.
  const [mutationOuverte, setMutationOuverte] = useState(false)
  const [confirm, confirmModal] = useConfirm()
  // Les parcelles voisines, pour naviguer sans repasser par la liste. Rangées
  // dans L'ORDRE DU TRI CHOISI DANS LA LISTE (mémorisé par navigateur) : trier
  // par superficie puis passer à « suivante » doit mener à la ligne d'en
  // dessous, pas à la parcelle suivante par numéro.
  const [parcelles, setParcelles] = useState([])
  // Instantané de ce qui a été chargé : c'est lui qui dit si l'on a modifié
  // quelque chose. Comparer au formulaire vide ne marcherait pas — une fiche
  // remplie paraîtrait toujours modifiée.
  const [initial, setInitial] = useState(null)
  // Position de défilement à rétablir après un changement de parcelle. On
  // consulte ce registre en comparant des blocs situés bas dans la page — les
  // adresses, les dirigeants — et repartir du haut à chaque fiche oblige à
  // refaire le chemin.
  const scrollARetablir = useRef(null)
  // La navigation la plus récente, pour que l'écouteur clavier — monté une
  // seule fois — appelle toujours la bonne. Sans ce relais il faudrait remonter
  // tout le calcul des voisines au-dessus des retours anticipés du composant.
  const allerVersRef = useRef(null)

  const peutSaisir = !isMobile

  const reload = useCallback(async () => {
    setError('')
    try {
      const l = await repo.getLot(id)
      setLot(l)
      if (l) {
        // ⚠ Un SEUL objet, réutilisé pour le formulaire ET pour l'instantané :
        // écrits deux fois, ils divergent dès qu'une colonne s'ajoute — et la
        // divergence se lit « fiche modifiée » sur une fiche qu'on vient
        // d'ouvrir. C'est ce qui venait de se produire avec `zone`.
        const champsLot = { numero: l.numero || '', adresse_lotissement: l.adresse_lotissement || '', superficie: l.superficie ?? '', nombre_lots: l.nombre_lots ?? '1', numero_syndic: l.numero_syndic || '', observations: l.observations || '', zone: l.zone || '', numero_origine: l.numero_origine || '', origine_source: l.origine_source || '' }
        setLotForm(champsLot)
        const champs = { ...CHAMPS_VIDES, ...Object.fromEntries(Object.keys(CHAMPS_VIDES).map((k) => [k, l.proprietaire?.[k] ?? CHAMPS_VIDES[k]])) }
        setForm(champs)
        setInitial({ champs, lot: champsLot })
      }
    } catch (e) {
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { reload() }, [reload])

  // FLÈCHES DU CLAVIER. Écouteur global, monté une fois.
  // ⚠ Deux gardes indispensables : on ne détourne PAS les flèches quand le
  // curseur est dans un champ de saisie — elles y déplacent le curseur, et ce
  // formulaire en est plein — ni quand une touche de modification est enfoncée,
  // pour laisser intacts les raccourcis du navigateur (retour arrière, mot à mot).
  useEffect(() => {
    const auClavier = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      const cible = e.target
      const dansUnChamp =
        cible instanceof HTMLElement &&
        (cible.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(cible.tagName))
      if (dansUnChamp) return
      e.preventDefault()
      allerVersRef.current?.(e.key === 'ArrowLeft')
    }
    document.addEventListener('keydown', auClavier)
    return () => document.removeEventListener('keydown', auClavier)
  }, [])

  // ⚠ `useLayoutEffect` et non `useEffect` : le navigateur doit repositionner
  // AVANT de peindre, sinon on voit la page sauter en haut puis redescendre.
  useLayoutEffect(() => {
    if (lot && scrollARetablir.current != null) {
      window.scrollTo(0, scrollARetablir.current)
      scrollARetablir.current = null
    }
  }, [lot])

  useEffect(() => {
    // `.catch(() => [])` : une liste indisponible doit désactiver la navigation,
    // pas vider l'écran — idiome de résilience du projet.
    repo.listLots()
      .then((l) => setParcelles(trierLots(l, lireTri())))
      .catch(() => setParcelles([]))
  }, [])

  // Le spinner ne s'affiche qu'au TOUT PREMIER chargement. Ensuite on garde la
  // fiche précédente à l'écran le temps que la suivante arrive : si la page se
  // vide, sa hauteur tombe à zéro, le navigateur ramène le défilement en haut,
  // et rétablir la position devient impossible.
  if (loading && !lot) return <Spinner />
  // ⚠ L'erreur PLEINE PAGE est réservée à un échec de CHARGEMENT — quand il n'y
  // a rien à montrer. Un échec d'enregistrement laisse la fiche en place et
  // passe par la bannière en ligne plus bas : remplacer le formulaire par une
  // carte d'erreur ferait disparaître la saisie de l'écran au moment précis où
  // l'on demande à l'utilisateur de la corriger.
  if (error && !lot) {
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

  // La période est-elle décrite par ses titulaires ? Si oui, son libellé et son
  // adresse se DÉDUISENT d'eux au lieu d'être ressaisis à côté.
  const reprisParTitulaires = aDesTitulaires(lot?.proprietaire)
  const nomDerive = libelleDeLaPeriode(lot?.proprietaire)
  const adresseDerivee = adresseDeLaPeriode(lot?.proprietaire)
  // ⚠ Passe par `statutDuTitre` et non par `form.acte_statut` brut : une
  // période antérieure à la 071, ou une fiche de démo, n'a pas de statut en
  // mémoire, et le menu afficherait « pas envoyé » sur un titre que le notaire
  // a pourtant confirmé.
  // ⚠ DEUX NOTIONS, ET LES CONFONDRE CASSE L'ENREGISTREMENT. `etatSaisi` est
  // ce que le menu montre — cinq entrées, « à vérifier » dédoublé selon que la
  // date est là. `statutSaisi` est ce qui part en base : quatre valeurs, les
  // seules que la contrainte de la 071 accepte.
  const etatSaisi = etatDuTitre(form)
  const statutSaisi = statutDuTitre(form)

  const rang = parcelles.findIndex((x) => x.id === id)
  const precedente = rang > 0 ? parcelles[rang - 1] : null
  const suivante = rang >= 0 && rang < parcelles.length - 1 ? parcelles[rang + 1] : null

  // Modifié ? Comparaison de l'instantané au formulaire courant. JSON suffit :
  // les valeurs sont des chaînes, des nombres et des booléens, dans le même
  // ordre de clés puisque les deux objets naissent de CHAMPS_VIDES.
  const estModifie = initial
    ? JSON.stringify(initial.champs) !== JSON.stringify(form) || JSON.stringify(initial.lot) !== JSON.stringify(lotForm)
    : false

  // ⚠ On ne quitte JAMAIS une fiche en abandonnant une saisie sans le dire. Si
  // des modifications sont en cours, on propose de les enregistrer ; refuser
  // laisse sur place plutôt que de les perdre — dans un registre légal, une
  // saisie effacée en silence est pire qu'un clic de plus.
  const allerVers = async (cible) => {
    if (!cible) return
    scrollARetablir.current = window.scrollY
    if (estModifie) {
      const enregistrerAvant = await confirm({
        title: 'Modifications non enregistrées',
        message: `Cette fiche a été modifiée. Enregistrer avant de passer à la parcelle ${cible.numero} ?`,
        confirmLabel: 'Enregistrer et continuer',
      })
      if (!enregistrerAvant) return
      // Échec de sauvegarde : on reste, le message d'erreur est déjà à l'écran.
      if (!(await enregistrer())) return
    }
    navigate(`/proprietaires/${cible.id}`)
  }

  allerVersRef.current = (versLaPrecedente) => allerVers(versLaPrecedente ? precedente : suivante)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setLotChamp = (k) => (e) => setLotForm((f) => ({ ...f, [k]: e.target.value }))

  // Renvoie true si l'enregistrement a abouti. La navigation s'en sert : on ne
  // quitte pas une fiche dont la sauvegarde vient d'échouer.
  // Ce que les trois colonnes du titre vaudront réellement. ⚠ Calculé ICI,
  // avant la garde, parce que c'est là-dessus qu'elle doit porter : un champ
  // masqué garde sa valeur dans l'état du formulaire.
  const champsDuTitre = {
    acte_statut: statutSaisi,
    // ⚠ La date de réception part avec le statut qui ne l'admet pas : la
    // contrainte `proprietaires_acte_statut_coherent` (071) refuserait la
    // ligne, et la garder en douce ferait dire au registre que le notaire a
    // confirmé un titre qu'on vient de remettre en attente.
    acte_transmis_le: titreRecuParLeNotaire({ acte_statut: statutSaisi })
      ? (form.acte_transmis_le || null) : null,
    acte_declare_le: form.acte_declare_le || null,
  }

  const enregistrer = async () => {
    if (!form.nom.trim()) {
      setError('Le nom du propriétaire est obligatoire.')
      return false
    }
    // ⚠ LA GARDE PORTE SUR CE QU'ON VA ÉCRIRE, PAS SUR LE FORMULAIRE BRUT.
    // Les champs de date sont MASQUÉS quand le statut ne les admet pas, mais
    // leur valeur reste dans l'état : passer un titre « incomplet » à « à
    // vérifier » laissait donc une date de réception invisible, que la garde
    // refusait — l'enregistrement échouait et le message s'affichait en haut
    // de page, hors de l'écran. On ne voyait rien, et rien ne s'enregistrait.
    // Constaté en éprouvant l'écran, pas en le relisant.
    const fauteDeTitre = erreurDeTitre({ ...form, ...champsDuTitre })
    if (fauteDeTitre) {
      setError(fauteDeTitre)
      return false
    }
    setBusy(true)
    setError('')
    try {
      // Superficie : `parseMontant` tolère la virgule décimale et les espaces —
      // une surface se saisit « 612,50 » en français, pas « 612.5 ».
      const superficie = parseMontant(lotForm.superficie)
      if (lotForm.superficie !== '' && (superficie == null || superficie <= 0)) {
        setBusy(false)
        setError('La superficie doit être un nombre positif (ex : 612,50).')
        return false
      }
      // Le nombre de lots ne peut pas être vide : il entre dans le total du
      // registre, et une valeur absente y ferait un trou silencieux.
      const nombreLots = parseMontant(lotForm.nombre_lots)
      if (nombreLots == null || nombreLots <= 0) {
        setBusy(false)
        setError('Le nombre de lots doit être un nombre positif (1 dans la quasi-totalité des cas).')
        return false
      }
      await repo.updateLot(id, {
        numero: lotForm.numero.trim(),
        adresse_lotissement: lotForm.adresse_lotissement || null,
        superficie,
        nombre_lots: nombreLots,
        numero_syndic: lotForm.numero_syndic || null,
        observations: lotForm.observations || null,
        // ⚠ La zone est normalisée en MAJUSCULE : « e » et « E » désignent la
        // même zone, et deux graphies feraient deux groupes au tri.
        zone: lotForm.zone.trim().toUpperCase() || null,
        numero_origine: lotForm.numero_origine.trim() || null,
        origine_source: lotForm.origine_source.trim() || null,
      })
      // ⚠ `est_societe` EST DÉRIVÉ, PLUS SAISI (31 octobre). La case posait la
      // même question que `est_personne_morale` sur chaque titulaire, et deux
      // champs pour la même chose divergent dès la première correction. La
      // colonne, elle, reste : c'est elle que la liste des parcelles lit pour
      // signaler les sociétés.
      // ⚠ On ne dérive QUE si la période a des titulaires. Sans eux, il n'y a
      // rien d'où déduire, et écraser par `false` effacerait une qualification
      // que quelqu'un a posée — on garde alors ce que la base porte déjà.
      const titulairesActifs = (lot.proprietaire?.titulaires || []).filter((t) => !t.date_fin)
      const estSociete = titulairesActifs.length
        ? titulairesActifs.some((t) => t.est_personne_morale && t.role !== 'nu_proprietaire')
        : Boolean(form.est_societe)
      // ⚠ LE LIBELLÉ ET L'ADRESSE SUIVENT LES TITULAIRES, mais ne les
      // EFFACENT jamais : une dérivation vide garde ce que la base porte.
      // `nom` est `not null` et sert de libellé au registre, à la liste, au PDF
      // du notaire et au classeur ; et seize titulaires repris n'avaient
      // aucune adresse propre au 22 octobre — dériver `null` depuis eux aurait
      // supprimé l'adresse de communication que la reprise avait conservée.
      await repo.saveProprietaire(id, {
        ...form,
        nom: nomDerive || form.nom.trim(),
        adresse_communication: adresseDerivee || form.adresse_communication || null,
        est_societe: estSociete,
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
        contacts_officiels: sourcesCochees(form),
        // (`adresse_communication` est posée plus haut, dérivée des titulaires.
        //  ⚠ Ne pas la reposer ici : en JavaScript c'est la DERNIÈRE clé qui
        //  l'emporte, et la dérivation serait écrasée sans erreur ni avertissement.)
        adresse_dirigeant: form.adresse_dirigeant || null,
        email: form.email || null,
        telephone: form.telephone || null,
        observations: form.observations || null,
        // ⚠ Chaîne vide → null, jamais l'inverse : '' ferait échouer la
        // contrainte de date, et « pas transmis » est bien une absence.
        // ⚠ ET LA DATE DE RÉCEPTION EST EFFACÉE SI LE STATUT N'EST PLUS
        // « reçu » : la contrainte `proprietaires_acte_statut_coherent` (071)
        // refuserait la ligne, et la garder en douce ferait dire au registre
        // que le notaire a confirmé un titre qu'on vient de remettre en
        // attente. Même chose pour la déclaration, qui n'a de sens qu'avant.
        ...champsDuTitre,
        acte_observations: form.acte_observations || null,
      })
      await reload()
      return true
    } catch (e) {
      setError(e.message)
      return false
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
            <Button variant="secondary" onClick={() => allerVers(precedente)} disabled={!precedente} title={precedente ? `Parcelle ${precedente.numero}` : 'Première parcelle'}>
              ← Précédente
            </Button>
            <Button variant="secondary" onClick={() => allerVers(suivante)} disabled={!suivante} title={suivante ? `Parcelle ${suivante.numero}` : 'Dernière parcelle'}>
              Suivante →
            </Button>
            <Link to="/proprietaires"><Button variant="secondary">Retour au registre</Button></Link>
            {peutSaisir && (
              <Button variant="secondary" onClick={() => setMutationOuverte(true)}>
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
              {/* LA NUMÉROTATION D'ORIGINE — celle du cahier des charges de
                  1955, qui désigne les terrains par « lot n° 13, zone A »
                  (migration 069). Le registre ne connaissait que la parcelle
                  cadastrale : aucun document ne reliait les deux, jusqu'à
                  l'état annoté que Me Garnier a remis le 30 octobre 2026.
                  ⚠ Ce n'est PAS une clé. La parcelle reste le seul identifiant
                  vérifiable ; ceci est une information historique, connue pour
                  la moitié des parcelles seulement. */}
              <div className="sm:col-span-2 rounded-md border border-navy-100 bg-navy-50/40 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Numérotation d’origine (cahier des charges de 1955)
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="Zone" value={lotForm.zone} onChange={setLotChamp('zone')} readOnly={!peutSaisir} placeholder="A à E" />
                  <Input label="N° de lot d’origine" value={lotForm.numero_origine} onChange={setLotChamp('numero_origine')} readOnly={!peutSaisir} placeholder="ex : 7" />
                </div>
                <div className="mt-3">
                  <Input label="D’où vient ce numéro" value={lotForm.origine_source} onChange={setLotChamp('origine_source')} readOnly={!peutSaisir} placeholder="ex : mention portée à l’acte de vente" />
                </div>
                {/* ⚠ La source n'est pas une décoration : vingt-cinq de ces
                    numéros viennent d'une annotation manuscrite relevée sur un
                    scan, un seul de l'acte lui-même — et une lecture s'est déjà
                    révélée fausse. C'est ce champ qui dira, dans dix ans,
                    laquelle relire. */}
                <p className="mt-2 text-xs text-slate-500">
                  C’est ainsi que le <strong>cahier des charges de 1955</strong> et les actes
                  désignent les terrains. Le couple <strong>zone + numéro</strong> identifie un lot ;
                  le numéro seul ne suffit pas. ⚠ L’identifiant du registre reste la{' '}
                  <strong>parcelle cadastrale</strong>, en haut de cette fiche.
                </p>
                {!lotForm.numero_origine && (
                  <p className="mt-1 text-xs text-amber-700">
                    Numéro d’origine inconnu — il se lit sur l’acte de propriété, et ne se déduit
                    ni de la parcelle ni de la zone.
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Textarea label="Observations sur le lot" rows={2} value={lotForm.observations} onChange={setLotChamp('observations')} readOnly={!peutSaisir} />
              </div>
            </div>
          </Card>

          {/* LES TITULAIRES (068), avant la fiche du propriétaire : c'est
              désormais eux qui portent les personnes, les adresses et les
              envois. La carte du dessous reste la PÉRIODE de propriété. */}
          {lot.proprietaire && (
            <TitulairesLot
              proprietaire={lot.proprietaire}
              peutSaisir={peutSaisir}
              onChange={reload}
            />
          )}

          <Card>
            <CardHeader
              title="Propriétaire actuel"
              subtitle="Pour changer de propriétaire, utilisez « Enregistrer une mutation » — l’ancien passe alors à l’historique."
            />
            <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
              {/* ⚠ NI LE NOM NI L'ADRESSE NE SE SAISISSENT QUAND LA PÉRIODE A
                  DES TITULAIRES — question de Pascal, 31 octobre : « je ne
                  comprends pas pourquoi il y a ces 2 blocs avec les mêmes noms
                  et adresse ». Il avait raison : la carte juste au-dessus
                  nommait les deux indivisaires avec leur adresse, et celle-ci
                  les redemandait dans deux champs à remplir. Les deux colonnes
                  restent — la liste, le PDF du notaire et le classeur les
                  lisent — mais elles sont CALCULÉES à l'enregistrement, comme
                  le tantième ou le budget d'un projet. Corriger une personne
                  corrige le libellé, au lieu de le laisser diverger.
                  Elles ne reparaissent en saisie que pour une période sans
                  aucun titulaire, où il n'y a rien d'où les tirer. */}
              {reprisParTitulaires ? (
                <div className="sm:col-span-2 rounded-md border border-navy-100 bg-navy-50/40 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Au registre, cette période s’intitule
                  </p>
                  <p className="mt-1 text-sm font-medium text-navy-900">{nomDerive || form.nom}</p>
                  {/* ⚠ ON MONTRE L'ADRESSE QUE LA COLONNE PORTE VRAIMENT, pas
                      seulement celle qu'on sait dériver. Quand l'interlocuteur
                      principal n'a pas d'adresse propre, la dérivation ne
                      remplace rien — la valeur reprise reste en base et part
                      dans la liste des parcelles. Ne montrer que le dérivé
                      laisserait l'écran muet sur une donnée qui existe et qui
                      s'affiche ailleurs. */}
                  {(adresseDerivee || form.adresse_communication) && (
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                      {adresseDerivee || form.adresse_communication}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Composé des <strong>détenteurs</strong> de la carte Titulaires du lot — un
                    dirigeant, un mandataire ou un nu-propriétaire n’y figurent pas, ils ne sont pas
                    propriétaires. C’est ce libellé qui part dans la liste des parcelles, les exports
                    et les documents.
                    {adresseDerivee
                      ? ' L’adresse est celle de l’interlocuteur principal : le représentant désigné, à défaut le membre votant.'
                      : form.adresse_communication
                        ? ' ⚠ L’adresse affichée est celle que portait la fiche avant la reprise : l’interlocuteur principal n’en a pas de propre. Renseignez-la sur sa ligne, plus haut, pour qu’elle suive les corrections.'
                        : ' Aucune adresse : ni l’interlocuteur principal ni la fiche n’en portent.'}
                  </p>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <Input label="Nom du propriétaire (ou raison sociale)" value={form.nom} onChange={set('nom')} readOnly={!peutSaisir} required />
                  <p className="mt-1 text-xs text-slate-500">
                    Ce nom est le <strong>libellé de la période</strong> au registre. Dès qu’un
                    titulaire sera inscrit, il se composera tout seul à partir des détenteurs.
                  </p>
                </div>
              )}
              {/* ⚠ LE FILET DU RETRAIT EST DANS LA CARTE « TITULAIRES DU LOT »,
                  PAS ICI. Une période sans titulaire n'est plus décrite par
                  personne depuis que les quatre blocs de 044 ont quitté cet
                  écran, et il faut le dire — mais à UN seul endroit, celui où
                  l'on agit : le bouton « + Titulaire » y est à côté du message.
                  Le répéter dans cette carte faisait deux bandeaux identiques
                  sur le même écran, ce que le retrait vise précisément à
                  supprimer. */}
              {/* L'adresse de communication ne se saisit plus que sur une
                  période sans titulaire, pour la même raison que le nom.
                  Textarea et non Input : une adresse s'écrit comme sur une
                  enveloppe — voie, puis code postal et ville — et un champ
                  d'une ligne ne peut ni saisir ni restituer ces retours. */}
              {!reprisParTitulaires && (
                <div className="sm:col-span-2">
                  <Textarea
                    label="Adresse de communication officielle"
                    rows={3}
                    value={form.adresse_communication}
                    onChange={set('adresse_communication')}
                    readOnly={!peutSaisir}
                    placeholder={'12 rte de Messery\n74140 Nernier'}
                  />
                </div>
              )}
              <Input label="Propriétaire depuis le" type="date" value={form.date_acquisition} onChange={set('date_acquisition')} readOnly={!peutSaisir} />
              <div className="sm:col-span-2">
                <Textarea label="Observations" rows={2} value={form.observations} onChange={set('observations')} readOnly={!peutSaisir} />
              </div>

              {/* ---------------------------------- TITRE DE PROPRIÉTÉ (059)
                  ⚠ Ce bloc enregistre ce que le NOTAIRE a communiqué : lui seul
                  reçoit les actes. L'application ne constate rien, elle recopie
                  l'état des colotis qu'il retourne annoté. D'où le libellé
                  « reçu par le notaire le » et non « transmis le » : la date qui
                  compte est celle de la réception, pas celle de l'envoi. */}
              <div className="sm:col-span-3 rounded-md border border-navy-100 bg-slate-50 p-4">
                <p className="text-sm font-medium text-navy-800">Titre de propriété</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Résolution n° 15 de l’AG 2026 : chaque coloti adresse son titre au notaire avant le
                  31 octobre. À renseigner d’après l’état que le notaire retourne.
                </p>
                {/* ⚠ LE STATUT D'ABORD, LES DATES ENSUITE. C'est lui qu'on
                    lit, lui qui part au tableau de l'étude, et les deux dates
                    ne font que le préciser — l'une pour « à vérifier »,
                    l'autre pour « reçu ». */}
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <Select
                    label="Où en est ce titre"
                    value={etatSaisi}
                    // ⚠ LE MENU ÉCRIT DEUX CHAMPS, PAS UN. Les deux entrées
                    // « à vérifier » partagent la même valeur en base et ne
                    // se distinguent que par la DATE : choisir « sans date »
                    // doit donc l'effacer, sinon l'écran dirait une chose et
                    // la colonne une autre — et la fiche rebasculerait toute
                    // seule au prochain affichage.
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({
                        ...f,
                        acte_statut: v === TITRE_A_VERIFIER_SANS_DATE ? TITRE_A_VERIFIER : v,
                        acte_declare_le: v === TITRE_A_VERIFIER_SANS_DATE ? '' : f.acte_declare_le,
                      }))
                    }}
                    disabled={!peutSaisir}
                  >
                    {TITRE_ETATS.map((s) => (
                      <option key={s} value={s}>{TITRE_LABELS[s]}</option>
                    ))}
                  </Select>
                  {/* La date de DÉCLARATION n'a de sens que tant que le
                      notaire n'a pas confirmé : après, c'est sa date qui
                      compte. On la garde affichée en « reçu » si elle existe —
                      elle raconte le délai — mais on ne la demande plus. */}
                  {/* La date ne se demande que sur l'entrée « envoi daté » :
                      sur « sans date » elle vient d'être effacée, et la
                      proposer inviterait à contredire le choix du menu. */}
                  {(etatSaisi === TITRE_A_VERIFIER || etatSaisi === TITRE_ENVOI_CONSTATE
                    || form.acte_declare_le) && (
                    <Input
                      // ⚠ LE LIBELLÉ CHANGE AVEC L'ÉTAT, parce que la nature
                      // de la date change : sur un « à vérifier » c'est ce que
                      // le coloti DÉCLARE, sur un envoi constaté c'est ce que
                      // le conseil a VU. Un seul libellé pour les deux ferait
                      // passer une preuve pour une déclaration.
                      label={etatSaisi === TITRE_ENVOI_CONSTATE
                        ? 'Envoyé à l’étude le (nous étions en copie)'
                        : 'Le coloti déclare avoir envoyé le'}
                      type="date"
                      value={form.acte_declare_le}
                      onChange={set('acte_declare_le')}
                      readOnly={!peutSaisir}
                    />
                  )}
                  {/* ⚠ La date de réception vaut pour « reçu » ET pour « reçu
                      mais incomplet » : dans les deux cas le notaire a bien
                      reçu quelque chose ce jour-là. Elle reste interdite aux
                      deux autres états, que la contrainte
                      `proprietaires_acte_statut_coherent` (071) refuse — et un
                      champ qu'on remplit avant d'être refusé par Postgres est
                      un piège. */}
                  {titreRecuParLeNotaire({ acte_statut: statutSaisi }) && (
                    <Input
                      label="Reçu par le notaire le"
                      type="date"
                      value={form.acte_transmis_le}
                      onChange={set('acte_transmis_le')}
                      readOnly={!peutSaisir}
                    />
                  )}
                  <div className="sm:col-span-3">
                    <Input
                      label="Observation du notaire"
                      value={form.acte_observations}
                      onChange={set('acte_observations')}
                      placeholder="Ex. : acte de donation, manque l’acquisition d’origine"
                      readOnly={!peutSaisir}
                    />
                  </div>
                </div>
                {/* ⚠ CE QUE L'ÉTAT VEUT DIRE, ÉCRIT. « À vérifier » se lit
                    spontanément « on ne le croit pas » — or c'est le constat
                    d'une contradiction entre ce que le coloti déclare et ce
                    que l'état du notaire montre. Un statut mal compris ne
                    sera pas employé. */}
                <p className={`mt-2 text-xs ${COULEUR_AIDE[TITRE_TONS[etatSaisi]] || 'text-amber-700'}`}>
                  {TITRE_AIDES[etatSaisi]}
                </p>
              </div>

              {/* ------------------------------ L'ACTE LUI-MÊME (070)
                  ⚠ À NE PAS CONFONDRE AVEC LE BLOC DU DESSUS, et c'est pour
                  cela qu'il est séparé : celui-là enregistre ce que le NOTAIRE
                  a reçu, celui-ci conserve la pièce que le CONSEIL détient. Une
                  date dans l'un ne dit rien de l'autre.
                  L'assistant de mutation la demande à la vente ; ici, c'est le
                  seul endroit où les périodes déjà au registre peuvent recevoir
                  la leur.
                  ⚠ Le chemin porte l'id du LOT (`proprietaires/<lot>/…`), pas
                  celui de la période — convention 046 et 050, et le préfixe est
                  fermé au bureau par les deux policies restrictives de la 068. */}
              <div className="sm:col-span-3">
                <PiecesJointes
                  scope="proprietaires"
                  entityId={lot.id}
                  label="Acte de propriété conservé par le conseil"
                  documents={form.documents}
                  onChange={(docs) => setForm((f) => ({ ...f, documents: docs }))}
                  readOnly={!peutSaisir}
                />
                <p className="mt-1 text-xs text-slate-500">
                  L’acte de vente, de donation ou de notoriété qui ouvre cette période. Il suit le
                  PROPRIÉTAIRE : à la prochaine mutation, il reste attaché à celui qui a acheté.
                </p>
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

      {/* ⚠ L'ASSISTANT A REMPLACÉ LA MODALE DE MUTATION (31 octobre), et ce
          n'était pas un changement de présentation. Celle d'avant remplissait
          `nom_2`, `dirigeant_*`, `mandataire_*` et `contacts_officiels` — les
          colonnes de la 044 — sans créer un seul titulaire. Comme
          `destinatairesDuLot` bascule PÉRIODE PAR PÉRIODE, le lot vendu
          retombait silencieusement sur l'ancien modèle : le registre repartait
          en arrière à la première vente, et seule la fiche du lot le montrait.
          ⚠ Elle ne savait pas non plus écrire un démembrement : deux cases
          indifférenciées pour un usufruitier et un nu-propriétaire, qui n'ont
          pas le même droit (art. 6). */}
      <AssistantMutation
        lot={lot}
        open={mutationOuverte}
        onClose={() => setMutationOuverte(false)}
        onFait={reload}
      />

      {/* Paire flottante, collée au bord gauche du contenu — juste à droite du
          menu. Les flèches de l'en-tête obligeaient à remonter en haut de page
          pour changer de fiche, puis à redescendre pour relire les adresses.
          Celles-ci restent sous la main quel que soit le défilement.
          Masquées en mobile, où la fiche est en consultation seule et où l'espace
          horizontal ne s'y prête pas.
          ⚠ `left` est calé sur la LARGEUR DU MENU (md:w-72 = 18rem) : élargir le
          menu sans décaler cette valeur ferait chevaucher les deux. */}
      {!isMobile && (precedente || suivante) && (
        <div className="fixed top-1/2 z-20 hidden -translate-y-1/2 flex-col gap-2 md:left-[18.75rem] md:flex">
          <button
            onClick={() => allerVers(precedente)}
            disabled={!precedente}
            title={precedente ? `Parcelle ${precedente.numero} (flèche gauche)` : 'Première parcelle'}
            aria-label="Parcelle précédente"
            className="rounded-full border border-navy-200 bg-white/90 px-3 py-2 text-navy-700 shadow-sm backdrop-blur transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            ←
          </button>
          <button
            onClick={() => allerVers(suivante)}
            disabled={!suivante}
            title={suivante ? `Parcelle ${suivante.numero} (flèche droite)` : 'Dernière parcelle'}
            aria-label="Parcelle suivante"
            className="rounded-full border border-navy-200 bg-white/90 px-3 py-2 text-navy-700 shadow-sm backdrop-blur transition-colors hover:bg-navy-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            →
          </button>
        </div>
      )}

      {confirmModal}
    </div>
  )
}
