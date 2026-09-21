// Corrections de la saisie initiale de la mémoire de l'ASL.
//
// Trois défauts signalés par Pascal après relecture (2026-09-21) : des pièces
// posées sur le SUJET au lieu de l'ENTRÉE, sept doublons, et deux dates dites
// « inconnues » qui étaient renseignées dans un autre sujet. Le détail et le
// raisonnement sont dans `scripts/data/corrections_memoire_2026-09-21.mjs`.
//
// Mêmes garde-fous qu'`import_memoire.mjs`, et pour la même raison : c'est un
// registre légal, en production, avec une clé qui contourne la RLS.
//   - essai à blanc par défaut, `--go` pour écrire ;
//   - sauvegarde du jour exigée avant toute écriture ;
//   - idempotent : une correction déjà faite est constatée, pas refaite ;
//   - rapport écrit sur disque autant qu'en console.
//
// ⚠ AUCUN FICHIER N'EST RETÉLÉVERSÉ. Le chemin en Storage porte l'id du SUJET
// (`sujets/<id>/<uuid>.<ext>`) et reste valable quelle que soit l'entrée qui le
// cite : déplacer une pièce, c'est déplacer une référence jsonb, rien de plus.
//
// Usage :
//   node scripts/corriger_memoire.mjs          → essai à blanc
//   node scripts/corriger_memoire.mjs --go     → écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { DATES_RETROUVEES, DOUBLONS_SUJET, PIECES_VERS_ENTREE } from './data/corrections_memoire_2026-09-21.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const BUCKET = 'documents'

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

// ⚠ COMPARER DES NOMS DE FICHIERS EN NORMALISANT L'UNICODE.
//
// macOS stocke les noms de fichiers en forme DÉCOMPOSÉE (NFD) : « é » y est
// « e » suivi d'un accent combinant. Les noms captés depuis le disque à l'import
// sont donc décomposés, tandis que tout nom RECOPIÉ À LA MAIN dans un fichier
// source est composé (NFC). Les deux s'affichent à l'identique et ne sont pas
// égaux — « Plan écoulement.pdf » était introuvable alors qu'il était là.
//
// ⚠ Un test d'égalité brut sur un nom accentué échoue EN SILENCE : rien ne
// signale que la comparaison portait sur deux encodages. Toujours normaliser.
const memeNom = (a, b) => String(a).normalize('NFC') === String(b).normalize('NFC')

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }
const n = { dates: 0, datesDejaFaites: 0, doublons: 0, doublonsDejaOtes: 0, deplacees: 0, dejaSurEntree: 0, introuvables: 0 }
const soucis = []

async function sauvegardeDuJour() {
  try {
    const d = await readdir(join(RACINE, 'backup'))
    const today = new Date().toISOString().slice(0, 10)
    return d.filter((x) => x.startsWith(today)).sort().pop() || null
  } catch { return null }
}

async function main() {
  W(`# Corrections de la mémoire de l’ASL — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.\n')
  else {
    const s = await sauvegardeDuJour()
    if (!s) {
      console.error('\n❌ AUCUNE SAUVEGARDE DU JOUR dans backup/. Lancez d’abord :\n\n     node scripts/backup.mjs\n')
      process.exit(1)
    }
    W(`> Sauvegarde du jour : \`backup/${s}\`.\n`)
  }

  const { data: sujets } = await supabase.from('sujets').select('id,titre,documents')
  const { data: entrees } = await supabase.from('sujet_entrees').select('id,sujet_id,titre,date_evenement,documents')
  const parTitre = Object.fromEntries(sujets.map((s) => [s.titre, s]))

  // ------------------------------------------------------------- 1. les dates
  W('## Dates retrouvées dans un autre sujet')
  W('')
  for (const d of DATES_RETROUVEES) {
    const sujet = parTitre[d.sujet]
    const e = entrees.find((x) => x.sujet_id === sujet?.id && x.titre === d.titreEntree)
    if (!e) { soucis.push(`Entrée introuvable : « ${d.titreEntree} » dans « ${d.sujet} »`); n.introuvables++; continue }
    if (e.date_evenement === d.date) { n.datesDejaFaites++; W(`- « ${d.titreEntree} » : déjà au ${d.date}.`); continue }
    if (GO) {
      const { error } = await supabase.from('sujet_entrees').update({ date_evenement: d.date }).eq('id', e.id)
      if (error) throw new Error(`date de « ${d.titreEntree} » : ${error.message}`)
    }
    n.dates++
    W(`- « ${d.titreEntree} » : ${e.date_evenement} → **${d.date}**`)
    W(`  - source : ${d.source}`)
  }
  W('')

  // ---------------------------------------------------------- 2. les doublons
  W('## Doublons retirés du sujet')
  W('')
  W('Ces fichiers sont déjà attachés à l’entrée qui les justifie, dans le même sujet.')
  W('')
  for (const bloc of DOUBLONS_SUJET) {
    const sujet = parTitre[bloc.sujet]
    if (!sujet) { soucis.push(`Sujet introuvable : ${bloc.sujet}`); continue }
    const garde = []
    const otes = []
    for (const doc of sujet.documents || []) {
      if (bloc.fichiers.some((f) => memeNom(f, doc.name))) otes.push(doc)
      else garde.push(doc)
    }
    if (!otes.length) { n.doublonsDejaOtes += bloc.fichiers.length; W(`- « ${bloc.sujet} » : rien à retirer (déjà fait).`); continue }
    if (GO) {
      const { error } = await supabase.from('sujets').update({ documents: garde }).eq('id', sujet.id)
      if (error) throw new Error(`doublons de « ${bloc.sujet} » : ${error.message}`)
      // ⚠ On efface AUSSI l'objet du Storage. Ailleurs, l'application laisse
      // délibérément des orphelins (retirer une pièce n'efface rien, migration
      // 012) — mais ici ce sont des copies exactes créées le jour même, dont
      // l'original est intact sur une entrée. Les garder ne protège de rien et
      // encombre le bucket.
      const chemins = otes.map((d) => d.path).filter(Boolean)
      if (chemins.length) await supabase.storage.from(BUCKET).remove(chemins)
    }
    n.doublons += otes.length
    W(`- « ${bloc.sujet} » : ${otes.length} doublon(s) ${GO ? 'retiré(s)' : 'à retirer'} —`)
    for (const d of otes) W(`  - ${d.name}`)
  }
  W('')

  // ------------------------------------------- 3. pièces déplacées vers l'entrée
  W('## Pièces déplacées du sujet vers l’entrée concernée')
  W('')
  // Groupé par sujet pour n'écrire qu'une fois par ligne de `sujets`.
  const parSujet = new Map()
  for (const p of PIECES_VERS_ENTREE) {
    if (!parSujet.has(p.sujet)) parSujet.set(p.sujet, [])
    parSujet.get(p.sujet).push(p)
  }
  for (const [titreSujet, liste] of parSujet) {
    const sujet = parTitre[titreSujet]
    if (!sujet) { soucis.push(`Sujet introuvable : ${titreSujet}`); continue }
    W(`### ${titreSujet}`)
    let docsSujet = [...(sujet.documents || [])]
    // Les ajouts à faire sur chaque entrée, accumulés puis écrits en une fois.
    const ajouts = new Map()
    for (const p of liste) {
      const e = entrees.find((x) => x.sujet_id === sujet.id && x.titre === p.titreEntree)
      if (!e) { soucis.push(`Entrée introuvable : « ${p.titreEntree} » dans « ${titreSujet} »`); n.introuvables++; continue }
      const surEntree = (e.documents || []).some((d) => memeNom(d.name, p.fichier))
      if (surEntree) { n.dejaSurEntree++; W(`- ${p.fichier} : déjà sur l’entrée.`); continue }
      const doc = docsSujet.find((d) => memeNom(d.name, p.fichier))
      if (!doc) { soucis.push(`Pièce introuvable sur le sujet : ${p.fichier}`); n.introuvables++; continue }
      docsSujet = docsSujet.filter((d) => d !== doc)
      if (!ajouts.has(e.id)) ajouts.set(e.id, { entree: e, docs: [...(e.documents || [])] })
      ajouts.get(e.id).docs.push(doc)
      n.deplacees++
      W(`- ${p.fichier} → entrée « ${p.titreEntree} »`)
    }
    if (GO && (ajouts.size || docsSujet.length !== (sujet.documents || []).length)) {
      for (const { entree, docs } of ajouts.values()) {
        const { error } = await supabase.from('sujet_entrees').update({ documents: docs }).eq('id', entree.id)
        if (error) throw new Error(`pièces de l’entrée « ${entree.titre} » : ${error.message}`)
      }
      const { error } = await supabase.from('sujets').update({ documents: docsSujet }).eq('id', sujet.id)
      if (error) throw new Error(`pièces du sujet « ${titreSujet} » : ${error.message}`)
    }
    W('')
  }

  // ---------------------------------------------------------------- bilan
  W('## Bilan')
  W('')
  W('| | |')
  W('|---|---|')
  W(`| Dates ${GO ? 'corrigées' : 'à corriger'} | ${n.dates} |`)
  W(`| Dates déjà bonnes | ${n.datesDejaFaites} |`)
  W(`| Doublons ${GO ? 'retirés' : 'à retirer'} | ${n.doublons} |`)
  W(`| Doublons déjà retirés | ${n.doublonsDejaOtes} |`)
  W(`| Pièces ${GO ? 'déplacées' : 'à déplacer'} | ${n.deplacees} |`)
  W(`| Pièces déjà sur leur entrée | ${n.dejaSurEntree} |`)
  W(`| Éléments introuvables | ${n.introuvables} |`)
  W('')
  if (soucis.length) {
    W('### À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `corrections_memoire_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (!GO) console.log('   Rien n’a été écrit. Relancer avec --go pour appliquer.')
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
