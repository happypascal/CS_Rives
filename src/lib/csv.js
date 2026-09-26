import { formatDate } from './format'
import { emailsOfficiels } from './proprietaireLogic'

// Export CSV des budgets AG avec suivi d'engagement, format Foncia :
// séparateur ';', décimales ',', BOM UTF-8 pour Excel.
function escapeCell(v) {
  const s = String(v ?? '')
  if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}
function frNumber(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',')
}

export function budgetsToCSV(rows) {
  const headers = ['AG', 'Résolution', 'Date AG', 'Enveloppe', 'Voté (€)', 'Projets (€)', 'Engagé direct (€)', 'Restant (€)']
  const body = rows.map((b) => [
    b.ag_numero,
    `N° ${b.resolution_numero}`,
    b.ag_date ? formatDate(b.ag_date) : '',
    b.intitule,
    frNumber(b.alloue),
    frNumber(b.projets_alloue),
    frNumber(b.engage_direct),
    frNumber(b.restant),
  ])
  const sum = (k) => rows.reduce((s, b) => s + (Number(b[k]) || 0), 0)
  const total = ['', '', '', 'TOTAL', frNumber(sum('alloue')), frNumber(sum('projets_alloue')), frNumber(sum('engage_direct')), frNumber(sum('restant'))]
  const lines = [headers, ...body, total].map((r) => r.map(escapeCell).join(';'))
  return '﻿' + lines.join('\r\n')
}

// ============================================================================
// ÉTAT DES COLOTIS POUR LE NOTAIRE — version tableur
//
// Le PDF (`downloadRegistreNotairePDF`) est le document qu'on ENVOIE ; celui-ci
// est celui que le notaire REMPLIT et renvoie. Deux usages, deux fichiers — une
// étude annote plus volontiers un tableur qu'un PDF.
//
// ⚠ MÊMES COLONNES, MÊMES BORNES QUE LE PDF. Si les deux fichiers divergeaient
// un jour, c'est le plus bavard qui ferait la fuite. Le raisonnement complet —
// et l'arbitrage de Pascal du 2026-09-26 qui autorise les adresses électroniques
// vers le notaire, et vers lui seul — est écrit en tête de
// `downloadRegistreNotairePDF` dans `pdf.js`. Le lire avant de toucher à ces
// colonnes.
//
// Restent EXCLUS : les adresses de communication et les numéros de téléphone.
//
// ⚠ LE SÉPARATEUR : VIRGULE, ET DÉCLARÉE. Ce fichier est d'abord sorti
// en point-virgule, par simple recopie du format Foncia — et Pascal l'a vu
// s'ouvrir en UNE SEULE COLONNE (2026-09-26). Le point-virgule n'a rien d'une
// convention universelle : Excel découpe sur le séparateur de liste du SYSTÈME,
// qui est la virgule en `en_CH` (le réglage de ce Mac) et le point-virgule en
// `fr_FR`. Un fichier destiné à la fois au conseil et à une étude notariale
// tombe donc forcément du mauvais côté pour l'un des deux.
//
// La ligne `sep=` en tête lève l'ambiguïté pour Excel, qui l'honore quelle que
// soit la locale. ⚠ Elle doit venir APRÈS le BOM et AVANT l'en-tête, sinon elle
// est lue comme une donnée. ⚠ Et elle ne suffit pas : LibreOffice, ÉPROUVÉ ICI,
// l'ignore et découpe sur la virgule.
//
// D'où le choix de la VIRGULE plutôt que du point-virgule. Les deux options ne
// sont pas symétriques :
//   - `sep=;` → si la directive est honorée, correct ; sinon, une seule colonne
//     sur ce Mac (`en_CH`), c'est-à-dire chez celui qui doit RELIRE le fichier
//     avant de l'envoyer ;
//   - `sep=,` → si la directive est honorée, correct ; sinon, on retombe sur le
//     séparateur natif de ce poste, et c'est encore correct.
// La virgule échoue dans un seul cas : un outil qui ignore la directive ET
// attend le point-virgule. Excel ne l'ignore pas.
//
// ⚠ CE QUI A ÉTÉ ÉPROUVÉ (2026-09-26), et non supposé : le fichier a été ouvert
// par LibreOffice, qui IGNORE la directive — sept colonnes correctes, guillemets
// respectés sur une adresse double et sur une observation contenant `;` et `,`.
// Le seul reliquat est une PREMIÈRE LIGNE `sep=` visible dans les outils qui
// ignorent la directive (Excel, lui, la consomme). Une ligne parasite en tête
// vaut mieux qu'un fichier en une seule colonne.
//
// ⚠ Le BOM sert à Excel, pas au découpage : LibreOffice en ligne de commande
// suppose du latin-1 et abîme les accents tant qu'on ne lui déclare pas l'UTF-8.
// C'est un défaut de SON convertisseur, pas du fichier — vérifié en le relançant
// avec l'encodage explicite, les accents étaient alors intacts.
//
// ⚠ CONSÉQUENCE : les cellules doivent être protégées des VIRGULES, ce que
// l'échappement de l'export Foncia ne fait pas (il ne connaît que `;`). D'où un
// échappement propre à ce fichier — les partager aurait fait qu'une correction
// ici casserait l'autre.
//
// ⚠ Le CSV des budgets (`budgetsToCSV`) n'a PAS été modifié : il part chez
// Foncia, peut-être vers un import automatique qu'une ligne inattendue
// casserait. Le même symptôme s'y produira sur ce Mac — c'est un arbitrage à
// prendre, pas un oubli.
// ============================================================================
const SEP = ','
const DIRECTIVE_SEP = 'sep=' + SEP

// ⚠ Guillemets, virgules, points-virgules ET sauts de ligne. Le point-virgule
// n'est pas le séparateur de ce fichier, mais une observation du notaire peut en
// contenir un — et le fichier doit rester lisible par un outil qui, lui, découpe
// dessus.
const cellule = (v) => {
  const t = String(v ?? '')
  return /[",;\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t
}
export function colotisNotaireToCSV(lots) {
  const headers = ['Parcelle', 'Propriétaire(s)', 'Courriel', 'Adresse dans le lotissement', 'Superficie (m²)', 'Acte reçu le', 'Observations']
  const body = lots.map((l) => {
    const p = l.proprietaire
    const noms = p ? [p.nom, p.nom_2].filter(Boolean).join(' / ') : ''
    return [
      l.numero || '',
      // ⚠ Une parcelle vacante reste dans le fichier, dite comme telle : une
      // ligne absente se lirait « rien à réclamer ici », alors qu'elle signifie
      // « nous ne savons pas à qui la réclamer ».
      noms || 'propriétaire inconnu',
      // ⚠ Les CONTACTS OFFICIELS (044), pas la colonne `email` : c'est à eux que
      // l'association écrit, dirigeant de SCI ou mandataire compris. Toutes,
      // séparées par une virgule — un lot à deux noms se réclame aux deux.
      emailsOfficiels(p).join(', '),
      l.adresse_lotissement || '',
      l.superficie != null ? frNumber(l.superficie) : '',
      // ⚠ On REPORTE ce que le notaire nous a déjà communiqué (059), et on
      // laisse vide le reste : c'est ce qui fait d'un second envoi une relance
      // plutôt qu'un nouveau pointage. Au premier envoi, les deux colonnes sont
      // entièrement vides — le registre ne sait rien encore.
      p?.acte_transmis_le ? formatDate(p.acte_transmis_le) : '',
      p?.acte_observations || '',
    ]
  })
  const lines = [DIRECTIVE_SEP, ...[headers, ...body].map((r) => r.map(cellule).join(SEP))]
  return '\ufeff' + lines.join('\r\n') + '\r\n'
}

export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
