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
// Format Foncia réutilisé (';', BOM UTF-8) : c'est celui qu'Excel ouvre sans
// poser de question sur un poste français.
// ============================================================================
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
  const lines = [headers, ...body].map((r) => r.map(escapeCell).join(';'))
  return '\ufeff' + lines.join('\r\n')
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
