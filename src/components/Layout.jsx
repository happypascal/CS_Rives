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

// ⚠ Le menu était une liste plate de dix entrées, dans laquelle on cherchait au
// lieu de choisir. Trois sections le rendent parcourable, et l'ordre porte du
// sens : ce qu'on FAIT, ce qu'on TIENT, puis l'outil lui-même.
//
// `visible` reproduit les droits réels : Signatures et Registre des propriétaires
// ne s'affichent qu'au président et au secrétaire. ⚠ Ce filtrage est répliqué
// dans `src/lib/aideLogic.js` (le manuel ne doit jamais décrire un écran que le
// lecteur ne voit pas) — modifier l'un oblige à modifier l'autre.
const SECTIONS = [
  {
    titre: 'Gestion',
    items: [
      { to: '/projets', label: 'Projets' },
      { to: '/ag', label: 'Assemblées Générales' },
      { to: '/budgets', label: 'Budgets' },
      { to: '/signatures', label: 'Signatures légales', visible: (a) => a.isAdmin || a.isSecretaire },
      // ⚠ Annoncé mais PAS ENCORE CONSTRUIT : l'envoi groupé aux colotis attend
      // l'adresse de l'ASL et un service d'envoi (cf. docs/ETAT_COURANT.md). On
      // le montre grisé plutôt que de le taire — l'entrée dit où la fonction
      // arrivera, et évite qu'on la cherche ailleurs. Réservé au bureau, comme le
      // registre dont il tirera les adresses.
      { label: 'Messages aux propriétaires', bientot: true, visible: (a) => a.isAdmin || a.isSecretaire },
    ],
  },
  {
    titre: 'Données',
    items: [
      { to: '/proprietaires', label: 'Registre des propriétaires', visible: (a) => a.isAdmin || a.isSecretaire },
      { to: '/membres', label: 'Membres du CS' },
      { to: '/memoire', label: 'Mémoire de l’ASL' },
    ],
  },
  {
    titre: 'Application',
    items: [
      { to: '/comment-faire', label: 'Comment faire' },
      { to: '/aide', label: 'Manuel d’utilisation' },
      { to: '/parametres', label: 'Paramètres' },
    ],
  },
]

// Maison pour le tableau de bord. En SVG inline : le projet n'a aucune
// bibliothèque d'icônes, et en ajouter une pour un pictogramme serait cher payé.
function IconeMaison({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
         strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </svg>
  )
}

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
      'block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
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
      <aside className="flex flex-col bg-navy-800 md:sticky md:top-0 md:h-screen md:w-72 md:shrink-0 md:self-start md:overflow-y-auto">
        <div className="flex items-center justify-between gap-2 px-4 py-4">
          {/* Le tableau de bord passe du menu à une icône : c'est un point de
              départ, pas une rubrique — et cela retire une ligne d'un menu qui
              en avait dix. */}
          <NavLink
            to="/tableau-de-bord"
            onClick={() => setMenuOpen(false)}
            title="Tableau de bord"
            aria-label="Tableau de bord"
            className={({ isActive }) =>
              `-ml-1 rounded-md p-2 transition-colors ${
                isActive ? 'bg-navy-600 text-white' : 'text-navy-200 hover:bg-navy-700/60 hover:text-white'
              }`
            }
          >
            <IconeMaison className="h-5 w-5" />
          </NavLink>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold tracking-tight text-white">ASL Rives</p>
            <p className="truncate text-xs text-navy-300">{ORG.commune}</p>
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
          {SECTIONS.map((section) => {
            const items = section.items.filter(
              (item) => !item.visible || item.visible({ isAdmin, isSecretaire }),
            )
            // Une section dont tout est masqué ne doit pas laisser son titre
            // seul : un intertitre sans rien dessous ressemble à une panne.
            if (items.length === 0) return null
            return (
              <div key={section.titre}>
                <div className="my-3 flex items-center gap-2 px-1">
                  <span className="h-px flex-1 bg-navy-600" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-navy-400">
                    {section.titre}
                  </span>
                  <span className="h-px flex-1 bg-navy-600" />
                </div>
                <div className="space-y-1">
                  {items.map((item) =>
                    item.bientot ? (
                      // Grisé et non cliquable : l'entrée annonce où la fonction
                      // arrivera, sans faire croire qu'elle existe.
                      <span
                        key={item.label}
                        title="À venir : nécessite l’adresse de l’ASL et un service d’envoi."
                        className="flex cursor-not-allowed items-center justify-between gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-navy-400/70"
                      >
                        {item.label}
                        <span className="text-[10px] uppercase tracking-wide">à venir</span>
                      </span>
                    ) : (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        className={linkClass}
                        onClick={() => setMenuOpen(false)}
                      >
                        {item.label}
                      </NavLink>
                    ),
                  )}
                </div>
              </div>
            )
          })}
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
