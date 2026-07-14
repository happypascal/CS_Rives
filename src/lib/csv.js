import { formatDate } from './format'

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

export function downloadCSV(filename, content) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
