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
// Une date n'est retenue que si elle se RELIT identique : `Date` corrigerait
// silencieusement un 31 février en 3 mars, et une archive n'a pas le droit à ce
// genre de politesse.
function isoValide(a, m, j) {
  const iso = `${a}-${m}-${j}`
  const d = new Date(`${iso}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null
}

// ⚠ QUATRE ÉCRITURES DE DATE DANS LES FICHIERS RÉELS, constatées sur les
// vingt-quatre PV du lotissement (2026-09-28) — la convention de la
// spécification n'en couvrait qu'une :
//     PV AG 2003_06_28.pdf        AAAA_MM_JJ
//     PV.AGO.24.10.2020 (1).pdf   JJ.MM.AAAA
//     PV AG 18-09-2017 (2).pdf    JJ-MM-AAAA
//     PV AG53 29062013 (1).pdf    JJMMAAAA, huit chiffres collés
// Les ignorer aurait rangé la moitié du fonds sous l'année seule, et deux
// fichiers sous rien du tout.
//
// ⚠ L'ORDRE D'ESSAI COMPTE. `AAAAMMJJ` est tenté avant `JJMMAAAA` sur huit
// chiffres collés, et c'est la validité de la date qui tranche : « 29062013 »
// n'est pas une date en AAAAMMJJ (mois 20), donc c'est le 29/06/2013. Quand les
// deux lectures sont valides, on n'en choisit AUCUNE et on garde l'année seule —
// inventer un jour vaut moins que de dire qu'on ne le sait pas.
const FORMATS = [
  // AAAA-MM-JJ, AAAA_MM_JJ, AAAA.MM.JJ
  { motif: /(?:^|[^\d])(\d{4})[-_.](\d{2})[-_.](\d{2})(?![\d])/, ordre: 'ymd' },
  // JJ-MM-AAAA, JJ.MM.AAAA, JJ_MM_AAAA
  { motif: /(?:^|[^\d])(\d{2})[-_.](\d{2})[-_.](\d{4})(?![\d])/, ordre: 'dmy' },
]

function dateDuNom(base) {
  for (const { motif, ordre } of FORMATS) {
    const m = base.match(motif)
    if (!m) continue
    const iso = ordre === 'ymd' ? isoValide(m[1], m[2], m[3]) : isoValide(m[3], m[2], m[1])
    if (iso) return iso
  }
  // Huit chiffres collés : les deux lectures sont tentées, l'ambiguïté est
  // résolue par la validité — et refusée si les deux tiennent.
  const colle = base.match(/(?:^|[^\d])(\d{8})(?![\d])/)
  if (colle) {
    const n = colle[1]
    const ymd = isoValide(n.slice(0, 4), n.slice(4, 6), n.slice(6, 8))
    const dmy = isoValide(n.slice(4, 8), n.slice(2, 4), n.slice(0, 2))
    if (ymd && !dmy) return ymd
    if (dmy && !ymd) return dmy
  }
  return null
}

export function deduireDuNom(nomFichier) {
  const base = String(nomFichier || '').replace(/\.[^.]+$/, '')

  // Date complète d'abord : elle donne aussi l'année, et une année seule ne doit
  // pas court-circuiter une date lisible.
  const date_ag = dateDuNom(base)
  let annee = date_ag ? Number(date_ag.slice(0, 4)) : null
  if (annee == null) {
    // ⚠ Une année isolée ne doit pas être pêchée à l'intérieur d'un nombre plus
    // long : « 29062013 » n'annonce pas l'année 2906.
    const seule = base.match(/(?:^|[^\d])(\d{4})(?![\d])/)
    if (seule) annee = Number(seule[1])
  }

  if (annee != null && (annee < PREMIERE_ANNEE || annee > 2100)) {
    // Quatre chiffres qui ne sont pas une année plausible (un numéro de pièce,
    // une référence) : on préfère ne rien savoir que ranger le document en 3024.
    return { annee: null, date_ag: null, type_ag: typeDuNom(base), intitule: intituleDuNom(base) }
  }

  return { annee, date_ag, type_ag: typeDuNom(base), intitule: intituleDuNom(base) }
}

function typeDuNom(base) {
  for (const [motif, valeur] of TYPES_DANS_LE_NOM) {
    if (motif.test(base)) return valeur
  }
  return null
}

// ⚠ Les suffixes de doublon du système (« (2) », « (8) ») sont RETIRÉS de
// l'intitulé : ils disent l'historique des téléchargements, pas l'assemblée.
// Le nom de fichier d'origine reste dans `document.name`, donc rien n'est perdu.
const intituleDuNom = (base) => base.replace(/\s*\(\d+\)\s*$/, '').replace(/[_]+/g, ' ').trim()

/**
 * L'intitulé d'une assemblée : son type et son ANNÉE D'EXERCICE.
 *
 * ⚠ PAS LA DATE DE SÉANCE (correction de Pascal, 2026-09-28) : « les titres ne
 * sont pas uniformes… Assemblée Générale 2024, mais pas la date de l'AG, elle
 * est en dessous ». Le titre servait « Assemblée du 3/09/2016 », la ligne du
 * dessous répétait « 03/09/2016 » — la même information deux fois, et des
 * titres de longueurs inégales qui ne s'alignaient pas d'une décennie à l'autre.
 *
 * ⚠ ET L'ANNÉE N'EST PAS CELLE DE LA DATE : l'AG tenue le 19 janvier 2026 est
 * l'assemblée 2025. Le titre suit l'exercice, comme le classement.
 *
 * ⚠ Il ne dit jamais plus qu'on ne sait : sans type, « Assemblée générale »
 * tout court plutôt qu'un type inventé.
 */
export function intituleAuto({ annee, type_ag }, secours) {
  const quoi = type_ag && type_ag !== 'inconnu'
    ? TYPE_LABELS[type_ag]
    : 'Assemblée générale'
  if (annee) return `${quoi} ${annee}`
  return secours || 'Assemblée sans année'
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

// ============================================================================
// TAGS — de quoi parle ce procès-verbal
//
// Demande de Pascal (2026-09-28) : « ajouter les tags qui doivent permettre de
// filtrer ». Sans eux, retrouver ce qui s'est dit sur la plage suppose d'ouvrir
// trente-huit documents ou d'espérer que la recherche plein texte tombe sur le
// bon mot — or elle porte sur de l'OCR approximatif.
//
// ⚠ LE VOCABULAIRE EST FERMÉ, ET C'EST TOUT L'INTÉRÊT. Des mots-clés libres
// extraits au fil du texte donneraient « assemblée », « monsieur », « euros » —
// vrais, présents partout, et bons à rien pour filtrer. Ces douze-là sont les
// DOSSIERS du lotissement, ceux qui traversent les décennies : ce sont eux qu'on
// cherche.
//
// ⚠ UN TAG N'EST PAS UNE AFFIRMATION SUR LE CONTENU. Il dit « ce document
// mentionne ce dossier », pas « ce document en décide ». Posé automatiquement à
// partir d'un texte parfois océrisé, il peut manquer (OCR illisible) ou être de
// trop (une phrase incidente). Il sert à RESSERRER une recherche, jamais à
// conclure — et il reste corrigeable à la main sur la fiche.
//
// ⚠ Les motifs sont éprouvés SANS ACCENTS et en minuscules (`normaliser`) :
// l'OCR d'un scan de 1988 rend « allees » aussi souvent que « allées ».
// ============================================================================
// ⚠ CHAQUE MOTIF A ÉTÉ PESÉ CONTRE LES FAUX POSITIFS, et plusieurs l'ont été à
// la dure, en éprouvant le vocabulaire sur les vingt-sept PV réels :
//   - « syndic » s'allumait sur « conseil SYNDICal » ;
//   - « charges » sur « cahier des CHARGES » ;
//   - « président », « secrétaire », « compte » (« compte rendu ») sont partout.
//
// ⚠ ET QUATRE TAGS ENTIERS ONT ÉTÉ RETIRÉS pour la même raison, après mesure :
// « Syndic », « Comptes et budget », « Travaux » et « Conseil syndical »
// s'allumaient sur 27 documents sur 27, même en exigeant trois occurrences.
// Ce ne sont pas des dossiers du lotissement : c'est l'ORDRE DU JOUR de toute
// assemblée générale, qui parle forcément de son syndic, de son budget, de ses
// travaux et de son conseil. Un tag présent partout ne trie rien.
//
// Ce qui reste SÉPARE vraiment les procès-verbaux : ce sont les dossiers qui
// traversent les décennies, ceux qu'on vient chercher.
export const TAGS = [
  { cle: 'plage', libelle: 'Plage', motifs: ['plage', 'greve', 'baignade'] },
  { cle: 'allees', libelle: 'Allées et voirie', motifs: ['allee', 'voirie', 'chaussee', 'enrobe', 'goudron'] },
  { cle: 'portail', libelle: 'Portail et accès', motifs: ['portail', 'barriere', 'digicode', 'interphone'] },
  { cle: 'eaux', libelle: 'Eaux pluviales', motifs: ['eaux pluviales', 'pluvial', 'canalisation', 'ecoulement', 'drainage', 'assainissement'] },
  { cle: 'statuts', libelle: 'Statuts et cahier des charges', motifs: ['statut', 'cahier des charges', 'addendum', 'annexe i', 'annexe ii'] },
  { cle: 'arbres', libelle: 'Arbres et espaces verts', motifs: ['arbre', 'elagage', 'haie', 'espaces verts', 'tonte', 'plantation'] },
  { cle: 'recouvrement', libelle: 'Impayés et recouvrement', motifs: ['recouvrement', 'impaye', 'relance', 'mise en demeure', 'contentieux', 'huissier'] },
  { cle: 'assurance', libelle: 'Assurance et sinistres', motifs: ['assurance', 'sinistre', 'assureur', 'responsabilite civile'] },
  { cle: 'eclairage', libelle: 'Éclairage', motifs: ['eclairage', 'lampadaire', 'luminaire'] },
  { cle: 'urbanisme', libelle: 'Urbanisme et servitudes', motifs: ['urbanisme', 'servitude', 'permis de construire', 'cadastre', 'distraction', 'zone c'] },
]

const LIBELLES_TAG = Object.fromEntries(TAGS.map((t) => [t.cle, t.libelle]))

/** Le libellé lisible d'un tag ; le tag lui-même s'il a été saisi à la main. */
export const tagLibelle = (cle) => LIBELLES_TAG[cle] || cle

const normaliser = (s) => String(s || '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase().replace(/\s+/g, ' ')

/**
 * Les dossiers mentionnés par un texte.
 *
 * ⚠ Rend un tableau VIDE sur un texte absent ou illisible, et c'est juste : un
 * document sans texte exploitable n'est pas un document qui ne parle de rien.
 * L'écran distingue les deux.
 */
// ⚠ PAS UN `includes` : il allumait « syndic » sur « syndical ». Le motif doit
// être précédé et suivi d'autre chose qu'une lettre — le `s` du pluriel étant la
// seule tolérance, pour que « allées » trouve « allee ».

/**
 * ⚠ UN SEUIL, PAS UNE SIMPLE PRÉSENCE — et c'est ce qui rend le filtre utile.
 *
 * Éprouvé sur les vingt-sept PV du lotissement (2026-09-28) : à une mention
 * suffisante, « Syndic », « Comptes », « Travaux » et « Conseil syndical »
 * s'allumaient sur 27 documents sur 27. Un tag présent partout ne trie rien ;
 * il donne l'illusion d'un classement. Toute assemblée générale mentionne son
 * syndic et son budget — cela ne veut pas dire qu'elle en TRAITE.
 *
 * Trois occurrences : en dessous, c'est une phrase de passage ; au-dessus, le
 * dossier a été discuté. Le seuil est un réglage, pas une vérité — il est
 * exposé pour pouvoir être ajusté sur pièces.
 */
export const SEUIL_TAG = 3

const occurrences = (plat, motif) => {
  const re = new RegExp(`(?:^|[^a-z])${motif.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}s?(?![a-z])`, 'g')
  let n = 0
  while (re.exec(plat) !== null) n++
  return n
}

export function tagsDuTexte(texte, seuil = SEUIL_TAG) {
  const plat = normaliser(texte)
  if (!plat) return []
  return TAGS
    .filter((t) => t.motifs.reduce((n, m) => n + occurrences(plat, m), 0) >= seuil)
    .map((t) => t.cle)
}

/** Le compte par dossier, pour régler le seuil sur pièces plutôt qu'au jugé. */
export function comptesParTag(texte) {
  const plat = normaliser(texte)
  if (!plat) return {}
  const out = {}
  for (const t of TAGS) {
    const n = t.motifs.reduce((acc, m) => acc + occurrences(plat, m), 0)
    if (n) out[t.cle] = n
  }
  return out
}

/** Les tags réellement portés par le fonds, pour n'offrir au filtre que ce qui existe. */
export function tagsPresents(archives) {
  const vus = new Set()
  for (const a of archives || []) for (const t of a.mots_cles || []) vus.add(t)
  // Dans l'ordre du vocabulaire, pour que le filtre ne se réordonne pas à chaque
  // import ; les tags saisis à la main ferment la marche.
  const connus = TAGS.filter((t) => vus.has(t.cle)).map((t) => t.cle)
  const autres = [...vus].filter((t) => !LIBELLES_TAG[t]).sort()
  return [...connus, ...autres]
}

// ============================================================================
// LA SYNTHÈSE DU FONDS — un document, pas un par assemblée
//
// ⚠ Pascal (2026-09-28) : « le document de synthèse est en en-tête de la LISTE
// des AG », et « pas de document de synthèse dans chaque AG ». Il y en a UN pour
// soixante-dix ans d'assemblées — celui que Claude rédige, qui raconte les
// grandes lignes du fonds. Chaque assemblée a son `resume` (texte), affiché en
// tête de sa fiche ; aucune n'a de fichier propre.
//
// ⚠ IL VIT DANS `parametres`, PAS DANS UNE COLONNE. C'est une valeur UNIQUE qui
// change rarement — même cas que les coordonnées du gestionnaire (054). Lui
// donner une table serait une table d'une ligne ; le poser sur `pv_archives`
// obligerait à désigner l'archive qui le porte, et ce serait faux : il ne porte
// sur aucune en particulier.
//
// ⚠ `parametres.valeur` est du TEXTE : le document y est sérialisé en JSON, et
// relu par `synthesePV`. Une valeur illisible rend `null` plutôt que de casser
// l'écran — un paramètre bricolé à la main ne doit pas vider une archive.
// ============================================================================
export const CLE_SYNTHESE = 'pv_archives_synthese'

export function synthesePV(parametres) {
  const brut = parametres?.[CLE_SYNTHESE]
  if (!brut) return null
  try {
    const doc = JSON.parse(brut)
    return doc && doc.path ? doc : null
  } catch {
    return null
  }
}

// ============================================================================
// LES DÉCISIONS IMPACTANTES — ce qu'on vient lire, et le reste
//
// ⚠ Pascal (2026-09-28) : « je ne veux que les décisions impactantes dans ce
// résumé ». DEUX conditions, et il en manquait une au premier jet.
//
// 1. ELLE A ÉTÉ VOTÉE — « Adoptée » ou « Rejetée ».
//    ⚠ C'est la condition que j'avais oubliée, et Pascal l'a vue tout de suite :
//    « il y a des résolutions sans vote dans le résumé ; 2023 12.1 rejeté et tu
//    me mets 12.1 à 12.4, ça ne fait aucun sens ». Le principe du rond-point
//    (12.1) ayant été REJETÉ, le mandat, le financement et le fonds de travaux
//    (12.2 à 12.4) sont tombés avec lui : ils portent « Non votée ». Les afficher
//    à la suite d'un rejet donne à lire quatre décisions là où il n'y en a
//    qu'une. Sur tout le fonds : 22 « Non votée », 7 « Reportée », 1 « Inconnu
//    (page manquante) » — trente lignes qui ne décident rien.
//    ⚠ UN REJET EST UNE DÉCISION, et souvent la plus lourde de conséquences.
//    On écarte l'absence de vote, jamais un vote défavorable.
//    ⚠ Condition DÉRIVÉE, jamais stockée : elle se lit dans `resultat`. Corriger
//    un résultat corrige l'affichage, sans rien relancer.
//
// 2. ELLE N'EST PAS UN POINT DE ROUTINE — élection du bureau, comptes, quitus,
//    budget courant, désignation du syndic : cinq à dix lignes qui reviennent à
//    l'identique depuis 1988.
//    ⚠ CELLE-LÀ EST CONSTATÉE, PAS CALCULÉE. Chaque assemblée a son
//    `Resume_AG_<date>.docx`, où le tri a déjà été fait par un lecteur du
//    procès-verbal ; `au_resume` ne fait que CONSIGNER qu'une résolution y
//    figure. Une règle par mots-clés — « quitus », « comptes » — aurait été une
//    devinette, et elle se serait trompée le jour où l'assemblée REFUSE le
//    quitus : ce jour-là, le quitus est la décision de l'année.
//
// ⚠ LE CHAMP STOCKÉ S'APPELLE `au_resume`, ET NON `impactante`. Il a porté ce
// second nom une heure, et c'était un piège : il ne disait pas si la résolution
// est impactante, seulement si elle figure au résumé d'année. Un nom qui promet
// plus que ce qu'il contient finit toujours par être lu au pied de la lettre.
//
// ⚠ RIEN N'EST SUPPRIMÉ. Les 237 résolutions restent en base et l'écran donne
// accès aux écartées d'un clic. Un fonds d'archives ne choisit pas ce qui mérite
// mémoire — il choisit seulement ce qu'il montre en premier.
// ============================================================================

/**
 * A-t-elle été mise aux voix, et avec un résultat ?
 * ⚠ « Non votée », « Reportée », « Information » et « Inconnu (page manquante) »
 * ne décident rien — et « Inconnu » moins que tout : c'est une lacune du
 * document, signalée par ailleurs en réserve.
 */
export function estVotee(resultat) {
  const t = String(resultat || '')
    .normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
  return t.startsWith('adoptee') || t.startsWith('rejetee')
}

/** Sépare les résolutions d'une assemblée en « impactantes » et « écartées ». */
export function partagerResolutions(liste) {
  const toutes = liste || []
  // ⚠ `au_resume !== false` et non `=== true` : une assemblée pas encore
  // dépouillée n'a aucune marque, et la masquer ferait croire qu'elle n'a rien
  // décidé. L'absence d'information ne doit jamais se lire comme une information.
  const impactante = (r) => estVotee(r?.resultat) && r?.au_resume !== false
  return {
    impactantes: toutes.filter(impactante),
    ecartees: toutes.filter((r) => !impactante(r)),
  }
}

// ⚠ APPARIEMENT SUR L'INTITULÉ, JAMAIS SUR LE NUMÉRO. Le n° 8 de l'AG 2003
// couvre cinq résolutions distinctes ; apparier par numéro fabriquait huit
// fausses divergences lors de la vérification du 2026-09-28. Partagé par
// l'import et par le script de marquage pour que les deux apparient pareil.
export function cleIntitule(texte) {
  return String(texte || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
