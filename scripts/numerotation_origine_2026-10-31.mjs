#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LA NUMÉROTATION D'ORIGINE DES LOTS (migration 069)
//
// Pascal, 31 octobre 2026 : « relève les numéros de lot et propose où les
// ranger », puis « il faut aussi ajouter un champ pour le lot ».
//
// Deux écritures, qui n'ont pas la même nature :
//   1. la ZONE sort des `observations`, où elle était en texte libre depuis la
//      035 — c'est un simple déplacement, vérifiable caractère par caractère ;
//   2. le NUMÉRO D'ORIGINE est inscrit pour 26 parcelles, relevé sur l'état
//      annoté de Me Garnier du 30 octobre 2026 — c'est une donnée neuve, lue
//      dans les actes par le notaire.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ CE RELEVÉ EST DE L'ÉCRITURE MANUSCRITE SUR UN SCAN, ET IL S'EST DÉJÀ TROMPÉ
// ──────────────────────────────────────────────────────────────────────────────
// J'avais lu « Lot 6 » sur la ligne de 0B 243. Cela entrait en collision avec
// 0B 244, lot 6 zone E lui aussi — et c'est cette collision qui a fait chercher
// plus loin. L'acte de vente, lu par OCR, dit « lot numéro QUATRE (4) de la
// Zone E ». La valeur retenue est donc celle de l'ACTE, et son `origine_source`
// le dit.
//
// Les vingt-cinq autres n'ont PAS été vérifiées sur les actes : elles viennent
// de l'annotation, et leur source le dit aussi. C'est tout l'objet de la
// colonne — savoir, dans dix ans, laquelle relire.
//
// ⚠ ON NE DÉDUIT RIEN. La zone A contient deux séries incompatibles
// (0B 200 → lot 2, mais 0B 196 → lot 14) et aucune autre zone n'a de
// régularité : les 24 parcelles manquantes ne se calculent pas, elles se lisent
// sur les actes à mesure qu'ils arrivent.
//
// Usage :
//   node scripts/numerotation_origine_2026-10-31.mjs        essai à blanc
//   node scripts/numerotation_origine_2026-10-31.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

const ETAT = 'État annoté de Me Garnier du 30/10/2026 (annotation manuscrite, non vérifiée sur l’acte)'
const ACTE = 'Acte de vente du propriétaire, lu le 31/10/2026 — « lot numéro QUATRE (4) de la Zone E »'

// Les 26 correspondances relevées. ⚠ Le numéro est écrit TEL QU'IL SE LIT :
// « 09 » garde son zéro, « 3 et 5 » reste tel quel — 0B 247+263 est la parcelle
// qui pèse 1,81 lot, elle en porte réellement deux.
const RELEVE = [
  ['0B 219', '10', ETAT], ['0B 239', '1', ETAT], ['0B 235', '8', ETAT],
  ['0B 207', '09', ETAT], ['0B 244', '6', ETAT], ['0B 205', '7', ETAT],
  ['0B 196', '14', ETAT], ['0B 238', '3', ETAT], ['0B 231', '3', ETAT],
  ['0B 246', '7', ETAT], ['0B 233', '4', ETAT], ['0B 242', '2', ETAT],
  ['0B 208', '10', ETAT], ['0B 200', '2', ETAT], ['0B 243', '4', ACTE],
  ['0B 204', '6', ETAT], ['0B 215', '12', ETAT], ['0B 237', '5', ETAT],
  ['0B 226', '1', ETAT], ['0B 198', '16', ETAT], ['0B 202', '4', ETAT],
  ['0B 474+263', '1', ETAT], ['0B 197', '15', ETAT], ['0B 245', '8', ETAT],
  ['0B 230', '4', ETAT], ['0B 247+263', '3 et 5', ETAT],
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

const { data: lots, error } = await supabase.from('lots').select('*')
if (error) { console.error(`❌ Lecture de \`lots\` : ${error.message}`); process.exit(1) }
if (!('zone' in (lots[0] || {}))) {
  console.error('❌ La migration 069 n’a pas été passée : la colonne `zone` n’existe pas.')
  process.exit(1)
}
const parNumero = new Map(lots.map((l) => [l.numero, l]))

const introuvables = RELEVE.filter(([n]) => !parNumero.has(n)).map(([n]) => n)
if (introuvables.length) {
  console.error(`❌ Parcelles absentes du registre : ${introuvables.join(', ')}. Rien n’est écrit.`)
  process.exit(1)
}

// ── 1. La zone, extraite des observations ────────────────────────────────────
// ⚠ On n'écrit QUE si l'on sait reconstituer le reste exactement. Deux
// observations portent autre chose (« Zone E, 1,19 lot ») : cette mention fait
// doublon avec `nombre_lots`, et c'est le script qui la retire — pas une
// expression régulière lâchée sur du texte libre.
const zones = []
const observationsNonTraitees = []
for (const l of lots) {
  const obs = (l.observations || '').trim()
  const m = obs.match(/^Zone\s+([A-E])\s*(?:,\s*([\d,]+)\s+lot)?$/)
  if (!m) {
    if (obs) observationsNonTraitees.push({ l, obs })
    continue
  }
  const [, z, nbTexte] = m
  const restant = nbTexte ? `Comptait pour ${nbTexte} lot — voir le champ « nombre de lots ».` : null
  if (l.zone === z && (l.observations || null) === restant) continue
  zones.push({ l, zone: z, observations: restant, avant: obs })
}

// ── 2. Les numéros d'origine ─────────────────────────────────────────────────
const numeros = []
const dejaPosés = []
for (const [num, lot, source] of RELEVE) {
  const l = parNumero.get(num)
  // ⚠ Une valeur déjà posée n'est jamais écrasée : elle peut venir d'une
  // correction faite à la main sur l'acte, qui prime sur ce relevé.
  if (l.numero_origine) { dejaPosés.push({ l, lot }); continue }
  numeros.push({ l, lot, source })
}

// ── Les doublons, SIGNALÉS et non refusés (cf. section 4 de la 069) ──────────
const couples = new Map()
for (const [num, lot] of RELEVE) {
  const l = parNumero.get(num)
  const z = l.zone || (zones.find((x) => x.l.id === l.id) || {}).zone || '?'
  for (const part of lot.split(' et ').map((x) => x.trim())) {
    const cle = `${part}|${z}`
    couples.set(cle, [...(couples.get(cle) || []), num])
  }
}
const doublons = [...couples.entries()].filter(([, v]) => v.length > 1)

const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
W(`# Numérotation d’origine des lots — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`${lots.length} parcelles · **${zones.length} zones à déplacer** · **${numeros.length} numéros à inscrire** `
  + `· ${dejaPosés.length} déjà posés (inchangés) · ${lots.length - RELEVE.length} parcelles sans numéro connu.`)
W('')
W('⚠ Le relevé vient d’une **annotation manuscrite sur un scan**, sauf une ligne')
W('lue sur l’acte. Chaque parcelle porte sa source, parce qu’elles n’ont pas la')
W('même force — et parce qu’une de mes lectures s’est déjà révélée fausse.')
W('')

if (zones.length) {
  W(`## Zones sorties des observations (${zones.length})`)
  W('')
  W('| Parcelle | Observations avant | Zone | Observations après |')
  W('|---|---|---|---|')
  for (const { l, zone, observations, avant } of zones) {
    W(`| ${l.numero} | ${avant} | **${zone}** | ${observations || '_(vide)_'} |`)
  }
  W('')
}
if (observationsNonTraitees.length) {
  W(`## ⚠ Observations non reconnues, laissées intactes (${observationsNonTraitees.length})`)
  W('')
  for (const { l, obs } of observationsNonTraitees) W(`- ${l.numero} — \`${obs}\``)
  W('')
}
if (numeros.length) {
  W(`## Numéros d’origine inscrits (${numeros.length})`)
  W('')
  W('| Parcelle | Zone | Lot | Source |')
  W('|---|---|---|---|')
  for (const { l, lot, source } of numeros) {
    const z = l.zone || (zones.find((x) => x.l.id === l.id) || {}).zone || '?'
    W(`| ${l.numero} | ${z} | **${lot}** | ${source.slice(0, 60)}… |`)
  }
  W('')
}
if (dejaPosés.length) {
  W(`## Déjà posés — laissés tels quels (${dejaPosés.length})`)
  W('')
  for (const { l, lot } of dejaPosés) W(`- ${l.numero} : ${l.numero_origine} _(le relevé dit ${lot})_`)
  W('')
}
W('## Doublons (zone, lot)')
W('')
W(doublons.length
  ? `⚠ **${doublons.length}** — signalés, pas refusés : ${doublons.map(([k, v]) => `${k} → ${v.join(', ')}`).join(' ; ')}`
  : '_Aucun : le couple (zone, lot) est unique sur les 26 parcelles connues._')
W('')
W('## Ce qui reste à retrouver')
W('')
W(`${lots.length - RELEVE.length} parcelles n’ont pas de numéro d’origine. ⚠ Il ne se **déduit pas** :`)
W('la zone A contient deux séries incompatibles (0B 200 → lot 2, mais 0B 196 →')
W('lot 14) et aucune autre zone n’a de régularité. Ils se liront sur les actes.')
W('')

let faits = 0
if (GO && (zones.length || numeros.length)) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `numerotation-origine-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'lots.json'), JSON.stringify(lots, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/numerotation-origine-${jour}\``)
  W('')
  // Une seule écriture par parcelle : zone et numéro ensemble.
  const patchs = new Map()
  for (const { l, zone, observations } of zones) patchs.set(l.id, { ...(patchs.get(l.id) || {}), zone, observations })
  for (const { l, lot, source } of numeros) {
    patchs.set(l.id, { ...(patchs.get(l.id) || {}), numero_origine: lot, origine_source: source })
  }
  for (const [id, patch] of patchs) {
    const { error: e } = await supabase.from('lots')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
    if (e) { W(`> ⚠ ${parNumero.get([...parNumero.keys()].find((k) => parNumero.get(k).id === id))?.numero} : ${e.message}`); continue }
    faits += 1
  }
  W(`**${faits} parcelle(s) écrites.**`)
  W('')
}

W('---')
W('')
W(GO ? `**${faits} parcelles écrites.**`
  : `**Essai à blanc : ${zones.length} zones + ${numeros.length} numéros. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `numerotation_origine_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} parcelles écrites.`
  : `${zones.length} zones · ${numeros.length} numéros · ${doublons.length} doublon(s) (essai à blanc).`)
