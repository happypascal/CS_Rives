// ============================================================================
// OÙ EN EST LE TITRE DE PROPRIÉTÉ (migration 071)
//
// Résolution n° 15 de l'AG 2026 : chaque coloti adresse son titre à Me Garnier.
// Le registre suivait cela par une seule date — `acte_transmis_le`, celle que
// le notaire communique — donc par deux états, dont le second était un
// SILENCE.
//
// ⚠ ET CE SILENCE RECOUVRAIT DEUX SITUATIONS OPPOSÉES. Pascal, 1er novembre
// 2026 : « La liste de Me Garnier est fausse. Il y a des colotis qui m'ont
// écrit pour me dire qu'ils l'avaient envoyé. » Un coloti qui n'a rien fait et
// un coloti dont l'envoi n'apparaît pas à l'étude ne se traitent pas pareil :
// relancer le second, c'est lui redemander ce qu'il a déjà fait, devant une
// recherche facturée 100 € au propriétaire.
//
// ⚠ ET LA DATE SEULE EN MASQUAIT UNE QUATRIÈME. Un titre INCOMPLET — reçu,
// mais auquel il manque une pièce — portait une date de réception, donc
// comptait comme abouti : le registre annonçait un dossier clos alors que
// l'étude attend encore l'acquisition d'origine. « il faut ajouter le statut
// incomplet » (Pascal, même jour).
//
// ⚠ « À VÉRIFIER » N'EST PAS UN DOUTE SUR LA PAROLE DU COLOTI. C'est le
// constat d'une CONTRADICTION entre deux sources : ce qu'il déclare et ce que
// l'état du notaire montre. Le registre constate, il n'arbitre pas — même
// doctrine que les divergences de mandat (051) ou que les contradictions
// signalées dans les archives de PV.
//
// ⚠ STOCKÉ, PAS DÉRIVÉ — à l'inverse du statut d'un projet, du tantième ou de
// `est_societe`. Il n'y a rien d'où le déduire : ni « à vérifier » ni
// « incomplet » ne se lisent dans une autre colonne, seul le conseil peut les
// poser au vu d'un courriel ou de l'état annoté de l'étude.
// ============================================================================

export const TITRE_NON_ENVOYE = 'non_envoye'
export const TITRE_A_VERIFIER = 'a_verifier'
export const TITRE_INCOMPLET = 'incomplet'
export const TITRE_RECU = 'recu'

// ⚠ L'ORDRE EST CELUI DE LA PROGRESSION DU DOSSIER, pas l'alphabétique : c'est
// lui que rend le menu de la fiche, et un classement qui va du plus loin au
// plus près de l'aboutissement se parcourt sans réfléchir.
export const TITRE_STATUTS = [TITRE_NON_ENVOYE, TITRE_A_VERIFIER, TITRE_INCOMPLET, TITRE_RECU]

export const TITRE_LABELS = {
  [TITRE_NON_ENVOYE]: 'Pas envoyé',
  [TITRE_A_VERIFIER]: 'À vérifier',
  [TITRE_INCOMPLET]: 'Reçu mais incomplet',
  [TITRE_RECU]: 'Reçu par le notaire',
}

// Libellés courts, pour les colonnes et les badges d'une liste de cinquante
// lignes. ⚠ « Reçu par le notaire » y tiendrait mal, et c'est le seul endroit
// où l'abréger est sans danger : la colonne elle-même dit de quoi il s'agit.
export const TITRE_LABELS_COURTS = {
  [TITRE_NON_ENVOYE]: 'Pas envoyé',
  [TITRE_A_VERIFIER]: 'À vérifier',
  [TITRE_INCOMPLET]: 'Incomplet',
  [TITRE_RECU]: 'Reçu',
}

export const TITRE_TONS = {
  [TITRE_NON_ENVOYE]: 'red',
  [TITRE_A_VERIFIER]: 'amber',
  [TITRE_INCOMPLET]: 'amber',
  [TITRE_RECU]: 'green',
}

// Ce que chaque état veut dire, écrit pour être lu sur la fiche. ⚠ C'est ici
// que se joue la distinction : un lecteur qui prend « à vérifier » pour « on
// ne le croit pas » ne s'en servira pas.
export const TITRE_AIDES = {
  [TITRE_NON_ENVOYE]: 'Rien ne nous est parvenu, et le coloti n’a pas signalé d’envoi.',
  [TITRE_A_VERIFIER]: 'Le coloti déclare avoir adressé son titre, et l’état du notaire ne le montre pas. C’est une contradiction à lever auprès de l’étude — pas un doute sur sa parole.',
  [TITRE_INCOMPLET]: 'Le notaire a reçu une pièce, mais elle ne suffit pas — il manque par exemple l’acquisition d’origine. Le dossier n’est pas clos : notez ce qui manque dans l’observation.',
  [TITRE_RECU]: 'Me Garnier a confirmé la réception d’un titre complet.',
}

/**
 * Le notaire a-t-il reçu QUELQUE CHOSE ?
 *
 * ⚠ À NE PAS CONFONDRE AVEC « le dossier est clos ». Un titre incomplet est
 * bien arrivé à l'étude — c'est ce que la date de réception constate — mais il
 * manque une pièce. C'est cette fonction qui dit quand une date de réception a
 * un sens ; `titreEnAttente` dit ce qu'il reste à obtenir.
 */
export function titreRecuParLeNotaire(proprietaire) {
  const s = statutDuTitre(proprietaire)
  return s === TITRE_RECU || s === TITRE_INCOMPLET
}

/**
 * Le statut d'une période, avec la retombée qui va bien.
 *
 * ⚠ RETOMBÉE SUR LA DATE DU NOTAIRE. Les périodes antérieures à la 071 n'ont
 * pas de statut explicite en mémoire tant que la base n'a pas été relue, et le
 * mode démo peut en fabriquer sans. Lire la colonne seule afficherait « pas
 * envoyé » sur une période dont le notaire a pourtant confirmé la réception.
 */
export function statutDuTitre(proprietaire) {
  if (!proprietaire) return null
  const brut = proprietaire.acte_statut
  if (TITRE_STATUTS.includes(brut)) return brut
  return proprietaire.acte_transmis_le ? TITRE_RECU : TITRE_NON_ENVOYE
}

/**
 * Les périodes qui n'ont pas abouti : ce qu'il reste à obtenir.
 * ⚠ UN TITRE INCOMPLET EN FAIT PARTIE. Le compter comme reçu est exactement
 * l'erreur que la 071 corrige.
 */
export function titreEnAttente(proprietaire) {
  return statutDuTitre(proprietaire) !== TITRE_RECU
}

/**
 * Le décompte des quatre états sur un ensemble de lots.
 *
 * ⚠ LE DÉNOMINATEUR EST LE NOMBRE DE PROPRIÉTAIRES, PAS DE PARCELLES — règle
 * posée en 059 : on ne réclame pas un titre à une parcelle vacante, et l'y
 * compter afficherait un retard qui n'existe pas.
 */
export function compterTitres(lots) {
  const out = {
    total: 0,
    [TITRE_NON_ENVOYE]: 0, [TITRE_A_VERIFIER]: 0, [TITRE_INCOMPLET]: 0, [TITRE_RECU]: 0,
  }
  for (const l of lots || []) {
    const p = l?.proprietaire
    if (!p) continue
    out.total += 1
    out[statutDuTitre(p)] += 1
  }
  return out
}

/**
 * Ce qui empêche d'enregistrer, dit en clair.
 *
 * ⚠ LA MÊME RÈGLE QUE LA CONTRAINTE DE LA 071, et c'est voulu : Postgres
 * refuserait la ligne avec un message que personne ne comprend. Une garde à
 * l'écran ne remplace pas la contrainte — elle la rend lisible.
 */
export function erreurDeTitre({ acte_statut, acte_transmis_le, acte_declare_le, date_acquisition }) {
  // ⚠ « incomplet » SUPPOSE une réception : le notaire a bien reçu quelque
  // chose ce jour-là, c'est même tout ce que ce statut constate. Seuls « pas
  // envoyé » et « à vérifier » excluent une date de réception.
  if (acte_transmis_le && acte_statut !== TITRE_RECU && acte_statut !== TITRE_INCOMPLET) {
    return 'Une date de réception par le notaire suppose le statut « reçu » ou « reçu mais incomplet » : c’est lui qui l’a confirmée.'
  }
  if (acte_declare_le && date_acquisition && acte_declare_le < date_acquisition) {
    return 'La déclaration d’envoi ne peut pas précéder l’acquisition du bien.'
  }
  if (acte_transmis_le && date_acquisition && acte_transmis_le < date_acquisition) {
    return 'La réception par le notaire ne peut pas précéder l’acquisition du bien.'
  }
  return null
}
