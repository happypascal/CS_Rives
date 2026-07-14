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

export const RESOLUTION_STATUT_LABELS = {
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
  retiree: 'Retirée',
}

export function nextResolutionNumero(resolutions) {
  let max = 0
  for (const r of resolutions) if (r.numero > max) max = r.numero
  return max + 1
}
