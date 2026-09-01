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

/** Les adresses à mettre en destinataires d'un envoi, dédoublonnées. */
export function emailsOfficiels(proprietaire) {
  return [...new Set(destinataires(proprietaire).map((d) => d.email).filter(Boolean))]
}

/** Aucun destinataire joignable : le lot est hors de portée d'une convocation. */
export function contactIncomplet(proprietaire) {
  return destinataires(proprietaire).length === 0
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
  { cle: 'adresse_communication', valeur: (l) => l.proprietaire?.adresse_communication || '' },
  { cle: 'proprietaire', valeur: (l) => l.proprietaire?.nom || '' },
  // Tri sur la PREMIÈRE adresse de convocation : c'est celle qui apparaît en
  // tête de la cellule, et trier sur autre chose que ce qu'on lit désoriente.
  { cle: 'email', valeur: (l) => emailsOfficiels(l.proprietaire)[0] || '' },
  // Le mandataire se range sur son NOM quand il existe, sinon sur son adresse :
  // une fiche sans nom doit rejoindre les autres mandataires, pas les vides.
  { cle: 'mandataire', valeur: (l) => l.proprietaire?.mandataire_nom || l.proprietaire?.mandataire_email || '' },
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

/** Range les parcelles comme la liste les range. Ne modifie pas le tableau reçu. */
export function trierLots(lots, tri) {
  const colonne = TRIS.find((t) => t.cle === tri?.cle) || TRIS[0]
  const sens = tri?.sens === -1 ? -1 : 1
  return [...lots].sort((a, b) =>
    // `numeric` pour que la parcelle 10 vienne après la 9, et non entre 1 et 2.
    colonne.valeur(a).localeCompare(colonne.valeur(b), 'fr', { numeric: colonne.numerique }) * sens,
  )
}
