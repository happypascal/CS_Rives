// CORRECTIONS DU FONDS DE PROCÈS-VERBAUX, après relecture de Pascal (2026-09-28).
//
// Trois corrections, qu'aucune déduction automatique ne pouvait trouver : elles
// demandent de savoir ce qu'est une assemblée générale, pas de lire un nom de
// fichier.
//
//  1. TYPE. Les noms de fichiers ne portaient « AGO » ou « AGE » que depuis
//     2012 ; vingt documents étaient rangés en « type inconnu ». Pascal :
//     « ce sont toutes des AGO sauf le 19/6/25 ». L'ordinaire est le cas normal,
//     l'extraordinaire l'exception — mais le script d'import ne pouvait pas le
//     deviner, et inventer « AGO » par défaut aurait été une affirmation.
//
//  2. ANNÉE D'EXERCICE. « L'AG du 19/1/26 est l'AGO 2025 ». Une assemblée tenue
//     en janvier statue sur l'année écoulée : son année de classement est celle
//     de l'EXERCICE, pas de la séance. ⚠ C'est la migration 061 qui a levé la
//     contrainte de cohérence qui l'interdisait.
//
//  3. INTITULÉS. Uniformisés en « Assemblée générale [extraordinaire] <année> »,
//     sans la date — elle s'affiche sur la ligne du dessous.
//
// ⚠ IDEMPOTENT : chaque ligne n'est écrite que si elle change vraiment. Relancer
// ne produit rien et le dit.
//
// Usage :
//   node scripts/corriger_pv_archives.mjs        essai à blanc
//   node scripts/corriger_pv_archives.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { intituleAuto, TYPE_LABELS } from '../src/lib/pvArchiveLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

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

// ⚠ LES EXCEPTIONS SONT NOMMÉES PAR LEUR DATE DE SÉANCE, pas par un identifiant :
// une liste d'UUID serait illisible à la relecture, et ces deux lignes-là sont
// précisément celles qu'il faut pouvoir vérifier des années plus tard.
const EXTRAORDINAIRES = ['2025-06-19']
const EXERCICES = {
  // Séance du 19 janvier 2026 → exercice 2025 (Pascal, 2026-09-28).
  '2026-01-19': 2025,
}

async function main() {
  W(`# Corrections du fonds de procès-verbaux — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, annee, date_ag, type_ag, intitule').order('annee')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  const changements = []
  for (const a of archives) {
    const patch = {}

    // 1. Type : extraordinaire pour les séances nommées, ordinaire pour le reste.
    const type = EXTRAORDINAIRES.includes(a.date_ag) ? 'AGE' : 'AGO'
    if (a.type_ag !== type) patch.type_ag = type

    // 2. Année d'exercice, quand elle diffère de l'année de séance.
    const exercice = EXERCICES[a.date_ag]
    if (exercice != null && a.annee !== exercice) patch.annee = exercice

    // 3. Intitulé, recalculé sur les valeurs CORRIGÉES — sinon on réécrirait le
    //    titre à partir de l'ancien type et de l'ancienne année.
    const intitule = intituleAuto({
      annee: patch.annee ?? a.annee,
      type_ag: patch.type_ag ?? a.type_ag,
    }, a.intitule)
    if (a.intitule !== intitule) patch.intitule = intitule

    if (Object.keys(patch).length) changements.push({ archive: a, patch })
  }

  W(`${archives.length} archive(s) au fonds, ${changements.length} à corriger.`)
  W('')

  if (!changements.length) {
    W('Rien à faire — les corrections sont déjà appliquées.')
    await ecrireRapport()
    return
  }

  W('| Séance | Avant | Après |')
  W('|---|---|---|')
  for (const { archive: a, patch } of changements) {
    const avant = `${a.annee} · ${TYPE_LABELS[a.type_ag] || a.type_ag || '—'} · ${a.intitule}`
    const apres = `${patch.annee ?? a.annee} · ${TYPE_LABELS[patch.type_ag ?? a.type_ag]} · ${patch.intitule ?? a.intitule}`
    W(`| ${a.date_ag || '—'} | ${avant} | ${apres} |`)
  }
  W('')

  if (GO) {
    for (const { archive: a, patch } of changements) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', a.id)
      if (e) throw new Error(`Correction de « ${a.intitule} » : ${e.message}`)
    }
    W(`✅ ${changements.length} archive(s) corrigée(s).`)
    W('')
  }

  await ecrireRapport()
}

async function ecrireRapport() {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `pv_archives_corrections_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
