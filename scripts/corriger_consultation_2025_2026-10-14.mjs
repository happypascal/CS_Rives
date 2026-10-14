#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// MÉMOIRE — le résultat de la 2e consultation, POINT PAR POINT
// Brief du 14 octobre 2026 · `scripts/data/consultation_2025_point_par_point_2026-10-14.json`
//
// L'entrée du 17/04/2025 donnait une FOURCHETTE globale (« 72,6 à 78,9 % des
// superficies »). Claude (Cowork) a recalculé depuis l'export du formulaire :
// le point 3 ne recueille que 70,3 %, et la borne basse de 72,6 % comptait comme
// favorable un commentaire qui n'en était pas un. ⚠ LE TEXTE NE SE REFORMULE PAS.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ LES SAUTS DE LIGNE DOIVENT SURVIVRE
// ──────────────────────────────────────────────────────────────────────────────
// `sujet_entrees.contenu` est du HTML (`dangerouslySetInnerHTML`) : un texte à
// sauts de ligne s'y écrase en un bloc. Le brief exige que **les 9 points
// s'affichent sur 9 lignes** — c'est tout l'objet de la correction. On rend donc
// les lignes vides en `<p>` et les sauts simples en `<br>`, et on ÉCHAPPE tout :
// une esperluette non échappée casse la fiche.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ « CONSERVER L'ANCIEN TEXTE DANS L'HISTORIQUE (065) » — OÙ, AU JUSTE
// ──────────────────────────────────────────────────────────────────────────────
// La migration 065 a posé `sujets.historique`, qui garde les versions
// antérieures d'une SYNTHÈSE. **`sujet_entrees` n'a aucune colonne d'historique.**
// Le seul historique qui existe est donc celui du sujet parent : on y range la
// version précédente de l'entrée, en la NOMMANT (`entree: {id, date, titre}`)
// pour qu'un relecteur ne la prenne pas pour une ancienne synthèse.
//
// ⚠ Vérifié avant d'écrire : `sujets.historique` n'est **lu par aucun écran** —
// c'est une trace, pas un affichage. L'y ajouter ne change donc rien à la fiche.
// Si un jour les entrées méritent leur propre historique, ce sera une migration.
//
// Usage :
//   node scripts/corriger_consultation_2025_2026-10-14.mjs        essai à blanc
//   node scripts/corriger_consultation_2025_2026-10-14.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises'
import { join, dirname, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const DONNEES = join(RACINE, 'scripts', 'data', 'consultation_2025_point_par_point_2026-10-14.json')
// Les pièces de Pascal vivent hors du dépôt, sous la racine du lotissement.
const RACINE_LOTISSEMENT = join(RACINE, '..', '..')
const BUCKET = 'documents'
const TYPE_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Texte brut → HTML : ligne vide = paragraphe, saut simple = `<br>`. */
const enHTML = (texte) => String(texte)
  .split(/\n{2,}/)
  .map((bloc) => `<p>${bloc.split('\n').map(esc).join('<br>')}</p>`)
  .join('')

const dateISO = (v) => {
  const t = String(v || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
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

const D = JSON.parse(await readFile(DONNEES, 'utf8'))
const CORRECTION = D.corrections_entrees?.[0]
const PIECE = D.piece_jointe
if (!CORRECTION?.nouveau) {
  console.error('❌ `corrections_entrees` vide ou sans texte. Rien n’est écrit.')
  process.exit(1)
}

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `consultation-2025-${jour}`)
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
W(`# Consultation 2025, point par point ${GO ? '· ÉCRITURE' : '· essai à blanc'}`)
W('')
W(`_${new Date().toISOString()}_`)
W('')

if (GO) {
  console.log('Sauvegarde du jour…')
  const dir = await sauvegardeDuJour()
  W(`Sauvegarde : \`${dir.replace(RACINE + '/', '')}\``)
  W('')
}

const anomalies = []

// ── La cible ─────────────────────────────────────────────────────────────────
const { data: sujet } = await supabase.from('sujets')
  .select('id,titre,contenu,resume,historique').eq('titre', CORRECTION.sujet).maybeSingle()
if (!sujet) { console.error(`❌ Sujet introuvable : « ${CORRECTION.sujet} ».`); process.exit(1) }

const iso = dateISO(CORRECTION.date)
const { data: candidates } = await supabase.from('sujet_entrees')
  .select('id,titre,contenu,documents,date_evenement,auteur_id')
  .eq('sujet_id', sujet.id).eq('date_evenement', iso).eq('titre', CORRECTION.titre_actuel)

if (!candidates?.length) { console.error(`❌ Entrée introuvable : ${CORRECTION.date} — ${CORRECTION.titre_actuel}`); process.exit(1) }
if (candidates.length > 1) { console.error(`❌ ${candidates.length} entrées candidates : on ne devine pas laquelle.`); process.exit(1) }
const entree = candidates[0]

// ⚠ `ancien` VIDE = remplacement intégral (le brief le dit). On ne cherche donc
// aucune sous-chaîne : ce serait inventer une règle que le fichier ne donne pas.
const nouveauHTML = enHTML(CORRECTION.nouveau)
const dejaFait = entree.contenu === nouveauHTML

W('## 1. Le texte de l’entrée')
W('')
W(`- **${CORRECTION.date}** — ${entree.titre}`)
W(`- sujet : ${sujet.titre}`)
if (dejaFait) {
  W('- **déjà corrigé** — contenu identique, rien à écrire.')
} else {
  W(`- contenu : **${entree.contenu.length} → ${nouveauHTML.length}** caractères`)
  W(`- rendu : ${(nouveauHTML.match(/<p>/g) || []).length} paragraphes, ${(nouveauHTML.match(/<br>/g) || []).length} sauts de ligne`)
  W(`- auteur et date **inchangés** ; ${(entree.documents || []).length} pièce(s) jointe(s) conservée(s)`)
  W('')
  W(`  > ${CORRECTION.motif}`)
}
W('')

// ── La pièce jointe ──────────────────────────────────────────────────────────
W('## 2. La pièce jointe')
W('')
let piece = null
let infoFichier = null
if (PIECE?.fichier) {
  const chemin = join(RACINE_LOTISSEMENT, PIECE.fichier)
  try {
    infoFichier = await stat(chemin)
  } catch {
    anomalies.push(`fichier introuvable : ${PIECE.fichier}`)
    W(`- ⚠ **introuvable** : \`${PIECE.fichier}\` — rien n’est joint.`)
  }
  if (infoFichier) {
    const nom = basename(chemin)
    // ⚠ Déjà jointe ? On compare sur le NOM : le chemin porte un uuid neuf à
    // chaque envoi, s'y fier rejoindrait le fichier à chaque exécution.
    const deja = (entree.documents || []).some((d) => d.name === nom)
    if (deja) {
      W(`- **${nom}** est déjà jointe — rien à envoyer.`)
    } else {
      piece = { chemin, nom, taille: infoFichier.size }
      W(`- **${nom}** · ${Math.round(infoFichier.size / 1024)} Ko · à joindre`)
      W(`  > ${PIECE.libelle}`)
      W(`  ⚠ Chemin de dépôt : \`sujets/${sujet.id}/…\` — il porte l’id du SUJET, pas de l’entrée (046).`)
    }
  }
}
W('')

// ── La synthèse ──────────────────────────────────────────────────────────────
// Demande du brief : si elle cite 72,6, ne pas la toucher et le signaler.
W('## 3. La synthèse du sujet')
W('')
const nuSyn = (sujet.contenu || '').replace(/<[^>]+>/g, ' ')
if (/72[,.]6/.test(nuSyn)) {
  W('- ⚠ La synthèse **cite « 72,6 »** : elle n’est pas modifiée, conformément au brief. À revoir à la main.')
  anomalies.push('la synthèse du sujet cite « 72,6 » — non modifiée, à revoir.')
} else {
  W('- Elle ne cite ni « 72,6 » ni « 72.6 » : **rien à signaler**, et rien n’a été touché.')
}
W('')

if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}
W('---')
W('')
W(`**${dejaFait ? 0 : 1} texte à corriger · ${piece ? 1 : 0} pièce à joindre · ${anomalies.length} anomalie(s).**`)
W('')
W('Aucune entrée créée ni supprimée. `pv_archives` et `resume_resolutions` intacts.')
W('')

// ── Écriture ─────────────────────────────────────────────────────────────────
if (GO) {
  let doc = null
  if (piece) {
    const path = `sujets/${sujet.id}/${randomUUID()}${extname(piece.chemin)}`
    const { error } = await supabase.storage.from(BUCKET)
      .upload(path, await readFile(piece.chemin), { contentType: TYPE_XLSX, upsert: false })
    if (error) { console.error(`❌ envoi de la pièce : ${error.message}`); process.exit(1) }
    doc = {
      id: randomUUID(), name: piece.nom, path,
      size: piece.taille, type: TYPE_XLSX, uploaded_at: new Date().toISOString(),
    }
  }

  if (!dejaFait || doc) {
    const patch = {}
    if (!dejaFait) patch.contenu = nouveauHTML
    // ⚠ Les 3 pièces existantes sont CONSERVÉES : on ajoute, on ne remplace pas.
    if (doc) patch.documents = [...(entree.documents || []), doc]
    const { error } = await supabase.from('sujet_entrees').update(patch).eq('id', entree.id)
    if (error) {
      // ⚠ L'objet téléversé ne doit pas rester orphelin : rien ne le signalerait.
      if (doc) await supabase.storage.from(BUCKET).remove([doc.path])
      console.error(`❌ mise à jour de l’entrée : ${error.message}`)
      process.exit(1)
    }
    if (!dejaFait) console.log('✅ texte remplacé.')
    if (doc) console.log(`✅ pièce jointe ajoutée · ${doc.name}`)
  } else {
    console.log('Rien à écrire — déjà en place.')
  }

  // L'ancienne version, conservée (voir l'en-tête pour le choix de l'emplacement).
  if (!dejaFait) {
    const historique = [...(sujet.historique || []), {
      le: new Date().toISOString(),
      motif: CORRECTION.motif,
      entree: { id: entree.id, date: entree.date_evenement, titre: entree.titre },
      contenu: entree.contenu,
    }]
    const { error } = await supabase.from('sujets').update({ historique }).eq('id', sujet.id)
    if (error) { console.error(`❌ historique : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ version précédente conservée (${historique.length} au total).`)
  }
} else {
  console.log('Essai à blanc — rien n’a été écrit. Relancer avec --go.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `consultation_2025_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
