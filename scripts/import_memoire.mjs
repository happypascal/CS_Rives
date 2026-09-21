// Saisie initiale de la MÉMOIRE DE L'ASL — sujets, chronologies et pièces.
//
// Demande de Pascal via `BRIEF_saisie_memoire_ASL.md` (20 septembre 2026). Le
// contenu vit dans `scripts/data/memoire_asl_2026-09-20.mjs` ; ce fichier-ci n'a
// que la mécanique, pour qu'on puisse relire ce qui entre au registre sans lire
// une ligne de code.
//
// ⚠ IL ÉCRIT DANS UN REGISTRE LÉGAL, EN PRODUCTION, avec la clé `service_role`
// qui contourne toute la RLS. D'où quatre garde-fous, et aucun n'est décoratif :
//
//   1. ESSAI À BLANC PAR DÉFAUT. Sans `--go`, rien n'est écrit : le script dit ce
//      qu'il ferait. Une écriture en masse ne se lance pas par inadvertance.
//   2. SAUVEGARDE DU JOUR EXIGÉE. En `--go`, le script refuse de partir si
//      `backup/` ne contient pas de sauvegarde datée d'aujourd'hui. Le plan
//      Supabase gratuit n'en a AUCUNE : sans ce filet, une erreur ici serait
//      définitive.
//   3. IDEMPOTENCE. Les sujets sont protégés par l'unicité de `titre` ; les
//      entrées sont cherchées sur (sujet_id, date_evenement, titre) avant
//      insertion ; une pièce déjà attachée sous le même nom est ignorée. Le
//      script se rejoue sans créer un doublon, et le DIT dans son rapport.
//   4. RAPPORT ÉCRIT. Console et fichier — la console défile, le fichier reste.
//
// ⚠ CE QU'IL N'INVENTE PAS : aucune date. Les entrées sans date certaine portent
// la sentinelle 1999-09-09 (arbitrage Pascal : « si il n'y a pas de date tu mets
// 9/9/1999 et je corrigerai ») et sont TOUTES recensées en fin de rapport. Une
// date absurde et listée vaut mieux qu'une date plausible et fausse.
//
// Usage : identifiants dans `.env.export` à la racine, comme `export_md.mjs`.
//   node scripts/import_memoire.mjs          → essai à blanc
//   node scripts/import_memoire.mjs --go     → écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import { SUJETS, PIECES_SUJETS_EXISTANTS, CORRECTIONS, DATE_SENTINELLE, RACINE_PIECES, ALIAS_TITRES } from './data/memoire_asl_2026-09-20.mjs'

// Chemins ancrés au projet, jamais au répertoire courant — même raison que dans
// export_md.mjs, et même bug déjà rencontré.
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOSSIER_LOTISSEMENT = resolve(RACINE, RACINE_PIECES, '..')

const GO = process.argv.includes('--go')
const BUCKET = 'documents'
const EMAIL_AUTEUR = 'pfavre25@gmail.com'

// ---------------------------------------------------------------- identifiants
// Repris tel quel d'export_md.mjs, y compris la tolérance aux caractères Unicode
// invisibles — c'est un collage depuis une conversation qui avait cassé la
// première version.
async function lireEnvFichier() {
  try {
    const texte = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of texte.split('\n')) {
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

const fichierEnv = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || fichierEnv.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || fichierEnv.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ------------------------------------------------------- garde-fou sauvegarde
// ⚠ NE PAS ASSOUPLIR. Le plan Supabase gratuit n'a aucune sauvegarde ; celle de
// `backup.mjs` est la seule. Écrire trente entrées dans un registre légal sans
// filet du jour, c'est jouer une opération irréversible sur une base qu'on ne
// sait pas restaurer à l'état d'avant.
async function sauvegardeDuJour() {
  try {
    const dossiers = await readdir(join(RACINE, 'backup'))
    const aujourdhui = new Date().toISOString().slice(0, 10)
    return dossiers.filter((d) => d.startsWith(aujourdhui)).sort().pop() || null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- utilitaires
const MIME = {
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.txt': 'text/plain',
}

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }
const compteurs = { sujetsCrees: 0, sujetsExistants: 0, sujetsCompletes: 0, entreesCreees: 0, entreesIgnorees: 0, piecesEnvoyees: 0, piecesIgnorees: 0, piecesIntrouvables: 0, corrections: 0 }
const aDater = []
const introuvables = []

async function main() {
  W(`# Import de la mémoire de l’ASL — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) {
    W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
    W('')
  } else {
    const sauvegarde = await sauvegardeDuJour()
    if (!sauvegarde) {
      console.error('')
      console.error('❌ AUCUNE SAUVEGARDE DATÉE D’AUJOURD’HUI dans backup/.')
      console.error('   Ce script écrit dans un registre légal, sur une base qui n’a aucune')
      console.error('   sauvegarde automatique. Lancez d’abord :')
      console.error('')
      console.error('     node scripts/backup.mjs')
      console.error('')
      process.exit(1)
    }
    W(`> Sauvegarde du jour trouvée : \`backup/${sauvegarde}\`.`)
    W('')
  }

  // Auteur, résolu par e-mail — jamais un uuid en dur.
  const { data: membre } = await supabase.from('membres_cs').select('id,prenom,nom').eq('email', EMAIL_AUTEUR).maybeSingle()
  if (!membre) throw new Error(`Aucun membre avec l’e-mail ${EMAIL_AUTEUR} : impossible d’attribuer les entrées.`)
  W(`Auteur des entrées : **${membre.prenom} ${membre.nom}**.`)
  W('')

  const existants = await supabase.from('sujets').select('id,titre,categorie,resume,contenu,documents')
  const parTitre = Object.fromEntries((existants.data || []).map((s) => [s.titre, s]))

  // ------------------------------------------------------------- les sujets
  for (const sujet of SUJETS) {
    // ⚠ Un sujet peut exister sous un titre VOISIN, créé à la main avant cet
    // import. On le retrouve par alias plutôt que d'en créer un quasi-homonyme.
    const titreCible = ALIAS_TITRES[sujet.titre] || sujet.titre
    W(`## ${titreCible}${titreCible !== sujet.titre ? ` _(le brief l’appelait « ${sujet.titre} »)_` : ''}`)
    let ligne = parTitre[titreCible] || parTitre[sujet.titre]
    if (ligne) {
      compteurs.sujetsExistants++
      W(`- Sujet **déjà présent**, non recréé.`)
      // ⚠ ON NE COMPLÈTE QUE CE QUI EST VIDE, jamais on n'écrase. Un résumé ou une
      // synthèse déjà rédigés sont le travail de quelqu'un ; les remplacer par un
      // texte d'import serait une perte silencieuse.
      const aCompleter = {}
      if (!ligne.resume && sujet.resume) aCompleter.resume = sujet.resume
      if (!ligne.contenu && sujet.contenu) aCompleter.contenu = sujet.contenu
      if (!ligne.categorie && sujet.categorie) aCompleter.categorie = sujet.categorie
      if (Object.keys(aCompleter).length) {
        if (GO) {
          const { error } = await supabase.from('sujets').update(aCompleter).eq('id', ligne.id)
          if (error) throw new Error(`complément de « ${titreCible} » : ${error.message}`)
        }
        compteurs.sujetsCompletes++
        W(`- Champs vides **${GO ? 'complétés' : 'à compléter'}** : ${Object.keys(aCompleter).join(', ')}.`)
      }
    } else if (GO) {
      const { data, error } = await supabase.from('sujets').insert({
        titre: sujet.titre,
        categorie: sujet.categorie,
        resume: sujet.resume,
        contenu: sujet.contenu,
        documents: [],
        created_by: membre.id,
      }).select().single()
      if (error) throw new Error(`sujet « ${sujet.titre} » : ${error.message}`)
      ligne = data
      parTitre[titreCible] = data
      compteurs.sujetsCrees++
      W(`- Sujet **créé** (${sujet.categorie})${sujet.contenu ? '' : ' — contenu volontairement vide, à rédiger'}.`)
    } else {
      compteurs.sujetsCrees++
      W(`- Sujet **à créer** (${sujet.categorie})${sujet.contenu ? '' : ' — contenu vide, à rédiger'}.`)
    }

    // ------------------------------------------------------- les entrées
    for (const e of sujet.entrees) {
      if (e.date === DATE_SENTINELLE) aDater.push(`${sujet.titre} — ${e.titre}`)
      if (!ligne) { compteurs.entreesCreees++; continue } // essai à blanc sur un sujet non créé
      const { data: deja } = await supabase.from('sujet_entrees')
        .select('id').eq('sujet_id', ligne.id).eq('date_evenement', e.date).eq('titre', e.titre).maybeSingle()
      if (deja) {
        compteurs.entreesIgnorees++
        continue
      }
      if (GO) {
        const { error } = await supabase.from('sujet_entrees').insert({
          sujet_id: ligne.id,
          date_evenement: e.date,
          titre: e.titre,
          contenu: e.contenu || null,
          documents: [],
          auteur_id: membre.id,
        })
        if (error) throw new Error(`entrée « ${e.titre} » : ${error.message}`)
      }
      compteurs.entreesCreees++
    }
    W(`- Entrées : ${sujet.entrees.length} au total.`)

    // ------------------------------------------------------- les pièces
    const chemins = [...(sujet.pieces || [])]
    for (const d of sujet.dossiers || []) chemins.push(...(await listerDossier(d)))
    if (chemins.length) await televerser(ligne, chemins)
    W('')
  }

  // ------------------------------------- pièces sur les sujets existants
  for (const [titre, chemins] of Object.entries(PIECES_SUJETS_EXISTANTS)) {
    W(`## ${titre} _(sujet existant)_`)
    const ligne = parTitre[titre]
    if (!ligne) {
      W(`- ⚠ Sujet introuvable en base : pièces non rattachées.`)
      W('')
      continue
    }
    await televerser(ligne, chemins)
    W('')
  }

  // ------------------------------------------------------------ corrections
  W('## Corrections de coquilles')
  for (const c of CORRECTIONS) {
    const { data: lignes } = await supabase.from(c.table).select(`id,${c.champ}`)
    const cibles = (lignes || []).filter((l) => typeof l[c.champ] === 'string' && l[c.champ].includes(c.cherche))
    if (!cibles.length) {
      W(`- « ${c.cherche} » : introuvable (déjà corrigé ?) — ${c.note}`)
      continue
    }
    for (const cible of cibles) {
      if (GO) {
        const { error } = await supabase.from(c.table)
          .update({ [c.champ]: cible[c.champ].replaceAll(c.cherche, c.remplace) })
          .eq('id', cible.id)
        if (error) throw new Error(`correction ${c.cherche} : ${error.message}`)
      }
      compteurs.corrections++
    }
    W(`- « ${c.cherche} » → « ${c.remplace} » : ${cibles.length} ligne(s) — ${c.note}`)
  }
  W('')

  // ---------------------------------------------------------------- bilan
  W('## Bilan')
  W('')
  W(`| | |`)
  W(`|---|---|`)
  W(`| Sujets ${GO ? 'créés' : 'à créer'} | ${compteurs.sujetsCrees} |`)
  W(`| Sujets déjà présents | ${compteurs.sujetsExistants} |`)
  W(`| Sujets existants ${GO ? 'complétés' : 'à compléter'} | ${compteurs.sujetsCompletes} |`)
  W(`| Entrées ${GO ? 'insérées' : 'à insérer'} | ${compteurs.entreesCreees} |`)
  W(`| Entrées ignorées (déjà là) | ${compteurs.entreesIgnorees} |`)
  W(`| Pièces ${GO ? 'téléversées' : 'à téléverser'} | ${compteurs.piecesEnvoyees} |`)
  W(`| Pièces ignorées (déjà attachées) | ${compteurs.piecesIgnorees} |`)
  W(`| Fichiers introuvables | ${compteurs.piecesIntrouvables} |`)
  W(`| Coquilles corrigées | ${compteurs.corrections} |`)
  W('')

  if (introuvables.length) {
    W('### Fichiers introuvables')
    W('')
    W('Signalés sans faire échouer le reste — à vérifier sur le disque.')
    W('')
    for (const f of introuvables) W(`- \`${f}\``)
    W('')
  }

  // ⚠ LA LISTE QUI COMPTE. Ces entrées portent une date fausse et assumée.
  if (aDater.length) {
    W(`### ⚠ À DATER — ${aDater.length} entrée(s) portant la date sentinelle ${DATE_SENTINELLE}`)
    W('')
    W('Ces entrées sont au registre avec une date **volontairement absurde**, pour qu’elle')
    W('saute aux yeux. Elles se corrigent depuis l’écran « Mémoire de l’ASL », entrée par')
    W('entrée. Tant qu’elles portent cette date, la chronologie du sujet est fausse à cet endroit.')
    W('')
    for (const a of aDater) W(`- ${a}`)
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `import_memoire_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log('')
  console.log(`📄 Rapport : ${chemin}`)
  if (!GO) console.log('   Rien n’a été écrit. Relancer avec --go pour appliquer.')
}

// Toutes les pièces d'un dossier, non récursif : les dossiers listés au brief
// sont plats, et descendre ramasserait des versions de travail.
async function listerDossier(rel) {
  try {
    const abs = join(DOSSIER_LOTISSEMENT, rel)
    const noms = await readdir(abs)
    return noms.filter((n) => !n.startsWith('.') && MIME[extname(n).toLowerCase()]).map((n) => join(rel, n))
  } catch {
    introuvables.push(`${rel}/ (dossier)`)
    compteurs.piecesIntrouvables++
    return []
  }
}

// ⚠ FORME DE `documents` RECOPIÉE DE `supabaseDb.uploadDocument` : {id, path,
// name, type, size, uploaded_at}. Une pièce dont la forme diffère s'affiche mal
// ou pas du tout dans `PiecesJointes.jsx`. Le chemin porte l'id du SUJET
// (`sujets/<id>/<uuid>.<ext>`, migration 046) — pas celui de l'entrée.
async function televerser(sujet, chemins) {
  if (!sujet) {
    W(`- Pièces : ${chemins.length} (sujet non encore créé, essai à blanc).`)
    compteurs.piecesEnvoyees += chemins.length
    return
  }
  // ⚠ Normalisation Unicode : macOS écrit les noms de fichiers en forme
  // décomposée (NFD), un nom recopié à la main est composé (NFC). Sans cela, une
  // pièce accentuée se retéléverserait à chaque exécution sans qu'on le voie.
  const deja = new Set((sujet.documents || []).map((d) => String(d.name).normalize('NFC')))
  const ajouts = []
  for (const rel of chemins) {
    const abs = join(DOSSIER_LOTISSEMENT, rel)
    const nom = basename(rel)
    if (deja.has(nom.normalize('NFC'))) { compteurs.piecesIgnorees++; continue }
    let contenu, taille
    try {
      contenu = await readFile(abs)
      taille = (await stat(abs)).size
    } catch {
      introuvables.push(rel)
      compteurs.piecesIntrouvables++
      continue
    }
    const ext = extname(nom).toLowerCase()
    const chemin = `sujets/${sujet.id}/${randomUUID()}${ext || '.bin'}`
    if (GO) {
      const { error } = await supabase.storage.from(BUCKET)
        .upload(chemin, contenu, { contentType: MIME[ext] || 'application/octet-stream', upsert: false })
      if (error) {
        introuvables.push(`${rel} (envoi refusé : ${error.message})`)
        compteurs.piecesIntrouvables++
        continue
      }
    }
    ajouts.push({ id: randomUUID(), path: chemin, name: nom, type: MIME[ext] || 'application/octet-stream', size: taille, uploaded_at: new Date().toISOString() })
    compteurs.piecesEnvoyees++
  }
  if (ajouts.length && GO) {
    const { error } = await supabase.from('sujets')
      .update({ documents: [...(sujet.documents || []), ...ajouts] })
      .eq('id', sujet.id)
    if (error) throw new Error(`pièces de « ${sujet.titre} » : ${error.message}`)
  }
  W(`- Pièces : ${ajouts.length} ${GO ? 'téléversée(s)' : 'à téléverser'}, ${compteurs.piecesIgnorees ? '' : ''}${chemins.length - ajouts.length} ignorée(s) ou introuvable(s).`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
