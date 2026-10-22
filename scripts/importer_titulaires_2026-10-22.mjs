#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// REPRISE DES TITULAIRES DE CHAQUE LOT (migration 068)
// Brief du 22 octobre 2026 · arbitrages de Pascal du même jour.
//
// Les colonnes de 038 à 044 ne savaient décrire que deux personnes par lot et
// UNE adresse. Ce script déplie chaque période de propriété en autant de
// TITULAIRES qu'elle porte de personnes : propriétaire, second propriétaire,
// dirigeants, mandataire.
//
// ⚠ IL NE SUPPRIME RIEN, et il n'a pas de `--remplacer`. Les colonnes d'origine
// restent en place : la bascule des écrans se fera période par période (une
// période qui a des titulaires les utilise, les autres gardent la 044).
//
// ──────────────────────────────────────────────────────────────────────────────
// LE TEXTE DES STATUTS DU 15 SEPTEMBRE 2026, VERBATIM
//
// Il est reproduit ici et non dans la migration : la convention de nos
// migrations proscrit l'apostrophe, et une citation légale amputée de ses
// apostrophes n'est plus une citation. Lu dans `1_AG/2026/Statuts ASL Rives.pdf`
// le 22 octobre 2026 — pas résumé de mémoire.
//
// Article 1 — « Sont membres de l'association syndicale, tout propriétaire, pour
//   quelque cause que ce soit et à quelque titre que ce soit de l'un des lots ».
//   ⚠ C'est le fondement du rôle `co_proprietaire`, et non l'article 21.
//
// Article 6 — « Au cas où un des lots est la propriété indivise de plusieurs
//   personnes, les indivisaires ne peuvent se faire représenter que par l'un
//   d'eux. » / « Dans le cas de nue-propriété et d'usufruit, il est convenu que
//   l'usufruitier prend seul la qualité de membre de l'association, mais qu'il
//   devra informer le nu-propriétaire des décisions prises par l'association. »
//   / « Pour les lots appartenant à des personnes morales, le représentant légal
//   de chacune des sociétés assure la représentation lors des assemblées, ou
//   toute autre personne justifiant de ses pouvoir et conférés par ladite
//   société ». Et, pour les pouvoirs d'assemblée : « Les membres de l'assemblée
//   peuvent se faire représenter par un mandataire qui doit lui-même être membre
//   de l'association. […] Les mandats sont obligatoirement donnés par écrit. Tout
//   mandataire ne peut détenir à lui seul plus de quatre mandats. »
//   ⚠ CE MANDATAIRE-LÀ N'EST PAS LE NÔTRE. `proprietaires.mandataire_*` (037)
//   est l'intermédiaire permanent à qui l'on parle quand on n'atteint pas le
//   propriétaire — cas des colotis étrangers. Il ne porte aucun pouvoir de vote,
//   et la 068 le lui interdit par contrainte.
//
// Article 8 — « Les convocations sont adressées par tout moyen permettant d'en
//   garantir la réception, en privilégiant l'usage de moyens électroniques, sauf
//   demande expresse contraire d'un coloti. »
//
// Article 9 — « Chaque coloti dispose d'un nombre de voix correspondant à la
//   superficie de son lot […]. Le conseil syndical établit et tient à jour la
//   liste des propriétaires avec le nombre de voix dont ils disposent. »
//   ⚠ Les voix suivent la SUPERFICIE. `est_membre_votant` dit qui porte la voix
//   du lot, jamais combien elle pèse.
//
// Article 13 — copie du PV « adressée sous pli simple aux propriétaires ayant
//   participé […] et ayant voté pour les résolutions présentées ou s'étant
//   abstenus », et « sous pli recommandé avec avis de réception aux propriétaires
//   n'ayant pas participé aux travaux de l'assemblée ou ayant voté contre ».
//   « la durée de prescription des recours […] est fixée à un an ».
//   ⚠ LE MOYEN dépend du vote de la personne à CETTE assemblée — donnée que
//   l'application ne détient pas. `destinataire_notification_pv` dit QUI, jamais
//   COMMENT. ⚠ Et les statuts ne conditionnent PAS le délai d'un an à la
//   notification de chacun : le brief le dit, c'est une interprétation prudente,
//   pas une citation.
//
// Article 21 — « il y aura solidarité et indivisibilité entre tous les
//   propriétaires de l'immeuble » — mais « dans le cadre d'une indivision »
//   seulement. ⚠ Le texte ne nomme pas la détention à deux non qualifiée.
//
// Article 22 — « Il est tenu de faire connaître au syndicat, quinze jours au plus
//   après la signature de l'acte de vente ou de donation en pleine propriété, la
//   mutation de sa propriété, faute de quoi il reste personnellement engagé ».
//   ⚠ Ni la donation avec réserve d'usufruit, ni la succession n'y sont nommées.
//
// Article 28 — « Les propriétaires font élection de domicile en leur demeure
//   respective. » ⚠ C'est ce qui rend une adresse héritée insuffisante, et c'est
//   pourquoi `adresse_a_verifier` existe.
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QUE LA REPRISE DÉCIDE, ET CE QU'ELLE REFUSE DE DEVINER
//
// ⚠ `email` ET `email_2` NE SE FUSIONNENT JAMAIS. Mesuré sur l'export du
// 14 octobre : trois périodes ont `contacts_officiels = {proprietaire_2}` et leur
// SEULE adresse joignable est `email_2` (sur 0B 196, `email` est vide). Les
// écrans fusionnent les deux colonnes à l'affichage, ce qui masque à qui
// appartient l'adresse. Ici, correspondance stricte nom → email,
// nom_2 → email_2. Attribuer à Monsieur l'adresse de Madame, dans un registre
// qui sert à notifier en recommandé, serait une faute de fond.
//
// ⚠ `co_proprietaire` ET NON `indivisaire` quand `est_indivision` est faux.
// 19 périodes portent deux noms, 4 seulement sont déclarées en indivision : les
// 15 autres sont les conjoints copropriétaires inscrits le 28 août. La 040 dit
// que deux propriétaires n'est PAS synonyme d'indivision — `nom_2` constate le
// FAIT, `est_indivision` porte la QUALIFICATION, cochée seulement quand on la
// connaît. Les reprendre en `indivisaire` ferait qualifier par un script quinze
// situations que seul le notaire qualifie.
//
// ⚠ MAIS IL SE NOTIFIE COMME UN INDIVISAIRE (arbitrage Pascal, 22 octobre) : un
// conjoint en communauté comme en séparation de biens est propriétaire du lot,
// donc membre (art. 1), donc destinataire du PV. `destinataire_notification_pv`
// est vrai pour tout détenteur, quelle que soit la qualification.
//
// ⚠ `contacts_officiels` NE PILOTE QUE LES CONVOCATIONS. 35 périodes sur 51 n'ont
// que `{proprietaire}` coché : recopié mécaniquement sur la notification du PV,
// ce réglage priverait de notification le second indivisaire de trois des quatre
// indivisions — ce que les articles 1 et 13 ne permettent pas.
//
// ⚠ LE MEMBRE VOTANT D'UNE DÉTENTION À DEUX EST UNE SUPPOSITION, ET ELLE EST
// SIGNALÉE. Le brief demande de poser le premier détenteur « à confirmer ». On
// le fait, sans représentant désigné — donc le contrôle 1 nomme exactement ces
// lots. Le registre ne prétend pas savoir qui l'indivision a désigné.
//
// ⚠ L'ADRESSE DU SECOND DÉTENTEUR EST HÉRITÉE, DONC MARQUÉE. Aucun des 19
// seconds noms n'a d'adresse propre. `adresse_a_verifier` est posé sur eux.
// ⚠ PAS sur le second dirigeant : la 041 constate que deux dirigeants se
// joignent au même siège — ce n'est pas une adresse héritée d'un tiers, c'est
// celle de la société. Le marquer produirait 14 alertes qui n'en sont pas, et le
// bruit tue la liste (leçon des fausses alertes « injoignable » de l'export).
//
// ⚠ LE REPRÉSENTANT LÉGAL REÇOIT LA NOTIFICATION, LE MANDATAIRE NON — sauf si la
// fiche l'avait désigné. L'article 6 fait du représentant légal l'organe par
// lequel la société est atteinte ; le mandataire de la 037 n'est qu'un
// intermédiaire de contact, et le poser d'office en destinataire statutaire lui
// prêterait une qualité qu'il n'a pas.
//
// Usage :
//   node scripts/importer_titulaires_2026-10-22.mjs        essai à blanc
//   node scripts/importer_titulaires_2026-10-22.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ⚠ LA LISTE BLANCHE DES COLONNES RÉELLES. PostgREST rejette toute colonne
// inconnue ; le mock, lui, l'avalerait sans rien dire — le bug ne se verrait
// qu'en production. Leçon du 5 octobre, où `texte` au lieu de `contenu` a fait
// refuser cinq corrections, et que l'essai à blanc ne pouvait pas voir
// puisqu'il n'appelle aucun `insert`.
const COLONNES = [
  'proprietaire_id', 'role', 'est_personne_morale', 'civilite', 'nom', 'prenom',
  'fonction', 'quote_part', 'adresse_postale', 'pays', 'adresse_a_verifier',
  'email', 'telephone', 'langue', 'refus_electronique', 'est_membre_votant',
  'est_representant_designe', 'designation_documents',
  'destinataire_convocations', 'destinataire_notification_pv',
  'date_debut', 'date_fin', 'observations',
]

const ROLES_DETENTEURS = ['plein_proprietaire', 'indivisaire', 'co_proprietaire', 'usufruitier']
const NOTE_REPRISE = 'Reprise automatique du 22 octobre 2026 depuis les colonnes de la fiche du propriétaire.'

// ── Connexion ────────────────────────────────────────────────────────────────
async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // ⚠ En ÉCHAPPEMENTS : collés tels quels, U+2028 coupe le littéral en deux.
      const propre = ligne.replace(/[\u2028\u2029\uFEFF\u00A0\u200B]/g, '').trim()
      if (!propre || propre.startsWith('#')) continue
      const i = propre.indexOf('=')
      if (i < 1) continue
      out[propre.slice(0, i).trim()] = propre.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ⚠ La migration 068 doit être passée pour ÉCRIRE. En essai à blanc, non : tout
// l'intérêt est de pouvoir lire le rapport AVANT de coller le SQL. On le dit,
// au lieu de laisser croire que la table est vide alors qu'elle n'existe pas.
//
// ⚠ LA SONDE LIT DE VRAIES LIGNES, et non un `head: true` avec `count`. Essayé :
// sur une table absente, cette forme-là ne renvoie PAS d'erreur et la sonde
// concluait que la table existait et était vide — puis la lecture suivante
// échouait. Un contrôle qui ment est pire que pas de contrôle.
const sonde = await supabase.from('titulaires').select('*').limit(1)
const TABLE_ABSENTE = Boolean(sonde.error)
if (TABLE_ABSENTE && GO) {
  console.error(`❌ Table \`titulaires\` inaccessible : ${sonde.error.message}`)
  console.error('   La migration 068 n’a pas été passée dans le SQL Editor. Rien n’est écrit.')
  process.exit(1)
}

// ── Lecture du registre ──────────────────────────────────────────────────────
const { data: lots, error: eLots } = await supabase.from('lots').select('id,numero,adresse_lotissement')
if (eLots) { console.error(`❌ Lecture de \`lots\` : ${eLots.message}`); process.exit(1) }
const { data: periodes, error: ePer } = await supabase.from('proprietaires').select('*')
if (ePer) { console.error(`❌ Lecture de \`proprietaires\` : ${ePer.message}`); process.exit(1) }

const lotParId = new Map(lots.map((l) => [l.id, l]))
// Les périodes dans l'ordre du registre : par parcelle, l'actuelle d'abord.
periodes.sort((a, b) => {
  const na = lotParId.get(a.lot_id)?.numero || ''
  const nb = lotParId.get(b.lot_id)?.numero || ''
  if (na !== nb) return na.localeCompare(nb, 'fr', { numeric: true })
  return (a.date_cession ? 1 : 0) - (b.date_cession ? 1 : 0)
})

const texte = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim())
const pleine = (v) => texte(v).length > 0

// Ce qui est MIS DE CÔTÉ en attendant un arbitrage, et ce qui est écrit mais
// reste à compléter. ⚠ Précédent du 5 octobre (`attente_pascal`) : ce qu'on ne
// sait pas qualifier ne s'écrit pas « au mieux », il s'écrit nulle part et se
// nomme au rapport.
const aArbitrer = []
const aCompleter = []

// ─────────────────────────────────────────────────────────────────────────────
// L'ARBITRAGE DU 22 OCTOBRE — la personne rangée dans `nom_2` d'une SOCIÉTÉ
// ─────────────────────────────────────────────────────────────────────────────
// ⚠ NOMMÉES PAR LEUR IDENTITÉ RÉELLE, jamais par un uuid, et chacune porte la
// VALEUR ATTENDUE : si la fiche a changé depuis, la règle est refusée au lieu
// d'être appliquée à l'aveugle. Doctrine de `corriger_resolutions_archives.mjs`.
//
// Pascal, 22 octobre : « Tino est le père de Laurent et Marc. Je ne sais pas
// s'il y a eu donation mais Marc fait partie du CS. »
//
// ⚠ L'INCERTITUDE SUR LA DONATION NE CHANGE RIEN, et c'est le registre lui-même
// qui le dit : la parcelle appartient à la SOCIÉTÉ. Une donation de PARTS
// SOCIALES ne déplace pas la propriété du lot — et l'hypothèse d'une donation du
// lot avec réserve d'usufruit est exclue, puisque le lot n'appartient pas à une
// personne physique. Tino Pais n'est donc titulaire d'aucun droit sur le lot,
// quelle que soit la réponse. Il est le CORRESPONDANT de la société, ce que la
// 037 appelle un mandataire, et la contrainte de la 068 lui interdit le vote.
//
// ⚠ ET LA CASE QUI LE DÉSIGNE EST `proprietaire_2`, PAS `mandataire` — parce
// qu'il occupait le champ `nom_2`. Lire la case `mandataire`, comme pour les
// autres mandataires, le retirerait des convocations, alors que c'est
// précisément pour lui que la case a été cochée. Le genre de détail qui ne se
// remarque qu'à la première convocation non reçue.
const ARBITRAGES_SOCIETE_NOM_2 = [{
  parcelle: '0B 201',
  societe_attendue: 'Logudoro',
  nom_attendu: 'Tino Pais',
  role: 'mandataire',
  designe_par: 'proprietaire_2',
  observations: 'Père de Pais Laurent (gérant) et de Pais Marc (associé, membre du conseil syndical). '
    + 'Correspondant de la société, destinataire désigné de ses convocations. '
    + 'Aucun mandat écrit au dossier, et aucune donation établie — une donation de parts sociales '
    + 'ne changerait rien au lot, qui appartient à la société. Arbitrage de Pascal du 22 octobre 2026.',
}]

// ── Dépliage d'une période en titulaires ─────────────────────────────────────
function titulairesDe(p) {
  const out = []
  const cochees = Array.isArray(p.contacts_officiels) && p.contacts_officiels.length
    ? p.contacts_officiels
    : ['proprietaire']
  const adresse = texte(p.adresse_communication) || null
  const periode = { date_debut: p.date_acquisition || null, date_fin: p.date_cession || null }

  const aDeuxNoms = pleine(p.nom_2)

  // ⚠ ON NE DÉCOUPE AUCUNE CHAÎNE. Quatre fiches portent le mot « Indivision »
  // DANS le nom (« Indivision Trosselli Corrine ») : c'était le seul moyen de
  // dire la qualification quand une ligne devait porter deux personnes. Le rôle
  // `indivisaire` le dit maintenant, donc le mot est en trop — mais retirer un
  // préfixe par expression régulière dans un nom de personne, c'est accepter de
  // renommer quelqu'un sur une devinette. On le signale, un humain le corrige.
  for (const champ of ['nom', 'nom_2']) {
    if (/^indivision\b/i.test(texte(p[champ]))) {
      aCompleter.push(`**${lotParId.get(p.lot_id)?.numero}** — le ${champ === 'nom' ? 'nom' : 'second nom'} porte le mot `
        + `« Indivision » (« ${texte(p[champ])} ») : le rôle le dit désormais, le nom peut être nettoyé à la main.`)
    }
  }
  // Le rôle du ou des détenteurs. ⚠ `plein_proprietaire` veut dire SEUL
  // propriétaire : dès qu'un second nom existe, le premier ne détient plus seul.
  const roleDetenteur = p.est_societe
    ? 'plein_proprietaire'
    : p.est_indivision
      ? 'indivisaire'
      : aDeuxNoms ? 'co_proprietaire' : 'plein_proprietaire'

  // 1. Le propriétaire. Pour une société, cette ligne porte la raison sociale et
  //    l'adresse du siège, et c'est ELLE qui porte la voix du lot — pas son
  //    dirigeant, auquel la contrainte l'interdit.
  const votantSuppose = roleDetenteur !== 'plein_proprietaire'
  out.push({
    ...periode,
    role: roleDetenteur,
    est_personne_morale: Boolean(p.est_societe),
    nom: texte(p.nom),
    email: texte(p.email) || null,
    telephone: texte(p.telephone) || null,
    adresse_postale: adresse,
    adresse_a_verifier: false,
    est_membre_votant: true,
    est_representant_designe: false,
    destinataire_convocations: cochees.includes('proprietaire'),
    destinataire_notification_pv: true,
    observations: votantSuppose
      ? `${NOTE_REPRISE} Membre votant supposé — à confirmer : le détenteur désigné par les copropriétaires n’est pas connu (art. 6).`
      : NOTE_REPRISE,
  })

  // 2. Le second détenteur. ⚠ Son adresse est celle de la fiche, pas la sienne.
  //
  // ⚠ SAUF SI LE PROPRIÉTAIRE EST UNE SOCIÉTÉ : alors `nom_2` n'est PAS un
  // second détenteur. Une personne physique ne codétient pas le lot avec la SCI
  // qui le possède — elle en est l'associé, le dirigeant, ou le correspondant.
  // Le cas existe une fois (0B 201, SCI Logudoro, nom_2 « Tino Pais », qui est
  // en outre le destinataire officiel désigné) et aucun rôle de la 068 ne dit ce
  // qu'il est. Le ranger en `co_proprietaire` ferait écrire au registre qu il
  // détient une parcelle qu il ne détient pas : c est exactement la
  // qualification que la 040 nous interdit de faire à la place du notaire.
  // On met de côté, et on nomme. Le contrôle « rien de perdu » signalera son
  // adresse, ce qui est le filet attendu.
  if (aDeuxNoms && p.est_societe) {
    const parcelle = lotParId.get(p.lot_id)?.numero || '?'
    const regle = ARBITRAGES_SOCIETE_NOM_2.find((r) => r.parcelle === parcelle)
    // ⚠ La règle porte la valeur ATTENDUE. Si la fiche a changé depuis
    // l'arbitrage, on ne l'applique pas : on le dit.
    const conforme = regle
      && texte(p.nom) === regle.societe_attendue
      && texte(p.nom_2) === regle.nom_attendu
    if (regle && !conforme) {
      anomalies.push(`**${parcelle}** — l’arbitrage du 22 octobre attendait « ${regle.nom_attendu} » `
        + `chez « ${regle.societe_attendue} », la fiche porte « ${texte(p.nom_2)} » chez « ${texte(p.nom)} ». `
        + 'Règle NON appliquée, la personne reste de côté.')
    }
    if (conforme) {
      out.push({
        ...periode,
        role: regle.role,
        est_personne_morale: false,
        nom: texte(p.nom_2),
        email: texte(p.email_2) || null,
        telephone: texte(p.telephone_2) || null,
        adresse_postale: null,
        adresse_a_verifier: false,
        est_membre_votant: false,
        est_representant_designe: false,
        destinataire_convocations: cochees.includes(regle.designe_par),
        destinataire_notification_pv: cochees.includes(regle.designe_par),
        observations: regle.observations,
      })
    } else {
      aArbitrer.push({
        parcelle,
        quoi: `${texte(p.nom_2)} (${texte(p.email_2) || 'sans e-mail'})`,
        pourquoi: `rattaché à la société « ${texte(p.nom)} » par la colonne nom_2`
          + `${cochees.includes('proprietaire_2') ? ', et DÉSIGNÉ destinataire officiel des convocations' : ''}`,
        lectures: 'associé ou correspondant (aucun rôle), mandataire au sens de la 037, ou dirigeant à inscrire comme tel',
      })
    }
  } else if (aDeuxNoms) {
    out.push({
      ...periode,
      role: p.est_indivision ? 'indivisaire' : 'co_proprietaire',
      est_personne_morale: false,
      nom: texte(p.nom_2),
      email: texte(p.email_2) || null,
      telephone: texte(p.telephone_2) || null,
      adresse_postale: adresse,
      adresse_a_verifier: Boolean(adresse),
      est_membre_votant: false,
      est_representant_designe: false,
      destinataire_convocations: cochees.includes('proprietaire_2'),
      destinataire_notification_pv: true,
      observations: `${NOTE_REPRISE} Adresse postale reprise de la fiche du lot, à faire confirmer par l’intéressé (art. 28).`,
    })
  }

  // 3. Les dirigeants. Les DEUX engagent la société (041), donc les deux la
  //    représentent et les deux reçoivent.
  for (const n of [1, 2]) {
    const s = n === 1 ? '' : '_2'
    if (!pleine(p[`dirigeant_nom${s}`])) continue
    out.push({
      ...periode,
      role: 'representant_legal',
      est_personne_morale: false,
      nom: texte(p[`dirigeant_nom${s}`]),
      fonction: texte(p[`dirigeant_fonction${s}`]) || null,
      email: texte(p[`dirigeant_email${s}`]) || null,
      telephone: texte(p[`dirigeant_telephone${s}`]) || null,
      adresse_postale: texte(p.adresse_dirigeant) || null,
      adresse_a_verifier: false,
      est_membre_votant: false,
      est_representant_designe: false,
      destinataire_convocations: cochees.includes('dirigeant'),
      destinataire_notification_pv: true,
      observations: NOTE_REPRISE,
    })
  }

  // 4. Le mandataire de contact (037). ⚠ Pas un pouvoir d'assemblée, et pas un
  //    destinataire statutaire du PV : on suit ce que la fiche avait désigné.
  //
  // ⚠ LE TÉLÉPHONE SUFFIT À DÉCLENCHER LA LIGNE. Une fiche (0B 240, Precettes)
  // ne porte QUE `mandataire_telephone` : sans ce troisième test, le numéro
  // n'atterrissait sur aucun titulaire et devenait invisible le jour où l'écran
  // lit les titulaires — perte trouvée par le contrôle « rien de perdu », pas en
  // relisant le code. `nom` étant `not null`, il retombe sur ce qu'on connaît,
  // comme `coalesce(nom, email)` de la requête d'export : on n'invente pas un
  // nom, on affiche le seul identifiant dont on dispose, et on le dit.
  if (pleine(p.mandataire_nom) || pleine(p.mandataire_email) || pleine(p.mandataire_telephone)) {
    const designe = cochees.includes('mandataire')
    if (!pleine(p.mandataire_nom)) {
      aCompleter.push(`**${lotParId.get(p.lot_id)?.numero}** — mandataire sans nom, connu par `
        + `${pleine(p.mandataire_email) ? 'son seul e-mail' : 'son seul numéro de téléphone'}.`)
    }
    out.push({
      ...periode,
      role: 'mandataire',
      est_personne_morale: false,
      nom: texte(p.mandataire_nom) || texte(p.mandataire_email) || texte(p.mandataire_telephone),
      email: texte(p.mandataire_email) || null,
      telephone: texte(p.mandataire_telephone) || null,
      adresse_postale: null,
      adresse_a_verifier: false,
      est_membre_votant: false,
      est_representant_designe: false,
      destinataire_convocations: designe,
      destinataire_notification_pv: designe,
      observations: `${NOTE_REPRISE} Intermédiaire de contact (migration 037), sans pouvoir de vote.`
        + (pleine(p.mandataire_nom) ? '' : ' Nom inconnu du registre, à renseigner.'),
    })
  }

  return out.map((t) => ({ proprietaire_id: p.id, ...t }))
}

// ── Ce qui est déjà en base ──────────────────────────────────────────────────
let existants = []
if (!TABLE_ABSENTE) {
  const { data, error } = await supabase.from('titulaires').select('*')
  if (error) { console.error(`❌ Lecture de \`titulaires\` : ${error.message}`); process.exit(1) }
  existants = data || []
}
// Idempotence sur (proprietaire_id, role, nom) — la clé du brief.
const cle = (t) => `${t.proprietaire_id}|${t.role}|${texte(t.nom).toLowerCase()}`
const dejaEnBase = new Set(existants.map(cle))

const aEcrire = []
const dejaLa = []
const anomalies = []
const parPeriode = new Map()

for (const p of periodes) {
  const produits = titulairesDe(p)
  parPeriode.set(p.id, produits)
  const vues = new Set()
  for (const t of produits) {
    if (!pleine(t.nom)) {
      anomalies.push(`Période ${lotParId.get(p.lot_id)?.numero || p.lot_id} : un titulaire ${t.role} sans nom — ignoré.`)
      continue
    }
    // ⚠ Dédoublonnage DANS le lot avant l'insert : deux lignes identiques
    // seraient deux fois la même personne, et rien ne le signalerait ensuite.
    if (vues.has(cle(t))) {
      anomalies.push(`Période ${lotParId.get(p.lot_id)?.numero} : deux fois « ${t.nom} » en ${t.role} — la seconde est ignorée.`)
      continue
    }
    vues.add(cle(t))
    if (dejaEnBase.has(cle(t))) { dejaLa.push(t); continue }
    aEcrire.push(Object.fromEntries(Object.entries(t).filter(([k]) => COLONNES.includes(k))))
  }
}

// ── AUCUNE ADRESSE, AUCUN E-MAIL PERDU — la vérification demandée ────────────
// ⚠ On compare VALEUR PAR VALEUR, pas les comptes : un total juste peut cacher
// une adresse rangée sur la mauvaise personne.
const perdus = []
for (const p of periodes) {
  const produits = parPeriode.get(p.id) || []
  const presente = (champ, valeur) =>
    produits.some((t) => texte(t[champ]).toLowerCase() === texte(valeur).toLowerCase())
  const aVerifier = [
    ['nom', p.nom], ['nom', p.nom_2],
    ['email', p.email], ['email', p.email_2],
    ['telephone', p.telephone], ['telephone', p.telephone_2],
    ['nom', p.dirigeant_nom], ['nom', p.dirigeant_nom_2],
    ['email', p.dirigeant_email], ['email', p.dirigeant_email_2],
    ['telephone', p.dirigeant_telephone], ['telephone', p.dirigeant_telephone_2],
    ['nom', p.mandataire_nom], ['email', p.mandataire_email], ['telephone', p.mandataire_telephone],
    ['adresse_postale', p.adresse_communication], ['adresse_postale', p.adresse_dirigeant],
  ]
  for (const [champ, valeur] of aVerifier) {
    if (!pleine(valeur)) continue
    if (!presente(champ, valeur)) {
      perdus.push(`Parcelle ${lotParId.get(p.lot_id)?.numero} — ${champ} « ${texte(valeur).slice(0, 48)} » ne se retrouve dans aucun titulaire.`)
    }
  }
}

// ── LES CINQ CONTRÔLES (avertissements, jamais des refus) ────────────────────
const alertes = []
for (const p of periodes) {
  if (p.date_cession) continue   // un ancien propriétaire n'est plus convoqué
  const parcelle = lotParId.get(p.lot_id)?.numero || '?'
  const produits = (parPeriode.get(p.id) || []).filter((t) => !t.date_fin)
  const detenteurs = produits.filter((t) => ROLES_DETENTEURS.includes(t.role))
  const votants = produits.filter((t) => t.est_membre_votant)

  // 1. Détention à plusieurs sans représentant désigné (art. 6). ⚠ Couvre aussi
  //    `co_proprietaire` : la question « qui porte la voix ? » est la même.
  if (detenteurs.length > 1 && !produits.some((t) => t.est_representant_designe)) {
    alertes.push(`**${parcelle}** — ${detenteurs.length} détenteurs, aucun représentant désigné : la voix du lot est supposée (art. 6).`)
  }
  // 2. Démembrement sans nu-propriétaire renseigné.
  if (produits.some((t) => t.role === 'usufruitier') && !produits.some((t) => t.role === 'nu_proprietaire')) {
    alertes.push(`**${parcelle}** — un usufruitier, aucun nu-propriétaire : l’usufruitier doit l’informer (art. 6), encore faut-il savoir qui.`)
  }
  // 3. Destinataire sans aucun moyen de l'atteindre.
  //
  // ⚠ PAS À LA MÊME MAILLE POUR TOUS LES RÔLES, et le premier jet s'y est trompé
  // en produisant DOUZE fausses alertes — exactement la faute que `export_md`
  // avait déjà commise en déclarant injoignables douze sociétés dont on a le
  // dirigeant. Un outil de vérification qui crie à tort n'est pas lu deux fois.
  //
  // Un DÉTENTEUR doit être joignable personnellement : les articles 13, 21 et 28
  // lui sont opposables à lui, pas à son voisin d'indivision.
  // Un REPRÉSENTANT, lui, n'est qu'une voie vers la société — et l'article 6 dit
  // que le représentant légal assure la représentation : il suffit qu'UN d'entre
  // eux soit joignable pour que la société le soit. Un second dirigeant sans
  // coordonnées est une fiche à compléter, pas un lot hors de portée.
  const joignable = (t) => pleine(t.email) || pleine(t.adresse_postale)
  const estDestinataire = (t) => t.destinataire_convocations || t.destinataire_notification_pv
  for (const t of produits) {
    if (!ROLES_DETENTEURS.includes(t.role) && t.role !== 'nu_proprietaire') continue
    if (estDestinataire(t) && !joignable(t)) {
      alertes.push(`**${parcelle}** — ${t.nom} (${t.role}) est destinataire sans e-mail ni adresse postale.`)
    }
  }
  // La société elle-même : aucune de ses voies de représentation ne répond.
  const representants = produits.filter((t) => t.role === 'representant_legal')
  if (representants.length && representants.some(estDestinataire) && !representants.some(joignable)) {
    alertes.push(`**${parcelle}** — aucun des ${representants.length} représentants légaux n’est joignable : la société est hors de portée d’une convocation (art. 6 et 8).`)
  }
  // Et ceux qu'on ne peut pas joindre sans que le lot soit pour autant hors de
  // portée : une fiche à compléter, pas une alerte statutaire.
  for (const t of representants.filter((x) => estDestinataire(x) && !joignable(x))) {
    aCompleter.push(`**${parcelle}** — ${t.nom}, représentant légal désigné destinataire, n’a ni e-mail ni adresse (la société reste joignable par l’autre).`)
  }

  for (const t of produits) {
    // 4. Refus de l'électronique sans adresse postale (art. 8 et 13).
    if (t.refus_electronique && !pleine(t.adresse_postale)) {
      alertes.push(`**${parcelle}** — ${t.nom} refuse l’électronique mais n’a pas d’adresse postale.`)
    }
    // 5. Notifié du PV sur une adresse HÉRITÉE (art. 13 et 28) — le contrôle
    //    ajouté le 22 octobre, parce qu'aucun des quatre autres ne le voit.
    if (t.destinataire_notification_pv && t.adresse_a_verifier && !pleine(t.email)) {
      alertes.push(`**${parcelle}** — ${t.nom} (${t.role}) doit être notifié du PV, mais son adresse est héritée de la fiche et il n’a pas d’e-mail propre.`)
    }
  }
  // Et les deux invariants que la base ne peut pas porter.
  if (!produits.length) alertes.push(`**${parcelle}** — aucun titulaire actif.`)
  else if (votants.length !== 1) alertes.push(`**${parcelle}** — ${votants.length} membre(s) votant(s), il en faut exactement un (art. 9).`)
}

// ── Sauvegarde ───────────────────────────────────────────────────────────────
async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `titulaires-${jour}`)
  await mkdir(dir, { recursive: true })
  for (const table of ['proprietaires', 'lots', 'titulaires']) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`sauvegarde ${table} : ${error.message}`)
    await writeFile(join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${table} : ${data.length} ligne(s)`)
  }
  return dir
}

// ── Rapport ──────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()

W(`# Reprise des titulaires — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — ce rapport nomme les cinquante colotis et porte')
W('> leurs adresses. `export/` est git-ignoré ; il ne doit jamais entrer dans le dépôt.')
W('')
if (TABLE_ABSENTE) {
  W('> ⚠ **La table `titulaires` n’existe pas encore** : la migration 068 n’a pas été')
  W('> passée dans le SQL Editor. Ce rapport dit donc ce qui SERAIT écrit, et rien')
  W('> n’a pu être comparé à la base. Ce n’est pas « la table est vide ».')
  W('')
}
W(`${periodes.length} période(s) de propriété sur ${lots.length} parcelle(s) · `
  + `**${aEcrire.length} titulaire(s) à écrire** · ${dejaLa.length} déjà en base · ${anomalies.length} anomalie(s).`)
W('')

let sauvegarde = null
if (GO) {
  console.log('Sauvegarde du jour…')
  sauvegarde = await sauvegardeDuJour()
  W(`Sauvegarde : \`${sauvegarde.replace(RACINE + '/', '')}\``)
  W('')
}

// Le détail, parcelle par parcelle — c'est ce qui se relit.
W('## Ce qui serait inscrit, parcelle par parcelle')
W('')
W('Marques : ⭐ membre votant · ✉ convocations · 📄 notification du PV · ⚠ adresse héritée')
W('')
W('| Parcelle | Rôle | Nom | E-mail | Téléphone | Adresse | Marques |')
W('|---|---|---|---|---|---|---|')
for (const p of periodes) {
  const parcelle = lotParId.get(p.lot_id)?.numero || '?'
  const suffixe = p.date_cession ? ` _(période close le ${p.date_cession})_` : ''
  for (const t of parPeriode.get(p.id) || []) {
    const marques = [
      t.est_membre_votant ? '⭐' : '',
      t.destinataire_convocations ? '✉' : '',
      t.destinataire_notification_pv ? '📄' : '',
      t.adresse_a_verifier ? '⚠' : '',
    ].filter(Boolean).join(' ')
    const adresse = texte(t.adresse_postale).replace(/\s*\n\s*/g, ', ')
    W(`| ${parcelle}${suffixe} | ${t.role}${t.fonction ? ` (${t.fonction})` : ''} | ${t.nom} `
      + `| ${t.email || '—'} | ${t.telephone || '—'} | ${adresse || '—'} | ${marques || '—'} |`)
  }
}
W('')

W('## Répartition des rôles')
W('')
const parRole = {}
for (const liste of parPeriode.values()) for (const t of liste) parRole[t.role] = (parRole[t.role] || 0) + 1
W('| Rôle | Lignes |')
W('|---|---|')
for (const [r, n] of Object.entries(parRole).sort((a, b) => b[1] - a[1])) W(`| ${r} | ${n} |`)
W('')

if (aArbitrer.length) {
  W(`## ⚠ ${aArbitrer.length} cas MIS DE CÔTÉ — il faut un arbitrage`)
  W('')
  W('Ces personnes **ne seront pas inscrites**, même avec `--go` : aucun rôle de la 068')
  W('ne dit ce qu’elles sont, et en choisir un au hasard ferait affirmer au registre une')
  W('qualité que personne n’a constatée. Leurs coordonnées restent dans les colonnes')
  W('d’origine, que rien ne supprime.')
  W('')
  for (const a of aArbitrer) {
    W(`- **${a.parcelle}** — ${a.quoi}, ${a.pourquoi}.`)
    W(`  Lectures possibles : ${a.lectures}.`)
  }
  W('')
}

if (aCompleter.length) {
  W(`## ${aCompleter.length} ligne(s) écrites mais à compléter`)
  W('')
  for (const l of aCompleter) W(`- ${l}`)
  W('')
}

W('## Aucune adresse, aucun e-mail perdu')
W('')
if (!perdus.length) {
  W('_Vérifié valeur par valeur : chaque nom, e-mail, téléphone et adresse des anciennes')
  W('colonnes se retrouve sur un titulaire, dans le champ de même nature._')
} else {
  W(`⚠ **${perdus.length} valeur(s) ne se retrouvent pas** :`)
  W('')
  for (const l of perdus) W(`- ${l}`)
}
W('')

W(`## Points d’attention — les cinq contrôles (${alertes.length})`)
W('')
W('Ce sont des **avertissements**, jamais des refus : la base n’empêche rien de tout cela.')
W('')
if (!alertes.length) W('_Rien à signaler._')
else for (const a of alertes) W(`- ${a}`)
W('')

if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}

W('## Ce que ce rapport ne prouve pas')
W('')
W('- ⚠ **Aucun démembrement n’existe dans la base** : le contrôle 2 (usufruitier sans')
W('  nu-propriétaire) n’a donc pas pu être éprouvé sur des données réelles.')
W('- ⚠ L’essai à blanc n’appelle aucun `insert` : il prouve que les cibles existent et')
W('  que le dépliage est juste, **jamais que l’écriture passe**. Seul `--go` le dira.')
W('- ⚠ Le membre votant d’une détention à deux est une **supposition** du script, pas')
W('  une désignation des copropriétaires. Le contrôle 1 nomme chacun de ces lots.')
W('')

// ── Écriture ─────────────────────────────────────────────────────────────────
let ecrits = 0
if (GO && aEcrire.length) {
  console.log(`Écriture de ${aEcrire.length} titulaire(s)…`)
  // Par paquets : une seule requête de cent lignes échouerait en bloc sur une
  // seule ligne fautive, et on ne saurait pas laquelle.
  for (let i = 0; i < aEcrire.length; i += 20) {
    const paquet = aEcrire.slice(i, i + 20)
    const { data, error } = await supabase.from('titulaires').insert(paquet).select('id')
    if (error) {
      console.error(`❌ Paquet ${i / 20 + 1} refusé : ${error.message}`)
      W(`> ⚠ **Paquet ${i / 20 + 1} refusé** : ${error.message} — ${ecrits} ligne(s) écrites avant lui.`)
      break
    }
    ecrits += data.length
  }
  W('')
  W(`**${ecrits} titulaire(s) écrits.**`)
  W('')
}

W('---')
W('')
W(GO
  ? `**${ecrits} écrits · ${dejaLa.length} déjà là · ${aArbitrer.length} mis de côté · ${alertes.length} avertissement(s) · ${perdus.length} valeur(s) perdue(s) · ${anomalies.length} anomalie(s).**`
  : `**Essai à blanc : ${aEcrire.length} à écrire · ${dejaLa.length} déjà là · ${aArbitrer.length} mis de côté · ${alertes.length} avertissement(s) · ${perdus.length} valeur(s) perdue(s) · ${anomalies.length} anomalie(s). Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `titulaires_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
const chemin = join(RACINE, 'export', nom)
await writeFile(chemin, lignes.join('\n'), 'utf8')

console.log('')
console.log(`Rapport : export/${nom}`)
console.log(`${GO ? `${ecrits} écrits` : `${aEcrire.length} à écrire (essai à blanc)`} · `
  + `${dejaLa.length} déjà là · ${aArbitrer.length} mis de côté · ${alertes.length} avertissement(s) · ${perdus.length} perdue(s) · ${anomalies.length} anomalie(s).`)
if (!GO) console.log('Relancer avec --go pour écrire.')
