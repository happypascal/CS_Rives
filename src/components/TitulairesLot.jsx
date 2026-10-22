import { useState } from 'react'
import { repo } from '../lib/api'
import { Card, CardHeader, Button, Badge, Input, Textarea, Select, Modal } from './ui'
import PiecesJointes from './PiecesJointes'
import { useConfirm } from './useConfirm'
import { formatDate, todayISO } from '../lib/format'
import {
  ROLES, ROLE_LABELS, ROLE_AIDES, ROLE_TONES, ROLE_CO, ROLE_NU, ROLE_MANDATAIRE,
  ROLE_REPRESENTANT, ROLE_USUFRUITIER, ROLES_REPRESENTABLES, ROLES_SANS_VOTE,
  LIGNE_VIDE, actifs, clos, controles, erreurDeSaisie, nomComplet,
} from '../lib/titulaireLogic'

// ============================================================================
// LES TITULAIRES D'UNE PÉRIODE DE PROPRIÉTÉ (migration 068)
//
// Avant la 068, la fiche d'un lot ne pouvait décrire que deux personnes et UNE
// adresse. Les statuts du 15 septembre 2026 en demandent plus : une indivision
// de trois personnes, l'usufruitier seul membre qui informe le nu-propriétaire,
// une adresse par personne (art. 28, élection de domicile « en leur demeure
// respective »), le représentant désigné d'une indivision et sa pièce.
//
// ⚠ COMPOSANT NON CONTRÔLÉ, à l'inverse de `PiecesJointes` : chaque titulaire
// est une LIGNE EN BASE, enregistrée pour elle-même. Les accumuler dans l'état
// de la page pour un « Enregistrer » global reposerait la question de l'ordre
// imposé du membre votant à chaque sauvegarde — et une moitié d'enregistrement
// laisserait le lot avec deux votants ou aucun.
//
// ⚠ MOBILE EN LECTURE SEULE, comme tout le reste de la gestion : `peutSaisir`
// vient de `!isMobile` dans la page.
// ============================================================================

export default function TitulairesLot({ proprietaire, peutSaisir, onChange }) {
  const [edition, setEdition] = useState(null)   // la ligne en cours de saisie
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [voirClos, setVoirClos] = useState(false)
  const [confirm, confirmModal] = useConfirm()

  const titulaires = proprietaire?.titulaires || []
  const liste = actifs(titulaires)
  const anciens = clos(titulaires)
  const alertes = liste.length ? controles(titulaires) : []

  // Les pièces déjà au dossier de ce lot, proposées à la reprise : une même
  // désignation d'indivision peut être citée par deux indivisaires sans être
  // téléversée deux fois (patron de la 046).
  const piecesDuDossier = titulaires.flatMap((t) => t.designation_documents || [])

  const agir = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
      await onChange?.()
    } catch (e) {
      // ⚠ L'erreur du repo est affichée EN CLAIR : les gardes de la 068 (un seul
      // votant, l'usufruitier qui doit voter, le représentant qui doit être l'un
      // des détenteurs) refusent des saisies plausibles. Un refus muet ferait
      // croire à une panne.
      setError(e.message || 'Échec de l’enregistrement.')
    } finally {
      setBusy(false)
    }
  }

  const enregistrer = async () => {
    const faute = erreurDeSaisie(edition)
    if (faute) { setError(faute); return }
    const payload = versPayload(edition)
    await agir(async () => {
      if (edition.id) await repo.updateTitulaire(edition.id, payload)
      else await repo.createTitulaire(proprietaire.id, payload)
      setEdition(null)
    })
  }

  const clore = async (t) => {
    const ok = await confirm({
      title: `Clore ${nomComplet(t)} ?`,
      message: 'La ligne reste au registre, datée de ce jour. Elle n’apparaîtra plus parmi les titulaires actuels. '
        + 'À utiliser quand la personne cesse réellement d’être titulaire — pour une erreur de saisie, supprimez.',
      confirmLabel: 'Clore',
    })
    if (!ok) return
    await agir(() => repo.updateTitulaire(t.id, { date_fin: todayISO(), est_membre_votant: false, est_representant_designe: false }))
  }

  const supprimer = async (t) => {
    const ok = await confirm({
      title: `Supprimer ${nomComplet(t)} ?`,
      message: 'La ligne disparaît sans laisser de trace. Ce n’est pas une délibération : à réserver aux erreurs de saisie.',
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    await agir(() => repo.deleteTitulaire(t.id))
  }

  if (!proprietaire) return null

  return (
    <Card>
      <CardHeader
        title="Titulaires du lot"
        subtitle="Une ligne par personne. C’est d’ici que sortent les convocations et les notifications de procès-verbal."
        actions={peutSaisir && (
          <Button variant="secondary" onClick={() => { setError(''); setEdition({ ...LIGNE_VIDE, date_debut: proprietaire.date_acquisition || '' }) }}>
            + Titulaire
          </Button>
        )}
      />

      {/* ⚠ L'ERREUR S'AFFICHE LÀ OÙ LE REGARD EST. Quand la modale est ouverte,
          cette bannière est DERRIÈRE elle : un refus de saisie y serait
          invisible, et la modale qui reste ouverte sans rien dire se lit comme
          une panne. Constaté en essayant d'inscrire un usufruitier non votant.
          Elle ne sert donc qu'aux actions de la liste — clore, supprimer,
          désigner — et le formulaire porte la sienne. */}
      {error && !edition && (
        <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* ⚠ LA PÉRIODE NON REPRISE LE DIT. Sans ce bandeau, une fiche vide se
          lirait « ce lot n'a pas de titulaires » alors que ses destinataires
          sont simplement encore lus sur les colonnes de 044. */}
      {!liste.length ? (
        <div className="px-5 py-5">
          <p className="text-sm text-slate-600">
            Aucun titulaire inscrit pour cette période. Les convocations de ce lot sont donc
            encore calculées sur les <strong>anciennes cases « destinataires officiels »</strong>,
            plus bas sur cette fiche.
          </p>
          {peutSaisir && (
            <p className="mt-2 text-xs text-slate-500">
              Dès qu’un titulaire est inscrit ici, c’est cette liste qui fait foi pour les envois,
              et les anciennes cases ne servent plus.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Les cinq contrôles. ⚠ Des avertissements, jamais des refus : la base
              n'empêche rien de tout cela, et un registre doit pouvoir décrire une
              situation imparfaite — sinon on le remplit de faux pour le satisfaire. */}
          {alertes.length > 0 && (
            <div className="mx-5 mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                {alertes.length === 1 ? 'Point d’attention' : `${alertes.length} points d’attention`}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-amber-900">
                {alertes.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span aria-hidden="true">⚠</span>
                    <span>{a.texte}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-amber-700">
                Rien n’est bloqué : ces manques se comblent avec des informations que seul le
                conseil peut obtenir.
              </p>
            </div>
          )}

          <ul className="mt-2 divide-y divide-navy-50">
            {liste.map((t) => (
              <LigneTitulaire
                key={t.id}
                t={t}
                peutSaisir={peutSaisir}
                busy={busy}
                onModifier={() => { setError(''); setEdition(versFormulaire(t)) }}
                onClore={() => clore(t)}
                onSupprimer={() => supprimer(t)}
                onVotant={() => agir(() => repo.designerMembreVotant(proprietaire.id, t.est_membre_votant ? null : t.id))}
                onRepresentant={() => agir(() => repo.designerRepresentant(proprietaire.id, t.est_representant_designe ? null : t.id))}
              />
            ))}
          </ul>
        </>
      )}

      {/* Les titulaires CLOS. Repliés : on vient voir qui détient aujourd'hui.
          ⚠ Mais ils ne sont pas supprimés — une période passée garde ses
          personnes, et c'est ce qui permet de dire qui votait pour ce lot en 2019. */}
      {anciens.length > 0 && (
        <div className="border-t border-navy-100 px-5 py-3">
          <button
            type="button"
            className="text-sm text-navy-700 underline decoration-navy-300 hover:text-navy-900"
            onClick={() => setVoirClos((v) => !v)}
          >
            {voirClos ? 'Masquer' : 'Afficher'} les {anciens.length} titulaire{anciens.length > 1 ? 's' : ''} clos
          </button>
          {voirClos && (
            <ul className="mt-3 space-y-2">
              {anciens.map((t) => (
                <li key={t.id} className="text-sm text-slate-500">
                  <span className="text-slate-700">{nomComplet(t)}</span>
                  {' — '}{ROLE_LABELS[t.role] || t.role}
                  {t.date_fin && <> · clos le {formatDate(t.date_fin)}</>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal
        open={Boolean(edition)}
        onClose={() => setEdition(null)}
        title={edition?.id ? 'Modifier un titulaire' : 'Ajouter un titulaire'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdition(null)}>Annuler</Button>
            <Button onClick={enregistrer} disabled={busy || !(edition?.nom || '').trim()}>
              {busy ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        {edition && (
          <FormulaireTitulaire
            valeur={edition}
            onChange={(v) => { setError(''); setEdition(v) }}
            proprietaireId={proprietaire.id}
            piecesDuDossier={piecesDuDossier}
            error={error}
          />
        )}
      </Modal>

      {confirmModal}
    </Card>
  )
}

// ---------------------------------------------------------------- une ligne
function LigneTitulaire({ t, peutSaisir, busy, onModifier, onClore, onSupprimer, onVotant, onRepresentant }) {
  const peutVoter = !ROLES_SANS_VOTE.includes(t.role)
  // ⚠ Le bouton reste offert à qui porte DÉJÀ la désignation, même si son rôle
  // ne la permet plus : une ligne marquée avant la correction du 22 octobre
  // (0B 239, un co-propriétaire) doit pouvoir être démarquée depuis l'écran,
  // sinon le drapeau devient indélogeable sans passer par la base.
  const peutRepresenter = ROLES_REPRESENTABLES.includes(t.role) || t.est_representant_designe
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-sm font-medium text-navy-800">{nomComplet(t) || '—'}</p>
        <Badge tone={ROLE_TONES[t.role] || 'gray'}>{ROLE_LABELS[t.role] || t.role}</Badge>
        {t.fonction && <span className="text-xs text-slate-500">{t.fonction}</span>}
        {t.est_personne_morale && <Badge tone="gray">personne morale</Badge>}
        {t.quote_part && <span className="text-xs text-slate-500">{t.quote_part}</span>}
        {t.est_membre_votant && <Badge tone="green">membre votant</Badge>}
        {t.est_representant_designe && <Badge tone="blue">représentant désigné</Badge>}
        {t.refus_electronique && <Badge tone="amber">courrier postal</Badge>}
      </div>

      <div className="mt-1 space-y-0.5 text-xs text-slate-600">
        {t.email ? <p>{t.email}</p> : <p className="text-slate-400">pas d’adresse électronique</p>}
        {t.telephone && <p>{t.telephone}</p>}
        {t.adresse_postale && (
          <p className="whitespace-pre-line">
            {t.adresse_postale}{t.pays ? `, ${t.pays}` : ''}
            {/* ⚠ L'adresse reprise de la fiche n'est pas la « demeure
                respective » de cette personne (art. 28) : c'est elle qui
                empêche un recommandé de valoir. */}
            {t.adresse_a_verifier && (
              <span className="ml-1 text-amber-700">· adresse reprise de la fiche, à confirmer</span>
            )}
          </p>
        )}
        <p className="text-slate-400">
          {t.destinataire_convocations ? 'convocations' : 'pas de convocation'}
          {' · '}
          {t.destinataire_notification_pv ? 'notification du PV' : 'pas de notification du PV'}
          {t.date_debut && <> · depuis le {formatDate(t.date_debut)}</>}
        </p>
        {(t.designation_documents || []).length > 0 && (
          <p className="text-slate-500">
            {t.designation_documents.length} pièce{t.designation_documents.length > 1 ? 's' : ''} de désignation
          </p>
        )}
        {t.observations && <p className="italic text-slate-400">{t.observations}</p>}
      </div>

      {peutSaisir && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onModifier} disabled={busy}>Modifier</Button>
          {peutVoter && (
            <Button variant="ghost" size="sm" onClick={onVotant} disabled={busy}>
              {t.est_membre_votant ? 'Retirer le vote' : 'Membre votant'}
            </Button>
          )}
          {peutRepresenter && (
            <Button variant="ghost" size="sm" onClick={onRepresentant} disabled={busy}>
              {t.est_representant_designe ? 'Retirer la désignation' : 'Représentant désigné'}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClore} disabled={busy}>Clore</Button>
          <Button variant="ghost" size="sm" onClick={onSupprimer} disabled={busy}>Supprimer</Button>
        </div>
      )}
    </li>
  )
}

// ----------------------------------------------------------- le formulaire
function FormulaireTitulaire({ valeur, onChange, proprietaireId, piecesDuDossier, error }) {
  const set = (champ) => (e) => onChange({ ...valeur, [champ]: e.target.value })
  const coche = (champ) => (e) => onChange({ ...valeur, [champ]: e.target.checked })

  return (
    <div className="space-y-4">
      {/* En TÊTE du formulaire, et non en pied : une modale longue se lit de
          haut en bas, et le refus doit être lu avant qu'on cherche ce qui
          cloche. Les règles refusées ici sont celles des statuts — on dit
          laquelle, et son article. */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
      )}
      <div>
        <Select label="Rôle" value={valeur.role} onChange={set('role')}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </Select>
        {/* ⚠ L'aide du rôle est affichée, pas rangée dans une bulle : deux de
            ces phrases existent pour empêcher une faute de qualification —
            co-propriétaire n'est pas indivisaire (040), et le mandataire de
            contact n'est pas un porteur de pouvoir (art. 6). */}
        <p className="mt-1 text-xs text-slate-500">{ROLE_AIDES[valeur.role]}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Input label="Civilité" value={valeur.civilite} onChange={set('civilite')} placeholder="M., Mme" />
        <Input label="Prénom" value={valeur.prenom} onChange={set('prenom')} />
        <div className="sm:col-span-2">
          <Input label="Nom ou raison sociale" value={valeur.nom} onChange={set('nom')} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(valeur.role === ROLE_REPRESENTANT || valeur.est_personne_morale) && (
          <Input label="Fonction" value={valeur.fonction} onChange={set('fonction')} placeholder="gérant, président, associé" />
        )}
        <Input label="Quote-part" value={valeur.quote_part} onChange={set('quote_part')} placeholder="ex : 1/3 en nue-propriété" />
      </div>

      <label className="flex items-start gap-2 text-sm text-navy-800">
        <input type="checkbox" className="mt-1" checked={Boolean(valeur.est_personne_morale)} onChange={coche('est_personne_morale')} />
        <span>
          Personne morale
          <span className="block text-xs text-slate-500">
            Une société peut être indivisaire ou nu-propriétaire. Sans rapport avec la case
            « société » de la fiche, qui qualifie la période de propriété.
          </span>
        </span>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Adresse électronique" type="email" value={valeur.email} onChange={set('email')} />
        <Input label="Téléphone" value={valeur.telephone} onChange={set('telephone')} />
      </div>

      <div>
        <Textarea label="Adresse postale" rows={3} value={valeur.adresse_postale} onChange={set('adresse_postale')} />
        <p className="mt-1 text-xs text-slate-500">
          Les statuts font élection de domicile <strong>en la demeure respective</strong> de chaque
          propriétaire (art. 28). C’est à cette adresse que part un recommandé.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Pays" value={valeur.pays} onChange={set('pays')} />
        <Input label="Langue" value={valeur.langue} onChange={set('langue')} placeholder="fr, en" />
      </div>

      <label className="flex items-start gap-2 text-sm text-navy-800">
        <input type="checkbox" className="mt-1" checked={Boolean(valeur.adresse_a_verifier)} onChange={coche('adresse_a_verifier')} />
        <span>
          Adresse reprise de la fiche, à confirmer
          <span className="block text-xs text-slate-500">
            À cocher quand l’adresse n’a pas été déclarée par cette personne — celle du conjoint,
            par exemple. C’est ce genre d’adresse qui empêche une notification de valoir.
          </span>
        </span>
      </label>

      <fieldset className="rounded-md border border-navy-100 px-4 py-3">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-navy-700">Envois</legend>
        <div className="space-y-2">
          <label className="flex items-start gap-2 text-sm text-navy-800">
            <input type="checkbox" className="mt-1" checked={Boolean(valeur.destinataire_convocations)} onChange={coche('destinataire_convocations')} />
            <span>Reçoit les convocations et les messages</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-navy-800">
            <input type="checkbox" className="mt-1" checked={Boolean(valeur.destinataire_notification_pv)} onChange={coche('destinataire_notification_pv')} />
            <span>
              Reçoit la notification du procès-verbal
              <span className="block text-xs text-slate-500">
                Tout propriétaire doit l’être (art. 13). Cette case dit <strong>qui</strong>, jamais
                par quel moyen : le pli simple ou le recommandé dépend de la façon dont la personne
                a voté à cette assemblée, que l’application n’enregistre pas.
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-navy-800">
            <input type="checkbox" className="mt-1" checked={Boolean(valeur.refus_electronique)} onChange={coche('refus_electronique')} />
            <span>
              A demandé le courrier postal
              <span className="block text-xs text-slate-500">
                Demande expresse au sens des art. 8 et 13. La personne reste destinataire : elle
                passe dans la liste postale au lieu de l’envoi électronique.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {/* Le vote et la désignation ne sont PAS dans ce formulaire quand la ligne
          existe déjà : ils se posent par les boutons de la liste, qui passent par
          `designerMembreVotant` — la seule voie qui respecte l'ordre imposé
          (retirer avant de poser). Ici, seulement à la création. */}
      {!valeur.id && (
        <div className="space-y-2">
          {!ROLES_SANS_VOTE.includes(valeur.role) && (
            <label className="flex items-start gap-2 text-sm text-navy-800">
              <input type="checkbox" className="mt-1" checked={Boolean(valeur.est_membre_votant)} onChange={coche('est_membre_votant')} />
              <span>
                Porte la voix du lot
                {valeur.role === ROLE_USUFRUITIER && (
                  <span className="block text-xs text-amber-700">
                    Obligatoire pour un usufruitier : il prend seul la qualité de membre (art. 6).
                  </span>
                )}
                <span className="block text-xs text-slate-500">
                  Un seul par lot. S’il y en a déjà un, retirez-lui d’abord sa voix.
                </span>
              </span>
            </label>
          )}
          {ROLES_REPRESENTABLES.includes(valeur.role) && (
            <label className="flex items-start gap-2 text-sm text-navy-800">
              <input type="checkbox" className="mt-1" checked={Boolean(valeur.est_representant_designe)} onChange={coche('est_representant_designe')} />
              <span>
                Représentant désigné de l’indivision
                <span className="block text-xs text-slate-500">
                  Les statuts veulent que les indivisaires se fassent représenter par
                  <strong> l’un d’eux</strong> (art. 6), et la désignation est écrite.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      {/* La pièce de désignation. ⚠ Le chemin porte l'id du PROPRIÉTAIRE et non
          du titulaire : la période existe au moment de l'envoi, la ligne du
          titulaire pas encore (patron de 046 et 050). Et c'est ce préfixe que
          les deux policies restrictives de la 068 ferment au non-bureau. */}
      {(valeur.est_representant_designe || (valeur.designation_documents || []).length > 0) && (
        <PiecesJointes
          scope="proprietaires"
          entityId={proprietaireId}
          label="Désignation signée des indivisaires"
          documents={valeur.designation_documents || []}
          onChange={(docs) => onChange({ ...valeur, designation_documents: docs })}
          disponibles={piecesDuDossier}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Depuis le" type="date" value={valeur.date_debut} onChange={set('date_debut')} />
        {valeur.id && <Input label="Jusqu’au" type="date" value={valeur.date_fin} onChange={set('date_fin')} />}
      </div>

      <Textarea label="Observations" rows={2} value={valeur.observations} onChange={set('observations')} />

      {(valeur.role === ROLE_MANDATAIRE || valeur.role === ROLE_NU || valeur.role === ROLE_CO) && (
        <p className="rounded-md bg-navy-50 px-3 py-2 text-xs text-navy-800">{ROLE_AIDES[valeur.role]}</p>
      )}
    </div>
  )
}

// ⚠ `null` de la base contre chaîne vide du formulaire : `{ ...LIGNE_VIDE,
// ...ligne }` ne suffit PAS, puisque `null` écrase la valeur vide du modèle
// (seul `undefined` laisse celle de gauche) et qu'un `.trim()` planterait
// ensuite. Même piège que `sansNull` dans `Membres.jsx` — et on traite TOUS les
// champs d'un coup, parce que les traiter un à un est ce qui avait produit le bug.
function versFormulaire(t) {
  const out = { ...LIGNE_VIDE, id: t.id, designation_documents: t.designation_documents || [] }
  for (const champ of Object.keys(LIGNE_VIDE)) {
    const v = t[champ]
    out[champ] = v === null || v === undefined ? LIGNE_VIDE[champ] : v
  }
  return out
}

// …et l'inverse : une chaîne vide repart en `null`, pour que la base ne
// conserve pas des champs « renseignés mais vides » que les contrôles
// compteraient comme présents.
function versPayload(f) {
  const out = {}
  for (const champ of Object.keys(LIGNE_VIDE)) {
    const v = f[champ]
    out[champ] = typeof v === 'string' ? (v.trim() || null) : v
  }
  out.designation_documents = f.designation_documents || []
  return out
}
