// IMPORT DES RÉSUMÉS D'ASSEMBLÉE dans le fonds de procès-verbaux (migration 062).
//
// Chaque dossier d'AG porte un résumé au même format depuis 1988 — président de
// séance, quorum, puis un tableau de résolutions. Ces rubriques deviennent des
// CHAMPS, parce qu'un paragraphe ne permet ni de chercher ni de comparer d'une
// année à l'autre.
//
// ⚠ LA SOURCE EST LE REGISTRE CONSOLIDÉ (.docx), PAS LES PDF DE RÉSUMÉ. Les deux
// disent la même chose ; un tableau de .docx se lit par ses cellules, un tableau
// de PDF par des coordonnées qui recollent « Non votée » et « — » en
// « Non votée— ». Le premier est une donnée, le second une mise en page.
// Lecture déléguée à `scripts/lire_registre_ag.py` — même raison que pour les
// `.eml` : un format structuré se lit avec un outil qui le connaît.
//
// ⚠ RECOUPEMENT AVANT ÉCRITURE. Le registre annonce, pour chaque assemblée, son
// nombre de décisions (« 20 (13 adoptées, 1 rejetées) »). Le script compare ce
// décompte au nombre de lignes qu'il a su lire, et REFUSE d'écrire si l'un d'eux
// diverge : une résolution perdue en route ne se verrait jamais à l'écran.
//
// Usage :
//   node scripts/importer_resumes_ag.mjs                    essai à blanc
//   node scripts/importer_resumes_ag.mjs --go               écrit
//   node scripts/importer_resumes_ag.mjs --registre "<.docx>" --go

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const run = promisify(execFile)

const arg = (nom) => {
  const i = process.argv.indexOf(nom)
  return i > -1 ? process.argv[i + 1] : null
}
const GO = process.argv.includes('--go')
// Le fichier produit avec les résumés, qui complète le registre consolidé.
const FICHIER_RESUMES = 'resumes_pv_archives_2026-09-28.json'
const REGISTRE = arg('--registre')
  || '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/1_AG/Registre_decisions_AG_Rives_1988-2026.docx'

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
const soucis = []

async function main() {
  W(`# Import des résumés d'assemblée — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W(`> Registre : \`${REGISTRE}\``)
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  // ⚠ TROIS SOURCES, ET UN ARBITRE PAR RUBRIQUE.
  //
  //   1. Les RÉSUMÉS PAR ANNÉE (`Resume_AG_<date>.docx`) — c'est LA référence :
  //      la fiche de l'application est censée les refléter. Ils donnent l'en-tête
  //      dans sa forme définitive.
  //   2. Le REGISTRE CONSOLIDÉ (.docx) — il chiffre les votes, colonne par
  //      colonne, ce que les résumés donnent en une phrase.
  //   3. Le fichier JSON produit avec les résumés — scrutateur, unité de vote,
  //      notes.
  //
  // ⚠ L'ARBITRAGE A CHANGÉ (2026-09-28). J'avais d'abord donné la priorité au
  // registre, et rempli président, secrétaire et quorum avec sa formulation :
  // « copropriétaires présents ou représentés porteurs de : 41/49 Lots ». La
  // confrontation aux résumés a montré 25 écarts sur 25 — ils disent « 41 lots
  // sur 49 ». Aucune des deux n'est fausse : le registre CITE le procès-verbal,
  // le résumé le NORMALISE. Mais c'est le résumé que l'écran prétend montrer.
  //
  // ⚠ Le registre garde les CHIFFRES du vote : eux, le résumé les donne en un
  // seul texte (« Pour 3 400 · Contre 0 · Abst. 0 »), et les séparer à nouveau
  // serait défaire ce que le registre a déjà fait.
  const complements = new Map()
  try {
    const brut = await readFile(join(RACINE, 'scripts', 'data', FICHIER_RESUMES), 'utf8')
    for (const r of JSON.parse(brut)) complements.set(r.date_ag, r)
  } catch {
    soucis.push(`Fichier de résumés \`${FICHIER_RESUMES}\` absent ou illisible : scrutateur, unité de vote et notes ne seront pas renseignés.`)
  }

  // Les résumés par année, lus à part — ils font référence pour l'en-tête.
  const resumesParDate = new Map()
  try {
    const { stdout: sr } = await run('/usr/bin/python3',
      [join(RACINE, 'scripts', 'lire_resume_ag.py'), dirname(REGISTRE)], { maxBuffer: 32 * 1024 * 1024 })
    for (const r of JSON.parse(sr).resumes || []) resumesParDate.set(r.date_ag, r)
  } catch {
    soucis.push('Résumés par année illisibles : l’en-tête sera repris du registre consolidé, dans sa formulation brute.')
  }

  const { stdout } = await run('/usr/bin/python3',
    [join(RACINE, 'scripts', 'lire_registre_ag.py'), REGISTRE], { maxBuffer: 32 * 1024 * 1024 })
  const lu = JSON.parse(stdout)
  if (lu.erreur) throw new Error(`Lecture du registre : ${lu.erreur}`)
  const assemblees = lu.assemblees || []

  // ------------------------------------------------- 1. recoupement d'abord
  const divergences = []
  for (const a of assemblees) {
    const m = /^(\d+)/.exec(a.decisions_annoncees || '')
    const annonce = m ? Number(m[1]) : null
    if (annonce !== a.resolutions.length) {
      divergences.push(`${a.date_ag} : le registre annonce ${annonce ?? '?'} décision(s), ${a.resolutions.length} lue(s).`)
    }
  }
  if (divergences.length) {
    W('## Import refusé — le tableau n’a pas été lu en entier')
    W('')
    W('Le registre annonce pour chaque assemblée son nombre de décisions. Ces comptes ne correspondent pas :')
    W('')
    for (const d of divergences) W(`- ${d}`)
    W('')
    W('Rien n’a été écrit : une résolution perdue en route ne se verrait jamais à l’écran.')
    await ecrireRapport()
    process.exit(2)
  }
  W(`${assemblees.length} assemblée(s) lue(s), ${assemblees.reduce((s, a) => s + a.resolutions.length, 0)} résolution(s) — décomptes conformes.`)
  W('')

  // --------------------------------------------- 2. appariement au fonds
  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, annee, date_ag, type_ag, intitule')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  const parDate = new Map(archives.filter((a) => a.date_ag).map((a) => [a.date_ag, a]))
  const sansDate = archives.filter((a) => !a.date_ag)

  const aEcrire = []
  const orphelines = []
  for (const a of assemblees) {
    let cible = parDate.get(a.date_ag)
    // ⚠ Deux archives sont entrées sans date de séance : leur nom de fichier ne
    // la portait pas. Le registre, lui, la connaît — on les apparie par l'ANNÉE,
    // et seulement si elle est sans ambiguïté. Un appariement de plus serait un
    // rattachement au hasard.
    if (!cible) {
      const candidats = sansDate.filter((x) => x.annee === Number(a.date_ag.slice(0, 4)))
      if (candidats.length === 1) cible = candidats[0]
    }
    if (!cible) { orphelines.push(a); continue }

    // L'en-tête vient du RÉSUMÉ quand il existe, du registre sinon.
    const r = resumesParDate.get(a.date_ag)
    const patch = {
      president_seance: r?.president || a.president_seance || null,
      presents_representes: r?.quorum || a.presents_representes || null,
      syndic: r?.secretaire || a.syndic || null,
      resolutions: a.resolutions,
      // ⚠ Le résumé dit quand il a été établi, pas quand l'assemblée s'est tenue.
      resume_etabli_le: '2026-09-28',
    }
    // La date de séance n'est POSÉE que si elle manquait : le registre ne doit
    // pas réécrire une date déjà constatée sur le document lui-même.
    if (!cible.date_ag) patch.date_ag = a.date_ag

    // Ce que seul le fichier de résumés connaît.
    const c = complements.get(a.date_ag)
    if (c) {
      // ⚠ « — » signifie « aucun », pas « inconnu » : on l'écrit tel quel plutôt
      // que de laisser un champ vide qui se lirait « pas encore renseigné ».
      if (c.scrutateur) patch.scrutateur = c.scrutateur
      if (c.unite_des_votes) patch.unite_vote = c.unite_des_votes
      // La note est un avertissement sur le document (« la page relatant ce vote
      // manque »), pas un résumé des décisions : elle va au commentaire.
      if (c.note) patch.commentaire = c.note
      // ⚠ L'exercice est CONFIRMÉ, jamais imposé : si les deux sources
      // divergeaient, on le signalerait plutôt que d'en choisir une.
      if (c.annee_exercice && c.annee_exercice !== cible.annee) {
        soucis.push(`${a.date_ag} : le fichier de résumés dit exercice ${c.annee_exercice}, le fonds dit ${cible.annee}. Rien n'a été changé.`)
      }
    }
    aEcrire.push({ cible, patch, source: a })
  }

  W('## Assemblées appariées')
  W('')
  W('| Séance | Archive | Président de séance | Résolutions |')
  W('|---|---|---|---|')
  for (const { cible, patch, source } of aEcrire) {
    W(`| ${source.date_ag} | ${cible.intitule} | ${patch.president_seance || '—'} | ${source.resolutions.length} |`)
  }
  W('')

  if (orphelines.length) {
    soucis.push(`${orphelines.length} assemblée(s) du registre sans archive correspondante : ${orphelines.map((o) => o.date_ag).join(', ')}`)
  }
  const nonServies = archives.filter((x) => !aEcrire.some((e) => e.cible.id === x.id))
  if (nonServies.length) {
    soucis.push(`${nonServies.length} archive(s) sans résumé dans le registre : ${nonServies.map((x) => x.intitule).join(' · ')}`)
  }

  if (GO) {
    for (const { cible, patch } of aEcrire) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', cible.id)
      if (e) throw new Error(`Écriture de « ${cible.intitule} » : ${e.message}`)
    }
    W(`✅ ${aEcrire.length} archive(s) complétée(s).`)
    W('')
  }

  // ------------------------------------------- 3. ce que chaque source apporte
  const avecComplement = aEcrire.filter((e) => complements.has(e.source.date_ag)).length
  W('## Sources')
  W('')
  W(`- Résumés par année (référence) : en-tête — ${resumesParDate.size} assemblée(s).`)
  W(`- Registre consolidé : votes chiffrés — ${aEcrire.length} assemblée(s).`)
  W(`- Fichier de résumés : scrutateur, unité de vote, notes — ${avecComplement} assemblée(s).`)
  W('')

  if (soucis.length) {
    W('## À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }
  await ecrireRapport()
}

async function ecrireRapport() {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `resumes_ag_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
