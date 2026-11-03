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
// ============================================================================
// L'ENVOI CONSTATÉ PAR LE CONSEIL (migration 072)
//
// Pascal, 3 novembre : « il l'a envoyé après mon rappel en me mettant en
// copie ».
//
// ⚠ CE N'EST PAS UN « À VÉRIFIER » DE PLUS. Les deux « à vérifier » reposent
// sur la PAROLE du coloti : il nous dit avoir envoyé. Ici le conseil a VU
// l'envoi partir — le coloti a écrit à l'étude en le mettant en copie.
//
// ⚠ ET LA DIFFÉRENCE CHANGE CE QU'ON PEUT ÉCRIRE À L'ÉTUDE. Sur un « à
// vérifier », nous demandons une recherche. Sur celui-ci, nous affirmons : le
// titre vous a été adressé tel jour, nous en avons copie. Les confondre ferait
// perdre la seule catégorie où le conseil apporte une preuve au lieu d'en
// réclamer une.
// ============================================================================
export const TITRE_ENVOI_CONSTATE = 'envoi_constate'

export const TITRE_INCOMPLET = 'incomplet'
export const TITRE_RECU = 'recu'

// ============================================================================
// LE CINQUIÈME ÉTAT : « À VÉRIFIER, SANS DATE »
//
// Pascal, 3 novembre 2026 : « Les colotis qui m'ont indiqué l'avoir envoyé en
// spécifiant la date et ceux qui ne l'ont pas spécifiée. Il faut différencier
// le statut. »
//
// ⚠ IL EST DÉRIVÉ, ET IL N'Y A PAS DE CINQUIÈME VALEUR EN BASE. La distinction
// est DÉJÀ dans les données : `acte_declare_le` est renseignée ou elle ne l'est
// pas. Ajouter une valeur stockée pour redire la même chose, ce serait deux
// colonnes qui portent la même information — et deux colonnes qui disent la
// même chose finissent par se contredire. C'est exactement ce que la contrainte
// `proprietaires_acte_statut_coherent` de la 071 existe pour empêcher entre le
// statut et la date de réception.
//
// ⚠ ET CE N'EST PAS UNE NUANCE DE PRÉSENTATION. Pour l'étude, les deux
// populations ne se traitent pas pareil : une date se recoupe dans un registre
// de courrier, « il dit l'avoir envoyé » ne se recoupe nulle part. La seconde
// demande d'abord de rappeler le coloti pour obtenir sa date.
//
// ⚠ Il n'entre donc PAS dans `TITRE_STATUTS`, qui énumère ce que la colonne
// accepte. Il vit dans `TITRE_ETATS`, ce que les écrans et le tableau montrent.
// ============================================================================
export const TITRE_A_VERIFIER_SANS_DATE = 'a_verifier_sans_date'

// ⚠ L'ORDRE EST CELUI DE LA PROGRESSION DU DOSSIER, pas l'alphabétique : c'est
// lui que rend le menu de la fiche, et un classement qui va du plus loin au
// plus près de l'aboutissement se parcourt sans réfléchir.
//
// ⚠ `TITRE_STATUTS` = CE QUI SE STOCKE (les quatre valeurs que la contrainte
// de la 071 accepte). `TITRE_ETATS` = CE QUI S'AFFICHE. Les confondre ferait
// envoyer à Postgres une valeur qu'il refuse.
export const TITRE_STATUTS = [
  TITRE_NON_ENVOYE, TITRE_A_VERIFIER, TITRE_ENVOI_CONSTATE, TITRE_INCOMPLET, TITRE_RECU,
]

export const TITRE_ETATS = [
  TITRE_NON_ENVOYE, TITRE_A_VERIFIER_SANS_DATE, TITRE_A_VERIFIER,
  TITRE_ENVOI_CONSTATE, TITRE_INCOMPLET, TITRE_RECU,
]

export const TITRE_LABELS = {
  [TITRE_NON_ENVOYE]: 'Pas envoyé',
  [TITRE_A_VERIFIER_SANS_DATE]: 'À vérifier — sans date',
  [TITRE_A_VERIFIER]: 'À vérifier — envoi daté',
  [TITRE_ENVOI_CONSTATE]: 'Envoyé — le conseil en a copie',
  [TITRE_INCOMPLET]: 'Reçu mais incomplet',
  [TITRE_RECU]: 'Reçu par le notaire',
}

// Libellés courts, pour les colonnes et les badges d'une liste de cinquante
// lignes. ⚠ « Reçu par le notaire » y tiendrait mal, et c'est le seul endroit
// où l'abréger est sans danger : la colonne elle-même dit de quoi il s'agit.
export const TITRE_LABELS_COURTS = {
  [TITRE_NON_ENVOYE]: 'Pas envoyé',
  [TITRE_A_VERIFIER_SANS_DATE]: 'À vérifier (sans date)',
  [TITRE_A_VERIFIER]: 'À vérifier',
  [TITRE_ENVOI_CONSTATE]: 'Envoyé (copie au conseil)',
  [TITRE_INCOMPLET]: 'Incomplet',
  [TITRE_RECU]: 'Reçu',
}

export const TITRE_TONS = {
  [TITRE_NON_ENVOYE]: 'red',
  [TITRE_A_VERIFIER_SANS_DATE]: 'amber',
  [TITRE_A_VERIFIER]: 'amber',
  // ⚠ BLEU et non ambre : ce n'est pas une alerte. Le titre est parti, et le
  // conseil le sait de première main — il ne reste qu'à ce que l'étude
  // l'enregistre. Le peindre comme une contradiction à lever ferait chercher
  // un problème là où il n'y en a pas.
  [TITRE_ENVOI_CONSTATE]: 'blue',
  [TITRE_INCOMPLET]: 'amber',
  [TITRE_RECU]: 'green',
}

// Ce que chaque état veut dire, écrit pour être lu sur la fiche. ⚠ C'est ici
// que se joue la distinction : un lecteur qui prend « à vérifier » pour « on
// ne le croit pas » ne s'en servira pas.
export const TITRE_AIDES = {
  [TITRE_NON_ENVOYE]: 'Rien ne nous est parvenu, et le coloti n’a pas signalé d’envoi.',
  [TITRE_A_VERIFIER_SANS_DATE]: 'Le coloti nous a dit avoir adressé son titre, sans préciser quand. ⚠ L’étude ne peut rien recouper sans date : demandez-la-lui, puis passez la fiche en « envoi daté ».',
  [TITRE_A_VERIFIER]: 'Le coloti déclare avoir adressé son titre à une date qu’il indique, et l’état du notaire ne le montre pas. C’est une contradiction à lever auprès de l’étude — pas un doute sur sa parole.',
  [TITRE_ENVOI_CONSTATE]: 'Le coloti a adressé son titre à l’étude en mettant le conseil en copie : nous en avons la preuve, et nous pouvons l’affirmer à Me Garnier plutôt que de lui demander une recherche.',
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
 * L'ÉTAT AFFICHÉ — cinq valeurs, dont une dérivée.
 *
 * ⚠ À NE PAS CONFONDRE AVEC `statutDuTitre`, qui rend ce que la COLONNE porte
 * et ce qu'on peut lui réécrire. Celui-ci rend ce que l'écran, les filtres et
 * le tableau du notaire doivent montrer : « à vérifier » s'y dédouble selon
 * que le coloti a indiqué une date ou non. Employer celui-ci pour écrire
 * enverrait à Postgres une valeur que la contrainte de la 071 refuse.
 */
export function etatDuTitre(proprietaire) {
  const s = statutDuTitre(proprietaire)
  if (s === TITRE_A_VERIFIER && !proprietaire?.acte_declare_le) return TITRE_A_VERIFIER_SANS_DATE
  return s
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
  // ⚠ LE DÉCOMPTE PORTE SUR LES ÉTATS AFFICHÉS, pas sur les quatre valeurs
  // stockées : sans quoi la tuile et les filtres annonceraient « 3 à
  // vérifier » là où l'écran en montre deux d'un côté et un de l'autre.
  const out = { total: 0 }
  for (const e of TITRE_ETATS) out[e] = 0
  for (const l of lots || []) {
    const p = l?.proprietaire
    if (!p) continue
    out.total += 1
    out[etatDuTitre(p)] += 1
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
