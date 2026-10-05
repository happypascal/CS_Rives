// LES DOUZE PV ANCIENS (1963-2000) — archives, résumés rédigés, mémoire.
//
// Exécute `BRIEF_pv_anciens_1963-2000_2026-10-05.md`. Pascal a versé douze
// documents dans `1_AG/` ; Claude les a lus sur l'image et en a tiré l'en-tête,
// 78 résolutions, le résumé rédigé (format v3) et 42 entrées de mémoire.
// Les textes sont fournis : le script les recopie, il ne les reformule jamais.
//
// =============================================================================
// ⚠ LA DATE VIENT DU FICHIER DE DONNÉES, JAMAIS DU NOM DU FICHIER
// =============================================================================
// Deux noms mentent, et c'est le brief qui le dit :
//   `1963/PV AG 1963_06_23.pdf` → séance du **29** juin 1963
//   `1986/PV AG 1986_07_27.pdf` → séance du **26** juillet 1986
// Tout l'import précédent déduisait la date du nom (`deduireDuNom`) ; ici on ne
// déduit RIEN. ⚠ Et on ne renomme pas les fichiers de Pascal : le nom reste
// celui qu'il connaît, c'est la base qui porte la date juste.
//
// =============================================================================
// ⚠ AUCUNE LIGNE DANS `assemblees_generales`
// =============================================================================
// Règle fondatrice du fonds (057) : ces tables-là portent un cycle de vie, des
// budgets et des rattachements. Y verser des assemblées de 1963 ferait
// apparaître des AG sans résolution ni quorum dans les écrans de gestion.
// ⚠ 1982 n'est même pas une assemblée : c'est le compte rendu d'une commission.
// 1963 est un relevé de décisions. La colonne `type_document` (063) le dit, et
// la frise des années couvertes ne comptera donc ni l'un ni l'autre — comme
// 1988, qui est une convocation.
//
// =============================================================================
// TROIS COUCHES, TROIS SOURCES DE VÉRITÉ
// =============================================================================
//   `resolutions`        la transcription du document (78 lignes)
//   `resume_resolutions` la LECTURE rédigée (064) — ne remplace pas la première
//   `sujet_entrees`      ce que ces PV apportent aux dossiers suivis (045)
//
// ⚠ LES 5 ENTRÉES `attente_pascal` NE S'APPLIQUENT PAS : deux dans « Plage »,
// trois dans « Distraction zone C ». Elles sont seulement listées. Même règle
// que les `a_verifier` du 30 septembre — et ce garde-fou a déjà servi : c'est
// lui qui a évité d'inscrire trois numéros d'arrêtés faux.
//
// Usage :
//   node scripts/importer_pv_anciens_2026-10-05.mjs        essai à blanc
//   node scripts/importer_pv_anciens_2026-10-05.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { tagsDuTexte } from '../src/lib/pvArchiveLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const SANS_TEXTE = process.argv.includes('--sans-texte')
const SOURCE = join(RACINE, 'scripts', 'data', 'pv_anciens_2026-10-05.json')
const DOSSIER = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement'
const BUCKET = 'documents'
const MAX_OCTETS = 25 * 1024 * 1024

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

const htm = (t) => String(t ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

const norm = (t) => String(t ?? '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase().replace(/[\u2018\u2019']/g, "'").replace(/\s+/g, ' ').trim()

// ⚠ UN SEUL APPEL SWIFT POUR TOUS LES FICHIERS : `swift x.swift` recompile à
// chaque exécution ; treize appels coûteraient des minutes de compilation.
// Ni tesseract, ni ocrmypdf, ni pdftotext, ni Homebrew sur ce Mac — vérifié.
function lireLesPdf(chemins) {
  return new Promise((resolve) => {
    const script = join(RACINE, 'scripts', 'lire_pdf.swift')
    const proc = spawn('swift', [script, ...chemins], { stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = '', erreur = ''
    proc.stdout.on('data', (d) => { sortie += d })
    proc.stderr.on('data', (d) => { erreur += d })
    proc.on('error', () => resolve({ ok: false, raison: 'swift introuvable', resultats: new Map() }))
    proc.on('close', (code) => {
      const resultats = new Map()
      for (const ligne of sortie.split('\n')) {
        const l = ligne.trim()
        if (!l.startsWith('{')) continue
        try { const o = JSON.parse(l); resultats.set(o.path, o) } catch { /* ligne illisible */ }
      }
      resolve({ ok: code === 0 || resultats.size > 0, raison: code === 0 ? null : (erreur.split('\n')[0] || `swift a rendu ${code}`), resultats })
    })
  })
}

// ⚠ `bonne` est RÉSERVÉ au PDF qui portait déjà son texte : là seulement ce
// qu'on a est exact. Tout ce qui sort d'une reconnaissance est au mieux
// `moyenne`. L'OCR n'est jamais bloquant : un document illisible entre au fonds
// sans texte — une archive qu'on ne peut pas chercher vaut mieux qu'une archive
// qui n'existe pas.
const qualiteDe = (l) => (!l || l.source === 'aucun' || !l.text
  ? 'illisible_partiel'
  : (l.source === 'texte' ? 'bonne' : 'moyenne'))

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
        for (const f of ['pv_archives.json', 'sujets.json', 'sujet_entrees.json']) {
          await readFile(join(RACINE, 'backup', d, f))
        }
        return d
      } catch { /* sauvegarde partielle */ }
    }
  } catch { /* pas de dossier backup */ }
  return null
}

// ⚠ DEUX FORMATS DE DATE DANS LE MÊME FICHIER. Les archives portent l'ISO
// (`1963-06-29`), la mémoire le format français (`31/07/1976`). Supposer l'un
// des deux fait échouer l'insertion avec « date/time field value out of range »
// — constaté au premier passage, après que les douze archives étaient déjà
// écrites. On normalise au lieu de supposer, et on REFUSE une date qu'on ne sait
// pas lire plutôt que d'en inventer une.
function dateISO(v) {
  const t = String(v || '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// ============================================================================
// ⚠ LE JSON NE NOMME PAS SES CHAMPS COMME LA BASE
// ============================================================================
// La source emploie le vocabulaire des RÉSUMÉS — `sujet`, `decision`,
// `resultat_vote` — là où `pv_archives.resolutions` porte celui du REGISTRE :
// `objet`, `resultat`, et les voix chiffrées `pour`/`contre`/`abstention` à
// côté de leur texte brut `voix_texte`.
//
// ⚠ Les recopier tels quels passe l'insertion SANS ERREUR — c'est du jsonb, il
// accepte n'importe quelles clés — mais la fiche affiche alors trois colonnes
// VIDES. Constaté au premier passage : l'objet, le résultat et les voix des
// douze nouvelles archives étaient introuvables à l'écran, et rien ne le
// signalait. Une insertion qui réussit n'est pas une insertion qui est juste.
//
// ⚠ ET LES VOIX NE SONT PAS CHIFFRÉES — AUCUNE DES 78.
// Les PV de 1963 à 2000 n'écrivent pas « Pour 28 · Contre 3 » mais « 28 voix
// contre 3 », « 18/30 ; contre Badea, Chappaz… », « 11 voix contre 9 1/3 ».
// Zéro ligne sur 78 est au format canonique — mesuré, pas supposé.
//
// ⚠ Une dérivation automatique y FABRIQUE des chiffres : « 9 1/3 » devient 91,
// et « 28 voix contre 3 » range le 3 en « contre » en perdant le 28. Un nombre
// faux dans un registre légal est pire qu'un nombre absent — et il a l'air
// vrai. `pour`, `contre` et `abstention` restent donc NULS, et `voix_texte`
// garde le texte EXACT du procès-verbal, que la fiche affiche tel quel.
// Le jour où quelqu'un voudra ces chiffres, il lira la phrase : elle est là.

/** Une résolution du JSON, traduite dans le vocabulaire de la base. */
const versLaBase = (r) => ({
  numero: r.numero,
  objet: r.sujet,
  detail: r.detail ?? null,
  resultat: r.decision,
  pour: null,
  contre: null,
  abstention: null,
  voix_texte: { pour: r.resultat_vote || '—', contre: '—', abstention: '—' },
})

const aTraduire = (liste) => (liste || []).some((r) => r && r.sujet !== undefined && r.objet === undefined)

const LABELS_NATURE = { pv: 'pv', releve_de_decisions: 'releve_de_decisions', compte_rendu_commission: 'compte_rendu_commission' }

async function main() {
  W(`# PV anciens 1963-2000 — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const sauvegarde = await sauvegardeDuJour()
  W(sauvegarde
    ? `Sauvegarde du jour (\`pv_archives\`, \`sujets\`, \`sujet_entrees\`) : \`backup/${sauvegarde}\`.`
    : '⚠ **Aucune sauvegarde du jour** complète. `--go` sera refusé.')
  W('')
  if (GO && !sauvegarde) throw new Error('Sauvegarde du jour absente : lancer `node scripts/backup.mjs` d’abord.')

  const d = JSON.parse(await readFile(SOURCE, 'utf8'))
  const { data: archives0, error: eA } = await supabase.from('pv_archives').select('id, date_ag, annee, type_document, document, resume_resolutions, resolutions')
  if (eA) throw new Error(`Lecture du fonds : ${eA.message}`)
  const { data: sujets } = await supabase.from('sujets').select('id, titre')
  const { data: entrees0 } = await supabase.from('sujet_entrees').select('id, sujet_id, date_evenement, titre')
  const { count: ag0 } = await supabase.from('assemblees_generales').select('*', { count: 'exact', head: true })
  const auteur = (await supabase.from('membres_cs').select('id').eq('role', 'president').eq('actif', true).single()).data

  W(`État de départ : **${archives0.length} archives · ${entrees0.length} entrées · ${sujets.length} sujets** · ${ag0} ligne(s) dans \`assemblees_generales\`.`)
  W('')

  // ===================================================== 1. les archives
  const aCreer = []
  const dejaLa = []
  const soucis = []
  for (const a of d.archives) {
    // ⚠ Idempotence : `date_ag` + `nature`, comme le demande le brief.
    const iso = dateISO(a.date_ag)
    if (!iso) { soucis.push(`${a.date_ag} : date illisible. Archive non créée.`); continue }
    const existe = archives0.find((x) => x.date_ag === iso && (x.type_document || 'pv') === a.nature)
    if (existe) { dejaLa.push(a); continue }
    const chemin = join(DOSSIER, a.fichier)
    const info = await stat(chemin).catch(() => null)
    if (!info) { soucis.push(`${a.date_ag} : \`${a.fichier}\` introuvable. Archive non créée.`); continue }
    if (info.size > MAX_OCTETS) { soucis.push(`${a.date_ag} : ${(info.size / 1048576).toFixed(1)} Mo, au-delà du plafond de 25 Mo. Archive non créée.`); continue }
    const pieces = []
    for (const pc of a.pieces_complementaires || []) {
      const cp = join(DOSSIER, pc.fichier)
      const ip = await stat(cp).catch(() => null)
      if (!ip) { soucis.push(`${a.date_ag} : pièce \`${pc.fichier}\` introuvable. L’archive est créée sans.`); continue }
      pieces.push({ ...pc, chemin: cp, taille: ip.size })
    }
    aCreer.push({ a, chemin, taille: info.size, pieces })
  }

  // ⚠ Le texte est lu pour TOUS les fichiers en un seul appel.
  let lectures = new Map()
  if (aCreer.length && !SANS_TEXTE) {
    const r = await lireLesPdf(aCreer.map((x) => x.chemin))
    lectures = r.resultats
    if (!r.ok) soucis.push(`Lecture des PDF : ${r.raison}. Les archives entrent sans texte.`)
  }

  // ⚠ RÉPARATION : une archive écrite par une version antérieure de ce script
  // peut porter ses résolutions dans le vocabulaire du JSON (`sujet`,
  // `decision`) au lieu de celui de la base. L'insertion avait réussi — c'est du
  // jsonb — mais la fiche affichait trois colonnes vides. On les retraduit.
  const aReparer = []
  for (const a of d.archives) {
    const iso = dateISO(a.date_ag)
    const existante = archives0.find((x) => x.date_ag === iso && (x.type_document || 'pv') === a.nature)
    if (existante && aTraduire(existante.resolutions)) {
      aReparer.push({ id: existante.id, date: iso, resolutions: a.resolutions.map(versLaBase), avant: existante.resolutions.length })
    }
  }
  if (aReparer.length) {
    W(`## ⚠ ${aReparer.length} archive(s) à réparer`)
    W('')
    W('Leurs résolutions portent le vocabulaire du JSON (`sujet`, `decision`) au lieu de celui de')
    W('la base (`objet`, `resultat`) : l’insertion avait réussi, mais la fiche affichait trois')
    W('colonnes vides. Le nombre de lignes ne change pas.')
    W('')
    for (const r of aReparer) W(`- ${r.date} — ${r.avant} résolution(s) retraduites`)
    W('')
  }

  W('## Archives à créer')
  W('')
  W('| Date | Nature | Intitulé | Résol. | Pages | Texte | Qualité | Pièces |')
  W('|---|---|---|---|---|---|---|---|')
  const lignes = []
  for (const x of aCreer) {
    const l = lectures.get(x.chemin) || null
    const texte = SANS_TEXTE ? null : (l?.text || null)
    const qualite = SANS_TEXTE ? null : qualiteDe(l)
    const tags = texte ? tagsDuTexte(texte) : []
    const cheminStorage = `pv-archives/${x.a.annee_exercice}/${randomUUID()}.pdf`
    const contenu = await readFile(x.chemin)
    const docsPieces = []
    for (const p of x.pieces) {
      docsPieces.push({
        chemin: p.chemin,
        storage: `pv-archives/${x.a.annee_exercice}/${randomUUID()}.pdf`,
        meta: { intitule: p.intitule, nature: p.nature, nom: basename(p.chemin), taille: p.taille },
      })
    }
    lignes.push({
      x, cheminStorage, contenu, docsPieces,
      ligne: {
        // ⚠ Date et année du FICHIER DE DONNÉES, jamais du nom du fichier.
        date_ag: dateISO(x.a.date_ag),
        annee: x.a.annee_exercice,
        type_ag: x.a.type_ag || 'inconnu',
        type_document: x.a.nature,
        intitule: x.a.titre,
        lieu: x.a.lieu ?? null,
        syndic: x.a.secretaire_foncia ?? null,
        president_seance: x.a.president ?? null,
        scrutateur: x.a.scrutateur ?? null,
        presents_representes: x.a.quorum ?? null,
        unite_vote: x.a.unite_des_votes ?? null,
        commentaire: x.a.note ?? null,
        resolutions: x.a.resolutions.map(versLaBase),
        resume_etabli_le: '2026-10-05',
        mots_cles: tags.length ? tags : null,
        document: {
          path: cheminStorage, name: basename(x.chemin), type: 'application/pdf',
          size: contenu.length, sha256: createHash('sha256').update(contenu).digest('hex'),
        },
        nb_pages: l?.pages ?? null,
        texte_ocr: texte,
        source: 'Scan importé depuis 1_AG (lot du 5 octobre 2026)',
        qualite,
      },
    })
    W(`| ${x.a.date_ag} | ${LABELS_NATURE[x.a.nature]} | ${x.a.titre} | ${x.a.resolutions.length} | ${l?.pages ?? '—'} | ${texte ? `${texte.length} car.` : '—'} | ${qualite ?? '—'} | ${x.pieces.length || '—'} |`)
  }
  W('')
  if (dejaLa.length) { W(`_${dejaLa.length} archive(s) déjà au fonds : ${dejaLa.map((a) => a.date_ag).join(', ')}._`); W('') }

  // ================================================== 2. les résumés v3
  const resumes = new Map()
  for (const r of d.resumes) {
    const quand = dateISO(r.date_ag)
    const cible = lignes.find((l) => l.ligne.date_ag === quand)
      || archives0.find((x) => x.date_ag === quand)
    if (!cible) { soucis.push(`Résumé ${r.date_ag} : aucune archive correspondante.`); continue }
    resumes.set(quand, {
      importantes: (r.resolutions_importantes || []).map((z) => ({ ordre: z.ordre, numeros: z.numeros, resume: z.resume, decision: z.decision, vote: z.vote ?? null })),
      autres: (r.autres_resolutions || []).map((z) => ({ ordre: z.ordre, numeros: z.numeros, resume: z.resume, decision: z.decision, vote: z.vote ?? null })),
      note: r.note_resume ?? null,
    })
  }
  const nImp = [...resumes.values()].reduce((n, r) => n + r.importantes.length, 0)
  const nAut = [...resumes.values()].reduce((n, r) => n + r.autres.length, 0)
  W(`## Résumés rédigés : ${resumes.size} archive(s) — ${nImp} importantes, ${nAut} autres`)
  W('')

  // ===================================================== 3. la mémoire
  const parTitre = new Map(sujets.map((x) => [x.titre, x]))
  const nouvellesEntrees = []
  const enAttente = []
  W('## Mémoire de l’ASL')
  W('')
  W('| Sujet | À ajouter | En attente | Déjà là |')
  W('|---|---|---|---|')
  for (const [titre, liste] of Object.entries(d.memoire)) {
    const sujet = parTitre.get(titre)
    if (!sujet) { soucis.push(`Sujet « ${titre} » introuvable : aucune de ses ${liste.length} entrées n’a été écrite.`); W(`| ${titre} | — | — | ❌ sujet introuvable |`); continue }
    let ajout = 0, attente = 0, deja = 0
    for (const e of liste) {
      if (e.attente_pascal) { enAttente.push({ sujet: titre, ...e }); attente++; continue }
      const quand = dateISO(e.date)
      if (!quand) { soucis.push(`« ${String(e.titre).slice(0, 44)} » (${titre}) : date « ${e.date} » illisible. Entrée non écrite.`); continue }
      // Idempotence : sujet + date + titre.
      if (entrees0.some((x) => x.sujet_id === sujet.id && x.date_evenement === quand && norm(x.titre) === norm(e.titre))
        || nouvellesEntrees.some((x) => x.sujet_id === sujet.id && x.date_evenement === quand && norm(x.titre) === norm(e.titre))) { deja++; continue }
      nouvellesEntrees.push({
        sujet_id: sujet.id, date_evenement: quand, titre: e.titre,
        contenu: `<p>${htm(e.texte)}</p>${e.source ? `<p><em>${htm(e.source)}</em></p>` : ''}`,
        resultat: e.resultat ?? null, vote: null, documents: [], auteur_id: auteur.id,
      })
      ajout++
    }
    W(`| ${titre} | ${ajout} | ${attente || '—'} | ${deja || '—'} |`)
  }
  W('')
  W(`**${nouvellesEntrees.length} entrée(s) à écrire · ${enAttente.length} en attente de Pascal.**`)
  W('')

  W(`## ⚠ ${enAttente.length} entrée(s) « en attente de Pascal » — NON écrites`)
  W('')
  for (const e of enAttente) {
    W(`- **${e.date}** (${e.sujet}) — ${e.titre}`)
    if (e.motif_attente) W(`  > ${e.motif_attente}`)
  }
  W('')

  if (soucis.length) {
    W('## ⚠ À regarder')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  } else { W('_Aucune anomalie : tous les fichiers et tous les sujets ont été trouvés._'); W('') }

  // ----------------------------------------------------- les totaux
  const arAp = archives0.length + lignes.length
  const enAp = entrees0.length + nouvellesEntrees.length
  W(`Archives : **${archives0.length} → ${arAp}** · entrées : **${entrees0.length} → ${enAp}** · \`assemblees_generales\` : **${ag0}**, inchangé.`)
  W('')
  if (arAp < archives0.length || enAp < entrees0.length) throw new Error('Un total diminuerait : rien n’a été écrit.')

  // ------------------------------------------------------- écriture
  if (GO) {
    for (const l of lignes) {
      // ⚠ Le fichier part AVANT la ligne, et l'objet est retiré si l'insert
      // échoue : une pièce téléversée que rien ne cite est invisible.
      const envoyes = []
      const { error: eU } = await supabase.storage.from(BUCKET)
        .upload(l.cheminStorage, l.contenu, { contentType: 'application/pdf', upsert: false })
      if (eU) throw new Error(`Envoi de ${l.ligne.document.name} : ${eU.message}`)
      envoyes.push(l.cheminStorage)
      const docs = [l.ligne.document]
      for (const p of l.docsPieces) {
        const contenu = await readFile(p.chemin)
        const { error } = await supabase.storage.from(BUCKET)
          .upload(p.storage, contenu, { contentType: 'application/pdf', upsert: false })
        if (error) { for (const c of envoyes) await supabase.storage.from(BUCKET).remove([c]); throw new Error(`Envoi de ${p.meta.nom} : ${error.message}`) }
        envoyes.push(p.storage)
        docs.push({
          path: p.storage, name: p.meta.nom, type: 'application/pdf',
          size: contenu.length, sha256: createHash('sha256').update(contenu).digest('hex'),
          intitule: p.meta.intitule, nature: p.meta.nature,
        })
      }
      const ligne = { ...l.ligne, resume_resolutions: resumes.get(l.ligne.date_ag) ?? null }
      // ⚠ `document` reste le document PRINCIPAL ; les pièces complémentaires
      // vivent dans `documents_complementaires` du jsonb pour ne pas déplacer la
      // colonne que tout l'écran lit.
      if (docs.length > 1) ligne.document = { ...l.ligne.document, complementaires: docs.slice(1) }
      const { error: eI } = await supabase.from('pv_archives').insert(ligne)
      if (eI) { for (const c of envoyes) await supabase.storage.from(BUCKET).remove([c]); throw new Error(`Insertion ${l.ligne.date_ag} : ${eI.message}`) }
    }
    W(`✅ ${lignes.length} archive(s) créée(s), avec leur résumé rédigé.`)

    // Les résumés des archives DÉJÀ présentes (cas d'un rejeu partiel).
    for (const [date, r] of resumes) {
      const dejaCreee = lignes.some((l) => l.ligne.date_ag === date)
      if (dejaCreee) continue
      const cible = archives0.find((x) => x.date_ag === date)
      if (!cible || JSON.stringify(cible.resume_resolutions) === JSON.stringify(r)) continue
      const { error } = await supabase.from('pv_archives').update({ resume_resolutions: r, updated_at: new Date().toISOString() }).eq('id', cible.id)
      if (error) throw new Error(`Résumé ${date} : ${error.message}`)
    }

    for (const r of aReparer) {
      const { error } = await supabase.from('pv_archives')
        .update({ resolutions: r.resolutions, updated_at: new Date().toISOString() }).eq('id', r.id)
      if (error) throw new Error(`Réparation ${r.date} : ${error.message}`)
    }
    if (aReparer.length) W(`✅ ${aReparer.length} archive(s) réparée(s).`)

    for (let i = 0; i < nouvellesEntrees.length; i += 25) {
      const { error } = await supabase.from('sujet_entrees').insert(nouvellesEntrees.slice(i, i + 25))
      if (error) throw new Error(`Entrées de mémoire : ${error.message}`)
    }
    W(`✅ ${nouvellesEntrees.length} entrée(s) de mémoire ajoutée(s).`)
    W('')
  } else if (!lignes.length && !nouvellesEntrees.length) {
    W('Rien à écrire — tout est déjà en place.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const out = join(RACINE, 'export', `pv_anciens_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(out, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${out}`)
  if (soucis.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
