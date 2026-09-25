import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Textarea, Spinner, Badge } from '../components/ui'
import { RgpdGate } from '../components/RgpdGate'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/format'
import {
  CANAL_LABELS, STATUT_LABELS, STATUT_TONES, LANGUE_LABELS,
  nonRapproches, paragraphes,
} from '../lib/communicationLogic'

// UNE CAMPAGNE — le texte exact, et à qui il est parti.
//
// ⚠ DEUX NIVEAUX DE LECTURE SUR LE MÊME ÉCRAN, et c'est le point de conception :
// la campagne et son texte se lisent par TOUS les membres (c'est un acte de
// gestion, et le message a été adressé à cinquante-cinq personnes) ; la liste
// des DESTINATAIRES est réservée au président et au secrétaire, comme le
// registre des propriétaires dont ces adresses sortent (035). Ouvrir la liste à
// tous ferait fuir par cette porte ce que la 035 a fermé.

/** Un corps de message, tel qu'il est parti. Texte brut, jamais interprété. */
function Corps({ titre, texte, langue }) {
  if (!texte) return null
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-sm font-semibold text-navy-800">{titre}</h3>
        {langue && <span className="text-xs text-slate-400">{LANGUE_LABELS[langue]}</span>}
      </div>
      {/* `whitespace-pre-wrap` : le message est parti avec ses retours à la
          ligne, les écraser changerait ce qu'on prétend citer. */}
      <div className="whitespace-pre-wrap rounded border border-navy-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
        {paragraphes(texte).join('\n')}
      </div>
    </div>
  )
}

function Destinataires({ liste }) {
  const sansRegistre = nonRapproches(liste)
  return (
    <>
      {sansRegistre.length > 0 && (
        <div className="border-b border-navy-100 bg-amber-50 px-5 py-3 text-xs text-amber-900">
          <strong>{sansRegistre.length} adresse{sansRegistre.length > 1 ? 's' : ''}</strong> ne correspond
          {sansRegistre.length > 1 ? 'ent' : ''} à aucun contact officiel du registre des propriétaires :
          contact périmé, ou destinataire qui n’est pas coloti. Aucun propriétaire n’a été créé à cette
          occasion — c’est à vérifier sur la fiche concernée.
        </div>
      )}
      <ul className="divide-y divide-navy-50">
        {liste.map((d) => (
          <li key={d.id} className="flex items-start justify-between gap-3 px-5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-700">
                {d.nom || <span className="italic text-slate-400">nom inconnu</span>}
              </p>
              <p className="truncate text-xs text-slate-500">
                {d.email}
                {d.langue && <span className="text-slate-400"> · {d.langue}</span>}
                {!d.proprietaire_id && <span className="text-amber-700"> · hors registre</span>}
              </p>
              {d.message_erreur && <p className="mt-0.5 text-xs text-red-700">{d.message_erreur}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs text-slate-400">{d.rang}</span>
              <Badge tone={STATUT_TONES[d.statut] || 'gray'}>{STATUT_LABELS[d.statut] || d.statut}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default function CommunicationDetail() {
  const { id } = useParams()
  const { isAdmin, isSecretaire } = useAuth()
  const bureau = isAdmin || isSecretaire
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [envoi, setEnvoi] = useState(null)
  const [commentaire, setCommentaire] = useState('')
  const [busy, setBusy] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    repo.getCommunication(id)
      .then((c) => {
        setEnvoi(c)
        setCommentaire(c?.commentaire || '')
      })
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (error) return <Card className="p-6 text-sm text-red-700">{error}</Card>
  if (!envoi) return <Card className="p-6 text-sm text-slate-600">Envoi introuvable.</Card>

  const enregistrerCommentaire = async () => {
    setBusy(true)
    setError('')
    setEnregistre(false)
    try {
      await repo.updateCommunicationCommentaire(id, commentaire.trim())
      setEnregistre(true)
    } catch (e) {
      setError(e?.message || 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <PageHeader
        title={envoi.objet}
        subtitle={`Envoyé le ${formatDateTime(envoi.date_envoi)} · ${CANAL_LABELS[envoi.canal] || envoi.canal}`}
        actions={<Link to="/envois" className="text-sm text-navy-600 underline">Retour aux envois</Link>}
      />

      {envoi.mode_test && (
        <Card className="mb-4 border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Campagne d’<strong>essai</strong> : elle n’est pas partie aux colotis. Conservée pour mémoire.
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Le message, tel qu’il est parti"
              subtitle="Texte intégral. Il n’est pas modifiable : c’est un fait survenu, pas un brouillon."
            />
            <div className="space-y-4 p-5">
              <Corps titre="Version française" texte={envoi.corps_fr} langue="FR" />
              <Corps titre="Version anglaise" texte={envoi.corps_en} langue="EN" />
              {/* Chaque destinataire a reçu UN message contenant les deux
                  versions, séparées par un filet — pas deux messages. */}
              <p className="text-xs text-slate-500">
                Chaque destinataire a reçu un seul message, contenant les deux versions séparées par un filet.
              </p>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader
              title="Destinataires"
              subtitle={`${envoi.nb_destinataires} au total · ${envoi.nb_envoyes} envoyé(s) · ${envoi.nb_erreurs} erreur(s)`}
            />
            {/* ⚠ `destinataires === null` ne veut pas dire « aucun » mais
                « vous n'avez pas à les voir » : le distinguer est indispensable,
                sinon l'écran annoncerait un message parti à personne. */}
            {envoi.destinataires === null ? (
              <div className="p-5 text-sm text-slate-600">
                La liste nominative est réservée au <strong>président</strong> et au{' '}
                <strong>secrétaire</strong> : ce sont les adresses du registre des propriétaires, protégées
                par le RGPD. Le nombre de destinataires et le texte envoyé restent visibles de tous.
              </div>
            ) : bureau ? (
              <RgpdGate compact quoi="La liste des destinataires d’un envoi">
                <Destinataires liste={envoi.destinataires} />
              </RgpdGate>
            ) : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Repères" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Date d’envoi</dt>
                <dd className="text-slate-700">{formatDateTime(envoi.date_envoi)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Canal</dt>
                <dd className="text-slate-700">{CANAL_LABELS[envoi.canal] || envoi.canal}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Expéditeur</dt>
                {/* Un compte vide dans le script veut dire « compte par défaut de
                    Mail » : inconnu, donc dit comme tel plutôt que deviné. */}
                <dd className="text-slate-700">{envoi.expediteur || <span className="text-slate-400">compte par défaut</span>}</dd>
              </div>
              {envoi.source_fichier && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Journal importé</dt>
                  <dd className="break-all text-xs text-slate-500">{envoi.source_fichier}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card>
            <CardHeader
              title="Commentaire"
              subtitle="Le seul champ modifiable. Ce qu’il faut savoir en relisant cet envoi dans deux ans."
            />
            <div className="p-5">
              {bureau ? (
                <>
                  <Textarea
                    value={commentaire}
                    onChange={(e) => { setCommentaire(e.target.value); setEnregistre(false) }}
                    rows={4}
                    placeholder="Ex. : relance envoyée aux six colotis qui n’avaient pas répondu."
                  />
                  <div className="mt-2 flex items-center justify-end gap-2">
                    {enregistre && <span className="text-xs text-emerald-700">Enregistré.</span>}
                    <Button size="sm" onClick={enregistrerCommentaire} disabled={busy}>
                      {busy ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </>
              ) : envoi.commentaire ? (
                <p className="whitespace-pre-wrap text-sm text-slate-700">{envoi.commentaire}</p>
              ) : (
                <p className="text-sm text-slate-400">Aucun commentaire.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
