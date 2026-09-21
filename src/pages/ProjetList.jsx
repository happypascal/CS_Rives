import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Spinner, EmptyState, eur } from '../components/ui'
import { ProjetStatutBadge } from '../components/badges'
import { formatDate } from '../lib/format'
import { useIsMobile } from '../lib/useIsMobile'

export default function ProjetList() {
  const isMobile = useIsMobile()
  // Tout membre peut créer un projet et en devenir owner (desktop). L'ancienne
  // garde président (isAdmin) est levée — création ouverte, modification réservée
  // à l'owner sur la fiche (RLS projets_owner_*, migration 013).
  const canCreate = !isMobile
  const [loading, setLoading] = useState(true)
  const [projets, setProjets] = useState([])

  useEffect(() => {
    repo
      .listProjets()
      .then((p) => setProjets(p))
      .catch(() => setProjets([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Projets"
        subtitle="Chantiers du lotissement : équipe, documents, décisions et budget."
        actions={canCreate && <Link to="/projets/nouveau"><Button>+ Nouveau projet</Button></Link>}
      />
      {projets.length === 0 ? (
        <EmptyState
          title="Aucun projet"
          hint="Crée un projet ; son budget viendra d’une résolution d’AG rattachée ensuite."
          action={canCreate && <Link to="/projets/nouveau"><Button>Créer un projet</Button></Link>}
        />
      ) : isMobile ? (
        /* Mobile : une carte par projet. Le tableau à 8 colonnes faisait 781 px
           dans un écran de 390 : « Statut », « Alloué », « Engagé » et « Restant »
           tombaient hors du cadre, et rien ne signalait qu'il fallait faire défiler
           le tableau latéralement — soit exactement ce qu'on vient consulter.
           Même hiérarchie que le tableau : le nom, puis l'équipe et les dates, puis
           l'argent sur une ligne à trois montants. */
        <ul className="space-y-3">
          {projets.map((p) => (
            <li key={p.id}>
              <Link
                to={`/projets/${p.id}`}
                className="block rounded-lg border border-navy-100 bg-white p-4 shadow-sm active:bg-navy-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy-800">{p.nom}</p>
                  <ProjetStatutBadge statut={p.statut} />
                </div>
                {p.ags?.length > 0 && <p className="mt-0.5 text-xs text-slate-400">{p.ags.map((a) => a.numero).join(' · ')}</p>}
                <p className="mt-1 text-xs text-slate-500">
                  {p.chef_nom || 'Chef non désigné'}
                  {p.adjoint_nom && ` · adjoint : ${p.adjoint_nom}`}
                </p>
                {/* ⚠ Pas de « du … au — » : une date de clôture vide est le cas
                    NORMAL d'un projet en cours (cf. le commentaire du tableau),
                    et un tiret en fin de phrase se lit comme une donnée manquante. */}
                <p className="mt-0.5 text-xs text-slate-500">
                  {p.date_cloture
                    ? `Du ${formatDate(p.date_ouverture)} au ${formatDate(p.date_cloture)}`
                    : `Depuis le ${formatDate(p.date_ouverture)}`}
                </p>
                {/* Les trois montants tiennent sur une ligne et gardent leurs
                    couleurs du tableau : le restant est ce qu'on vient vérifier. */}
                <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                  <span className="text-slate-500">Alloué <span className="font-medium text-slate-700">{eur(p.alloue)}</span></span>
                  <span className="text-slate-500">Engagé <span className="font-medium text-amber-700">{eur(p.engage)}</span></span>
                  <span className="text-slate-500">Restant <span className={`font-medium ${p.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(p.restant)}</span></span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Projet</th>
                  <th className="px-4 py-2.5 font-medium">Chef et adjoint</th>
                  <th className="px-4 py-2.5 font-medium">Début</th>
                  <th className="px-4 py-2.5 font-medium">Fin</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                  <th className="px-4 py-2.5 text-right font-medium">Alloué</th>
                  <th className="px-4 py-2.5 text-right font-medium">Engagé</th>
                  <th className="px-4 py-2.5 text-right font-medium">Restant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {projets.map((p) => (
                  <tr key={p.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/projets/${p.id}`} className="font-medium text-navy-700 hover:underline">{p.nom}</Link>
                      {/* Autant d'AG que de résolutions le finançant : un projet
                          pluriannuel en affiche plusieurs. */}
                      {p.ags?.length > 0 && <span className="block text-xs text-slate-400">{p.ags.map((a) => a.numero).join(' · ')}</span>}
                    </td>
                    {/* L'adjoint (migration 028) sous le chef plutôt qu'en
                        colonne à part : il a les mêmes droits mais reste
                        facultatif, et une 7e colonne vide sur la plupart des
                        lignes coûterait de la largeur pour rien. Affiché
                        seulement s'il existe — le cas normal est un projet mené
                        seul, « — aucun — » sur chaque ligne serait du bruit. */}
                    <td className="px-4 py-3 text-slate-600">
                      {p.chef_nom || '—'}
                      {p.adjoint_nom && (
                        <span className="block text-xs text-slate-400">adjoint : {p.adjoint_nom}</span>
                      )}
                    </td>
                    {/* `formatDate` rend « — » sur une valeur absente : une date
                        de fin vide est le cas NORMAL d'un projet en cours, pas
                        une donnée manquante. */}
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(p.date_ouverture)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(p.date_cloture)}</td>
                    <td className="px-4 py-3"><ProjetStatutBadge statut={p.statut} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">{eur(p.alloue)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-amber-700">{eur(p.engage)}</td>
                    <td className={`whitespace-nowrap px-4 py-3 text-right font-medium ${p.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(p.restant)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
