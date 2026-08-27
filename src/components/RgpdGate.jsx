// Porte d'entrée du registre des propriétaires (migration 035).
//
// Deux fonctions, à ne pas confondre :
//   1. un GARDE de rôle — président ou secrétaire, personne d'autre. Il double
//      les policies `lots_bureau` / `proprietaires_bureau`, il ne les remplace
//      pas : côté client, un garde n'est qu'un confort d'affichage, seule la
//      RLS ferme réellement l'accès.
//   2. l'ACCEPTATION de la mention RGPD, demandée une fois par personne, avant
//      toute lecture. Tant qu'elle n'est pas donnée, aucune donnée n'est
//      chargée — l'écran d'acceptation s'affiche à la place des enfants, il ne
//      se superpose pas à eux. Une mention qu'on peut lire par-dessus les
//      données qu'elle protège ne protège rien.
//
// L'acceptation est horodatée sur `membres_cs.registre_rgpd_accepte_le` et
// tracée dans le journal. Ensuite, un rappel court reste en tête du registre :
// la mention longue n'est montrée qu'une fois, la règle vaut tous les jours.
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, Button } from './ui'
import { PageHeader } from './ProtectedRoute'
import { useAuth } from '../lib/AuthContext'
import { repo } from '../lib/api'
import {
  RGPD_REGISTRE_TITRE,
  RGPD_REGISTRE_PARAGRAPHES,
  RGPD_COMMUNICABLE,
  RGPD_RAPPEL_COURT,
} from '../lib/rgpdRegistre'

export function RgpdGate({ children }) {
  const { user, isAdmin, isSecretaire } = useAuth()
  const bureau = isAdmin || isSecretaire
  // `null` tant qu'on n'a rien accepté dans CETTE session : la valeur de départ
  // vient du membre connecté, l'acceptation locale évite un rechargement.
  const [accepteLocal, setAccepteLocal] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!bureau) {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">
          <p>
            Le registre des propriétaires est réservé au <strong>président</strong> et au{' '}
            <strong>secrétaire</strong>. Il contient des données personnelles de tiers — noms, adresses privées,
            coordonnées — que les autres membres du Conseil Syndical n’ont pas à consulter.
          </p>
          <p className="mt-3"><Link to="/registre" className="text-navy-600 underline">← Retour aux décisions</Link></p>
        </Card>
      </div>
    )
  }

  const accepte = accepteLocal || Boolean(user?.registre_rgpd_accepte_le)
  if (!accepte) {
    const accepter = async () => {
      setBusy(true)
      setError('')
      try {
        await repo.accepterRgpdRegistre(user.membre_id)
        setAccepteLocal(true)
      } catch (e) {
        setError(e.message)
        setBusy(false)
      }
    }
    return (
      <div>
        <PageHeader title={RGPD_REGISTRE_TITRE} subtitle="À lire avant d’accéder au registre." />
        <Card className="p-6">
          <div className="space-y-3 text-sm text-slate-700">
            {RGPD_REGISTRE_PARAGRAPHES.map((p) => <p key={p.slice(0, 30)}>{p}</p>)}
            <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
              <p className="text-sm font-semibold text-amber-900">Communicable à un tiers, et rien d’autre :</p>
              <ul className="mt-1 list-disc pl-5 text-sm text-amber-900">
                {RGPD_COMMUNICABLE.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            <Link to="/registre"><Button variant="ghost">Ne pas accéder</Button></Link>
            <Button onClick={accepter} disabled={busy}>
              {busy ? 'Enregistrement…' : 'J’ai lu et j’accepte ces obligations'}
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Rappel permanent : la mention longue n'est lue qu'une fois, la règle
          s'applique à chaque consultation. */}
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
        {RGPD_RAPPEL_COURT}
      </div>
      {children}
    </>
  )
}
