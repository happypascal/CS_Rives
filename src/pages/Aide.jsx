import { useState } from 'react'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Badge } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { MANUEL, LIMITES_COMMUNES, ROLE_TOUS } from '../lib/aideLogic'
import { ROLE_LABELS } from '../lib/rolesLogic'

// Manuel de l'utilisateur, par rôle.
//
// ⚠ Le bloc du rôle du lecteur est OUVERT d'emblée, les autres repliés. Un
// arrivant doit trouver ce qui le concerne sans lire le reste ; mais les autres
// rôles restent consultables, parce que savoir ce que le président peut faire —
// et ce qu'il ne peut PAS faire — évite la moitié des malentendus d'un conseil.

export default function Aide() {
  const { user, isAdmin } = useAuth()
  // `membre_role` porte le rôle réel du bureau. Un président sans rôle chargé
  // reste identifié par `isAdmin` : mieux vaut ouvrir le bon bloc que le socle.
  const roleLecteur = user?.membre_role || (isAdmin ? 'president' : 'membre')
  const [ouverts, setOuverts] = useState(() => new Set([ROLE_TOUS, roleLecteur]))

  const basculer = (cle) =>
    setOuverts((s) => {
      const suivant = new Set(s)
      if (suivant.has(cle)) suivant.delete(cle)
      else suivant.add(cle)
      return suivant
    })

  return (
    <div>
      <PageHeader
        title="Manuel de l’utilisateur"
        subtitle="Ce que chacun peut faire dans le registre, et ce que personne ne peut faire."
      />

      <Card className="mb-6 px-5 py-4">
        <p className="text-sm text-slate-700">
          Vous êtes connecté comme <strong>{ROLE_LABELS[roleLecteur] || 'Membre'}</strong>.
          Le bloc qui vous concerne est ouvert ci-dessous, avec celui qui vaut pour tout le monde.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Ce manuel décrit le fonctionnement réel de l’application, y compris ses limites
          volontaires. Quand une action semble manquer, il y a de fortes chances qu’elle soit
          décrite ici comme impossible — et que la raison en soit donnée.
        </p>
      </Card>

      <div className="space-y-4">
        {MANUEL.map((bloc) => {
          const ouvert = ouverts.has(bloc.cle)
          const estLeSien = bloc.cle === roleLecteur
          return (
            <Card key={bloc.cle} className="overflow-hidden">
              <button
                onClick={() => basculer(bloc.cle)}
                className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left hover:bg-navy-50/40"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-semibold text-navy-800">{bloc.titre}</span>
                    {estLeSien && <Badge tone="navy">votre rôle</Badge>}
                  </span>
                  <span className="mt-1 block text-sm text-slate-600">{bloc.resume}</span>
                </span>
                <span className="mt-1 shrink-0 text-navy-400">{ouvert ? '▲' : '▼'}</span>
              </button>

              {ouvert && (
                <div className="border-t border-navy-100 px-5 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Ce qui est possible
                  </p>
                  <ul className="space-y-4">
                    {bloc.peut.map((item) => (
                      <li key={item.titre}>
                        <p className="text-sm font-medium text-navy-800">{item.titre}</p>
                        <p className="mt-0.5 text-sm text-slate-600">{item.texte}</p>
                        {/* L'alerte porte ce qui coûte cher à ignorer :
                            l'irréversibilité de l'acte, le pouvoir réel du
                            trésorier, la responsabilité RGPD du secrétaire. */}
                        {item.alerte && (
                          <p className="mt-1 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                            {item.alerte}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {bloc.nePeutPas?.length > 0 && (
                    <>
                      <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Ce qui n’est pas possible, et pourquoi
                      </p>
                      <ul className="space-y-3">
                        {bloc.nePeutPas.map((item) => (
                          <li key={item.titre} className="border-l-2 border-slate-200 pl-3">
                            <p className="text-sm font-medium text-slate-700">{item.titre}</p>
                            <p className="mt-0.5 text-sm text-slate-600">{item.texte}</p>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Ce que personne ne peut faire"
          subtitle="Des limites qui ne dépendent d’aucun rôle, et que l’on prend souvent pour des pannes."
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
