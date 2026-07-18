import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Spinner, EmptyState, Badge } from '../components/ui'
import { AGStatutBadge } from '../components/badges'
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
        actions={canManage && <Link to="/ag/nouvelle"><Button>+ Nouvelle AG</Button></Link>}
      />
      {ags.length === 0 ? (
        <EmptyState title="Aucune AG" hint="Créez la première assemblée générale." action={canManage && <Link to="/ag/nouvelle"><Button>Créer une AG</Button></Link>} />
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
                  <th className="px-4 py-2.5 font-medium">Quorum</th>
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
                    <td className="px-4 py-3"><AGStatutBadge statut={ag.statut} /></td>
                    <td className="px-4 py-3">
                      {ag.quorum_atteint === null ? (
                        <span className="text-xs text-slate-400">—</span>
                      ) : (
                        <Badge tone={ag.quorum_atteint ? 'green' : 'red'}>{ag.quorum_atteint ? 'Atteint' : 'Non atteint'}</Badge>
                      )}
                    </td>
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
