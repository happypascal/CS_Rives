#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// STATUT DES TITRES DE PROPRIÉTÉ — état de Me Garnier du 10 novembre 2026
// (migrations 059, 071, 072)
//
// Pascal, 12 novembre 2026 : « tu peux mettre à jour le registre par rapport
// aux réponses de Me Garnier ».
//
// SOURCES, toutes deux des courriels de l'étude, pas des déductions :
//   1. « TITRES NON RECUS AU 10/11/2026 » — état adressé par l'Office du Parc
//      à M. Yannick Garnier le 10 novembre 2026 à 16 h 35, transféré à Pascal
//      le même jour à 16 h 54. Il classe les dossiers en QUATRE catégories et
//      ne nomme que les dossiers à problème : 26 lignes sur 50 lots.
//   2. Courriel de M. Garnier du 11 novembre 2026 à 10 h 26, « Ok retrouvé » :
//      le titre de Mme Gachoud (0B 217), que l'état du 10 novembre rangeait
//      parmi les envois non retrouvés, est bien à l'étude.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ LES 24 LOTS QUE L'ÉTAT NE NOMME PAS SONT EN ORDRE — PAR COMPLÉMENT
// ──────────────────────────────────────────────────────────────────────────────
// L'état est une liste de dossiers à régulariser, pas un tableau des 50 lots.
// Un lot absent des quatre catégories n'a donc PLUS RIEN à fournir : c'est la
// seule lecture possible d'un état intitulé « titres NON reçus ». Le complément
// a été calculé lot par lot sur les 50 du registre, et il tombe juste :
// 16 + 3 + 5 + 2 = 26 nommés, 24 absents, 26 + 24 = 50.
//
// Cette lecture par complément fait passer CINQ lots à « reçu » qui ne
// figuraient pas parmi les 25 surlignés de l'état du 30 octobre (0B 206,
// 0B 216, 0B 224, 0B 231, 0B 241) et en fait REDESCENDRE SIX de « reçu » à
// « incomplet » (0B 197, 0B 198, 0B 204, 0B 239, 0B 244, 0B 247+263) : l'étude
// a regardé les pièces de plus près depuis, et ce qu'elle tenait pour un titre
// n'en est pas un. Un registre qui ne redescendrait jamais serait un registre
// qui ment.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ DEUX ARBITRAGES À CONFIRMER PAR PASCAL AVANT D'ÉCRIRE
// ──────────────────────────────────────────────────────────────────────────────
// 1. 0B 209 (Naujoks/Schoning) et 0B 218 (Deschamps-Jacquier) sont mis à
//    `envoi_constate` et non à `a_verifier`, parce que Pascal détient leurs
//    courriels — c'est la définition même de l'état ouvert par la 072. S'il ne
//    les détient pas, mettre 'a_verifier' dans les deux lignes ci-dessous.
// 2. La date du 30 septembre 2026 portée sur 0B 217 est une VRAIE date de
//    réception : M. Garnier a répondu « Bien reçu » à Mme Gachoud ce jour-là à
//    14 h 44. Elle ne s'écrase pas, elle se constate.
//
// La date du 10 novembre portée sur les cinq nouveaux reçus est, elle, une
// BORNE SUPÉRIEURE, comme celle du 30 octobre : l'état dit qui a transmis,
// jamais quand. Chaque ligne le porte dans ses observations.
//
// ⚠ ON N'ÉCRASE JAMAIS UNE DATE DÉJÀ POSÉE.
//
// Usage :
//   node scripts/statut_titres_2026-11-11.mjs        essai à blanc
//   node scripts/statut_titres_2026-11-11.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

const DATE_ETAT = '2026-11-10'
const BORNE = 'Transmission constatée par complément sur l’état « TITRES NON RECUS AU '
  + '10/11/2026 » de l’Office du Parc : ce lot n’y figure dans aucune des quatre '
  + 'catégories. ⚠ Date de CONSTAT, pas de réception : l’état ne date pas les envois.'

// ──────────────────────────────────────────────────────────────────────────────
// L'ÉTAT DU 10 NOVEMBRE, CATÉGORIE PAR CATÉGORIE
// ──────────────────────────────────────────────────────────────────────────────
// `numero` est celui du REGISTRE, pas celui de l'état.
//
// ⚠ ET LE REGISTRE GROUPE LES PARCELLES CONTIGUËS. L'étude écrit « B689 B690 »
// et « B691 B692 B693 B694 » ; le registre porte « 0B 689+690+693 » et
// « 0B 691+692+694 » — un seul numéro par lot, les trois ou quatre parcelles
// réunies. La première version de ce fichier visait « 0B 689 » et « 0B 692 »,
// qui n'existent pas : le contrôle d'existence a refusé d'écrire, et c'est
// exactement son rôle. Abréger ces deux désignations reviendrait d'ailleurs à
// trancher par l'orthographe le litige qui attend la réponse de Me Garnier —
// la B693 est chez Hartwig-Ormyron au registre, chez Jeanlu selon l'étude.
//
// Les écarts de désignation sont signalés en observations, ils ne se corrigent
// pas ici.

const CIBLES = [
  // ── 1. Titres non reçus (16) ───────────────────────────────────────────────
  ...[
    ['0B 223', ''], ['0B 210', ''], ['0B 236', ''], ['0B 232', ''],
    ['0B 225', ''], ['0B 203', ''], ['0B 201', ''], ['0B 229', ''],
    ['0B 227', ''], ['0B 240', ''], ['0B 234', ''], ['0B 220', ''],
    ['0B 214', ' ⚠ Le registre portait une date de transmission au 22/09/2026, '
      + 'effacée ici : la contrainte de cohérence réserve cette date aux titres reçus '
      + 'ou incomplets. L’état du 10/11/2026 range ce lot parmi les titres non reçus '
      + '(arbitrage du conseil, 12/11/2026). La date est conservée dans la sauvegarde '
      + 'et dans cette mention.'],
    ['0B 211', ' L’étude désigne la parcelle B211 ; le lot porte en réalité la '
      + 'parcelle B212, la B211 appartenant à la commune.'],
    ['0B 689+690+693', ' L’étude désigne « B689 B690 » ; le registre et le rapport du '
      + '10/11/2026 y rattachent aussi la B693. Désignation à trancher sur titre.'],
  ].map(([numero, suite]) => ({
    numero,
    statut: 'non_envoye',
    observation: 'Porté aux « titres non reçus » de l’état de l’Office du Parc du '
      + '10/11/2026.' + suite,
  })),

  // ── 2. Dits envoyés mais non reçus (3, dont une résolue le 11) ─────────────
  {
    numero: '0B 209',
    statut: 'envoi_constate', // ⚠ voir arbitrage 1 en tête de fichier
    observation: 'L’état de l’Office du Parc du 10/11/2026 le range parmi les envois '
      + 'que l’étude ne retrouve pas, alors que le coloti a écrit l’avoir adressé et '
      + 'que le conseil détient son courriel. Transféré à l’étude par Pascal.',
  },
  {
    numero: '0B 218',
    statut: 'envoi_constate', // ⚠ voir arbitrage 1 en tête de fichier
    observation: 'L’état de l’Office du Parc du 10/11/2026 le range parmi les envois '
      + 'que l’étude ne retrouve pas, alors que le coloti a écrit l’avoir adressé et '
      + 'que le conseil détient son courriel. Transféré à l’étude par Pascal.',
  },
  {
    numero: '0B 217',
    statut: 'recu',
    // ⚠ DATE RÉELLE : accusé de réception de M. Garnier du 30/09/2026 à 14 h 44.
    transmis_le: '2026-09-30',
    declare_le: '2026-09-30',
    observation: 'Titre adressé à l’étude le 30/09/2026 et accusé réception le jour '
      + 'même par M. Garnier (« Bien reçu »). Rangé par erreur parmi les envois non '
      + 'retrouvés dans l’état du 10/11/2026, retrouvé le 11/11/2026 (« Ok retrouvé »).',
  },

  // ── 3. Pièces ne correspondant pas à un titre de propriété (5) ─────────────
  ...[
    ['0B 197', ''], ['0B 198', ''], ['0B 239', ''],
    ['0B 247+263', ' L’étude désigne « B247 B263 ».'],
    ['0B 691+692+694', ' L’étude désigne « B691 B692 B693 B694 » et rattache donc la B693 '
      + 'à ce lot, contrairement au registre. Désignation à trancher sur titre.'],
  ].map(([numero, suite]) => ({
    numero,
    statut: 'incomplet',
    observation: 'L’étude a reçu une attestation ou une pièce qui ne correspond pas '
      + 'au titre de propriété (état de l’Office du Parc du 10/11/2026).' + suite,
  })),

  // ── 3 bis. Pargoux : envoyé, mais l'attestation manque ─────────────────────
  // ⚠ ARBITRAGE DE PASCAL DU 12 NOVEMBRE, CONTRE LA CATÉGORIE DE L'ÉTAT.
  // L'état du 10/11 range 0B 199 parmi les « TITRES NON RECUS » — mais la note
  // qui suit son tableau dit « Mme Anne PARGOUX relancée ce jour pour récupérer
  // Attestation de Propriété ». On ne relance pas pour RÉCUPÉRER une pièce
  // nommée quelqu'un qui n'a rien adressé : il manque une pièce à un envoi,
  // c'est la définition de « incomplet ». Pascal, qui a le courriel, tranche
  // en ce sens.
  //
  // ⚠ CE CHOIX DÉPLACE LA CIBLE DU BRIEF : 15 non envoyés et 8 incomplets, au
  // lieu de 16 et 7. Le total reste 50.
  {
    numero: '0B 199',
    statut: 'incomplet',
    observation: 'L’étude a été relancée le 10/11/2026 pour récupérer l’attestation de '
      + 'propriété : un envoi a bien eu lieu, il y manque cette pièce. ⚠ L’état de '
      + 'l’Office du Parc du 10/11/2026 range ce lot parmi les « titres non reçus » ; '
      + 'c’est la note qui suit son tableau, et le courriel de la colotie, qui font foi '
      + 'ici (arbitrage du conseil, 12/11/2026).',
  },

  // ── 4. Titres envoyés mais pages manquantes (2) ────────────────────────────
  {
    numero: '0B 244',
    statut: 'incomplet',
    observation: 'Titre reçu par l’étude mais incomplet : il manque la page 2 de '
      + 'l’acte (états civils). État de l’Office du Parc du 10/11/2026.',
  },
  {
    numero: '0B 204',
    statut: 'incomplet',
    observation: 'Titre reçu par l’étude mais incomplet : il manque la page 1 (états '
      + 'civils et effets relatifs). État de l’Office du Parc du 10/11/2026.',
  },

  // ── 5. Les 24 lots que l'état ne nomme pas : rien à fournir ────────────────
  ...[
    '0B 196', '0B 200', '0B 202', '0B 205', '0B 206', '0B 207', '0B 208',
    '0B 215', '0B 216', '0B 219', '0B 224', '0B 230', '0B 231', '0B 241',
    '0B 226',
    '0B 233', '0B 235', '0B 237', '0B 238',
    '0B 242', '0B 243', '0B 245', '0B 246', '0B 474+263',
  ].map((numero) => ({
    numero, statut: 'recu', transmis_le: DATE_ETAT, observation: BORNE,
  })),
]

// ⚠ Un lot compté deux fois, ou l'un des 50 oublié, invaliderait la lecture par
// complément : on le vérifie AVANT de toucher à la base.
const vus = new Set()
for (const c of CIBLES) {
  if (vus.has(c.numero)) {
    console.error(`❌ ${c.numero} figure deux fois dans les cibles. Rien n’est écrit.`)
    process.exit(1)
  }
  vus.add(c.numero)
}
if (CIBLES.length !== 50) {
  console.error(`❌ ${CIBLES.length} cibles au lieu de 50. Rien n’est écrit.`)
  process.exit(1)
}

async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      const propre = ligne.replace(/[﻿ ​]/g, '').trim()
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

const { data: lots, error: eL } = await supabase.from('lots').select('id,numero,zone')
if (eL) { console.error(`❌ Lecture de \`lots\` : ${eL.message}`); process.exit(1) }
const { data: periodes, error: eP } = await supabase.from('proprietaires').select('*').is('date_cession', null)
if (eP) { console.error(`❌ Lecture de \`proprietaires\` : ${eP.message}`); process.exit(1) }

const parNumero = new Map(lots.map((l) => [l.numero, l]))
const periodeDe = new Map(periodes.map((p) => [p.lot_id, p]))

const introuvables = CIBLES.filter((c) => !parNumero.has(c.numero)).map((c) => c.numero)
if (introuvables.length) {
  console.error(`❌ Parcelles absentes du registre : ${introuvables.join(', ')}. Rien n’est écrit.`)
  process.exit(1)
}

const DATE_RECU = new Set(['recu', 'incomplet'])

const aEcrire = []
const inchanges = []
const ecartees = []

for (const c of CIBLES) {
  const lot = parNumero.get(c.numero)
  const p = periodeDe.get(lot.id)
  if (!p) { ecartees.push(`${c.numero} — aucune période de propriété ouverte`); continue }

  const patch = {}

  if (p.acte_statut !== c.statut) patch.acte_statut = c.statut

  // La date : on pose celle de la cible si la ligne n'en a aucune, jamais sinon.
  if (c.transmis_le && !p.acte_transmis_le) {
    if (p.date_acquisition && p.date_acquisition > c.transmis_le) {
      ecartees.push(`${c.numero} — acquise le ${p.date_acquisition}, après ${c.transmis_le}`)
      continue
    }
    patch.acte_transmis_le = c.transmis_le
  }
  if (c.declare_le && !p.acte_declare_le) patch.acte_declare_le = c.declare_le

  // ⚠ CONTRAINTE `proprietaires_acte_statut_coherent` : une date de transmission
  // ne survit pas à un statut qui n'est ni `recu` ni `incomplet`. Un lot qui
  // redescend doit donc perdre sa date — et on le DIT, on ne l'efface pas en
  // silence.
  if (!DATE_RECU.has(c.statut) && p.acte_transmis_le) {
    patch.acte_transmis_le = null
    patch.__date_effacee = p.acte_transmis_le
  }

  const garde = { ...patch }
  delete garde.__date_effacee
  if (!Object.keys(garde).length) { inchanges.push({ c, p }); continue }

  const obs = (p.acte_observations || '').trim()
  garde.acte_observations = obs ? `${obs}\n${c.observation}` : c.observation
  garde.updated_at = new Date().toISOString()
  aEcrire.push({ c, p, patch: garde, dateEffacee: patch.__date_effacee || null })
}

const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
const ETIQ = {
  non_envoye: 'non envoyé', a_verifier: 'à vérifier',
  envoi_constate: 'envoi constaté', incomplet: 'incomplet', recu: 'reçu',
}

W(`# Statut des titres — état de Me Garnier du 10/11/2026 — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W('Sources : état « TITRES NON RECUS AU 10/11/2026 » de l’Office du Parc (26 lots')
W('nommés sur 50, les 24 autres en ordre par complément) et courriel du 11/11/2026')
W('retrouvant le titre de 0B 217.')
W('')
W(`**${aEcrire.length} ligne(s) à modifier** · ${inchanges.length} déjà conformes · ${ecartees.length} écartée(s).`)
W('')

const compte = {}
for (const c of CIBLES) compte[c.statut] = (compte[c.statut] || 0) + 1
W('## Cible')
W('')
W('| Statut | Lots |')
W('|---|---:|')
for (const [s, n] of Object.entries(compte)) W(`| ${ETIQ[s]} | ${n} |`)
W(`| **Total** | **${CIBLES.length}** |`)
W('')

if (aEcrire.length) {
  W('## Modifications')
  W('')
  W('| Parcelle | Propriétaire | Avant | Après | Date |')
  W('|---|---|---|---|---|')
  for (const { c, p, patch, dateEffacee } of aEcrire) {
    const avant = ETIQ[p.acte_statut] || p.acte_statut
    const apres = ETIQ[c.statut]
    const d = dateEffacee ? `~~${dateEffacee}~~ effacée`
      : patch.acte_transmis_le ? patch.acte_transmis_le
        : (p.acte_transmis_le || '—')
    W(`| ${c.numero} | ${p.nom}${p.nom_2 ? ` / ${p.nom_2}` : ''} | ${avant} | ${apres} | ${d} |`)
  }
  W('')
  const redescendus = aEcrire.filter(({ c, p }) => p.acte_statut === 'recu' && c.statut !== 'recu')
  if (redescendus.length) {
    W(`### ⚠ ${redescendus.length} lot(s) qui redescendent de « reçu »`)
    W('')
    W('L’étude a regardé les pièces de plus près : ce qu’elle tenait pour un titre')
    W('n’en est pas un. Ces lots sont à relancer.')
    W('')
    for (const { c, p } of redescendus) W(`- ${c.numero} — ${p.nom} → ${ETIQ[c.statut]}`)
    W('')
  }
}
if (inchanges.length) {
  W(`## Déjà conformes (${inchanges.length})`)
  W('')
  for (const { c, p } of inchanges) W(`- ${c.numero} — ${p.nom} : ${ETIQ[c.statut]}`)
  W('')
}
if (ecartees.length) {
  W(`## ⚠ Écartées (${ecartees.length})`)
  W('')
  for (const s of ecartees) W(`- ${s}`)
  W('')
}

let faits = 0
if (GO && aEcrire.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `statut-titres-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'proprietaires.json'), JSON.stringify(periodes, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/statut-titres-${jour}\``)
  W('')
  for (const { c, p, patch } of aEcrire) {
    const { error } = await supabase.from('proprietaires').update(patch).eq('id', p.id)
    if (error) { W(`> ⚠ ${c.numero} — ${p.nom} : ${error.message}`); continue }
    faits += 1
  }
  W(`**${faits} ligne(s) modifiées.**`)
  W('')
}

W('---')
W('')
W(GO ? `**${faits} modifiées · ${inchanges.length} inchangées.**`
  : `**Essai à blanc : ${aEcrire.length} à modifier · ${inchanges.length} inchangées. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `statut_titres_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} modifiées · ${inchanges.length} inchangées.`
  : `${aEcrire.length} à modifier · ${inchanges.length} inchangées (essai à blanc).`)
