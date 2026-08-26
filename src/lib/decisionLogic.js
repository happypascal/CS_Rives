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

// ---------------------------------------------------------------- cycle de vie
//
// `phase` (migration 026) est un axe DISTINCT de `statut`, et les confondre est
// l'erreur à éviter :
//   - `phase`  = où en est la décision dans son cycle — brouillon, planifiée,
//                ouverte au vote, annulée avant ouverture.
//   - `statut` = RÉSULTAT de la délibération — en_cours, puis adoptee/rejetee
//                à l'enregistrement (art. 15, `tally` ci-dessous).
// Les budgets, le CSV Foncia et le PDF lisent `statut` et ne connaissent pas le
// cycle. La spec « brouillon / planifiée » fusionnait les deux dans une seule
// colonne ; les séparer évite qu'un brouillon devienne un statut inconnu de
// toutes ces dérivations.
export const PHASE_VALUES = ['brouillon', 'planifiee', 'ouverte_au_vote', 'annulee']

export const PHASE_LABELS = {
  brouillon: 'Brouillon',
  planifiee: 'Planifiée',
  ouverte_au_vote: 'Ouverte au vote',
  annulee: 'Annulée',
}

export const PHASE_TONES = {
  brouillon: 'gray',
  planifiee: 'blue',
  ouverte_au_vote: 'amber',
  annulee: 'red',
}

// ---------------------------------------------------------------- visibilité
//
// ⚠ AUCUN LECTEUR À CE JOUR : l'accès des colotis au registre n'existe pas
// (hors périmètre de la spec « brouillon / planifiée », §9). Le champ enregistre
// l'INTENTION prise à la rédaction, pour ne pas avoir à repasser sur tout
// l'historique le jour où cet accès s'ouvrira. Il est affiché, il se change —
// mais il ne masque RIEN aujourd'hui : toute décision reste visible des seuls
// membres du CS connectés. Ne pas le câbler à un filtre de lecture sans avoir
// écrit les policies correspondantes.
export const VISIBILITE_VALUES = ['cs_seul', 'colotis']

export const VISIBILITE_LABELS = {
  cs_seul: 'Conseil Syndical seulement',
  colotis: 'Ouverte aux colotis',
}

// Forme courte, pour les listes où la place manque.
export const VISIBILITE_COURT = {
  cs_seul: 'CS seulement',
  colotis: 'Colotis',
}

// Les décisions antérieures à la migration 026 valent 'cs_seul' (défaut de la
// colonne) — comme pour `phase`, on lit toujours par ici plutôt qu'en dur.
export function visibiliteOf(decision) {
  return decision?.visibilite || 'cs_seul'
}

// Les décisions antérieures à la migration 026 n'ont pas de `phase` : elles sont,
// par définition, déjà soumises au vote. Lire la phase TOUJOURS par ici — un
// `d.phase === 'ouverte_au_vote'` écrit en dur renverrait faux sur ces lignes
// tant qu'elles ne sont pas relues depuis une base migrée.
export function phaseOf(decision) {
  return decision?.phase || 'ouverte_au_vote'
}

// Le vote est-il ouvert ? Deux conditions, pas une : la décision doit avoir été
// soumise ET ne pas être déjà enregistrée (le verrou de l'art. 15).
export function voteOuvert(decision) {
  return phaseOf(decision) === 'ouverte_au_vote' && !decision?.enregistree
}

// Pas encore soumise au vote : brouillon ou planifiée. Ni vote, ni quorum, ni
// enregistrement, ni « à voter » dans le registre — rien n'a encore été demandé
// au conseil.
export function avantSoumission(decision) {
  const p = phaseOf(decision)
  return p === 'brouillon' || p === 'planifiee'
}

// Texte gelé à l'ouverture du vote : titre + ligne vide + description, tel quel.
// Recette volontairement triviale, et DUPLIQUÉE à l'identique dans le trigger
// `decisions_cycle_guard` (SQL) : on doit pouvoir refaire l'empreinte à la main
// dans dix ans, sans l'app. Toute modification ici doit l'être aussi là-bas.
export function contenuAGeler(decision) {
  return `${decision.titre}\n\n${decision.description || ''}`
}

// Coût TTC d'un engagement de décision (migration 024). Le devis est saisi HT ou
// TTC ; l'enveloppe d'AG étant TTC, la CONSOMMATION de budget se calcule toujours
// en TTC. `tva_incluse === false` ⇒ HT ⇒ on ajoute la TVA ; sinon (true/null/
// undefined) le montant est déjà TTC (ou pas de TVA) — donc les décisions
// existantes (tva_incluse NULL) ne sont pas gonflées rétroactivement.
export function engagementTTC(d) {
  const m = Number(d?.montant_engage) || 0
  if (!m) return 0
  if (d.tva_incluse === false) return m * (1 + (Number(d.tva_taux) || 0) / 100)
  return m
}
// Libellé court du statut TVA d'une décision, pour l'affichage à côté du montant.
export function tvaLabel(d) {
  if (d?.montant_engage == null || d.montant_engage === '') return null
  const taux = Number(d.tva_taux) || 0
  if (d.tva_incluse === false) return taux > 0 ? `HT +${taux}% TVA` : 'HT'
  return taux > 0 ? `TTC (${taux}%)` : 'TTC'
}

// votes: [{ vote: 'pour'|'contre'|'abstention' }]
// activeCount: nombre de membres actifs à la date (dénominateur du quorum).
// presidentVote: vote du président ('pour'|'contre'|'abstention'|null) — ne sert
//   qu'à départager un partage des voix (art. 15).
// `opts.engagementApprouve` (défaut true) : pour une décision qui engage un
// montant, l'adoption exige EN PLUS de la majorité qu'au moins le trésorier ou le
// président ait voté POUR (cf. engagementApprouve, point 3). Passé false, la
// décision ne peut pas être adoptée même à la majorité. tally reste générique :
// c'est l'appelant qui calcule cette condition (il connaît les rôles).
export function tally(votes, activeCount, presidentVote = null, opts = {}) {
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
  // Adoption « ordinaire » (art. 15), avant la garde d'engagement.
  const adopteeMajorite = quorumAtteint && (majorite || (partage && presidentVote === 'pour'))
  // Garde d'engagement : un engagement financier non approuvé par le bureau n'est
  // pas adopté, même à la majorité.
  const engagementApprouve = opts.engagementApprouve !== false
  const adoptee = adopteeMajorite && engagementApprouve

  return {
    counts,
    activeCount: denomActive,
    votants: presents,
    absents: Math.max(0, denomActive - presents),
    quorumAtteint,
    majorite,
    partage,
    presidentVote,
    // Vrai si la majorité (art. 15) est acquise mais l'adoption est BLOQUÉE par la
    // seule garde d'engagement — sert à l'expliquer à l'écran.
    bloqueParEngagement: adopteeMajorite && !engagementApprouve,
    // Statut projeté si on enregistrait maintenant (valable seulement si quorum).
    statut: adoptee ? 'adoptee' : 'rejetee',
    adoptee,
  }
}

// Résumé humain, ex : "Pour 3 / Contre 1 / Abst. 1".
export function tallySummary(counts) {
  return `Pour ${counts.pour} / Contre ${counts.contre} / Abst. ${counts.abstention}`
}

// Point 3 — une décision qui ENGAGE un montant n'est ADOPTÉE que si, EN PLUS de la
// majorité (art. 15), AU MOINS le trésorier OU le président a voté POUR.
//
// ⚠ Un VETO (les DEUX doivent voter pour) a été écarté par Pascal : contraire à
// l'art. 15, qui fait décider la majorité des présents — donner à un membre le
// pouvoir de bloquer seul serait non conforme. « Au moins l'un des deux » est une
// garde interne plus stricte que l'art. 15, comme le quorum, mais sans veto.
//
// « Financière » = montant_engage renseigné, UNIQUEMENT (« le trésorier ne
// s'occupe que de l'argent »). Suspendre/clôturer sans montant n'y est pas soumis.
//
// Renvoie true si la garde est satisfaite (ou ne s'applique pas). Un rôle non
// désigné (pas de trésorier) est simplement absent du OU — si aucun des deux
// n'existe, la garde ne peut être satisfaite, mais il y a toujours un président.
export function engagementApprouve(decision, votes, composition = []) {
  if (decision?.montant_engage == null || decision.montant_engage === '') return true
  const voteOf = (role) => {
    const m = composition.find((x) => x.role === role)
    return m ? (votes || []).find((v) => v.membre_id === m.id)?.vote ?? null : null
  }
  return voteOf('president') === 'pour' || voteOf('tresorier') === 'pour'
}

// Numéro AFFICHABLE. Un brouillon n'a pas encore de numéro (migration 034) : il
// n'en reçoit un qu'à la soumission au vote, pour qu'un brouillon abandonné ne
// laisse aucun trou dans le registre. Passer TOUJOURS par ici — un `d.numero`
// brut afficherait « null » sur un brouillon.
export function numeroDecision(decision) {
  return decision?.numero || 'sans numéro'
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
