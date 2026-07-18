import { format, parseISO, isValid, addBusinessDays } from 'date-fns'
import { fr } from 'date-fns/locale'

// Montant en euros, format FR. Vit ici et non dans `ui.jsx` : les libs (share.js,
// pdf.js) doivent pouvoir formater un montant sans importer un module de
// composants. `ui.jsx` le ré-exporte, les pages continuent de l'importer de là.
export const eur = (n) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0)

// Parse un montant saisi à la main. Tolérant au format suisse/français :
// apostrophe, espace (y compris fine/insécable) comme séparateurs de milliers
// (20'000, 20 000), virgule OU point décimal.
//
// Arrondi à 2 décimales à la fin, pour tuer les artefacts flottants : une molette
// de souris au-dessus d'un <input type=number step=0.01> décrémente 20000 en
// 19999.99 (piège vécu par Pascal). Renvoie null si vide/illisible.
export function parseMontant(value) {
  if (value == null) return null
  const cleaned = String(value).replace(/[\s'’]/g, '').replace(',', '.')
  if (cleaned === '') return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

// Le rich-text des descriptions (RichTextEditor / execCommand) en texte brut.
//
// Sans DOM à dessein, alors que la version d'origine (dans pdf.js) passait par
// `document.createElement` : le texte brut sert désormais aussi à construire des
// résumés, et une fonction sans DOM se teste hors navigateur. Le vocabulaire est
// fermé et connu — execCommand ne produit que p/div/br/b/strong/i/em/ul/ol/li.
const ENTITES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': '’', '&rsquo;': '’' }

export function htmlToText(html) {
  if (!html) return ''
  return String(html)
    .replace(/<li[^>]*>/gi, '\n• ')          // puces : la liste doit rester lisible
    .replace(/<br\s*\/?>/gi, '\n')
    // `li` volontairement absent : son ouverture pose déjà le saut de ligne, le
    // fermer aussi séparerait chaque puce par une ligne vide.
    .replace(/<\/(p|div|ul|ol|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '')                  // le reste des balises
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&[a-z]+;|&#39;/gi, (e) => ENTITES[e.toLowerCase()] ?? e)
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Texte tronqué sur un mot entier, avec une ellipse. `max` compte les caractères.
export function truncate(text, max = 160) {
  const t = (text || '').replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const coupe = t.slice(0, max)
  const espace = coupe.lastIndexOf(' ')
  return (espace > max * 0.6 ? coupe.slice(0, espace) : coupe).trimEnd() + '…'
}

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

// Mois courant en toutes lettres : "juillet 2026". Sert à nommer les lots de
// signature par défaut. 'MMMM' donne le mois en minuscule avec la locale fr.
export function moisCourant() {
  return format(new Date(), 'MMMM yyyy', { locale: fr })
}

// Ajoute N jours ouvrables (lun-ven) à une date ISO et renvoie une date ISO.
export function addBusinessDaysISO(dateISO, n) {
  const base = dateISO ? parseISO(dateISO) : new Date()
  if (!isValid(base)) return dateISO
  return format(addBusinessDays(base, n), 'yyyy-MM-dd')
}
