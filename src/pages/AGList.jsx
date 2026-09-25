import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Spinner, EmptyState, Badge } from '../components/ui'
import { AGStatutBadge } from '../components/badges'
import { effectiveAGStatut } from '../lib/agLogic'
import { formatDate } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

export default function AGList() {
  const { isAdmin, isSecretaire } = useAuth()
  const isMobile = useIsMobile()
  // Président ou secrétaire (point 5).
  const canManage = (isAdmin || isSecretaire) && !isMobile
  const [loading, setLoading] = useState(true)
  const [ags, setAgs] = useState([])

  useEffect(() => {
    repo.listAG().then((data) => {
      setAgs(data)
      setLoading(false)
    })
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Assemblées Générales"
        subtitle="AGO / AGE — résolutions et budgets votés par les colotis."
        actions={
          <>
            {/* ⚠ LES ARCHIVES SE REJOIGNENT D'ICI, pas par le menu (arbitrage
                Pascal, 2026-09-25) : on ne cherche pas le PV de 1978 en
                parcourant un menu, on le cherche en pensant aux assemblées. En
                entrée de menu distincte, le fonds devenait un second registre
                concurrent du premier.
                ⚠ Ouvert à TOUS, y compris à qui ne peut pas créer d'AG : c'est
                une consultation, pas une gestion — d'où sa place hors du test
                `canManage`. */}
            <Link to="/ag/archives">
              <Button variant="secondary">Archives des PV depuis 1955</Button>
            </Link>
            {canManage && <Link to="/ag/nouvelle"><Button>+ Nouvelle AG</Button></Link>}
          </>
        }
      />
      {ags.length === 0 ? (
        <EmptyState title="Aucune AG" hint="Créez la première assemblée générale." action={canManage && <Link to="/ag/nouvelle"><Button>Créer une AG</Button></Link>} />
      ) : isMobile ? (
        /* Mobile : une carte par assemblée. Le tableau tenait à 40 px près, et
           c'est « Statut » qui tombait — la seule colonne qui n'est pas déjà dans
           le numéro. Un état invisible vaut un état faux. */
        <ul className="space-y-3">
          {ags.map((ag) => (
            <li key={ag.id}>
              <Link
                to={`/ag/${ag.id}`}
                className="block rounded-lg border border-navy-100 bg-white p-4 shadow-sm active:bg-navy-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy-800">{ag.numero}</p>
                  <AGStatutBadge statut={effectiveAGStatut(ag)} />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <Badge tone={ag.type === 'AGO' ? 'navy' : 'blue'}>{ag.type}</Badge>
                  <span>{formatDate(ag.date_ag)}</span>
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
                  <th className="px-4 py-2.5 font-medium">Numéro</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {ags.map((ag) => (
                  <tr key={ag.id} className="hover:bg-navy-50/40">
                    <td className="px-4 py-3">
                      <Link to={`/ag/${ag.id}`} className="font-medium text-navy-700 hover:underline">{ag.numero}</Link>
                    </td>
                    <td className="px-4 py-3"><Badge tone={ag.type === 'AGO' ? 'navy' : 'blue'}>{ag.type}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(ag.date_ag)}</td>
                    <td className="px-4 py-3"><AGStatutBadge statut={effectiveAGStatut(ag)} /></td>
                    {/* Pas de colonne « Quorum » pour les AG : l'app ne compte pas les
                        voix d'AG (prorata des superficies, comptées dans le PV, cf.
                        agLogic.js). `assemblees_generales` n'a d'ailleurs pas de champ
                        quorum_atteint — l'ancienne cellule lisait donc `undefined`, ratait
                        son test `=== null` et affichait un « Non atteint » rouge factice sur
                        des AG validement tenues. Un registre légal ne montre pas une donnée
                        qu'il ne détient pas. */}
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
