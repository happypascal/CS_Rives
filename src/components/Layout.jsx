import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { BACKEND } from '../lib/config'
import { ORG } from '../lib/config'
import ForcePasswordChange from '../pages/ForcePasswordChange'

// Cœur de l'app, mis en avant et séparé du reste.
const NAV_PRIMARY = [{ to: '/registre', label: 'Décisions CS' }]
const NAV = [
  { to: '/tableau-de-bord', label: 'Tableau de bord' },
  { to: '/ag', label: 'Assemblées Générales' },
  { to: '/projets', label: 'Projets' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/membres', label: 'Membres du CS' },
  { to: '/parametres', label: 'Paramètres' },
]

export default function Layout() {
  const { user, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const linkClass = ({ isActive }) =>
    [
      'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-navy-600 text-white' : 'text-navy-100 hover:bg-navy-700/60 hover:text-white',
    ].join(' ')

  // 1er accès (prod) : un membre non-admin doit définir son mot de passe avant d'entrer.
  if (BACKEND === 'supabase' && user && !isAdmin && user.password_changed !== true) {
    return <ForcePasswordChange />
  }

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="flex flex-col bg-navy-800 md:w-64 md:shrink-0">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-navy-200">Registre des décisions</p>
            <p className="mt-0.5 text-xs text-navy-300">{ORG.lotissement}, {ORG.commune}</p>
          </div>
          <button
            className="text-navy-100 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
        <nav className={`${menuOpen ? 'block' : 'hidden'} px-3 pb-4 md:block`}>
          {NAV_PRIMARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                [
                  'block rounded-md px-3 py-3 text-lg font-bold tracking-tight transition-colors',
                  isActive ? 'bg-navy-600 text-white' : 'text-white hover:bg-navy-700/60',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
          <div className="my-3 flex items-center gap-2 px-1">
            <span className="h-px flex-1 bg-navy-600" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-navy-400">Gestion</span>
            <span className="h-px flex-1 bg-navy-600" />
          </div>
          <div className="space-y-1">
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} onClick={() => setMenuOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>
        <div className="mt-auto hidden border-t border-navy-700 px-4 py-4 md:block">
          {BACKEND === 'mock' && (
            <p className="mb-2 rounded bg-amber-500/20 px-2 py-1 text-[11px] leading-tight text-amber-200">
              Mode démo (données locales)
            </p>
          )}
          <p className="truncate text-sm text-white">{user?.prenom} {user?.nom}</p>
          <p className="text-xs text-navy-300">{isAdmin ? 'Président (admin)' : 'Membre'}</p>
          <button onClick={handleSignOut} className="mt-2 text-xs text-navy-200 underline hover:text-white">
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-navy-100 bg-white px-6 py-3 md:hidden">
          <span className="text-sm font-semibold text-navy-800">Décisions CS — Rives</span>
          <button onClick={handleSignOut} className="text-xs text-navy-600 underline">
            Déconnexion
          </button>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
