import { format, parseISO, isValid } from 'date-fns'
import { fr } from 'date-fns/locale'

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
