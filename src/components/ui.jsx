// Small set of Tailwind-based UI primitives, sober legal-document tone.
import { forwardRef } from 'react'

function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function Button({ variant = 'primary', size = 'md', className, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-400 disabled:opacity-50 disabled:cursor-not-allowed'
  const sizes = {
    sm: 'px-2.5 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  }
  const variants = {
    primary: 'bg-navy-600 text-white hover:bg-navy-700',
    secondary: 'bg-white text-navy-700 border border-navy-200 hover:bg-navy-50',
    ghost: 'text-navy-700 hover:bg-navy-50',
    danger: 'bg-red-600 text-white hover:bg-red-700',
    subtle: 'bg-navy-50 text-navy-700 hover:bg-navy-100',
  }
  return <button className={cx(base, sizes[size], variants[variant], className)} {...props} />
}

export function Card({ className, children, ...props }) {
  return (
    <div
      className={cx('rounded-lg border border-navy-100 bg-white shadow-sm', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, actions, className }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-navy-100 px-5 py-4', className)}>
      <div>
        <h2 className="text-lg font-semibold text-navy-800">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Badge({ tone = 'gray', children }) {
  const tones = {
    gray: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-800',
    red: 'bg-red-100 text-red-800',
    amber: 'bg-amber-100 text-amber-800',
    navy: 'bg-navy-100 text-navy-800',
    blue: 'bg-sky-100 text-sky-800',
  }
  return (
    <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  )
}

export const Input = forwardRef(function Input({ className, label, error, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <input
        ref={ref}
        className={cx(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500',
          error && 'border-red-400',
          className,
        )}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  )
})

export const Textarea = forwardRef(function Textarea({ className, label, rows = 4, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        ref={ref}
        rows={rows}
        className={cx(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500',
          className,
        )}
        {...props}
      />
    </label>
  )
})

export function Select({ className, label, children, ...props }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        className={cx(
          'w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-navy-500 focus:outline-none focus:ring-1 focus:ring-navy-500',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div
        className={cx(
          'my-8 w-full rounded-lg bg-white shadow-xl',
          wide ? 'max-w-3xl' : 'max-w-lg',
        )}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-navy-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-navy-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-navy-200 bg-white/60 px-6 py-14 text-center">
      <p className="text-base font-medium text-slate-700">{title}</p>
      {hint && <p className="mt-1 max-w-md text-sm text-slate-500">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// Message affiché quand une action est réservée à un ordinateur (mobile = vote/consultation).
export function DesktopOnly({ what = 'Cette action', onBack }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-navy-200 bg-white/70 px-6 py-14 text-center">
      <span className="text-3xl">🖥️</span>
      <p className="mt-3 text-base font-medium text-slate-700">{what} se fait depuis un ordinateur.</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">Sur mobile, vous pouvez consulter les décisions et voter. La création et la gestion se font sur PC.</p>
      {onBack && <div className="mt-4"><Button variant="secondary" onClick={onBack}>Retour</Button></div>}
    </div>
  )
}

// Progression d'un envoi de fichier. `value` entre 0 et 1.
//
// Nécessaire, pas décoratif : l'upload se compte en minutes sur une connexion
// mobile (≈0,5 Mbit/s montant mesuré → ~3 min pour 10 Mo), et sans pourcentage
// l'utilisateur conclut au plantage et recharge la page.
export function UploadProgress({ value, name }) {
  const pct = Math.round(Math.min(Math.max(value, 0), 1) * 100)
  return (
    <div className="rounded border border-navy-100 bg-navy-50/60 px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-600">
        <span className="truncate">Envoi de {name}…</span>
        <span className="shrink-0 font-medium tabular-nums text-navy-700">{pct} %</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-navy-100">
        <div className="h-full rounded-full bg-navy-600 transition-all duration-200" style={{ width: `${pct}%` }} />
      </div>
      {pct === 100 && <p className="mt-1 text-xs text-slate-400">Fichier transmis, finalisation…</p>}
    </div>
  )
}

export function Spinner({ label = 'Chargement…' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-navy-200 border-t-navy-600" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

// Money / number formatting helpers used across pages.
// `eur` est défini dans lib/format.js — les libs en ont besoin sans dépendre des
// composants — et ré-exporté ici pour que les pages gardent un import unique.
export { eur } from '../lib/format'

export const num = (n) => new Intl.NumberFormat('fr-FR').format(Number(n) || 0)
