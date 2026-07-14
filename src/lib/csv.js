import { formatDate } from './format'

// Export CSV des budgets alloués (montant voté), format Foncia :
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
  const headers = ['Source', 'Référence', 'Date', 'Intitulé', 'Montant alloué (€)']
  const body = rows.map((b) => [b.source, b.reference, b.date ? formatDate(b.date) : '', b.intitule, frNumber(b.montant_alloue)])
  const total = ['', '', '', 'TOTAL', frNumber(rows.reduce((s, b) => s + (Number(b.montant_alloue) || 0), 0))]
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
