// Domain constants for AG (Assemblée Générale) résolutions.
// Révisé 2026-07-14 : les votes AG sont au prorata des superficies et le détail
// des voix reste dans le PV. L'app ne stocke que le RÉSULTAT (majorité requise
// + adoptée/rejetée) et le budget alloué. Pas de comptage de voix ici.

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
