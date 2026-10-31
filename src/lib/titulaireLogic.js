// ============================================================================
// LES TITULAIRES D'UN LOT (migration 068) — rôles, destinataires, contrôles
//
// Une ligne par PERSONNE, rattachée à une période de propriété. C'est ce qui
// permet au registre de dire ce que les statuts du 15 septembre 2026 exigent :
// une indivision de trois personnes (art. 6), l'usufruitier seul membre qui
// informe le nu-propriétaire (art. 6), une adresse par personne (art. 28 —
// élection de domicile « en leur demeure respective »), et le représentant
// désigné d'une indivision avec la pièce qui le désigne.
//
// ⚠ CE MODULE NE PÈSE AUCUNE VOIX. Les voix suivent `lots.superficie`
// (art. 9), et les m² de chaque AG sont saisis puis figés sur elle (054).
// `est_membre_votant` dit QUI porte la voix du lot, jamais combien elle pèse.
//
// ⚠ ET IL NE DIT PAS LE MOYEN DE NOTIFICATION. L'art. 13 fait dépendre le pli
// simple ou le recommandé de la façon dont la personne a voté à CETTE
// assemblée — une donnée que l'application ne détient pas.
// `destinataire_notification_pv` dit QUI doit être notifié, pas comment.
// ============================================================================

export const ROLE_PLEIN = 'plein_proprietaire'
export const ROLE_INDIVISAIRE = 'indivisaire'
export const ROLE_CO = 'co_proprietaire'
export const ROLE_USUFRUITIER = 'usufruitier'
export const ROLE_NU = 'nu_proprietaire'
export const ROLE_REPRESENTANT = 'representant_legal'
export const ROLE_MANDATAIRE = 'mandataire'

export const ROLES = [
  ROLE_PLEIN, ROLE_INDIVISAIRE, ROLE_CO, ROLE_USUFRUITIER,
  ROLE_NU, ROLE_REPRESENTANT, ROLE_MANDATAIRE,
]

export const ROLE_LABELS = {
  [ROLE_PLEIN]: 'Plein propriétaire',
  [ROLE_INDIVISAIRE]: 'Indivisaire',
  [ROLE_CO]: 'Co-propriétaire',
  [ROLE_USUFRUITIER]: 'Usufruitier',
  [ROLE_NU]: 'Nu-propriétaire',
  [ROLE_REPRESENTANT]: 'Représentant légal',
  [ROLE_MANDATAIRE]: 'Mandataire',
}

// Ce que chaque rôle veut dire, affiché à la saisie. ⚠ Deux de ces phrases
// existent pour empêcher une faute de qualification, pas pour décorer :
// « co-propriétaire » n'est pas un indivisaire (040), et le mandataire de la
// 037 n'est pas le porteur de pouvoir de l'art. 6.
export const ROLE_AIDES = {
  [ROLE_PLEIN]: 'Seul propriétaire. Pour une société, la ligne qui porte la raison sociale et l’adresse du siège.',
  [ROLE_INDIVISAIRE]: 'Membre d’une indivision — à choisir seulement quand l’indivision est établie.',
  [ROLE_CO]: 'Détient avec une autre personne, sans que la forme soit connue : communauté entre époux, séparation de biens, tontine. Le registre constate, il ne qualifie pas à la place du notaire.',
  [ROLE_USUFRUITIER]: 'Prend seul la qualité de membre de l’association, et doit informer le nu-propriétaire (art. 6).',
  [ROLE_NU]: 'Informé par l’usufruitier. Ne vote pas.',
  [ROLE_REPRESENTANT]: 'Dirigeant de la société propriétaire : il l’engage, donc il la représente en assemblée (art. 6).',
  [ROLE_MANDATAIRE]: 'Intermédiaire à qui l’on écrit quand on n’atteint pas le propriétaire. ⚠ Ce n’est PAS un porteur de pouvoir d’assemblée : il ne vote jamais.',
}

export const ROLE_TONES = {
  [ROLE_PLEIN]: 'navy',
  [ROLE_INDIVISAIRE]: 'navy',
  [ROLE_CO]: 'navy',
  [ROLE_USUFRUITIER]: 'green',
  [ROLE_NU]: 'gray',
  [ROLE_REPRESENTANT]: 'blue',
  [ROLE_MANDATAIRE]: 'gray',
}

// Ceux qui DÉTIENNENT un droit sur le lot. ⚠ Le nu-propriétaire en détient un
// aussi, mais il ne vote pas : il est donc hors de cette liste, qui sert à
// repérer « qui porte la voix », et traité à part là où il faut le joindre.
export const ROLES_DETENTEURS = [ROLE_PLEIN, ROLE_INDIVISAIRE, ROLE_CO, ROLE_USUFRUITIER]

// Ceux à qui la base interdit de voter (contrainte `titulaires_votant_interdit`).
// ⚠ Dupliqué de la migration 068 : modifier l'un oblige à modifier l'autre.
// L'écran doit refuser AVANT la base, le message de Postgres étant illisible.
export const ROLES_SANS_VOTE = [ROLE_NU, ROLE_REPRESENTANT, ROLE_MANDATAIRE]

// ⚠ LE REPRÉSENTANT DÉSIGNÉ N'EXISTE QUE POUR UNE INDIVISION (correction de
// Pascal, 22 octobre). L'art. 6 ne le prévoit que là : « Au cas où un des lots
// est la propriété indivise de plusieurs personnes, les indivisaires ne peuvent
// se faire représenter que par l'un d'eux. » Deux époux qui détiennent ensemble
// sans indivision ne doivent rien désigner — le leur réclamer prêterait aux
// statuts une obligation qu'ils ne portent pas, et c'est exactement ce qu'un
// registre légal ne doit pas faire. Sur 17 lots détenus à deux, 4 seulement sont
// des indivisions déclarées.
//
// ⚠ Et c'est bien la DÉTENTION qui est en cause, pas le vote : la voix du lot
// est unique (art. 9), donc un couple a toujours un membre votant. Ce qu'il n'a
// pas, c'est un représentant au sens de l'art. 6.
export const ROLES_REPRESENTABLES = [ROLE_INDIVISAIRE]

export const LIGNE_VIDE = {
  role: ROLE_PLEIN,
  est_personne_morale: false,
  civilite: '',
  nom: '',
  prenom: '',
  fonction: '',
  quote_part: '',
  adresse_postale: '',
  pays: '',
  adresse_a_verifier: false,
  email: '',
  telephone: '',
  langue: '',
  refus_electronique: false,
  est_membre_votant: false,
  est_representant_designe: false,
  destinataire_convocations: true,
  destinataire_notification_pv: true,
  date_debut: '',
  date_fin: '',
  observations: '',
}

// ⚠ `null` de la base contre chaîne vide du formulaire : `{ ...LIGNE_VIDE,
// ...ligne }` ne suffit PAS, puisque `null` écrase la valeur vide du modèle
// (seul `undefined` laisse celle de gauche) et qu'un `.trim()` planterait
// ensuite. Même piège que `sansNull` dans `Membres.jsx` — et on traite TOUS les
// champs d'un coup, parce que les traiter un à un est ce qui avait produit le bug.
export function versFormulaire(t) {
  const out = { ...LIGNE_VIDE, id: t.id, designation_documents: t.designation_documents || [] }
  for (const champ of Object.keys(LIGNE_VIDE)) {
    const v = t[champ]
    out[champ] = v === null || v === undefined ? LIGNE_VIDE[champ] : v
  }
  return out
}

// …et l'inverse : une chaîne vide repart en `null`, pour que la base ne
// conserve pas des champs « renseignés mais vides » que les contrôles
// compteraient comme présents.
//
// ⚠ IL FAUT PASSER PAR ICI, ET PAS SEULEMENT PAR PROPRETÉ. `date_debut` et
// `date_fin` sont des colonnes `date` : une chaîne vide y fait échouer
// l'insertion entière (22007), et c'est tout l'enregistrement d'une mutation
// qui tombe. Le mock, lui, l'avalerait — le défaut ne se verrait qu'en
// production. C'est pourquoi la fonction vit ici et non dans un écran : la
// fiche du lot ET l'assistant de mutation écrivent dans la même table.
export function versPayload(f) {
  const out = {}
  for (const champ of Object.keys(LIGNE_VIDE)) {
    const v = f[champ]
    out[champ] = typeof v === 'string' ? (v.trim() || null) : v
  }
  out.designation_documents = f.designation_documents || []
  return out
}

// L'ordre dans lequel les titulaires se lisent, PARTAGÉ PAR LES DEUX BACKENDS
// (comme `compareResolutions` l'est pour les résolutions) : les détenteurs
// d'abord, puis ceux qui représentent ou relaient, et les clos en dernier. Le
// dupliquer ferait qu'une fiche se lirait dans un ordre en démo et dans un
// autre en production.
const RANG_ROLE = {
  [ROLE_PLEIN]: 0,
  [ROLE_INDIVISAIRE]: 1,
  [ROLE_CO]: 1,
  [ROLE_USUFRUITIER]: 2,
  [ROLE_NU]: 3,
  [ROLE_REPRESENTANT]: 4,
  [ROLE_MANDATAIRE]: 5,
}

export function compareTitulaires(a, b) {
  // Les titulaires CLOS passent après, quel que soit leur rôle : la fiche
  // montre d'abord qui détient aujourd'hui.
  const closA = a.date_fin ? 1 : 0
  const closB = b.date_fin ? 1 : 0
  if (closA !== closB) return closA - closB
  const ra = RANG_ROLE[a.role] ?? 9
  const rb = RANG_ROLE[b.role] ?? 9
  if (ra !== rb) return ra - rb
  // Le membre votant en tête de son rang : c'est lui qu'on cherche.
  if (Boolean(a.est_membre_votant) !== Boolean(b.est_membre_votant)) {
    return a.est_membre_votant ? -1 : 1
  }
  return (a.nom || '').localeCompare(b.nom || '', 'fr')
}

/** Les titulaires en cours : `date_fin` nulle. Les autres sont l'historique. */
export function actifs(titulaires) {
  return (titulaires || []).filter((t) => !t.date_fin)
}

export function clos(titulaires) {
  return (titulaires || []).filter((t) => t.date_fin)
}

export function membreVotant(titulaires) {
  return actifs(titulaires).find((t) => t.est_membre_votant) || null
}

export function representantDesigne(titulaires) {
  return actifs(titulaires).find((t) => t.est_representant_designe) || null
}

export function detenteurs(titulaires) {
  return actifs(titulaires).filter((t) => ROLES_DETENTEURS.includes(t.role))
}

/** Nom affichable, civilité et prénom compris. */
export function nomComplet(t) {
  return [t?.civilite, t?.prenom, t?.nom].map((x) => (x || '').trim()).filter(Boolean).join(' ')
}

/**
 * Joignable, c'est-à-dire qu'un envoi vers cette personne est possible.
 * ⚠ Le téléphone n'en fait pas partie : une convocation et une notification de
 * PV s'adressent par écrit (art. 8 et 13). Un numéro sert à rappeler quelqu'un,
 * pas à le convoquer.
 */
export function joignable(t) {
  return Boolean((t?.email || '').trim() || (t?.adresse_postale || '').trim())
}

/**
 * Les destinataires d'un envoi, calculés sur les titulaires.
 *
 * ⚠ `refus_electronique` SORT la personne de l'envoi électronique sans la
 * retirer des destinataires : elle passe dans la liste postale. Un coloti qui
 * a demandé le courrier (art. 8 et 13) ne doit ni recevoir un e-mail, ni
 * disparaître des convocations.
 */
export function destinatairesElectroniques(titulaires, { pv = false } = {}) {
  return actifs(titulaires).filter((t) =>
    (pv ? t.destinataire_notification_pv : t.destinataire_convocations)
    && !t.refus_electronique
    && (t.email || '').trim(),
  )
}

/** Ceux qu'il faut servir par la poste : refus exprès, ou pas d'adresse e-mail. */
export function destinatairesPostaux(titulaires, { pv = false } = {}) {
  return actifs(titulaires).filter((t) =>
    (pv ? t.destinataire_notification_pv : t.destinataire_convocations)
    && (t.refus_electronique || !(t.email || '').trim())
    && (t.adresse_postale || '').trim(),
  )
}

// ============================================================================
// LES CINQ CONTRÔLES — des AVERTISSEMENTS, jamais des refus
//
// ⚠ La base n'empêche rien de tout cela, et c'est voulu : un registre doit
// pouvoir décrire une situation imparfaite, sinon on le remplit de faux pour
// le satisfaire. Même doctrine que `divergences()` dans `mandatLogic.js` — on
// signale, on ne corrige pas.
//
// ⚠ ET CHACUN SE MESURE À LA BONNE MAILLE. Le premier jet du script de reprise
// criait « injoignable » sur chaque second dirigeant sans e-mail et produisait
// douze fausses alertes — l'erreur qu'`export_md.mjs` avait déjà commise en
// déclarant injoignables douze sociétés dont on a le dirigeant. Un DÉTENTEUR
// doit être joignable personnellement (art. 13, 21, 28) ; un REPRÉSENTANT
// n'est qu'une voie vers la société, et l'art. 6 n'en exige qu'une.
// ============================================================================

export function controles(titulaires) {
  const liste = actifs(titulaires)
  const out = []
  if (!liste.length) {
    out.push({ gravite: 'manque', texte: 'Aucun titulaire : le registre ne sait pas à qui appartient ce lot.' })
    return out
  }

  const votants = liste.filter((t) => t.est_membre_votant)

  // 1. INDIVISION sans représentant désigné (art. 6).
  //    ⚠ `indivisaire` SEULEMENT, pas `co_proprietaire` : l'article ne vise que
  //    la propriété indivise. Appliqué à toute détention à deux, ce contrôle
  //    réclamait une désignation à treize couples qui n'en doivent aucune — un
  //    reproche sans fondement, et treize alertes qui noyaient les quatre vraies.
  const indivisaires = liste.filter((t) => t.role === ROLE_INDIVISAIRE)
  if (indivisaires.length > 1 && !liste.some((t) => t.est_representant_designe)) {
    out.push({
      gravite: 'statutaire',
      texte: `Indivision à ${indivisaires.length}, sans représentant désigné : les statuts veulent que les indivisaires se fassent représenter par l’un d’eux (art. 6).`,
    })
  }

  // 2. Démembrement sans nu-propriétaire. L'usufruitier doit l'informer des
  //    décisions (art. 6) — encore faut-il savoir qui c'est.
  if (liste.some((t) => t.role === ROLE_USUFRUITIER) && !liste.some((t) => t.role === ROLE_NU)) {
    out.push({
      gravite: 'statutaire',
      texte: 'Un usufruitier, aucun nu-propriétaire : l’usufruitier doit l’informer des décisions (art. 6), et le registre ne dit pas qui il est.',
    })
  }

  // 3. Un détenteur destinataire qu'on ne peut pas atteindre.
  for (const t of liste) {
    if (!ROLES_DETENTEURS.includes(t.role) && t.role !== ROLE_NU) continue
    if ((t.destinataire_convocations || t.destinataire_notification_pv) && !joignable(t)) {
      out.push({ gravite: 'manque', texte: `${nomComplet(t)} est destinataire sans e-mail ni adresse postale.` })
    }
  }

  // …et la société dont aucune voie de représentation ne répond.
  const repr = liste.filter((t) => t.role === ROLE_REPRESENTANT)
  const reprDestinataires = repr.filter((t) => t.destinataire_convocations || t.destinataire_notification_pv)
  if (reprDestinataires.length && !repr.some(joignable)) {
    out.push({
      gravite: 'manque',
      texte: `Aucun des ${repr.length} représentants légaux n’est joignable : la société est hors de portée d’une convocation (art. 6 et 8).`,
    })
  }

  // 4. Refus de l'électronique sans adresse postale. La demande est expresse
  //    (art. 8 et 13) : si on ne peut pas écrire, on ne peut pas la respecter.
  for (const t of liste) {
    if (t.refus_electronique && !(t.adresse_postale || '').trim()) {
      out.push({ gravite: 'manque', texte: `${nomComplet(t)} a demandé le courrier postal mais n’a pas d’adresse postale.` })
    }
  }

  // ⚠ LE CINQUIÈME CONTRÔLE A ÉTÉ RETIRÉ (Pascal, 22 octobre : « il n'y a pas
  //    d'adresse à confirmer »). Il signalait toute adresse reprise de la fiche
  //    du lot comme douteuse. Or ces personnes-là sont, dans leur quasi-totalité,
  //    des conjoints qui habitent la MÊME maison dans le lotissement : cette
  //    adresse EST leur demeure au sens de l'art. 28, et un recommandé les y
  //    atteint. Quinze injonctions sans objet, sur un écran où chaque ligne doit
  //    appeler une action.
  //
  //    ⚠ La colonne `adresse_a_verifier` RESTE : elle constate un fait — cette
  //    adresse n'a pas été déclarée par cette personne — et la fiche l'affiche
  //    discrètement. Ce fait ne devient un manque que si l'intéressé vit
  //    ailleurs, ce que le registre ne sait pas. On constate, on ne reproche pas.

  // Les deux invariants que la base ne peut pas porter : un check ne compte
  // pas ses lignes sœurs (cf. en-tête de la 068).
  if (votants.length === 0) {
    out.push({ gravite: 'manque', texte: 'Aucun membre votant : personne ne porte la voix de ce lot (art. 9).' })
  } else if (votants.length > 1) {
    out.push({ gravite: 'manque', texte: `${votants.length} membres votants : un lot n’a qu’une voix (art. 9).` })
  }

  return out
}

/**
 * Ce que l'écran doit refuser AVANT la base, avec le message que Postgres
 * n'écrira jamais lisiblement. ⚠ Même recette exactement que les contraintes
 * de la 068 — modifier l'une oblige à modifier l'autre.
 */
export function erreurDeSaisie(ligne) {
  if (!(ligne.nom || '').trim()) return 'Le nom est obligatoire.'
  if (!ROLES.includes(ligne.role)) return 'Rôle inconnu.'
  if (ligne.est_membre_votant && ROLES_SANS_VOTE.includes(ligne.role)) {
    return `Un ${ROLE_LABELS[ligne.role].toLowerCase()} ne peut pas être membre votant : il ne vote pas en son nom (art. 6).`
  }
  if (ligne.role === ROLE_USUFRUITIER && !ligne.date_fin && !ligne.est_membre_votant) {
    return 'L’usufruitier prend seul la qualité de membre de l’association (art. 6) : il doit être le membre votant.'
  }
  if (ligne.est_representant_designe && !ROLES_REPRESENTABLES.includes(ligne.role)) {
    return 'Seul un indivisaire ou un co-propriétaire peut être le représentant désigné : les statuts veulent « l’un d’eux » (art. 6).'
  }
  if (ligne.date_debut && ligne.date_fin && ligne.date_fin < ligne.date_debut) {
    return 'La fin ne peut pas précéder le début.'
  }
  return null
}

// ============================================================================
// L'ASSISTANT DE MUTATION (brief du 22 octobre, livré le 31)
//
// Une mutation n'est pas un changement de nom : c'est une PÉRIODE qui se ferme
// et une autre qui s'ouvre, avec des personnes dont les rôles dépendent de
// l'acte. Quatre formes, et elles ne se traitent pas de la même façon.
//
// ⚠ LE DÉLAI DE QUINZE JOURS NE VAUT PAS POUR TOUTES. L'article 22 vise la
// « vente ou donation EN PLEINE PROPRIÉTÉ », et rien d'autre : ni la donation
// avec réserve d'usufruit, ni la succession n'y sont nommées. Afficher le délai
// sur ces deux-là inventerait une obligation statutaire — exactement ce qu'un
// registre légal ne doit jamais faire. Vérifié dans le texte le 22 octobre.
// ============================================================================

export const MUTATION_VENTE = 'vente'
export const MUTATION_DONATION = 'donation'
export const MUTATION_USUFRUIT = 'donation_usufruit'
export const MUTATION_SUCCESSION = 'succession'

export const SCENARIOS = [
  {
    cle: MUTATION_VENTE,
    titre: 'Vente',
    aide: 'Le bien change de mains à titre onéreux. L’acquéreur prend la place du vendeur dans l’association (art. 1).',
    // Un seul acquéreur détient en plein ; à plusieurs, on ne qualifie pas —
    // c'est la doctrine de la 040, le registre constate et le notaire qualifie.
    roleUnique: ROLE_PLEIN,
    rolePlusieurs: ROLE_CO,
    delaiQuinzeJours: true,
    piece: 'Acte de vente',
  },
  {
    cle: MUTATION_DONATION,
    titre: 'Donation en pleine propriété',
    aide: 'Le donataire reçoit la pleine propriété. Il devient membre de l’association au même titre qu’un acquéreur.',
    roleUnique: ROLE_PLEIN,
    rolePlusieurs: ROLE_CO,
    delaiQuinzeJours: true,
    piece: 'Acte de donation',
  },
  {
    cle: MUTATION_USUFRUIT,
    titre: 'Donation avec réserve d’usufruit',
    // ⚠ C'est le cas que l'ancien modèle ne savait pas écrire : il n'avait que
    // deux cases pour des personnes qui n'ont pas le même droit.
    aide: 'Le donateur garde l’usufruit, le donataire reçoit la nue-propriété. ⚠ L’usufruitier prend SEUL la qualité de membre de l’association et porte la voix du lot ; il doit informer le nu-propriétaire des décisions prises (art. 6).',
    roleUnique: ROLE_USUFRUITIER,
    rolePlusieurs: ROLE_USUFRUITIER,
    roleSecond: ROLE_NU,
    libelleSecond: 'Nu-propriétaire',
    delaiQuinzeJours: false,
    piece: 'Acte de donation',
  },
  {
    cle: MUTATION_SUCCESSION,
    titre: 'Succession',
    aide: 'Les héritiers recueillent le bien. ⚠ S’ils sont plusieurs, ils ne peuvent se faire représenter que par l’un d’eux (art. 6) — désignez-le sur la fiche une fois la mutation enregistrée.',
    roleUnique: ROLE_PLEIN,
    rolePlusieurs: ROLE_INDIVISAIRE,
    delaiQuinzeJours: false,
    piece: 'Acte de notoriété ou attestation du notaire',
  },
]

export const scenarioDe = (cle) => SCENARIOS.find((s) => s.cle === cle) || SCENARIOS[0]

/**
 * Les titulaires à créer, d'après le scénario et les personnes saisies.
 *
 * ⚠ LE MEMBRE VOTANT EST POSÉ ICI, et une seule fois : c'est l'invariant que
 * la base ne peut pas porter (un `check` ne compte pas ses lignes sœurs), et
 * le laisser à l'écran ferait repasser chaque mutation par l'ordre imposé du
 * drapeau. En cas de démembrement c'est l'usufruitier, sans discussion
 * possible (art. 6) ; sinon le premier détenteur saisi.
 */
export function titulairesDeMutation(scenarioCle, personnes, { date_debut } = {}) {
  const s = scenarioDe(scenarioCle)
  const utiles = (personnes || []).filter((p) => (p.nom || '').trim())
  const principaux = utiles.filter((p) => !p.second)
  const seconds = utiles.filter((p) => p.second)

  const role = principaux.length > 1 ? s.rolePlusieurs : s.roleUnique
  const out = principaux.map((p, i) => ({
    ...LIGNE_VIDE,
    ...p,
    role,
    est_membre_votant: i === 0,
    date_debut: date_debut || '',
  }))
  for (const p of seconds) {
    out.push({
      ...LIGNE_VIDE,
      ...p,
      role: s.roleSecond || ROLE_NU,
      // ⚠ Le nu-propriétaire ne vote pas, mais il EST notifié : l'usufruitier
      // doit l'informer des décisions, et le registre doit donc savoir où le
      // joindre. La contrainte `titulaires_votant_interdit` l'exclut du vote.
      est_membre_votant: false,
      date_debut: date_debut || '',
    })
  }
  // ⚠ `second` est un drapeau de SAISIE, pas une colonne : il dit quel bloc du
  // formulaire a produit la ligne. Laissé dans le payload, PostgREST rejetterait
  // l'insert entier pour colonne inconnue — et le mock l'avalerait en silence.
  return out.map(({ second: _second, ...reste }) => reste)
}

/** Ce qui empêche d'enregistrer la mutation, dit en clair. */
export function erreurDeMutation(scenarioCle, personnes, date_mutation) {
  if (!date_mutation) return 'La date de la mutation est obligatoire.'
  const utiles = (personnes || []).filter((p) => (p.nom || '').trim())
  if (!utiles.some((p) => !p.second)) return 'Il faut au moins un nouveau propriétaire.'
  const s = scenarioDe(scenarioCle)
  if (s.cle === MUTATION_USUFRUIT && !utiles.some((p) => p.second)) {
    return 'Une donation avec réserve d’usufruit suppose un nu-propriétaire : c’est lui que l’usufruitier devra informer (art. 6).'
  }
  for (const t of titulairesDeMutation(scenarioCle, personnes, {})) {
    const faute = erreurDeSaisie(t)
    if (faute) return faute
  }
  return null
}
