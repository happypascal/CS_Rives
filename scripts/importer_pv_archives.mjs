// INGESTION DES PROCÈS-VERBAUX D'ASSEMBLÉE SCANNÉS (migration 057, lot B).
//
// Un voisin a conservé tous les PV depuis 1955. Ce script prend un dossier de
// scans, dépose les fichiers dans le bucket privé, en extrait le texte et
// inscrit chaque document au fonds d'archives.
//
// ⚠ IL NE DEVINE RIEN. Ce que le nom de fichier ne dit pas reste vide et figure
// dans le rapport, pour saisie à la main sur l'écran. Inventer un jour de séance
// pour « faire propre » écrirait une information fausse dans une archive que
// plus personne ne pourra recouper — les témoins de 1957 ne sont plus là.
//
// ⚠ LE TEXTE EXTRAIT SERT À CHERCHER, JAMAIS À CITER. Sur du papier de 1955, la
// reconnaissance de caractères se trompe, et elle continuera. C'est le SCAN qui
// fait foi. L'écran le dit, et il doit continuer de le dire.
//
// ⚠ L'OCR N'EST PAS BLOQUANT : un document illisible entre quand même au fonds,
// avec `texte_ocr` nul et `qualite = illisible_partiel`. Une archive qu'on ne
// peut pas chercher vaut mieux qu'une archive qui n'existe pas.
//
// Conventions de nommage attendues (lues par `src/lib/pvArchiveLogic.js`, le
// MÊME code que l'écran) :
//     AAAA-MM-JJ_AGO.pdf   AAAA-MM-JJ_AGE.pdf   AAAA_*.pdf
//
// Usage :
//   node scripts/importer_pv_archives.mjs --dossier "<chemin>"          essai
//   node scripts/importer_pv_archives.mjs --dossier "<chemin>" --go     écrit
//   node scripts/importer_pv_archives.mjs --dossier "<chemin>" --sans-texte
//   node scripts/importer_pv_archives.mjs --dossier "<chemin>" --hors-ligne   sans base

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir, stat, access } from 'node:fs/promises'
import { join, dirname, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import process from 'node:process'
import {
  deduireDuNom, intituleAuto, anneesCouvertes, intervallesManquants,
  tagsDuTexte, tagLibelle, PREMIERE_ANNEE,
} from '../src/lib/pvArchiveLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET = 'documents'

const arg = (nom) => {
  const i = process.argv.indexOf(nom)
  return i > -1 ? process.argv[i + 1] : null
}
const GO = process.argv.includes('--go')
const SANS_TEXTE = process.argv.includes('--sans-texte')
// ⚠ `--hors-ligne` n'est PAS une commodité de développement. C'est le moyen
// d'éprouver la CONVENTION DE NOMMAGE sur un lot de scans avant qu'il n'existe
// quoi que ce soit en base : renommer soixante-dix fichiers après coup coûte
// bien plus cher que de vérifier sur les cinq premiers. Il lit les fichiers,
// extrait le texte, dit ce qu'il déduirait — et ne touche à rien.
const HORS_LIGNE = process.argv.includes('--hors-ligne')
// ⚠ `--tout` lève le filtre « procès-verbal » : à n'employer que sur un dossier
// dont on sait qu'il ne contient QUE des PV.
const TOUT = process.argv.includes('--tout')
const DOSSIER = arg('--dossier')

if (!DOSSIER) {
  console.error('❌ Indiquez le dossier des scans : --dossier "<chemin>"')
  process.exit(1)
}

// ---------------------------------------------------------------- environnement
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

const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if ((!url || !key) && !HORS_LIGNE) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  console.error('   (ou lancez avec --hors-ligne pour éprouver le nommage sans base)')
  process.exit(1)
}
const supabase = HORS_LIGNE ? null : createClient(url, key, { auth: { persistSession: false } })

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }
const soucis = []

// ============================================================================
// EXTRACTION DU TEXTE
//
// ⚠ NI `tesseract`, NI `ocrmypdf`, NI `pdftotext`, NI Homebrew sur cette
// machine — vérifié, pas supposé. On passe par `scripts/lire_pdf.swift`, qui
// utilise PDFKit et Vision, livrés avec macOS : couche texte quand le PDF en a
// une (résultat EXACT), reconnaissance française sinon.
//
// ⚠ UN SEUL APPEL POUR TOUS LES FICHIERS : `swift fichier.swift` recompile à
// chaque exécution, et soixante-dix appels coûteraient plusieurs minutes de
// compilation pour rien.
// ============================================================================
function lireLesPdf(chemins) {
  return new Promise((resolve) => {
    const script = join(RACINE, 'scripts', 'lire_pdf.swift')
    const proc = spawn('swift', [script, ...chemins], { stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    let erreur = ''
    proc.stdout.on('data', (d) => { sortie += d })
    proc.stderr.on('data', (d) => { erreur += d })
    proc.on('error', () => resolve({ ok: false, raison: 'swift introuvable', resultats: new Map() }))
    proc.on('close', (code) => {
      const resultats = new Map()
      for (const ligne of sortie.split('\n')) {
        const l = ligne.trim()
        if (!l.startsWith('{')) continue
        try {
          const o = JSON.parse(l)
          resultats.set(o.path, o)
        } catch { /* ligne illisible : le fichier restera sans texte */ }
      }
      resolve({
        ok: code === 0 || resultats.size > 0,
        raison: code === 0 ? null : (erreur.split('\n')[0] || `swift a rendu ${code}`),
        resultats,
      })
    })
  })
}

const existe = async (chemin) => { try { await access(chemin); return true } catch { return false } }

// Nombre de pages d'un PDF, sans reconnaissance de caractères.
// ⚠ `pypdf` et non le lecteur Swift : compter des pages ne demande pas d'OCR, et
// en lancer un pour une métadonnée coûterait des minutes. Un échec rend `null` —
// une pagination inconnue vaut mieux qu'un import bloqué.
async function compterPages(chemin) {
  try {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const run = promisify(execFile)
    const { stdout } = await run('/usr/bin/python3', [
      '-c', 'import sys; from pypdf import PdfReader; print(len(PdfReader(sys.argv[1]).pages))', chemin,
    ])
    const n = Number(stdout.trim())
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

// ⚠ UN `.txt` FRÈRE PRIME SUR L'OCR, mais ce n'est PAS une transcription exacte.
// Les PV de 2019 à 2026 ont un fichier texte à côté du scan. Il vaut mieux qu'une
// reconnaissance refaite — il a déjà été relu, au moins une fois — mais l'examen
// de son contenu (2026-09-28) montre qu'il vient lui aussi d'un OCR : « DNCIA »
// pour « FONCIA », des marqueurs `----- page 1 -----`. J'avais d'abord marqué ces
// documents « qualité bonne », ce qui affirmait un texte natif. C'est
// « moyenne » : mieux que rien, pas une garantie.
async function texteFrere(cheminPdf) {
  const txt = cheminPdf.replace(/\.pdf$/i, '.txt')
  if (!(await existe(txt))) return null
  const contenu = (await readFile(txt, 'utf8')).trim()
  return contenu || null
}

// L'ANNÉE DU DOSSIER, en dernier recours.
//
// ⚠ Les PV sont rangés par dossier d'année (`1_AG/2013/…`), et certains noms de
// fichiers ne portent rien d'exploitable. Le dossier est alors la seule source —
// mais il ne prime JAMAIS sur une date lue dans le nom, qui est plus précise.
// Une divergence entre les deux est SIGNALÉE : c'est le genre d'écart qui révèle
// un fichier mal rangé, et le taire reviendrait à le ranger mal une seconde fois.
function anneeDuDossier(chemin) {
  const parent = basename(dirname(chemin))
  const m = parent.match(/^(\d{4})$/)
  if (!m) return null
  const a = Number(m[1])
  return a >= PREMIERE_ANNEE && a <= 2100 ? a : null
}

// La qualité, DÉDUITE de ce qu'on a réussi à lire — jamais affirmée au-delà.
// `bonne` est réservé au PDF qui portait DÉJÀ son texte : là seulement, ce qu'on
// a est exact. Tout ce qui sort d'une reconnaissance est au mieux `moyenne`.
function qualiteDe(lecture, texteFourni) {
  // ⚠ « moyenne » et non « bonne » : le `.txt` est un OCR antérieur (cf. plus
  // haut). Seule une couche texte native dans le PDF vaut « bonne ».
  if (texteFourni) return 'moyenne'
  if (!lecture || lecture.source === 'aucun' || !lecture.text) return 'illisible_partiel'
  if (lecture.source === 'texte') return 'bonne'
  return 'moyenne'
}

// ============================================================================
// QU'EST-CE QU'UN PROCÈS-VERBAL ?
//
// ⚠ LE DOSSIER DES AG N'EST PAS UN FONDS DE PV. Lancé sur `1_AG`, l'import
// ramassait CINQUANTE PDF : convocations, ordres du jour, grands livres
// comptables, relevés bancaires, procurations, statuts, « demande de tolérance
// de passage ». Les verser dans les archives de procès-verbaux aurait noyé
// vingt-quatre délibérations sous vingt-six pièces qui n'en sont pas — et la
// frise des années couvertes aurait annoncé un fonds complet là où il ne l'est
// pas.
//
// La règle d'inclusion est donc EXPLICITE : le nom doit porter un « PV ».
// ⚠ « projet PV.pdf » est exclu par le second filtre : un projet de PV n'est
// pas un procès-verbal, il n'a été ni lu ni approuvé. C'est exactement le genre
// de document dont la présence dans un registre ferait croire à une
// délibération qui n'a pas eu lieu.
//
// Tout ce qui est écarté est NOMMÉ dans le rapport : une règle qui exclut en
// silence finit par exclure ce qu'on cherchait.
const EST_UN_PV = /(?:^|[^a-z])pv(?![a-z])/i
const PAS_UN_PV = /projet|brouillon|modele/i

const estProcesVerbal = (nom) => EST_UN_PV.test(nom) && !PAS_UN_PV.test(nom)

async function pdfsDu(dossier) {
  const out = []
  const parcourir = async (d) => {
    for (const e of await readdir(d, { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue
      const chemin = join(d, e.name)
      if (e.isDirectory()) await parcourir(chemin)
      else if (extname(e.name).toLowerCase() === '.pdf') out.push(chemin)
    }
  }
  await parcourir(dossier)
  // Tri par nom : l'ordre d'import suit l'ordre chronologique quand les fichiers
  // sont nommés selon la convention, ce qui rend le rapport lisible.
  return out.sort((a, b) => a.localeCompare(b, 'fr'))
}

// ============================================================================
async function main() {
  W(`# Import des archives de procès-verbaux — ${HORS_LIGNE ? 'HORS LIGNE' : GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W(`> Dossier : \`${DOSSIER}\``)
  if (HORS_LIGNE) W('> ⚠ **Aucune base interrogée.** Ce qui suit est ce que l’import DÉDUIRAIT des noms de fichiers.')
  else if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const infos = await stat(DOSSIER).catch(() => null)
  if (!infos?.isDirectory()) throw new Error(`Dossier introuvable : ${DOSSIER}`)

  const tousPdf = await pdfsDu(DOSSIER)
  const fichiers = TOUT ? tousPdf : tousPdf.filter((c) => estProcesVerbal(basename(c)))
  const ecartes = tousPdf.filter((c) => !fichiers.includes(c))
  if (!fichiers.length) {
    W(`Aucun procès-verbal parmi les ${tousPdf.length} PDF de ce dossier.`)
    W('')
    W('Un fichier est retenu si son nom porte « PV » et ne porte ni « projet », ni « brouillon », ni « modèle`.')
    await ecrireRapport()
    return
  }
  W(`${fichiers.length} procès-verbal(aux) retenu(s) sur ${tousPdf.length} PDF.`)
  W('')

  // ------------------------------------------------- 1. ce qui est déjà au fonds
  let existantes = []
  if (!HORS_LIGNE) {
    const { data, error: eSel } = await supabase
      .from('pv_archives')
      .select('id, annee, intitule, document')
    if (eSel) {
      // ⚠ Le message brut de PostgREST (« Could not find the table … in the
      // schema cache ») ne dit pas quoi faire. Celui-ci, oui.
      if (/pv_archives/.test(eSel.message)) {
        throw new Error('La table `pv_archives` n’existe pas encore : appliquez la migration 057 dans l’éditeur SQL de Supabase.\n   En attendant, `--hors-ligne` montre ce que cet import ferait.')
      }
      throw new Error(`Lecture du fonds : ${eSel.message}`)
    }
    existantes = data || []
  }
  const empreintesConnues = new Map(
    (existantes || []).filter((a) => a.document?.sha256).map((a) => [a.document.sha256, a]),
  )

  // ------------------------------------------------------ 2. empreintes + tri
  const candidats = []
  for (const chemin of fichiers) {
    const contenu = await readFile(chemin)
    const sha256 = createHash('sha256').update(contenu).digest('hex')
    candidats.push({ chemin, nom: basename(chemin), contenu, sha256, texteFrere: await texteFrere(chemin) })
  }

  // ⚠ Deux fichiers IDENTIQUES dans le même lot (un scan rangé deux fois) : le
  // second est écarté ici, sinon l'index unique ferait échouer l'import entier
  // au milieu, en laissant la moitié des documents déposés.
  const vus = new Map()
  const doublonsDuLot = []
  const aTraiter = []
  for (const c of candidats) {
    if (empreintesConnues.has(c.sha256)) { c.dejaAuFonds = empreintesConnues.get(c.sha256); aTraiter.push(c); continue }
    if (vus.has(c.sha256)) { doublonsDuLot.push({ ...c, original: vus.get(c.sha256).nom }); continue }
    vus.set(c.sha256, c)
    aTraiter.push(c)
  }

  const nouveaux = aTraiter.filter((c) => !c.dejaAuFonds)
  const deja = aTraiter.filter((c) => c.dejaAuFonds)

  // ------------------------------------------------------------ 3. le texte
  let lectures = new Map()
  // ⚠ Seuls les fichiers SANS `.txt` frère passent par la reconnaissance : sur
  // vingt-quatre PV dont huit ont déjà leur texte, c'est un tiers du temps
  // d'OCR économisé, et surtout aucun risque d'écraser du texte exact.
  // ⚠ LE NOMBRE DE PAGES NE DÉPEND PAS DU TEXTE. En sautant la lecture du PDF
  // pour les fichiers ayant un `.txt`, on perdait aussi leur pagination — dix
  // documents sont entrés sans nombre de pages (constaté le 2026-09-28). Il est
  // désormais compté à part, par `pypdf`, qui n'a pas besoin de reconnaissance.
  const aOcr = nouveaux.filter((c) => !c.texteFrere)
  if (!SANS_TEXTE && aOcr.length) {
    W(`Extraction du texte : ${nouveaux.length - aOcr.length} fichier(s) ont un .txt joint, ${aOcr.length} passent par la reconnaissance de caractères…`)
    W('')
    const r = await lireLesPdf(aOcr.map((c) => c.chemin))
    lectures = r.resultats
    if (!r.ok) {
      soucis.push(`Extraction du texte indisponible (${r.raison}). Les documents sont importés SANS texte cherchable — relancez l’import plus tard sur les mêmes fichiers après correction, ils seront reconnus comme déjà présents et il faudra compléter à la main.`)
    }
  }

  // ------------------------------------------------------------ 4. les lignes
  const aEcrire = []
  const sansDate = []
  const sansType = []
  const sansTexte = []
  const sansTag = []
  for (const c of nouveaux) {
    const deduit = deduireDuNom(c.nom)
    const lecture = lectures.get(c.chemin)
    // ⚠ Le `.txt` frère d'abord, l'OCR ensuite (cf. `texteFrere`).
    const fourni = c.texteFrere
    const texte = fourni || lecture?.text?.trim() || null
    const qualite = SANS_TEXTE ? null : qualiteDe(lecture, fourni)

    // L'année du DOSSIER ne sert que si le nom n'a rien donné ; une divergence
    // entre les deux est signalée, jamais arbitrée en silence.
    const anneeDossier = anneeDuDossier(c.chemin)
    const annee = deduit.annee ?? anneeDossier
    if (deduit.annee != null && anneeDossier != null && deduit.annee !== anneeDossier) {
      soucis.push(`\`${c.nom}\` : le nom du fichier dit ${deduit.annee}, le dossier dit ${anneeDossier}. Le NOM a été retenu — vérifiez que le fichier est au bon endroit.`)
    }

    if (annee == null) {
      // ⚠ `annee` est NOT NULL en base : sans année, on ne peut pas ranger le
      // document, et on ne l'invente pas. Il est écarté et nommé dans le
      // rapport — renommer le fichier suffit à le rattraper au prochain import.
      soucis.push(`\`${c.nom}\` : aucune année lisible, ni dans le nom du fichier ni dans le dossier. Document NON importé.`)
      continue
    }
    if (!deduit.date_ag) sansDate.push(c.nom)
    if (!deduit.type_ag) sansType.push(c.nom)
    if (!texte) sansTexte.push(c.nom)

    // ⚠ LES TAGS SONT DÉRIVÉS DU TEXTE, donc de sa qualité. Un document sans
    // texte n'a aucun tag — ce n'est pas qu'il ne parle de rien, c'est qu'on ne
    // sait pas. Les deux cas sont distingués dans le rapport.
    const tags = texte ? tagsDuTexte(texte) : []
    if (texte && !tags.length) sansTag.push(c.nom)

    const pages = lecture?.pages ?? (await compterPages(c.chemin))

    const chemin = `pv-archives/${annee}/${randomUUID()}.pdf`
    aEcrire.push({
      candidat: c,
      cheminStorage: chemin,
      tags,
      ligne: {
        date_ag: deduit.date_ag,
        annee,
        // ⚠ `inconnu` plutôt que null quand le nom ne dit rien : la valeur dit
        // « on a regardé et on ne sait pas », un null dirait « on n'a pas rempli ».
        type_ag: deduit.type_ag || 'inconnu',
        intitule: intituleAuto({ ...deduit, annee }, deduit.intitule),
        resume: null,
        mots_cles: tags.length ? tags : null,
        document: {
          path: chemin, name: c.nom, type: 'application/pdf',
          size: c.contenu.length, sha256: c.sha256,
        },
        nb_pages: pages,
        texte_ocr: texte,
        // La provenance dit d'où vient le TEXTE, pas seulement le fichier : c'est
        // ce qui permet de savoir, dans deux ans, si les tags reposent sur une
        // transcription exacte ou sur une reconnaissance approximative.
        source: fourni
          ? `Scan importé depuis ${basename(DOSSIER)} — texte repris du fichier .txt joint`
          : `Scan importé depuis ${basename(DOSSIER)}`,
        qualite,
        commentaire: null,
      },
    })
  }

  // ------------------------------------------------------------- 5. écriture
  W('## Documents')
  W('')
  W('| Fichier | Année | Date | Type | Pages | Texte |')
  W('|---|---|---|---|---|---|')
  for (const a of aEcrire) {
    const l = a.ligne
    W(`| ${a.candidat.nom} | ${l.annee} | ${l.date_ag || '—'} | ${l.type_ag} | ${l.nb_pages ?? '—'} | ${l.texte_ocr ? `${l.texte_ocr.length} car.` : '—'} |`)
  }
  if (!aEcrire.length) W('| _aucun nouveau document_ | | | | | |')
  W('')

  if (GO && !HORS_LIGNE && aEcrire.length) {
    for (const a of aEcrire) {
      const { error: eUp } = await supabase.storage
        .from(BUCKET)
        .upload(a.cheminStorage, a.candidat.contenu, { contentType: 'application/pdf', upsert: false })
      if (eUp) throw new Error(`Dépôt de ${a.candidat.nom} : ${eUp.message}`)

      const { error: eIns } = await supabase.from('pv_archives').insert(a.ligne)
      if (eIns) {
        // ⚠ Le fichier vient d'être déposé et la ligne a échoué : on retire
        // l'objet. Ailleurs l'application laisse délibérément des orphelins
        // (migration 012), mais ici rien ne le référence et il n'a pas une
        // seconde d'histoire — le garder n'est pas de la prudence, c'est du
        // déchet.
        await supabase.storage.from(BUCKET).remove([a.cheminStorage])
        throw new Error(`Inscription de ${a.candidat.nom} : ${eIns.message} (le fichier déposé a été retiré)`)
      }
    }
    W(`✅ ${aEcrire.length} document(s) inscrit(s) au fonds.`)
    W('')
  }

  // -------------------------------------------------------------- 6. rapport
  if (deja.length) {
    W('## Déjà au fonds')
    W('')
    W('Reconnus à leur empreinte : même contenu, quel que soit leur nom de fichier.')
    W('')
    for (const c of deja) W(`- \`${c.nom}\` → « ${c.dejaAuFonds.intitule} » (${c.dejaAuFonds.annee})`)
    W('')
  }
  if (doublonsDuLot.length) {
    W('## Doublons dans le dossier')
    W('')
    for (const d of doublonsDuLot) W(`- \`${d.nom}\` est identique à \`${d.original}\` — un seul a été retenu.`)
    W('')
  }
  if (sansDate.length) {
    W('## Date de séance à compléter à la main')
    W('')
    W('L’année est connue, le jour non. À saisir sur la fiche du document.')
    W('')
    for (const n of sansDate) W(`- \`${n}\``)
    W('')
  }
  if (sansType.length) {
    W('## Type d’assemblée à préciser')
    W('')
    W('Rangés en « Type inconnu » : le nom du fichier ne portait ni AGO, ni AGE, ni réunion.')
    W('')
    for (const n of sansType) W(`- \`${n}\``)
    W('')
  }
  // ⚠ LE RÉCAPITULATIF DES TAGS EST LA SORTIE À RELIRE. Un tag est dérivé d'un
  // texte parfois océrisé : c'est ici qu'on voit s'il en manque ou s'il y en a
  // de trop, avant que le filtre de l'écran ne s'appuie dessus.
  if (aEcrire.length) {
    const compte = new Map()
    for (const a2 of aEcrire) for (const t of a2.tags) compte.set(t, (compte.get(t) || 0) + 1)
    W('## Dossiers repérés (tags)')
    W('')
    if (!compte.size) W('Aucun — aucun texte exploitable.')
    else {
      W('| Dossier | Documents |')
      W('|---|---|')
      for (const [t, n] of [...compte.entries()].sort((x, y) => y[1] - x[1])) W(`| ${tagLibelle(t)} | ${n} |`)
    }
    W('')
    W('| Document | Dossiers |')
    W('|---|---|')
    for (const a2 of aEcrire) {
      W(`| ${a2.candidat.nom} | ${a2.tags.map(tagLibelle).join(', ') || '—'} |`)
    }
    W('')
  }
  if (sansTag.length) {
    W('## Aucun dossier repéré')
    W('')
    W('Ces documents ont un texte lisible, mais aucun des dossiers connus n’y est mentionné.')
    W('À vérifier : soit le procès-verbal traite d’autre chose, soit le vocabulaire est à compléter.')
    W('')
    for (const n of sansTag) W(`- \`${n}\``)
    W('')
  }
  if (sansTexte.length) {
    W('## Sans texte cherchable')
    W('')
    W('Ces documents sont au fonds et consultables, mais la recherche plein texte ne les trouvera pas.')
    W('')
    for (const n of sansTexte) W(`- \`${n}\``)
    W('')
  }

  if (ecartes.length) {
    W('## Écartés — pas des procès-verbaux')
    W('')
    W('Retenus : les fichiers dont le nom porte « PV », sauf projets et brouillons.')
    W('Relancez avec `--tout` si l’un d’eux devait entrer au fonds.')
    W('')
    for (const c of ecartes) W(`- \`${basename(c)}\``)
    W('')
  }

  // ⚠ PLUSIEURS DOCUMENTS POUR UNE MÊME ANNÉE : ce n'est pas forcément une
  // erreur — une année peut avoir une AGO et une AGE — mais c'est souvent deux
  // versions du même scan. On les nomme plutôt que d'en écarter un : supprimer
  // un doublon depuis la fiche prend un clic, retrouver un PV manquant prend une
  // fouille dans le carton.
  const parAnnee = new Map()
  for (const a2 of aEcrire) {
    if (!parAnnee.has(a2.ligne.annee)) parAnnee.set(a2.ligne.annee, [])
    parAnnee.get(a2.ligne.annee).push(a2.candidat.nom)
  }
  const multiples = [...parAnnee.entries()].filter(([, n]) => n.length > 1)
  if (multiples.length) {
    W('## Plusieurs documents pour la même année')
    W('')
    W('À vérifier : une AGO et une AGE, ou deux versions du même procès-verbal ?')
    W('')
    for (const [an, noms] of multiples.sort((x, y) => x[0] - y[0])) {
      W(`- **${an}** : ${noms.join(' · ')}`)
    }
    W('')
  }

  // ------------------------------------------- 7. CE QU'IL RESTE À SCANNER
  //
  // ⚠ LA SORTIE LA PLUS UTILE DU SCRIPT. Une archive qui montre seulement ce
  // qu'elle contient laisse croire qu'elle est complète ; c'est cette liste qui
  // dit à Pascal quelles années chercher dans le carton.
  const toutes = [
    ...(existantes || []).map((a) => ({ annee: a.annee })),
    ...aEcrire.map((a) => ({ annee: a.ligne.annee })),
  ]
  const couvertes = anneesCouvertes(toutes)
  const trous = intervallesManquants(toutes)
  W('## Couverture du fonds')
  W('')
  if (!couvertes.length) {
    W('Aucune année couverte pour l’instant.')
  } else {
    W(`Années couvertes : **${couvertes.length}** — de ${couvertes[0]} à ${couvertes[couvertes.length - 1]}.`)
    W('')
    W('### Années manquantes')
    W('')
    if (!trous.length) W('Aucune : le fonds est complet depuis 1955.')
    else for (const t of trous) W(`- ${t.debut === t.fin ? t.debut : `${t.debut} → ${t.fin}`}`)
  }
  W('')

  if (soucis.length) {
    W('## À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  await ecrireRapport()
}

async function ecrireRapport() {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const suffixe = HORS_LIGNE ? '-hors-ligne' : GO ? '' : '-essai'
  const chemin = join(RACINE, 'export', `pv_archives_${stamp}${suffixe}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (!GO) console.log('   Rien n’a été écrit. Relancer avec --go pour appliquer.')
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
