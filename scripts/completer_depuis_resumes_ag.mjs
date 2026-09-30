// CE QUE LES RÉSUMÉS PAR ANNÉE APPORTENT AU FONDS DE PROCÈS-VERBAUX.
//
// Deux choses, et une seule source : les `Resume_AG_<date>.docx`.
//   1. le LIEU de la séance (`lieu`) ;
//   2. la marque « figure au résumé » sur chaque résolution (`au_resume`), qui
//      sert à écarter les points de routine.
//
// Pascal (2026-09-28) : « je ne veux que les décisions impactantes dans ce
// résumé ». Une assemblée vote chaque année l'élection du bureau, les comptes,
// le quitus, le budget courant et la désignation du syndic — cinq à dix lignes
// qui reviennent à l'identique depuis 1988. Noyées dedans, les trois décisions
// qui ont réellement engagé le lotissement ne se voient plus.
//
// ⚠ CE SCRIPT NE POSE QU'UNE DES DEUX CONDITIONS. « Impactante » veut dire
// VOTÉE (adoptée ou rejetée) ET hors routine. La première se lit dans
// `resultat` et reste DÉRIVÉE à l'affichage (`estVotee`, `partagerResolutions`) :
// corriger un résultat corrige la fiche sans relancer quoi que ce soit. Seule la
// seconde est écrite ici, parce qu'elle ne se calcule pas.
//
// ⚠ LA SÉLECTION EST CONSTATÉE, PAS FABRIQUÉE. Chaque assemblée a son
// `Resume_AG_<date>.docx`, où un lecteur du procès-verbal a déjà fait ce tri.
// Ce script ne fait que CONSIGNER qu'une résolution y figure (`au_resume`).
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
// `au_resume`, sur les lignes existantes.
//
// ⚠ APPARIEMENT SUR L'INTITULÉ, jamais sur le numéro : le n° 8 de 2003 couvre
// cinq résolutions. `cleIntitule` est partagée avec l'import pour que les deux
// apparient de la même façon.
//
// ⚠ IDEMPOTENT : une assemblée dont toutes les marques sont déjà bonnes n'est
// pas réécrite.
//
// Usage :
//   node scripts/completer_depuis_resumes_ag.mjs        essai à blanc
//   node scripts/completer_depuis_resumes_ag.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import process from 'node:process'
import { cleIntitule } from '../src/lib/pvArchiveLogic.js'

// ⚠ LE MARQUAGE `au_resume` EST CADUC depuis la migration 064 : c'est le RÉSUMÉ
// RÉDIGÉ qui porte désormais la hiérarchie, et la marque a été retirée des 303
// résolutions. Ce script ne pose plus que le LIEU. Relancer la partie marquage
// réintroduirait une clé que plus rien ne lit — et qu'un lecteur futur croirait
// signifiante.
const MARQUAGE_CADUC = true

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
  W(`# Ce que les résumés par année apportent au fonds — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W('Le lieu de la séance, et la marque « figure au résumé » sur chaque résolution.')
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
    .from('pv_archives').select('id, annee, date_ag, intitule, lieu, resolutions').order('annee')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  const aEcrire = []
  const lieux = new Map()
  const appariesParNumero = new Map()
  const soucis = []
  W('| Assemblée | Lieu | Au résumé | Écartées | Introuvables |')
  W('|---|---|---|---|---|')

  for (const a of archives) {
    const r = resumes.get(a.date_ag)

    // ⚠ LE LIEU EST REPRIS TEL QUEL, « Non indiqué au procès-verbal » COMPRIS
    // (AG 2005). C'est la source qui constate l'absence ; la remplacer par un
    // champ vide rendrait cette lacune indistincte d'un champ qu'on n'a pas
    // encore rempli — et le lieu habituel est trop évident pour qu'on résiste
    // longtemps à l'y écrire de tête.
    // ⚠ Traité AVANT le garde-fou sur les résolutions : une assemblée sans
    // résolution dépouillée a tout de même eu lieu quelque part.
    const lieu = r?.lieu || null
    if (lieu && lieu !== a.lieu) lieux.set(a.id, { lieu, intitule: a.intitule, avant: a.lieu })

    if (!a.resolutions?.length) {
      W(`| ${a.intitule} | ${lieu && lieu !== a.lieu ? lieu : '—'} | — | — | — |`)
      continue
    }
    if (!r) {
      // ⚠ SANS RÉSUMÉ, ON NE MARQUE RIEN. Marquer tout en « écartée » masquerait
      // l'assemblée entière ; marquer tout en « impactante » affirmerait un tri
      // que personne n'a fait. L'absence de marque fait tout afficher.
      soucis.push(`${a.intitule} — aucun résumé par année : rien n’a été marqué, la fiche affiche tout.`)
      continue
    }

    // ═══ APPARIEMENT EN DEUX PASSES ═══
    //
    // ⚠ PASSE 1 — L'INTITULÉ, jamais le numéro seul. Le n° 8 de l'AG 2003 couvre
    // cinq résolutions distinctes ; apparier d'emblée par numéro fabriquait huit
    // fausses correspondances lors de la vérification du 2026-09-28.
    //
    // ⚠ PASSE 2 — LE NUMÉRO, pour ce que la première n'a pas trouvé. Les
    // assemblées entrées le 2026-09-28 (1991→2010) ont révélé que les deux
    // sources n'intitulent PAS pareil : le registre écrit « Miroirs
    // incassables », le résumé « Remplacement des miroirs par un miroir
    // incassable (environ 2 000 F) ». Ce sont les mêmes neuf résolutions, dans
    // le même ordre, sous les mêmes numéros — mais zéro intitulé identique. Sans
    // cette seconde passe, l'assemblée entière était marquée « hors résumé » et
    // sa fiche n'affichait AUCUNE décision.
    //
    // ⚠ On prend la PREMIÈRE ligne non encore appariée portant ce numéro, et les
    // deux listes sont parcourues dans l'ordre : c'est ce qui rend l'appariement
    // déterministe quand un numéro se répète. Ce n'est pas une certitude, c'est
    // une hypothèse — d'où le décompte séparé au rapport, pour qu'on sache
    // combien de lignes reposent dessus.
    const restantes = [...r.resolutions]
    const parRang = new Map()
    const prendre = (idx, z) => { parRang.set(idx, z); restantes.splice(restantes.indexOf(z), 1) }

    a.resolutions.forEach((x, i) => {
      const z = restantes.find((y) => cleIntitule(y.sujet) === cleIntitule(x.objet))
      if (z) prendre(i, z)
    })
    let parNumero = 0
    a.resolutions.forEach((x, i) => {
      if (parRang.has(i)) return
      const z = restantes.find((y) => String(y.numero).trim() === String(x.numero).trim())
      if (z) { prendre(i, z); parNumero++ }
    })

    const resolutions = a.resolutions.map((x, i) => {
      // ⚠ `impactante` est RETIRÉE : le champ a porté ce nom une heure et ne
      // disait pas ce qu'il promettait — seulement « figure au résumé », pas
      // « a décidé quelque chose ». Le laisser traîner à côté de `au_resume`
      // garantissait qu'un lecteur futur se fie au mauvais.
      const { impactante: _ancien, ...reste } = x
      return { ...reste, au_resume: parRang.has(i) }
    })
    const retenues = resolutions.filter((x) => x.au_resume).length
    if (parNumero) appariesParNumero.set(a.id, parNumero)

    // ⚠ Une ligne du résumé qui ne retrouve NI son intitulé NI son numéro est
    // signalée : c'est le seul indice qu'une résolution existe d'un côté et pas
    // de l'autre.
    if (restantes.length) {
      soucis.push(`${a.intitule} — ${restantes.length} ligne(s) du résumé sans correspondance en base : ${restantes.map((z) => `« ${z.sujet} »`).join(', ')}`)
    }

    const change = !MARQUAGE_CADUC && resolutions.some((x, i) => x.au_resume !== a.resolutions[i].au_resume
      || 'impactante' in a.resolutions[i])
    W(`| ${a.intitule} | ${lieux.has(a.id) ? lieux.get(a.id).lieu : '—'} | ${retenues} | ${resolutions.length - retenues} | ${restantes.length || '—'} |`)
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
  const retenues = aEcrire.reduce((n, x) => n + x.resolutions.filter((r) => r.au_resume).length, 0)
  W(`${aEcrire.length} assemblée(s) à marquer — ${retenues} résolution(s) retenues sur ${total} au fonds.`)
  W(`${lieux.size} lieu(x) à renseigner.`)
  const totalNumero = [...appariesParNumero.values()].reduce((n, v) => n + v, 0)
  if (totalNumero) {
    W('')
    W(`⚠ ${totalNumero} résolution(s) appariées par leur NUMÉRO et non par leur intitulé — les deux sources ne les rédigent pas pareil. Appariement déterministe (même ordre, même numéro), mais c'est une hypothèse, pas une certitude.`)
  }
  W('')

  // ⚠ UN SEUL `update` PAR ASSEMBLÉE, lieu et marquage ensemble : deux écritures
  // successives laisseraient, si la seconde échoue, une ligne à moitié complétée
  // sans que rien ne le signale.
  const patchs = new Map()
  for (const x of aEcrire) patchs.set(x.id, { intitule: x.intitule, resolutions: x.resolutions })
  for (const [id, v] of lieux) {
    const p = patchs.get(id) || { intitule: v.intitule }
    p.lieu = v.lieu
    patchs.set(id, p)
  }

  if (GO && patchs.size) {
    for (const [id, { intitule, ...champs }] of patchs) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id)
      if (e) throw new Error(`Écriture de « ${intitule} » : ${e.message}`)
    }
    W(`✅ ${patchs.size} assemblée(s) complétée(s).`)
    W('')
  } else if (!patchs.size) {
    W('Rien à écrire — le fonds est déjà à jour.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `resumes_completion_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
