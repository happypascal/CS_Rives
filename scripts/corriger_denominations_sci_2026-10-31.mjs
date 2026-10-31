#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LA DÉNOMINATION DE KITKA, ALIGNÉE SUR LE REGISTRE OFFICIEL
//
// Arbitrage de Pascal, 31 octobre 2026, après la vérification au RNE :
//   « 1 retirer SCI
//     2 SCI MArguerite 7 AVENUE ALSACE-LORRAINE, 74100 ANNEMASSE est la bonne »
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QUI EST CORRIGÉ : UNE LIGNE, ET UNE SEULE
// ──────────────────────────────────────────────────────────────────────────────
// Le titulaire de la parcelle 0B 225 porte « SCI Kitka ». Le Registre National
// des Entreprises déclare « KITKA » (SIREN 832400535, société civile
// immobilière, dirigeants Nicolas Kah et Isabelle Kittler — les deux noms que
// notre propre registre rattache déjà à ce lot, ce qui établit qu'il s'agit
// bien de cette société). Le sigle que nous portons vient de l'import, pas de
// l'acte.
//
// ⚠ ET SCI MARGUERITE N'EST PAS CORRIGÉE, PARCE QU'ELLE EST JUSTE. Pascal a
// identifié la bonne : SIREN 448709139, 7 avenue Alsace-Lorraine à Annemasse,
// dirigeantes Ludivine Baud et Catherine Delucinge — nos deux représentantes
// légales. Sa dénomination DÉCLARÉE est « SCI MARGUERITE », sigle compris.
// Notre registre a donc raison sur celle-là. Elle figure ici en VÉRIFICATION,
// pour que le script échoue si quelqu'un l'a modifiée entre-temps.
//
// ⚠ POURQUOI LA VÉRIFICATION AUTOMATIQUE L'AVAIT MANQUÉE : « SCI MARGUERITE »
// rend plus de dix mille résultats, triés par pertinence, et celle d'Annemasse
// n'était pas dans les dix premiers. Une recherche par dénomination seule ne
// suffit pas sur un nom courant — il y faut un filtre géographique. C'est
// Pascal qui l'a trouvée, pas le script.
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QUI N'EST PAS TOUCHÉ
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ LA CASSE N'EST PAS ALIGNÉE SUR LE RNE. Le registre officiel écrit tout en
// capitales — « LOGUDORO », « LE CLAPOTIS » — parce que c'est la convention de
// l'INSEE, pas parce que la société s'appelle ainsi. Recopier ces capitales
// rendrait le registre des propriétaires illisible, et ferait croire à une
// correction là où il n'y a qu'un changement de rendu.
//
// ⚠ LES HUIT AUTRES SOCIÉTÉS SANS SIGLE NE SONT PAS TOUCHÉES NON PLUS : la
// vérification a confirmé qu'elles sont bien déclarées sans « SCI ». Entre Lac
// et Montagnes, GABISAM, Jeanlu, Le Clapotis, Logudoro, Maison du Lac et
// Precettes restent telles quelles.
//
// ──────────────────────────────────────────────────────────────────────────────
// Usage :
//   node scripts/corriger_denominations_sci_2026-10-31.mjs        (essai à blanc)
//   node scripts/corriger_denominations_sci_2026-10-31.mjs --go   (écrit)
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ⚠ CHAQUE CORRECTION PORTE LA VALEUR ATTENDUE AVANT. Un script qui écrase
// sans vérifier est un script de destruction : si la base a changé depuis le
// relevé, la ligne est REFUSÉE et signalée, pas corrigée à l'aveugle. Même
// doctrine que `corriger_resolutions_archives.mjs`.
const CORRECTIONS = [
  {
    parcelle: '0B 225',
    avant: 'SCI Kitka',
    apres: 'Kitka',
    siren: '832400535',
    motif: 'Déclarée « KITKA » au RNE, sans le sigle. Dirigeants Nicolas Kah et Isabelle Kittler.',
  },
]

// ⚠ PRÉNOM ET NOM INVERSÉS — trouvé le 31 octobre en vérifiant les dirigeants
// à la demande de Pascal. C'est l'erreur de saisie la plus difficile à voir :
// la fiche se lit sans heurt, « Mehdi Deena » n'a l'air faux qu'à qui connaît
// la personne. Le RNE déclare « DEENA MEHDI », GÉRANTE de la SCI Precettes
// (SIREN 509403119) — donc Deena est le prénom et Mehdi le patronyme.
//
// ⚠ CE N'EST PAS COSMÉTIQUE. Le registre trie et cherche sur le patronyme,
// l'export notaire et les convocations l'impriment, et c'est la gérante — la
// personne qui vote et signe pour la société en assemblée.
const INVERSIONS = [
  {
    parcelle: '0B 240',
    avant: { prenom: 'Mehdi', nom: 'Deena' },
    apres: { prenom: 'Deena', nom: 'Mehdi' },
    source: 'RNE, SIREN 509403119 : « DEENA MEHDI (BOUGARY) », gérante et associée indéfiniment responsable.',
  },
]

// Celles qu'on vérifie SANS les toucher : si l'une a bougé, c'est que
// quelqu'un a corrigé ailleurs et le rapport doit le dire.
const VERIFICATIONS = [
  {
    parcelle: '0B 216',
    attendu: 'SCI Marguerite',
    siren: '448709139',
    motif: 'Déclarée « SCI MARGUERITE » au RNE, sigle compris. 7 avenue Alsace-Lorraine, Annemasse. Dirigeantes Ludivine Baud et Catherine Delucinge.',
  },
]

async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // ⚠ Caractères invisibles en SÉQUENCES d échappement : écrits en
      // clair, U+2028 et U+2029 terminent la ligne pour JavaScript et
      // coupent le littéral de regex en deux.
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

const { data: lots, error: eL } = await supabase.from('lots').select('id,numero')
if (eL) { console.error(`❌ Lecture de \`lots\` : ${eL.message}`); process.exit(1) }
const lotParNumero = new Map(lots.map((l) => [l.numero, l]))

const { data: periodes, error: eP } = await supabase
  .from('proprietaires').select('id,lot_id,nom').is('date_cession', null)
if (eP) { console.error(`❌ Lecture de \`proprietaires\` : ${eP.message}`); process.exit(1) }

const { data: titulaires, error: eT } = await supabase
  .from('titulaires').select('id,nom,prenom,proprietaire_id,est_personne_morale').is('date_fin', null)
if (eT) { console.error(`❌ Lecture de \`titulaires\` : ${eT.message}`); process.exit(1) }

const lignes = []
const aEcrire = []

for (const c of CORRECTIONS) {
  const lot = lotParNumero.get(c.parcelle)
  if (!lot) { lignes.push({ ...c, verdict: 'parcelle introuvable' }); continue }
  const periode = periodes.find((p) => p.lot_id === lot.id)
  if (!periode) { lignes.push({ ...c, verdict: 'aucune période en cours' }); continue }
  const tit = titulaires.filter((t) => t.proprietaire_id === periode.id && t.est_personne_morale)
  if (tit.length !== 1) {
    lignes.push({ ...c, verdict: `${tit.length} titulaire(s) personne morale — on ne choisit pas` })
    continue
  }
  const t = tit[0]
  if (t.nom === c.apres) { lignes.push({ ...c, verdict: 'déjà corrigé' }); continue }
  if (t.nom !== c.avant) {
    lignes.push({ ...c, verdict: `REFUSÉ — la base porte « ${t.nom} », pas « ${c.avant} »` })
    continue
  }
  // ⚠ LE LIBELLÉ DE LA PÉRIODE SUIT, sans quoi la fiche et la liste des
  // parcelles diraient deux choses différentes. Ici il porte déjà « Kitka » —
  // la divergence existait avant ce script et c'est elle qui l'a révélée —
  // mais depuis le 31 octobre ce libellé se RECALCULE des titulaires : laissé
  // tel quel, il redeviendrait « SCI Kitka » au premier enregistrement de la
  // fiche. On le pose explicitement.
  aEcrire.push({
    correction: c,
    titulaire: t,
    periode,
    nomPeriodeAvant: periode.nom,
    nomPeriodeApres: c.apres,
  })
  lignes.push({ ...c, verdict: 'à corriger', detail: `titulaire « ${t.nom} » → « ${c.apres} » · période « ${periode.nom} » → « ${c.apres} »` })
}

// ── Les inversions prénom / nom ─────────────────────────────────────────────
const inversionsAEcrire = []
for (const inv of INVERSIONS) {
  const lot = lotParNumero.get(inv.parcelle)
  const periode = lot && periodes.find((p) => p.lot_id === lot.id)
  if (!periode) { lignes.push({ parcelle: inv.parcelle, avant: '—', apres: '—', siren: '', motif: inv.source, verdict: 'période introuvable' }); continue }
  const cibles = titulaires.filter((t) => t.proprietaire_id === periode.id
    && t.prenom === inv.avant.prenom && t.nom === inv.avant.nom)
  const dejaFait = titulaires.some((t) => t.proprietaire_id === periode.id
    && t.prenom === inv.apres.prenom && t.nom === inv.apres.nom)
  const etiquette = { parcelle: inv.parcelle, avant: `${inv.avant.prenom} ${inv.avant.nom}`, apres: `${inv.apres.prenom} ${inv.apres.nom}`, siren: '', motif: inv.source }
  if (dejaFait) { lignes.push({ ...etiquette, verdict: 'déjà corrigé' }); continue }
  if (cibles.length !== 1) {
    lignes.push({ ...etiquette, verdict: `REFUSÉ — ${cibles.length} titulaire(s) correspondent à « ${inv.avant.prenom} ${inv.avant.nom} »` })
    continue
  }
  inversionsAEcrire.push({ titulaire: cibles[0], inv })
  lignes.push({ ...etiquette, verdict: 'à corriger' })
}

for (const v of VERIFICATIONS) {
  const lot = lotParNumero.get(v.parcelle)
  const periode = lot && periodes.find((p) => p.lot_id === lot.id)
  const tit = periode && titulaires.filter((t) => t.proprietaire_id === periode.id && t.est_personne_morale)
  const nom = tit && tit.length === 1 ? tit[0].nom : null
  lignes.push({
    parcelle: v.parcelle,
    avant: v.attendu,
    apres: v.attendu,
    siren: v.siren,
    motif: v.motif,
    verdict: nom === v.attendu ? 'conforme, rien à faire' : `⚠ la base porte « ${nom ?? 'rien'} », attendu « ${v.attendu} »`,
  })
}

// ── Sauvegarde avant écriture ───────────────────────────────────────────────
// ⚠ Même sur une seule ligne. Une sauvegarde qu'on ne prend pas parce que « ce
// n'est qu'un champ » est exactement celle qui manque le jour où l'on s'est
// trompé de ligne.
const jour = new Date().toISOString().slice(0, 10)
if (GO && (aEcrire.length || inversionsAEcrire.length)) {
  await mkdir(join(RACINE, 'backup'), { recursive: true })
  const horodate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  await writeFile(
    join(RACINE, 'backup', `denominations-sci-${horodate}.json`),
    JSON.stringify({
      denominations: aEcrire.map((a) => ({
        titulaire_id: a.titulaire.id, nom: a.titulaire.nom,
        proprietaire_id: a.periode.id, nom_periode: a.nomPeriodeAvant,
      })),
      inversions: inversionsAEcrire.map((i) => ({
        titulaire_id: i.titulaire.id, prenom: i.titulaire.prenom, nom: i.titulaire.nom,
      })),
    }, null, 2),
    'utf8',
  )
}

// ⚠ L'inversion se pose en UN SEUL update : écrire le prénom puis le nom
// laisserait, entre les deux, une ligne portant deux fois la même valeur.
for (const i of GO ? inversionsAEcrire : []) {
  const r = await supabase.from('titulaires')
    .update({ prenom: i.inv.apres.prenom, nom: i.inv.apres.nom }).eq('id', i.titulaire.id).select()
  if (r.error) { console.error(`❌ titulaire ${i.titulaire.id} : ${r.error.message}`); process.exit(1) }
}

for (const a of GO ? aEcrire : []) {
  const r1 = await supabase.from('titulaires')
    .update({ nom: a.correction.apres }).eq('id', a.titulaire.id).select()
  if (r1.error) { console.error(`❌ titulaire ${a.titulaire.id} : ${r1.error.message}`); process.exit(1) }
  const r2 = await supabase.from('proprietaires')
    .update({ nom: a.nomPeriodeApres, updated_at: new Date().toISOString() })
    .eq('id', a.periode.id).select()
  if (r2.error) { console.error(`❌ période ${a.periode.id} : ${r2.error.message}`); process.exit(1) }
}

// ── Rapport ─────────────────────────────────────────────────────────────────
const out = []
out.push('# Dénominations des sociétés — correction')
out.push('')
out.push(`${GO ? 'Appliqué' : 'Essai à blanc'} le ${jour}. Source : RNE (INSEE).`)
out.push('')
out.push('| Parcelle | Chez nous | Doit devenir | SIREN | Verdict |')
out.push('|---|---|---|---|---|')
for (const l of lignes) {
  out.push(`| ${l.parcelle} | ${l.avant} | ${l.apres} | ${l.siren} | ${l.verdict} |`)
}
out.push('')
out.push('## Pourquoi')
out.push('')
for (const l of lignes) out.push(`- **${l.parcelle}** — ${l.motif}`)
out.push('')
out.push('> ⚠ La CASSE n’est pas alignée sur le RNE, qui écrit tout en capitales')
out.push('> par convention de l’INSEE. Les recopier rendrait le registre illisible')
out.push('> et ferait passer un changement de rendu pour une correction.')
out.push('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const chemin = join(RACINE, 'export', `correction_denominations_${jour}.md`)
await writeFile(chemin, out.join('\n'), 'utf8')

console.log(GO ? '✅ APPLIQUÉ' : '🔍 ESSAI À BLANC (ajouter --go pour écrire)')
for (const l of lignes) console.log(`  ${l.parcelle} · ${l.avant} → ${l.apres} · ${l.verdict}`)
console.log(`  → ${chemin.replace(RACINE + '/', '')}`)
