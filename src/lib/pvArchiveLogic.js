// ============================================================================
// ARCHIVES DES PROCÈS-VERBAUX (migration 057) — libellés, lecture des noms de
// fichiers, frise des années et extraits de recherche.
//
// ⚠ CE FICHIER EST PARTAGÉ AVEC LE SCRIPT D'INGESTION
// (`scripts/importer_pv_archives.mjs`), comme `proprietaireLogic.js` l'est avec
// l'import des envois. La convention de nommage doit être lue EXACTEMENT de la
// même façon des deux côtés : si le script déduisait « AGE » là où l'écran lit
// « AGO », personne ne s'en apercevrait avant des années.
//
// ⚠ ON NE DEVINE RIEN. Ce qu'un nom de fichier ne dit pas reste `null` et
// remonte dans le rapport d'import, pour saisie à la main. Inventer un jour ou
// un type pour « faire propre » écrirait une information fausse dans une archive
// que plus personne ne pourra recouper — les témoins de 1957 ne sont plus là.
// ============================================================================

/** Le lotissement est créé en 1955 : rien ne peut lui être antérieur. */
export const PREMIERE_ANNEE = 1955

export const TYPE_LABELS = {
  AGO: 'Assemblée générale ordinaire',
  AGE: 'Assemblée générale extraordinaire',
  reunion_syndicat: 'Réunion du syndicat',
  inconnu: 'Type inconnu',
}

export const TYPE_COURT = {
  AGO: 'AGO',
  AGE: 'AGE',
  reunion_syndicat: 'Réunion',
  inconnu: '?',
}

export const QUALITE_LABELS = {
  bonne: 'Bonne',
  moyenne: 'Moyenne',
  illisible_partiel: 'Partiellement illisible',
}

export const QUALITE_TONES = {
  bonne: 'green',
  moyenne: 'amber',
  illisible_partiel: 'red',
}

// Les types reconnus dans un nom de fichier.
//
// ⚠ PAS DE `\b` AUTOUR DU SIGLE. Le trait bas est un caractère de MOT pour une
// expression régulière : `\bAGO\b` ne trouve rien dans « 2016-09-03_AGO.pdf »,
// c'est-à-dire dans la convention de nommage elle-même. Le défaut a été trouvé
// en éprouvant la fonction sur les noms de la spécification, pas en la relisant.
// On borne donc sur « pas une lettre » de chaque côté, ce qui accepte le trait
// bas, le tiret et l'espace, et refuse toujours « AGOSTINI ».
const TYPES_DANS_LE_NOM = [
  [/(?:^|[^A-Za-z])AGE(?![A-Za-z])/i, 'AGE'],
  [/(?:^|[^A-Za-z])AGO(?![A-Za-z])/i, 'AGO'],
  [/(?:^|[^A-Za-z])(reunion|réunion|syndicat)(?![A-Za-z])/i, 'reunion_syndicat'],
]

/**
 * Ce qu'un nom de fichier permet de déduire — et rien de plus.
 *
 * Conventions attendues (spécification B.2) :
 *   `AAAA-MM-JJ_AGO.pdf`   date complète et type
 *   `AAAA-MM-JJ_AGE.pdf`
 *   `AAAA_*.pdf`           année seule, le reste au petit bonheur
 *
 * @returns {{annee:number|null, date_ag:string|null, type_ag:string|null, intitule:string}}
 */
export function deduireDuNom(nomFichier) {
  const base = String(nomFichier || '').replace(/\.[^.]+$/, '')

  // Date complète d'abord : elle donne aussi l'année, et une année seule ne doit
  // pas court-circuiter une date lisible.
  const complet = base.match(/(?:^|[^\d])(\d{4})[-_.](\d{2})[-_.](\d{2})(?![\d])/)
  let annee = null
  let date_ag = null
  if (complet) {
    const [, a, m, j] = complet
    annee = Number(a)
    // ⚠ Une date qui n'existe pas (31 février) ne doit pas être « corrigée » en
    // silence par `Date` : on ne garde que ce qui se relit identique.
    const iso = `${a}-${m}-${j}`
    const d = new Date(`${iso}T00:00:00Z`)
    date_ag = !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
  } else {
    const seule = base.match(/(?:^|[^\d])(\d{4})(?![\d])/)
    if (seule) annee = Number(seule[1])
  }

  if (annee != null && (annee < PREMIERE_ANNEE || annee > 2100)) {
    // Quatre chiffres qui ne sont pas une année plausible (un numéro de pièce,
    // une référence) : on préfère ne rien savoir que ranger le document en 3024.
    annee = null
    date_ag = null
  }

  let type_ag = null
  for (const [motif, valeur] of TYPES_DANS_LE_NOM) {
    if (motif.test(base)) { type_ag = valeur; break }
  }

  return { annee, date_ag, type_ag, intitule: base.replace(/[_]+/g, ' ').trim() }
}

/**
 * Un intitulé lisible, à partir de ce qu'on a effectivement déduit.
 * ⚠ Il ne dit JAMAIS plus que ce qu'on sait : sans type, « Assemblée » tout
 * court ; sans jour, l'année seule.
 */
export function intituleAuto({ annee, date_ag, type_ag }, secours) {
  const quoi = type_ag && type_ag !== 'inconnu' ? TYPE_LABELS[type_ag] : 'Assemblée'
  if (date_ag) {
    const [a, m, j] = date_ag.split('-')
    return `${quoi} du ${Number(j)}/${m}/${a}`
  }
  if (annee) return `${quoi} de ${annee}`
  return secours || 'Document sans date'
}

/** Les années réellement couvertes, triées. */
export function anneesCouvertes(archives) {
  return [...new Set((archives || []).map((a) => a.annee).filter(Boolean))].sort((x, y) => x - y)
}

/**
 * Les années SANS aucun procès-verbal, entre 1955 et l'année de référence.
 *
 * ⚠ C'est la sortie la plus utile de tout l'écran : elle dit ce qu'il reste à
 * scanner. Une archive qui se contente de montrer ce qu'elle a laisse croire
 * qu'elle est complète.
 */
export function anneesManquantes(archives, jusqua = new Date().getFullYear()) {
  const presentes = new Set(anneesCouvertes(archives))
  const out = []
  for (let a = PREMIERE_ANNEE; a <= jusqua; a++) if (!presentes.has(a)) out.push(a)
  return out
}

/** Les trous, regroupés en intervalles : « 1958 → 1962 » plutôt que cinq lignes. */
export function intervallesManquants(archives, jusqua = new Date().getFullYear()) {
  const manquantes = anneesManquantes(archives, jusqua)
  const out = []
  for (const a of manquantes) {
    const dernier = out[out.length - 1]
    if (dernier && a === dernier.fin + 1) dernier.fin = a
    else out.push({ debut: a, fin: a })
  }
  return out
}

/** Par décennie décroissante, puis par année décroissante. */
export function grouperParDecennie(archives) {
  const groupes = new Map()
  for (const a of archives || []) {
    const d = Math.floor((a.annee || 0) / 10) * 10
    if (!groupes.has(d)) groupes.set(d, [])
    groupes.get(d).push(a)
  }
  return [...groupes.entries()]
    .sort((x, y) => y[0] - x[0])
    .map(([decennie, liste]) => ({
      decennie,
      archives: liste.sort((x, y) => (y.annee - x.annee) || String(y.date_ag || '').localeCompare(String(x.date_ag || ''))),
    }))
}

// ---------------------------------------------------------------- recherche
//
// ⚠ L'EXTRAIT EST CALCULÉ CÔTÉ ÉCRAN, pas par `ts_headline`. Deux raisons : la
// fonction de Postgres n'est pas atteignable par PostgREST sans une RPC dédiée,
// et surtout le texte est déjà chargé pour les lignes qui matchent — en
// redemander une version surlignée serait un aller-retour pour rien.
const sansAccent = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()

/**
 * Un extrait du texte autour du premier mot trouvé.
 *
 * ⚠ La comparaison ignore les ACCENTS, parce que l'OCR d'un scan de 1955 les
 * rend mal — chercher « arrêté » ne doit pas échouer sur un « arrete » reconnu
 * sans accent. C'est aussi pourquoi l'extrait est rendu tel qu'il est stocké,
 * fautes comprises : montrer un texte corrigé laisserait croire à une fidélité
 * que l'OCR n'a pas.
 */
export function extrait(texte, requete, longueur = 180) {
  const brut = String(texte || '')
  const mots = String(requete || '').trim().split(/\s+/).filter((m) => m.length > 2)
  if (!brut || !mots.length) return ''
  const plat = sansAccent(brut)
  let position = -1
  for (const mot of mots) {
    const i = plat.indexOf(sansAccent(mot))
    if (i > -1 && (position === -1 || i < position)) position = i
  }
  if (position === -1) return brut.slice(0, longueur).trim()
  const debut = Math.max(0, position - Math.floor(longueur / 3))
  const morceau = brut.slice(debut, debut + longueur).replace(/\s+/g, ' ').trim()
  return `${debut > 0 ? '… ' : ''}${morceau}${debut + longueur < brut.length ? ' …' : ''}`
}
