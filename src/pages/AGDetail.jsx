import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Modal, Spinner, Badge, eur, num, UploadProgress } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { MAX_DOC_BYTES, BACKEND } from '../lib/config'
import { downloadDocument } from '../lib/documents'
import { AGStatutBadge, ResolutionStatutBadge } from '../components/badges'
import { formatDate, parseMontant, todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { nextResolutionNumero, numeroGarageLibre, estGaree, numeroResolution, parseNumeroResolution, MAJORITE_VALUES, MAJORITE_LABELS, RESOLUTION_STATUT_VALUES, RESOLUTION_STATUT_LABELS, effectiveAGStatut, agAEuLieu, AG_QUORUM_LABELS, AG_QUORUM_TONES, agFigee, echeanceContestation, closeDePleinDroit, DELAI_CONTESTATION_DEFAUT, tauxParticipation, totalM2AG, repartitionVote, voteIncoherent, pct } from '../lib/agLogic'

// Catégories de pièces jointes d'une AG. Vivent dans le jsonb, sans contrainte
// en base : ajouter une 4e catégorie un jour ne demandera aucune migration.
const DOC_CATEGORIES = {
  convocation: 'Convocation',
  pv: 'Procès-verbal',
  autre: 'Autre',
}

// Ordre d'affichage : convocation, PV, puis le reste — celui dans lequel on les
// cherche, et l'ordre chronologique de la vie d'une AG.
const DOC_ORDRE = { convocation: 0, pv: 1, autre: 2 }

export default function AGDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin, isSecretaire, isTresorier } = useAuth()
  const isMobile = useIsMobile()
  // Gestion de l'AG et de ses résolutions : président OU secrétaire (point 5).
  // La SUPPRESSION reste au président (canDelete), comme toute suppression.
  const canManage = (isAdmin || isSecretaire) && !isMobile
  const canDelete = isAdmin && !isMobile
  const [ag, setAg] = useState(null)
  const [decisions, setDecisions] = useState([])
  const [projets, setProjets] = useState([])
  const [loading, setLoading] = useState(true)
  const [resModal, setResModal] = useState(null)
  const [rattachModal, setRattachModal] = useState(null)
  // Saisie du résultat directement dans la liste : la ligne en cours d'écriture,
  // et l'échec éventuel — affiché en clair plutôt qu'avalé.
  const [pvModal, setPvModal] = useState(null)
  const [voteBusy, setVoteBusy] = useState(null)
  const [voteError, setVoteError] = useState('')
  // Total COURANT du lotissement. ⚠ Il ne sert qu'aux AG qui n'ont PAS encore leur
  // total figé : dès qu'une assemblée porte le sien, c'est celui-là qui compte, et
  // le paramètre peut changer sans rien déplacer.
  const [m2TotalCourant, setM2TotalCourant] = useState(null)
  // Délai de contestation (055), en mois. Paramétrable : les statuts en révision
  // peuvent le fixer autrement, et ce n'est pas à un fichier source d'en décider.
  const [delaiContestation, setDelaiContestation] = useState(DELAI_CONTESTATION_DEFAUT)
  // Pièces jointes de l'AG (migration 031) : catégorie choisie AVANT l'envoi,
  // c'est ce qui distingue un PV d'un devis dans la liste.
  const [docCategorie, setDocCategorie] = useState('convocation')
  const [docUpload, setDocUpload] = useState(null)
  const [docError, setDocError] = useState('')
  const [confirm, confirmModal] = useConfirm()

  const reload = useCallback(async () => {
    const [data, ds, ps, params] = await Promise.all([
      repo.getAG(id),
      repo.listDecisions(),
      repo.listProjets().catch(() => []),
      // Secondaire : sans le paramètre, une AG déjà dotée de son total figé
      // affiche quand même son taux — c'est tout l'objet du gel.
      repo.getParametres().catch(() => ({})),
    ])
    setAg(data)
    setDecisions(ds)
    setProjets(ps)
    setM2TotalCourant(params.m2_total_lotissement || null)
    setDelaiContestation(Number(params.delai_contestation_mois) || DELAI_CONTESTATION_DEFAUT)
    setLoading(false)
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />
  if (!ag) {
    return (
      <div>
        <PageHeader title="AG introuvable" />
        <Link to="/ag" className="text-navy-600 underline">← Retour aux AG</Link>
      </div>
    )
  }

  // Seule une résolution ADOPTÉE alloue un budget : tant qu'elle est à voter (ou si
  // elle est rejetée/retirée), le montant n'est qu'une proposition.
  const budgetTotal = ag.resolutions.filter((r) => r.statut === 'adoptee').reduce((s, r) => s + (Number(r.budget_alloue) || 0), 0)
  const budgetPropose = ag.resolutions.filter((r) => r.statut === 'a_voter').reduce((s, r) => s + (Number(r.budget_alloue) || 0), 0)
  const linkedCount = (resolutionId) => decisions.filter((d) => d.resolution_id === resolutionId).length
  const agLocked = decisions.some((d) => d.ag_id === id)
  const projetById = Object.fromEntries(projets.map((p) => [p.id, p]))
  // Une résolution ne finance un projet que si l'AG l'a adoptée ET dotée.
  const peutFinancer = (r) => r.statut === 'adoptee' && r.budget_alloue != null && r.budget_alloue !== ''
  // AG FIGÉE : clôturée (ou annulée) → plus de modification de l'AG ni des
  // résolutions (titre, montant, résultat). EXCEPTION assumée : le rattachement
  // d'une enveloppe à un projet reste possible (acte administratif post-AG).
  // « AG a eu lieu » (date passée) N'est PAS figée : on y saisit encore les
  // résultats et l'heure de fin avant de clôturer.
  // ⚠ FIGÉE inclut désormais la CLÔTURE DE PLEIN DROIT (055) : passé le délai de
  // contestation sans contestation inscrite, le procès-verbal est définitif et
  // l'assemblée se ferme d'elle-même. Dérivé, jamais écrit.
  const agFrozen = agFigee(ag, delaiContestation)
  const echeancePV = echeanceContestation(ag, delaiContestation)

  // ---------------------------------------------------------- vote en ligne
  // Saisir les résultats d'une AG, c'est renseigner quinze résultats d'affilée.
  // Ouvrir puis refermer une modale pour chacun était le vrai coût de l'écran
  // (Pascal, 2026-09-16, au lendemain de l'AG). Le résultat se choisit donc
  // directement dans la liste.
  //
  // ⚠ CE QUI BLOQUE LE MENU, et pourquoi il faut le dire plutôt que de le griser :
  //   1. une DÉCISION du CS s'y rattache — `updateResolution` refuse (le budget
  //      voté porte déjà des engagements) ;
  //   2. son enveloppe FINANCE UN PROJET — `updateResolution` refuse aussi ;
  //   3. elle est ADOPTÉE (règle demandée par Pascal) : le résultat ne se change
  //      plus d'un coup de menu. Une adoption ouvre un budget ; la défaire par
  //      mégarde en glissant sur une liste de quinze lignes retirerait une
  //      enveloppe sans que personne ne s'en aperçoive. Il faut ouvrir la
  //      résolution — le geste reste possible, il cesse d'être accidentel.
  //
  // Les deux premiers cas viennent du dépôt (le repo refuserait de toute façon,
  // et un menu qui échoue en silence est pire qu'un menu absent) ; le troisième
  // est une friction VOULUE.
  // `dur: true` = le dépôt refusera l'écriture de toute façon ; ouvrir la modale
  // ne servirait qu'à montrer une erreur. `dur: false` = la friction voulue :
  // c'est possible, mais pas d'un coup de menu.
  const voteVerrou = (r) => {
    const n = linkedCount(r.id)
    if (n > 0) {
      return {
        dur: true,
        message: `${n} décision${n > 1 ? 's' : ''} du conseil s’y rattache${n > 1 ? 'nt' : ''}`,
        // Seule issue réelle : détacher la décision depuis SA fiche. Ce n'est pas
        // un geste d'AG, et il n'a rien à faire ici.
        sortie: 'Le conseil a engagé de l’argent sur cette enveloppe : détachez d’abord la décision depuis sa fiche.',
      }
    }
    if (r.projet_id) {
      return {
        dur: true,
        message: 'son enveloppe finance un projet',
        // ⚠ LA SORTIE EXISTE ET DOIT ÊTRE DITE. Le verrou vient du dépôt
        // (`updateResolution` refuse dès qu'un projet pointe la résolution), mais
        // `setResolutionProjet` n'a AUCUNE garde : détacher est toujours possible,
        // et rend aussitôt le vote modifiable. Sans cette phrase, l'écran affichait
        // un cadenas sans issue — et donnait à croire qu'une erreur de saisie était
        // définitive avant même la clôture de l'AG.
        sortie: 'Pour revenir sur le vote : « changer » ci-dessous, puis « Aucun » — l’enveloppe quitte le projet et la résolution redevient modifiable.',
      }
    }
    if (r.statut === 'adoptee') return { dur: false, message: 'adoptée — à rouvrir pour revenir sur le vote' }
    return null
  }

  const changerVote = async (r, statut) => {
    setVoteError('')
    setVoteBusy(r.id)
    try {
      await repo.updateResolution(r.id, { statut })
      await reload()
    } catch (e) {
      setVoteError(`Résolution n° ${numeroResolution(r)} : ${e.message}`)
    } finally {
      setVoteBusy(null)
    }
  }

  // Récapitulatif des enveloppes ADOPTÉES : ce qui est affecté à un projet et ce
  // qui ne l'est pas encore. ⚠ C'est la question que l'écran ne répondait pas —
  // il fallait parcourir les lignes une à une pour savoir ce qui restait à
  // affecter après une AG.
  const taux = tauxParticipation(ag, m2TotalCourant)

  const adoptees = ag.resolutions.filter(peutFinancer)
  const montantAffecte = adoptees.filter((r) => r.projet_id).reduce((s, r) => s + Number(r.budget_alloue || 0), 0)
  const montantLibre = adoptees.filter((r) => !r.projet_id).reduce((s, r) => s + Number(r.budget_alloue || 0), 0)

  const cloturerAG = async () => {
    if (!(await confirm({ title: `Clôturer l’AG ${ag.numero} ?`, message: 'L’AG et ses résolutions seront FIGÉES (plus modifiables). Seul le rattachement des budgets aux projets restera possible. À faire une fois les résultats et l’heure de fin de séance saisis.', confirmLabel: 'Clôturer', danger: true }))) return
    try {
      await repo.updateAG(id, { statut: 'cloturee' })
      await reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const deleteAG = async () => {
    if (!(await confirm({ title: `Supprimer l’AG ${ag.numero} ?`, message: 'L’AG et toutes ses résolutions seront supprimées. Cette action est irréversible.', confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await repo.deleteAG(id)
      navigate('/ag')
    } catch (e) {
      alert(e.message)
    }
  }

  // Comptes de l'exercice (AGO) : co-validation trésorier + président (point 4).
  const compteBy = Object.fromEntries((ag.comptes || []).map((c) => [c.role, c]))
  const comptesValides = Boolean(compteBy.tresorier && compteBy.president)
  const approveComptes = async (role) => {
    await repo.approveComptes(id, role, user?.membre_id)
    await reload()
  }
  const unapproveComptes = async (role) => {
    await repo.unapproveComptes(id, role)
    await reload()
  }

  // ---- Pièces jointes de l'AG (migration 031) ----
  //
  // Le fichier part dans le bucket dès qu'il est choisi, puis la ligne est mise
  // à jour — même schéma que partout ailleurs. Chemin `ag/<id>/…` : couvert par
  // les policies de Storage existantes, aucune n'a eu à être ajoutée.
  const ouvrirDoc = async (doc) => {
    setDocError('')
    try {
      await downloadDocument(doc)
    } catch (err) {
      setDocError(`« ${doc.name} » n’a pas pu être ouvert : ${err.message}`)
    }
  }
  const ajouterDoc = async (e) => {
    setDocError('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_DOC_BYTES) {
      const mo = Math.round(MAX_DOC_BYTES / 1024 / 1024)
      return setDocError(`Fichier trop volumineux (max ${mo} Mo${BACKEND === 'mock' ? ' en mode démo' : ''}).`)
    }
    setDocUpload({ name: file.name, value: 0 })
    try {
      const record = await repo.uploadDocument('ag', id, file, (value) => setDocUpload((u) => (u ? { ...u, value } : u)))
      await repo.updateAG(id, { documents: [...(ag.documents || []), { ...record, categorie: docCategorie }] })
      await reload()
    } catch (err) {
      setDocError(`Envoi du fichier impossible : ${err.message}`)
    } finally {
      setDocUpload(null)
    }
  }
  // « Retirer » ne supprime PAS l'objet du bucket — orphelins assumés, comme
  // pour les décisions : quelques Mo perdus valent mieux qu'un PV introuvable.
  const retirerDoc = async (doc) => {
    if (!(await confirm({ title: 'Retirer ce document ?', message: `« ${doc.name} » ne sera plus rattaché à l’AG.`, confirmLabel: 'Retirer', danger: true }))) return
    try {
      await repo.updateAG(id, { documents: (ag.documents || []).filter((x) => (x.id || x.path) !== (doc.id || doc.path)) })
      await reload()
    } catch (err) {
      setDocError(err.message)
    }
  }

  // ---------------------------------------------------- PV envoyé (055)
  // ⚠ LA DATE EST L'ACTE, pas le statut. C'est l'envoi du procès-verbal qui fait
  // courir le délai de contestation, et c'est sa date officielle qui compte — ni
  // celle de la séance, ni celle de la rédaction. D'où une saisie de date, dans
  // une vraie modale : `window.prompt` aurait été hors du style de l'application,
  // et surtout non testable.
  const leverContestation = async () => {
    if (!(await confirm({
      title: 'Retirer la contestation inscrite ?',
      message: 'Le délai de contestation reprend son cours à partir de la date d’envoi du PV. À faire si la contestation a été inscrite par erreur, ou si elle est éteinte.',
      confirmLabel: 'Retirer',
      danger: true,
    }))) return
    await repo.updateAG(id, { contestation_le: null, contestation_objet: null })
    await reload()
  }

  return (
    <div>
      <PageHeader
        title={<span><span className="text-slate-400">{ag.numero}</span> · {ag.type === 'AGO' ? 'Ordinaire' : 'Extraordinaire'}</span>}
        subtitle={`${formatDate(ag.date_ag)}${ag.heure_planifiee ? ' à ' + ag.heure_planifiee : ''}${ag.lieu ? ' · ' + ag.lieu : ''}`}
        actions={<>
          {canManage && !agFrozen && <Link to={`/ag/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>}
          {/* Clôturer = FIGER l'AG. Président seul, et seulement une fois l'AG TENUE
              (date passée) ET l'heure de fin saisie. Avant la date, pas de clôture. */}
          {/* PV envoyé : l'étape qui manquait entre la séance et la clôture (055).
              Proposée tant que l'AG n'est pas figée et qu'elle a eu lieu. */}
          {isAdmin && !isMobile && agAEuLieu(ag) && ag.statut !== 'pv_envoye' && (
            <Button variant="secondary" onClick={() => setPvModal('envoi')}>PV envoyé…</Button>
          )}
          {/* ⚠ PROPOSÉE MÊME SUR UNE AG CLOSE DE PLEIN DROIT, et c'est nécessaire :
              une contestation déposée le dernier jour du délai sera inscrite le
              lendemain, alors que l'assemblée s'est déjà fermée toute seule. La
              refuser alors gèlerait une clôture que le droit ne connaît pas. La
              modale demande la DATE de la contestation, qui seule compte — et
              l'inscrire rouvre l'assemblée, puisqu'elle suspend la clôture. */}
          {isAdmin && !isMobile && ag.statut === 'pv_envoye' && !ag.contestation_le && (
            <Button variant="secondary" onClick={() => setPvModal('contestation')}>Inscrire une contestation</Button>
          )}
          {isAdmin && !isMobile && ag.contestation_le && (
            <Button variant="ghost" onClick={leverContestation}>Retirer la contestation</Button>
          )}
          {isAdmin && !isMobile && agAEuLieu(ag) && !agFrozen && (
            <Button onClick={cloturerAG} disabled={!ag.heure_fin} title={!ag.heure_fin ? 'Renseignez d’abord l’heure de fin de séance (Modifier)' : ''}>Clôturer l’AG</Button>
          )}
          {canDelete && !agFrozen && <Button variant="danger" onClick={deleteAG} disabled={agLocked} title={agLocked ? 'Des décisions sont rattachées à cette AG' : ''}>Supprimer</Button>}
        </>}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <AGStatutBadge statut={effectiveAGStatut(ag, delaiContestation)} />
            {ag.quorum_statut && <Badge tone={AG_QUORUM_TONES[ag.quorum_statut] || 'gray'}>{AG_QUORUM_LABELS[ag.quorum_statut]}</Badge>}
          </div>
          {ag.heure_fin && <p className="mt-1 text-xs text-slate-500">Séance close à {ag.heure_fin}</p>}
          {/* ⚠ On DIT la règle et la date, pas seulement l'état : « clôturée » sans
              expliquer d'où vient la fermeture serait illisible dans un registre. */}
          {ag.date_envoi_pv && (
            <p className="mt-0.5 text-xs text-slate-500">
              PV envoyé le <strong>{formatDate(ag.date_envoi_pv)}</strong>
              {ag.contestation_le
                ? <> — contestation inscrite le {formatDate(ag.contestation_le)}, le délai est suspendu.</>
                : closeDePleinDroit(ag, delaiContestation)
                  ? <> — délai de {delaiContestation} mois écoulé le {formatDate(echeancePV)} sans contestation : <strong className="text-emerald-700">close de plein droit</strong>.</>
                  : <> — contestable jusqu’au <strong>{formatDate(echeancePV)}</strong> ({delaiContestation} mois).</>}
            </p>
          )}
          {ag.contestation_objet && <p className="mt-0.5 text-xs text-red-700">Objet : {ag.contestation_objet}</p>}
          {ag.m2_presents != null && ag.m2_presents !== '' && (
            <p className="mt-0.5 text-xs text-slate-500">
              {num(ag.m2_presents)} m² présents ou représentés
              {taux != null && (
                <> — <strong className="text-navy-700">{pct(taux)}</strong> de participation</>
              )}
            </p>
          )}
          {/* ⚠ On dit sur QUOI le taux est calculé, et s'il est figé. Un
              pourcentage dont le dénominateur est invisible n'est pas vérifiable —
              et celui-ci conditionne la validité des délibérations. */}
          {taux != null && (
            <p className="mt-0.5 text-xs text-slate-400">
              sur {num(totalM2AG(ag, m2TotalCourant))} m² au total
              {ag.m2_total != null
                ? ' (figé pour cette séance)'
                : ' (total actuel — sera figé au prochain enregistrement)'}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Président de séance</p>
          <p className={`mt-1 text-sm font-medium ${ag.president_seance ? 'text-navy-800' : 'italic text-slate-400'}`}>{ag.president_seance || 'Désigné en séance'}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budgets alloués</p>
          <p className="mt-1 text-lg font-semibold text-navy-800">{eur(budgetTotal)}</p>
          {budgetPropose > 0 && <p className="mt-0.5 text-xs text-amber-700">dont {eur(budgetPropose)} soumis au vote</p>}
        </Card>
      </div>

      {/* Comptes de l'exercice — AGO seulement. Validés quand le trésorier ET le
          président ont approuvé (art. 13 : l'AG approuve les comptes ; ici le
          contrôle interne préalable, point 4). Le secrétaire n'approuve pas. */}
      {ag.type === 'AGO' && (
        <Card className="mb-6">
          <CardHeader
            title="Comptes de l’exercice"
            subtitle="Validés lorsque le trésorier et le président les ont approuvés."
            actions={<Badge tone={comptesValides ? 'green' : 'gray'}>{comptesValides ? 'Comptes validés' : 'En attente'}</Badge>}
          />
          <div className="grid gap-px bg-navy-50 sm:grid-cols-2">
            {[
              { role: 'tresorier', label: 'Trésorier', can: isTresorier },
              { role: 'president', label: 'Président', can: isAdmin },
            ].map(({ role, label, can }) => {
              const c = compteBy[role]
              return (
                <div key={role} className="bg-white px-5 py-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  {c ? (
                    <>
                      <p className="mt-1 text-sm font-medium text-emerald-700">✓ Approuvé le {formatDate(c.approuve_le)}</p>
                      {can && !isMobile && (
                        <button onClick={() => unapproveComptes(role)} className="mt-1 text-xs text-slate-400 underline hover:text-red-600">Annuler mon approbation</button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-slate-400">Non approuvé</p>
                      {can && !isMobile && (
                        <Button size="sm" className="mt-2" onClick={() => approveComptes(role)}>Approuver les comptes</Button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* DOCUMENTS DE L'AG (migration 031). La convocation et le PV ne se
          rattachent à AUCUNE résolution : la première prouve la régularité de
          l'appel, le second couvre la séance entière. Ils appartiennent à l'AG.
          ⚠ Reste possible sur une AG CLÔTURÉE — et c'est voulu : le PV arrive
          presque toujours APRÈS la clôture. Même exception que le rattachement
          des enveloppes aux projets, pour la même raison — un fait postérieur à
          la séance n'est pas une modification de la séance. */}
      <Card className="mb-6">
        <CardHeader
          title="Documents de l’assemblée"
          subtitle="Convocation, procès-verbal, pièces annexes. Téléchargeables par tout membre du CS."
        />
        <div className="px-5 py-4">
          {(ag.documents || []).length === 0 ? (
            <p className="text-sm text-slate-500">Aucun document.</p>
          ) : (
            <ul className="space-y-2">
              {[...(ag.documents || [])]
                // Convocation d'abord, PV ensuite, le reste après : l'ordre dans
                // lequel on les cherche, et l'ordre chronologique de la vie d'une AG.
                .sort((a, b) => (DOC_ORDRE[a.categorie] ?? 9) - (DOC_ORDRE[b.categorie] ?? 9))
                .map((doc) => (
                  <li key={doc.id || doc.path} className="flex items-center gap-2">
                    <Badge tone={doc.categorie === 'pv' ? 'green' : doc.categorie === 'convocation' ? 'blue' : 'gray'}>
                      {DOC_CATEGORIES[doc.categorie] || 'Autre'}
                    </Badge>
                    <button type="button" onClick={() => ouvrirDoc(doc)} className="flex min-w-0 flex-1 cursor-pointer items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-navy-50/50">
                      <span className="truncate text-navy-700">{doc.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-slate-400">{Math.round((doc.size || 0) / 1024)} Ko</span>
                    </button>
                    {canManage && (
                      <button type="button" onClick={() => retirerDoc(doc)} className="shrink-0 text-xs text-red-600 underline">Retirer</button>
                    )}
                  </li>
                ))}
            </ul>
          )}
          {docUpload && <div className="mt-2"><UploadProgress value={docUpload.value} name={docUpload.name} /></div>}
          {canManage && (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Select label="Type de document" value={docCategorie} onChange={(e) => setDocCategorie(e.target.value)} className="w-56">
                {Object.entries(DOC_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Select>
              <label className={`inline-flex items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 ${docUpload ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-navy-100'}`}>
                + Ajouter un fichier
                <input type="file" className="hidden" disabled={Boolean(docUpload)} onChange={ajouterDoc} />
              </label>
              <p className="text-xs text-slate-400">
                {Math.round(MAX_DOC_BYTES / 1024 / 1024)} Mo par fichier{BACKEND === 'mock' ? ' en mode démo' : ''}.
              </p>
            </div>
          )}
          {docError && <p className="mt-2 text-xs text-red-600">{docError}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Résolutions"
          subtitle="À voter tant que l’AG ne s’est pas tenue, puis résultat du vote (au prorata des superficies — détail au PV)."
          actions={canManage && !agFrozen && <Button size="sm" onClick={() => setResModal({ numero: String(nextResolutionNumero(ag.resolutions)), majorite_requise: 'simple', statut: 'a_voter', titre: '', description: '', budget_alloue: '', budget_intitule: '', m2_pour: '', m2_contre: '', m2_abstention: '', observations: '' })}>+ Résolution</Button>}
        />
        {/* Récapitulatif des enveloppes votées : ce qui est affecté, ce qui reste
            à affecter. Répond d'un coup d'œil à « où en est-on après l'AG ? »,
            qui demandait jusqu'ici de parcourir toutes les lignes. */}
        {adoptees.length > 0 && (
          <div className="border-b border-navy-50 bg-navy-50/40 px-5 py-2.5 text-xs text-slate-600">
            Enveloppes adoptées : <strong className="text-navy-800">{eur(montantAffecte + montantLibre)}</strong>
            {' '}— dont <strong className="text-emerald-800">{eur(montantAffecte)}</strong> affectés à des projets
            {montantLibre > 0
              ? <> et <strong className="text-amber-800">{eur(montantLibre)}</strong> encore à affecter.</>
              : <> ; tout est affecté.</>}
          </div>
        )}
        {voteError && <p className="border-b border-red-100 bg-red-50 px-5 py-2 text-xs text-red-700">{voteError}</p>}
        <div className="divide-y divide-navy-50">
          {ag.resolutions.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-500">Aucune résolution.</p>}
          {ag.resolutions.map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800">
                    Résolution n° {numeroResolution(r)} — {r.titre}
                    {/* Numéro de garage : la résolution a été déplacée pour
                        libérer son numéro. Elle est en fin de liste ; sans cette
                        mention, personne ne saurait pourquoi elle porte un 101. */}
                    {estGaree(r.numero) && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">à renuméroter</span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {/* Le résultat du vote, modifiable sur place tant que rien ne
                      s'y oppose. Sinon le badge, plus la RAISON du blocage. */}
                  {canManage && !agFrozen && !voteVerrou(r) ? (
                    <select
                      value={r.statut}
                      disabled={voteBusy === r.id}
                      onChange={(e) => changerVote(r, e.target.value)}
                      aria-label={`Résultat du vote de la résolution n° ${numeroResolution(r)}`}
                      className="rounded border border-navy-200 bg-white px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                    >
                      {RESOLUTION_STATUT_VALUES.map((s) => (
                        <option key={s} value={s}>{RESOLUTION_STATUT_LABELS[s]}</option>
                      ))}
                    </select>
                  ) : (
                    <ResolutionStatutBadge statut={r.statut} />
                  )}
                  {canManage && !agFrozen && (() => {
                    const v = voteVerrou(r)
                    if (!v) return <button onClick={() => setResModal(r)} className="text-xs text-navy-600 underline">Modifier</button>
                    return (
                      <span className="max-w-[15rem] text-right text-xs text-slate-400">
                        🔒 {v.message}
                        {/* Blocage DUR : ouvrir la modale ne montrerait qu'une
                            erreur. On n'ouvre donc pas — mais on DIT par où sortir,
                            au lieu d'un cadenas muet. */}
                        {!v.dur && <> · <button onClick={() => setResModal(r)} className="text-navy-600 underline">ouvrir</button></>}
                        {v.sortie && <span className="mt-0.5 block text-slate-400">{v.sortie}</span>}
                      </span>
                    )
                  })()}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                <Badge tone="gray">{MAJORITE_LABELS[r.majorite_requise]}</Badge>
                {r.budget_alloue != null && r.budget_alloue !== '' && (
                  <span className="font-medium text-navy-700">Budget : {eur(r.budget_alloue)}{r.budget_intitule ? ` · ${r.budget_intitule}` : ''}</span>
                )}
                {/* Le rattachement se pilote ICI : l'AG vote l'enveloppe, puis on
                    décide si elle ouvre un projet ou en abonde un existant. */}
                {peutFinancer(r) && r.projet_id && (
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-800">
                    {/* ⚠ DEUX MONTANTS, et ce ne sont pas les mêmes : ce que CETTE
                        résolution apporte, et le budget TOTAL du projet — plusieurs
                        résolutions peuvent l'abonder, y compris d'autres AG. Sans le
                        second, on croit que l'enveloppe votée ici est tout le budget. */}
                    Finance <Link to={`/projets/${r.projet_id}`} className="font-medium underline">{projetById[r.projet_id]?.nom || 'projet'}</Link>
                    {' '}· apport <strong>{eur(r.budget_alloue)}</strong>
                    {projetById[r.projet_id] && <> · budget du projet {eur(projetById[r.projet_id].alloue)}</>}
                    {canManage && (
                      <button onClick={() => setRattachModal(r)} className="ml-2 underline">changer</button>
                    )}
                  </span>
                )}
                {peutFinancer(r) && !r.projet_id && (
                  <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-800">
                    Enveloppe <strong>{eur(r.budget_alloue)}</strong> non affectée
                    {canManage && (
                      <>
                        {' '}·{' '}
                        <Link to={`/projets/nouveau?resolution=${r.id}`} className="underline">ouvrir un projet</Link>
                        {projets.length > 0 && (
                          <> ou <button onClick={() => setRattachModal(r)} className="underline">rattacher à un projet</button></>
                        )}
                      </>
                    )}
                  </span>
                )}
              </div>
              {/* RÉPARTITION DU VOTE au prorata des superficies. Affichée seulement
                  si le PV en donne le détail — la plupart des résolutions n'en ont
                  pas, et une ligne vide encombrerait. */}
              {(() => {
                const rep = repartitionVote(r, ag, m2TotalCourant)
                if (!rep) return null
                const incoherent = voteIncoherent(r, ag, m2TotalCourant)
                return (
                  <div className="mt-2 rounded border border-navy-100 bg-navy-50/40 px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-emerald-800">Pour <strong>{num(rep.pour)} m²</strong>{rep.pourPct != null && <> · {pct(rep.pourPct)}</>}</span>
                      <span className="text-red-800">Contre <strong>{num(rep.contre)} m²</strong>{rep.contrePct != null && <> · {pct(rep.contrePct)}</>}</span>
                      <span className="text-slate-600">Abstention <strong>{num(rep.abstention)} m²</strong>{rep.abstentionPct != null && <> · {pct(rep.abstentionPct)}</>}</span>
                      {/* ⚠ L'écart : des m² qui n'ont pris part à aucun vote sur
                          cette résolution. Le taire ferait croire que tout le monde
                          s'est prononcé. */}
                      {rep.nonExprime > 0 && (
                        <span className="text-slate-400">Non exprimés {num(rep.nonExprime)} m²</span>
                      )}
                    </div>
                    {/* ⚠ Le dénominateur est DIT, jamais sous-entendu : à la majorité
                        simple il est le total présent et représenté, ailleurs le
                        total du lotissement. Un pourcentage dont on ignore la base
                        n'est pas vérifiable. */}
                    <p className="mt-1 text-slate-400">
                      {rep.base
                        ? <>Pourcentages calculés sur {num(rep.base)} m², soit {rep.libelle}.</>
                        : <>Pourcentages non calculables : {rep.libelle} non renseigné.</>}
                    </p>
                    {incoherent && (
                      <p className="mt-1 font-medium text-amber-700">
                        ⚠ Les m² exprimés ({num(rep.exprimes)}) dépassent les m² présents ou
                        représentés ({num(ag.m2_presents)}). Une des deux saisies est fausse — le
                        procès-verbal tranche.
                      </p>
                    )}
                  </div>
                )
              })()}
              {r.observations && <p className="mt-2 text-xs italic text-slate-400">{r.observations}</p>}
              {/* PJ téléchargeables par tout membre (les non-gestionnaires n'ouvrent
                  pas la modale d'édition). */}
              {(r.documents || []).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Pièces jointes</span>
                  {r.documents.map((doc) => (
                    <button key={doc.id || doc.path} type="button" onClick={() => downloadDocument(doc)} className="text-xs text-navy-600 underline">{doc.name}</button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {resModal && (
        <ResolutionModal ag={ag} resolution={resModal} onClose={() => setResModal(null)} onSaved={async () => { setResModal(null); await reload() }} />
      )}
      {rattachModal && (
        <RattachementModal
          resolution={rattachModal}
          projets={projets}
          onClose={() => setRattachModal(null)}
          onSaved={async () => { setRattachModal(null); await reload() }}
        />
      )}
      {pvModal && (
        <PVModal
          mode={pvModal}
          ag={ag}
          delaiMois={delaiContestation}
          onClose={() => setPvModal(null)}
          onSaved={async () => { setPvModal(null); await reload() }}
        />
      )}
      {confirmModal}
    </div>
  )
}

// ---------------------------------------------------------------- PV / contestation
// Deux actes distincts, une seule modale : ils portent tous deux une DATE et une
// conséquence sur le délai, et les séparer aurait dupliqué l'explication qui les
// rend compréhensibles.
function PVModal({ mode, ag, delaiMois, onClose, onSaved }) {
  const envoi = mode === 'envoi'
  const [dateISO, setDateISO] = useState(envoi ? (ag.date_envoi_pv || todayISO()) : todayISO())
  const [objet, setObjet] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Échéance recalculée à chaque frappe : on montre la conséquence AVANT de
  // valider, parce que c'est elle qui figera l'assemblée.
  const echeance = echeanceContestation({ date_envoi_pv: dateISO }, delaiMois)

  const save = async () => {
    setError('')
    if (!dateISO) return setError('La date est obligatoire.')
    setSaving(true)
    try {
      if (envoi) await repo.updateAG(ag.id, { statut: 'pv_envoye', date_envoi_pv: dateISO })
      else await repo.updateAG(ag.id, { contestation_le: dateISO, contestation_objet: objet.trim() || null })
      await onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={envoi ? 'Envoi officiel du procès-verbal' : 'Inscrire une contestation'}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></>}
    >
      <div className="space-y-3">
        <Input
          label={envoi ? 'Date d’envoi officiel' : 'Date de la contestation'}
          type="date"
          value={dateISO}
          onChange={(e) => setDateISO(e.target.value)}
          required
        />
        {envoi ? (
          <p className="text-xs text-slate-600">
            C’est cette date qui fait courir le délai de contestation, <strong>pas celle de la
            séance</strong>. L’assemblée sera contestable jusqu’au{' '}
            <strong>{echeance ? formatDate(echeance) : '…'}</strong> ({delaiMois} mois).
            {' '}Passé ce terme sans contestation inscrite, elle sera <strong>close de plein droit</strong>
            {' '}et <strong>figée</strong> : ni l’AG ni ses résolutions ne seront plus modifiables.
          </p>
        ) : (
          <>
            <Input label="Objet (bref)" value={objet} onChange={(e) => setObjet(e.target.value)} placeholder="ex : contestation de la résolution n° 3" />
            <p className="text-xs text-slate-600">
              L’inscription d’une contestation <strong>suspend la clôture de plein droit</strong>, sans
              limite de temps. L’application ne se prononce pas sur son bien-fondé : quand l’affaire est
              vidée, le président clôture à la main ou retire la contestation.
            </p>
          </>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

// Rattache l'enveloppe d'une résolution à un projet — ou l'en détache.
// Une résolution ne pointant qu'un projet, choisir en remplace un autre : la règle
// « une résolution ne finance qu'un projet » n'a pas à être vérifiée, elle tient à
// la forme de la donnée. L'inverse est libre : plusieurs résolutions par projet.
function RattachementModal({ resolution, projets, onClose, onSaved }) {
  const [projetId, setProjetId] = useState(resolution.projet_id || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      await repo.setResolutionProjet(resolution.id, projetId || null)
      await onSaved()
    } catch (e) {
      setError(e.message)
      setSaving(false)
    }
  }

  const cible = projets.find((p) => p.id === projetId)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Résolution n° ${numeroResolution(resolution)} — rattachement`}
      footer={<><Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</Button></>}
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          L’enveloppe de <strong>{eur(resolution.budget_alloue)}</strong> votée par cette résolution finance :
        </p>
        <Select label="Projet financé" value={projetId} onChange={(e) => setProjetId(e.target.value)}>
          <option value="">— Aucun (enveloppe non affectée) —</option>
          {projets.map((p) => <option key={p.id} value={p.id}>{p.nom}</option>)}
        </Select>
        {cible && (
          <p className="text-xs text-slate-500">
            Budget de « {cible.nom} » après rattachement :{' '}
            <strong>{eur(cible.id === resolution.projet_id ? cible.alloue : cible.alloue + Number(resolution.budget_alloue || 0))}</strong>
            {cible.id !== resolution.projet_id && <> (aujourd’hui {eur(cible.alloue)})</>}
          </p>
        )}
        {!projetId && resolution.projet_id && (
          <p className="text-xs text-amber-700">
            L’enveloppe sera retirée du budget du projet, qui diminuera d’autant. La résolution, elle, reste intacte.
          </p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
  )
}

function ResolutionModal({ ag, resolution, onClose, onSaved }) {
  const editing = Boolean(resolution.id)
  // Le champ N° porte la forme AFFICHÉE (« 10 » ou « 10-1 »), pas les deux
  // entiers stockés : c'est ce que l'utilisateur lit dans le PV, et ce qu'il
  // retape. `parseNumeroResolution` refait la conversion à l'enregistrement.
  const [form, setForm] = useState({ ...resolution, numero: numeroResolution(resolution) })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [upload, setUpload] = useState(null)
  const [confirm, confirmModal] = useConfirm()
  // À la création, l'upload a lieu AVANT que la ligne existe : le chemin doit
  // porter l'id (`resolutions/<id>/…`, migration 025 + 012). On le fixe côté client.
  const [newId] = useState(() => crypto.randomUUID())
  const entityId = editing ? resolution.id : newId
  const docs = form.documents || []
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  // Même patron que ProjetForm : « Retirer » n'efface pas l'objet du bucket
  // (orphelin assumé — annuler ensuite laisserait un chemin mort).
  const onFile = async (e) => {
    setError('')
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_DOC_BYTES) {
      const mo = Math.round(MAX_DOC_BYTES / 1024 / 1024)
      return setError(`Fichier trop volumineux (max ${mo} Mo${BACKEND === 'mock' ? ' en mode démo' : ''}).`)
    }
    setUpload({ name: file.name, value: 0 })
    try {
      const record = await repo.uploadDocument('resolutions', entityId, file, (value) => setUpload((u) => (u ? { ...u, value } : u)))
      setForm((f) => ({ ...f, documents: [...(f.documents || []), record] }))
    } catch (err) {
      setError(`Envoi du fichier impossible : ${err.message}`)
    } finally {
      setUpload(null)
    }
  }

  const save = async () => {
    setError('')
    // Le numéro se SAISIT (2026-08-26) : il doit reprendre celui de la
    // convocation, pas la position d'entrée dans l'app. On valide ici plutôt que
    // de laisser remonter la violation de `unique (ag_id, numero)` — le message
    // de Postgres serait illisible pour un membre du CS.
    // « 10 » ou « 10-1 » — le second cas quand UNE résolution du PV donne
    // plusieurs lignes ici, faute de pouvoir ventiler un budget sur plusieurs
    // projets depuis une seule (migration 032).
    const parsed = parseNumeroResolution(form.numero)
    if (!parsed) {
      return setError('Numéro attendu sous la forme « 10 », ou « 10-1 » quand une résolution du PV se ventile sur plusieurs projets.')
    }
    const { numero: num, sous_numero: sous } = parsed
    // Numéro déjà pris : plutôt que de bloquer, on GARE l'occupante au-dessus de
    // 100 (cf. agLogic). Sans ça, renuméroter selon la convocation obligeait à
    // libérer le numéro d'abord, donc à renuméroter l'autre, qui butait à son
    // tour — un blocage en chaîne pour une simple frappe.
    //
    // Jamais en silence : le déplacement touche une AUTRE résolution que celle
    // qu'on édite, on demande donc confirmation en nommant les deux.
    const occupe = (ag.resolutions || []).find((r) => r.numero === num && (r.sous_numero || 0) === sous && r.id !== resolution?.id)
    if (occupe) {
      const garage = numeroGarageLibre(ag.resolutions || [])
      const suite = await confirm({
        title: `Le numéro ${numeroResolution(occupe)} est déjà pris`,
        message: `« ${occupe.titre} » porte déjà le n° ${numeroResolution(occupe)}. En continuant, elle passe au n° ${garage} et part en fin de liste, marquée « à renuméroter » — à vous de lui donner son vrai numéro ensuite.`,
        confirmLabel: `Continuer et déplacer au n° ${garage}`,
      })
      if (!suite) return
      try {
        // Libérer AVANT d'enregistrer : dans l'autre sens, l'unicité refuserait.
        await repo.updateResolution(occupe.id, { numero: garage, sous_numero: 0 })
      } catch (e) {
        // Cas réel : l'occupante est verrouillée (décision ou projet rattaché).
        // On ne peut alors ni la déplacer, ni prendre son numéro — le dire.
        return setError(`Le n° ${numeroResolution(occupe)} ne peut pas être libéré : « ${occupe.titre} » n’est plus modifiable (${e.message}) Choisissez un autre numéro.`)
      }
    }
    setSaving(true)
    const payload = {
      ag_id: ag.id,
      numero: num,
      sous_numero: sous,
      titre: form.titre,
      description: form.description,
      majorite_requise: form.majorite_requise,
      statut: form.statut,
      budget_alloue: parseMontant(form.budget_alloue),
      budget_intitule: form.budget_intitule || null,
      // m² du vote (054). ⚠ `parseMontant` rend null sur une chaîne vide : un champ
      // laissé vide reste « non renseigné », il ne devient pas zéro — un zéro
      // affirmerait que personne n'a voté ainsi, ce que le PV ne dit pas.
      m2_pour: parseMontant(form.m2_pour),
      m2_contre: parseMontant(form.m2_contre),
      m2_abstention: parseMontant(form.m2_abstention),
      observations: form.observations,
      documents: docs,
    }
    // Id explicite à la création : les PJ ont déjà été téléversées sous
    // resolutions/<newId>/, la ligne doit donc porter ce même id.
    if (!editing) payload.id = newId
    try {
      if (editing) await repo.updateResolution(resolution.id, payload)
      else await repo.createResolution(payload)
      await onSaved()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    if (!(await confirm({ title: 'Supprimer cette résolution ?', message: 'La résolution sera définitivement supprimée.', confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await repo.deleteResolution(resolution.id)
      await onSaved()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <>
    <Modal
      open onClose={onClose} wide
      title={editing ? `Résolution n° ${form.numero}` : 'Nouvelle résolution'}
      footer={<>{editing && <Button variant="danger" onClick={del} className="mr-auto">Supprimer</Button>}<Button variant="secondary" onClick={onClose}>Annuler</Button><Button onClick={save} disabled={saving || Boolean(upload) || !form.titre || !form.numero}>{saving ? '…' : 'Enregistrer'}</Button></>}
    >
      <div className="space-y-3">
        {/* Numéro SAISISSABLE : il doit reprendre celui de la convocation, que
            l'ordre de saisie dans l'app ne reproduit pas forcément (on entre
            souvent les résolutions dans le désordre, ou on en insère une après
            coup). Pré-rempli avec « le suivant » à la création, par commodité.
            Les résolutions sont affichées triées par numéro — c'est déjà le cas
            des deux côtés (mock et Supabase). */}
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <Input label="N°" value={form.numero ?? ''} onChange={set('numero')} required placeholder="10 ou 10-1" />
          <Input label="Titre" value={form.titre} onChange={set('titre')} required />
        </div>
        <Textarea label="Description" value={form.description} onChange={set('description')} rows={3} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Majorité requise" value={form.majorite_requise} onChange={set('majorite_requise')}>
            {MAJORITE_VALUES.map((v) => <option key={v} value={v}>{MAJORITE_LABELS[v]}</option>)}
          </Select>
          <Select label="Statut / résultat" value={form.statut} onChange={set('statut')}>
            {RESOLUTION_STATUT_VALUES.map((v) => <option key={v} value={v}>{RESOLUTION_STATUT_LABELS[v]}</option>)}
          </Select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* type="text" : voir DecisionForm — évite la molette (19999.99) et
              accepte le format suisse « 20'000 ». */}
          <Input label="Budget alloué (€) — optionnel" type="text" inputMode="decimal" value={form.budget_alloue ?? ''} onChange={set('budget_alloue')} placeholder="ex : 20'000" />
          <Input label="Intitulé du budget" value={form.budget_intitule || ''} onChange={set('budget_intitule')} />
        </div>
        {/* m² du vote — FACULTATIFS. Beaucoup de PV ne donnent pas le détail, et
            l'application n'a pas à l'exiger : elle constate ce que le PV dit. */}
        <fieldset className="rounded-md border border-navy-100 p-3">
          <legend className="px-1 text-xs font-medium uppercase tracking-wide text-slate-500">
            Détail du vote en m² — optionnel
          </legend>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="m² pour" type="text" inputMode="decimal" value={form.m2_pour ?? ''} onChange={set('m2_pour')} />
            <Input label="m² contre" type="text" inputMode="decimal" value={form.m2_contre ?? ''} onChange={set('m2_contre')} />
            <Input label="m² abstention" type="text" inputMode="decimal" value={form.m2_abstention ?? ''} onChange={set('m2_abstention')} />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {form.majorite_requise === 'simple'
              ? 'Majorité simple : les pourcentages seront calculés sur les m² présents ou représentés de la séance.'
              : `${MAJORITE_LABELS[form.majorite_requise]} : les pourcentages seront calculés sur le total des m² du lotissement figé pour cette séance.`}
            {/* La règle de l'unanimité mérite d'être rappelée là où on saisit :
                l'absence y fait obstacle autant qu'un vote contre, ce qui n'est
                pas intuitif quand on vient de compter les voix d'une séance. */}
            {form.majorite_requise === 'unanimite' && (
              <> <strong>Tous les colotis doivent approuver</strong> : un vote contre, une abstention
              ou une non-participation suffit à empêcher l’unanimité.</>
            )}
            {' '}L’application <strong>affiche</strong> ces pourcentages ; elle ne décide pas du résultat,
            que vous posez vous-même ci-dessus.
          </p>
        </fieldset>
        <Textarea label="Observations" value={form.observations || ''} onChange={set('observations')} rows={2} />
        <div>
          <span className="mb-1 block text-sm font-medium text-slate-700">Pièces jointes</span>
          <div className="space-y-2">
            {docs.map((doc) => (
              <div key={doc.id || doc.path} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                <button type="button" onClick={() => downloadDocument(doc)} className="truncate text-left text-navy-700 hover:underline">{doc.name} <span className="text-xs text-slate-400">({Math.round((doc.size || 0) / 1024)} Ko)</span></button>
                <button type="button" onClick={() => setForm((f) => ({ ...f, documents: (f.documents || []).filter((x) => (x.id || x.path) !== (doc.id || doc.path)) }))} className="ml-2 shrink-0 text-xs text-red-600 underline">Retirer</button>
              </div>
            ))}
            {upload && <UploadProgress value={upload.value} name={upload.name} />}
            <label className={`inline-flex items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 ${upload ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-navy-100'}`}>
              + Ajouter un fichier
              <input type="file" className="hidden" disabled={Boolean(upload)} onChange={onFile} />
            </label>
            <p className="text-xs text-slate-400">{Math.round(MAX_DOC_BYTES / 1024 / 1024)} Mo par fichier{BACKEND === 'mock' ? ' en mode démo' : ''}.</p>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </Modal>
    {confirmModal}
    </>
  )
}
