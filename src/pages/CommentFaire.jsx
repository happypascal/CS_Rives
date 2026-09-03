import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/ProtectedRoute'
import { Card } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { parcoursPour } from '../lib/aideLogic'

// COMMENT FAIRE — les tâches qui traversent plusieurs écrans.
//
// ⚠ Écran distinct du manuel (demande de Pascal, 2026-09-03), et la distinction
// est réelle : le manuel répond à « je suis sur cet écran, que puis-je y faire ? »,
// celui-ci répond à « je dois accomplir telle chose, par où je commence ? ».
// Affecter un budget va de l'AG au projet, mener une décision va du brouillon à
// la signature — aucune entrée de menu ne pouvait les porter, et les enfouir
// dans le manuel les rendait introuvables.

export default function CommentFaire() {
  const { user, isAdmin } = useAuth()
  const role = user?.membre_role || (isAdmin ? 'president' : 'membre')
  const parcours = useMemo(() => parcoursPour(role, isAdmin), [role, isAdmin])

  // Un seul parcours ouvert à la fois : on accomplit UNE tâche.
  const [ouvert, setOuvert] = useState(null)

  return (
    <div>
      <PageHeader
        title="Comment faire"
        subtitle="Les tâches qui traversent plusieurs écrans, pas à pas et de bout en bout."
      />

      <Card className="mb-6 px-5 py-4">
        <p className="text-sm text-slate-700">
          Chacune de ces marches à suivre va d’un bout à l’autre d’une tâche réelle — affecter un
          budget voté, mener une décision jusqu’à la signature, tenir une assemblée. L’ordre des
          étapes compte : plusieurs d’entre elles deviennent irréversibles.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Vous cherchez plutôt ce qu’un écran permet de faire ?{' '}
          <Link to="/aide" className="text-navy-600 underline">Le manuel suit le menu, écran par écran.</Link>
        </p>
      </Card>

      <div className="space-y-3">
        {parcours.map((p) => {
          const estOuvert = ouvert === p.cle
          return (
            <Card key={p.cle} className="overflow-hidden">
              <button
                onClick={() => setOuvert((c) => (c === p.cle ? null : p.cle))}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-navy-50/40"
              >
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-navy-800">{p.titre}</span>
                  <span className="mt-1 block text-sm text-slate-600">{p.resume}</span>
                </span>
                <span className="mt-1 shrink-0 text-xs text-navy-400">
                  {estOuvert ? '▲' : 'voir les étapes ▼'}
                </span>
              </button>

              {estOuvert && (
                <ol className="space-y-4 border-t border-navy-100 bg-navy-50/40 px-5 py-4">
                  {p.etapes.map((e, i) => (
                    <li key={e.titre} className="flex gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-navy-700">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <p className="text-sm font-medium text-navy-800">{e.titre}</p>
                        <p className="mt-0.5 text-sm text-slate-600">{e.texte}</p>
                        {/* L'alerte porte ce qui coûte cher à ignorer : une étape
                            irréversible, un droit qui manque, une date qu'on ne
                            peut pas inventer. */}
                        {e.alerte && (
                          <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {e.alerte}
                          </p>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Les règles de vote, de quorum et de signature découlent de l’article 15 des statuts de
        l’ASL. En cas de doute, ce sont les statuts qui font foi, pas l’application.
      </p>
    </div>
  )
}
