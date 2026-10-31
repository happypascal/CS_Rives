#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LES NUMÉROS DE LOT CORRIGÉS À LA MAIN PAR LE PRÉSIDENT (migration 069)
//
// Pascal, 31 octobre 2026 : « j'ai corrigé dans le xlsx ». Le fichier est celui
// que le registre avait produit — 50 lignes, une colonne « LOT CORRIGÉ » vide —
// et il revient avec vingt valeurs.
//
// ⚠ CETTE SOURCE PRIME SUR TOUTES LES AUTRES, y compris sur l'état annoté de
// Me Garnier et sur les plans de la mairie. C'est le président de l'ASL qui
// tranche, et deux de ses corrections REMPLACENT une valeur déjà écrite.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ CE QUE LES DEUX CORRECTIONS NOUS APPRENNENT
// ──────────────────────────────────────────────────────────────────────────────
// J'avais lu « Lot 3 et 5 » sur l'annotation de 0B 247+263 et l'avais recopié
// tel quel. Pascal écrit « 5 + 0.81 * 3 », et sur 0B 474+263 « 1 + 0.19 * 3 ».
//
// Ce n'est pas une mise en forme : c'est le SENS. La parcelle 263 a été divisée
// entre deux propriétaires sans cesser d'être une seule parcelle au cadastre
// (038). Le lot 3 d'origine est donc partagé — 81 % d'un côté, 19 % de
// l'autre — et c'est exactement ce qui produit les `nombre_lots` de 1,81 et
// 1,19 : un lot entier plus une fraction du lot 3.
//
//     0B 247+263 = lot 5 entier + 81 % du lot 3  →  1,81
//     0B 474+263 = lot 1 entier + 19 % du lot 3  →  1,19
//
// Mon « 3 et 5 » disait qu'il y avait deux lots ; il ne disait pas que l'un
// n'est là qu'en partie, ni laquelle. Dans un registre qui sert d'assiette aux
// voix et aux charges, c'est toute la différence.
//
// ⚠ Et c'est pourquoi la colonne est du TEXTE : aucune de ces deux valeurs
// n'est un nombre. La 069 l'avait choisi pour « 3 et 5 » ; la vraie raison est
// plus forte encore.
//
// ⚠ VÉRIFIÉ AVANT LECTURE : le classeur revenu d'Excel ne contient AUCUNE
// formule. « 5 + 0.81 * 3 » aurait pu y être calculé en 7,43 — un nombre qui
// n'aurait rien voulu dire, et que rien n'aurait signalé.
//
// Usage :
//   node scripts/appliquer_lots_corriges_2026-10-31.mjs        essai à blanc
//   node scripts/appliquer_lots_corriges_2026-10-31.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { inflateRawSync } from 'node:zlib'
import { Buffer } from 'node:buffer'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const CLASSEUR = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/'
  + '4_ASL/1-#50-Superficies/lots_origine_2026-10-31.xlsx'
const SOURCE = 'Corrigé à la main par le président, 31/10/2026 — fait foi sur toute autre source'

// ── Lecture du .xlsx, sans dépendance ────────────────────────────────────────
// ⚠ Le projet écrit déjà un classeur sans bibliothèque (`src/lib/xlsx.js`) ;
// en lire un demande seulement de décompresser le ZIP. Ajouter une dépendance
// pour vingt valeurs serait disproportionné.
function entreesZip(buf) {
  const out = new Map()
  // On parcourt le répertoire central, seul endroit qui donne des tailles sûres.
  let fin = buf.length - 22
  while (fin >= 0 && buf.readUInt32LE(fin) !== 0x06054b50) fin -= 1
  if (fin < 0) throw new Error('ZIP illisible : fin de répertoire introuvable')
  let p = buf.readUInt32LE(fin + 16)
  const n = buf.readUInt16LE(fin + 10)
  for (let i = 0; i < n; i += 1) {
    const nomLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commLen = buf.readUInt16LE(p + 32)
    const nom = buf.toString('utf8', p + 46, p + 46 + nomLen)
    const debut = buf.readUInt32LE(p + 42)
    const methode = buf.readUInt16LE(p + 10)
    const taille = buf.readUInt32LE(p + 20)
    const nl = buf.readUInt16LE(debut + 26)
    const el = buf.readUInt16LE(debut + 28)
    const donnees = buf.subarray(debut + 30 + nl + el, debut + 30 + nl + el + taille)
    out.set(nom, methode === 0 ? donnees : inflateRawSync(donnees))
    p += 46 + nomLen + extraLen + commLen
  }
  return out
}

const deXml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

const zip = entreesZip(await readFile(CLASSEUR))
const feuille = [...zip.keys()].find((k) => /^xl\/worksheets\/sheet\d+\.xml$/.test(k))
const xmlFeuille = zip.get(feuille).toString('utf8')

// ⚠ LE GARDE QUI COMPTE. Excel aurait pu interpréter « 5 + 0.81 * 3 » comme une
// formule : la cellule porterait alors un <f> et une valeur calculée. On refuse
// plutôt que d'inscrire un nombre dont personne ne saurait d'où il vient.
if (/<f[\s>]/.test(xmlFeuille)) {
  console.error('❌ Le classeur contient des formules : une valeur pourrait être calculée au lieu d’être écrite. Rien n’est lu.')
  process.exit(1)
}

const sst = zip.has('xl/sharedStrings.xml')
  ? [...zip.get('xl/sharedStrings.xml').toString('utf8').matchAll(/<si>([\s\S]*?)<\/si>/g)]
    .map((m) => deXml(m[1].replace(/<[^>]+>/g, '')))
  : []

const lignes = [...xmlFeuille.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((m) => {
  const cells = {}
  for (const c of m[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
    const ref = /r="([A-Z]+)\d+"/.exec(c[1])?.[1]
    if (!ref) continue
    const v = /<v>([\s\S]*?)<\/v>/.exec(c[2]) || /<t[^>]*>([\s\S]*?)<\/t>/.exec(c[2])
    let val = v ? deXml(v[1]) : ''
    if (/t="s"/.test(c[1]) && /^\d+$/.test(val)) val = sst[Number(val)] ?? ''
    cells[ref] = val.trim()
  }
  return cells
})

const entete = lignes[0] || {}
if (entete.A !== 'Parcelle' || !/LOT CORRIG/i.test(entete.H || '')) {
  console.error('❌ Ce n’est pas le classeur attendu : colonne A ou H inattendue. Rien n’est lu.')
  process.exit(1)
}
const corrections = new Map()
for (const c of lignes.slice(1)) {
  if (c.A && c.H) corrections.set(c.A, c.H)
}

// ── Connexion ────────────────────────────────────────────────────────────────
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
const parNumero = new Map(lots.map((l) => [l.numero, l]))

const inconnues = [...corrections.keys()].filter((n) => !parNumero.has(n))
if (inconnues.length) {
  console.error(`❌ Parcelles du classeur absentes du registre : ${inconnues.join(', ')}. Rien n’est écrit.`)
  process.exit(1)
}

const aEcrire = []
const inchangees = []
for (const [num, lot] of corrections) {
  const l = parNumero.get(num)
  if (l.numero_origine === lot) { inchangees.push(num); continue }
  aEcrire.push({ l, lot, avant: l.numero_origine })
}

// ── Doublons, SIGNALÉS et non refusés (doctrine de la 069) ───────────────────
const apres = new Map(lots.map((l) => [l.numero, [l.zone, corrections.get(l.numero) || l.numero_origine]]))
const couples = new Map()
for (const [num, [z, lot]] of apres) {
  if (!lot) continue
  const base = /^\s*(\d+)/.exec(lot)?.[1]
  if (!base) continue
  const k = `${z}|${base}`
  couples.set(k, [...(couples.get(k) || []), num])
}
const doublons = [...couples.entries()].filter(([, v]) => v.length > 1)

const out = []
const W = (s = '') => out.push(s)
const horodatage = new Date().toISOString()
W(`# Lots d’origine corrigés par le président — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`Source : \`lots_origine_2026-10-31.xlsx\`, colonne « LOT CORRIGÉ ».`)
W(`${corrections.size} valeurs lues · **${aEcrire.length} à écrire** · ${inchangees.length} déjà identiques.`)
W('')
W('⚠ Cette source **prime sur toutes les autres** — état annoté du notaire,')
W('plans de la mairie, acte de vente. C’est le président qui tranche.')
W('')
if (aEcrire.length) {
  W('| Parcelle | Zone | Avant | Après |')
  W('|---|---|---|---|')
  for (const { l, lot, avant } of aEcrire) {
    W(`| ${l.numero} | ${l.zone || ''} | ${avant || '_(vide)_'} | **${lot}** |`)
  }
  W('')
}
W('## Doublons (zone, lot) après écriture')
W('')
W(doublons.length
  ? `⚠ ${doublons.map(([k, v]) => `${k} → ${v.join(', ')}`).join(' ; ')}`
  : '_Aucun._')
W('')
const couverture = [...apres.values()].filter(([, lot]) => lot).length
W(`## Couverture : ${couverture} / ${lots.length} parcelles`)
W('')

let faits = 0
if (GO && aEcrire.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `lots-corriges-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'lots.json'), JSON.stringify(lots, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/lots-corriges-${jour}\``)
  W('')
  for (const { l, lot } of aEcrire) {
    const { error: e } = await supabase.from('lots')
      .update({ numero_origine: lot, origine_source: SOURCE, updated_at: new Date().toISOString() })
      .eq('id', l.id)
    if (e) { W(`> ⚠ ${l.numero} : ${e.message}`); continue }
    faits += 1
  }
  W(`**${faits} parcelle(s) écrites.**`)
  W('')
}
W('---')
W('')
W(GO ? `**${faits} écrites · ${inchangees.length} inchangées.**`
  : `**Essai à blanc : ${aEcrire.length} à écrire. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `lots_corriges_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), out.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} écrites · ${couverture}/${lots.length} parcelles couvertes.`
  : `${aEcrire.length} à écrire · ${doublons.length} doublon(s) (essai à blanc).`)
