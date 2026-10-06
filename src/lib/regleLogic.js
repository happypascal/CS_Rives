// =============================================================================
// RÈGLES DE GESTION PERMANENTES (migration 066) — libellés, tri, regroupement
//
// Une règle de gestion, c'est ce qu'une assemblée a voté UNE fois et qui
// S'APPLIQUE ENCORE : le constat annuel des haies et sa mise en demeure d'un
// mois, le constat d'huissier avant travaux, les intérêts de retard de plein
// droit. Ce n'est ni une décision du conseil (qui se clôt), ni un sujet de la
// mémoire (un dossier, qui se referme), ni une résolution (le vote d'un jour).
//
// ⚠ CE MODULE NE CALCULE AUCUNE ÉCHÉANCE, et c'est le point à ne pas perdre.
// Il ne dira jamais « la visite des haies est due le 12 mai » : personne ne l'a
// constaté, et un registre légal n'invente pas une date. `periodicite` et
// `delai` sont des LIBELLÉS qu'un oeil lit, pas une récurrence qu'un
// planificateur exécute. La règle est rappelée, elle n'est pas armée.
// =============================================================================

// ---- Statut : stocké, jamais dérivé -----------------------------------------
// ⚠ Une règle cesse de s'appliquer parce qu'une assemblée l'a décidé, pas parce
// qu'une date est passée. Rien ne permet de le déduire : il faut l'inscrire.
export const STATUTS = ['en_vigueur', 'suspendue', 'abrogee']

export const STATUT_LABELS = {
  en_vigueur: 'En vigueur',
  suspendue: 'Suspendue',
  abrogee: 'Abrogée',
}

export const STATUT_TONES = {
  en_vigueur: 'green',
  suspendue: 'amber',
  abrogee: 'gray',
}

export const estEnVigueur = (r) => r?.statut === 'en_vigueur'

// ---- Catégories et périodicités : des SUGGESTIONS, pas une liste fermée ------
// ⚠ Aucune contrainte en base (migration 066, même choix qu'en 031 et 045) :
// une valeur imprévue ne doit pas coûter une migration. Ces listes alimentent
// une saisie assistée, elles ne la bornent pas.
export const CATEGORIES = [
  'Espaces verts et haies',
  'Voirie et circulation',
  'Travaux',
  'Charges et recouvrement',
  'Fonds de travaux',
  'Urbanisme et constructions',
  'Réseaux',
  'Fonctionnement de l’association',
]

export const PERIODICITES = [
  'Annuelle',
  'À chaque mutation',
  'Avant tous travaux',
  'À chaque relance',
  'Permanente',
  'Ponctuelle',
]

/** Les valeurs réellement employées, suggestions comprises, sans doublon. */
export function valeursConnues(regles = [], champ, suggestions = []) {
  const vues = regles.map((r) => (r?.[champ] || '').trim()).filter(Boolean)
  return [...new Set([...suggestions, ...vues])].sort((a, b) => a.localeCompare(b, 'fr'))
}

// ---- Le numéro (migration 067) ----------------------------------------------
/**
 * « R4 », ou rien tant que la règle n'en a pas.
 *
 * ⚠ LE NUMÉRO DIT L'ORDRE D'INSCRIPTION, JAMAIS L'ORDRE D'ADOPTION. Les huit
 * premières ont été numérotées par année de vote croissante, mais une règle
 * ancienne retrouvée demain prendra le numéro SUIVANT : renuméroter rendrait
 * faux tout ce qui a déjà été cité. ⚠ Un numéro ne se réutilise pas davantage —
 * une règle abrogée garde le sien (doctrine de la numérotation des décisions).
 */
export const numeroRegle = (r) => (r?.numero ? `R${r.numero}` : null)

// ---- Tri --------------------------------------------------------------------
/**
 * Les règles EN VIGUEUR d'abord — c'est la question que l'écran doit trancher
 * d'un coup d'oeil — puis **par numéro croissant** : depuis la 067, le registre
 * se lit dans l'ordre de ses numéros, comme tout registre numéroté. Avant, il
 * se lisait de la plus récente à la plus ancienne ; un numéro affiché qui ne
 * suivrait pas l'ordre de la liste donnerait à chercher au lieu de guider.
 * ⚠ Une règle SANS numéro passe en fin de son groupe plutôt qu'en tête : un
 * `null` traité comme zéro la ferait passer avant la n° 1.
 */
export function trierRegles(regles = []) {
  const rang = { en_vigueur: 0, suspendue: 1, abrogee: 2 }
  return [...regles].sort((a, b) => {
    const ra = rang[a.statut] ?? 3
    const rb = rang[b.statut] ?? 3
    if (ra !== rb) return ra - rb
    const na = a.numero ?? Infinity
    const nb = b.numero ?? Infinity
    if (na !== nb) return na - nb
    return (a.titre || '').localeCompare(b.titre || '', 'fr')
  })
}

/** Regroupe par catégorie, les règles sans catégorie en dernier. */
export function grouperParCategorie(regles = []) {
  const SANS = 'Sans catégorie'
  const paquets = new Map()
  for (const r of trierRegles(regles)) {
    const c = (r.categorie || '').trim() || SANS
    paquets.set(c, [...(paquets.get(c) || []), r])
  }
  return [...paquets.entries()]
    .sort(([a], [b]) => (a === SANS ? 1 : b === SANS ? -1 : a.localeCompare(b, 'fr')))
    .map(([categorie, liste]) => ({ categorie, regles: liste }))
}

// ---- La source, rendue lisible ----------------------------------------------
/**
 * « AG 2025 · résolution n° 28 », « AG 1991 », ou rien.
 * ⚠ On n'invente pas « résolution n° ? » quand la référence manque : un numéro
 * absent se lit, un numéro inventé se croit.
 */
export function libelleSource(r) {
  const bouts = []
  if (r?.source_annee) bouts.push(`AG ${r.source_annee}`)
  if (r?.source_reference) bouts.push(r.source_reference)
  return bouts.join(' · ')
}

// ---- Ce qu'il manque pour qu'une règle soit vérifiable ----------------------
/**
 * ⚠ ON NE SIGNALE QUE CE QU'ON PEUT NOMMER — même règle que la mémoire (045) :
 * le bruit tue la liste. Une règle sans catégorie n'est pas incomplète ; une
 * règle dont on ne sait pas d'où elle vient l'est, parce qu'elle devient
 * invérifiable, et une règle abrogée sans référence de fin laisserait croire
 * à une abrogation par erreur.
 */
export function manques(r) {
  const out = []
  if (!r?.source_annee && !r?.source_reference) out.push('aucune source citée')
  if (!r?.qui) out.push('personne n’est désigné pour l’appliquer')
  if (r?.statut !== 'en_vigueur' && !r?.fin_reference) out.push('fin non motivée')
  return out
}

/** Le compte des règles par statut, pour le bandeau de tête. */
export function compter(regles = []) {
  const out = { total: regles.length, en_vigueur: 0, suspendue: 0, abrogee: 0, aCompleter: 0 }
  for (const r of regles) {
    if (out[r.statut] !== undefined) out[r.statut] += 1
    if (manques(r).length) out.aCompleter += 1
  }
  return out
}

/** Recherche plein texte, sur ce qui est affiché. */
export function filtrerParTexte(regles = [], requete = '') {
  const q = requete.trim().toLowerCase()
  if (!q) return regles
  return regles.filter((r) =>
    [numeroRegle(r), r.titre, r.enonce, r.categorie, r.periodicite, r.delai, r.qui, r.source_reference, r.commentaire]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q)),
  )
}
