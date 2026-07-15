// Pure domain logic for CS decisions: votes, quorum, adoption.
//
// Règles (révisées 2026-07-15 pour se conformer à l'ARTICLE 15 des statuts de
// l'ASL — « Réunions du conseil syndical ») :
//   - Un membre vote UNIQUEMENT pour lui-même : Pour / Contre / Abstention.
//     "Absent" n'est pas un choix — l'absence = aucun vote saisi.
//   - Adoption : « majorité des membres présents ou représentés ». L'abstention
//     est un membre PRÉSENT : elle reste au dénominateur et fait obstacle à
//     l'adoption. (Corrige la règle du 2026-07-14 — majorité des voix
//     exprimées — qui adoptait des décisions que l'art. 15 rejette.)
//   - « En cas de partage des voix, celle du président est prépondérante » :
//     autant de Pour que de non-Pour → la décision suit le vote du président.
//   - Quorum : > 50 % des membres actifs ont voté. ⚠ Règle INTERNE : l'art. 15
//     n'impose aucun quorum au CS. Volontairement plus stricte que les statuts.
//   - La décision n'est ACTÉE que lorsque le président l'enregistre, et
//     seulement si le quorum est atteint.
//
// Non couvert : la représentation (« ou représentés »). L'art. 15 l'autorise
// (un membre ne pouvant en représenter qu'un seul) ; le modèle de vote est
// self-only. Un membre sans vote saisi = absent NON représenté.

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
// presidentVote: vote du président ('pour'|'contre'|'abstention'|null) — ne sert
//   qu'à départager un partage des voix (art. 15).
export function tally(votes, activeCount, presidentVote = null) {
  const counts = { pour: 0, contre: 0, abstention: 0 }
  for (const v of votes) {
    if (counts[v.vote] !== undefined) counts[v.vote] += 1
  }

  const denomActive = activeCount ?? votes.length
  // « Présents ou représentés » (art. 15) = les membres ayant voté.
  const presents = counts.pour + counts.contre + counts.abstention

  const quorumAtteint = denomActive > 0 && presents * 2 > denomActive

  // Majorité des membres présents : l'abstention compte au dénominateur.
  const majorite = counts.pour * 2 > presents
  // Partage : autant de Pour que de non-Pour (contre + abstention). Le président
  // départage ; s'il n'a pas voté, personne ne départage → rejet.
  const partage = presents > 0 && counts.pour * 2 === presents
  const adoptee = quorumAtteint && (majorite || (partage && presidentVote === 'pour'))

  return {
    counts,
    activeCount: denomActive,
    votants: presents,
    absents: Math.max(0, denomActive - presents),
    quorumAtteint,
    partage,
    presidentVote,
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
