// ENVOIS AUX COLOTIS — libellés et petites règles de lecture (migration 056).
//
// Le fichier existe pour la même raison qu'`agLogic.js` ou `projetLogic.js` :
// deux écrans lisent ces mêmes libellés, et une table de correspondance recopiée
// finit toujours par diverger d'un côté.

/** Par où le message est parti. `app` est la phase 2, pas encore construite. */
export const CANAL_LABELS = {
  applescript_mail: 'Mail (script)',
  app: 'Application',
}

export const STATUT_LABELS = {
  envoye: 'Envoyé',
  erreur: 'Échec',
}

export const STATUT_TONES = {
  envoye: 'green',
  erreur: 'red',
}

export const LANGUE_LABELS = {
  FR: 'Français',
  EN: 'Anglais',
}

/**
 * Les destinataires que le registre n'a pas su rattacher à un propriétaire.
 *
 * ⚠ Ce n'est pas un défaut d'import à corriger en silence : une adresse sans
 * correspondance est soit un contact périmé — et le prochain envoi ratera la
 * même personne — soit quelqu'un qui n'est pas coloti. Les deux méritent d'être
 * vus. Le script ne crée JAMAIS de propriétaire à cette occasion.
 */
export function nonRapproches(destinataires) {
  return (destinataires || []).filter((d) => !d.proprietaire_id)
}

/**
 * Le corps tel qu'il est parti : français, filet, anglais.
 *
 * ⚠ Le filet de soixante tirets est celui du script d'envoi
 * (`Envoyer_message_colotis.applescript`). Il est reproduit ici pour que
 * l'écran montre le message DANS LA FORME REÇUE, et non deux textes rangés
 * côte à côte — ce qui laisserait croire que deux messages sont partis.
 */
export const FILET = '------------------------------------------------------------'

/**
 * Le texte d'un message, découpé en paragraphes affichables.
 *
 * Les corps sont du TEXTE BRUT, pas du HTML : ils viennent de fichiers `.txt`
 * et sont partis tels quels. Les afficher avec `dangerouslySetInnerHTML` serait
 * à la fois inutile et une porte ouverte — on découpe donc sur les sauts de
 * ligne et React échappe le reste.
 */
export function paragraphes(texte) {
  return String(texte || '').replace(/\r\n?/g, '\n').split('\n')
}
