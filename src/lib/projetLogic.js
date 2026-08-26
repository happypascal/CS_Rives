// Constantes pour l'entité Projet.
//
// Un projet exécute une ou plusieurs résolutions d'AG adoptées. Il ne porte NI
// budget NI statut en propre : les deux se dérivent (cf. computeProjectBudgets).
// Les décisions rattachées engagent sur son budget et peuvent changer son statut.

// Statut : JAMAIS saisi, toujours dérivé — aucune colonne, aucune migration.
//
// Cycle, resserré le 2026-08-26 à QUATRE états :
//
//     en_preparation → en_cours → (suspendu ⇄ en_cours) → termine
//
// Dérivation, premier cas gagnant :
//   1. dernière décision enregistrée ET adoptée : 'suspendre' → suspendu,
//      'terminer' → termine, 'reprendre' → rend la main au naturel ;
//   2. `date_ouverture` à venir → en_preparation ;
//   3. sinon → en_cours.
//
// ⚠ `ouvert` A DISPARU, fondu dans `en_cours`. Il distinguait « ouvert mais rien
// d'engagé » de « en cours » ; depuis que `en_preparation` existe (2026-08-25),
// la nuance ne portait plus rien — une fois la date d'ouverture passée, le
// projet est en cours, qu'un devis soit signé ou non. Ne pas le réintroduire
// sans raison neuve.
//
// `en_preparation` se dérive de la seule date, sur le patron de « AG a eu lieu »
// (`effectiveAGStatut`, migration 023) : rien à saisir, rien à tenir à jour, le
// projet bascule seul le jour dit.
export const PROJET_STATUT_VALUES = ['en_preparation', 'en_cours', 'suspendu', 'termine']

export const PROJET_STATUT_LABELS = {
  en_preparation: 'En préparation',
  en_cours: 'En cours',
  suspendu: 'Suspendu',
  termine: 'Terminé',
}

export const PROJET_STATUT_TONES = {
  en_preparation: 'gray',
  en_cours: 'amber',
  suspendu: 'red',
  termine: 'green',
}

// Effet qu'une décision peut porter sur le statut de SON projet.
//
// **Suspendre, reprendre et terminer sont des DÉLIBÉRATIONS du CS** (arbitrage
// Pascal 2026-07-16, reconfirmé le 2026-08-26) : ni le chef de projet, ni son
// adjoint, ni le président ne le font seuls, et il n'existe volontairement
// AUCUN bouton pour ça. L'effet ne s'applique qu'une fois la décision
// ENREGISTRÉE et ADOPTÉE — donc après quorum et vote.
//
// ⚠ Un bouton « suspendre / reprendre » a été envisagé puis écarté le
// 2026-08-26, avant d'être livré. Conséquence à ne pas perdre de vue si l'idée
// revient : un bouton obligerait à STOCKER la suspension, donc à rouvrir la
// porte que la migration 011 avait fermée en supprimant `projets.statut`.
// Aujourd'hui le statut ne coûte aucune colonne.
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
// 'reprendre' ne pose aucun statut : il lève la suspension ou la clôture et rend
// la main au statut naturel (en préparation ou en cours, selon la date).
export const PROJET_ACTION_STATUT = {
  suspendre: 'suspendu',
  terminer: 'termine',
  reprendre: null,
}

// Ordre d'affichage des projets (2026-08-26) : date de début DÉCROISSANTE, puis
// titre. Le chantier le plus récent en tête — c'est celui dont on parle.
//
// Défini ICI et appelé par les DEUX backends : ils ne triaient pas pareil (le
// mock sur `created_at` décroissant, Supabase pas du tout, donc à l'ordre rendu
// par Postgres). L'écart ne se voyait pas en démo — exactement le genre de
// divergence que le mode mock masque. Un comparateur unique le ferme.
//
// Un projet SANS date d'ouverture part en fin de liste : il n'a pas commencé, il
// n'a pas sa place parmi les chantiers datés. `localeCompare` en français pour
// que les accents se rangent correctement.
export function compareProjets(a, b) {
  const da = a.date_ouverture || ''
  const db = b.date_ouverture || ''
  if (da !== db) {
    if (!da) return 1
    if (!db) return -1
    return da < db ? 1 : -1
  }
  return (a.nom || '').localeCompare(b.nom || '', 'fr')
}
