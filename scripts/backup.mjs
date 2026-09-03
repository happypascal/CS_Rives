// Sauvegarde locale d'un projet Supabase (base + Storage) — stopgap tant que
// le plan gratuit n'a AUCUNE sauvegarde. À remplacer par les backups automatiques
// de Supabase Pro (cf. docs/ETAT_COURANT.md, backlog transfert ASL).
//
// ⚠ LA SAUVEGARDE CONTIENT DES DONNÉES PERSONNELLES depuis la migration 035
// (`lots`, `proprietaires` : noms, adresses privées, e-mails, téléphones de
// propriétaires). C'est exactement le « fichier exporté » contre lequel met en
// garde la mention RGPD du registre. Le dossier `backup/` doit rester sur une
// machine de confiance, chiffrée, et n'être transmis à personne.
//
// Ce que ça sauvegarde :
//   - toutes les tables `public` → un .json par table (les DONNÉES ; le schéma/RLS
//     est déjà versionné dans supabase/schema.sql, inutile de le re-dumper) ;
//   - le bucket privé `documents` → chaque fichier (devis/PJ), que pg_dump louperait
//     car il vit dans le Storage, pas dans Postgres.
//
// Ce que ça NE sauvegarde PAS : les comptes Auth (auth.users). Ils se recréent à la
// main (5 comptes) ; l'identité métier, elle, est dans `membres_cs` (sauvegardée).
//
// Usage (jamais committer la clé — service_role contourne la RLS) :
//   SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<clé service_role>" \
//   node scripts/backup.mjs
//
// La clé service_role est dans : Supabase → Settings → API → service_role (secret).
// Sortie : backup/<horodatage>/  (dossier git-ignoré).

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
// Import explicite plutôt que le global Node : oxlint (env navigateur) ne connaît
// pas `process`, et un import en fait une liaison propre — pas de no-undef.
import process from 'node:process'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Manque SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY dans l’environnement.')
  process.exit(1)
}

// Liste tenue à jour depuis supabase/schema.sql (create table). Si une table est
// ajoutée par une migration, l'ajouter ici — sinon elle ne serait pas sauvegardée.
// ⚠ CETTE LISTE N'EST QU'UN FILET DE SECOURS, pas la source de vérité.
//
// Elle était codée en dur et a DÉRIVÉ : figée à 11 tables, elle en ignorait six
// ajoutées depuis (decisions_historique, cron_runs, questions_reponses_projet,
// journal_projet, lots, proprietaires) — dont le registre des propriétaires.
// Une sauvegarde qui oublie une table sans le dire est pire que pas de
// sauvegarde : on croit être couvert.
//
// Les tables sont donc DÉCOUVERTES à chaque exécution (cf. listerTables) et
// cette liste ne sert que si la découverte échoue. Toute table manquante à la
// découverte est signalée bruyamment.
const TABLES_SECOURS = [
  'membres_cs',
  'assemblees_generales',
  'resolutions_ag',
  'projets',
  'decisions',
  'votes',
  'questions_reponses',
  'questions_reponses_projet',
  'journal_projet',
  'signature_batches',
  'decision_status_history',
  'decisions_historique',
  'cron_runs',
  'lots',
  'proprietaires',
  'comptes_ag',
  'audit_log',
  'sujets',
  'sujet_entrees',
]
const BUCKET = 'documents'
const PAGE = 1000

const supabase = createClient(url, key, { auth: { persistSession: false } })

// Découverte des tables : PostgREST publie à la racine de son API une
// description OpenAPI dont les `definitions` sont exactement les tables exposées.
// C'est la seule source qui ne peut pas dériver — elle vient de la base
// elle-même. Sans elle, il faudrait penser à mettre ce fichier à jour à chaque
// migration, et on ne le ferait pas (on ne l'a pas fait).
async function listerTables() {
  try {
    const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const spec = await r.json()
    const trouvees = Object.keys(spec.definitions || {}).sort()
    if (!trouvees.length) throw new Error('aucune table dans la description OpenAPI')
    // Une table connue mais absente de la découverte = anomalie à voir tout de
    // suite (droits, table renommée…), pas à laisser passer en silence.
    const manquantes = TABLES_SECOURS.filter((t) => !trouvees.includes(t))
    if (manquantes.length) {
      console.warn(`⚠ Tables attendues mais non découvertes : ${manquantes.join(', ')}`)
    }
    return trouvees
  } catch (e) {
    console.warn(`⚠ Découverte des tables impossible (${e.message}) — repli sur la liste codée en dur.`)
    console.warn('⚠ Une table ajoutée depuis la dernière mise à jour de ce fichier NE SERA PAS sauvegardée.')
    return TABLES_SECOURS
  }
}

// Horodatage sûr pour un nom de dossier : 2026-07-20T14-30-05
const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
const outDir = join('backup', stamp)

async function dumpTable(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`table ${table} : ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  await writeFile(join(outDir, `${table}.json`), JSON.stringify(rows, null, 2))
  return rows.length
}

// Le Storage liste par préfixe, sans récursion : on descend nous-mêmes.
// ⚠ La descente part de la RACINE et ne connaît aucun préfixe : `decisions/`,
// `projets/`, `ag/`, `resolutions/`, `sujets/` et tout préfixe futur sont pris
// sans qu'on ait à toucher ce fichier. Ne pas « optimiser » en énumérant les
// préfixes connus — c'est ainsi qu'on oublie les suivants.
async function listRecursive(prefix = '') {
  const files = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: PAGE, offset })
    if (error) throw new Error(`storage list ${prefix || '/'} : ${error.message}`)
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Un dossier n'a pas d'id ni de metadata ; un fichier oui.
      if (entry.id === null || entry.metadata === null) {
        files.push(...(await listRecursive(path)))
      } else {
        files.push(path)
      }
    }
    if (data.length < PAGE) break
  }
  return files
}

async function dumpStorage() {
  const paths = await listRecursive()
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(BUCKET).download(path)
    if (error) throw new Error(`download ${path} : ${error.message}`)
    const dest = join(outDir, BUCKET, path)
    await mkdir(join(dest, '..'), { recursive: true })
    // Uint8Array (accepté par writeFile) plutôt que Buffer : évite le global Node.
    await writeFile(dest, new Uint8Array(await data.arrayBuffer()))
  }
  return paths.length
}

async function main() {
  await mkdir(outDir, { recursive: true })
  console.log(`📦 Sauvegarde → ${outDir}`)

  const tables = await listerTables()
  console.log(`   ${tables.length} table(s) à sauvegarder`)

  let totalRows = 0
  for (const table of tables) {
    const n = await dumpTable(table)
    totalRows += n
    console.log(`  ✓ ${table} : ${n} ligne(s)`)
  }

  const nFiles = await dumpStorage()
  console.log(`  ✓ Storage « ${BUCKET} » : ${nFiles} fichier(s)`)

  await writeFile(
    join(outDir, 'manifest.json'),
    JSON.stringify({ date: new Date().toISOString(), url, tables, totalRows, files: nFiles }, null, 2),
  )
  console.log(`✅ Terminé : ${totalRows} ligne(s), ${nFiles} fichier(s). Restauration : schéma via supabase/schema.sql, puis réinsertion des .json.`)
  console.log('⚠ Cette sauvegarde contient des DONNÉES PERSONNELLES (registre des propriétaires).')
  console.log('  À conserver sur une machine de confiance, chiffrée, et à ne transmettre à personne.')
}

main().catch((e) => {
  console.error('❌ Échec :', e.message)
  process.exit(1)
})
