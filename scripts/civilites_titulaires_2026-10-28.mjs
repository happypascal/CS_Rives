#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LA CIVILITÉ DES TITULAIRES (migration 068)
//
// Pascal, 28 octobre 2026 : « tu n'as pas ajouté les M. ou Mme dans civilité ».
//
// Exact : le découpage du matin ne posait la civilité que lorsqu'elle était
// ÉCRITE dans la chaîne (« Mme Junod »), soit douze lignes sur cent deux. Je
// m'étais refusé à la déduire d'un prénom. Pascal demande qu'on la pose ;
// c'est son arbitrage, et il est fondé : le registre sert à convoquer, et une
// convocation s'adresse.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ UNE TABLE, PAS UNE RÈGLE
// ──────────────────────────────────────────────────────────────────────────────
// Aucune donnée du registre ne porte le genre. Le libellé du syndic (« M.MME
// BERTRAND DANIEL ») vaut pour la PÉRIODE, pas pour chaque personne, et il
// nomme souvent le conjoint qui n'est pas au registre — sur 0B 199 il dit
// « M. PARGOUX JEAN-CLAUDE » là où le titulaire est Anne Pargoux. Il ne peut
// donc pas servir.
//
// Reste le prénom. Plutôt qu'un algorithme — une terminaison, une liste de
// milliers de noms, un taux d'erreur invisible — les soixante-trois prénoms
// réellement présents sont classés ICI, un par un, à la main. La table se
// relit en une minute, se corrige d'une ligne, et son contenu est vérifiable
// par n'importe qui. Un algorithme ne l'aurait pas été.
//
// ⚠ CE QUI EST DOUTEUX RESTE VIDE, et le rapport le nomme. Mieux vaut six
// civilités manquantes, qu'on voit et qu'on complète, qu'une seule erronée
// dans un registre qui sert à convoquer et à notifier — « Monsieur » adressé
// à une propriétaire n'est pas une coquille, c'est une marque de négligence
// envers un coloti.
//
// ⚠ ET ON NE TOUCHE JAMAIS UNE CIVILITÉ DÉJÀ POSÉE : les douze du matin
// viennent du registre lui-même, et toute correction faite à la main prime.
//
// Usage :
//   node scripts/civilites_titulaires_2026-10-28.mjs        essai à blanc
//   node scripts/civilites_titulaires_2026-10-28.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ── LA TABLE. Un prénom par ligne, tel qu'il figure au registre. ──────────────
const MASCULINS = [
  'Alain', 'Aurélien', 'Benoit', 'Bernard', 'Brendan', 'Christian', 'Daniel',
  'Danil', 'Denis', 'Florent', 'Gilbert', 'Henrik', 'Jamal', 'Jean-François',
  'Jean-Jacques', 'Julien', 'Laurent', 'Marc', 'Nicolas', 'Olivier', 'Pascal',
  'Philippe', 'Pierre', 'Raphaël', 'Robert', 'Thierry', 'Tino',
]

const FEMININS = [
  'Anne', 'Anouck', 'Aysha', 'Barbara', 'Caroline', 'Catherine', 'Corrine',
  'Danielle', 'Diane', 'Estelle', 'Fabienne', 'Françoise', 'Isabelle',
  'Josette', 'Laetitia', 'Larissa', 'Laura', 'Liliana', 'Lucienne', 'Ludivine',
  'Lynne', 'Maria', 'Miriam', 'Nayla', 'Sarah', 'Sonia', 'Sylvie', 'Valérie',
]

// ⚠ LAISSÉS VIDES, ET POURQUOI. Chacun a sa raison — c'est ce qui permet de
// les reprendre un par un plutôt que de les redécouvrir.
const DOUTEUX = {
  'Claude': 'porté par des hommes comme par des femmes',
  'Valeri': 'masculin en russe, mais la graphie féminine n’en diffère que d’une lettre',
  'Peregrine': 'prénom unisexe',
  'Coluni': 'ne ressemble à aucun prénom connu — peut-être un second patronyme',
  'Jacquier': '⚠ ce n’est pas un prénom : « Deschamps Jacquier » est probablement un double patronyme, à reprendre',
  'Mehdi': '⚠ masculin comme prénom, mais c’est ici un patronyme probable — « Deena Mehdi » serait alors inversé',
  'Hend Ibrahim': 'féminin en arabe (Hend), mais le second mot reste à qualifier',
  'Khalid Sulaiman': 'masculin en arabe (Khalid), mais le second mot reste à qualifier',
}

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

const { data: titulaires, error } = await supabase.from('titulaires').select('*')
if (error) { console.error(`❌ Lecture de \`titulaires\` : ${error.message}`); process.exit(1) }
const { data: periodes } = await supabase.from('proprietaires').select('id,lot_id')
const { data: lots } = await supabase.from('lots').select('id,numero')
const numeroDe = (t) => {
  const p = (periodes || []).find((x) => x.id === t.proprietaire_id)
  return (lots || []).find((l) => l.id === p?.lot_id)?.numero || '?'
}

const cle = (s) => (s || '').trim()
const M = new Set(MASCULINS.map(cle))
const F = new Set(FEMININS.map(cle))

// ⚠ Un prénom présent dans les deux tables serait une faute de saisie de MA
// part, et poserait une civilité au hasard. On refuse de tourner.
const collision = [...M].filter((p) => F.has(p))
if (collision.length) {
  console.error(`❌ Prénom classé deux fois : ${collision.join(', ')}. Rien n’est écrit.`)
  process.exit(1)
}

const aEcrire = []
const laissesVides = []
for (const t of titulaires) {
  if (t.civilite) continue                       // déjà posée, elle prime
  if (t.est_personne_morale) continue            // une société n'en a pas
  const p = cle(t.prenom)
  if (!p) {
    laissesVides.push({ t, raison: 'aucun prénom au registre' })
    continue
  }
  if (M.has(p)) { aEcrire.push({ t, civilite: 'M.' }); continue }
  if (F.has(p)) { aEcrire.push({ t, civilite: 'Mme' }); continue }
  laissesVides.push({ t, raison: DOUTEUX[p] || '⚠ prénom absent de la table — à classer' })
}

// ── Rapport ───────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
W(`# Civilités — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`${titulaires.length} titulaires · **${aEcrire.length} civilités à poser** `
  + `· ${laissesVides.length} laissées vides · ${titulaires.filter((t) => t.civilite).length} déjà renseignées.`)
W('')
W('⚠ La civilité est déduite du **prénom**, d’après une table écrite à la main')
W('(`MASCULINS` / `FEMININS` dans ce script). Aucune donnée du registre ne porte')
W('le genre : le libellé du syndic vaut pour la période et nomme souvent le')
W('conjoint absent du registre. Ce qui suit est donc une **déduction**, relisible')
W('ligne à ligne, et corrigible d’un clic sur la fiche.')
W('')

if (aEcrire.length) {
  W(`## Civilités posées (${aEcrire.length})`)
  W('')
  W('| Parcelle | Prénom | Nom | Civilité |')
  W('|---|---|---|---|')
  for (const { t, civilite } of aEcrire) {
    W(`| ${numeroDe(t)} | ${t.prenom} | ${t.nom} | **${civilite}** |`)
  }
  W('')
}

if (laissesVides.length) {
  W(`## ⚠ Laissées vides (${laissesVides.length})`)
  W('')
  W('Mieux vaut une civilité manquante, qu’on voit, qu’une civilité fausse.')
  W('')
  W('| Parcelle | Titulaire | Pourquoi |')
  W('|---|---|---|')
  for (const { t, raison } of laissesVides) {
    W(`| ${numeroDe(t)} | ${[t.prenom, t.nom].filter(Boolean).join(' ')} | ${raison} |`)
  }
  W('')
}

let faits = 0
if (GO && aEcrire.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `civilites-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'titulaires.json'), JSON.stringify(titulaires, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/civilites-${jour}\``)
  W('')
  for (const { t, civilite } of aEcrire) {
    const { error: e } = await supabase.from('titulaires').update({ civilite }).eq('id', t.id)
    if (e) { W(`> ⚠ ${numeroDe(t)} — ${t.nom} : ${e.message}`); continue }
    faits += 1
  }
  W(`**${faits} civilité(s) posées.**`)
  W('')
}

W('---')
W('')
W(GO ? `**${faits} posées · ${laissesVides.length} laissées vides.**`
  : `**Essai à blanc : ${aEcrire.length} à poser · ${laissesVides.length} laissées vides. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `civilites_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} posées · ${laissesVides.length} laissées vides.`
  : `${aEcrire.length} à poser · ${laissesVides.length} laissées vides (essai à blanc).`)
