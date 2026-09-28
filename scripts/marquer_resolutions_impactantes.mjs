// MARQUAGE DES RÉSOLUTIONS IMPACTANTES du fonds de procès-verbaux.
//
// Pascal (2026-09-28) : « je ne veux que les décisions impactantes dans ce
// résumé ». Une assemblée vote chaque année l'élection du bureau, les comptes,
// le quitus, le budget courant et la désignation du syndic — cinq à dix lignes
// qui reviennent à l'identique depuis 1988. Noyées dedans, les trois décisions
// qui ont réellement engagé le lotissement ne se voient plus.
//
// ⚠ LA SÉLECTION EST CONSTATÉE, PAS FABRIQUÉE. Chaque assemblée a son
// `Resume_AG_<date>.docx`, où un lecteur du procès-verbal a déjà fait ce tri.
// Ce script ne fait que CONSIGNER qu'une résolution y figure (`impactante`).
// Une règle par mots-clés — « quitus », « comptes », « budget » — aurait été une
// devinette, et elle se serait trompée le jour où l'assemblée REFUSE le quitus :
// ce jour-là, le quitus est la décision de l'année.
//
// ⚠ RIEN N'EST SUPPRIMÉ. Les 237 résolutions restent en base ; l'écran donne
// accès aux écartées d'un clic. Un fonds d'archives ne choisit pas ce qui mérite
// mémoire — il choisit seulement ce qu'il montre en premier.
//
// ⚠ POURQUOI UN SCRIPT À PART, ET NON UN RÉ-IMPORT. `importer_resumes_ag.mjs`
// réécrit les résolutions depuis le registre consolidé : le relancer
// EFFACERAIT les quatre corrections du 2026-09-28 (trois effectifs pris pour
// des voix en 2004, une lacune de 1988 présentée comme « Information »), qui
// sont justes en base et fausses au registre. Celui-ci n'écrit QUE le champ
// `impactante`, sur les lignes existantes.
//
// ⚠ APPARIEMENT SUR L'INTITULÉ, jamais sur le numéro : le n° 8 de 2003 couvre
// cinq résolutions. `cleIntitule` est partagée avec l'import pour que les deux
// apparient de la même façon.
//
// ⚠ IDEMPOTENT : une assemblée dont toutes les marques sont déjà bonnes n'est
// pas réécrite.
//
// Usage :
//   node scripts/marquer_resolutions_impactantes.mjs        essai à blanc
//   node scripts/marquer_resolutions_impactantes.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import process from 'node:process'
import { cleIntitule } from '../src/lib/pvArchiveLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)
const GO = process.argv.includes('--go')

const arg = (nom) => {
  const i = process.argv.indexOf(nom)
  return i > -1 ? process.argv[i + 1] : null
}
const DOSSIER_AG = arg('--ag')
  || '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/1_AG'

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
  W(`# Marquage des résolutions impactantes — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W('Est « impactante » la résolution qui figure au résumé d’assemblée de son année.')
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const { stdout } = await run('/usr/bin/python3',
    [join(RACINE, 'scripts', 'lire_resume_ag.py'), DOSSIER_AG], { maxBuffer: 32 * 1024 * 1024 })
  const lu = JSON.parse(stdout)
  if (lu.erreur) throw new Error(`Lecture des résumés : ${lu.erreur}`)
  const resumes = new Map((lu.resumes || []).map((r) => [r.date_ag, r]))
  W(`${resumes.size} résumé(s) d’assemblée lu(s).`)
  W('')

  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, annee, date_ag, intitule, resolutions').order('annee')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  const aEcrire = []
  const soucis = []
  W('| Assemblée | Au résumé | Écartées | Introuvables |')
  W('|---|---|---|---|')

  for (const a of archives) {
    if (!a.resolutions?.length) continue
    const r = resumes.get(a.date_ag)
    if (!r) {
      // ⚠ SANS RÉSUMÉ, ON NE MARQUE RIEN. Marquer tout en « écartée » masquerait
      // l'assemblée entière ; marquer tout en « impactante » affirmerait un tri
      // que personne n'a fait. L'absence de marque fait tout afficher.
      soucis.push(`${a.intitule} — aucun résumé par année : rien n’a été marqué, la fiche affiche tout.`)
      continue
    }

    const attendues = new Map()
    for (const z of r.resolutions) attendues.set(cleIntitule(z.sujet), z)

    const resolutions = a.resolutions.map((x) => {
      const trouvee = attendues.delete(cleIntitule(x.objet))
      return { ...x, impactante: trouvee }
    })
    const retenues = resolutions.filter((x) => x.impactante).length

    // ⚠ Une ligne du résumé qui ne retrouve pas la sienne en base est SIGNALÉE :
    // c'est le seul indice qu'un intitulé a été reformulé d'un côté sans l'autre.
    if (attendues.size) {
      soucis.push(`${a.intitule} — ${attendues.size} ligne(s) du résumé sans correspondance en base : ${[...attendues.values()].map((z) => `« ${z.sujet} »`).join(', ')}`)
    }

    const change = resolutions.some((x, i) => x.impactante !== a.resolutions[i].impactante)
    W(`| ${a.intitule} | ${retenues} | ${resolutions.length - retenues} | ${attendues.size || '—'} |`)
    if (change) aEcrire.push({ id: a.id, intitule: a.intitule, resolutions })
  }
  W('')

  if (soucis.length) {
    W('## ⚠ À regarder')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  const total = archives.reduce((n, a) => n + (a.resolutions?.length || 0), 0)
  const retenues = aEcrire.reduce((n, x) => n + x.resolutions.filter((r) => r.impactante).length, 0)
  W(`${aEcrire.length} assemblée(s) à écrire — ${retenues} résolution(s) retenues sur ${total} au fonds.`)
  W('')

  if (GO && aEcrire.length) {
    for (const x of aEcrire) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ resolutions: x.resolutions, updated_at: new Date().toISOString() }).eq('id', x.id)
      if (e) throw new Error(`Écriture de « ${x.intitule} » : ${e.message}`)
    }
    W(`✅ ${aEcrire.length} assemblée(s) marquée(s).`)
    W('')
  } else if (!aEcrire.length) {
    W('Rien à écrire — le marquage est déjà à jour.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `resolutions_impactantes_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
