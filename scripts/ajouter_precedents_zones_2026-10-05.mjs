#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// Les PRÉCÉDENTS ANCIENS d'exclusion par zone, portés dans les SYNTHÈSES
// (5 octobre 2026, demande de Pascal : « ok ajoute »)
//
// POURQUOI. Le lot des PV anciens a fait entrer cinq entrées de chronologie
// arbitrées le même jour — 1968, 1974, 1982 en zone C, 1976 et 1987 en plage.
// Elles sont dans la CHRONOLOGIE, mais les deux SYNTHÈSES étaient hors du
// périmètre du brief et n'ont pas bougé. Or c'est la synthèse qu'on lit en
// premier : celle de « Distraction zone C » ouvrait son historique sur « En
// mars 2025 », si bien que l'argument le plus ancien du dossier — une dispense
// constatée trois fois en quatorze ans — restait invisible à qui ne dépliait
// pas la chronologie. ⚠ C'est la séparation voulue des deux tables de la 045
// (`sujet_entrees` s'ajoute, `sujets.contenu` se réécrit) : elle n'est pas un
// automatisme, il faut rédiger.
//
// ⚠ AUCUN FAIT NOUVEAU. Les deux paragraphes ne résument que des entrées DÉJÀ
// en base, elles-mêmes lues sur l'image par Claude (Cowork). Aucun PV n'est
// relu ici, aucun chiffre n'est dérivé.
//
// ⚠ ÉDITIONS CIBLÉES, PAS DE RÉÉCRITURE. On insère un `<p>` après un `<h3>`
// nommé, et rien d'autre ne change. Une réécriture complète ferait disparaître
// sans trace le texte de la révision du 30 septembre.
//
// ⚠ L'APOSTROPHE EST DROITE (U+0027), pas typographique. La convention d'UI du
// dépôt dit « ’ », mais CES DEUX CHAMPS utilisent « ' » de bout en bout (ils
// viennent des JSON de Claude). On aligne sur le CHAMP, pas sur la règle
// générale : une apostrophe courbe au milieu d'un paragraphe droit se voit.
// Vérifié avant d'écrire, pas supposé.
//
// ⚠ L'IDEMPOTENCE SE TESTE SUR `nouveau` EN ENTIER, ET AVANT DE CHERCHER
// L'ANCRE — leçon de la lettre du SIVOM (2026-10-01) : ici l'ancre SURVIT dans
// le résultat (on insère entre deux balises qu'on reconduit), donc un script
// qui raisonne « l'ancre est là, donc j'applique » empile le paragraphe à
// chaque exécution. ⚠ Et jamais sur un PRÉFIXE de `nouveau` : il commence par
// l'ancre, un test de préfixe répondrait « déjà fait » dès le premier passage.
//
// Usage :
//   node scripts/ajouter_precedents_zones_2026-10-05.mjs        essai à blanc
//   node scripts/ajouter_precedents_zones_2026-10-05.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process' // ⚠ importé, sinon oxlint lève `no-undef` — convention du dossier

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ── Les deux éditions ────────────────────────────────────────────────────────
// `ancre` doit figurer EXACTEMENT une fois ; le paragraphe est inséré juste
// après le titre de section, donc AVANT le texte existant — l'ordre
// chronologique l'exige dans les deux cas.
const EDITIONS = [
  {
    sujet: 'Distraction zone C',
    ancre: '<h3>Historique</h3><p>En mars 2025,',
    apres: '<h3>Historique</h3>',
    paragraphe:
      "<p>Un précédent ancien. L'assemblée a constaté à trois reprises que les parcelles donnant " +
      'sur la route de Nernier à Messery sont dispensées de participer à certains frais : en 1968 ' +
      "pour le goudronnage, « que le cahier des charges dispense de participer aux frais d'entretien " +
      "des routes du lotissement » ; en 1974 pour le téléphone, ceux-ci « n'utiliseront jamais les " +
      "installations du lotissement » ; en 1982, la répartition de l'article 7 chiffrée par le " +
      "syndic ne comprend aucun lot C. La demande de 2026 n'est donc pas sans antécédent.</p>",
  },
  {
    sujet: 'Plage',
    ancre: '<h3>Usages et entretien</h3><p>Les assemblées traitent longtemps',
    apres: '<h3>Usages et entretien</h3>',
    paragraphe:
      '<p>Dès 1976, le garage des bateaux est admis par un vote des seules zones B à E ; en 1987, ' +
      "le coût de la rampe d'accès au lac est pris en charge par les copropriétaires concernés " +
      "« à l'exception zone A ». L'assiette des charges de la plage a donc varié selon les zones " +
      'bien avant les débats actuels.</p>',
  },
]

const MOTIF = 'Précédents anciens d’exclusion par zone portés dans la synthèse (5 octobre 2026).'

// ── Connexion ────────────────────────────────────────────────────────────────
async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // ⚠ En ÉCHAPPEMENTS : collés tels quels, U+2028 coupe le littéral en deux.
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

/** Sauvegarde des deux tables de la mémoire, avant toute écriture. */
async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `precedents-zones-${jour}`)
  await mkdir(dir, { recursive: true })
  for (const table of ['sujets', 'sujet_entrees']) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`sauvegarde ${table} : ${error.message}`)
    await writeFile(join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${table} : ${data.length} ligne(s)`)
  }
  return dir
}

// ── Travail ──────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)

W(`# Précédents anciens portés dans les synthèses — ${GO ? 'écriture' : 'essai à blanc'}`)
W('')
W(`_${new Date().toISOString()}_`)
W('')

let sauvegarde = null
if (GO) {
  console.log('Sauvegarde du jour…')
  sauvegarde = await sauvegardeDuJour()
  W(`Sauvegarde : \`${sauvegarde.replace(RACINE + '/', '')}\``)
  W('')
}

const aEcrire = []
const anomalies = []

for (const e of EDITIONS) {
  const { data: s, error } = await supabase
    .from('sujets')
    .select('id,titre,contenu,historique,resume')
    .eq('titre', e.sujet)
    .maybeSingle()
  if (error) { anomalies.push(`**${e.sujet}** — lecture refusée : ${error.message}`); continue }
  if (!s) { anomalies.push(`**${e.sujet}** — sujet introuvable, rien écrit pour lui.`); continue }

  const avant = s.contenu || ''
  const apres = avant.replace(e.apres, e.apres + e.paragraphe)

  // ⚠ 1. L'IDEMPOTENCE D'ABORD, sur le paragraphe EN ENTIER.
  if (avant.includes(e.paragraphe)) {
    W(`## ${e.sujet} — déjà en place`)
    W('')
    W('Le paragraphe figure déjà dans la synthèse ; rien à écrire.')
    W('')
    continue
  }

  // ⚠ 2. L'ancre doit figurer EXACTEMENT une fois. Zéro : la synthèse a changé.
  //    Plusieurs : on ne sait pas où insérer, et prendre la première serait un
  //    tirage au sort.
  const n = avant.split(e.ancre).length - 1
  if (n !== 1) {
    anomalies.push(`**${e.sujet}** — ancre trouvée ${n} fois (il en faut exactement 1) : rien écrit.`)
    continue
  }

  // 3. Garde-fou : la synthèse ne peut que s'allonger.
  if (apres.length <= avant.length) {
    anomalies.push(`**${e.sujet}** — la synthèse ne s'allonge pas (${avant.length} → ${apres.length}) : rien écrit.`)
    continue
  }

  aEcrire.push({ s, avant, apres, e })
  W(`## ${e.sujet}`)
  W('')
  W(`- synthèse : **${avant.length} → ${apres.length}** caractères`)
  W(`- inséré juste après \`${e.apres}\``)
  W('')
  W('> ' + e.paragraphe.replace(/<\/?p>/g, '').trim())
  W('')
}

if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}

W('---')
W('')
W(`**${aEcrire.length} synthèse(s) à écrire · ${anomalies.length} anomalie(s).**`)
W('')
W('Aucune entrée de chronologie touchée, aucune supprimée ; `pv_archives` et `resume_resolutions` intacts.')
W('')

if (GO) {
  for (const { s, avant, apres, e } of aEcrire) {
    // ⚠ L'ancienne synthèse est CONSERVÉE (patron de la migration 065) : une
    // mémoire qui perd ses versions ne peut plus dire qui a écrit quoi, ni quand.
    const historique = [...(s.historique || []), { le: new Date().toISOString(), motif: MOTIF, resume: s.resume ?? null, contenu: avant }]
    const { error } = await supabase.from('sujets').update({ contenu: apres, historique }).eq('id', s.id)
    if (error) { console.error(`❌ ${e.sujet} : ${error.message}`); process.exitCode = 1; continue }
    console.log(`✅ ${e.sujet} — synthèse complétée, version précédente conservée (${historique.length} au total).`)
  }
} else {
  console.log('Essai à blanc — rien n’a été écrit. Relancer avec --go.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `precedents_zones_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
