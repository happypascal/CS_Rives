#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// MÉMOIRE DE L'ASL — nouveau sujet « Circulation, vitesse et stationnement »
// Brief du 14 octobre 2026 · `scripts/data/memoire_circulation_vitesse_2026-10-14.json`
//
// Pascal cherchait la règle des 30 km/h : elle n'a jamais été votée, et la
// mémoire n'en gardait que deux traces, rangées sous « Portails ». Claude
// (Cowork) a relu les PV. ⚠ LES TEXTES NE SE REFORMULENT PAS.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ CE QUE CE SCRIPT NE FAIT PAS, ET POURQUOI : LE DOUBLE RATTACHEMENT DE 1968
// ──────────────────────────────────────────────────────────────────────────────
// Le fichier demande `action: "copier_le_rattachement"` sur l'entrée du
// 03/08/1968 — « la rattacher aux deux sujets ». **La base ne le permet pas** :
// `sujet_entrees.sujet_id` est une colonne unique et `not null`, il n'existe
// aucune table de liaison. Une entrée appartient à UN sujet.
//
// Les comptes attendus par le brief le confirment, et ils sont contradictoires
// entre eux : le nouveau sujet devrait compter 13 entrées (11 + 2), « Portails »
// garder celle de 1968, et le TOTAL n'augmenter que de 11. Si l'on duplique la
// ligne pour la faire figurer des deux côtés, le total augmente de 12.
//
// Trois issues, toutes des décisions, aucune un défaut :
//   1. la laisser dans « Portails » (ce que fait ce script) ;
//   2. la DUPLIQUER — deux lignes qui divergeront dès la première correction,
//      exactement le mode de ruine que l'unicité du titre de sujet (045) évite ;
//   3. une MIGRATION (table de liaison, ou `sujets_secondaires uuid[]`), qui
//      touche la chronologie, les compteurs et l'écran.
//
// On applique donc tout ce qui ne dépend pas de cet arbitrage, et on le SIGNALE
// au rapport. `--dupliquer-1968` existe pour appliquer l'issue 2 si elle est
// choisie : explicite, jamais par défaut.
//
// Usage :
//   node scripts/importer_memoire_circulation_2026-10-14.mjs        essai à blanc
//   node scripts/importer_memoire_circulation_2026-10-14.mjs --go   écrit
//   …                                             --go --dupliquer-1968
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const DUPLIQUER_1968 = process.argv.includes('--dupliquer-1968')
const DONNEES = join(RACINE, 'scripts', 'data', 'memoire_circulation_vitesse_2026-10-14.json')
const AUTEUR_ROLE = 'president'

// ⚠ `sujets.contenu` ET `sujet_entrees.contenu` SONT DU HTML (rendus par
// `dangerouslySetInnerHTML`) : tout ce qui vient d'un fichier doit être ÉCHAPPÉ,
// sinon une esperluette casse la fiche. Les textes du jour n'en contiennent
// aucune — on échappe quand même, la prochaine fournée en contiendra.
const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** JJ/MM/AAAA → AAAA-MM-JJ. ⚠ Une date illisible fait échouer, jamais retomber. */
function dateISO(v) {
  const t = String(v || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  if (!m) return null
  return `${m[3]}-${m[2]}-${m[1]}`
}

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

// ── Données ──────────────────────────────────────────────────────────────────
const brut = JSON.parse(await readFile(DONNEES, 'utf8'))
const NS = brut.nouveau_sujet
if (!NS?.sujet || !NS.entrees_a_ajouter?.length) {
  console.error('❌ Fichier de données inattendu : `nouveau_sujet` incomplet. Rien n’est écrit.')
  process.exit(1)
}

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `memoire-circulation-${jour}`)
  await mkdir(dir, { recursive: true })
  for (const table of ['sujets', 'sujet_entrees']) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`sauvegarde ${table} : ${error.message}`)
    await writeFile(join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${table} : ${data.length} ligne(s)`)
  }
  return dir
}

// ── Rapport ──────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
W(`# Mémoire — « ${NS.sujet} » ${GO ? '· ÉCRITURE' : '· essai à blanc'}`)
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

const anomalies = []
const { data: membres } = await supabase.from('membres_cs').select('id,role').eq('role', AUTEUR_ROLE).limit(1)
const auteurId = membres?.[0]?.id
if (!auteurId) { console.error(`❌ aucun membre « ${AUTEUR_ROLE} ».`); process.exit(1) }

const { data: sujets } = await supabase.from('sujets').select('id,titre,contenu,resume,categorie')
const { count: totalAvant } = await supabase.from('sujet_entrees').select('*', { count: 'exact', head: true })

// ── 1. Le sujet ──────────────────────────────────────────────────────────────
// ⚠ `titre` est UNIQUE (045) : deux sujets « Circulation » couperaient la
// connaissance en deux moitiés dont aucune ne serait complète.
let sujet = sujets.find((s) => s.titre === NS.sujet)
const contenuSujet = (NS.synthese || [])
  .map((sec) => `<h3>${esc(sec.titre)}</h3><p>${esc(sec.texte)}</p>`).join('')

W('## 1. Le sujet')
W('')
if (sujet) {
  W(`- **${NS.sujet}** existe déjà — non recréé.`)
} else {
  W(`- **${NS.sujet}** à créer · catégorie « ${NS.categorie} » · ${NS.synthese?.length || 0} section(s) de synthèse`)
  W(`  > ${NS.resume}`)
}
W('')

if (GO && !sujet) {
  const { data, error } = await supabase.from('sujets').insert({
    titre: NS.sujet,
    categorie: NS.categorie || null,
    resume: NS.resume || null,
    contenu: contenuSujet,
    created_by: auteurId,
  }).select()
  if (error) { console.error(`❌ création du sujet : ${error.message}`); process.exit(1) }
  sujet = data[0]
  console.log(`✅ sujet créé · ${NS.sujet}`)
}

// ── 2. Les entrées ───────────────────────────────────────────────────────────
W(`## 2. Les ${NS.entrees_a_ajouter.length} entrées`)
W('')
const aCreer = []
let dejaLa = 0
if (sujet) {
  const { data: existantes } = await supabase.from('sujet_entrees')
    .select('id,date_evenement,titre').eq('sujet_id', sujet.id)
  const cle = (d, t) => `${d}|${t}`
  const vues = new Set((existantes || []).map((e) => cle(e.date_evenement, e.titre)))
  for (const e of NS.entrees_a_ajouter) {
    const iso = dateISO(e.date)
    if (!iso) { anomalies.push(`date illisible « ${e.date} » sur « ${e.titre} » — rien écrit pour elle.`); continue }
    if (vues.has(cle(iso, e.titre))) { dejaLa++; continue }
    // Même forme que le lot du 5 octobre : le fait, puis sa source en italique.
    const contenu = `<p>${esc(e.texte)}</p>${e.source ? `<p><em>${esc(e.source)}</em></p>` : ''}`
    aCreer.push({
      sujet_id: sujet.id,
      date_evenement: iso,
      titre: e.titre,
      contenu,
      resultat: e.resultat || null,
      auteur_id: auteurId,
    })
    W(`- **${e.date}** — ${e.titre}  _(${e.resultat || 'sans résultat'})_`)
  }
} else {
  for (const e of NS.entrees_a_ajouter) W(`- **${e.date}** — ${e.titre}  _(${e.resultat || 'sans résultat'})_`)
  W('')
  W('_(essai à blanc : le sujet n’existe pas encore, les entrées sont listées telles qu’elles seront créées.)_')
}
if (dejaLa) W(`\n_${dejaLa} entrée(s) déjà présente(s), non recréée(s)._`)
W('')

if (GO && aCreer.length) {
  const { error } = await supabase.from('sujet_entrees').insert(aCreer)
  if (error) { console.error(`❌ insertion des entrées : ${error.message}`); process.exitCode = 1 }
  else console.log(`✅ ${aCreer.length} entrée(s) créée(s).`)
}

// ── 3. Les rattachements ─────────────────────────────────────────────────────
W('## 3. Les deux entrées existantes')
W('')
const mouvements = []
for (const d of NS.entrees_a_deplacer || []) {
  const source = sujets.find((s) => s.titre === d.depuis)
  if (!source) { anomalies.push(`sujet d’origine introuvable : « ${d.depuis} ».`); continue }
  const iso = dateISO(d.date)
  const { data: cibles } = await supabase.from('sujet_entrees')
    .select('id,titre,contenu,date_evenement,resultat,documents')
    .eq('sujet_id', source.id).eq('date_evenement', iso).eq('titre', d.titre_actuel)
  if (!cibles?.length) {
    // ⚠ Peut-être DÉJÀ déplacée : on regarde dans le sujet d'arrivée avant de crier.
    const { data: arrivee } = sujet
      ? await supabase.from('sujet_entrees').select('id').eq('sujet_id', sujet.id).eq('date_evenement', iso).eq('titre', d.titre_actuel)
      : { data: [] }
    if (arrivee?.length) { W(`- **${d.date}** — ${d.titre_actuel} : déjà dans le nouveau sujet.`); continue }
    anomalies.push(`entrée introuvable dans « ${d.depuis} » : ${d.date} — ${d.titre_actuel}`)
    W(`- ⚠ **${d.date}** — ${d.titre_actuel} : introuvable, rien écrit.`)
    continue
  }
  if (cibles.length > 1) {
    anomalies.push(`${cibles.length} entrées candidates pour ${d.date} — ${d.titre_actuel} : on ne devine pas laquelle.`)
    continue
  }
  const e = cibles[0]

  if (d.action === 'deplacer') {
    mouvements.push({ type: 'deplacer', id: e.id, titre: e.titre, date: d.date })
    W(`- **${d.date}** — ${e.titre} : **déplacée** de « ${d.depuis} » vers « ${NS.sujet} ».`)
    W(`  > ${d.motif}`)
  } else if (d.action === 'copier_le_rattachement') {
    if (DUPLIQUER_1968) {
      mouvements.push({ type: 'dupliquer', id: e.id, titre: e.titre, date: d.date, source: e })
      W(`- **${d.date}** — ${e.titre} : **dupliquée** vers « ${NS.sujet} » (\`--dupliquer-1968\`).`)
      W('  ⚠ Deux lignes distinctes désormais : une correction sur l’une ne touchera pas l’autre.')
    } else {
      W(`- ⚠ **${d.date}** — ${e.titre} : **laissée dans « ${d.depuis} »**, rien écrit.`)
      W('')
      W('  Le fichier demande de la rattacher **aux deux sujets**. `sujet_entrees.sujet_id` est une')
      W('  colonne unique et `not null` : une entrée appartient à UN sujet, il n’existe aucune table')
      W('  de liaison. Les comptes du brief le confirment et se contredisent — 13 entrées dans le')
      W('  nouveau sujet, 1968 conservée dans « Portails », et un total qui n’augmente que de 11 :')
      W('  dupliquer la ligne ferait +12.')
      W('')
      W('  Trois issues, toutes des décisions : la laisser où elle est ; la **dupliquer**')
      W('  (`--dupliquer-1968`, deux lignes qui divergeront dès la première correction) ; ou une')
      W('  **migration** (table de liaison) qui touche la chronologie, les compteurs et l’écran.')
    }
  } else {
    anomalies.push(`action inconnue « ${d.action} » sur ${d.date}.`)
  }
}
W('')

if (GO) {
  for (const m of mouvements) {
    if (m.type === 'deplacer') {
      const { error } = await supabase.from('sujet_entrees').update({ sujet_id: sujet.id }).eq('id', m.id)
      if (error) { console.error(`❌ déplacement ${m.date} : ${error.message}`); process.exitCode = 1 }
      else console.log(`✅ déplacée · ${m.date} — ${m.titre}`)
    } else if (m.type === 'dupliquer') {
      const s = m.source
      const { error } = await supabase.from('sujet_entrees').insert({
        sujet_id: sujet.id,
        date_evenement: s.date_evenement,
        titre: s.titre,
        contenu: s.contenu,
        resultat: s.resultat,
        documents: s.documents || [],
        auteur_id: auteurId,
      })
      if (error) { console.error(`❌ duplication ${m.date} : ${error.message}`); process.exitCode = 1 }
      else console.log(`✅ dupliquée · ${m.date} — ${m.titre}`)
    }
  }
}

// ── Bilan ────────────────────────────────────────────────────────────────────
if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}
W('---')
W('')
// ⚠ EN ESSAI, LE SUJET N'EXISTE PAS ENCORE : `aCreer` reste vide puisqu'on ne
// peut pas rattacher une entrée à un sujet absent. Afficher « 300 → 300 » là où
// onze entrées vont naître ferait lire un essai pour un non-événement. On
// projette donc le compte à partir du fichier quand le sujet est à créer.
const prevues = sujet ? aCreer.length : NS.entrees_a_ajouter.length
const creees = prevues + mouvements.filter((m) => m.type === 'dupliquer').length
W(`**${sujet && GO ? 'sujet créé' : '1 sujet à créer'} · ${prevues} entrée(s) · ${mouvements.filter((m) => m.type === 'deplacer').length} déplacement(s) · ${anomalies.length} anomalie(s).**`)
W('')
W(`Entrées : **${totalAvant} → ${totalAvant + creees}**. Aucune entrée supprimée ; \`pv_archives\` et \`resume_resolutions\` intacts.`)
W('')
if (!DUPLIQUER_1968) {
  W('⚠ **Le double rattachement de l’entrée du 03/08/1968 n’est pas appliqué** — voir §3.')
  W('')
}

if (GO) {
  const { count } = await supabase.from('sujet_entrees').select('*', { count: 'exact', head: true })
  if (count < totalAvant) {
    console.error(`❌ ALERTE : ${totalAvant} entrées avant, ${count} après. Restaurer depuis la sauvegarde.`)
    process.exitCode = 1
  } else {
    console.log(`\nEntrées : ${totalAvant} → ${count}.`)
  }
} else {
  console.log('Essai à blanc — rien n’a été écrit. Relancer avec --go.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `memoire_circulation_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
