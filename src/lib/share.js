// Partage d'une décision dans le groupe WhatsApp du CS.
//
// Choix assumé : pas d'envoi automatique. Notifier 4 personnes ne justifie ni
// service d'envoi, ni domaine à vérifier, ni passerelle tierce — le président
// publie la décision puis partage le message dans le groupe existant.

import { formatDate } from './format'

export function decisionUrl(decision) {
  return `${window.location.origin}/registre/${decision.id}`
}

// Le `*…*` est la syntaxe gras de WhatsApp ; inoffensif ailleurs.
export function decisionShareText(decision) {
  const lines = [
    '*Nouvelle décision à voter*',
    `${decision.numero} — ${decision.titre}`,
  ]
  if (decision.date_limite_reponse) {
    lines.push(`Réponse souhaitée avant le ${formatDate(decision.date_limite_reponse)}`)
  }
  lines.push(`Voter : ${decisionUrl(decision)}`)
  return lines.join('\n')
}

// wa.me sans numéro : WhatsApp s'ouvre (app sur mobile, web sur PC) et laisse
// choisir le destinataire — donc le groupe du CS.
export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
