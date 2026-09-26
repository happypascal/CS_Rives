// ============================================================================
// ÉCRITURE D'UN CLASSEUR EXCEL (.xlsx) — minimal, sans dépendance
//
// ⚠ POURQUOI CE FICHIER EXISTE. L'état des colotis destiné au notaire est sorti
// trois fois en CSV, et deux fois de travers :
//   1. point-virgule → UNE SEULE COLONNE chez Pascal. Excel ne découpe pas sur
//      un séparateur fixe, il découpe sur le séparateur de liste du SYSTÈME :
//      virgule en `en_CH` (ce Mac), point-virgule en `fr_FR` (l'étude). Un même
//      fichier ne peut pas satisfaire les deux.
//   2. `sep=,` ajouté pour lever l'ambiguïté → colonnes correctes, mais ACCENTS
//      CASSÉS (« All√©e de Rives ») : la directive fait basculer Excel sur un
//      chemin d'import ancien qui ignore le BOM et retombe sur l'encodage
//      hérité du système.
//
// Le CSV n'a pas de réponse à cela : c'est un format qui ne décrit ni son
// encodage ni son séparateur, et chaque tableur comble les trous à sa façon. Un
// `.xlsx` les décrit tous les deux — c'est du XML UTF-8 déclaré, dans un ZIP, et
// les colonnes sont des colonnes. Il n'y a plus rien à deviner, ni ici, ni à
// l'étude.
//
// ⚠ AUCUNE DÉPENDANCE AJOUTÉE, et c'est délibéré : le dépôt n'a pas de
// bibliothèque ZIP, et en ajouter une pour écrire six petits fichiers XML
// coûterait plus cher que de les écrire. Les entrées sont STOCKÉES (méthode 0,
// sans compression) : un ZIP valide n'exige pas `deflate`, seulement un CRC-32
// juste. Excel, LibreOffice et Numbers les ouvrent sans broncher.
//
// ⚠ CHAÎNES EN LIGNE (`inlineStr`) plutôt qu'une table de chaînes partagées :
// une table économiserait quelques kilo-octets sur cinquante lignes, au prix
// d'un second fichier XML et d'un index à tenir juste. Le volume n'est pas le
// problème ici, la justesse l'est.
// ============================================================================
import { formatDate } from './format'
import { emailsOfficiels } from './proprietaireLogic'

// ---------------------------------------------------------------- CRC-32
// Table calculée une fois. ⚠ Le ZIP est refusé sans CRC juste — c'est la seule
// partie de ce fichier où une erreur ne se verrait pas à la lecture du XML.
const TABLE_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(octets) {
  let c = 0xffffffff
  for (let i = 0; i < octets.length; i++) c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

const utf8 = (s) => new TextEncoder().encode(s)

// ⚠ Les cinq caractères que XML réserve. Sans cet échappement, un nom contenant
// « & » produirait un classeur illisible — et le message d'Excel ne dirait pas
// pourquoi.
const xml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

// Référence de cellule : 0 → A1, 26 → AA1.
function refCellule(colonne, ligne) {
  let n = colonne + 1
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s + (ligne + 1)
}

// ---------------------------------------------------------------- le ZIP
function zip(fichiers) {
  const morceaux = []
  const entrees = []
  let position = 0

  const ecrire = (buf) => { morceaux.push(buf); position += buf.length }

  for (const { nom, contenu } of fichiers) {
    const nomOctets = utf8(nom)
    const donnees = utf8(contenu)
    const crc = crc32(donnees)
    const entete = new DataView(new ArrayBuffer(30))
    entete.setUint32(0, 0x04034b50, true)  // signature d'entrée locale
    entete.setUint16(4, 20, true)          // version minimale
    entete.setUint16(6, 0x0800, true)      // drapeau : noms de fichiers en UTF-8
    entete.setUint16(8, 0, true)           // méthode 0 — STOCKÉ, pas compressé
    entete.setUint16(10, 0, true)          // heure (indifférente)
    entete.setUint16(12, 0x21, true)       // date (1980-01-01, indifférente)
    entete.setUint32(14, crc, true)
    entete.setUint32(18, donnees.length, true)
    entete.setUint32(22, donnees.length, true)
    entete.setUint16(26, nomOctets.length, true)
    entete.setUint16(28, 0, true)
    entrees.push({ nom: nomOctets, crc, taille: donnees.length, decalage: position })
    ecrire(new Uint8Array(entete.buffer))
    ecrire(nomOctets)
    ecrire(donnees)
  }

  const debutCentral = position
  for (const e of entrees) {
    const c = new DataView(new ArrayBuffer(46))
    c.setUint32(0, 0x02014b50, true)
    c.setUint16(4, 20, true)
    c.setUint16(6, 20, true)
    c.setUint16(8, 0x0800, true)
    c.setUint16(10, 0, true)
    c.setUint16(12, 0, true)
    c.setUint16(14, 0x21, true)
    c.setUint32(16, e.crc, true)
    c.setUint32(20, e.taille, true)
    c.setUint32(24, e.taille, true)
    c.setUint16(28, e.nom.length, true)
    c.setUint32(42, e.decalage, true)
    ecrire(new Uint8Array(c.buffer))
    ecrire(e.nom)
  }

  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, entrees.length, true)
  fin.setUint16(10, entrees.length, true)
  fin.setUint32(12, position - debutCentral, true)
  fin.setUint32(16, debutCentral, true)
  ecrire(new Uint8Array(fin.buffer))

  const total = morceaux.reduce((s, m) => s + m.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const m of morceaux) { out.set(m, o); o += m.length }
  return out
}

// ---------------------------------------------------------------- le classeur
/**
 * Un classeur d'une seule feuille, à partir d'un tableau de lignes.
 *
 * @param lignes  string[][] — la première est l'en-tête.
 * @param opts.feuille  nom de l'onglet (31 caractères max chez Excel).
 * @param opts.largeurs  largeurs de colonnes, en caractères.
 * @returns Uint8Array — le fichier .xlsx.
 */
export function classeurXLSX(lignes, opts = {}) {
  const nomFeuille = xml((opts.feuille || 'Feuille 1').slice(0, 31))

  const colonnes = opts.largeurs?.length
    ? `<cols>${opts.largeurs.map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`).join('')}</cols>`
    : ''

  const corps = lignes.map((ligne, r) => {
    const cellules = ligne.map((v, c) => {
      const t = String(v ?? '')
      // Une cellule vide n'est pas écrite : c'est ce qui la laisse VRAIMENT
      // vide dans Excel, prête à être remplie.
      if (t === '') return ''
      // ⚠ Tout en TEXTE (`inlineStr`). Une parcelle « 0B 220 » ou une superficie
      // « 1 240,50 » interprétées en nombre perdraient leur zéro de tête ou leur
      // virgule selon la locale d'ouverture — on retombe sur le défaut qu'on
      // vient de corriger. Un état à annoter n'a rien à calculer.
      return `<c r="${refCellule(c, r)}" t="inlineStr"><is><t xml:space="preserve">${xml(t)}</t></is></c>`
    }).join('')
    return `<row r="${r + 1}">${cellules}</row>`
  }).join('')

  // ⚠ `freezePane` sur la première ligne : cinquante lignes se lisent en
  // défilant, et un en-tête qui disparaît oblige à remonter pour savoir quelle
  // colonne on annote.
  const feuille = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${colonnes}<sheetData>${corps}</sheetData></worksheet>`

  return zip([
    {
      nom: '[Content_Types].xml',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      nom: '_rels/.rels',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      nom: 'xl/workbook.xml',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${nomFeuille}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      nom: 'xl/_rels/workbook.xml.rels',
      contenu: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    { nom: 'xl/worksheets/sheet1.xml', contenu: feuille },
  ])
}

// ============================================================================
// ÉTAT DES COLOTIS — les lignes du classeur
//
// ⚠ MÊMES COLONNES, MÊMES BORNES QUE LE PDF. Si les deux fichiers divergeaient
// un jour, c'est le plus bavard qui ferait la fuite. Le raisonnement complet —
// et l'arbitrage de Pascal du 2026-09-26 qui autorise les adresses électroniques
// vers le notaire, et vers lui seul — est écrit en tête de
// `downloadRegistreNotairePDF` dans `pdf.js`. Le lire avant de toucher à ces
// colonnes. Restent EXCLUS : adresses de communication et téléphones.
// ============================================================================
export function colotisNotaireLignes(lots) {
  const entetes = ['Parcelle', 'Propriétaire(s)', 'Courriel', 'Adresse dans le lotissement', 'Superficie (m²)', 'Acte reçu le', 'Observations']
  const corps = (lots || []).map((l) => {
    const p = l.proprietaire
    const noms = p ? [p.nom, p.nom_2].filter(Boolean).join(' / ') : ''
    return [
      l.numero || '',
      // ⚠ Une parcelle vacante reste dans le fichier, dite comme telle : une
      // ligne absente se lirait « rien à réclamer ici », alors qu'elle signifie
      // « nous ne savons pas à qui la réclamer ».
      noms || 'propriétaire inconnu',
      // Les CONTACTS OFFICIELS (044), pas la colonne `email` : dirigeant de SCI
      // et mandataire compris. Un lot à deux noms se réclame aux deux.
      emailsOfficiels(p).join(', '),
      l.adresse_lotissement || '',
      l.superficie != null ? new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2 }).format(l.superficie) : '',
      // ⚠ On REPORTE ce que le notaire a déjà communiqué (059) et on laisse vide
      // le reste : c'est ce qui fait d'un second envoi une relance plutôt qu'un
      // nouveau pointage.
      p?.acte_transmis_le ? formatDate(p.acte_transmis_le) : '',
      p?.acte_observations || '',
    ]
  })
  return [entetes, ...corps]
}

/** Largeurs en caractères — l'adresse électronique est la colonne longue. */
export const COLOTIS_LARGEURS = [14, 30, 34, 26, 14, 14, 30]

export function downloadXLSX(filename, octets) {
  const blob = new Blob([octets.buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
