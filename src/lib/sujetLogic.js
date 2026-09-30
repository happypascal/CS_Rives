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

// ============================================================================
// CE QUI RESTE À COMPLÉTER
// ============================================================================
// Demande de Pascal (2026-09-21) : « un bouton qui affiche toutes les entrées
// qui doivent être complétées ou datées, avec un commentaire qui dit ce qui
// manque ».
//
// ⚠ POURQUOI CET ÉCRAN EXISTE. La saisie initiale de la mémoire (import du
// 2026-09-21) a introduit treize entrées dont la date était inconnue. Une
// chronologie fausse à un endroit ne se voit PAS en la lisant : elle se range
// simplement au mauvais moment, et paraît normale. Sans une liste qui les
// rassemble, ces treize dates seraient restées.

/**
 * DATE SENTINELLE — « date inconnue ».
 *
 * ⚠ `sujet_entrees.date_evenement` est `not null` et la chronologie se trie
 * dessus : il n'existe aucun moyen d'exprimer « je ne sais pas » autrement que
 * par une valeur convenue. Celle-ci est délibérément ABSURDE — aucun événement
 * du lotissement n'a eu lieu en 1999 — pour qu'elle ne puisse jamais être lue
 * comme une vraie date.
 *
 * ⚠ Elle doit rester IDENTIQUE à celle de `scripts/data/memoire_asl_*.mjs`.
 * Modifier l'une oblige à modifier l'autre.
 */
export const DATE_INCONNUE = '1999-09-09'

export const estDateInconnue = (d) => d === DATE_INCONNUE

/**
 * Tout ce qui, dans la mémoire, attend encore quelque chose.
 *
 * Renvoie une liste plate de `{ sujetId, sujetTitre, entreeId, quoi, manque }`,
 * du plus gênant au moins gênant : une date fausse abîme la chronologie, une
 * synthèse absente ne fait que manquer.
 *
 * ⚠ Ne signale QUE ce qu'on peut nommer. Un sujet sans pièce jointe n'est pas
 * incomplet — beaucoup de dossiers n'en ont pas — et l'ajouter ici noierait les
 * vrais manques sous du bruit, comme les fausses alertes « injoignable » de
 * l'export l'ont montré.
 */
export function elementsACompleter(sujets = [], entrees = []) {
  const parSujet = Object.fromEntries(sujets.map((s) => [s.id, s]))
  const out = []

  for (const e of entrees) {
    if (!estDateInconnue(e.date_evenement)) continue
    out.push({
      cle: `e-${e.id}`,
      sujetId: e.sujet_id,
      sujetTitre: parSujet[e.sujet_id]?.titre || 'Sujet inconnu',
      entreeId: e.id,
      quoi: e.titre || '(entrée sans titre)',
      manque: 'Date inconnue — la chronologie est fausse à cet endroit',
      gravite: 0,
    })
  }

  for (const s of sujets) {
    if (!s.categorie) out.push({ cle: `c-${s.id}`, sujetId: s.id, sujetTitre: s.titre, quoi: 'Le sujet', manque: 'Catégorie à choisir', gravite: 1 })
    if (!s.resume) out.push({ cle: `r-${s.id}`, sujetId: s.id, sujetTitre: s.titre, quoi: 'Le sujet', manque: 'Résumé à écrire — c’est lui qu’on lit dans la liste', gravite: 2 })
    if (!s.contenu) out.push({ cle: `s-${s.id}`, sujetId: s.id, sujetTitre: s.titre, quoi: 'Le sujet', manque: 'Synthèse à rédiger — « où en est-on ? »', gravite: 2 })
    // Un sujet sans aucune entrée n'a pas de mémoire : c'est un titre, pas un fil.
    const n = typeof s.entrees === 'number' ? s.entrees : entrees.filter((e) => e.sujet_id === s.id).length
    if (n === 0) out.push({ cle: `v-${s.id}`, sujetId: s.id, sujetTitre: s.titre, quoi: 'Le sujet', manque: 'Chronologie vide — aucun fait daté', gravite: 3 })
  }

  return out.sort((a, b) => a.gravite - b.gravite || a.sujetTitre.localeCompare(b.sujetTitre, 'fr'))
}

// ============================================================================
// LA CHRONOLOGIE APRÈS LA RÉVISION DU 2026-09-30 (migration 065)
//
// ⚠ Pascal : les entrées venues des archives étaient éclatées en
// sous-résolutions — six lignes « Portails » pour la seule résolution 10 de
// l'AG 2023, aux titres illisibles. Lues à plat, elles disent six fois la même
// chose et cachent le fil.
//
// ⚠ RIEN N'EST SUPPRIMÉ, ET C'EST TOUT L'OBJET. Une entrée regroupée pointe vers
// sa consolidée (`regroupee_sous`) et cesse de s'afficher À PLAT ; elle reste
// lisible, repliée dessous. Une entrée détachée garde son `sujet_id` et porte
// une date et un motif — une entrée sans sujet n'apparaîtrait nulle part, donc
// serait perdue en pratique tout en existant en base.
// ============================================================================

/** L'entrée est-elle visible dans la chronologie du sujet ? */
export function entreeVisible(e) {
  return !e?.regroupee_sous && !e?.detachee_le
}

/**
 * La chronologie prête à afficher : les entrées visibles, chacune portant le
 * `detail` des entrées qu'elle regroupe (triées comme les autres).
 */
export function chronologie(entrees, trier) {
  const toutes = entrees || []
  const parConsolidee = new Map()
  for (const e of toutes) {
    if (!e.regroupee_sous) continue
    parConsolidee.set(e.regroupee_sous, [...(parConsolidee.get(e.regroupee_sous) || []), e])
  }
  return trier(toutes.filter(entreeVisible))
    .map((e) => ({ ...e, detail: trier(parConsolidee.get(e.id) || []) }))
}

/** Les entrées retirées de la chronologie, avec leur motif. */
export const entreesDetachees = (entrees) => (entrees || []).filter((e) => e.detachee_le)

// ⚠ MÊME RÈGLE QUE DANS LES ARCHIVES (`tonDecisionResume`), et pour la même
// raison : la couleur est une affirmation. « Déclarée adoptée » n'est pas verte,
// « Décision sans vote formel » est bleue parce qu'une décision prise sans vote
// reste une décision. Dupliquer la règle serait risquer qu'un même résultat se
// peigne différemment selon l'écran — d'où le ré-export depuis `pvArchiveLogic`.
export { tonDecisionResume as tonResultatEntree } from './pvArchiveLogic.js'
