// Pure domain logic for CS decisions: votes, quorum, adoption.
// Frozen project rules (v2, révisées 2026-07-14) :
//   - Un membre vote UNIQUEMENT pour lui-même : Pour / Contre / Abstention.
//     "Absent" n'est pas un choix — l'absence = aucun vote saisi.
//   - Quorum : > 50 % des membres actifs ont voté (pour/contre/abstention).
//   - Adoption : majorité simple des voix exprimées (pour > contre ;
//                abstentions hors dénominateur).
//   - La décision n'est ACTÉE que lorsque le président l'enregistre, et
//     seulement si le quorum est atteint.

export const VOTE_VALUES = ['pour', 'contre', 'abstention']

export const VOTE_LABELS = {
  pour: 'Pour',
  contre: 'Contre',
  abstention: 'Abstention',
}

export const STATUT_LABELS = {
  en_cours: 'En cours',
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
}

// votes: [{ vote: 'pour'|'contre'|'abstention' }]
// activeCount: nombre de membres actifs à la date (dénominateur du quorum).
export function tally(votes, activeCount) {
  const counts = { pour: 0, contre: 0, abstention: 0 }
  for (const v of votes) {
    if (counts[v.vote] !== undefined) counts[v.vote] += 1
  }

  const denomActive = activeCount ?? votes.length
  const votants = counts.pour + counts.contre + counts.abstention
  const exprimes = counts.pour + counts.contre

  const quorumAtteint = denomActive > 0 && votants * 2 > denomActive
  const adoptee = quorumAtteint && counts.pour > counts.contre

  return {
    counts,
    activeCount: denomActive,
    votants,
    exprimes,
    absents: Math.max(0, denomActive - votants),
    quorumAtteint,
    // Statut projeté si on enregistrait maintenant (valable seulement si quorum).
    statut: adoptee ? 'adoptee' : 'rejetee',
    adoptee,
  }
}

// Résumé humain, ex : "Pour 3 / Contre 1 / Abst. 1".
export function tallySummary(counts) {
  return `Pour ${counts.pour} / Contre ${counts.contre} / Abst. ${counts.abstention}`
}

// Prochain numéro AAAA-NNN pour une année donnée.
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
