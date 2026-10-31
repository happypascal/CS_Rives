#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// TABLEAU DES NUMÉROS DE LOT D'ORIGINE, À CORRIGER À LA MAIN
//
// Pascal, 31 octobre 2026 : « fais-moi un CSV et je corrige ».
//
// Une ligne par parcelle, les 50. Trois colonnes à lire, une à remplir :
//   - ce que le registre SAIT déjà, et d'où ça vient ;
//   - ce que l'ordre des adresses PROPOSE, quand le registre ne sait pas ;
//   - une colonne « LOT CORRIGÉ », vide, que Pascal remplit.
//
// ⚠ ON NE MÉLANGE PAS LE SU ET LE SUPPOSÉ dans une même colonne. Un tableau
// qui donnerait un seul numéro par ligne, sans dire lequel est lu sur un acte
// et lequel est déduit d'un ordre de rue, ferait relire tout le registre à
// celui qui veut vérifier.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ UN VRAI .xlsx, ET UN CSV EN PLUS — PAS L'INVERSE
// ──────────────────────────────────────────────────────────────────────────────
// Pascal demande un CSV. Le projet en a déjà fait deux, pour le notaire, et les
// deux sont sortis de travers : en point-virgule le fichier s'ouvrait en UNE
// seule colonne (Excel découpe sur le séparateur de liste du SYSTÈME — virgule
// en en_CH, le réglage de ce Mac, point-virgule en fr_FR chez l'étude) ; et
// corrigé par une ligne `sep=,`, les accents cassaient, la directive faisant
// basculer Excel sur un import ancien qui ignore le BOM.
//
// Un format qui ne décrit ni son encodage ni son séparateur ne peut pas
// satisfaire deux locales à la fois. On produit donc les DEUX : le `.xlsx`,
// qui porte son encodage, et le `.csv` demandé, en virgule et BOM UTF-8 —
// celui-ci s'ouvre correctement sur CE Mac, et c'est tout ce qu'on lui demande.
//
// ⚠ TOUT EN TEXTE dans le classeur : « 0B 220 » perdrait son zéro de tête et
// « 3 et 5 » n'est pas un nombre.
//
// Usage : node scripts/tableau_lots_origine_2026-10-31.mjs
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { Buffer } from 'node:buffer'
import { classeurXLSX } from '../src/lib/xlsx.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

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
const { data: periodes } = await supabase.from('proprietaires').select('*').is('date_cession', null)
const proprioDe = new Map((periodes || []).map((p) => [p.lot_id, p]))

const rue = (a) => {
  const m = /^\s*(\d+)\s*(.*)$/.exec(a || '')
  return m ? [m[2].trim().toLowerCase(), Number(m[1])] : ['', 999]
}
const cle = (a) => rue(a).join('|')

// ⚠ L'ORDRE DES LOTS, DÉDUIT ET NON LU. La suite descend le long de l'Allée de
// Rives puis tourne dans l'Allée des Précettes — c'est le lot 3 de Diane De
// Bertier (1 Précettes), confirmé par Pascal le 31 octobre, qui fixe l'endroit
// où elle tourne. Sans cette confirmation, la suite se prolongeait d'un cran
// sur l'Allée de Rives et donnait un numéro faux à trois parcelles.
const ordreB = [...[3, 5, 7, 9, 11, 13, 15, 17, 19].map((n) => `allée de rives|${n}`),
  'allée des précettes|1', 'allée des précettes|2', 'allée de rives|21']
const PROPOSE = new Map(ordreB.map((k, i) => [k, String(12 - i)]))
for (const [i, n] of [4, 6, 8, 10].entries()) PROPOSE.set(`allée des précettes|${n}`, String(1 + 2 * i))
for (const [i, n] of [3, 5, 7, 9].entries()) PROPOSE.set(`allée des précettes|${n}`, String(2 + 2 * i))

// ⚠ Les deux parcelles qui se partagent les lots 1 et 2 de la zone B : le
// comptage les force à être l'une ou l'autre, mais rien ne dit laquelle. On
// l'ÉCRIT plutôt que de choisir — c'est précisément ce que Pascal corrigera.
const INDECIDABLES = new Set(['0B 240', '0B 241'])

const source = (l) => {
  const s = l.origine_source || ''
  if (s.includes('Acte')) return 'acte de vente'
  if (s.includes('Plans')) return 'plans de la mairie'
  if (s.includes('État')) return 'état annoté de Me Garnier'
  return ''
}

const rows = lots
  .map((l) => {
    const p = proprioDe.get(l.id)
    const zone = l.zone || ''
    const propose = (zone === 'B' || zone === 'D') && !l.numero_origine ? PROPOSE.get(cle(l.adresse_lotissement)) || '' : ''
    return {
      zone,
      adresse: l.adresse_lotissement || '',
      tri: rue(l.adresse_lotissement),
      ligne: [
        l.numero,
        zone,
        l.adresse_lotissement || '',
        p ? p.nom : '— parcelle vacante —',
        l.numero_origine || '',
        source(l),
        INDECIDABLES.has(l.numero) ? '1 ou 2' : propose,
        '',   // LOT CORRIGÉ — à remplir
      ],
    }
  })
  .sort((a, b) => (a.zone || 'Z').localeCompare(b.zone || 'Z')
    || a.tri[0].localeCompare(b.tri[0]) || a.tri[1] - b.tri[1])
  .map((r) => r.ligne)

const ENTETES = ['Parcelle', 'Zone', 'Adresse dans le lotissement', 'Propriétaire actuel',
  'Lot connu', 'D’où vient le lot connu', 'Lot proposé (déduit)', 'LOT CORRIGÉ']
const LARGEURS = [12, 6, 26, 32, 11, 26, 20, 14]

await mkdir(join(RACINE, 'export'), { recursive: true })
const jour = new Date().toISOString().slice(0, 10)

const octets = classeurXLSX([ENTETES, ...rows], { largeurs: LARGEURS, feuille: 'Lots d’origine' })
const cheminXlsx = join(RACINE, 'export', `lots_origine_${jour}.xlsx`)
await writeFile(cheminXlsx, Buffer.from(octets))

// ⚠ VIRGULE et BOM UTF-8 : c'est ce que lit Excel dans la locale de ce Mac.
// Les champs sont tous entre guillemets — une adresse contient des virgules.
const echap = (v) => `"${String(v).replace(/"/g, '""')}"`
const csv = '\uFEFF' + [ENTETES, ...rows].map((r) => r.map(echap).join(',')).join('\r\n') + '\r\n'
const cheminCsv = join(RACINE, 'export', `lots_origine_${jour}.csv`)
await writeFile(cheminCsv, csv, 'utf8')

const connus = rows.filter((r) => r[4]).length
const proposes = rows.filter((r) => !r[4] && r[6]).length
console.log(`${rows.length} parcelles · ${connus} lots connus · ${proposes} proposés · ${rows.length - connus - proposes} sans rien`)
console.log(`  ${cheminXlsx.replace(RACINE + '/', '')}`)
console.log(`  ${cheminCsv.replace(RACINE + '/', '')}`)
