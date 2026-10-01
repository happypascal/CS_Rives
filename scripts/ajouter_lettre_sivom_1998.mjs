// EAUX USÉES — LA LETTRE DU SIVOM DU 19 MAI 1998.
//
// Exécute `BRIEF_eaux_usees_sivom_1998_2026-10-01.md`. Pascal a versé au dossier
// la lettre du SIVOM du Bas-Chablais et ses annexes (8 pages) ; c'est la
// proposition que l'AG du 20 juin 1998 a entérinée (point VII). Claude l'a lue
// sur l'image ; les textes sont fournis et ne se reformulent pas.
//
// =============================================================================
// ⚠ LE PIÈGE DE CES DEUX ÉDITIONS : `ancien` SURVIT DANS `nouveau`
// =============================================================================
// Les deux chaînes de remplacement CONTIENNENT celle qu'elles remplacent :
//   « 1998 : la proposition du SIVOM est entérinée »
//     → « Mai 1998 : le SIVOM écrit au syndic […] Juin 1998 : la proposition du
//        SIVOM est entérinée »
//   « Retrouver la convention conclue avec le SIVOM (1997-1998) »
//     → la même phrase, suivie d'une incise.
//
// ⚠ Un script qui raisonne « `ancien` est présent, donc j'applique » RÉÉCRIRAIT
// À CHAQUE EXÉCUTION, en empilant l'ajout. L'idempotence se teste donc sur
// `nouveau` EN ENTIER, et AVANT de chercher `ancien` — jamais sur un préfixe :
// pour la seconde édition, `nouveau` COMMENCE par `ancien`, si bien qu'un test
// de préfixe répond « déjà fait » dès le premier passage et n'écrit jamais rien.
//
// =============================================================================
// LE RESTE DES GARDE-FOUS
// =============================================================================
// ⚠ La pièce est attachée à L'ENTRÉE (`sujet_entrees.documents`), pas au sujet.
// ⚠ Mais son CHEMIN de Storage porte l'id du SUJET (`sujets/<id>/<uuid>.pdf`) :
// convention de la migration 046 — le sujet existe au moment de l'envoi,
// l'entrée pas encore.
// ⚠ TOUTE PIÈCE TÉLÉVERSÉE DOIT ÊTRE CITÉE : si l'insertion échoue après
// l'envoi, l'objet est retiré du bucket. Un fichier stocké que rien ne
// référence est invisible, et rien ne le signale (leçon du 2026-09-29).
// ⚠ On ne supprime rien, aucune autre entrée n'est touchée, `pv_archives` et
// `resume_resolutions` ne sont pas lus en écriture.
// ⚠ L'ancienne synthèse part dans `sujets.historique` avant d'être remplacée.
//
// Usage :
//   node scripts/ajouter_lettre_sivom_1998.mjs        essai à blanc
//   node scripts/ajouter_lettre_sivom_1998.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const SOURCE = join(RACINE, 'scripts', 'data', 'eaux_usees_sivom_1998_2026-10-01.json')
const DOSSIER = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement'
// Le repli annoncé par le brief, si le fichier a bougé.
const REPLI = '7_Réseau Eaux Usées/Assainissement19.05.98.pdf'
const BUCKET = 'documents'
const MAX_OCTETS = 25 * 1024 * 1024

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

const LIEE_A_UNE_DECISION = /\b20\d{2}-\d{3}\b|d[ée]cision\s+(?:du\s+conseil|n[°o])/i

const htm = (t) => String(t ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const norm = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase().replace(/[\u2018\u2019']/g, "'").replace(/\s+/g, ' ').trim()

const ECHAPPE = /[.*+?^${}()|[\]\\]/g
/** Motif tolérant aux balises HTML entre deux caractères — jamais après le dernier. */
const motifDe = (texte) => new RegExp([...String(texte).trim()]
  .map((c) => (/\s/.test(c) ? '(?:<[^>]*>|\\s|&nbsp;)+' : c.replace(ECHAPPE, '\\$&')))
  .join('(?:<[^>]*>)*'), 'g')

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
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().slice(0, 10)
  try {
    for (const d of (await readdir(join(RACINE, 'backup'))).filter((x) => x.startsWith(jour)).sort().reverse()) {
      try {
        await readFile(join(RACINE, 'backup', d, 'sujets.json'))
        await readFile(join(RACINE, 'backup', d, 'sujet_entrees.json'))
        return d
      } catch { /* sauvegarde partielle */ }
    }
  } catch { /* pas de dossier backup */ }
  return null
}

async function main() {
  W(`# Eaux usées — lettre du SIVOM du 19 mai 1998 — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const sauvegarde = await sauvegardeDuJour()
  W(sauvegarde
    ? `Sauvegarde du jour (avec \`sujets.json\` et \`sujet_entrees.json\`) : \`backup/${sauvegarde}\`.`
    : '⚠ **Aucune sauvegarde du jour** contenant `sujets` et `sujet_entrees`. `--go` sera refusé.')
  W('')
  if (GO && !sauvegarde) throw new Error('Sauvegarde du jour absente : lancer `node scripts/backup.mjs` d’abord.')

  const d = JSON.parse(await readFile(SOURCE, 'utf8'))
  const { data: sujet, error: eS } = await supabase.from('sujets')
    .select('id, titre, contenu, historique').eq('titre', d.sujet).maybeSingle()
  if (eS) throw new Error(`Lecture du sujet : ${eS.message}`)
  if (!sujet) throw new Error(`Sujet « ${d.sujet} » introuvable.`)

  const { data: entrees } = await supabase.from('sujet_entrees')
    .select('id, date_evenement, titre, documents').eq('sujet_id', sujet.id)
  const { count: total0 } = await supabase.from('sujet_entrees').select('*', { count: 'exact', head: true })
  const auteur = (await supabase.from('membres_cs').select('id').eq('role', 'president').eq('actif', true).single()).data

  W(`Sujet « ${sujet.titre} » : **${entrees.length} entrées** · base : **${total0}**.`)
  W('')

  // ------------------------------------------------------- la pièce
  const e = d.entree_a_ajouter
  W('## La pièce jointe')
  W('')
  let chemin = join(DOSSIER, e.piece)
  let info = await stat(chemin).catch(() => null)
  if (!info) {
    // ⚠ Le repli est ANNONCÉ par le brief : le fichier a pu être rangé ailleurs.
    const alt = join(DOSSIER, REPLI)
    const infoAlt = await stat(alt).catch(() => null)
    if (infoAlt) { chemin = alt; info = infoAlt; W(`⚠ Introuvable au chemin principal — **repli employé** : \`${REPLI}\`.`) }
  }
  if (!info) {
    W(`⚠ **\`${e.piece}\` introuvable**, ni au repli \`${REPLI}\`. **Aucune pièce ne sera attachée** ; l’entrée est créée sans.`)
  } else if (info.size > MAX_OCTETS) {
    W(`⚠ **${(info.size / 1048576).toFixed(1)} Mo**, au-delà du plafond de 25 Mo (\`MAX_DOC_BYTES\`). Aucune pièce attachée.`)
    info = null
  } else {
    W(`- \`${chemin.replace(DOSSIER + '/', '')}\` — ${(info.size / 1048576).toFixed(1)} Mo`)
  }
  W('')

  // ------------------------------------------------------ l'entrée
  const deja = entrees.find((x) => x.date_evenement === e.date && norm(x.titre) === norm(e.titre))
  W('## L’entrée')
  W('')
  W(`| Date | Titre | Résultat | Pièce |`)
  W(`|---|---|---|---|`)
  W(`| ${e.date} | ${e.titre} | ${e.resultat} | ${info ? '1' : '—'} |`)
  W('')
  if (deja) {
    W(`Déjà présente (${(deja.documents || []).length} pièce(s)) — elle ne sera pas recréée.`)
    W('')
  }

  // --------------------------------------------- les deux éditions
  const edits = []
  const refus = []
  let contenu = sujet.contenu || ''
  W('## Les deux éditions de la synthèse')
  W('')
  W('| Section | État |')
  W('|---|---|')
  for (const x of d.synthese_edits) {
    // ⚠ `nouveau` EN ENTIER, ET EN PREMIER : les deux chaînes de remplacement
    // contiennent celle qu'elles remplacent. Tester `ancien` d'abord ferait
    // réécrire à chaque exécution, en empilant.
    if ([...contenu.matchAll(motifDe(x.nouveau))].length > 0) { W(`| ${x.section} | déjà appliquée |`); continue }
    const trouvees = [...contenu.matchAll(motifDe(x.ancien))]
    if (trouvees.length === 0) {
      refus.push(`Section « ${x.section} » : la chaîne « ${x.ancien.slice(0, 50)}… » est absente. Rien n’a été écrit.`)
      W(`| ${x.section} | ❌ chaîne absente |`); continue
    }
    if (trouvees.length > 1) {
      refus.push(`Section « ${x.section} » : « ${x.ancien.slice(0, 50)}… » apparaît ${trouvees.length} fois — on ne sait pas laquelle viser. Rien n’a été écrit.`)
      W(`| ${x.section} | ❌ ${trouvees.length} occurrences |`); continue
    }
    contenu = contenu.replace(motifDe(x.ancien), htm(x.nouveau))
    edits.push(x.section)
    W(`| ${x.section} | ✅ à écrire |`)
  }
  W('')
  if (refus.length) {
    W('## ⚠ Refusées')
    W('')
    for (const r of refus) W(`- ${r}`)
    W('')
  }

  // ⚠ Une synthèse liée à une décision du conseil ne s'écrase pas.
  let bloquee = false
  if (edits.length && LIEE_A_UNE_DECISION.test(sujet.contenu || '')) {
    bloquee = true
    W('⚠ **La synthèse cite une décision du conseil** — non écrasée ; le nouveau texte est ajouté en commentaire.')
    W('')
    contenu = `${sujet.contenu}<hr><p><em>Révision proposée le 1er octobre 2026, non appliquée car la synthèse cite une décision du conseil :</em></p>${contenu}`
  }

  W(`**${deja ? 0 : 1} entrée à créer · ${edits.length} édition(s) de synthèse.**`)
  W(`Entrées : **${total0} → ${total0 + (deja ? 0 : 1)}** (aucune supprimée).`)
  W('')

  // ------------------------------------------------------- écriture
  if (GO) {
    let doc = null
    if (info && !deja) {
      const path = `sujets/${sujet.id}/${randomUUID()}${extname(chemin)}`
      const { error } = await supabase.storage.from(BUCKET)
        .upload(path, await readFile(chemin), { contentType: 'application/pdf', upsert: false })
      if (error) throw new Error(`Envoi de la pièce : ${error.message}`)
      doc = {
        id: randomUUID(), name: 'Assainissement19.05.98.pdf', path,
        size: info.size, type: 'application/pdf', uploaded_at: new Date().toISOString(),
      }
    }
    if (!deja) {
      const { error } = await supabase.from('sujet_entrees').insert({
        sujet_id: sujet.id, date_evenement: e.date, titre: e.titre,
        contenu: `<p>${htm(e.texte)}</p>${e.source ? `<p><em>${htm(e.source)}</em></p>` : ''}`,
        resultat: e.resultat ?? null, vote: null,
        documents: doc ? [doc] : [], auteur_id: auteur.id,
      })
      if (error) {
        // ⚠ L'insertion a échoué : l'objet téléversé ne doit pas rester orphelin.
        if (doc) await supabase.storage.from(BUCKET).remove([doc.path])
        throw new Error(`Insertion de l’entrée : ${error.message}`)
      }
      W(`✅ Entrée créée${doc ? ', avec sa pièce jointe' : ' (sans pièce)'}.`)
    }
    if (edits.length) {
      const patch = {
        contenu,
        // ⚠ L'ancienne synthèse est gardée avant d'être remplacée (065).
        historique: [
          { le: new Date().toISOString(), resume: null, contenu: sujet.contenu ?? null,
            motif: 'Lettre du SIVOM du 19 mai 1998 versée au dossier (1er octobre 2026).' },
          ...(sujet.historique || []),
        ],
        updated_at: new Date().toISOString(),
      }
      const { error } = await supabase.from('sujets').update(patch).eq('id', sujet.id)
      if (error) throw new Error(`Écriture de la synthèse : ${error.message}`)
      W(`✅ Synthèse mise à jour (${edits.join(', ')})${bloquee ? ' — en commentaire' : ''}.`)
    }
    W('')
  } else if (deja && !edits.length) {
    W('Rien à écrire — déjà appliqué.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const out = join(RACINE, 'export', `lettre_sivom_1998_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(out, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${out}`)
  if (refus.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
