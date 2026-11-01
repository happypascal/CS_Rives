// ============================================================================
// L'ÉTAT DES COLOTIS POUR LE NOTAIRE — ce que chaque ligne doit dire
//
// Colonnes demandées par Pascal le 1er novembre 2026 : parcelle, superficie,
// nombre de lots, numéro d'origine, zone, forme de détention, titulaires (ou
// dirigeant avec sa fonction), statut du titre.
//
// ⚠ PLUS D'ADRESSES ÉLECTRONIQUES. L'export du 26 septembre en portait, par
// arbitrage exprès — « c'est un notaire, pas un quidam ». Elles ne sont plus
// demandées : on ne les met donc pas. Un registre de données personnelles
// n'exporte que ce qu'on lui demande, et une colonne qu'on garde « au cas où »
// est une divulgation qui n'a plus de raison. Les adresses de communication et
// les téléphones restaient déjà exclus.
//
// ⚠ UNE SEULE RECETTE POUR LE PDF ET LE CLASSEUR. Les deux documents partent à
// la même étude ; s'ils divergeaient, c'est le plus bavard qui ferait la fuite.
// ============================================================================

import {
  ROLES_DETENTEURS, ROLE_INDIVISAIRE, ROLE_CO, ROLE_USUFRUITIER, ROLE_NU,
  ROLE_REPRESENTANT, ROLE_MANDATAIRE, ROLE_LABELS, compareTitulaires,
} from './titulaireLogic.js'
import { statutDuTitre, TITRE_LABELS_COURTS, TITRE_A_VERIFIER, TITRE_RECU, TITRE_INCOMPLET } from './titreLogic.js'
import { formatDate } from './format.js'

const actifs = (p) => (p?.titulaires || []).filter((t) => !t.date_fin)
const detenteurs = (p) => actifs(p).filter((t) => ROLES_DETENTEURS.includes(t.role))

/**
 * La FORME DE DÉTENTION, en un mot.
 *
 * ⚠ TROIS VALEURS ONT ÉTÉ DEMANDÉES — « en nom, indivise, société » — ET IL EN
 * FAUT CINQ. Ce n'est pas une coquetterie : écrire « indivise » sur un couple
 * marié serait une QUALIFICATION JURIDIQUE FAUSSE, adressée à un notaire, dans
 * un document qu'il va recouper avec les actes. Détenir à deux n'est pas être
 * en indivision — communauté entre époux, tontine, démembrement — et c'est
 * exactement la distinction que la migration 040 a inscrite dans ce registre :
 * `nom_2` constate le FAIT, `est_indivision` porte la QUALIFICATION, cochée
 * seulement quand on la connaît. Le registre constate, il ne qualifie pas à la
 * place du notaire.
 *
 * D'où « à deux noms » quand deux personnes détiennent sans qu'une indivision
 * soit établie, et « démembrement » quand usufruit et nue-propriété sont
 * séparés — ce dernier changeant qui vote (art. 6), le taire serait pire.
 */
export function formeDeDetention(proprietaire) {
  const liste = detenteurs(proprietaire)
  if (!liste.length) return proprietaire ? 'non renseignée' : ''
  if (liste.some((t) => t.est_personne_morale)) return 'société'
  if (liste.some((t) => t.role === ROLE_USUFRUITIER)
    || actifs(proprietaire).some((t) => t.role === ROLE_NU)) return 'démembrement'
  if (liste.some((t) => t.role === ROLE_INDIVISAIRE)) return 'indivise'
  if (liste.some((t) => t.role === ROLE_CO) || liste.length > 1) return 'à deux noms'
  return 'en nom'
}

/**
 * Qui détient, et qui engage — une personne par ligne.
 *
 * ⚠ LA SOCIÉTÉ ET SON DIRIGEANT, PAS L'UN OU L'AUTRE. Le notaire a besoin des
 * deux : la société est propriétaire, le dirigeant est celui qui signe pour
 * elle. N'inscrire que le dirigeant ferait de lui le propriétaire ; n'inscrire
 * que la société laisserait l'étude sans interlocuteur.
 *
 * ⚠ LA QUALITÉ EST ÉCRITE À CÔTÉ DU NOM dès qu'elle n'est pas évidente. Dans
 * un démembrement, savoir lequel est usufruitier et lequel est nu-propriétaire
 * est le seul moyen de lire la ligne — et c'est l'usufruitier qui est membre
 * de l'association (art. 6).
 *
 * ⚠ LE MANDATAIRE N'Y FIGURE PAS. Il n'est ni propriétaire ni organe de la
 * société : il relaie. L'inscrire dans une colonne qui dit qui détient
 * donnerait à lire qu'il a des droits sur le lot.
 */
export function personnesDuLot(proprietaire) {
  const liste = actifs(proprietaire)
    .filter((t) => t.role !== ROLE_MANDATAIRE)
    .sort(compareTitulaires)
  return liste.map((t) => {
    const nom = [t.civilite, t.prenom, t.nom].map((x) => (x || '').trim()).filter(Boolean).join(' ')
    // La fonction telle que le registre officiel l'écrit (042) — « gérant »,
    // « président », « autre ». ⚠ Recopiée, jamais devinée.
    const qualite = t.role === ROLE_REPRESENTANT
      ? (t.fonction || ROLE_LABELS[ROLE_REPRESENTANT]).trim()
      : t.role === ROLE_USUFRUITIER || t.role === ROLE_NU || t.role === ROLE_INDIVISAIRE
        ? ROLE_LABELS[t.role].toLowerCase()
        : ''
    return qualite ? `${nom} (${qualite})` : nom
  })
}

/**
 * Le statut du titre, avec la date qui le précise.
 *
 * ⚠ LA DATE N'EST PAS LA MÊME SELON L'ÉTAT, et c'est tout l'intérêt de ce
 * tableau pour l'étude : « à vérifier » porte la date que le COLOTI déclare —
 * celle que Me Garnier peut recouper dans son courrier — tandis que « reçu »
 * et « incomplet » portent la sienne. Les mélanger rendrait la colonne
 * inutilisable.
 */
export function statutDuTitreTexte(proprietaire) {
  if (!proprietaire) return ''
  const s = statutDuTitre(proprietaire)
  const libelle = TITRE_LABELS_COURTS[s]
  if (s === TITRE_A_VERIFIER && proprietaire.acte_declare_le) {
    return `${libelle} — le coloti déclare l’avoir envoyé le ${formatDate(proprietaire.acte_declare_le)}`
  }
  if ((s === TITRE_RECU || s === TITRE_INCOMPLET) && proprietaire.acte_transmis_le) {
    return `${libelle} le ${formatDate(proprietaire.acte_transmis_le)}`
  }
  return libelle
}

// ⚠ Le NOMBRE DE LOTS n'est pas le nombre de lignes : deux parcelles pèsent
// 1,81 et 1,19 lot, soit 51 lots pour 50 parcelles (038). La colonne existe
// précisément pour que ce total soit juste.
const nombre = (v, min = 2) => (v == null || v === ''
  ? ''
  : new Intl.NumberFormat('fr-FR', { minimumFractionDigits: min, maximumFractionDigits: 2 }).format(v))

export const ETAT_COLOTIS_ENTETES = [
  'Parcelle', 'Superficie (m²)', 'Nombre de lots', 'N° d’origine', 'Zone',
  'Forme de détention', 'Titulaires et dirigeants', 'Titre de propriété',
]

/** Largeurs en caractères — la colonne des personnes est la longue. */
export const ETAT_COLOTIS_LARGEURS = [13, 14, 13, 11, 7, 18, 40, 34]

/**
 * Une ligne par parcelle, dans l'ordre reçu.
 *
 * ⚠ LES PARCELLES VACANTES Y FIGURENT, dites comme telles. Une ligne absente
 * se lirait « rien à réclamer ici », alors qu'elle signifie « nous ne savons
 * pas à qui la réclamer » — et c'est justement ce que le notaire doit savoir.
 */
export function etatColotisLignes(lots) {
  const corps = (lots || []).map((l) => {
    const p = l.proprietaire
    const personnes = personnesDuLot(p)
    return [
      l.numero || '',
      nombre(l.superficie),
      // ⚠ Le nombre de lots s'écrit « 1 » et non « 1,00 » : deux décimales sur
      // quarante-huit lignes qui valent 1 noieraient les deux seules qui ne
      // valent pas 1 — 1,81 et 1,19, la parcelle partagée à 81/19.
      nombre(l.nombre_lots, 0),
      l.numero_origine || '',
      l.zone || '',
      p ? formeDeDetention(p) : '',
      // ⚠ Une personne par ligne DANS LA CELLULE. Le classeur a un style
      // `wrapText` pour cela ; sans lui les noms seraient collés bout à bout.
      personnes.length ? personnes.join('\n') : (p ? p.nom || '' : 'propriétaire inconnu'),
      p ? statutDuTitreTexte(p) : '',
    ]
  })
  return [ETAT_COLOTIS_ENTETES, ...corps]
}
