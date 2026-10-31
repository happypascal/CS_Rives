#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LES TITRES DE PROPRIÉTÉ REÇUS PAR LE NOTAIRE (migration 059)
//
// Pascal, 31 octobre 2026 : « tu peux mettre à jour les titres reçus dans le
// registre des propriétaires ».
//
// Source : « TABLEAU LISTE DES PROPRIETAIRES.pdf », l'état annoté que Me Garnier
// a remis, scanné le 30 octobre 2026. Les lignes SURLIGNÉES y portent une
// annotation manuscrite « Lot N » : le titre est arrivé et le lot identifié.
//
// ⚠ LE GRIS DU TABLEAU NE DIT RIEN. Il est strictement alternant d'une ligne à
// l'autre, sur les deux pages : c'est un zébrage de lisibilité. C'est le
// SURLIGNEUR qui distingue, et il a été mesuré par saturation ligne à ligne —
// le gris est neutre, le fluo ne l'est pas — et non jugé à l'oeil sur un scan.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠⚠ LA DATE EST UN CONSTAT, PAS UNE RÉCEPTION
// ──────────────────────────────────────────────────────────────────────────────
// La 059 a choisi UNE DATE et non une case, pour de bonnes raisons : devant un
// délai statutaire et une recherche facturée 100 €, savoir QUAND un acte est
// arrivé vaut mieux que savoir qu'il l'est.
//
// Or l'état de Me Garnier ne date RIEN : il dit qui a transmis, pas quand. Les
// vraies dates n'existent nulle part — le fichier `suivi envoi actes.xlsx` du
// dossier est l'export que nous lui avons envoyé en septembre, et sa colonne
// « Acte reçu le » est vide.
//
// La seule date vérifiable est donc celle de l'ÉTAT lui-même : au 30 octobre
// 2026, ces titres étaient arrivés. C'est une BORNE SUPÉRIEURE, et chaque ligne
// le dit dans ses observations, pour que personne ne lise un jour ces dates
// comme des dates de réception exactes.
//
// L'alternative — tout laisser vide — était pire : le registre annoncerait
// « 0 titre reçu » et son filtre « Sans titre » relancerait vingt-cinq colotis
// qui ont déjà transmis. Un manque qu'on voit vaut mieux qu'une date fausse,
// mais une date bornée et dite comme telle vaut mieux qu'un registre muet.
//
// ⚠ ON N'ÉCRASE JAMAIS UNE DATE DÉJÀ POSÉE. 0B 243 porte le 26 septembre 2026 —
// une date RÉELLE, saisie à la main. La remplacer par la date du constat
// perdrait une information exacte au profit d'une approximation.
//
// Usage :
//   node scripts/titres_recus_2026-10-30.mjs        essai à blanc
//   node scripts/titres_recus_2026-10-30.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// La date de l'état annoté, pas celle du jour : c'est elle qui fait foi.
const DATE_CONSTAT = '2026-10-30'
const OBSERVATION = 'Transmission constatée sur l’état annoté de Me Garnier du 30/10/2026. '
  + '⚠ Date de CONSTAT, pas de réception : l’état ne date pas les envois, le titre est '
  + 'donc arrivé au plus tard à cette date.'

// Les 25 parcelles dont la ligne est SURLIGNÉE dans l'état, c'est-à-dire dont
// le titre est parvenu au notaire. Établies par complément des 25 lignes non
// surlignées, elles-mêmes mesurées puis relues une à une sur l'image.
const RECUES = [
  '0B 196', '0B 197', '0B 198', '0B 200', '0B 202', '0B 204', '0B 205', '0B 207',
  '0B 208', '0B 215', '0B 219', '0B 226', '0B 230', '0B 233', '0B 235', '0B 237',
  '0B 238', '0B 239', '0B 242', '0B 243', '0B 244', '0B 245', '0B 246',
  '0B 247+263', '0B 474+263',
]

async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
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
const { data: periodes, error: eP } = await supabase.from('proprietaires').select('*').is('date_cession', null)
if (eP) { console.error(`❌ Lecture de \`proprietaires\` : ${eP.message}`); process.exit(1) }

const parNumero = new Map(lots.map((l) => [l.numero, l]))
const periodeDe = new Map(periodes.map((p) => [p.lot_id, p]))

// ⚠ Une parcelle de la liste absente du registre serait une erreur de relevé :
// on refuse d'écrire plutôt que d'en ignorer une en silence.
const introuvables = RECUES.filter((n) => !parNumero.has(n))
if (introuvables.length) {
  console.error(`❌ Parcelles absentes du registre : ${introuvables.join(', ')}. Rien n’est écrit.`)
  process.exit(1)
}

const aEcrire = []
const dejaDatees = []
const sansProprietaire = []
for (const num of RECUES) {
  const p = periodeDe.get(parNumero.get(num).id)
  if (!p) { sansProprietaire.push(num); continue }
  if (p.acte_transmis_le) { dejaDatees.push({ num, p }); continue }
  // ⚠ La contrainte `proprietaires_acte_apres_acquisition` refuse une
  // transmission antérieure à l'acquisition. On la contrôle ICI pour que le
  // refus soit lisible — le message de Postgres ne le serait pas.
  if (p.date_acquisition && p.date_acquisition > DATE_CONSTAT) {
    sansProprietaire.push(`${num} (acquise le ${p.date_acquisition}, après le constat)`)
    continue
  }
  const obs = (p.acte_observations || '').trim()
  aEcrire.push({
    num, p,
    // On n'écrase pas une observation existante : on ajoute la nôtre.
    observations: obs ? `${obs}\n${OBSERVATION}` : OBSERVATION,
  })
}

const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
W(`# Titres reçus par le notaire — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`Source : état annoté de Me Garnier, scanné le 30/10/2026 · ${RECUES.length} parcelles surlignées.`)
W('')
W(`**${aEcrire.length} à dater** · ${dejaDatees.length} déjà datées (inchangées) · ${sansProprietaire.length} écartées.`)
W('')
W('⚠ **La date inscrite est celle du CONSTAT, pas de la réception.** L’état de')
W('Me Garnier dit qui a transmis, jamais quand ; aucune date réelle n’existe')
W('nulle part. Le titre est donc arrivé **au plus tard** le 30/10/2026, et')
W('chaque ligne le porte dans ses observations.')
W('')

if (aEcrire.length) {
  W('| Parcelle | Propriétaire | Date inscrite |')
  W('|---|---|---|')
  for (const { num, p } of aEcrire) W(`| ${num} | ${p.nom} | ${DATE_CONSTAT} |`)
  W('')
}
if (dejaDatees.length) {
  W(`## Déjà datées — laissées telles quelles (${dejaDatees.length})`)
  W('')
  W('⚠ Une date déjà posée est une date RÉELLE, saisie à la main. La remplacer')
  W('par celle du constat perdrait une information exacte.')
  W('')
  for (const { num, p } of dejaDatees) W(`- ${num} — ${p.nom} : ${p.acte_transmis_le}`)
  W('')
}
if (sansProprietaire.length) {
  W(`## ⚠ Écartées (${sansProprietaire.length})`)
  W('')
  for (const s of sansProprietaire) W(`- ${s}`)
  W('')
}

let faits = 0
if (GO && aEcrire.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `titres-recus-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'proprietaires.json'), JSON.stringify(periodes, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/titres-recus-${jour}\``)
  W('')
  for (const { num, p, observations } of aEcrire) {
    const { error } = await supabase.from('proprietaires')
      .update({ acte_transmis_le: DATE_CONSTAT, acte_observations: observations, updated_at: new Date().toISOString() })
      .eq('id', p.id)
    if (error) { W(`> ⚠ ${num} — ${p.nom} : ${error.message}`); continue }
    faits += 1
  }
  W(`**${faits} ligne(s) datées.**`)
  W('')
}

W('---')
W('')
W(GO ? `**${faits} datées · ${dejaDatees.length} inchangées.**`
  : `**Essai à blanc : ${aEcrire.length} à dater · ${dejaDatees.length} inchangées. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `titres_recus_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} datées · ${dejaDatees.length} inchangées.`
  : `${aEcrire.length} à dater · ${dejaDatees.length} inchangées (essai à blanc).`)
