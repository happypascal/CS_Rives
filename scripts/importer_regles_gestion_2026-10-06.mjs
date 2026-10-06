#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LES RÈGLES DE GESTION PERMANENTES (migration 066)
// Brief du 6 octobre 2026 · données `scripts/data/regles_gestion_2026-10-06.json`
//
// 17 règles relues par Claude (Cowork) sur le texte des procès-verbaux.
// ⚠ LES TEXTES NE SE REFORMULENT PAS : le script lit le fichier et l'écrit tel
// quel. Il ne corrige ni un titre, ni un énoncé, ni un libellé de délai.
//
// ⚠ LA MIGRATION 066 DOIT ÊTRE PASSÉE AVANT — elle l'a été le 6 octobre, et le
// script le VÉRIFIE au lieu de le supposer : sans la table, PostgREST renvoie
// une erreur de cache de schéma qu'un lecteur pressé prendrait pour une panne.
//
// ──────────────────────────────────────────────────────────────────────────────
// LES LIENS SONT RÉSOLUS, JAMAIS FABRIQUÉS
// ──────────────────────────────────────────────────────────────────────────────
// `source_date_ag` ne correspond à AUCUNE colonne de la table : il ne sert qu'à
// retrouver l'archive ou l'assemblée, et il n'est pas stocké.
//
// ⚠ ÉCART CONSTATÉ AVEC LE BRIEF, et c'est le brief qui le tranche. Il annonce
// des liens « vers les AG du 19/01/2026 et du 15/09/2026 » ; or
// `assemblees_generales` ne contient QUE celle du 15/09/2026. L'assemblée du
// 19 janvier 2026 n'existe que comme ARCHIVE (rangée sous l'exercice 2025).
// Comme le brief interdit par ailleurs de créer une AG pour remplir un lien,
// cette règle pointe vers son archive. Le rapport le dit en clair.
//
// ⚠ ON POSE LES DEUX LIENS QUAND LES DEUX EXISTENT : l'assemblée du 15/09/2026
// est à la fois une AG vivante et une pièce au fonds. N'en garder qu'un
// appauvrirait la donnée sans rien simplifier — la colonne existe déjà.
//
// ──────────────────────────────────────────────────────────────────────────────
// LA CORRECTION DE MÉMOIRE DEMANDÉE PAR LE BRIEF
// ──────────────────────────────────────────────────────────────────────────────
// L'entrée du 19/01/2026 écrit « sous 30 jours » là où le procès-verbal dit
// « un mois ». ⚠ CE N'EST PAS UNE ÉQUIVALENCE : trente jours et un mois ne
// tombent pas le même jour selon le mois, et devant une mise en demeure suivie
// de travaux d'office aux frais d'un coloti, un jour d'écart est un écart de
// fond. ⚠ « Corriger le mot seulement » : une seule occurrence, rien d'autre.
//
// Usage :
//   node scripts/importer_regles_gestion_2026-10-06.mjs        essai à blanc
//   node scripts/importer_regles_gestion_2026-10-06.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const DONNEES = join(RACINE, 'scripts', 'data', 'regles_gestion_2026-10-06.json')

// La correction de mémoire, mot pour mot.
const MEMOIRE = {
  date: '2026-01-19',
  indice: 'constat annuel',
  ancien: '30 jours',
  nouveau: 'un mois',
}

// Les colonnes réelles de `regles_gestion`. ⚠ `source_date_ag` n'en fait PAS
// partie : PostgREST rejetterait la ligne entière (et le mock l'avalerait sans
// rien dire — le bug ne se verrait qu'en prod).
const COLONNES = ['titre', 'enonce', 'categorie', 'periodicite', 'delai', 'qui',
  'source_annee', 'source_reference', 'pv_archive_id', 'ag_id',
  'statut', 'fin_le', 'fin_reference', 'commentaire', 'documents']

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

// ── Lecture des données ──────────────────────────────────────────────────────
const brut = JSON.parse(await readFile(DONNEES, 'utf8'))
const REGLES = Array.isArray(brut) ? brut : (brut.regles || brut.regles_gestion || [])
if (REGLES.length !== 17) {
  console.error(`❌ ${REGLES.length} règles lues, 17 attendues. Rien n'est écrit.`)
  process.exit(1)
}

// ⚠ La migration doit être passée. On le VÉRIFIE.
const sonde = await supabase.from('regles_gestion').select('id', { count: 'exact', head: true })
if (sonde.error) {
  console.error(`❌ Table \`regles_gestion\` inaccessible : ${sonde.error.message}`)
  console.error('   La migration 066 n’a pas été passée dans le SQL Editor. Rien n’est écrit.')
  process.exit(1)
}

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `regles-gestion-${jour}`)
  await mkdir(dir, { recursive: true })
  for (const table of ['regles_gestion', 'sujet_entrees']) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`sauvegarde ${table} : ${error.message}`)
    await writeFile(join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${table} : ${data.length} ligne(s)`)
  }
  return dir
}

// ── Résolution des liens ─────────────────────────────────────────────────────
const { data: archives } = await supabase.from('pv_archives').select('id,date_ag,annee,intitule')
const { data: ags } = await supabase.from('assemblees_generales').select('id,date_ag,numero')
const archiveParDate = new Map((archives || []).filter((a) => a.date_ag).map((a) => [a.date_ag, a]))
const agParDate = new Map((ags || []).filter((a) => a.date_ag).map((a) => [a.date_ag, a]))

// ── Rapport ──────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
W(`# Règles de gestion — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${new Date().toISOString()}_`)
W('')
W(`Source : \`scripts/data/regles_gestion_2026-10-06.json\` — **${REGLES.length} règles** lues.`)
W('')

let sauvegarde = null
if (GO) {
  console.log('Sauvegarde du jour…')
  sauvegarde = await sauvegardeDuJour()
  W(`Sauvegarde : \`${sauvegarde.replace(RACINE + '/', '')}\``)
  W('')
}

const { data: existantes } = await supabase.from('regles_gestion').select('id,titre')
const parTitre = new Map((existantes || []).map((r) => [r.titre, r]))

const aEcrire = []
const dejaLa = []
const anomalies = []
const liens = []

for (const r of REGLES) {
  if (!r.titre || !r.enonce) { anomalies.push(`règle sans titre ou sans énoncé : ${JSON.stringify(r).slice(0, 80)}`); continue }
  // ⚠ L'idempotence porte sur le TITRE (demande du brief).
  if (parTitre.has(r.titre)) { dejaLa.push(r.titre); continue }

  // ⚠ Contrainte `regles_gestion_fin_motivee` : on la contrôle ICI pour que le
  // refus soit lisible, l'erreur de Postgres ne l'étant pas.
  if (r.statut && r.statut !== 'en_vigueur' && !r.fin_reference) {
    anomalies.push(`« ${r.titre} » est ${r.statut} sans \`fin_reference\` — la base la refuserait.`)
    continue
  }

  const ligne = Object.fromEntries(Object.entries(r).filter(([k]) => COLONNES.includes(k)))
  const archive = r.source_date_ag ? archiveParDate.get(r.source_date_ag) : null
  const ag = r.source_date_ag ? agParDate.get(r.source_date_ag) : null
  if (archive) ligne.pv_archive_id = archive.id
  if (ag) ligne.ag_id = ag.id
  liens.push({
    titre: r.titre,
    date: r.source_date_ag || '—',
    archive: archive ? archive.intitule : null,
    ag: ag ? ag.numero : null,
  })
  aEcrire.push(ligne)
}

W('## Les règles')
W('')
W('| Source | Titre | État | Lien |')
W('|---|---|---|---|')
for (const r of REGLES) {
  const l = liens.find((x) => x.titre === r.titre)
  const lien = !l ? '_déjà en base_'
    : l.ag && l.archive ? `AG ${l.ag} + archive`
      : l.ag ? `AG ${l.ag}`
        : l.archive ? `archive ${l.archive.slice(0, 40)}` : '⚠ aucun'
  W(`| ${r.source_annee ?? '—'} · ${r.source_reference ?? '—'} | ${r.titre} | ${r.statut || 'en_vigueur'} | ${lien} |`)
}
W('')

const sansLien = liens.filter((l) => !l.ag && !l.archive)
if (sansLien.length) {
  W(`⚠ **${sansLien.length} règle(s) sans lien** — la source est citée en toutes lettres, aucune AG n’est fabriquée :`)
  W('')
  for (const l of sansLien) W(`- ${l.date} — ${l.titre}`)
  W('')
}

// ── La correction de mémoire ─────────────────────────────────────────────────
W('## Correction de la mémoire')
W('')
let correction = null
{
  const { data: ents } = await supabase
    .from('sujet_entrees')
    .select('id,titre,contenu,date_evenement')
    .eq('date_evenement', MEMOIRE.date)
  const candidates = (ents || []).filter((e) =>
    `${e.titre} ${e.contenu}`.toLowerCase().includes(MEMOIRE.indice))
  // ⚠ L'idempotence D'ABORD, sur le texte NOUVEAU : « 30 jours » ne survit pas
  // dans « un mois », mais tester l'ancien en premier reste le réflexe fautif.
  const deja = candidates.filter((e) => !e.contenu.includes(MEMOIRE.ancien) && e.contenu.includes(MEMOIRE.nouveau))
  const aFaire = candidates.filter((e) => (e.contenu.split(MEMOIRE.ancien).length - 1) === 1)
  const ambigues = candidates.filter((e) => (e.contenu.split(MEMOIRE.ancien).length - 1) > 1)

  if (ambigues.length) {
    anomalies.push(`entrée du ${MEMOIRE.date} : « ${MEMOIRE.ancien} » y figure plusieurs fois — on ne devine pas laquelle, rien écrit.`)
    W(`⚠ Plusieurs occurrences de « ${MEMOIRE.ancien} » : rien écrit.`)
  } else if (aFaire.length === 1) {
    const e = aFaire[0]
    correction = { id: e.id, contenu: e.contenu.replace(MEMOIRE.ancien, MEMOIRE.nouveau), titre: e.titre }
    W(`- **${e.titre}** (${MEMOIRE.date}) : « ${MEMOIRE.ancien} » → « ${MEMOIRE.nouveau} », une occurrence, rien d’autre touché.`)
  } else if (aFaire.length > 1) {
    anomalies.push(`${aFaire.length} entrées du ${MEMOIRE.date} portent « ${MEMOIRE.ancien} » — rien écrit.`)
    W(`⚠ ${aFaire.length} entrées candidates : rien écrit.`)
  } else if (deja.length) {
    W('- Déjà corrigée.')
  } else {
    anomalies.push(`aucune entrée du ${MEMOIRE.date} parlant de « ${MEMOIRE.indice} » ne porte « ${MEMOIRE.ancien} ».`)
    W(`⚠ Cible introuvable : aucune entrée du ${MEMOIRE.date} ne porte « ${MEMOIRE.ancien} ».`)
  }
}
W('')

if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}

W('---')
W('')
W(`**${aEcrire.length} règle(s) à écrire · ${dejaLa.length} déjà en base · ${correction ? 1 : 0} correction de mémoire · ${anomalies.length} anomalie(s).**`)
W('')
W('⚠ `source_date_ag` **n’est pas stocké** : la table n’a pas de colonne pour lui, il n’a servi qu’à')
W('retrouver l’archive ou l’assemblée. **Aucune AG n’a été créée.**')
W('')

// ── Écriture ─────────────────────────────────────────────────────────────────
if (GO) {
  if (aEcrire.length) {
    const { error } = await supabase.from('regles_gestion').insert(aEcrire)
    if (error) { console.error(`❌ insertion : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ ${aEcrire.length} règle(s) inscrite(s).`)
  } else {
    console.log('Rien à écrire — les règles sont déjà en base.')
  }
  if (correction) {
    const { error } = await supabase.from('sujet_entrees').update({ contenu: correction.contenu }).eq('id', correction.id)
    if (error) { console.error(`❌ correction mémoire : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ mémoire corrigée · ${correction.titre}`)
  }
  const { count } = await supabase.from('regles_gestion').select('*', { count: 'exact', head: true })
  console.log(`\nRègles en base : ${count}.`)
} else {
  console.log('Essai à blanc — rien n’a été écrit. Relancer avec --go.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `regles_gestion_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
