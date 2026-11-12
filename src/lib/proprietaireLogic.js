// ⚠ Seule dépendance de ce module, et elle ne peut pas boucler :
// `titulaireLogic` n'importe rien. `ROLES_DETENTEURS` y est défini une fois —
// le recopier ici ferait qu'un rôle ajouté un jour serait détenteur dans la
// carte des titulaires et pas dans le libellé de la période.
// ⚠ L'EXTENSION `.js` EST OBLIGATOIRE : Vite la devine, Node en ESM non — et
// les scripts de `scripts/` importent ce module directement. Le dépôt a déjà
// buté dessus avec `xlsx.js`.
import { ROLES_DETENTEURS } from './titulaireLogic.js'

// ============================================================================
// Registre des propriétaires — les DESTINATAIRES OFFICIELS
//
// Une convocation ne s'adresse pas à une personne, mais à toutes celles qui
// doivent l'être : les deux indivisaires d'une indivision, l'usufruitier ET le
// nu-propriétaire d'une donation démembrée, le dirigeant d'une SCI ET son
// mandataire sur place. `proprietaires.contacts_officiels` (migration 044) est
// donc une LISTE de sources cochées, et ne contient jamais d'adresse.
//
// ⚠ Les coordonnées sont DÉRIVÉES à la lecture, comme le tantième ou le budget
// d'un projet. Les recopier ferait qu'une correction chez le mandataire
// n'atteindrait pas la convocation, et que décocher une case effacerait
// l'adresse propre du propriétaire.
// ============================================================================

export const CONTACT_PROPRIETAIRE = 'proprietaire'
export const CONTACT_PROPRIETAIRE_2 = 'proprietaire_2'
export const CONTACT_DIRIGEANT = 'dirigeant'
export const CONTACT_MANDATAIRE = 'mandataire'

export const CONTACTS = [
  CONTACT_PROPRIETAIRE,
  CONTACT_PROPRIETAIRE_2,
  CONTACT_DIRIGEANT,
  CONTACT_MANDATAIRE,
]

export const CONTACT_LABELS = {
  [CONTACT_PROPRIETAIRE]: 'Le propriétaire',
  [CONTACT_PROPRIETAIRE_2]: 'Le second propriétaire',
  [CONTACT_DIRIGEANT]: 'Les dirigeants',
  [CONTACT_MANDATAIRE]: 'Le mandataire',
}

// Ce que chaque source apporte. Une source peut donner PLUSIEURS personnes : une
// société a deux dirigeants nommables, et les deux engagent la société — donc
// les deux se convoquent.
const SOURCES = {
  [CONTACT_PROPRIETAIRE]: (p) => [{ nom: p.nom, email: p.email, telephone: p.telephone }],
  [CONTACT_PROPRIETAIRE_2]: (p) => [{ nom: p.nom_2, email: p.email_2, telephone: p.telephone_2 }],
  [CONTACT_DIRIGEANT]: (p) => [
    { nom: p.dirigeant_nom, email: p.dirigeant_email, telephone: p.dirigeant_telephone },
    { nom: p.dirigeant_nom_2, email: p.dirigeant_email_2, telephone: p.dirigeant_telephone_2 },
  ],
  [CONTACT_MANDATAIRE]: (p) => [{ nom: p.mandataire_nom, email: p.mandataire_email, telephone: p.mandataire_telephone }],
}

/** Les sources cochées, nettoyées de ce qui n'existe pas. Défaut : le propriétaire. */
export function sourcesCochees(proprietaire) {
  const brut = proprietaire?.contacts_officiels
  const liste = Array.isArray(brut) ? brut.filter((c) => CONTACTS.includes(c)) : []
  return liste.length ? liste : [CONTACT_PROPRIETAIRE]
}

/**
 * Destinataires officiels d'un lot, dans l'ordre des sources.
 *
 * ⚠ Ne retient que ceux qui ont une adresse OU un téléphone : une source cochée
 * mais vide n'est pas un destinataire, et l'afficher comme tel laisserait croire
 * qu'on peut le joindre. Ne retombe jamais sur une source non cochée.
 */
export function destinataires(proprietaire) {
  if (!proprietaire) return []
  return sourcesCochees(proprietaire).flatMap((source) =>
    SOURCES[source](proprietaire)
      .filter((d) => d.email || d.telephone)
      .map((d) => ({ ...d, source })),
  )
}

/**
 * Ce qu'une source apporterait si elle était cochée, qu'elle le soit ou non.
 * Sert à signaler à l'écran les cases sans effet : une case cochée qui ne produit
 * aucun destinataire laisse croire que la personne est convoquée.
 */
export function apportDe(proprietaire, source) {
  if (!proprietaire || !SOURCES[source]) return []
  return SOURCES[source](proprietaire).filter((d) => d.email || d.telephone)
}

// ============================================================================
// LE POINT DE LECTURE UNIQUE — titulaires (068) si la période en a, 044 sinon
//
// ⚠ BASCULE PAR PÉRIODE, PAS PAR DRAPEAU GLOBAL. Une période qui porte des
// titulaires est décrite par eux ; les autres gardent les colonnes de 044.
// Un drapeau global aurait obligé à tout migrer d'un coup, et une reprise
// partielle aurait rendu la moitié des lots muets.
//
// ⚠ ET IL N'Y A QU'UN SEUL ENDROIT OÙ CETTE RÈGLE VIT. Sept lecteurs en
// dépendent — la liste du registre et son tri par e-mail, la fiche du lot, le
// PDF du notaire, le tableur du notaire, le rapprochement des envois, plus les
// deux réimplémentations de `export_md.mjs` et de
// `REQUETE_export_destinataires.sql`. Dupliquer la bascule, c'est accepter
// qu'un écran convoque quelqu'un qu'un autre ne convoque plus.
//
// ⚠ Le repo DOIT attacher `proprietaire.titulaires` (listLots et getLot le
// font). Sans eux, la fonction retombe sur 044 — ce qui est le comportement
// juste pour une période non reprise, mais serait un silence trompeur si le
// repo oubliait la jointure. D'où `aDesTitulaires()`, que les écrans affichent.
// ============================================================================

/** La période est-elle décrite par des titulaires ? */
export function aDesTitulaires(proprietaire) {
  return titulairesActifs(proprietaire).length > 0
}

function titulairesActifs(proprietaire) {
  const liste = proprietaire?.titulaires
  return Array.isArray(liste) ? liste.filter((t) => !t.date_fin) : []
}

// ============================================================================
// CE QUE LA PÉRIODE DIT D'ELLE-MÊME, DÉRIVÉ DE SES TITULAIRES
//
// Question de Pascal, 31 octobre : « je ne comprends pas pourquoi il y a ces
// 2 blocs avec les mêmes noms et adresse ». Il avait raison, et c'est ce qui
// restait du doublon après le retrait des quatre blocs de 044 : la carte
// Titulaires nommait Ferran et Delachaux avec leur adresse, et la carte
// Propriétaire actuel redemandait « Jean Ferran / Marie Delachaux » et la même
// adresse, dans deux champs à remplir.
//
// ⚠ LES DEUX COLONNES RESTENT, ET DOIVENT RESTER JUSTES. `proprietaires.nom`
// est `not null` et c'est lui que lisent la liste des parcelles, le PDF du
// notaire et le classeur ; `adresse_communication` porte une colonne et un tri
// de la liste. On ne les supprime donc pas : on les CALCULE, comme le tantième
// ou le budget d'un projet. Corriger une personne corrige alors le libellé,
// au lieu de le laisser diverger en silence.
// ============================================================================

/**
 * Le libellé de la période : les DÉTENTEURS, et eux seuls.
 *
 * ⚠ PAS « tous les titulaires ». Un représentant légal, un mandataire ou un
 * nu-propriétaire ne sont pas propriétaires : les joindre au libellé ferait
 * dire au registre, à la liste et au PDF du notaire que le gérant d'une SCI
 * possède le lot. C'est `ROLES_DETENTEURS` qui tranche — plein propriétaire,
 * indivisaire, co-propriétaire, usufruitier (art. 6 : c'est lui le membre).
 *
 * Renvoie une chaîne vide s'il n'y a aucun détenteur nommé : l'appelant garde
 * alors ce que la base porte, plutôt que de vider une colonne `not null`.
 */
export function libelleDeLaPeriode(proprietaire) {
  return titulairesActifs(proprietaire)
    .filter((t) => ROLES_DETENTEURS.includes(t.role))
    .sort(ordreDuLibelle)
    .map(nommerDetenteur)
    .filter(Boolean)
    .join(' / ')
}

/**
 * L'ordre des détenteurs dans le libellé.
 *
 * ⚠ IL DOIT ÊTRE DÉTERMINÉ, ET IL NE L'ÉTAIT PAS. Sans tri, l'ordre est celui
 * que la base renvoie — c'est-à-dire aucun ordre garanti : le premier essai a
 * produit « Mme Gladkov / Danil Gladkov » et « Mme Junod / Alain Junod », et
 * rien n'aurait empêché le même lot de s'intituler autrement au recalcul
 * suivant. Un libellé qui bouge tout seul dans un registre légal, c'est une
 * ligne de liste et une ligne d'export qui changent sans que personne n'ait
 * rien fait.
 *
 * ⚠ LE MEMBRE VOTANT D'ABORD, parce que c'est lui qui porte la voix du lot
 * (art. 9) : le nommer en tête n'est pas une politesse, c'est dire qui
 * représente la propriété. Le reste suit l'ordre alphabétique du patronyme,
 * qui a le mérite d'être stable.
 */
function ordreDuLibelle(a, b) {
  if (Boolean(a.est_membre_votant) !== Boolean(b.est_membre_votant)) {
    return a.est_membre_votant ? -1 : 1
  }
  return `${a.nom || ''} ${a.prenom || ''}`.localeCompare(`${b.nom || ''} ${b.prenom || ''}`, 'fr')
}

/**
 * Comment une personne se nomme dans le libellé d'une période.
 *
 * ⚠ LA CIVILITÉ REMPLACE LE PRÉNOM QUAND IL MANQUE (demande de Pascal,
 * 31 octobre). Dix-neuf titulaires du registre n'ont pas de prénom — les
 * états du syndic n'en donnaient pas — et le libellé se réduisait alors au
 * patronyme seul : « Hartwig », « Pargoux ». Sur un couple, « Pargoux /
 * Pargoux » ne dit même plus qu'il s'agit de deux personnes.
 *
 * ⚠ ET ELLE NE S'AJOUTE PAS AU PRÉNOM. « M. Jean Ferran » alourdit une liste
 * de cinquante lignes sans rien apprendre : le prénom suffit à identifier.
 * La civilité est un REMPLAÇANT, pas un préfixe — c'est tout ce qui reste
 * quand on ne connaît pas le prénom.
 *
 * ⚠ Et une personne morale n'en porte jamais : « M. SCI Logudoro » serait
 * absurde. Son nom est sa dénomination, un point c'est tout.
 */
export function nommerDetenteur(t) {
  const nom = (t?.nom || '').trim()
  if (!nom) return ''
  if (t?.est_personne_morale) return nom
  const prenom = (t?.prenom || '').trim()
  if (prenom) return `${prenom} ${nom}`
  const civilite = (t?.civilite || '').trim()
  return civilite ? `${civilite} ${nom}` : nom
}

/**
 * Les noms d'une période pour les DOCUMENTS qui partent à l'étude — le PDF de
 * l'état des colotis et son classeur.
 *
 * ⚠ `nom_2` N'EST AJOUTÉ QUE S'IL N'EST PAS DÉJÀ DANS LE LIBELLÉ. Depuis le
 * 31 octobre, `nom` nomme TOUS les détenteurs (« Danil Gladkov / Mme
 * Gladkov ») tandis que `nom_2` porte encore le second propriétaire hérité de
 * la 038. Les concaténer sans regarder donnait « Danil Gladkov / Mme Gladkov /
 * Gladkov Mme » dans le document envoyé au notaire.
 *
 * ⚠ ON LE GARDE POUR AUTANT : sur une période sans titulaires, `nom_2` est le
 * seul endroit où la seconde personne soit nommée. Le retirer ferait réclamer
 * un seul titre là où deux sont dus.
 *
 * ⚠ Comparaison par MOTS : « Gladkov Mme » et « Mme Gladkov » sont la même
 * personne écrite dans deux ordres, et une égalité stricte ne le verrait pas.
 *
 * Partagée par le PDF et le classeur : deux recettes pour le même nom
 * divergent au premier changement, et c'est le même document qui part.
 */
export function composerNoms(p) {
  const nom = (p?.nom || '').trim()
  const second = (p?.nom_2 || '').trim()
  if (!second) return nom
  const mots = (s) => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((m) => m.length > 2)
  const motsDuSecond = mots(second)
  const dejaLa = motsDuSecond.length > 0 && motsDuSecond.every((m) => mots(nom).includes(m))
  return dejaLa ? nom : [nom, second].filter(Boolean).join(' / ')
}

/**
 * L'adresse de communication du lot : celle de l'INTERLOCUTEUR PRINCIPAL.
 *
 * ⚠ Une seule adresse « du lot » n'a plus de sens depuis la 068 — les statuts
 * font élection de domicile en la demeure respective de chacun (art. 28), et
 * les envois emploient l'adresse de chaque titulaire (`destinatairesDuLot`).
 * Cette colonne ne sert plus qu'à la LISTE, qui montre une adresse par ligne :
 * on y met donc celle de la personne à qui l'on s'adresse en premier — le
 * représentant désigné d'une indivision (art. 6), à défaut le membre votant,
 * à défaut le premier détenteur.
 *
 * ⚠ Renvoie une chaîne vide si cette personne n'a pas d'adresse propre. Une
 * dérivation qui rendrait `null` EFFACERAIT l'adresse reprise de périodes dont
 * les titulaires n'ont pas tous une adresse — seize l'avaient été au 22 octobre.
 */
export function adresseDeLaPeriode(proprietaire) {
  const actifs = titulairesActifs(proprietaire)
  const detenteurs = actifs.filter((t) => ROLES_DETENTEURS.includes(t.role))
  const principal = actifs.find((t) => t.est_representant_designe)
    || actifs.find((t) => t.est_membre_votant)
    || detenteurs[0]
  return (principal?.adresse_postale || '').trim()
}

/**
 * Les destinataires d'une convocation, sous la même forme que `destinataires`
 * ({ nom, email, telephone, source }) pour que les sept lecteurs n'aient rien
 * à changer. `source` porte le RÔLE quand la période est reprise.
 *
 * ⚠ `refus_electronique` ne retire PAS la personne : elle reste destinataire,
 * et c'est la liste postale qui la servira. La retirer ici ferait disparaître
 * des convocations quelqu'un qui a seulement demandé du papier (art. 8).
 */
export function destinatairesDuLot(proprietaire) {
  const titulaires = titulairesActifs(proprietaire)
  if (!titulaires.length) return destinataires(proprietaire)
  return titulaires
    .filter((t) => t.destinataire_convocations)
    .filter((t) => (t.email || '').trim() || (t.telephone || '').trim() || (t.adresse_postale || '').trim())
    .map((t) => ({
      nom: [t.civilite, t.prenom, t.nom].map((x) => (x || '').trim()).filter(Boolean).join(' '),
      email: t.email || null,
      telephone: t.telephone || null,
      source: t.role,
      titulaire_id: t.id,
      refus_electronique: Boolean(t.refus_electronique),
      adresse_postale: t.adresse_postale || null,
    }))
}

/**
 * Les adresses à mettre en destinataires d'un envoi, dédoublonnées.
 *
 * ⚠ Passe par `destinatairesDuLot`, donc bascule avec le reste. Et ⚠ ÉCARTE
 * celui qui a demandé le courrier postal : lui écrire un e-mail serait passer
 * outre une demande expresse (art. 8 et 13). Il n'en disparaît pas pour autant,
 * `destinatairesDuLot` le rend toujours — c'est à l'appelant d'en faire une
 * ligne de liste postale.
 */
export function emailsOfficiels(proprietaire) {
  return [...new Set(
    destinatairesDuLot(proprietaire)
      .filter((d) => !d.refus_electronique)
      .map((d) => d.email)
      .filter(Boolean),
  )]
}

/** Aucun destinataire joignable : le lot est hors de portée d'une convocation. */
export function contactIncomplet(proprietaire) {
  return destinatairesDuLot(proprietaire).length === 0
}

// Le mandataire, pour le TRI de la liste. ⚠ Le rôle est écrit en clair plutôt
// qu'importé de `titulaireLogic` : ce module est lu par `export_md.mjs`, hors
// du bundle, et une chaîne de dépendances de plus y serait une chance de plus
// de casser le script. La valeur, elle, est la même des deux côtés.
function mandatairePourTri(proprietaire) {
  const t = titulairesActifs(proprietaire).find((x) => x.role === 'mandataire')
  if (t) return [t.prenom, t.nom].filter(Boolean).join(' ') || t.email || ''
  return proprietaire?.mandataire_nom || proprietaire?.mandataire_email || ''
}

// ============================================================================
// TRI DU REGISTRE — partagé par la LISTE et par la FICHE
//
// ⚠ Ces clés vivent ici et non dans la page parce que DEUX écrans en dépendent :
// la liste les propose en en-tête, et la navigation « précédente / suivante » de
// la fiche doit suivre exactement le même ordre. Dupliquer les comparateurs
// ferait qu'un tri par superficie dans la liste enverrait vers la parcelle
// suivante par numéro — un décalage muet, du genre qu'on ne remarque qu'après.
//
// `valeur` renvoie ce sur quoi on TRIE, pas ce qu'on affiche : le propriétaire
// vit sur une autre ligne que la parcelle, et une parcelle vacante doit se
// ranger sans faire échouer la comparaison — d'où les chaînes vides par défaut.
// ============================================================================

export const TRIS = [
  { cle: 'lot', valeur: (l) => l.numero || '', numerique: true },
  // Superficie et n° de syndic triés en NUMÉRIQUE : en texte, 90 passerait
  // après 1000. Le n° Foncia est l'ordre des appels de fonds.
  { cle: 'superficie', valeur: (l) => (l.superficie != null ? String(l.superficie) : ''), numerique: true },
  { cle: 'numero_syndic', valeur: (l) => l.numero_syndic || '', numerique: true },
  { cle: 'adresse_lotissement', valeur: (l) => l.adresse_lotissement || '' },
  // La numérotation d'ORIGINE (069). ⚠ On trie sur « zone + numéro », et le
  // numéro est COMPLÉTÉ À GAUCHE : en texte, « 10 » passerait avant « 2 », et
  // `numeric` ne servirait à rien sur une chaîne qui commence par la zone.
  // Les parcelles sans numéro connu — la moitié — se rangent à la fin.
  {
    cle: 'lot_origine',
    valeur: (l) => (l.numero_origine ? `${l.zone || 'Z'}${String(l.numero_origine).padStart(4, '0')}` : 'ZZZZZ'),
  },
  { cle: 'adresse_communication', valeur: (l) => l.proprietaire?.adresse_communication || '' },
  { cle: 'proprietaire', valeur: (l) => l.proprietaire?.nom || '' },
  // Tri sur la PREMIÈRE adresse de convocation : c'est celle qui apparaît en
  // tête de la cellule, et trier sur autre chose que ce qu'on lit désoriente.
  { cle: 'email', valeur: (l) => emailsOfficiels(l.proprietaire)[0] || '' },
  // Le mandataire se range sur son NOM quand il existe, sinon sur son adresse :
  // une fiche sans nom doit rejoindre les autres mandataires, pas les vides.
  // ⚠ Bascule comme le reste (068) : sur une période reprise, le mandataire est
  // un RÔLE et non plus une colonne. Trier sur `mandataire_nom` y rangerait la
  // parcelle chez les vides alors que la fiche affiche un mandataire.
  { cle: 'mandataire', valeur: (l) => mandatairePourTri(l.proprietaire) },
]

// Le tri choisi est mémorisé PAR NAVIGATEUR : on consulte ce registre en
// allers-retours (liste → fiche → liste), et le reprendre à zéro à chaque retour
// est une corvée. `localStorage` suffit — c'est un confort d'affichage, propre à
// la personne et à son poste, il n'a rien à faire en base. Toute lecture ou
// écriture peut lever (navigation privée, site data bloqué) : on retombe alors
// silencieusement sur le tri par défaut.
export const CLE_TRI = 'cs-rives.registre-proprietaires.tri'
export const TRI_DEFAUT = { cle: 'lot', sens: 1 }

export function lireTri() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_TRI) || 'null')
    // Une clé supprimée depuis, ou un contenu bricolé à la main, ne doit pas
    // casser l'écran : on ne retient que ce qui existe encore.
    if (brut && TRIS.some((t) => t.cle === brut.cle) && (brut.sens === 1 || brut.sens === -1)) return brut
  } catch { /* stockage indisponible */ }
  return TRI_DEFAUT
}

export function ecrireTri(tri) {
  try {
    localStorage.setItem(CLE_TRI, JSON.stringify(tri))
  } catch { /* stockage indisponible : le tri vaut pour la session */ }
}

// ============================================================================
// LES FILTRES DE LA LISTE — mémorisés comme le tri, et APPLIQUÉS PARTOUT
//
// Pascal, 3 novembre : « les boutons de navigation du registre ne tiennent pas
// compte du filtre appliqué sur la liste et quand on retourne à la liste
// depuis la fiche, le filtre n'est pas conservé ».
//
// ⚠ LE TRI ÉTAIT MÉMORISÉ, PAS LES FILTRES — et c'est une incohérence qui se
// paie deux fois. Filtrer sur les neuf titres manquants, ouvrir le premier,
// puis enchaîner avec « suivante » faisait passer à la parcelle suivante du
// REGISTRE ENTIER : on retombait sur un lot qui n'avait rien à voir avec ce
// qu'on était en train de traiter. Et revenir à la liste rouvrait les
// cinquante lignes, obligeant à refiltrer à chaque aller-retour.
//
// ⚠ LE FILTRAGE EST ÉCRIT ICI, UNE FOIS, et non dans l'écran : la liste et la
// navigation de la fiche doivent produire EXACTEMENT la même suite, sinon la
// flèche « suivante » ne mène pas à la ligne d'en dessous. C'est le même
// raisonnement qui a fait sortir `trierLots` de l'écran.
// ============================================================================
export const CLE_FILTRES = 'cs-rives.registre-proprietaires.filtres'
export const FILTRES_VIDES = { q: '', titre: null, aCompleter: false }

export function lireFiltres() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_FILTRES) || 'null')
    if (brut && typeof brut === 'object') {
      return {
        q: typeof brut.q === 'string' ? brut.q : '',
        // ⚠ On ne valide pas la valeur du statut contre une liste : `titreLogic`
        // n'est pas importé ici, et un état retiré un jour rendrait simplement
        // une liste vide — pas un écran cassé. Le filtre se décoche d'un clic.
        titre: typeof brut.titre === 'string' && brut.titre ? brut.titre : null,
        aCompleter: brut.aCompleter === true,
      }
    }
  } catch { /* stockage indisponible */ }
  return FILTRES_VIDES
}

export function ecrireFiltres(f) {
  try {
    localStorage.setItem(CLE_FILTRES, JSON.stringify(f))
  } catch { /* stockage indisponible : les filtres valent pour la session */ }
}

/** Y a-t-il quelque chose à restreindre ? Sert à le DIRE sur la fiche. */
export function filtresActifs(f) {
  return Boolean(f?.q?.trim() || f?.titre || f?.aCompleter)
}

/**
 * La liste restreinte, telle que l'écran la montre.
 *
 * `etat` et `incomplets` sont passés par l'appelant plutôt qu'importés : ce
 * module ne connaît ni `titreLogic` ni les contrôles de titulaires, et les y
 * faire entrer créerait un cycle d'imports entre trois fichiers de logique.
 */
export function filtrerLots(lots, filtres, { etatDuTitre, lotsACompleter } = {}) {
  const f = filtres || FILTRES_VIDES
  let base = lots || []
  if (f.titre && etatDuTitre) {
    base = base.filter((l) => l.proprietaire && etatDuTitre(l.proprietaire) === f.titre)
  } else if (f.aCompleter && lotsACompleter) {
    base = base.filter((l) => lotsACompleter.has(l.id))
  }
  const terme = (f.q || '').trim().toLowerCase()
  if (!terme) return [...base]
  return base.filter((l) =>
    [l.numero, l.numero_syndic, l.adresse_lotissement,
      l.numero_origine && `lot ${l.numero_origine}`, l.zone && `zone ${l.zone}`,
      l.proprietaire?.nom, l.proprietaire?.nom_2,
      l.proprietaire?.dirigeant_nom, l.proprietaire?.dirigeant_nom_2, l.proprietaire?.mandataire_nom,
      l.proprietaire?.email, l.proprietaire?.email_2, l.proprietaire?.mandataire_email]
      .filter(Boolean).join(' ').toLowerCase().includes(terme))
}

/** Range les parcelles comme la liste les range. Ne modifie pas le tableau reçu. */
export function trierLots(lots, tri) {
  const colonne = TRIS.find((t) => t.cle === tri?.cle) || TRIS[0]
  const sens = tri?.sens === -1 ? -1 : 1
  return [...lots].sort((a, b) =>
    // `numeric` pour que la parcelle 10 vienne après la 9, et non entre 1 et 2.
    colonne.valeur(a).localeCompare(colonne.valeur(b), 'fr', { numeric: colonne.numerique }) * sens,
  )
}
