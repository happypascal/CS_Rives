// LE RÉSUMÉ RÉDIGÉ DES RÉSOLUTIONS (v3, migration 064).
//
// Exécute `BRIEF_resumes_resolutions_v3_2026-09-30.md`. Pascal (2026-09-30) :
// les résumés étaient trop mécaniques — une ligne par sous-résolution (10.1 à
// 10.6 pour un seul sujet), des intitulés obscurs, et aucune hiérarchie entre
// une décision qui engage le lotissement et un miroir remplacé.
//
// =============================================================================
// CE QUE CE SCRIPT ÉCRIT, ET CE QU'IL NE TOUCHE JAMAIS
// =============================================================================
// ⚠ IL N'ÉCRIT QUE `resume_resolutions`. Les 303 lignes de `resolutions` —
// la transcription du procès-verbal, avec détail et voix chiffrées — restent
// intactes : un registre légal ne remplace pas une transcription par une lecture.
//
// ⚠ AUCUN CHAMP D'EN-TÊTE : président, scrutateur, syndic, quorum, lieu, unité,
// note. Ils ont été corrigés à la main dans l'application, et le vérifier après
// coup fait partie du travail (comparaison à la sauvegarde d'avant écriture).
//
// ⚠ LE CONTENU N'EST NI REFORMULÉ NI RACCOURCI. Il a été écrit à partir des PV
// relus sur l'image, et validé. Le script le recopie, il ne l'interprète pas —
// pas même pour normaliser une majuscule.
//
// ⚠ `au_resume` EST RETIRÉE des résolutions détaillées (§6 du brief) : elle
// marquait les lignes de l'ancien résumé, et c'est le résumé rédigé qui porte
// désormais la hiérarchie. Garder une marque qui ne commande plus rien, c'est
// promettre à un lecteur futur qu'elle veut encore dire quelque chose.
// **Aucune résolution n'est supprimée** — seule la clé disparaît de l'objet.
//
// =============================================================================
// SAUVEGARDE
// =============================================================================
// ⚠ `--go` REFUSE d'écrire sans une sauvegarde DU JOUR dans `backup/`.
//
// Usage :
//   node scripts/appliquer_resumes_v3.mjs        essai à blanc
//   node scripts/appliquer_resumes_v3.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const SOURCE = join(RACINE, 'scripts', 'data', 'resumes_resolutions_v3_2026-09-30.json')

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

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

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().slice(0, 10)
  try {
    const dirs = await readdir(join(RACINE, 'backup'))
    return dirs.filter((d) => d.startsWith(jour)).sort().pop() || null
  } catch { return null }
}

// ⚠ COMPARER DEUX `jsonb` PAR `JSON.stringify` NE MARCHE PAS. Postgres ne
// conserve pas l'ordre des clés d'un `jsonb` : il les range par longueur puis
// par ordre alphabétique. Relu, `{ordre, numeros, resume…}` revient
// `{vote, ordre, resume…}` — deux chaînes différentes pour un contenu
// identique, et le script se croyait du travail à chaque exécution.
// L'idempotence ne se déclare pas, elle se vérifie en relançant.
const canonique = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonique).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${k}:${canonique(v[k])}`).join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** Une ligne du résumé, recopiée telle quelle. */
const ligne = (r) => ({
  ordre: r.ordre,
  numeros: r.numeros,
  resume: r.resume,
  decision: r.decision,
  vote: r.vote ?? null,
})

async function main() {
  W(`# Résumé rédigé des résolutions (v3) — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const sauvegarde = await sauvegardeDuJour()
  W(sauvegarde
    ? `Sauvegarde du jour : \`backup/${sauvegarde}\`.`
    : '⚠ **Aucune sauvegarde du jour dans `backup/`.** `--go` sera refusé.')
  W('')
  if (GO && !sauvegarde) throw new Error('Sauvegarde du jour absente : lancer `node scripts/backup.mjs` d’abord.')

  const json = JSON.parse(await readFile(SOURCE, 'utf8'))

  // ⚠ L'ESSAI DOIT TOURNER AVANT LA MIGRATION. `resume_resolutions` n'existe pas
  // tant que la 064 n'est pas passée, et PostgREST refuse alors le `select`
  // entier. On retombe sur les colonnes existantes pour que le rapport soit
  // lisible AVANT d'avoir touché à la base — c'est précisément l'ordre demandé :
  // montrer, puis écrire.
  const CHAMPS = 'id, date_ag, intitule, resolutions'
  let archives
  let colonnePosee = true
  {
    const r = await supabase.from('pv_archives').select(`${CHAMPS}, resume_resolutions`).order('date_ag')
    if (r.error) {
      if (!/resume_resolutions/.test(r.error.message)) throw new Error(`Lecture du fonds : ${r.error.message}`)
      colonnePosee = false
      const r2 = await supabase.from('pv_archives').select(CHAMPS).order('date_ag')
      if (r2.error) throw new Error(`Lecture du fonds : ${r2.error.message}`)
      archives = r2.data
    } else {
      archives = r.data
    }
  }
  if (!colonnePosee) {
    W('⚠ **Colonne `resume_resolutions` absente** — la migration 064 n’est pas encore appliquée.')
    W('L’essai reste complet ; `--go` sera refusé tant que la colonne n’existe pas.')
    W('')
  }
  if (GO && !colonnePosee) throw new Error('Colonne `resume_resolutions` absente : appliquer la migration 064 d’abord.')
  const parDate = new Map(archives.filter((a) => a.date_ag).map((a) => [a.date_ag, a]))

  const orphelines = json.filter((x) => !parDate.has(x.date_ag))
  if (orphelines.length) {
    W('## ⚠ Assemblées du résumé sans archive correspondante')
    W('')
    for (const o of orphelines) W(`- ${o.date_ag}`)
    W('')
  }

  const maj = []
  let nImp = 0, nAut = 0, nNotes = 0, nMarques = 0
  W('| Assemblée | Importantes | Autres | Note | Détail (inchangé) |')
  W('|---|---|---|---|---|')
  for (const x of json) {
    const cible = parDate.get(x.date_ag)
    if (!cible) continue
    const resume = {
      importantes: (x.resolutions_importantes || []).map(ligne),
      autres: (x.autres_resolutions || []).map(ligne),
      note: x.note_resume ?? null,
    }
    nImp += resume.importantes.length
    nAut += resume.autres.length
    if (resume.note) nNotes++

    // ⚠ `au_resume` retirée, les résolutions conservées une à une.
    const detail = (cible.resolutions || []).map(({ au_resume: _m, ...reste }) => reste)
    const marquesAvant = (cible.resolutions || []).filter((r) => 'au_resume' in r).length
    nMarques += marquesAvant

    const changeResume = canonique(cible.resume_resolutions) !== canonique(resume)
    const changeDetail = marquesAvant > 0
    W(`| ${x.date_ag} — ${cible.intitule} | ${resume.importantes.length} | ${resume.autres.length || '—'} | ${resume.note ? 'oui' : '—'} | ${detail.length} |`)
    if (changeResume || changeDetail) maj.push({ cible, resume, detail, changeResume, changeDetail })
  }
  W('')
  W(`**${maj.length} archive(s) à écrire** — ${nImp} résolution(s) importantes, ${nAut} autres, ${nNotes} note(s).`)
  W(`Marques \`au_resume\` à retirer : ${nMarques} (aucune résolution supprimée).`)
  W('')

  // ⚠ CONTRÔLE AVANT ÉCRITURE : le nombre de lignes détaillées ne doit PAS
  // bouger. C'est la garantie que cette couche s'ajoute et ne remplace rien.
  const avant = archives.reduce((n, a) => n + (a.resolutions || []).length, 0)
  const apres = maj.reduce((n, m) => n + m.detail.length, 0)
    + archives.filter((a) => !maj.some((m) => m.cible.id === a.id)).reduce((n, a) => n + (a.resolutions || []).length, 0)
  W(`Résolutions détaillées : ${avant} avant, ${apres} après — ${avant === apres ? '**aucune perte** ✅' : '**⚠ ÉCART**'}`)
  W('')
  if (avant !== apres) throw new Error('Le nombre de résolutions détaillées changerait : rien n’a été écrit.')

  if (GO && maj.length) {
    for (const m of maj) {
      const patch = { updated_at: new Date().toISOString(), resume_resolutions: m.resume }
      if (m.changeDetail) patch.resolutions = m.detail
      const { error: e } = await supabase.from('pv_archives').update(patch).eq('id', m.cible.id)
      if (e) throw new Error(`Écriture de « ${m.cible.intitule} » : ${e.message}`)
    }
    W(`✅ ${maj.length} archive(s) écrites.`)
    W('')
  } else if (!maj.length) {
    W('Rien à écrire — le résumé est déjà en place.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `resumes_v3_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
