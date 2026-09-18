// Domain constants for AG (Assemblée Générale) résolutions.
// Révisé 2026-07-14 : les votes AG sont au prorata des superficies et le détail
// des voix reste dans le PV. L'app ne stocke que le RÉSULTAT (majorité requise
// + adoptée/rejetée) et le budget alloué. Pas de comptage de voix ici.

import { todayISO } from './format'

// Cycle de vie d'une AG (migration 023). Stockés : preparation / convoquee /
// cloturee / annulee. « AG a eu lieu » (tenue) est DÉRIVÉ de la date passée —
// jamais stocké. Statuts EDITABLES dans le formulaire : preparation, convoquee,
// annulee (la clôture est une action dédiée sur la fiche).
export const AG_STATUT_EDITABLES = ['preparation', 'convoquee', 'annulee']
export const AG_STATUT_LABELS = {
  preparation: 'En préparation',
  convoquee: 'Convocations envoyées',
  tenue: 'AG a eu lieu',
  // PV envoyé (migration 055) : le délai de contestation court.
  pv_envoye: 'PV envoyé — délai de contestation en cours',
  // Clôturée DE PLEIN DROIT : dérivée, jamais stockée. Distincte de la clôture
  // manuelle — on doit pouvoir lire d'où vient la fermeture.
  cloturee_de_plein_droit: 'Clôturée de plein droit',
  contestee: 'PV contesté',
  cloturee: 'Clôturée',
  annulee: 'Annulée',
}
export const AG_STATUT_TONES = {
  preparation: 'gray',
  convoquee: 'blue',
  tenue: 'amber',
  pv_envoye: 'blue',
  cloturee_de_plein_droit: 'green',
  contestee: 'red',
  cloturee: 'green',
  annulee: 'red',
}

// Délai de contestation, en mois. ⚠ 12 est la valeur donnée par Pascal
// (2026-09-18) et vit dans `parametres` : les statuts sont en cours de révision
// et ce délai est exactement le genre de chiffre qu'ils peuvent fixer autrement.
export const DELAI_CONTESTATION_DEFAUT = 12

// Échéance du délai de contestation : date d'envoi du PV + N mois.
// ⚠ C'est la date d'ENVOI qui fait courir le délai, pas celle de la séance.
export function echeanceContestation(ag, delaiMois) {
  if (!ag?.date_envoi_pv) return null
  const mois = Number(delaiMois) || DELAI_CONTESTATION_DEFAUT
  const d = new Date(`${ag.date_envoi_pv}T12:00:00`)
  d.setMonth(d.getMonth() + mois)
  return d.toISOString().slice(0, 10)
}

// L'assemblée est-elle close DE PLEIN DROIT ? PV envoyé, délai expiré, aucune
// contestation inscrite.
//
// ⚠ DÉRIVÉ, JAMAIS ÉCRIT. Une date d'envoi corrigée doit corriger la clôture, et
// une contestation inscrite après coup doit la rouvrir — ce qu'un statut écrit
// aurait figé à l'envers. Rien ne s'écrit ici : c'est le temps qui passe.
export function closeDePleinDroit(ag, delaiMois) {
  if (ag?.statut !== 'pv_envoye') return false
  if (ag.contestation_le) return false
  const echeance = echeanceContestation(ag, delaiMois)
  return Boolean(echeance) && echeance <= todayISO()
}

// Statut AFFICHÉ : dérive « tenue » (AG a eu lieu) de la date passée. Une AG
// clôturée ou annulée garde son statut ; sinon, si la date est aujourd'hui ou
// passée, elle « a eu lieu » ; sinon on affiche le statut stocké (prep/convoquee).
export function effectiveAGStatut(ag, delaiMois) {
  if (ag.statut === 'cloturee' || ag.statut === 'annulee') return ag.statut
  // ⚠ L'ORDRE COMPTE. Une contestation prime sur l'expiration du délai : c'est
  // elle qui empêche la clôture, et l'afficher d'abord évite de montrer une
  // assemblée « close » que quelqu'un conteste.
  if (ag.statut === 'pv_envoye') {
    if (ag.contestation_le) return 'contestee'
    if (closeDePleinDroit(ag, delaiMois)) return 'cloturee_de_plein_droit'
    return 'pv_envoye'
  }
  if (ag.date_ag && ag.date_ag <= todayISO()) return 'tenue'
  return ag.statut
}

// FIGÉE : plus aucune modification de l'AG ni de ses résolutions.
// ⚠ La clôture de plein droit fige AUTANT que la clôture manuelle — c'est tout
// son objet : passé le délai, le procès-verbal est définitif. Une AG contestée,
// elle, reste modifiable : l'affaire n'est pas vidée.
export function agFigee(ag, delaiMois) {
  const eff = effectiveAGStatut(ag, delaiMois)
  return eff === 'cloturee' || eff === 'annulee' || eff === 'cloturee_de_plein_droit'
}

// L'AG a eu lieu (date passée) et n'est ni clôturée ni annulée : c'est le seul
// moment où l'on saisit les données a posteriori (heure de fin, quorum, m²) et
// où l'on peut clôturer.
export function agAEuLieu(ag) {
  return ag.statut !== 'cloturee' && ag.statut !== 'annulee' && Boolean(ag.date_ag) && ag.date_ag <= todayISO()
}

// ============================================================================
// m² : PARTICIPATION D'UNE SÉANCE ET RÉPARTITION D'UN VOTE (migration 054)
// ============================================================================
// L'AG vote au prorata des superficies. L'application peut désormais recevoir les
// m² présents et les m² pour/contre/abstention, et en afficher les pourcentages.
//
// ⚠ ELLE ENREGISTRE, ELLE NE DÉCIDE PAS. Le `statut` d'une résolution reste posé à
// la main, et `majorite_requise` reste un libellé qu'aucune logique n'applique.
// Rien ici ne calcule une adoption. Les règles de majorité d'une AG ne se ramènent
// pas toutes au même dénominateur, et les statuts sont EN COURS DE RÉVISION :
// coder aujourd'hui une majorité qu'on n'a pas lue, ce serait coder une règle
// fausse dans un registre légal. Le décompte fait foi au PV.

// Total des m² retenu pour UNE assemblée donnée.
//
// ⚠ C'EST LE TOTAL FIGÉ SUR LA LIGNE, pas le paramètre courant. Le jour où des
// colotis sortent et où le total change, les assemblées déjà tenues doivent garder
// leur taux — « il ne faut pas que ça change les % de participation » (Pascal,
// 2026-09-16). Le paramètre ne sert qu'à PRÉ-REMPLIR une AG qui n'a pas encore le
// sien. Même patron que `composition_snapshot` sur une décision.
export function totalM2AG(ag, parametreCourant) {
  const fige = Number(ag?.m2_total)
  if (Number.isFinite(fige) && fige > 0) return fige
  const courant = Number(parametreCourant)
  return Number.isFinite(courant) && courant > 0 ? courant : null
}

// Taux de participation d'une séance, en %. Null si l'un des deux manque — on
// n'invente pas un dénominateur.
export function tauxParticipation(ag, parametreCourant) {
  const total = totalM2AG(ag, parametreCourant)
  const presents = Number(ag?.m2_presents)
  if (!total || !Number.isFinite(presents)) return null
  return (presents / total) * 100
}

// DÉNOMINATEUR D'UNE RÉSOLUTION — sur quoi se calculent ses pourcentages.
//
// ⚠ IL DÉPEND DE LA MAJORITÉ REQUISE, et c'est tout l'intérêt de la fonction :
// « pour les résolutions à la majorité simple, le total de m² est le total présent
// et représenté » (Pascal, 2026-09-16). Rapporter une majorité simple au total du
// lotissement donnerait un pourcentage juste en arithmétique et faux en droit.
//
// RÈGLE (Pascal, 2026-09-16) :
//   - SIMPLE                     → m² présents ou représentés ;
//   - ABSOLUE                    → total des m² du lotissement ;
//   - DOUBLE MAJORITÉ QUALIFIÉE  → total des m² du lotissement ;
//   - UNANIMITÉ                  → total des m² du lotissement.
//
// ⚠ L'UNANIMITÉ SE MESURE SUR TOUS LES COLOTIS, PAS SUR LES PRÉSENTS. Règle
// donnée par Pascal, mot pour mot : « l'unanimité, tous les colotis approuvent ;
// si 1 dit non, ou s'abstient, ou ne participe pas, ce n'est pas approuvé ».
// L'ABSENCE FAIT DONC OBSTACLE À L'UNANIMITÉ, au même titre qu'un vote contre.
//
// ⚠ NE PAS « CORRIGER » EN RAPPORTANT L'UNANIMITÉ AUX PRÉSENTS. Cette erreur a été
// commise et livrée le 2026-09-16, sur le raisonnement — faux — qu'une résolution
// unanime devait afficher 100 %. Conséquence : une résolution approuvée par tous
// les présents d'une séance réunissant 54,7 % des m² affichait « 100 % », donc une
// unanimité que 45 % des colotis n'avaient jamais donnée. Dans un registre légal,
// c'est exactement l'inverse de ce qu'il faut montrer : rapporté au total, le
// pourcentage RÉVÈLE que l'unanimité n'est pas atteinte.
//
// L'écran AFFICHE toujours le dénominateur employé, en toutes lettres : personne
// ne doit avoir à deviner sur quoi porte un pourcentage, et si la règle est un
// jour fixée autrement par les nouveaux statuts, l'écart se verra tout de suite.
//
// Renvoie { base, libelle } — `base` nulle quand la donnée manque : on n'invente
// pas un dénominateur.
export function denominateurResolution(resolution, ag, parametreCourant) {
  if (resolution?.majorite_requise === 'simple') {
    const presents = Number(ag?.m2_presents)
    return {
      base: Number.isFinite(presents) && presents > 0 ? presents : null,
      libelle: 'des m² présents ou représentés',
    }
  }
  return {
    base: totalM2AG(ag, parametreCourant),
    libelle: 'du total des m² du lotissement',
  }
}

// Répartition d'un vote de résolution, rapportée au bon dénominateur.
// Renvoie null si AUCUN des trois m² n'est renseigné — le cas normal des
// résolutions dont le PV ne donne pas le détail.
//
// ⚠ Un champ vide compte pour ZÉRO dès lors qu'un autre est rempli : une
// résolution avec 8 000 m² pour et rien d'autre a bien 8 000 m² exprimés. Mais
// tant que les trois sont vides, il n'y a pas de vote saisi, et afficher « 0 % »
// laisserait croire à une unanimité contre.
//
// ⚠ LES TROIS POURCENTAGES NE FONT PAS FORCÉMENT 100 %, et c'est voulu : des m²
// présents peuvent n'avoir pris part à aucun vote sur cette résolution. Le reste
// est rendu explicitement (`nonExprime`), comme le registre des décisions montre
// les « non voté » du conseil. Masquer cet écart laisserait croire que tout le
// monde s'est prononcé.
export function repartitionVote(resolution, ag, parametreCourant) {
  const lire = (v) => (v === null || v === undefined || v === '' ? null : Number(v))
  const pour = lire(resolution?.m2_pour)
  const contre = lire(resolution?.m2_contre)
  const abstention = lire(resolution?.m2_abstention)
  if (pour === null && contre === null && abstention === null) return null
  const p = pour || 0
  const c = contre || 0
  const a = abstention || 0
  const exprimes = p + c + a
  const { base, libelle } = denominateurResolution(resolution, ag, parametreCourant)
  // Sans dénominateur connu, on rend les m² sans pourcentage : un chiffre brut
  // reste vrai, un pourcentage sans base serait faux.
  const part = (x) => (base ? (x / base) * 100 : null)
  return {
    pour: p, contre: c, abstention: a, exprimes,
    base, libelle,
    pourPct: part(p),
    contrePct: part(c),
    abstentionPct: part(a),
    nonExprime: base ? Math.max(0, base - exprimes) : null,
  }
}

// ⚠ INCOHÉRENCE À SIGNALER, pas à corriger : des m² exprimés supérieurs aux m²
// présents est forcément une erreur de saisie (on ne vote pas plus de surface
// qu'il n'y en a dans la salle). L'écran le dit ; il ne rectifie rien tout seul,
// c'est le PV qui tranche.
export function voteIncoherent(resolution, ag, parametreCourant) {
  const r = repartitionVote(resolution, ag, parametreCourant)
  const presents = Number(ag?.m2_presents)
  if (!r || !Number.isFinite(presents) || presents <= 0) return false
  // Tolérance d'un m² : les PV arrondissent.
  return r.exprimes > presents + 1
}

// Formatage d'un pourcentage, une décimale, virgule française.
export function pct(valeur) {
  if (valeur === null || valeur === undefined || !Number.isFinite(valeur)) return '—'
  return `${valeur.toFixed(1).replace('.', ',')} %`
}

// Résultat de quorum de la séance, saisi a posteriori. Le vote est au prorata des
// superficies : on stocke le total des m² présents/représentés, le détail au PV.
export const AG_QUORUM_VALUES = ['quorum_atteint', 'sans_quorum_accepte', 'sans_quorum_rejete']
export const AG_QUORUM_LABELS = {
  quorum_atteint: 'Quorum atteint',
  sans_quorum_accepte: 'Vote sans quorum accepté',
  sans_quorum_rejete: 'Vote sans quorum rejeté',
}
export const AG_QUORUM_TONES = {
  quorum_atteint: 'green',
  sans_quorum_accepte: 'amber',
  sans_quorum_rejete: 'red',
}

export const MAJORITE_VALUES = ['simple', 'absolue', 'double_qualifiee', 'unanimite']

export const MAJORITE_LABELS = {
  simple: 'Majorité simple',
  absolue: 'Majorité absolue',
  double_qualifiee: 'Double majorité qualifiée',
  unanimite: 'Unanimité',
}

// Cycle de vie d'une résolution : inscrite à l'ordre du jour d'une AG à venir
// (`a_voter`), puis résultat du vote une fois l'AG tenue.
// `a_voter` est l'état de DÉPART : quand on planifie une AG, rien n'est encore voté.
// Conséquence portée par computeAGBudgets : seule une résolution ADOPTÉE alloue un
// budget. Une résolution à voter, rejetée ou retirée n'alloue rien et ne peut donc
// ni recevoir d'engagement, ni ouvrir de projet.
export const RESOLUTION_STATUT_VALUES = ['a_voter', 'adoptee', 'rejetee', 'sans_vote', 'retiree']

export const RESOLUTION_STATUT_LABELS = {
  a_voter: 'À voter',
  adoptee: 'Adoptée',
  rejetee: 'Rejetée',
  // Présentée mais non soumise au vote (reportée, consensus sans scrutin…).
  // N'alloue aucun budget, comme rejetée/retirée.
  sans_vote: 'Sans vote',
  retiree: 'Retirée',
}

// ---------------------------------------------------- numérotation des résolutions
//
// Le numéro reprend celui de la CONVOCATION, il se saisit donc à la main. Or
// `unique (ag_id, numero)` rend toute renumérotation pénible : pour donner le
// n° 3 à une résolution, il faut d'abord libérer le 3, donc renuméroter l'autre,
// qui butera peut-être à son tour. Un blocage en chaîne pour une simple frappe.
//
// D'où une ZONE DE GARAGE au-dessus de 100 : quand on impose un numéro déjà pris,
// l'occupante est déplacée au premier numéro libre à partir de 101. Elle n'est
// pas perdue — elle passe en fin de liste, visiblement anormale, avec une mention
// « à renuméroter » à l'écran. On débloque la saisie, on ne masque rien.
//
// ⚠ Choix retenu contre l'ÉCHANGE de numéros (l'occupante prendrait l'ancien
// numéro de l'autre) : l'échange donne silencieusement à l'occupante un numéro
// qui a l'air normal mais qui est probablement faux lui aussi, alors que 101
// signale qu'il reste quelque chose à faire.
export const NUMERO_GARAGE = 101

// Numéro par défaut d'une NOUVELLE résolution : max + 1 en IGNORANT la zone de
// garage. Sans ce filtre, une résolution garée au 101 ferait proposer 102 à la
// suivante — la numérotation réelle partirait à la dérive.
export function nextResolutionNumero(resolutions) {
  let max = 0
  for (const r of resolutions) {
    if (r.numero < NUMERO_GARAGE && r.numero > max) max = r.numero
  }
  return max + 1
}

// ------------------------------------------------- sous-numérotation (032)
//
// Une résolution du PV peut donner PLUSIEURS lignes dans l'app : `resolutions_ag`
// ne porte qu'un `projet_id`, donc ventiler un budget voté sur trois projets
// impose trois lignes, là où le PV n'en connaît qu'une. D'où « 10-1 / 10-2 /
// 10-3 » — le numéro du PV, plus un rang.
//
// Stocké en DEUX entiers (`numero`, `sous_numero`) et non en texte : « 10-1 »
// en texte se rangerait avant « 2 » en ordre lexicographique. `sous_numero = 0`
// signifie « pas de sous-numérotation », le cas normal.
export function numeroResolution(r) {
  return r?.sous_numero ? `${r.numero}-${r.sous_numero}` : `${r?.numero ?? ''}`
}

// « 10 » ou « 10-1 » → { numero, sous_numero }. `null` si la saisie ne suit pas
// la forme : on refuse plutôt que de deviner, un numéro de PV ne s'invente pas.
export function parseNumeroResolution(saisie) {
  const m = String(saisie ?? '').trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
  if (!m) return null
  const numero = Number(m[1])
  const sous = m[2] === undefined ? 0 : Number(m[2])
  if (numero < 1 || sous < 0) return null
  return { numero, sous_numero: sous }
}

// Tri des résolutions : numéro, puis rang. 10 vient avant 10-1, qui vient avant
// 10-2, puis 11. Partagé par les DEUX backends — sans quoi ils divergeraient,
// comme cela s'est déjà produit pour les projets.
export function compareResolutions(a, b) {
  if (a.numero !== b.numero) return a.numero - b.numero
  return (a.sous_numero || 0) - (b.sous_numero || 0)
}

// Premier numéro libre dans la zone de garage, pour y déplacer une occupante.
// La garée repart en résolution SIMPLE (sous-numéro 0) : elle a perdu sa place,
// pas seulement son rang.
export function numeroGarageLibre(resolutions) {
  const pris = new Set(resolutions.filter((r) => !r.sous_numero).map((r) => r.numero))
  let n = NUMERO_GARAGE
  while (pris.has(n)) n += 1
  return n
}

// Une résolution garée attend d'être renumérotée : l'écran doit le dire.
export function estGaree(numero) {
  return numero >= NUMERO_GARAGE
}
