// Rôles du bureau du CS (art. 14 des statuts). Le président désigne, parmi les
// membres, un trésorier et un secrétaire ; les autres sont de simples membres.
// Les rôles sont EXCLUSIFS (un par membre) et, pour les trois du bureau, à
// titulaire UNIQUE parmi les membres actifs.

export const ROLE_LABELS = {
  president: 'Président',
  tresorier: 'Trésorier',
  secretaire: 'Secrétaire',
  membre: 'Membre',
}

export const ROLE_TONES = {
  president: 'navy',
  tresorier: 'blue',
  secretaire: 'amber',
  membre: 'gray',
}

// Ordre d'affichage dans les menus déroulants.
export const ROLE_VALUES = ['membre', 'president', 'tresorier', 'secretaire']

// Rôles à titulaire unique parmi les membres actifs. Un seul président, un seul
// trésorier, un seul secrétaire à la fois (art. 14). 'membre' n'en est pas.
export const ROLES_UNIQUES = ['president', 'tresorier', 'secretaire']
