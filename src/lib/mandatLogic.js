// Historique des mandats du Conseil Syndical (migration 051).
//
// LE MEMBRE EST STABLE, LE MANDAT EST UNE PÉRIODE — même patron que le registre
// des propriétaires, où le lot est stable et le propriétaire est une période.
// Une réélection ou une désignation au bureau OUVRE une période, elle n'écrase
// pas la précédente.
//
// ⚠ CE MODULE NE DÉCIDE RIEN SUR LE QUORUM. La composition appelée à voter et le
// dénominateur du quorum se lisent toujours sur `membres_cs` (`date_election` /
// `date_fin`), pas ici — cf. `activeMembersAt` dans DecisionDetail et RegistreCS.
// `mandats_cs` RACONTE, `membres_cs` OPÈRE. Brancher le quorum sur l'historique
// changerait une règle de l'art. 15 par effet de bord d'un écran d'affichage.

import { ROLE_LABELS } from './rolesLogic'

// Comment une période de mandat a commencé. L'art. 14 sépare deux actes que le
// vocabulaire courant confond : l'AG ÉLIT les membres du conseil, le président
// DÉSIGNE parmi eux un trésorier et un secrétaire. Ranger une désignation de
// bureau sous « élu par l'AG » prêterait à l'assemblée un acte qu'elle n'a pas
// accompli — dans un registre qui sert à prouver la qualité des délibérants.
export const ORIGINE_LABELS = {
  election: 'Élu par l’AG',
  designation: 'Désigné par le président',
  cooptation: 'Coopté en cours de mandature',
}

// Formes courtes, pour les badges d'un tableau déjà dense.
export const ORIGINE_COURT = {
  election: 'Élection',
  designation: 'Désignation',
  cooptation: 'Cooptation',
}

export const ORIGINE_TONES = {
  election: 'navy',
  designation: 'blue',
  cooptation: 'amber',
}

export const ORIGINE_VALUES = ['election', 'designation', 'cooptation']

// DURÉE VOTÉE par l'assemblée (migration 052). L'AG n'élit pas jusqu'à une date,
// elle élit POUR une durée — et c'est cette durée qui a été délibérée.
// ⚠ « Non précisée » n'est pas une négligence : la durée de bien des mandats
// anciens n'est pas connue, et en inventer une l'affirmerait au registre.
export const DUREE_VALUES = [1, 2, 3]

export function dureeLabel(annees) {
  if (!annees) return 'Durée non précisée'
  return annees === 1 ? '1 an' : `${annees} ans`
}

// ÉCHÉANCE THÉORIQUE — dérivée, jamais stockée, comme le tantième d'un lot ou le
// budget d'un projet. `date_debut` + la durée votée.
//
// ⚠ ELLE NE FAIT PAS SORTIR DU QUORUM. Un membre élu pour un an reste en fonction
// au-delà du terme jusqu'à l'AG qui le renouvelle : c'est le cas ORDINAIRE. Le
// terme atteint n'a donc aucun effet sur `membres_cs` — ni sur `actif`, ni sur
// `membres_cs.date_fin`, donc ni sur `activeMembersAt`. Sinon l'intéressé
// sortirait du dénominateur du quorum en plein vote, sans que personne n'ait rien
// fait, et la délibération deviendrait irrégulière en silence.
export function echeanceISO(mandat) {
  if (!mandat?.duree_annees || !mandat?.date_debut) return null
  const d = new Date(`${mandat.date_debut}T12:00:00`)
  d.setFullYear(d.getFullYear() + Number(mandat.duree_annees))
  return d.toISOString().slice(0, 10)
}

// TERME D'UN MANDAT : la date inscrite, et à défaut celle que la durée votée
// implique.
//
// ⚠ LA RETOMBÉE EST NÉCESSAIRE, pas une commodité. La date de fin n'est calculée
// à la saisie que depuis le 2026-09-12 : les mandats enregistrés avant peuvent
// porter une durée sans date. Sans ce recalcul, un mandat « élu pour 1 an » en
// 2025 n'aurait aucun terme et ne serait jamais signalé échu — l'application
// serait muette précisément sur les lignes les plus anciennes, donc les plus
// susceptibles d'être dépassées.
export function finMandat(mandat) {
  return mandat?.date_fin || echeanceISO(mandat)
}

// Mandat ÉCHU : son terme est passé. Information de GOUVERNANCE — le signal qu'une
// élection est à inscrire à l'ordre du jour, pas un défaut de l'application.
//
// ⚠ Ne vaut que pour le mandat EN COURS d'un membre ACTIF : sur une période déjà
// remplacée par une autre, une date de fin passée est simplement… le passé.
// L'appelant fait ce tri (cf. `Historique`), la fonction ne dit que « le terme
// est derrière nous ».
export function estEchu(mandat, aujourdhuiISO) {
  const fin = finMandat(mandat)
  return Boolean(fin) && fin < aujourdhuiISO
}

// Tri de l'historique : le plus récent d'abord, comme le registre des décisions.
// `date_debut` décroissante, puis `created_at` décroissante pour départager deux
// mandats commencés le même jour (une AG qui élit puis désigne le bureau dans la
// même séance) — sans ce second critère l'ordre dépendrait du backend.
export function compareMandats(a, b) {
  if (a.date_debut !== b.date_debut) return a.date_debut < b.date_debut ? 1 : -1
  return (b.created_at || '').localeCompare(a.created_at || '')
}

// Le mandat EN COURS d'un membre : le DERNIER COMMENCÉ.
//
// ⚠ CE N'EST PLUS « celui qui n'a pas de date de fin » (2026-09-12). Depuis que la
// date de fin est calculée à partir de la durée votée, tous les mandats en portent
// une — y compris celui qui court encore, dont l'échéance est simplement à venir.
// Chercher une fin nulle ne trouverait plus rien, et l'écran aurait annoncé qu'un
// conseil en exercice n'a aucun mandat.
//
// ⚠ Et c'est aussi ce qui rend correct le cas ORDINAIRE du mandat échu : un membre
// élu pour un an en juin 2025 a une fin inscrite au 19/06/2026, pourtant il siège
// toujours en septembre. Son mandat reste « en cours » — daté, dépassé, signalé
// comme tel — jusqu'à ce qu'une nouvelle élection en ouvre un autre.
//
// Rien ne peut donc produire deux mandats en cours : c'est STRUCTUREL, un maximum
// n'ayant qu'une valeur. L'index partiel de la 051 ne garde plus qu'un rôle
// résiduel (interdire deux périodes sans fin), ce qui est sans dommage.
//
// Qu'un membre SIÈGE encore ne se lit pas ici mais dans `membres_cs.actif`, qui
// reste l'état opérant — cette fonction ne fait que désigner la dernière période.
export function mandatEnCours(mandats = []) {
  if (!mandats.length) return null
  return [...mandats].sort(compareMandats)[0]
}

// Référence de l'AG à afficher. `ag_id` quand l'assemblée est dans l'app,
// `ag_libelle` sinon — et c'est le cœur de la demande : les AG antérieures à
// l'application n'y seront jamais, leur référence n'existe qu'en toutes lettres.
// ⚠ Aucune retombée inventée : sans l'une ni l'autre, on le DIT, on n'affiche pas
// une AG plausible. Même règle que le contact officiel « injoignable ».
export function referenceAG(mandat, ags = []) {
  if (mandat?.ag_id) {
    const ag = ags.find((a) => a.id === mandat.ag_id)
    if (ag) return ag.numero
  }
  return mandat?.ag_libelle || null
}

// ⚠ DÉTECTION DE DIVERGENCE, pas correction automatique.
//
// `membres_cs` (opérant) et le mandat en cours (raconté) peuvent se contredire :
// quelqu'un modifie le rôle en base, ou ferme un mandat sans rouvrir le suivant.
// L'écran le SIGNALE au président et le laisse trancher. Aligner en silence
// serait pire que le désaccord : cela réécrirait soit la sécurité (`role`), soit
// l'histoire (le mandat) sur la foi d'une supposition.
//
// Renvoie la liste des champs en désaccord, vide si tout concorde.
export function divergences(membre, mandats = []) {
  const courant = mandatEnCours(mandats)
  const out = []
  if (!courant) {
    // Un membre actif sans aucun mandat : son historique ne dit pas qu'il siège.
    if (membre.actif) out.push('Aucun mandat n’est enregistré pour ce membre.')
    return out
  }
  // ⚠ AUCUNE ALERTE SUR UN MANDAT ÉCHU. Depuis que la date de fin porte l'échéance
  // votée, un membre actif dont le terme est passé est le cas ORDINAIRE — il siège
  // jusqu'à l'AG qui le renouvelle. Le signaler ici comme une anomalie ferait
  // clignoter tout le conseil dès le lendemain du terme, et l'avertissement, devenu
  // permanent, ne serait plus lu le jour où il portera sur une vraie contradiction.
  // Le badge « Échu » de la chronologie suffit à le dire.
  if (!membre.actif && !courant.date_fin) {
    out.push('Membre marqué « ancien », mais sa dernière période de mandat n’a pas de fin.')
  }
  if (courant.role !== membre.role) {
    out.push(
      `Rôle du mandat en cours (${ROLE_LABELS[courant.role] || courant.role}) ` +
      `différent du rôle actuel (${ROLE_LABELS[membre.role] || membre.role}).`,
    )
  }
  // ⚠ On compare la date d'élection de la fiche à la dernière ÉLECTION, pas au
  // mandat en cours. Un trésorier désigné en cours de mandature a une période qui
  // commence APRÈS son élection, et les deux dates sont justes : il a été élu au
  // conseil le 19 juin, désigné trésorier le 6 septembre. Comparer au mandat en
  // cours signalerait comme une erreur le cas que la table existe pour décrire.
  const derniereElection = [...mandats]
    .filter((m) => m.origine === 'election')
    .sort(compareMandats)[0]
  if (derniereElection && derniereElection.date_debut !== membre.date_election) {
    out.push('Date de la dernière élection différente de la date d’élection de la fiche.')
  }
  return out
}

// Veille du jour donné, en ISO. Sert à clore un mandat la veille de l'ouverture
// du suivant : deux périodes ne doivent pas se chevaucher, sinon la question
// « quel rôle tenait-il ce jour-là ? » aurait deux réponses.
export function veilleISO(dateISO) {
  const d = new Date(`${dateISO}T12:00:00`)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
