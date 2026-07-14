// Pure domain logic for quorum, tallies and adoption.
// Frozen project rules (validés 2026-07-14):
//   - Quorum   : majorité des membres ACTIFS présents (> 50 %).
//                "présent" = a voté pour/contre/abstention (pas "absent").
//   - Adoption : majorité des voix EXPRIMÉES (pour > contre).
//                abstentions et absents hors dénominateur.

export const VOTE_VALUES = ['pour', 'contre', 'abstention', 'absent']

export const VOTE_LABELS = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
  absent: 'Absent',
}

export const STATUT_LABELS = {
  en_cours: 'En cours',
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
}

// votes: array of { vote: 'pour'|'contre'|'abstention'|'absent' }
// activeCount: number of CS members active at the decision date (denominator
//   for quorum). Defaults to the number of votes when not supplied.
export function tally(votes, activeCount) {
  const counts = { pour: 0, contre: 0, abstention: 0, absent: 0 }
  for (const v of votes) {
    if (counts[v.vote] !== undefined) counts[v.vote] += 1
  }

  const denomActive = activeCount ?? votes.length
  const present = counts.pour + counts.contre + counts.abstention
  const exprimes = counts.pour + counts.contre

  // Quorum: strictly more than half of active members present.
  const quorumAtteint = denomActive > 0 && present * 2 > denomActive

  // Adoption is only meaningful when quorum is reached.
  const adoptee = quorumAtteint && counts.pour > counts.contre

  return {
    counts,
    activeCount: denomActive,
    present,
    exprimes,
    quorumAtteint,
    // Resulting statut once the vote is closed.
    statut: quorumAtteint ? (adoptee ? 'adoptee' : 'rejetee') : 'rejetee',
    adoptee,
  }
}

// Short human summary, e.g. "Pour 3 / Contre 1 / Abst. 1 / Absent 0".
export function tallySummary(counts) {
  return `Pour ${counts.pour} / Contre ${counts.contre} / Abst. ${counts.abstention} / Absent ${counts.absent}`
}

// Next decision number in the AAAA-NNN format for a given year, based on the
// existing decisions of that year.
export function nextNumero(year, existingDecisions) {
  const prefix = `${year}-`
  let max = 0
  for (const d of existingDecisions) {
    if (d.numero?.startsWith(prefix)) {
      const seq = parseInt(d.numero.slice(prefix.length), 10)
      if (!Number.isNaN(seq) && seq > max) max = seq
    }
  }
  return `${year}-${String(max + 1).padStart(3, '0')}`
}
