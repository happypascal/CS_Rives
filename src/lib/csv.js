import { formatDate } from './format'
import { BUDGET_STATUT_LABELS, CLE_REPARTITION_LABELS } from './agLogic'

// CSV export of consolidated budgets, formatted for Foncia (French locale:
// semicolon separator, comma decimals, UTF-8 BOM for Excel).
function escapeCell(v) {
  const s = String(v ?? '')
  if (/[";\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"'
  return s
}

function frNumber(n) {
  return (Number(n) || 0).toFixed(2).replace('.', ',')
}

export function budgetsToCSV(budgets) {
  const headers = [
    'AG',
    'Date AG',
    'Intitulé',
    'Montant voté (€)',
    'Clé de répartition',
    'Statut',
    'Date appel prévu',
    'Montant appelé (€)',
    'Montant encaissé (€)',
    'Observations',
  ]
  const rows = budgets.map((b) => [
    b.ag_numero,
    b.ag_date ? formatDate(b.ag_date) : '',
    b.intitule,
    frNumber(b.montant_vote),
    CLE_REPARTITION_LABELS[b.cle_repartition] || b.cle_repartition,
    BUDGET_STATUT_LABELS[b.statut] || b.statut,
    b.date_appel_prevu ? formatDate(b.date_appel_prevu) : '',
    frNumber(b.montant_appele),
    frNumber(b.montant_encaisse),
    b.observations || '',
  ])
  const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(';'))
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
