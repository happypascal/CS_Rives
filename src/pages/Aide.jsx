import { useMemo, useState } from 'react'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { manuelPour, parcoursPour, LIMITES_COMMUNES } from '../lib/aideLogic'
import { ROLE_LABELS } from '../lib/rolesLogic'

// Manuel organisé par ENTRÉE DE MENU, filtré au rôle du lecteur.
//
// ⚠ On n'ouvre pas un manuel en se demandant « que puis-je en tant que
// trésorier ? », mais « je suis sur cet écran, comment je fais telle chose ? ».
// Le rôle ne sert donc qu'à filtrer : on ne montre que les menus et les actions
// réellement ouverts. Chaque action se déplie en pas-à-pas, repliée par défaut —
// une action qu'on sait faire ne doit pas encombrer.

export default function Aide() {
  const { user, isAdmin } = useAuth()
  const role = user?.membre_role || (isAdmin ? 'president' : 'membre')
  const menus = useMemo(() => manuelPour(role, isAdmin), [role, isAdmin])
  const parcours = useMemo(() => parcoursPour(role, isAdmin), [role, isAdmin])

  // Une seule action ouverte à la fois : on cherche à faire UNE chose.
  const [ouverte, setOuverte] = useState(null)
  const basculer = (cle) => setOuverte((c) => (c === cle ? null : cle))

  return (
    <div>
      <PageHeader
        title="Manuel"
        subtitle={`Ce que vous pouvez faire dans l’application, écran par écran, comme ${ROLE_LABELS[role] || 'Membre'}.`}
      />

      <Card className="mb-6 px-5 py-4">
        <p className="text-sm text-slate-700">
          Le manuel suit le menu de gauche. Pour chaque écran, les actions qui vous sont ouvertes —
          cliquez sur l’une d’elles pour voir la marche à suivre.
        </p>
      </Card>

      {/* Les parcours d'abord : ils traversent plusieurs écrans et répondent à
          une tâche entière, pas à un bouton. */}
      {parcours.map((p) => {
        const cle = `parcours-${p.cle}`
        const ouvert = ouverte === cle
        return (
          <Card key={cle} className="mb-6 overflow-hidden border-navy-200">
            <button
              onClick={() => basculer(cle)}
              className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-navy-50/40"
            >
              <span className="min-w-0">
                <span className="block text-base font-semibold text-navy-800">{p.titre}</span>
                <span className="mt-1 block text-sm text-slate-600">{p.resume}</span>
              </span>
              <span className="mt-1 shrink-0 text-navy-400">{ouvert ? '▲' : '▼'}</span>
            </button>
            {ouvert && (
              <ol className="space-y-4 border-t border-navy-100 px-5 py-4">
                {p.etapes.map((e, i) => (
                  <li key={e.titre} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <p className="text-sm font-medium text-navy-800">{e.titre}</p>
                      <p className="mt-0.5 text-sm text-slate-600">{e.texte}</p>
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

      <div className="space-y-6">
        {menus.map((m) => (
          <Card key={m.cle} className="overflow-hidden">
            <CardHeader title={m.menu} subtitle={m.aQuoi} />
            <ul className="divide-y divide-navy-50">
              {m.actions.map((a) => {
                const cle = `${m.cle}-${a.titre}`
                const ouvert = ouverte === cle
                return (
                  <li key={cle}>
                    <button
                      onClick={() => basculer(cle)}
                      className="flex w-full items-start justify-between gap-4 px-5 py-3 text-left hover:bg-navy-50/40"
                    >
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-navy-800">{a.titre}</span>
                        {a.resume && (
                          <span className="mt-0.5 block text-xs text-slate-500">{a.resume}</span>
                        )}
                      </span>
                      <span className="mt-0.5 shrink-0 text-xs text-navy-400">
                        {ouvert ? '▲' : 'comment faire ▼'}
                      </span>
                    </button>

                    {ouvert && (
                      <div className="bg-navy-50/40 px-5 py-4">
                        <ol className="space-y-2">
                          {a.etapes.map((etape, i) => (
                            <li key={etape} className="flex gap-3">
                              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-navy-700">
                                {i + 1}
                              </span>
                              <span className="text-sm text-slate-700">{etape}</span>
                            </li>
                          ))}
                        </ol>
                        {a.alerte && (
                          <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {a.alerte}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {/* ⚠ Pas de liste grisée des actions interdites : elle encombrait
                sans rien expliquer. Une phrase dit ce qu'on peut faire ici et
                pourquoi le reste est réservé — et n'apparaît que si le lecteur
                y est effectivement bridé. */}
            {m.note && (
              <p className="border-t border-navy-50 bg-slate-50 px-5 py-3 text-xs text-slate-600">
                {m.note}
              </p>
            )}
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Ce que personne ne peut faire"
          subtitle="Des limites voulues, que l’on prend souvent pour des pannes."
        />
        <ul className="space-y-3 px-5 py-4">
          {LIMITES_COMMUNES.map((item) => (
            <li key={item.titre} className="border-l-2 border-slate-200 pl-3">
              <p className="text-sm font-medium text-slate-700">{item.titre}</p>
              <p className="mt-0.5 text-sm text-slate-600">{item.texte}</p>
            </li>
          ))}
        </ul>
      </Card>

      <p className="mt-6 text-xs text-slate-400">
        Les règles de vote, de quorum et de signature découlent de l’article 15 des statuts de
        l’ASL. En cas de doute, ce sont les statuts qui font foi, pas l’application.
      </p>
    </div>
  )
}
