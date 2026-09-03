// ============================================================================
// LA MÉMOIRE DU LOTISSEMENT — catégories et tri
//
// Un « sujet » n'est ni un projet (qui a un budget, des dates, un chef) ni une
// décision (qui est une délibération) : c'est le fil d'un dossier qui traverse
// les années — le portail, la plage, la zone C, le recouvrement. Il répond à la
// question qu'aucun autre écran ne traite : POURQUOI en est-on là ?
// ============================================================================

// ⚠ Catégories LIBRES en base (aucune contrainte, cf. migration 045) : cette
// liste guide la saisie, elle ne la ferme pas. Une catégorie imprévue ne doit
// jamais exiger une migration — même choix que les pièces jointes d'AG (031).
export const CATEGORIES = [
  'Équipements',
  'Réseaux et voirie',
  'Juridique et statuts',
  'Relations extérieures',
  'Finances',
  'Environnement',
]

export const CATEGORIE_AUTRE = 'Autre'

/** Les catégories réellement utilisées, plus celles proposées. Sans doublon. */
export function categoriesConnues(sujets = []) {
  const utilisees = sujets.map((s) => s.categorie).filter(Boolean)
  return [...new Set([...CATEGORIES, ...utilisees, CATEGORIE_AUTRE])]
}

/**
 * Tri d'affichage : par catégorie, puis par titre.
 *
 * ⚠ Les sujets SANS catégorie passent en dernier et non en premier : une chaîne
 * vide se classe avant tout en tri alphabétique, ce qui mettrait les fiches
 * incomplètes en tête de la mémoire du lotissement.
 */
export function trierSujets(sujets = []) {
  return [...sujets].sort((a, b) => {
    const ca = a.categorie || '￿'
    const cb = b.categorie || '￿'
    if (ca !== cb) return ca.localeCompare(cb, 'fr')
    return (a.titre || '').localeCompare(b.titre || '', 'fr', { numeric: true })
  })
}

/**
 * Chronologie d'un sujet : du plus récent au plus ancien.
 *
 * ⚠ Trié sur `date_evenement` — quand la chose s'est passée — et non sur
 * `created_at`. Une réunion de mars saisie en juin se range en mars, sinon la
 * chronologie raconte l'ordre des saisies au lieu de l'ordre des faits.
 */
export function trierEntrees(entrees = []) {
  return [...entrees].sort((a, b) => {
    const d = (b.date_evenement || '').localeCompare(a.date_evenement || '')
    if (d !== 0) return d
    // Départage stable pour deux faits du même jour : la saisie la plus récente
    // d'abord, faute de mieux — sans cela l'ordre varierait d'un backend à l'autre.
    return (b.created_at || '').localeCompare(a.created_at || '')
  })
}

/** Regroupe pour l'affichage en liste. Renvoie [[categorie, sujets], …]. */
export function grouperParCategorie(sujets = []) {
  const groupes = new Map()
  for (const s of trierSujets(sujets)) {
    const cle = s.categorie || CATEGORIE_AUTRE
    if (!groupes.has(cle)) groupes.set(cle, [])
    groupes.get(cle).push(s)
  }
  return [...groupes.entries()]
}
