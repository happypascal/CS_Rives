import { Badge } from './ui'
import { STATUT_LABELS, VOTE_LABELS, PHASE_LABELS, PHASE_TONES, phaseOf } from '../lib/decisionLogic'
import { RESOLUTION_STATUT_LABELS, AG_STATUT_LABELS, AG_STATUT_TONES } from '../lib/agLogic'
import { PROJET_STATUT_LABELS, PROJET_STATUT_TONES } from '../lib/projetLogic'

// Résultat de la délibération SEUL (en cours / adoptée / rejetée). Les écrans
// passent par `DecisionEtatBadge` ci-dessous, qui lit d'abord la phase du cycle
// de vie ; celui-ci reste le badge de bas niveau, et sert au cas « soumise ».
export function StatutBadge({ statut }) {
  const map = { en_cours: 'amber', adoptee: 'green', rejetee: 'red' }
  return <Badge tone={map[statut] || 'gray'}>{STATUT_LABELS[statut] || statut}</Badge>
}

// État LISIBLE d'une décision. Le cycle de vie (`phase`) et le résultat de la
// délibération (`statut`) sont deux colonnes distinctes (migration 026), mais le
// lecteur n'a qu'une question : « où en est cette décision ? ». Un seul badge y
// répond, en lisant la PHASE D'ABORD — tant qu'une décision n'est pas soumise au
// vote, son `statut` ('en_cours') ne veut rien dire et afficher « En cours »
// pour un brouillon serait faux.
export function DecisionEtatBadge({ decision }) {
  const phase = phaseOf(decision)
  if (phase !== 'ouverte_au_vote') {
    return <Badge tone={PHASE_TONES[phase]}>{PHASE_LABELS[phase]}</Badge>
  }
  return <StatutBadge statut={decision.statut} />
}

export function VoteBadge({ vote }) {
  const map = { pour: 'green', contre: 'red', abstention: 'amber' }
  return <Badge tone={map[vote] || 'gray'}>{VOTE_LABELS[vote] || vote}</Badge>
}

export function ResolutionStatutBadge({ statut }) {
  const map = { a_voter: 'amber', adoptee: 'green', rejetee: 'red', sans_vote: 'blue', retiree: 'gray' }
  return <Badge tone={map[statut] || 'gray'}>{RESOLUTION_STATUT_LABELS[statut] || statut}</Badge>
}

// `statut` reçu = statut DÉRIVÉ (via effectiveAGStatut au point d'appel), donc
// il peut valoir 'tenue' (AG a eu lieu), qui n'est jamais stocké en base.
export function AGStatutBadge({ statut }) {
  return <Badge tone={AG_STATUT_TONES[statut] || 'gray'}>{AG_STATUT_LABELS[statut] || statut}</Badge>
}

export function ProjetStatutBadge({ statut }) {
  return <Badge tone={PROJET_STATUT_TONES[statut] || 'gray'}>{PROJET_STATUT_LABELS[statut] || statut}</Badge>
}

export function SignatureBadge({ statut }) {
  const map = { signe: 'green', en_attente: 'amber', expire: 'red' }
  const labels = { signe: 'Signé', en_attente: 'En attente', expire: 'Expiré' }
  return <Badge tone={map[statut] || 'gray'}>{labels[statut] || 'Non envoyé'}</Badge>
}
