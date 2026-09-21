// Applique un brief de mémoire : synthèses, corrections d'entrées, nouvelles
// entrées et pièces jointes.
//
// ⚠ POURQUOI UN TROISIÈME SCRIPT PLUTÔT QU'UN DE PLUS À CHAQUE BRIEF. Le brief
// n° 2 demandait de réutiliser les deux premiers « si leur mécanique le permet ».
// Elle ne le permettait pas : `import_memoire.mjs` ne sait que CRÉER, et
// `corriger_memoire.mjs` ne sait que déplacer des pièces et changer des dates.
// Celui-ci est GÉNÉRIQUE — il exécute une liste d'opérations décrite dans un
// fichier de données — et les briefs suivants n'auront donc plus besoin de code,
// seulement d'un fichier de contenu.
//
// Mêmes garde-fous, pour la même raison (registre légal, production, clé qui
// contourne la RLS) : essai à blanc par défaut, sauvegarde du jour exigée avant
// `--go`, idempotence, rapport écrit.
//
// ⚠ IL N'ÉCRASE JAMAIS EN AVEUGLE. `ajoutContenu` ajoute en fin de texte au lieu
// de remplacer ; une entrée déjà corrigée est constatée, pas réécrite ; et les
// `CONFLITS` du fichier de données sont RAPPORTÉS SANS ÊTRE EXÉCUTÉS.
//
// Usage :
//   node scripts/appliquer_brief.mjs <fichier-de-données>         → essai à blanc
//   node scripts/appliquer_brief.mjs <fichier-de-données> --go    → écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname, basename, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const BUCKET = 'documents'
const EMAIL_AUTEUR = 'pfavre25@gmail.com'

const cible = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!cible) {
  console.error('❌ Indiquez le fichier de données, ex :')
  console.error('   node scripts/appliquer_brief.mjs scripts/data/urbanisme_et_corrections_2026-09-21.mjs')
  process.exit(1)
}
const D = await import(resolve(RACINE, cible))

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
  } catch { return {} }
}
const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) { console.error('❌ Clé Supabase introuvable — voir .env.export.'); process.exit(1) }
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ⚠ macOS écrit les noms de fichiers en forme décomposée (NFD) ; un nom recopié à
// la main est composé (NFC). Les deux s'affichent pareil et ne sont pas égaux.
const memeNom = (a, b) => String(a).normalize('NFC') === String(b).normalize('NFC')

const MIME = { '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.txt': 'text/plain' }

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }
const n = { syntheses: 0, entreesMaj: 0, entreesDejaOk: 0, entreesCreees: 0, entreesDejaLa: 0, pieces: 0, piecesDejaLa: 0, introuvables: 0 }
const soucis = []

async function sauvegardeDuJour() {
  try {
    const d = await readdir(join(RACINE, 'backup'))
    const t = new Date().toISOString().slice(0, 10)
    return d.filter((x) => x.startsWith(t)).sort().pop() || null
  } catch { return null }
}

// Téléverse une pièce et renvoie l'objet `documents` attendu par l'application.
// Forme recopiée de `supabaseDb.uploadDocument` — une pièce de forme différente
// s'affiche mal ou pas du tout.
async function pieceVersDoc(sujetId, rel, dossierLot) {
  const abs = join(dossierLot, rel)
  const nom = basename(rel)
  let contenu, taille
  try {
    contenu = await readFile(abs)
    taille = (await stat(abs)).size
  } catch { soucis.push(`Fichier introuvable : ${rel}`); n.introuvables++; return null }
  const ext = extname(nom).toLowerCase()
  const chemin = `sujets/${sujetId}/${randomUUID()}${ext || '.bin'}`
  if (GO) {
    const { error } = await supabase.storage.from(BUCKET)
      .upload(chemin, contenu, { contentType: MIME[ext] || 'application/octet-stream', upsert: false })
    if (error) { soucis.push(`Envoi refusé (${rel}) : ${error.message}`); n.introuvables++; return null }
  }
  return { id: randomUUID(), path: chemin, name: nom, type: MIME[ext] || 'application/octet-stream', size: taille, uploaded_at: new Date().toISOString() }
}

// ⚠ UNE PIÈCE NE PEUT ÊTRE REVENDIQUÉE QUE PAR UNE SEULE ENTRÉE.
//
// Le script DÉPLACE une pièce trouvée sur une autre entrée du même sujet. Si deux
// entrées la réclament, chaque exécution la reprend à l'autre : un aller-retour
// sans fin, qui ne se voit qu'en comparant deux rapports successifs. Arrivé pour
// de vrai le 2026-09-21 avec `code civil art 671.png`, entre l'entrée du PLU de
// 2013 et celle du PLUi-HM.
//
// On refuse de partir plutôt que d'écrire un état qui oscille.
function verifierPiecesUniques(entreesNouvelles = []) {
  const par = new Map()
  for (const e of entreesNouvelles) {
    for (const f of e.pieces || []) {
      const cle = `${e.sujet}::${basename(f).normalize('NFC')}`
      if (!par.has(cle)) par.set(cle, [])
      par.get(cle).push(e.titre)
    }
  }
  const doubles = [...par.entries()].filter(([, v]) => v.length > 1)
  if (!doubles.length) return
  console.error('')
  console.error('❌ DONNÉES INCOHÉRENTES : une même pièce est revendiquée par plusieurs entrées.')
  console.error('   Chaque exécution la reprendrait à l’autre, sans fin.')
  for (const [cle, titres] of doubles) console.error(`   ${cle.split('::')[1]} → ${titres.join(' / ')}`)
  console.error('')
  process.exit(1)
}

async function main() {
  verifierPiecesUniques(D.ENTREES_NOUVELLES)
  W(`# ${basename(cible)} — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.\n')
  else {
    const s = await sauvegardeDuJour()
    if (!s) { console.error('\n❌ AUCUNE SAUVEGARDE DU JOUR. Lancez d’abord : node scripts/backup.mjs\n'); process.exit(1) }
    W(`> Sauvegarde du jour : \`backup/${s}\`.\n`)
  }

  const dossierLot = resolve(RACINE, D.RACINE_PIECES || '..', '..')
  const { data: membre } = await supabase.from('membres_cs').select('id').eq('email', EMAIL_AUTEUR).maybeSingle()
  if (!membre) throw new Error(`Aucun membre avec l’e-mail ${EMAIL_AUTEUR}.`)

  const { data: sujets } = await supabase.from('sujets').select('id,titre,resume,contenu,documents')
  const { data: entrees } = await supabase.from('sujet_entrees').select('id,sujet_id,date_evenement,titre,contenu,documents')
  const parTitre = Object.fromEntries(sujets.map((s) => [s.titre, s]))

  // ------------------------------------------------------------ 1. synthèses
  if (D.SUJETS_MAJ?.length) {
    W('## Synthèses de sujets')
    W('')
    for (const m of D.SUJETS_MAJ) {
      const s = parTitre[m.titre]
      if (!s) { soucis.push(`Sujet introuvable : ${m.titre}`); n.introuvables++; continue }
      const patch = {}
      if (m.resume !== undefined && m.resume !== s.resume) patch.resume = m.resume
      if (m.contenu !== undefined && m.contenu !== s.contenu) patch.contenu = m.contenu
      if (!Object.keys(patch).length) { W(`- « ${m.titre} » : déjà à jour.`); continue }
      if (GO) {
        const { error } = await supabase.from('sujets').update(patch).eq('id', s.id)
        if (error) throw new Error(`synthèse de « ${m.titre} » : ${error.message}`)
      }
      n.syntheses++
      W(`- « ${m.titre} » : ${Object.keys(patch).join(' + ')} ${GO ? 'remplacé(s)' : 'à remplacer'}.`)
    }
    W('')
  }

  // ------------------------------------------------- 2. entrées corrigées
  // Plusieurs lots de corrections peuvent cohabiter dans un même fichier de
  // données (ENTREES_MAJ, ENTREES_MAJ_2…) : un brief révisé ajoute ses
  // corrections sans qu'on ait à retoucher celles déjà appliquées.
  const lotsMaj = Object.keys(D).filter((k) => k.startsWith('ENTREES_MAJ')).sort().flatMap((k) => D[k] || [])
  if (lotsMaj.length) {
    W('## Entrées corrigées')
    W('')
    for (const m of lotsMaj) {
      const s = parTitre[m.sujet]
      let e = entrees.find((x) => x.sujet_id === s?.id && x.titre === m.titreActuel)
      // ⚠ UNE ENTRÉE RENOMMÉE N'EST PAS UNE ENTRÉE PERDUE. À la relance, son
      // ancien titre n'existe plus : la chercher sous le NOUVEAU évite de
      // signaler « introuvable » une correction déjà faite — un faux négatif qui
      // ferait douter d'un registre correct, comme les fausses alertes de l'export.
      if (!e && m.titre) e = entrees.find((x) => x.sujet_id === s?.id && x.titre === m.titre)
      if (!e) { soucis.push(`Entrée introuvable : « ${m.titreActuel} » dans « ${m.sujet} »`); n.introuvables++; W(`- « ${m.titreActuel} » : **introuvable**.`); continue }
      const patch = {}
      if (m.date && m.date !== e.date_evenement) patch.date_evenement = m.date
      if (m.titre && m.titre !== e.titre) patch.titre = m.titre
      if (m.contenu && m.contenu !== e.contenu) patch.contenu = m.contenu
      // ⚠ AJOUTE au lieu de remplacer — et seulement si ce n'est pas déjà là,
      // sinon une relance empilerait le même paragraphe.
      if (m.ajoutContenu && !(e.contenu || '').includes(m.ajoutContenu)) {
        patch.contenu = `${(patch.contenu ?? e.contenu ?? '').trim()} ${m.ajoutContenu}`.trim()
      }
      if (!Object.keys(patch).length) { n.entreesDejaOk++; W(`- « ${m.titreActuel} » : déjà à jour.`); continue }
      if (GO) {
        const { error } = await supabase.from('sujet_entrees').update(patch).eq('id', e.id)
        if (error) throw new Error(`entrée « ${m.titreActuel} » : ${error.message}`)
      }
      n.entreesMaj++
      W(`- « ${m.titreActuel} » (${e.date_evenement}) → ${Object.keys(patch).map((k) => k.replace('date_evenement', 'date')).join(', ')}`)
      if (patch.titre) W(`  - nouveau titre : « ${patch.titre} »`)
    }
    W('')
  }

  // -------------------------------------------------- 3. entrées nouvelles
  if (D.ENTREES_NOUVELLES?.length) {
    W('## Entrées ajoutées')
    W('')
    for (const a of D.ENTREES_NOUVELLES) {
      const s = parTitre[a.sujet]
      if (!s) { soucis.push(`Sujet introuvable : ${a.sujet}`); n.introuvables++; continue }
      // Idempotence sur (sujet, date, titre), comme le premier import.
      const deja = entrees.find((x) => x.sujet_id === s.id && x.date_evenement === a.date && x.titre === a.titre)
      let entreeId = deja?.id
      if (deja) { n.entreesDejaLa++; W(`- « ${a.titre} » : déjà présente.`) }
      else {
        if (GO) {
          const { data, error } = await supabase.from('sujet_entrees').insert({
            sujet_id: s.id, date_evenement: a.date, titre: a.titre,
            contenu: a.contenu || null, documents: [], auteur_id: membre.id,
          }).select().single()
          if (error) throw new Error(`entrée « ${a.titre} » : ${error.message}`)
          entreeId = data.id
        }
        n.entreesCreees++
        W(`- **${a.date}** — « ${a.titre} » ${GO ? 'créée' : 'à créer'} dans « ${a.sujet} ».`)
      }
      // Les pièces vont SUR L'ENTRÉE, jamais sur le sujet (leçon du brief n° 1).
      if (!a.pieces?.length) continue
      // ⚠ Relu depuis `entrees` et non depuis `deja` : une exécution précédente a
      // pu y attacher des pièces, et `deja` est l'instantané d'avant.
      const courante = entrees.find((x) => x.id === entreeId)
      const dejaSurEntree = courante ? (courante.documents || []) : []
      const ajouts = []
      let docsSujet = [...(s.documents || [])]
      let sujetModifie = false
      for (const rel of a.pieces) {
        const nom = basename(rel)
        if (dejaSurEntree.some((d) => memeNom(d.name, nom))) { n.piecesDejaLa++; continue }
        // ⚠ DÉJÀ SUR LE SUJET → ON LA DÉPLACE, on ne la saute pas. La sauter
        // laisserait la pièce là où elle ne prouve rien (leçon du brief n° 1), et
        // la retéléverser ferait un doublon. Le chemin en Storage porte l'id du
        // sujet : il reste valable, on ne bouge qu'une référence.
        const surSujet = docsSujet.find((d) => memeNom(d.name, nom))
        if (surSujet) {
          docsSujet = docsSujet.filter((d) => d !== surSujet)
          ajouts.push(surSujet)
          sujetModifie = true
          n.pieces++
          W(`  - 📎 ${nom} ${GO ? 'déplacée' : 'à déplacer'} du sujet vers cette entrée`)
          continue
        }
        // ⚠ DÉJÀ SUR UNE AUTRE ENTRÉE → ON LA DÉPLACE. Une pièce rangée au
        // mauvais endroit doit pouvoir bouger sans repasser par le disque : ici
        // le fichier de 2026 n'est même plus sur le disque (dossier réorganisé),
        // il n'existe que dans le Storage. La sauter aurait laissé le document
        // sur l'entrée de 2013, qui n'est plus celle qu'il illustre.
        const autre = entrees.find((x) => x.sujet_id === s.id && x.id !== entreeId && (x.documents || []).some((d) => memeNom(d.name, nom)))
        if (autre) {
          const doc2 = (autre.documents || []).find((d) => memeNom(d.name, nom))
          const reste = (autre.documents || []).filter((d) => d !== doc2)
          if (GO) {
            const { error } = await supabase.from('sujet_entrees').update({ documents: reste }).eq('id', autre.id)
            if (error) throw new Error(`retrait de ${nom} sur « ${autre.titre} » : ${error.message}`)
          }
          autre.documents = reste
          ajouts.push(doc2)
          n.pieces++
          W(`  - 📎 ${nom} ${GO ? 'déplacée' : 'à déplacer'} depuis l’entrée « ${autre.titre} »`)
          continue
        }
        const doc = await pieceVersDoc(s.id, rel, dossierLot)
        if (doc) { ajouts.push(doc); n.pieces++; W(`  - 📎 ${nom} ${GO ? 'attachée' : 'à attacher'}`) }
      }
      if (ajouts.length && GO && entreeId) {
        const { error } = await supabase.from('sujet_entrees')
          .update({ documents: [...dejaSurEntree, ...ajouts] }).eq('id', entreeId)
        if (error) throw new Error(`pièces de « ${a.titre} » : ${error.message}`)
        if (sujetModifie) {
          const { error: e2 } = await supabase.from('sujets').update({ documents: docsSujet }).eq('id', s.id)
          if (e2) throw new Error(`pièces du sujet « ${a.sujet} » : ${e2.message}`)
          s.documents = docsSujet
        }
      }
    }
    W('')
  }

  // ------------------------------------------------------------ 4. conflits
  if (D.CONFLITS?.length) {
    W('## ⚠ Non appliqué — à trancher')
    W('')
    W('Ces points du brief heurtent des données saisies à la main dans la base.')
    W('Un brief est écrit sans voir la base ; la base porte le travail de quelqu’un.')
    W('')
    for (const c of D.CONFLITS) {
      W(`### ${c.quoi}`)
      W(`- **Le brief demande** : ${c.brief}`)
      W(`- **Dans la base** : ${c.base}`)
      W(`- **Ce qui a été fait** : ${c.fait}`)
      W(`- **À trancher** : ${c.aTrancher}`)
      W('')
    }
  }

  // ---------------------------------------------------------------- bilan
  W('## Bilan')
  W('')
  W('| | |')
  W('|---|---|')
  W(`| Synthèses ${GO ? 'remplacées' : 'à remplacer'} | ${n.syntheses} |`)
  W(`| Entrées ${GO ? 'corrigées' : 'à corriger'} | ${n.entreesMaj} |`)
  W(`| Entrées déjà à jour | ${n.entreesDejaOk} |`)
  W(`| Entrées ${GO ? 'créées' : 'à créer'} | ${n.entreesCreees} |`)
  W(`| Entrées déjà présentes | ${n.entreesDejaLa} |`)
  W(`| Pièces ${GO ? 'attachées' : 'à attacher'} | ${n.pieces} |`)
  W(`| Pièces déjà là | ${n.piecesDejaLa} |`)
  W(`| Introuvables | ${n.introuvables} |`)
  W('')
  if (soucis.length) {
    W('### À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  // La liste qui reste à faire, après coup.
  const { data: apres } = await supabase.from('sujet_entrees').select('titre,date_evenement,sujet_id').eq('date_evenement', '1999-09-09')
  if (apres?.length) {
    W(`### Entrées restant en date sentinelle : ${apres.length}`)
    W('')
    for (const x of apres) W(`- ${sujets.find((s) => s.id === x.sujet_id)?.titre} — ${x.titre}`)
    W('')
  } else W('### Aucune entrée ne reste en date sentinelle.\n')

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `brief_${basename(cible, '.mjs')}_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (!GO) console.log('   Rien n’a été écrit. Relancer avec --go pour appliquer.')
}

main().catch((e) => { console.error(`❌ ${e.message}`); process.exit(1) })
