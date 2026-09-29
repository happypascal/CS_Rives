// LE CONTENTIEUX SCI VIOLETTE ENTRE DANS LA MÉMOIRE DU LOTISSEMENT.
//
// Pascal (2026-09-29) : « je ne vois pas la SCI Violette dans les contentieux,
// à ajouter avec le détail disponible dans le folder », « tu peux aussi te
// sourcer dans le projet SCI Violette », « et aussi dans les PV pour les
// décisions ».
//
// =============================================================================
// TROIS SOURCES, ET CHAQUE ENTRÉE DIT LAQUELLE
// =============================================================================
//  1. LES PROCÈS-VERBAUX D'ASSEMBLÉE (`pv_archives`) — ce que l'assemblée a
//     DÉCIDÉ : autorisation d'agir en 2016, renouvelée en 2020, provisions,
//     comptes rendus annuels.
//  2. LE JOURNAL DU PROJET « SCI Violette » (`journal_projet`) — ce que le
//     conseil a FAIT : mandat à l'avocat, rendez-vous sur site, constats.
//  3. LE DOSSIER `3_procédures/SCI Violette` — les ACTES eux-mêmes : ordonnance,
//     constats d'huissier, conclusions, courriers de l'avocat.
//
// ⚠ AUCUNE DES TROIS NE SUFFIT. Les PV disent qu'on a autorisé une action mais
// jamais ce qu'elle a donné ; le journal dit ce qu'on a fait mais pas ce que le
// juge a tranché ; le dossier porte les actes mais pas les votes qui les ont
// permis. C'est précisément le rôle de la mémoire : tenir le fil quand aucune
// source ne le tient seule.
//
// ⚠ CHAQUE ENTRÉE NOMME SA SOURCE, en clair et dans son texte. Dans dix ans,
// une ligne sans provenance ne vaudra rien — et une chronologie de contentieux
// se relit devant un tribunal.
//
// =============================================================================
// CE QUE JE N'AI PAS TRANCHÉ
// =============================================================================
// ⚠ LE CONSTAT DE FÉVRIER 2026 EST DATÉ DEUX FOIS : le journal du projet le note
// au 21/02, l'acte lui-même porte le 26 février 2026. On retient la date de
// L'ACTE — c'est lui qui fait foi — et l'entrée LE DIT. Choisir en silence
// aurait été le vrai défaut.
//
// ⚠ Le fondement est « le nouvel article 15 de l'additif au cahier des charges »
// que les PV datent du 15 JANVIER 1957 et dont les conclusions citent un acte de
// dépôt du 26 MARS 1956. Les deux dates figurent telles quelles dans la
// synthèse : ce n'est pas au script d'arbitrer une source juridique.
//
// ⚠ TOUTE PIÈCE TÉLÉVERSÉE DOIT ÊTRE CITÉE PAR UNE ENTRÉE. Le premier jet
// envoyait « Procédure SCI Violette 2017.pdf » sans la rattacher à rien : un
// objet payé, stocké, et invisible — un orphelin que rien ne signale. Le
// rapport compte désormais les pièces rattachées, et le nom de fichier trompait
// d'ailleurs : c'est l'APPEL DE PROVISION du 21 décembre 2016, pas une pièce
// de 2017.
//
// Usage :
//   node scripts/memoire_sci_violette.mjs        essai à blanc
//   node scripts/memoire_sci_violette.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const DOSSIER = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/3_procédures/SCI Violette'
const BUCKET = 'documents'

const SUJET = {
  titre: 'Contentieux SCI Violette',
  categorie: 'Contentieux',
}

// ⚠ TOUT TEXTE VENU DES SOURCES EST ÉCHAPPÉ : `sujet_entrees.contenu` est rendu
// en HTML. Une esperluette casserait la fiche, un `<` avalerait la suite.
const htm = (t) => String(t ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const P = (...paragraphes) => paragraphes.filter(Boolean).map((p) => `<p>${p}</p>`).join('')
const SRC = (t) => `<em>Source : ${htm(t)}.</em>`

// ⚠ LES NOMS DE FICHIERS SE COMPARENT EN FORME NORMALISÉE. macOS écrit ses noms
// en NFD (« é » = e + accent combinant) ; les littéraux de ce fichier sont en
// NFC. « Procès-verbal » y est donc DEUX chaînes différentes, identiques à
// l'œil : la recherche des pièces déjà déposées ne trouvait rien, et le script
// refusait de s'exécuter. Trouvé parce qu'il refuse — un rapprochement muet
// aurait créé les entrées SANS leurs pièces, et personne ne l'aurait vu.
const cleNom = (n) => String(n || '').normalize('NFC')

// ⚠ Les fichiers DÉJÀ dans le bucket (déposés sur le projet « SCI Violette »)
// sont RÉFÉRENCÉS, jamais re-téléversés : le même objet cité deux fois, comme le
// fait « Reprendre une pièce du dossier » (046). Les retéléverser créerait des
// doublons de plusieurs mégaoctets dans le Storage pour la même pièce.
const DEPUIS_PROJET = ['Procès-verbal de constat KLEIN DELGRANGE 21_09_23.pdf',
  'MINUTE - Ordonnance de référé 29 10 24.pdf',
  'Procès-verbal de constat KLEIN DELGRANGE 26_02_26_compressed.pdf',
  'Procès-verbal de constat Me Klein 10_9_26.pdf']

// À téléverser depuis le dossier : ces actes ne sont nulle part dans l'app.
// ⚠ Les gros constats ne sont PAS de la liste — ils sont déjà au bucket.
const A_TELEVERSER = [
  'Procédure SCI Violette 2017.pdf',
  'mail Me Raimond 10_08_2022.pdf',
  'CCL n°1 référés - 22 09 2026.pdf',
  'Etat CARPA - 08_09_2026.pdf',
  'Lettre à M. FAVRE (+ copie FONCIA et M. PRIVAT).pdf',
]

/** La chronologie. `pj` nomme les fichiers à rattacher, par leur nom de fichier. */
const ENTREES = [
  {
    date: '2016-09-03',
    titre: 'L’assemblée autorise l’action en justice contre la SCI Violette',
    html: P(
      'Résolution n° 11, <strong>adoptée</strong> : le syndic est autorisé à agir devant toutes juridictions, appel compris, contre la SCI Violette pour non-respect du nouvel article 15 de l’additif au cahier des charges. Provision de 3 000 €.',
      'C’est l’acte fondateur du contentieux.',
      SRC('procès-verbal de l’assemblée générale ordinaire 2016'),
    ),
  },
  {
    date: '2016-12-21',
    titre: 'Appel de la provision de 3 000 € pour la procédure',
    html: P(
      'Foncia Maison de l’Immobilier appelle la <strong>provision n° 1</strong> auprès des colotis, au titre de la procédure autorisée trois mois plus tôt.',
      SRC('appel de provisions du 21 décembre 2016, au dossier'),
    ),
    pj: ['Procédure SCI Violette 2017.pdf'],
  },
  {
    date: '2017-07-20',
    titre: 'Rencontre avec la SCI : engagement d’élaguer avant le 30 novembre 2017',
    html: P(
      'Le syndic rencontre la SCI Violette. Son représentant s’engage à élaguer, voire à abattre certains arbres, au plus tard le 30 novembre 2017. À défaut, l’assemblée décide de poursuivre l’action judiciaire.',
      SRC('compte rendu porté au procès-verbal de l’assemblée générale ordinaire 2017'),
    ),
  },
  {
    date: '2018-06-23',
    titre: 'Élagage réalisé fin 2017 — l’assemblée demande l’enlèvement de deux arbres',
    html: P(
      'Des travaux d’élagage ont été réalisés fin 2017. L’assemblée demande que les <strong>deux arbres situés devant la maison</strong> soient enlevés, faute de quoi la procédure sera engagée.',
      SRC('procès-verbal de l’assemblée générale ordinaire 2018'),
    ),
  },
  {
    date: '2020-10-24',
    titre: 'L’assemblée autorise une NOUVELLE action : l’article 15 est de nouveau méconnu',
    html: P(
      'Résolution n° 13, <strong>adoptée</strong> : autorisation d’agir en justice, appel compris, pour non-respect <em>à nouveau</em> du nouvel article 15. Provision de 3 000 €.',
      'Quatre ans après la première autorisation, et malgré l’élagage de 2017, le dossier repart de zéro.',
      SRC('procès-verbal de l’assemblée générale ordinaire 2020 et journal du projet « SCI Violette »'),
    ),
  },
  {
    date: '2021-06-15',
    titre: 'Premier procès-verbal de constat d’huissier',
    html: P(
      'Constat dressé pour établir l’état des plantations.',
      SRC('pièce n° 4 de la liste annexée aux conclusions de référé du 22 septembre 2026'),
    ),
  },
  {
    date: '2021-07-08',
    titre: 'Mandat donné à Me Raimond',
    html: P(
      'Le conseil syndical confie le dossier au cabinet Merotto (Me Antoine Raimond).',
      SRC('journal du projet « SCI Violette »'),
    ),
  },
  {
    date: '2021-07-15',
    titre: 'Mise en demeure par avocat',
    html: P(SRC('pièce n° 5 de la liste annexée aux conclusions de référé du 22 septembre 2026')),
  },
  {
    date: '2021-11-05',
    titre: 'Second procès-verbal de constat d’huissier : les travaux n’ont pas été faits',
    html: P(
      'Le second constat établit que les travaux demandés n’ont pas été réalisés. C’est lui qui déclenche l’action en justice.',
      SRC('pièce n° 6 de la liste annexée aux conclusions de référé du 22 septembre 2026'),
    ),
  },
  {
    date: '2021-11-15',
    titre: 'Courrier officiel du cabinet RTA, conseil de la SCI Violette',
    html: P(SRC('pièce n° 7 de la liste annexée aux conclusions de référé du 22 septembre 2026')),
  },
  {
    date: '2021-11-20',
    titre: 'L’assemblée vote une provision complémentaire',
    html: P(
      'Résolution n° 8, <strong>adoptée</strong> : compte rendu de la procédure et provision complémentaire.',
      SRC('procès-verbal de l’assemblée générale ordinaire 2021'),
    ),
  },
  {
    date: '2021-12-03',
    titre: 'Courrier officiel du cabinet Merotto',
    html: P(SRC('pièce n° 8 de la liste annexée aux conclusions de référé du 22 septembre 2026')),
  },
  {
    date: '2022-06-07',
    titre: 'Rendez-vous sur site avec Mme Arnal — resté sans suite',
    html: P(
      'Rendez-vous sur place pour lui signifier les arbres non conformes. Elle devait revenir vers le conseil après en avoir parlé au propriétaire, <strong>ce qu’elle n’a jamais fait</strong>.',
      SRC('journal du projet « SCI Violette »'),
    ),
  },
  {
    date: '2022-08-10',
    titre: 'Assignation rédigée — l’avocat recommande qu’un COLOTI soit demandeur',
    html: P(
      'Me Raimond a rédigé l’assignation définitive. Il indique avoir écrit au conseil de la SCI Violette, qui partage sa vision d’une issue amiable.',
      '⚠ Point déterminant pour la suite : selon lui, <strong>le syndicat n’est pas recevable</strong> — le cahier des charges est un contrat entre colotis — et il faut qu’un coloti soit demandeur. C’est pourquoi la procédure est portée par MM. Favre et Privat, aux côtés du syndicat.',
      SRC('courriel de Me Raimond du 10 août 2022'),
    ),
    pj: ['mail Me Raimond 10_08_2022.pdf'],
  },
  {
    date: '2023-09-21',
    titre: 'Procès-verbal de constat de Me Klein',
    html: P(
      'Constat des plantations, qui servira de base à l’ordonnance : les arbres y sont identifiés par le numéro 4 et les lettres A, B et C.',
      SRC('journal du projet « SCI Violette » ; acte au dossier'),
    ),
    pj: ['Procès-verbal de constat KLEIN DELGRANGE 21_09_23.pdf'],
  },
  {
    date: '2024-10-29',
    titre: 'ORDONNANCE DE RÉFÉRÉ : la SCI Violette est condamnée à abattre',
    html: P(
      'Tribunal judiciaire de Thonon-les-Bains, président François Bouriaud. RG 23/00178.',
      '<strong>Abattage</strong> des arbres identifiés au constat de Me Klein par le n° 4 et les lettres A, B et C, dans les six mois suivant la signification, puis <strong>astreinte provisoire de 100 € par jour</strong> pendant cinq mois.',
      '⚠ Les demandes d’<strong>élagage des arbres n° 1, 2 et 3</strong> et la demande de provision sont <strong>rejetées</strong> — le tribunal n’a pas tout accordé.',
      '<strong>3 000 €</strong> au titre de l’article 700, et condamnation aux dépens, y compris le coût du constat de Me Klein tel que taxé.',
      SRC('ordonnance de référé du 29 octobre 2024, au dossier'),
    ),
    pj: ['MINUTE - Ordonnance de référé 29 10 24.pdf'],
  },
  {
    date: '2026-02-26',
    titre: 'Constat de Me Klein : les arbres n’ont pas été abattus',
    html: P(
      'Constat dressé pour établir l’inexécution de l’ordonnance et préparer la liquidation de l’astreinte.',
      '⚠ Le journal du projet date cette entrée du 21 février ; l’acte lui-même porte le <strong>26 février 2026</strong>. C’est la date de l’acte qui est retenue ici.',
      SRC('journal du projet « SCI Violette » ; acte au dossier'),
    ),
    pj: ['Procès-verbal de constat KLEIN DELGRANGE 26_02_26_compressed.pdf'],
  },
  {
    date: '2026-09-07',
    titre: 'Le compte CARPA n’est toujours pas provisionné',
    html: P(
      'À cette date, la SCI Violette n’a pas versé le complément réclamé sur le compte CARPA de l’avocat.',
      SRC('lettre de Me Merotto du 23 septembre 2026 ; état CARPA du 8 septembre 2026'),
    ),
    pj: ['Etat CARPA - 08_09_2026.pdf'],
  },
  {
    date: '2026-09-10',
    titre: 'Constat de Me Klein : hauteur des arbres et abri de jardin non cadastré',
    html: P(
      'Nouveau constat, qui relève la hauteur des arbres et la présence d’un <strong>abri de jardin non cadastré</strong>.',
      SRC('journal du projet « SCI Violette » ; acte au dossier'),
    ),
    pj: ['Procès-verbal de constat Me Klein 10_9_26.pdf'],
  },
  {
    date: '2026-09-15',
    titre: 'L’assemblée est informée de la liquidation de l’astreinte à venir',
    html: P(
      'Résolution n° 24 (information) : Me Raimond prépare ses conclusions relatives à la liquidation de l’astreinte ; audience fixée au 22 septembre 2026, un renvoi restant envisageable.',
      SRC('procès-verbal de l’assemblée générale ordinaire 2026'),
    ),
  },
  {
    date: '2026-09-22',
    titre: 'Audience de référé : liquidation de l’astreinte et nouvelle demande d’abattage',
    html: P(
      'Tribunal judiciaire de Thonon-les-Bains, RG 26/00163. Conclusions n° 1 pour MM. Favre et Privat et le syndicat.',
      'Demandes : <strong>liquidation de l’astreinte</strong> du 15 mai au 15 octobre 2025 ; <strong>nouvelle astreinte définitive de 500 € par jour</strong> jusqu’à l’abattage des arbres n° 4, A, B et C ; <strong>abattage des arbres n° 2 et 3</strong> sous six mois puis astreinte de 100 € par jour pendant cinq mois ; <strong>4 000 €</strong> au titre de l’article 700 ; dépens.',
      SRC('conclusions n° 1 du 22 septembre 2026, au dossier'),
    ),
    pj: ['CCL n°1 référés - 22 09 2026.pdf'],
  },
  {
    date: '2026-09-23',
    titre: 'Exécution forcée : 2 925,24 € recouvrés, 1 454,52 € restent dus',
    html: P(
      'L’avocat a confié l’original de l’ordonnance à un commissaire de justice (SAS Sage & Associés) pour recouvrer <strong>4 571,72 €</strong> : dépens (assignation 54,82 € ; signification de conclusions 98,22 € ; rémunération de Me Klein taxée 1 343,30 € ; signification de l’ordonnance 75,38 €) et 3 000 € au titre de l’article 700, outre 13 € de droit de plaidoirie.',
      '⚠ Le commissaire de justice <strong>n’a pas recouvré l’intégralité</strong> : il a obtenu <strong>2 925,24 €</strong>, laissant de côté la signification des conclusions, la rémunération de Me Klein et le droit de plaidoirie.',
      'Solde dû par la SCI Violette : <strong>1 454,52 €</strong>, outre intérêts éventuels. L’avocat en sollicite immédiatement le paiement.',
      SRC('lettre de Me Merotto du 23 septembre 2026'),
    ),
    pj: ['Lettre à M. FAVRE (+ copie FONCIA et M. PRIVAT).pdf'],
  },
]

const SYNTHESE = P(
  'La SCI Violette (36 allée de Rives) ne respecte pas le <strong>nouvel article 15 de l’additif au cahier des charges</strong> sur la hauteur des plantations. Les procès-verbaux d’assemblée le datent du 15 janvier 1957 ; les conclusions de 2026 citent un acte de dépôt du 26 mars 1956 — les deux références figurent au dossier.',
  '<strong>Dix ans de procédure.</strong> L’assemblée autorise une première action en 2016. Un élagage est obtenu fin 2017 après un engagement pris en séance, mais les deux arbres devant la maison restent. L’assemblée doit <strong>réautoriser</strong> une action en 2020 ; deux constats d’huissier et deux mises en demeure plus tard, l’affaire est portée devant le juge des référés.',
  '⚠ <strong>C’est un contrat entre colotis, pas une affaire du syndicat seul.</strong> L’avocat a averti en 2022 que le syndicat risquait l’irrecevabilité : la procédure est donc portée par MM. Favre et Privat aux côtés du syndicat. Ce point commande la forme de toute action fondée sur le cahier des charges.',
  '<strong>Ordonnance du 29 octobre 2024</strong> : abattage des arbres n° 4, A, B et C sous six mois, puis astreinte de 100 € par jour pendant cinq mois ; 3 000 € au titre de l’article 700 et dépens. Les demandes d’élagage des arbres n° 1, 2 et 3 sont rejetées.',
  '<strong>Elle n’a pas été exécutée.</strong> Le constat du 26 février 2026 établit que les arbres n’ont pas été abattus ; celui du 10 septembre 2026 relève en outre un abri de jardin non cadastré. Une audience s’est tenue le 22 septembre 2026 pour liquider l’astreinte, demander une astreinte définitive de 500 € par jour et l’abattage de deux arbres supplémentaires.',
  'Côté argent, sur 4 571,72 € dus au titre de la première ordonnance, <strong>2 925,24 € ont été recouvrés</strong> et <strong>1 454,52 € restent impayés</strong> au 7 septembre 2026.',
  '<em>Synthèse établie le 29 septembre 2026 d’après les procès-verbaux d’assemblée, le journal du projet « SCI Violette » et les actes du dossier. Seuls les actes font foi.</em>',
)

async function lireEnvFichier() {
  try {
    const texte = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of texte.split('\n')) {
      const propre = ligne.replace(/[\u2028\u2029\uFEFF\u00A0\u200B]/g, '').trim()
      if (!propre || propre.startsWith('#')) continue
      const i = propre.indexOf('=')
      if (i < 1) continue
      out[propre.slice(0, i).trim()] = propre.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch { return {} }
}

const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

async function main() {
  W(`# Contentieux SCI Violette dans la mémoire — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const { data: presidents } = await supabase.from('membres_cs')
    .select('id, nom, prenom').eq('role', 'president').eq('actif', true)
  const auteur = presidents?.[0]
  if (!auteur) throw new Error('Aucun président actif : impossible de désigner l’auteur.')

  // ------------------------------------------- les pièces déjà au bucket
  const { data: projets } = await supabase.from('projets').select('id, nom')
  const projet = projets.find((p) => /violette/i.test(p.nom))
  const { data: journal } = await supabase.from('journal_projet')
    .select('documents').eq('projet_id', projet?.id || '00000000-0000-0000-0000-000000000000')
  const dejaAuBucket = new Map()
  for (const e of journal || []) for (const d of e.documents || []) dejaAuBucket.set(cleNom(d.name), d)
  const absentes = DEPUIS_PROJET.filter((n) => !dejaAuBucket.has(cleNom(n)))
  if (absentes.length) throw new Error(`Pièce(s) attendue(s) au projet et introuvable(s) : ${absentes.join(', ')}`)
  W(`${dejaAuBucket.size} pièce(s) déjà au Storage via le projet « ${projet.nom} » — référencées, pas recopiées.`)
  W('')

  // ------------------------------------------------------------ le sujet
  const { data: sujets } = await supabase.from('sujets').select('id, titre')
  let sujet = sujets.find((x) => x.titre === SUJET.titre)
  if (!sujet) {
    W(`## Sujet à créer : « ${SUJET.titre} » (${SUJET.categorie})`)
    W('')
    if (GO) {
      const { data, error } = await supabase.from('sujets')
        .insert({ ...SUJET, contenu: SYNTHESE, created_by: auteur.id }).select().single()
      if (error) throw new Error(`Création du sujet : ${error.message}`)
      sujet = data
      W('✅ Sujet créé, avec sa synthèse.')
      W('')
    }
  } else {
    W(`Sujet « ${SUJET.titre} » déjà présent.`)
    W('')
  }

  // -------------------------------------------------- les téléversements
  const televersees = new Map()
  W('## Pièces du dossier à téléverser')
  W('')
  for (const nom of A_TELEVERSER) {
    const chemin = join(DOSSIER, nom)
    const info = await stat(chemin).catch(() => null)
    if (!info) { W(`- ⚠ **${nom}** — introuvable sur le disque, ignorée.`); continue }
    // ⚠ Le plafond de production est de 25 Mo par fichier (`MAX_DOC_BYTES`) : le
    // dépasser ferait échouer l'envoi, pas l'entrée.
    if (info.size > 25 * 1024 * 1024) { W(`- ⚠ **${nom}** — ${(info.size / 1048576).toFixed(1)} Mo, au-delà du plafond de 25 Mo. Ignorée.`); continue }
    W(`- ${nom} — ${(info.size / 1024).toFixed(0)} ko`)
    if (!GO || !sujet) continue
    const path = `sujets/${sujet.id}/${randomUUID()}${extname(nom)}`
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, await readFile(chemin), { contentType: 'application/pdf', upsert: false })
    if (error) throw new Error(`Envoi de « ${nom} » : ${error.message}`)
    televersees.set(cleNom(nom), {
      id: randomUUID(), name: nom, path, size: info.size,
      type: 'application/pdf', uploaded_at: new Date().toISOString(),
    })
  }
  W('')

  // ---------------------------------------------------------- les entrées
  const { data: existantes } = await supabase.from('sujet_entrees')
    .select('date_evenement, titre').eq('sujet_id', sujet?.id || '00000000-0000-0000-0000-000000000000')
  const deja = new Set((existantes || []).map((e) => `${e.date_evenement}|${e.titre}`))

  const aInserer = []
  W('## Chronologie')
  W('')
  for (const e of ENTREES) {
    if (deja.has(`${e.date}|${e.titre}`)) continue
    const docs = (e.pj || []).map((n) => {
      const d = dejaAuBucket.get(cleNom(n)) || televersees.get(cleNom(n))
      // ⚠ Une nouvelle référence au MÊME chemin, id neuf : le fichier n'existe
      // qu'une fois, il est cité deux fois (046). En retirer une ne touche pas
      // l'autre, et « Retirer » n'efface jamais l'objet du Storage.
      return d ? { ...d, id: randomUUID() } : null
    }).filter(Boolean)
    const manquantes = (e.pj || []).length - docs.length
    W(`- **${e.date}** — ${e.titre}${docs.length ? ` *(${docs.length} pièce${docs.length > 1 ? 's' : ''})*` : ''}${manquantes && GO ? ` ⚠ ${manquantes} pièce(s) non rattachée(s)` : ''}`)
    aInserer.push({
      sujet_id: sujet?.id || null,
      date_evenement: e.date,
      titre: e.titre,
      contenu: e.html,
      documents: docs,
      auteur_id: auteur.id,
    })
  }
  W('')
  W(`**${aInserer.length} entrée(s) à créer** sur ${ENTREES.length} au total.`)
  W('')

  if (GO && aInserer.length) {
    if (!sujet) throw new Error('Sujet absent : rien n’a été écrit.')
    for (let i = 0; i < aInserer.length; i += 25) {
      const { error } = await supabase.from('sujet_entrees').insert(aInserer.slice(i, i + 25))
      if (error) throw new Error(`Écriture : ${error.message}`)
    }
    W(`✅ ${aInserer.length} entrée(s) créée(s).`)
    W('')
  } else if (!aInserer.length) {
    W('Rien à écrire — la chronologie est déjà en place.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `memoire_sci_violette_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
