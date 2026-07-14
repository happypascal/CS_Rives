// Constantes pour l'entité Projet.
// Un projet est TOUJOURS issu d'une résolution AG et hérite de son budget
// (modifiable). Les décisions rattachées engagent sur le budget du projet.

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
