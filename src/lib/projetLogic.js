// Constantes pour l'entité Projet.
//
// Un projet exécute une ou plusieurs résolutions d'AG adoptées. Il ne porte NI
// budget NI statut en propre : les deux se dérivent (cf. computeProjectBudgets).
// Les décisions rattachées engagent sur son budget et peuvent changer son statut.

// Statut : jamais saisi, toujours dérivé.
//   date d'ouverture à venir                    → en_preparation
//   ouvert, aucun engagement                    → ouvert
//   de l'argent engagé                          → en_cours
//   dernière décision enregistrée 'suspendre'   → suspendu
//   dernière décision enregistrée 'terminer'    → termine
//
// `en_preparation` (ajouté le 2026-08-25) corrige un vrai faux : un projet dont
// la `date_ouverture` est dans le futur — typiquement calé après une AG — était
// annoncé « Ouvert » dès sa création. Il ne l'est pas : il est préparé.
//
// Même patron que les AG, où « AG a eu lieu » se DÉRIVE de la date passée sans
// jamais être stocké (`effectiveAGStatut`, migration 023). Rien à saisir, donc
// rien à tenir à jour : le 16 septembre au matin, le projet devient ouvert tout
// seul, sans que personne ait à y penser.
export const PROJET_STATUT_VALUES = ['en_preparation', 'ouvert', 'en_cours', 'termine', 'suspendu']

export const PROJET_STATUT_LABELS = {
  en_preparation: 'En préparation',
  ouvert: 'Ouvert',
  en_cours: 'En cours',
  termine: 'Terminé',
  suspendu: 'Suspendu',
}

export const PROJET_STATUT_TONES = {
  en_preparation: 'gray',
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

// Les mêmes actions, nommées et non conjuguées — pour le registre PDF, qui
// constate un fait plutôt que de proposer une action. Table distincte et non
// dérivée : dans l'UI l'infinitif est juste (c'est un choix à faire), dans le
// registre il ne l'est pas (c'est une chose faite). Noter « Clôture » là où
// l'UI dit « Terminer » : c'est le mot de Pascal pour le registre.
export const PROJET_ACTION_NOMS = {
  suspendre: 'Suspension',
  reprendre: 'Reprise',
  terminer: 'Clôture',
}

// Statut résultant d'une action, une fois la décision enregistrée et adoptée.
// 'reprendre' ne pose aucun statut : il annule la suspension / la clôture et rend
// la main au statut naturel (ouvert ou en_cours selon les engagements).
export const PROJET_ACTION_STATUT = {
  suspendre: 'suspendu',
  terminer: 'termine',
  reprendre: null,
}
