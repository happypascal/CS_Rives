// Domain constants for AG (Assemblée Générale) résolutions.
// Révisé 2026-07-14 : les votes AG sont au prorata des superficies et le détail
// des voix reste dans le PV. L'app ne stocke que le RÉSULTAT (majorité requise
// + adoptée/rejetée) et le budget alloué. Pas de comptage de voix ici.

import { todayISO } from './format'

// Cycle de vie d'une AG (migration 023). Stockés : preparation / convoquee /
// cloturee / annulee. « AG a eu lieu » (tenue) est DÉRIVÉ de la date passée —
// jamais stocké. Statuts EDITABLES dans le formulaire : preparation, convoquee,
// annulee (la clôture est une action dédiée sur la fiche).
export const AG_STATUT_EDITABLES = ['preparation', 'convoquee', 'annulee']
export const AG_STATUT_LABELS = {
  preparation: 'En préparation',
  convoquee: 'Convocations envoyées',
  tenue: 'AG a eu lieu',
  cloturee: 'Clôturée',
  annulee: 'Annulée',
}
export const AG_STATUT_TONES = {
  preparation: 'gray',
  convoquee: 'blue',
  tenue: 'amber',
  cloturee: 'green',
  annulee: 'red',
}

// Statut AFFICHÉ : dérive « tenue » (AG a eu lieu) de la date passée. Une AG
// clôturée ou annulée garde son statut ; sinon, si la date est aujourd'hui ou
// passée, elle « a eu lieu » ; sinon on affiche le statut stocké (prep/convoquee).
export function effectiveAGStatut(ag) {
  if (ag.statut === 'cloturee' || ag.statut === 'annulee') return ag.statut
  if (ag.date_ag && ag.date_ag <= todayISO()) return 'tenue'
  return ag.statut
}

// L'AG a eu lieu (date passée) et n'est ni clôturée ni annulée : c'est le seul
// moment où l'on saisit les données a posteriori (heure de fin, quorum, m²) et
// où l'on peut clôturer.
export function agAEuLieu(ag) {
  return ag.statut !== 'cloturee' && ag.statut !== 'annulee' && Boolean(ag.date_ag) && ag.date_ag <= todayISO()
}

// Résultat de quorum de la séance, saisi a posteriori. Le vote est au prorata des
// superficies : on stocke le total des m² présents/représentés, le détail au PV.
export const AG_QUORUM_VALUES = ['quorum_atteint', 'sans_quorum_accepte', 'sans_quorum_rejete']
export const AG_QUORUM_LABELS = {
  quorum_atteint: 'Quorum atteint',
  sans_quorum_accepte: 'Vote sans quorum accepté',
  sans_quorum_rejete: 'Vote sans quorum rejeté',
}
export const AG_QUORUM_TONES = {
  quorum_atteint: 'green',
  sans_quorum_accepte: 'amber',
  sans_quorum_rejete: 'red',
}

export const MAJORITE_VALUES = ['simple', 'absolue', 'double_qualifiee', 'unanimite']

export const MAJORITE_LABELS = {
  simple: 'Majorité simple',
  absolue: 'Majorité absolue',
  double_qualifiee: 'Double majorité qualifiée',
  unanimite: 'Unanimité',
}

// Cycle de vie d'une résolution : inscrite à l'ordre du jour d'une AG à venir
// (`a_voter`), puis résultat du vote une fois l'AG tenue.
// `a_voter` est l'état de DÉPART : quand on planifie une AG, rien n'est encore voté.
// Conséquence portée par computeAGBudgets : seule une résolution ADOPTÉE alloue un
// budget. Une résolution à voter, rejetée ou retirée n'alloue rien et ne peut donc
// ni recevoir d'engagement, ni ouvrir de projet.
export const RESOLUTION_STATUT_VALUES = ['a_voter', 'adoptee', 'rejetee', 'sans_vote', 'retiree']

export const RESOLUTION_STATUT_LABELS = {
  a_voter: 'À voter',
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
  // Présentée mais non soumise au vote (reportée, consensus sans scrutin…).
  // N'alloue aucun budget, comme rejetée/retirée.
  sans_vote: 'Sans vote',
  retiree: 'Retirée',
}

export function nextResolutionNumero(resolutions) {
  let max = 0
  for (const r of resolutions) if (r.numero > max) max = r.numero
  return max + 1
}
