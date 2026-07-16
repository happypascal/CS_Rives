import { format, parseISO, isValid, addBusinessDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// Montant en euros, format FR. Vit ici et non dans `ui.jsx` : les libs (share.js,
// pdf.js) doivent pouvoir formater un montant sans importer un module de
// composants. `ui.jsx` le ré-exporte, les pages continuent de l'importer de là.
export const eur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

// Display a date-only ISO string (YYYY-MM-DD) as JJ/MM/AAAA.
export function formatDate(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(d)) return '—'
  return format(d, 'dd/MM/yyyy', { locale: fr })
}

// Long, human form: "12 juin 2025".
export function formatDateLong(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(d)) return '—'
  return format(d, 'd MMMM yyyy', { locale: fr })
}

// Full timestamp for audit / Q&A display.
export function formatDateTime(value) {
  if (!value) return '—'
  const d = typeof value === 'string' ? parseISO(value) : value
  if (!isValid(d)) return '—'
  return format(d, "dd/MM/yyyy 'à' HH:mm", { locale: fr })
}

export function todayISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

// Ajoute N jours ouvrables (lun-ven) à une date ISO et renvoie une date ISO.
export function addBusinessDaysISO(dateISO, n) {
  const base = dateISO ? parseISO(dateISO) : new Date()
  if (!isValid(base)) return dateISO
  return format(addBusinessDays(base, n), 'yyyy-MM-dd')
}
