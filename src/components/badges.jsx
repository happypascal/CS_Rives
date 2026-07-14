import { Badge } from './ui'
import { STATUT_LABELS, VOTE_LABELS } from '../lib/decisionLogic'
import { RESOLUTION_STATUT_LABELS, BUDGET_STATUT_LABELS } from '../lib/agLogic'

export function StatutBadge({ statut }) {
  const map = {
    en_cours: 'amber',
    adoptee: 'green',
    rejetee: 'red',
  }
  return <Badge tone={map[statut] || 'gray'}>{STATUT_LABELS[statut] || statut}</Badge>
}

export function VoteBadge({ vote }) {
  const map = {
    pour: 'green',
    contre: 'red',
    abstention: 'amber',
    absent: 'gray',
  }
  return <Badge tone={map[vote] || 'gray'}>{VOTE_LABELS[vote] || vote}</Badge>
}

export function ResolutionStatutBadge({ statut }) {
  const map = { adoptee: 'green', rejetee: 'red', retiree: 'gray' }
  return <Badge tone={map[statut] || 'gray'}>{RESOLUTION_STATUT_LABELS[statut] || statut}</Badge>
}

export function BudgetStatutBadge({ statut }) {
  const map = { vote: 'blue', appele: 'amber', encaisse: 'navy', solde: 'green' }
  return <Badge tone={map[statut] || 'gray'}>{BUDGET_STATUT_LABELS[statut] || statut}</Badge>
}

export function AGStatutBadge({ statut }) {
  const map = { en_cours: 'amber', cloturee: 'green', annulee: 'red' }
  const labels = { en_cours: 'En cours', cloturee: 'Clôturée', annulee: 'Annulée' }
  return <Badge tone={map[statut] || 'gray'}>{labels[statut] || statut}</Badge>
}
