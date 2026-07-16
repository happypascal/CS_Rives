// Constantes pour l'entité Projet.
//
// Un projet exécute une ou plusieurs résolutions d'AG adoptées. Il ne porte NI
// budget NI statut en propre : les deux se dérivent (cf. computeProjectBudgets).
// Les décisions rattachées engagent sur son budget et peuvent changer son statut.

// Statut : jamais saisi, toujours dérivé.
//   aucun engagement                            → ouvert
//   de l'argent engagé                          → en_cours
//   dernière décision enregistrée 'suspendre'   → suspendu
//   dernière décision enregistrée 'terminer'    → termine
export const PROJET_STATUT_VALUES = ['ouvert', 'en_cours', 'termine', 'suspendu']

export const PROJET_STATUT_LABELS = {
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  termine: 'Terminé',
  suspendu: 'Suspendu',
}

export const PROJET_STATUT_TONES = {
  ouvert: 'blue',
  en_cours: 'amber',
  termine: 'green',
  suspendu: 'gray',
}

// Effet qu'une décision peut porter sur le statut de SON projet.
// Suspendre ou terminer un projet est une délibération du CS (arbitrage Pascal
// 2026-07-16) : ni le chef de projet ni le président ne le font seuls. L'effet ne
// s'applique qu'une fois la décision ENREGISTRÉE et ADOPTÉE — donc après vote.
export const PROJET_ACTION_VALUES = ['suspendre', 'reprendre', 'terminer']

export const PROJET_ACTION_LABELS = {
  suspendre: 'Suspendre le projet',
  reprendre: 'Reprendre le projet',
  terminer: 'Terminer le projet',
}

// Statut résultant d'une action, une fois la décision enregistrée et adoptée.
// 'reprendre' ne pose aucun statut : il annule la suspension / la clôture et rend
// la main au statut naturel (ouvert ou en_cours selon les engagements).
export const PROJET_ACTION_STATUT = {
  suspendre: 'suspendu',
  terminer: 'termine',
  reprendre: null,
}
