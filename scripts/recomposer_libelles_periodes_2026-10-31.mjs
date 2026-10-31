#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LE LIBELLÉ DE CHAQUE PÉRIODE, RECOMPOSÉ DEPUIS SES DÉTENTEURS
//
// Pascal, 31 octobre 2026 :
//   « Si on a pas le prénom on ajoute M. ou Mme depuis la civilité.
//     Et dans la liste du registre si M et Mme sont copropriétaire, il faut
//     le voir sans ouvrir la fiche. »
//
// Les deux demandes n'en font qu'une. La liste des parcelles affiche
// `proprietaires.nom` — le LIBELLÉ de la période. Depuis aujourd'hui ce
// libellé se déduit des détenteurs… mais seulement AU MOMENT OÙ L'ON
// ENREGISTRE LA FICHE. Les cinquante et une périodes du registre portent donc
// encore celui de l'import de 2026, qui ne nommait qu'une personne : d'où une
// liste où un couple propriétaire n'apparaît que sous un seul nom.
//
// ⚠ C'EST LE PIÈGE D'UNE DÉRIVATION POSÉE SUR UN REGISTRE DÉJÀ REMPLI. La
// règle est juste pour tout ce qui sera saisi désormais, et sans effet sur
// tout ce qui existe. Une dérivation qu'on n'applique pas une fois au passé
// ne corrige rien de ce qu'on voit.
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QUE LE LIBELLÉ DEVIENT
// ──────────────────────────────────────────────────────────────────────────────
// Les DÉTENTEURS actifs, joints par « / » :
//   - « Jean Ferran / Marie Delachaux »  (deux indivisaires)
//   - « M. Hartwig / Mme Hartwig »       (prénoms inconnus, civilités connues)
//   - « SCI Logudoro »                   (personne morale, dénomination seule)
//
// ⚠ UN DIRIGEANT, UN MANDATAIRE OU UN NU-PROPRIÉTAIRE N'Y FIGURENT PAS : ils
// ne sont pas propriétaires. Les y mettre ferait dire au registre, à la liste
// et au PDF du notaire que le gérant d'une SCI possède le lot.
//
// ⚠ ET LA CIVILITÉ REMPLACE LE PRÉNOM, elle ne s'y ajoute pas. « M. Jean
// Ferran » alourdit cinquante lignes sans rien apprendre.
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QU'IL NE FAIT PAS
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ IL NE TOUCHE JAMAIS UNE PÉRIODE SANS DÉTENTEUR. Un libellé dérivé vide
// effacerait une colonne `not null` et, pire, ferait disparaître le seul nom
// que le registre connaisse. Ces périodes sont LISTÉES, pas corrigées.
//
// ⚠ IL NE TOUCHE PAS NON PLUS LES PÉRIODES CLOSES. L'historique dit ce que le
// registre portait à l'époque ; le recomposer réécrirait le passé avec les
// informations d'aujourd'hui.
//
// Usage :
//   node scripts/recomposer_libelles_periodes_2026-10-31.mjs        (essai à blanc)
//   node scripts/recomposer_libelles_periodes_2026-10-31.mjs --go   (écrit)
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { libelleDeLaPeriode } from '../src/lib/proprietaireLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

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
const numeroDe = new Map(lots.map((l) => [l.id, l.numero]))

const { data: periodes, error: eP } = await supabase
  .from('proprietaires').select('id,lot_id,nom').is('date_cession', null)
if (eP) { console.error(`❌ Lecture de \`proprietaires\` : ${eP.message}`); process.exit(1) }

const { data: titulaires, error: eT } = await supabase
  .from('titulaires')
  // ⚠ `est_membre_votant` EST INDISPENSABLE : c'est lui qui ordonne le
  // libellé. Omis du select, il vaut `undefined` partout, le tri retombe en
  // silence sur l'alphabétique, et le lot s'intitule « Mme Gladkov / Danil
  // Gladkov » — la personne qui ne porte pas la voix en tête. Un tri qui lit
  // un champ non sélectionné n'échoue jamais, il trie faux.
  .select('proprietaire_id,nom,prenom,civilite,role,est_personne_morale,est_membre_votant,date_fin')
  .is('date_fin', null)
if (eT) { console.error(`❌ Lecture de \`titulaires\` : ${eT.message}`); process.exit(1) }

const parPeriode = new Map()
for (const t of titulaires) {
  if (!parPeriode.has(t.proprietaire_id)) parPeriode.set(t.proprietaire_id, [])
  parPeriode.get(t.proprietaire_id).push(t)
}

const aEcrire = []
const inchangees = []
const sansDetenteur = []

for (const p of periodes) {
  const liste = parPeriode.get(p.id) || []
  const derive = libelleDeLaPeriode({ titulaires: liste })
  const parcelle = numeroDe.get(p.lot_id) || '?'
  if (!derive) { sansDetenteur.push({ parcelle, nom: p.nom, titulaires: liste.length }); continue }
  if (derive === p.nom) { inchangees.push({ parcelle, nom: p.nom }); continue }
  aEcrire.push({ id: p.id, parcelle, avant: p.nom, apres: derive })
}

// ── Sauvegarde, puis écriture ───────────────────────────────────────────────
const jour = new Date().toISOString().slice(0, 10)
if (GO && aEcrire.length) {
  await mkdir(join(RACINE, 'backup'), { recursive: true })
  const horodate = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  await writeFile(
    join(RACINE, 'backup', `libelles-periodes-${horodate}.json`),
    JSON.stringify(aEcrire.map((a) => ({ id: a.id, parcelle: a.parcelle, nom: a.avant })), null, 2),
    'utf8',
  )
  for (const a of aEcrire) {
    const r = await supabase.from('proprietaires')
      .update({ nom: a.apres, updated_at: new Date().toISOString() }).eq('id', a.id).select()
    if (r.error) { console.error(`❌ ${a.parcelle} : ${r.error.message}`); process.exit(1) }
  }
}

// ── Rapport ─────────────────────────────────────────────────────────────────
const out = []
out.push('# Libellés des périodes, recomposés depuis les détenteurs')
out.push('')
out.push(`${GO ? 'Appliqué' : 'Essai à blanc'} le ${jour}.`)
out.push('')
out.push(`${periodes.length} période(s) en cours · **${aEcrire.length} à recomposer** · `
  + `${inchangees.length} déjà conforme(s) · ${sansDetenteur.length} sans détenteur`)
out.push('')
if (aEcrire.length) {
  out.push('| Parcelle | Avant | Après |')
  out.push('|---|---|---|')
  for (const a of aEcrire) out.push(`| ${a.parcelle} | ${a.avant} | **${a.apres}** |`)
  out.push('')
}
if (sansDetenteur.length) {
  out.push('## Périodes sans détenteur — NON TOUCHÉES')
  out.push('')
  out.push('Aucun titulaire détenteur : il n’y a rien d’où tirer un libellé, et')
  out.push('écrire le vide effacerait le seul nom que le registre connaisse.')
  out.push('')
  for (const s of sansDetenteur) {
    out.push(`- **${s.parcelle}** — « ${s.nom} » · ${s.titulaires} titulaire(s), aucun détenteur`)
  }
  out.push('')
}

await mkdir(join(RACINE, 'export'), { recursive: true })
const chemin = join(RACINE, 'export', `libelles_periodes_${jour}.md`)
await writeFile(chemin, out.join('\n'), 'utf8')

console.log(GO ? '✅ APPLIQUÉ' : '🔍 ESSAI À BLANC (ajouter --go pour écrire)')
console.log(`  ${periodes.length} période(s) · ${aEcrire.length} à recomposer · ${inchangees.length} conforme(s) · ${sansDetenteur.length} sans détenteur`)
for (const a of aEcrire.slice(0, 12)) console.log(`   ${a.parcelle} · « ${a.avant} » → « ${a.apres} »`)
if (aEcrire.length > 12) console.log(`   … et ${aEcrire.length - 12} autre(s), voir le rapport`)
console.log(`  → ${chemin.replace(RACINE + '/', '')}`)
