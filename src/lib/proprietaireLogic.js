// ============================================================================
// Registre des propriétaires — le CONTACT OFFICIEL
//
// L'adresse de convocation d'un lot vient de l'un de trois endroits : le
// propriétaire lui-même, un dirigeant de la société propriétaire, ou le
// mandataire qui le relaie. `proprietaires.contact_officiel` (migration 043) ne
// stocke QUE ce choix — jamais l'adresse.
//
// ⚠ Le contact est donc DÉRIVÉ à la lecture, comme le tantième ou le budget d'un
// projet. Recopier l'adresse produirait les deux faux habituels : une correction
// chez le mandataire n'atteindrait pas la convocation, et changer de source
// écraserait l'adresse propre du propriétaire.
// ============================================================================

export const CONTACT_PROPRIETAIRE = 'proprietaire'
export const CONTACT_DIRIGEANT = 'dirigeant'
export const CONTACT_MANDATAIRE = 'mandataire'

export const CONTACTS = [CONTACT_PROPRIETAIRE, CONTACT_DIRIGEANT, CONTACT_MANDATAIRE]

export const CONTACT_LABELS = {
  [CONTACT_PROPRIETAIRE]: 'Le propriétaire',
  [CONTACT_DIRIGEANT]: 'Un dirigeant',
  [CONTACT_MANDATAIRE]: 'Le mandataire',
}

// Ce que chaque source apporte. Le `nom` sert à l'écran, pour qu'on sache À QUI
// l'on écrit — une adresse sans nom ne dit pas si elle est encore la bonne.
const SOURCES = {
  [CONTACT_PROPRIETAIRE]: (p) => ({ nom: p.nom, email: p.email, telephone: p.telephone }),
  [CONTACT_DIRIGEANT]: (p) => ({ nom: p.dirigeant_nom, email: p.dirigeant_email, telephone: p.dirigeant_telephone }),
  [CONTACT_MANDATAIRE]: (p) => ({ nom: p.mandataire_nom, email: p.mandataire_email, telephone: p.mandataire_telephone }),
}

/**
 * Coordonnées officielles d'un propriétaire, d'après la source qu'il désigne.
 *
 * ⚠ Ne retombe JAMAIS sur une autre source quand la désignée est vide : afficher
 * l'adresse du propriétaire alors que le mandataire a été désigné ferait croire
 * à un envoi possible. Le vide est une information — il dit qu'il manque une
 * adresse là où on a décidé d'écrire.
 */
export function contactOfficiel(proprietaire) {
  if (!proprietaire) return { source: CONTACT_PROPRIETAIRE, nom: null, email: null, telephone: null }
  const source = CONTACTS.includes(proprietaire.contact_officiel)
    ? proprietaire.contact_officiel
    : CONTACT_PROPRIETAIRE
  return { source, ...SOURCES[source](proprietaire) }
}

/** Le contact désigné est-il inutilisable ? Sert à l'alerte de l'écran. */
export function contactIncomplet(proprietaire) {
  const c = contactOfficiel(proprietaire)
  return !c.email && !c.telephone
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
  { cle: 'email', valeur: (l) => contactOfficiel(l.proprietaire).email || '' },
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
