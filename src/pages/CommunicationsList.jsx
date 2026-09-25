import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Spinner, EmptyState, Badge } from '../components/ui'
import { formatDateTime } from '../lib/format'
import { useIsMobile } from '../lib/useIsMobile'
import { CANAL_LABELS, FIABILITE_LABELS, FIABILITE_TONES, estReconstituee } from '../lib/communicationLogic'

// HISTORIQUE DES ENVOIS AUX COLOTIS (migration 056).
//
// ⚠ CET ÉCRAN N'ENVOIE RIEN. Les messages partent d'un AppleScript, depuis Mail,
// sur un poste ; le registre en garde la trace parce que convoquer, relancer et
// informer sont des actes de gestion. La phase 2 fera partir les envois d'ici —
// d'ici là, promettre un bouton d'envoi serait un mensonge d'interface.
//
// ⚠ Les lignes sont écrites par `scripts/importer_envois.mjs`, jamais à la main :
// une campagne saisie dans l'application ne prouverait pas qu'un message est
// parti. Seul le commentaire est modifiable, sur la fiche.

export default function CommunicationsList() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [envois, setEnvois] = useState([])

  useEffect(() => {
    repo.listCommunications()
      .then(setEnvois)
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Envois aux colotis"
        subtitle="Ce qui a été adressé aux propriétaires : le texte exact, la date, et à qui."
      />

      {error && <Card className="mb-4 p-4 text-sm text-red-700">{error}</Card>}

      {/* Dire d'où viennent ces lignes évite la question qui suit toujours :
          « pourquoi je ne peux pas en créer une ? » */}
      <Card className="mb-4 p-4 text-sm text-slate-600">
        Les messages collectifs partent aujourd’hui depuis Mail, par un script, sur le poste du
        président. Cet écran <strong>conserve</strong> ce qui est parti ; il ne l’envoie pas.
        Chaque campagne y est inscrite après l’envoi, avec son texte intégral.
      </Card>

      {envois.length === 0 ? (
        <EmptyState
          title="Aucun envoi enregistré"
          hint="L’historique se remplit en lançant le script d’import après chaque campagne."
        />
      ) : isMobile ? (
        /* Cartes en portrait : six colonnes ne tiennent pas dans un téléphone, et
           ce sont les compteurs — donc l'information — qui tomberaient hors cadre. */
        <ul className="space-y-3">
          {envois.map((e) => (
            <li key={e.id}>
              <Link
                to={`/envois/${e.id}`}
                className="block rounded-lg border border-navy-100 bg-white p-4 shadow-sm active:bg-navy-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-navy-800">{e.objet}</p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {e.mode_test && <Badge tone="amber">essai</Badge>}
                    {estReconstituee(e) && <Badge tone={FIABILITE_TONES.reconstitue}>reconstituée</Badge>}
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-500">{formatDateTime(e.date_envoi)}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {e.nb_destinataires} destinataire{e.nb_destinataires > 1 ? 's' : ''}
                  {/* ⚠ Une campagne reconstituée n'a AUCUN envoi constaté :
                      afficher « 0 envoyés » à côté de 50 destinataires se
                      lirait comme un échec total. On dit ce qui est vrai —
                      l'envoi n'a pas été journalisé. */}
                  {estReconstituee(e) ? (
                    <span className="text-amber-700"> · envoi non journalisé</span>
                  ) : (
                    <>
                      {' · '}
                      <span className="text-emerald-700">{e.nb_envoyes} envoyé{e.nb_envoyes > 1 ? 's' : ''}</span>
                      {e.nb_erreurs > 0 && <span className="text-red-700"> · {e.nb_erreurs} erreur{e.nb_erreurs > 1 ? 's' : ''}</span>}
                    </>
                  )}
                </p>
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
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Objet</th>
                  <th className="px-4 py-2.5 text-right font-medium">Destinataires</th>
                  <th className="px-4 py-2.5 text-right font-medium">Envoyés</th>
                  <th className="px-4 py-2.5 text-right font-medium">Erreurs</th>
                  <th className="px-4 py-2.5 font-medium">Fiabilité</th>
                  <th className="px-4 py-2.5 font-medium">Canal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {envois.map((e) => (
                  <tr key={e.id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(e.date_envoi)}</td>
                    <td className="px-4 py-3">
                      <Link to={`/envois/${e.id}`} className="font-medium text-navy-700 hover:underline">{e.objet}</Link>
                      {e.mode_test && <span className="ml-2"><Badge tone="amber">essai</Badge></span>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{e.nb_destinataires}</td>
                    {/* ⚠ Un tiret, pas un zéro, quand rien n'a été journalisé :
                        « 0 envoyés » sur 50 destinataires se lirait comme un
                        échec total, alors que le message est bien parti. */}
                    <td className={`px-4 py-3 text-right ${estReconstituee(e) ? 'text-slate-400' : 'text-emerald-700'}`}>
                      {estReconstituee(e) ? '—' : e.nb_envoyes}
                    </td>
                    {/* Zéro erreur en gris : un zéro en rouge attire l'œil sur
                        une bonne nouvelle, et on finit par ne plus voir les vraies. */}
                    <td className={`px-4 py-3 text-right ${e.nb_erreurs > 0 ? 'font-medium text-red-700' : 'text-slate-400'}`}>
                      {estReconstituee(e) ? '—' : e.nb_erreurs}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={FIABILITE_TONES[e.fiabilite] || 'gray'}>
                        {FIABILITE_LABELS[e.fiabilite] || e.fiabilite}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{CANAL_LABELS[e.canal] || e.canal}</td>
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
