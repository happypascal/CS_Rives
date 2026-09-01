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
