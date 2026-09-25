// ENVOIS AUX COLOTIS — libellés et petites règles de lecture (migration 056).
//
// Le fichier existe pour la même raison qu'`agLogic.js` ou `projetLogic.js` :
// deux écrans lisent ces mêmes libellés, et une table de correspondance recopiée
// finit toujours par diverger d'un côté.

/**
 * Par où le message est parti. `app` est la phase 2, pas encore construite.
 *
 * ⚠ `mail_bcc` (058) est un canal à part entière, pas une variante : le message
 * du 18 août est parti à la main depuis Mail, en copie cachée. C'est ce qui
 * explique qu'il n'ait aucun journal et que ses destinataires se lisent dans
 * l'en-tête du message conservé.
 *
 * ⚠ TOUT CANAL DOIT AVOIR SON LIBELLÉ ICI : sans lui, l'écran affiche la valeur
 * brute de la base (« mail_bcc ») au milieu de libellés français.
 */
export const CANAL_LABELS = {
  applescript_mail: 'Mail (script)',
  mail_bcc: 'Mail (copie cachée)',
  app: 'Application',
}

export const STATUT_LABELS = {
  envoye: 'Envoyé',
  erreur: 'Échec',
  // ⚠ « Supposé envoyé » n'est PAS un « envoyé » nuancé par politesse : il dit
  // que la personne figurait sur la liste de l'envoi, et rien de plus. Aucun
  // envoi vers elle n'a été constaté. Le libellé doit rester aussi explicite —
  // c'est ce qui permet de répondre honnêtement à « je n'ai rien reçu ».
  suppose_envoye: 'Supposé envoyé',
}

export const STATUT_TONES = {
  envoye: 'green',
  erreur: 'red',
  // Ambre, comme tout ce qui demande une réserve dans cette application : ni le
  // vert d'un fait constaté, ni le rouge d'un échec.
  suppose_envoye: 'amber',
}

// ---------------------------------------------------------------- fiabilité
//
// ⚠ TOUTES LES CAMPAGNES NE SE VALENT PAS, et l'écran doit le dire (058). Une
// campagne journalisée nomme chaque destinataire et son sort ; une campagne
// reconstituée a été retrouvée après coup, sa date et sa liste établies par
// recoupement. Les afficher à l'identique ferait du registre un menteur poli.
export const FIABILITE_LABELS = {
  journal: 'Journal d’envoi',
  reconstitue: 'Reconstituée',
}

export const FIABILITE_TONES = {
  journal: 'green',
  reconstitue: 'amber',
}

/** Une campagne dont l'envoi n'a été constaté par aucun journal. */
export const estReconstituee = (c) => c?.fiabilite === 'reconstitue'

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
