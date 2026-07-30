import { Badge } from './ui'
import { STATUT_LABELS, VOTE_LABELS } from '../lib/decisionLogic'
import { RESOLUTION_STATUT_LABELS, AG_STATUT_LABELS, AG_STATUT_TONES } from '../lib/agLogic'
import { PROJET_STATUT_LABELS, PROJET_STATUT_TONES } from '../lib/projetLogic'

export function StatutBadge({ statut }) {
  const map = { en_cours: 'amber', adoptee: 'green', rejetee: 'red' }
  return <Badge tone={map[statut] || 'gray'}>{STATUT_LABELS[statut] || statut}</Badge>
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
