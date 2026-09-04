// Restauration d'une sauvegarde produite par `scripts/backup.mjs`.
//
// Une sauvegarde qu'on ne sait pas restaurer n'est pas une sauvegarde : c'est une
// collection de fichiers rassurants. Ce script existe pour que la question soit
// tranchée avant le jour où elle se pose.
//
// ⚠ IL ÉCRIT DANS UNE BASE. Trois gardes, dans cet ordre :
//   1. essai à blanc par défaut — il faut `--confirmer` pour écrire ;
//   2. refus si la cible contient déjà des données (sauf `--ecraser`) ;
//   3. l'URL cible est affichée en toutes lettres avant toute écriture.
// À utiliser sur un projet Supabase VIERGE, jamais sur la production.
//
// L'ORDRE D'INSERTION N'EST PAS CODÉ EN DUR, et c'est le cœur du script. Une
// liste ordonnée à la main dériverait à la première migration — c'est exactement
// ce qui est arrivé à la liste de secours de `backup.mjs`. On insère donc par
// PASSES : ce qui échoue sur une clé étrangère est remis à la passe suivante, et
// l'on recommence tant qu'on progresse. L'ordre se déduit du réel au lieu d'être
// deviné, et une table ajoutée demain n'exige rien.
//
// Usage :
//   SUPABASE_URL="https://<ref-cible>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<clé service_role de la CIBLE>" \
//   node scripts/restore.mjs backup/<horodatage>            # essai à blanc
//   node scripts/restore.mjs backup/<horodatage> --confirmer # écrit
//
// PRÉALABLE : le schéma doit exister sur la cible. Passer `supabase/schema.sql`
// dans le SQL Editor du projet vierge AVANT de lancer ce script.
//
// ÉPROUVÉ EN VRAI le 2026-09-04 : 19 tables, 198 lignes, 14 fichiers restaurés
// sur un projet vierge, puis comparés à la sauvegarde champ par champ et fichier
// par fichier (empreinte SHA-256). Identiques. Le test a trouvé DEUX défauts que
// rien d'autre n'aurait montrés : une policy de Storage absente de `schema.sql`
// (donc une install neuve où aucune pièce jointe ne pouvait être téléversée) et
// un trigger qui traitait la RÉINSERTION comme une SOUMISSION, datant une
// délibération du jour de la restauration (migration 047). C'est la raison
// d'être de ce script, et elle est démontrée.
//
// ⚠ CE QUI N'EST PAS RESTAURÉ : les comptes de connexion (`auth.users`). Ils se
// recréent à la main dans Authentication, avec les MÊMES adresses e-mail que
// `membres_cs` — c'est l'e-mail qui lie les deux, au caractère près. Sans cela,
// les membres se connectent sans être reconnus.

import { createClient } from '@supabase/supabase-js'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import process from 'node:process'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

const args = process.argv.slice(2)
const dossier = args.find((a) => !a.startsWith('--'))
const ecraser = args.includes('--ecraser')

// ⚠ Ce module est aussi IMPORTÉ pour éprouver `insererParPasses` sans base. Le
// corps ne doit donc s'exécuter que si le fichier est lancé directement —
// autrement, un simple import déclencherait une restauration.
const estLance = import.meta.url === pathToFileURL(process.argv[1] || '').href

if (estLance && !dossier) {
  console.error('❌ Indiquez le dossier de sauvegarde : node scripts/restore.mjs backup/<horodatage>')
  process.exit(1)
}

// ⚠ Les identifiants ne sont exigés que pour ÉCRIRE. Sans eux, l'essai à blanc
// décrit quand même le contenu de la sauvegarde : on doit pouvoir répondre à
// « qu'y a-t-il dans cette archive ? » sans sortir la clé de production, qui
// contourne toute la RLS.
const confirmer = args.includes('--confirmer')
if (confirmer && (!url || !key)) {
  console.error('❌ Manque SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY dans l’environnement.')
  process.exit(1)
}

const BUCKET = 'documents'
const supabase = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null

// ---------------------------------------------------------------- lecture
async function lireSauvegarde() {
  let entrees
  try {
    entrees = await readdir(dossier)
  } catch {
    // Un dossier inexistant est l'erreur la plus probable de ce script : une
    // pile d'appels Node n'aide personne à s'en rendre compte.
    console.error(`❌ Dossier introuvable : ${dossier}`)
    console.error('   Indiquez un dossier produit par scripts/backup.mjs, par exemple backup/2026-09-04T04-24-28')
    process.exit(1)
  }
  const tables = {}
  for (const nom of entrees.filter((n) => n.endsWith('.json'))) {
    const rows = JSON.parse(await readFile(join(dossier, nom), 'utf8'))
    if (Array.isArray(rows)) tables[nom.replace(/\.json$/, '')] = rows
  }
  return tables
}

// Parcours récursif du dossier des fichiers, symétrique de celui de backup.mjs.
async function listerFichiers(base, prefix = '') {
  const chemin = prefix ? join(base, prefix) : base
  let entrees
  try {
    entrees = await readdir(chemin)
  } catch {
    return [] // pas de fichiers dans cette sauvegarde
  }
  const fichiers = []
  for (const nom of entrees) {
    const rel = prefix ? `${prefix}/${nom}` : nom
    const info = await stat(join(base, rel))
    if (info.isDirectory()) fichiers.push(...(await listerFichiers(base, rel)))
    else fichiers.push(rel)
  }
  return fichiers
}

// ------------------------------------------------------------- vérification
// Une cible non vide n'est pas forcément une erreur, mais restaurer par-dessus
// des données existantes produit un mélange que personne ne saura démêler.
async function cibleNonVide(tables) {
  if (!supabase) return null // pas d'identifiants : on ne peut rien affirmer
  const occupees = []
  for (const table of Object.keys(tables)) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) continue // table absente : le schéma n'est pas encore passé, on le dira plus bas
    if (count > 0) occupees.push(`${table} (${count})`)
  }
  return occupees
}

// ------------------------------------------------------------- restauration
// Insertion par PASSES. Une table qui échoue est remise à la passe suivante :
// si l'échec venait d'une clé étrangère, la table dont elle dépend aura été
// insérée entre-temps. On s'arrête quand une passe entière n'a rien fait
// progresser — ce qui reste est alors un vrai problème, pas un problème d'ordre.
export async function insererParPasses(tables, inserer, journal = null) {
  let restantes = Object.entries(tables).filter(([, rows]) => rows.length > 0)
  const faites = []
  const vides = Object.entries(tables).filter(([, rows]) => rows.length === 0).map(([t]) => t)
  let derniersEchecs = new Map()

  while (restantes.length) {
    const echouees = []
    const echecs = new Map()
    for (const [table, rows] of restantes) {
      const { error } = await inserer(table, rows)
      if (error) {
        echouees.push([table, rows])
        echecs.set(table, error.message)
      } else {
        faites.push(`${table} : ${rows.length}`)
        journal?.(`  ✓ ${table} : ${rows.length} ligne(s)`)
      }
    }
    // Aucune progression : inutile de boucler, l'ordre n'est pas en cause.
    if (echouees.length === restantes.length) {
      derniersEchecs = echecs
      break
    }
    derniersEchecs = echecs
    restantes = echouees
  }
  return { faites, vides, bloquees: restantes.map(([t]) => t), echecs: derniersEchecs }
}

async function televerserFichiers() {
  const base = join(dossier, BUCKET)
  const fichiers = await listerFichiers(base)
  let ok = 0
  const echecs = []
  for (const rel of fichiers) {
    const contenu = await readFile(join(base, rel))
    const { error } = await supabase.storage.from(BUCKET).upload(rel, contenu, { upsert: true })
    if (error) echecs.push(`${rel} : ${error.message}`)
    else ok++
  }
  return { total: fichiers.length, ok, echecs }
}

// ----------------------------------------------------------------------- main
if (estLance) {
  const tables = await lireSauvegarde()
  const nbLignes = Object.values(tables).reduce((s, r) => s + r.length, 0)
  const fichiers = await listerFichiers(join(dossier, BUCKET))

  console.log(`📂 Sauvegarde : ${dossier}`)
  console.log(`   ${Object.keys(tables).length} table(s), ${nbLignes} ligne(s), ${fichiers.length} fichier(s)`)
  console.log(`🎯 Cible : ${url || '— aucune (inspection seule)'}`)
  console.log()

  if (!confirmer) {
    console.log('MODE ESSAI — rien ne sera écrit. Ajouter --confirmer pour restaurer.')
    console.log()
    const occupees = await cibleNonVide(tables)
    if (occupees === null) {
      console.log('ℹ Pas d’identifiants : la cible n’a pas été interrogée.')
    } else if (occupees.length) {
      console.log('⚠ La cible contient déjà des données :')
      occupees.forEach((o) => console.log(`   ${o}`))
      console.log('   La restauration serait refusée (utiliser --ecraser en connaissance de cause).')
    } else {
      console.log('✓ Cible vide ou schéma en place : la restauration peut être tentée.')
    }
    console.log()
    console.log('Tables qui seraient restaurées :')
    Object.entries(tables)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([t, r]) => console.log(`   ${t} : ${r.length} ligne(s)`))
    process.exit(0)
  }

  const occupees = await cibleNonVide(tables)
  if (occupees.length && !ecraser) {
    console.error('❌ La cible contient déjà des données :')
    occupees.forEach((o) => console.error(`   ${o}`))
    console.error('   Restaurer par-dessus produirait un mélange indémêlable.')
    console.error('   Utilisez un projet vierge, ou --ecraser si vous savez ce que vous faites.')
    process.exit(1)
  }

  console.log('🔁 Restauration en cours…')
  const { faites, vides, bloquees, echecs } = await insererParPasses(
    tables,
    (table, rows) => supabase.from(table).insert(rows),
    (ligne) => console.log(ligne),
  )
  const storage = await televerserFichiers()

  console.log()
  console.log(`✅ ${faites.length} table(s) restaurée(s), ${storage.ok}/${storage.total} fichier(s).`)
  if (vides.length) console.log(`   Vides dans la sauvegarde : ${vides.join(', ')}`)
  if (bloquees.length) {
    console.error()
    console.error('❌ Tables NON restaurées, avec la dernière erreur rencontrée :')
    bloquees.forEach((t) => console.error(`   ${t} : ${echecs.get(t)}`))
    console.error('   Une passe entière n’a rien fait progresser : ce n’est pas un problème d’ordre.')
  }
  if (storage.echecs.length) {
    console.error(`❌ ${storage.echecs.length} fichier(s) non téléversé(s) :`)
    storage.echecs.slice(0, 10).forEach((e) => console.error(`   ${e}`))
  }
  console.log()
  console.log('⚠ RESTE À FAIRE À LA MAIN : recréer les comptes de connexion dans Authentication,')
  console.log('  avec exactement les mêmes adresses e-mail que dans membres_cs. C’est l’e-mail qui')
  console.log('  lie le compte à la fiche : une différence de casse et le membre n’est pas reconnu.')
  process.exit(bloquees.length || storage.echecs.length ? 1 : 0)

}
