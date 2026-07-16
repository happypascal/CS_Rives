import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { Spinner } from './ui'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

// Les boutons d'action sont IMMUABLES : leur place ne dépend pas de la longueur
// du titre. `min-w-0` autorise le titre à se réduire (sans lui, un flex item ne
// passe jamais sous la largeur de son contenu et pousse ses voisins), `shrink-0`
// fige les actions. Un titre long s'enroule sur plusieurs lignes au lieu de
// chasser les boutons hors de leur position.
export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold text-navy-800">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
