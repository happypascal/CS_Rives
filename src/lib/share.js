// Partage d'une décision dans le groupe WhatsApp du CS.
//
// Choix assumé : pas d'envoi automatique. Notifier 4 personnes ne justifie ni
// service d'envoi, ni domaine à vérifier, ni passerelle tierce — le président
// publie la décision puis partage le message dans le groupe existant.

import { formatDate, eur } from './format'
import { PROJET_ACTION_LABELS } from './projetLogic'

export function decisionUrl(decision) {
  return `${window.location.origin}/registre/${decision.id}`
}

// Le `*…*` est la syntaxe gras de WhatsApp ; inoffensif ailleurs.
//
// `contexte` ({ projetNom, cibleLabel }) est optionnel : sans lui le message reste
// correct, juste moins précis. Ce que la décision ENGAGE ou CHANGE est annoncé dès
// la convocation — on ne convoque pas un vote sans dire sur quoi il porte.
export function decisionShareText(decision, contexte = {}) {
  const lines = [
    '*Nouvelle décision à voter*',
    `${decision.numero} — ${decision.titre}`,
  ]
  if (decision.montant_engage != null) {
    lines.push(`Engage ${eur(decision.montant_engage)}${contexte.cibleLabel ? ` sur ${contexte.cibleLabel}` : ''}`)
  }
  if (decision.projet_action && contexte.projetNom) {
    lines.push(`${PROJET_ACTION_LABELS[decision.projet_action]} : « ${contexte.projetNom} »`)
  }
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
