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
//  4. DOUBLONS. 2018 et 2023 avaient chacune DEUX entrées : le même
//     procès-verbal scanné deux fois, une version dans le dossier de l'année et
//     une à la racine de `1_AG`. Vérifié avant de trancher — même fin de texte,
//     même nombre de résolutions (18 et 40). ⚠ On garde celle du DOSSIER DE
//     L'ANNÉE : c'est l'emplacement rangé, et c'est là que Pascal a corrigé le
//     fichier 2018 qui portait 2017. L'objet du Storage part avec la ligne —
//     c'est une copie exacte créée le jour même, la garder n'est pas de la
//     prudence mais du déchet (même raisonnement que les doublons de la mémoire).
//
//  5. NOMBRE DE PAGES. ⚠ Les dix fichiers ayant un `.txt` frère n'avaient AUCUN
//     nombre de pages : l'import saute la lecture du PDF quand le texte est
//     fourni, et perdait du même coup une métadonnée qui n'a rien à voir avec le
//     texte. Recomptés ici, et l'import est corrigé pour ne plus les perdre.
//
//  6. QUALITÉ. ⚠ J'avais posé « bonne » dès qu'un `.txt` existait, en supposant
//     une transcription exacte. C'est faux : ces `.txt` sont un OCR ANTÉRIEUR —
//     « DNCIA » pour « FONCIA », des marqueurs `----- page 1 -----`. Ils valent
//     mieux qu'une reconnaissance refaite, pas mieux qu'un texte natif. Ramenés
//     à « moyenne », qui est ce qu'ils sont.
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

// ⚠ Les doublons sont désignés par leur NOM DE FICHIER, celui qui est parti — et
// c'est celui de la RACINE qui s'en va, pas celui du dossier de l'année.
const DOUBLONS_A_RETIRER = ['PV AG 2018.pdf', 'PV AG 2023.pdf']
const EXERCICES = {
  // Séance du 19 janvier 2026 → exercice 2025 (Pascal, 2026-09-28).
  '2026-01-19': 2025,
}

// ⚠ `pypdf` plutôt que le lecteur Swift : compter des pages ne demande pas de
// reconnaissance de caractères, et relancer un OCR sur dix documents pour une
// métadonnée serait absurde. Le fichier est retrouvé par son NOM sous la racine
// des AG — l'import n'a pas conservé le chemin d'origine.
const RACINE_AG = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/1_AG'
const pagesParNom = new Map()

async function compterPages(nom) {
  if (!nom) return null
  if (!pagesParNom.size) {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)
    const script = [
      'import os, sys, json',
      'from pypdf import PdfReader',
      'out = {}',
      'for r, d, fs in os.walk(sys.argv[1]):',
      '    for f in fs:',
      '        if f.lower().endswith(".pdf"):',
      '            try: out[f] = len(PdfReader(os.path.join(r, f)).pages)',
      '            except Exception: pass',
      'print(json.dumps(out))',
    ].join('\n')
    try {
      const { stdout } = await run('/usr/bin/python3', ['-c', script, RACINE_AG], { maxBuffer: 8 * 1024 * 1024 })
      for (const [k, v] of Object.entries(JSON.parse(stdout))) pagesParNom.set(k, v)
    } catch {
      // Compter des pages est un confort : un échec ne doit pas empêcher les
      // corrections de fond.
      pagesParNom.set('__echec__', 0)
    }
  }
  return pagesParNom.get(nom) || null
}

async function main() {
  W(`# Corrections du fonds de procès-verbaux — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, annee, date_ag, type_ag, intitule, document, nb_pages, qualite, source').order('annee')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  // ---------------------------------------------------- 4. les doublons
  const aSupprimer = archives.filter((a) => DOUBLONS_A_RETIRER.includes(a.document?.name))
  if (aSupprimer.length) {
    W('## Doublons retirés')
    W('')
    W('Le même procès-verbal scanné deux fois. On garde la version du dossier de l’année.')
    W('')
    for (const a of aSupprimer) W(`- ${a.annee} — \`${a.document.name}\``)
    W('')
    if (GO) {
      for (const a of aSupprimer) {
        const { error: e } = await supabase.from('pv_archives').delete().eq('id', a.id)
        if (e) throw new Error(`Suppression de « ${a.document.name} » : ${e.message}`)
        // L'objet part avec la ligne : copie exacte, rien ne la référence plus.
        if (a.document?.path) await supabase.storage.from('documents').remove([a.document.path])
      }
      W(`✅ ${aSupprimer.length} doublon(s) supprimé(s), fichiers compris.`)
      W('')
    }
  }
  const restantes = archives.filter((a) => !aSupprimer.includes(a))

  const changements = []
  for (const a of restantes) {
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

    // 6. Qualité : un `.txt` frère est un OCR antérieur, pas un texte natif.
    if (a.source?.includes('.txt joint') && a.qualite === 'bonne') patch.qualite = 'moyenne'

    // 5. Pages manquantes, recomptées sur le PDF d'origine.
    if (a.nb_pages == null) {
      const n = await compterPages(a.document?.name)
      if (n) patch.nb_pages = n
    }

    if (Object.keys(patch).length) changements.push({ archive: a, patch })
  }

  W(`${restantes.length} archive(s) au fonds, ${changements.length} à corriger.`)
  W('')

  if (!changements.length) {
    W('Rien à faire — les corrections sont déjà appliquées.')
    await ecrireRapport()
    return
  }

  // ⚠ Le rapport ne montre QUE ce qui change, champ par champ. Une table
  // « avant / après » figée sur trois colonnes affichait deux lignes identiques
  // quand la correction portait sur les pages ou la qualité — un rapport qui a
  // l'air de ne rien faire ne se relit pas.
  W('| Séance | Champ | Avant | Après |')
  W('|---|---|---|---|')
  const lisible = (champ, v) => {
    if (v == null || v === '') return '—'
    return champ === 'type_ag' ? (TYPE_LABELS[v] || v) : String(v)
  }
  for (const { archive: a, patch } of changements) {
    for (const [champ, valeur] of Object.entries(patch)) {
      W(`| ${a.date_ag || a.annee} | ${champ} | ${lisible(champ, a[champ])} | ${lisible(champ, valeur)} |`)
    }
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
