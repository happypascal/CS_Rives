import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { repo } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { BACKEND } from '../lib/config'
import { ORG } from '../lib/config'
import ForcePasswordChange from '../pages/ForcePasswordChange'
import { ROLE_LABELS } from '../lib/rolesLogic'
import { useActivityNotifications } from '../lib/useActivityNotifications'
import { useOuvertureAutomatique } from '../lib/useOuvertureAutomatique'

// ⚠ COORDONNÉES DU GESTIONNAIRE, en haut de la barre (demande de Pascal,
// 2026-09-21). Le syndic est l'interlocuteur qu'on cherche le plus souvent et
// qu'on retrouve le moins vite : son nom vit dans un mail, sa ligne directe sur
// un papier. Les mettre sous les yeux, sur chaque écran, c'est supprimer une
// recherche qui revient toutes les semaines.
//
// ⚠ En PARAMÈTRES et non en dur : le gestionnaire change — la convention Foncia
// court du 1er janvier au 31 décembre 2027, et un changement de syndic est au
// backlog. Un nom codé dans le source survivrait à la personne.
const CLES_GESTIONNAIRE = ['gestionnaire_societe', 'gestionnaire_nom', 'gestionnaire_email', 'gestionnaire_telephone']

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
      // ⚠ « Messages aux propriétaires » A ÉTÉ RETIRÉ D'ICI (056). C'était une
      // entrée grisée qui annonçait l'envoi groupé à venir. Maintenant qu'il
      // existe « Envois aux colotis » dans la section Données, deux entrées aux
      // noms voisins — dont une morte — désorientent au lieu de guider : on ne
      // saurait plus laquelle regarder. L'envoi DEPUIS l'application reste à
      // faire (phase 2), et c'est l'écran des envois qui le dit, à sa place.
    ],
  },
  {
    titre: 'Données',
    items: [
      { to: '/proprietaires', label: 'Registre des propriétaires', visible: (a) => a.isAdmin || a.isSecretaire },
      // ⚠ Ouvert à TOUS, contrairement au registre des propriétaires juste
      // au-dessus : ce qu'on y lit est un acte de gestion et le texte d'un
      // message déjà adressé à cinquante-cinq personnes. Seule la liste
      // nominative des destinataires est fermée, sur la fiche elle-même.
      { to: '/envois', label: 'Envois aux colotis' },
      { to: '/membres', label: 'Membres du CS' },
      { to: '/memoire', label: 'Mémoire de l’ASL' },
      // ⚠ PAS D'ENTRÉE « Archives des PV » ICI (arbitrage Pascal, 2026-09-25).
      // Elle y a figuré une journée. Le fonds se rejoint par un BOUTON en tête
      // de l'écran Assemblées Générales : on ne cherche pas le PV de 1978 en
      // parcourant un menu, on le cherche en pensant aux assemblées. Une entrée
      // de menu distincte en faisait un second registre, concurrent du premier.
      // ⚠ La route `/ag/archives` existe toujours — c'est le CHEMIN D'ACCÈS qui
      // change, pas l'écran.
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
  // Chargé une fois : le Layout est la coquille, il ne se remonte pas à chaque
  // navigation. Échec silencieux — une barre latérale sans le gestionnaire
  // reste utilisable, une barre qui plante ne l'est pas.
  const [gestionnaire, setGestionnaire] = useState(null)
  useEffect(() => {
    repo.getParametres()
      .then((p) => setGestionnaire(Object.fromEntries(CLES_GESTIONNAIRE.map((c) => [c, p[c] || '']))))
      .catch(() => setGestionnaire(null))
  }, [])
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
        {/* Coordonnées du gestionnaire. Repliées avec le menu sur mobile, pour ne
            pas manger l'écran quand la barre est fermée. */}
        {gestionnaire && (gestionnaire.gestionnaire_nom || gestionnaire.gestionnaire_societe) && (
          <div className={`${menuOpen ? 'block' : 'hidden'} mx-3 mb-3 rounded-md bg-navy-700/50 px-3 py-2 md:block`}>
            <p className="text-[0.65rem] uppercase tracking-wide text-navy-400">Gestionnaire</p>
            {gestionnaire.gestionnaire_nom && (
              <p className="truncate text-sm font-medium text-white">{gestionnaire.gestionnaire_nom}</p>
            )}
            {gestionnaire.gestionnaire_societe && (
              <p className="truncate text-xs text-navy-300">{gestionnaire.gestionnaire_societe}</p>
            )}
            {/* ⚠ De vrais liens `mailto:` et `tel:` : sur mobile, appeler le
                syndic depuis la fiche est le geste le plus fréquent, et recopier
                un numéro à la main est ce qu'on fait quand l'application ne le
                fait pas pour nous. */}
            {gestionnaire.gestionnaire_email && (
              <a href={`mailto:${gestionnaire.gestionnaire_email}`} className="mt-1 block truncate text-xs text-navy-200 underline hover:text-white">
                {gestionnaire.gestionnaire_email}
              </a>
            )}
            {gestionnaire.gestionnaire_telephone && (
              <a href={`tel:${gestionnaire.gestionnaire_telephone.replace(/[^+0-9]/g, '')}`} className="block truncate text-xs text-navy-200 underline hover:text-white">
                {gestionnaire.gestionnaire_telephone}
              </a>
            )}
          </div>
        )}
        {/* Rien de renseigné : on ne le dit qu'à celui qui peut le corriger. Un
            membre ordinaire n'a pas à lire un rappel qui ne le concerne pas. */}
        {gestionnaire && !gestionnaire.gestionnaire_nom && !gestionnaire.gestionnaire_societe && isAdmin && (
          <NavLink
            to="/parametres"
            onClick={() => setMenuOpen(false)}
            className={`${menuOpen ? 'block' : 'hidden'} mx-3 mb-3 rounded-md border border-dashed border-navy-600 px-3 py-2 text-xs text-navy-300 hover:text-white md:block`}
          >
            Gestionnaire — à renseigner
          </NavLink>
        )}
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
                  {/* ⚠ Le rendu « à venir » (entrée grisée, non cliquable) a été
                      retiré avec sa dernière entrée, en 056 : une branche que
                      plus rien n'emprunte finit par mentir sur ce que l'écran
                      sait faire. Elle se réécrira le jour où une entrée en aura
                      de nouveau besoin. */}
                  {items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={linkClass}
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  ))}
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
