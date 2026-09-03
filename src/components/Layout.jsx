import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import { BACKEND } from '../lib/config'
import { ORG } from '../lib/config'
import ForcePasswordChange from '../pages/ForcePasswordChange'
import { ROLE_LABELS } from '../lib/rolesLogic'
import { useActivityNotifications } from '../lib/useActivityNotifications'
import { useOuvertureAutomatique } from '../lib/useOuvertureAutomatique'

// Cœur de l'app, mis en avant et séparé du reste.
const NAV_PRIMARY = [{ to: '/registre', label: 'Décisions CS' }]
const NAV = [
  { to: '/tableau-de-bord', label: 'Tableau de bord' },
  { to: '/ag', label: 'Assemblées Générales' },
  { to: '/projets', label: 'Projets' },
  { to: '/budgets', label: 'Budgets' },
  // La mémoire du lotissement : le POURQUOI des dossiers, que ni le registre des
  // décisions ni les projets ne portent. Ouverte à tous les membres — c'est
  // l'inverse du registre des propriétaires, et c'est voulu.
  { to: '/memoire', label: 'Mémoire' },
  // Signature du registre : président OU secrétaire (art. 14/15). Masquée pour
  // les autres membres — la page elle-même redouble la garde.
  { to: '/signatures', label: 'Signatures', visible: (a) => a.isAdmin || a.isSecretaire },
  { to: '/membres', label: 'Membres du CS' },
  // Registre des propriétaires : masqué aux autres membres (données
  // personnelles de tiers). Le masquage est un confort — la RLS ferme.
  { to: '/proprietaires', label: 'Propriétaires', visible: (a) => a.isAdmin || a.isSecretaire },
  { to: '/parametres', label: 'Paramètres' },
  // Manuel par rôle. Ouvert à tous, y compris aux rôles qui n'ont accès qu'à
  // une partie des écrans : savoir ce que le président peut faire — et ce qu'il
  // ne peut PAS faire — évite la moitié des malentendus d'un conseil.
  { to: '/aide', label: 'Manuel' },
]

export default function Layout() {
  const { user, isAdmin, isSecretaire, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  // Notifications de bureau (président/secrétaire) : sondage 30 s des nouveaux
  // votes/questions tant que l'app est ouverte. Activation dans Paramètres.
  useActivityNotifications()
  // Filet de l'ouverture automatique des décisions planifiées (migration 026) :
  // pg_cron reste le planificateur, ceci garantit qu'un cron non activé ne fasse
  // pas qu'une décision planifiée ne s'ouvre jamais, en silence.
  useOuvertureAutomatique()

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
      {/* Barre de navigation FIGÉE au défilement (desktop). `self-start` est
          indispensable : dans un conteneur flex, un enfant est étiré à la
          hauteur du conteneur par défaut, et un élément aussi haut que ce qu'il
          doit suivre ne colle jamais. D'où self-start + h-screen + sticky top-0.
          `overflow-y-auto` garde le menu atteignable si la fenêtre est courte.
          Rien de tout cela en mobile : le menu y est un panneau qu'on déplie. */}
      <aside className="flex flex-col bg-navy-800 md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:self-start md:overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-4 md:block">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-navy-200">Registre des décisions</p>
            <p className="mt-0.5 text-xs text-navy-300">{ORG.lotissement}, {ORG.commune}</p>
          </div>
          <button
            className="-m-2 p-2 text-4xl leading-none text-navy-100 md:hidden"
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
            {NAV.filter((item) => !item.visible || item.visible({ isAdmin, isSecretaire })).map((item) => (
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
          {/* Affiche le rôle réel du bureau (membre_role), pas un simple
              admin/membre — sert aussi de diagnostic : « Secrétaire » ici = le
              rôle est bien chargé et isSecretaire est vrai. */}
          <p className="text-xs text-navy-300">{ROLE_LABELS[user?.membre_role] || 'Membre'}</p>
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
