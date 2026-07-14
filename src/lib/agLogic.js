// Pure domain logic for AG (Assemblée Générale) resolutions.
// ASL rules (ordonnance 2004-632 + statuts type) — the majority required
// depends on the nature of the resolution:
//   - 'simple'            : majorité des voix exprimées des présents/représentés
//   - 'double_qualifiee'  : 2/3 des propriétaires ET 2/3 des superficies
//                           (double majorité qualifiée — modifications statutaires,
//                            travaux importants…)
//   - 'unanimite'         : unanimité des présents/représentés
//
// A resolution stores raw tallies (votes_pour/contre/abstention/absents) plus
// superficie_pour. The AG carries the totals (nombre_total colotis,
// superficie totale) used as denominators.

export const MAJORITE_LABELS = {
  simple: 'Majorité simple',
  double_qualifiee: 'Double majorité qualifiée (2/3 + 2/3)',
  unanimite: 'Unanimité',
}

export const RESOLUTION_STATUT_LABELS = {
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
  retiree: 'Retirée',
}

export const BUDGET_STATUT_LABELS = {
  vote: 'Voté',
  appele: 'Appelé',
  encaisse: 'Encaissé',
  solde: 'Soldé',
}

export const CLE_REPARTITION_LABELS = {
  superficie: 'Superficie',
  facade: 'Façade',
  egal: 'Égalitaire',
}

// Evaluate whether a resolution is adopted given its required majority.
// resolution: { votes_pour, votes_contre, votes_abstention, votes_absents,
//               superficie_pour, majorite_requise }
// ag: { nombre_total, superficie_representee } — denominators.
export function evaluateResolution(resolution, ag) {
  const pour = resolution.votes_pour || 0
  const contre = resolution.votes_contre || 0
  const abstention = resolution.votes_abstention || 0
  const absents = resolution.votes_absents || 0
  const superficiePour = Number(resolution.superficie_pour) || 0

  const exprimes = pour + contre
  const votants = pour + contre + abstention
  const totalColotis = ag?.nombre_total || pour + contre + abstention + absents
  const superficieTotale = Number(ag?.superficie_representee) || 0

  const result = {
    exprimes,
    votants,
    totalColotis,
    superficieTotale,
    superficiePour,
    // ratios utiles pour l'affichage
    ratioProprietaires: totalColotis > 0 ? pour / totalColotis : 0,
    ratioSuperficie: superficieTotale > 0 ? superficiePour / superficieTotale : 0,
    adoptee: false,
    detail: '',
  }

  switch (resolution.majorite_requise) {
    case 'unanimite': {
      // Unanimité des exprimés : aucun contre, au moins un pour.
      result.adoptee = pour > 0 && contre === 0 && abstention === 0
      result.detail = result.adoptee
        ? 'Unanimité atteinte'
        : 'Unanimité non atteinte'
      break
    }
    case 'double_qualifiee': {
      // 2/3 des propriétaires ET 2/3 des superficies représentées.
      const okProp = totalColotis > 0 && pour * 3 >= totalColotis * 2
      const okSurf = superficieTotale > 0 && superficiePour * 3 >= superficieTotale * 2
      result.adoptee = okProp && okSurf
      result.okProprietaires = okProp
      result.okSuperficie = okSurf
      result.detail = `Propriétaires ${okProp ? '≥' : '<'} 2/3 · Superficie ${okSurf ? '≥' : '<'} 2/3`
      break
    }
    case 'simple':
    default: {
      result.adoptee = pour > contre
      result.detail = `Voix exprimées : ${pour} pour / ${contre} contre`
      break
    }
  }

  result.statut = result.adoptee ? 'adoptee' : 'rejetee'
  return result
}

// Next resolution order number within an AG.
export function nextResolutionNumero(resolutions) {
  let max = 0
  for (const r of resolutions) if (r.numero > max) max = r.numero
  return max + 1
}

// AG quorum: (présents + représentés) — informational; ASL statutes vary.
// We compute a simple ">50% des colotis" indicator.
export function agQuorum(ag) {
  const present = (ag.nombre_presents || 0) + (ag.nombre_representes || 0)
  const total = ag.nombre_total || 0
  return {
    present,
    total,
    atteint: total > 0 && present * 2 > total,
  }
}
