// Résumé d'une décision : ce qu'un membre doit lire pour savoir de quoi il s'agit
// sans ouvrir la fiche.
//
// Défini UNE fois et partagé par la liste du registre et le PDF (celui-là même
// qu'on envoie à Youtrust pour signature) : les deux doivent dire exactement la
// même chose. Deux résumés écrits séparément divergent — et sur un registre
// légal, l'écran et le document signé ne peuvent pas raconter deux histoires.

import { htmlToText, truncate, eur } from './format'
import { PROJET_ACTION_LABELS } from './projetLogic'

// `contexte` : { projetNom, cibleLabel } — optionnel. Sans lui le résumé reste
// juste, seulement moins précis (« Engage 20 000 € » sans dire sur quoi).
export function decisionResume(decision, contexte = {}, { max = 180 } = {}) {
  const extrait = truncate(htmlToText(decision.description), max)

  // L'action d'abord l'argent, ensuite l'effet : c'est l'ordre dans lequel on se
  // pose la question (« combien ? » puis « et ça change quoi ? »).
  const actions = []
  if (decision.montant_engage != null && decision.montant_engage !== '') {
    actions.push(`Engage ${eur(decision.montant_engage)}${contexte.cibleLabel ? ` sur ${contexte.cibleLabel}` : ''}`)
  }
  if (decision.projet_action) {
    actions.push(`${PROJET_ACTION_LABELS[decision.projet_action]}${contexte.projetNom ? ` : « ${contexte.projetNom} »` : ''}`)
  }

  return {
    titre: decision.titre,
    extrait,                       // '' si la description est vide : elle est optionnelle
    action: actions.join(' · '),   // '' si la décision n'engage ni ne change rien
  }
}

// Même résumé, à plat, pour un contexte sans mise en forme (cellule de PDF).
export function decisionResumeTexte(decision, contexte, opts) {
  const { titre, extrait, action } = decisionResume(decision, contexte, opts)
  return [titre, action, extrait].filter(Boolean).join('\n')
}
