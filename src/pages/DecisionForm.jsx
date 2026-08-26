import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, eur, DesktopOnly, UploadProgress } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import { engagementTTC, phaseOf, avantSoumission, PHASE_LABELS, VISIBILITE_VALUES, VISIBILITE_LABELS } from '../lib/decisionLogic'
import { todayISO, addBusinessDaysISO, parseMontant, formatDateTime, toDateTimeLocal, fromDateTimeLocal } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { PROJET_ACTION_VALUES, PROJET_ACTION_LABELS, PROJET_ACTION_STATUT, PROJET_STATUT_LABELS } from '../lib/projetLogic'
import { MAX_DOC_BYTES, BACKEND } from '../lib/config'

export default function DecisionForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const isMobile = useIsMobile()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [blocked, setBlocked] = useState('')
  const [numero, setNumero] = useState('')
  const [datePublication, setDatePublication] = useState(todayISO())
  const [dateLimite, setDateLimite] = useState(addBusinessDaysISO(todayISO(), 7))
  const [limiteEdited, setLimiteEdited] = useState(false)
  const [titre, setTitre] = useState('')
  const [description, setDescription] = useState('')
  // Cible d'engagement : '' | 'projet:<id>' | 'resolution:<id>'
  const [target, setTarget] = useState('')
  const [montantEngage, setMontantEngage] = useState('')
  // TVA sur l'engagement : taux saisi (%) + le montant est-il HT ou TTC. L'app en
  // déduit le TTC (le budget d'AG est TTC). Défaut : 20 % HT (le devis est souvent HT).
  const [tvaTaux, setTvaTaux] = useState('20')
  const [tvaIncluse, setTvaIncluse] = useState(false)
  // Effet sur le statut du projet ('' | suspendre | reprendre | terminer).
  const [projetAction, setProjetAction] = useState('')
  const [documents, setDocuments] = useState([])
  // null = aucun envoi en cours ; sinon { name, value } avec value entre 0 et 1.
  const [upload, setUpload] = useState(null)
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [error, setError] = useState('')

  // ---- Cycle de vie (migration 026) ----
  // `phase` = la phase ACTUELLE de la décision éditée ; une création part
  // toujours de 'brouillon' (c'est le bouton cliqué qui décide de la suite).
  const [phase, setPhase] = useState('brouillon')
  const [dateSoumission, setDateSoumission] = useState('') // valeur d'un <input datetime-local>
  const [delaiVote, setDelaiVote] = useState('7')
  const [visibilite, setVisibilite] = useState('cs_seul')
  const [version, setVersion] = useState(1)
  const [gele, setGele] = useState(false) // le texte a été figé à l'ouverture du vote
  const [soumiseLe, setSoumiseLe] = useState(null)
  const [dernierAuteur, setDernierAuteur] = useState('')

  // L'id de la décision est tiré ICI, pas par Postgres, parce qu'une pièce
  // jointe est téléversée AVANT que la ligne existe et que son chemin dans le
  // bucket doit porter cet id (`decisions/<id>/…`, migration 012). `useState`
  // avec initialiseur : un seul id pour toute la vie du formulaire, alors qu'un
  // appel direct en tirerait un neuf à chaque rendu.
  const [newId] = useState(() => crypto.randomUUID())
  const entityId = editing ? id : newId

  useEffect(() => {
    async function init() {
      const [projs, budgets, membres] = await Promise.all([
        repo.listProjets().catch(() => []),
        repo.listAGBudgets().catch(() => []),
        repo.listMembres().catch(() => []),
      ])
      setProjets(projs)
      setAgBudgets(budgets)
      if (editing) {
        const d = await repo.getDecision(id)
        // `null` = inexistante, OU brouillon d'un autre membre (invisible depuis
        // la migration 026). Le distinguer serait précisément révéler ce qu'on
        // cache — on répond « introuvable », comme la base.
        if (!d) setBlocked('introuvable')
        if (d) {
          if (d.enregistree) setBlocked('locked')
          else if (phaseOf(d) === 'annulee') setBlocked('annulee')
          else if (d.created_by && d.created_by !== user?.membre_id) setBlocked('notowner')
          setNumero(d.numero)
          setDatePublication(d.date_publication)
          setDateLimite(d.date_limite_reponse || '')
          setLimiteEdited(true)
          setTitre(d.titre)
          setDescription(d.description)
          setMontantEngage(d.montant_engage ?? '')
          setTvaTaux(d.tva_taux != null ? String(d.tva_taux) : '20')
          setTvaIncluse(d.tva_incluse ?? true) // décisions héritées (null) : traitées TTC, pas de gonflement
          setDocuments(d.documents || [])
          if (d.projet_id) setTarget(`projet:${d.projet_id}`)
          else if (d.resolution_id) setTarget(`resolution:${d.resolution_id}`)
          setProjetAction(d.projet_action || '')
          setPhase(phaseOf(d))
          setDateSoumission(toDateTimeLocal(d.date_soumission_prevue))
          setDelaiVote(String(d.delai_vote_jours ?? 7))
          setVisibilite(d.visibilite || 'cs_seul')
          setVersion(d.version || 1)
          setGele(d.contenu_gele != null)
          setSoumiseLe(d.soumise_le || null)
          // « Dernier auteur » (spec §7) : celui de la dernière version du
          // brouillon si le texte a été repris, le créateur sinon.
          const derniere = (d.historique || [])[d.historique.length - 1]
          const auteurId = derniere?.modifie_par || d.created_by
          const m = membres.find((x) => x.id === auteurId)
          setDernierAuteur(m ? `${m.prenom} ${m.nom}` : '')
        }
      } else {
        // Le numéro se demande au REPO, il ne se calcule plus ici : les
        // brouillons des autres membres sont invisibles (migration 026), donc un
        // « max + 1 » sur les décisions visibles retomberait sur un numéro déjà
        // pris. Côté Supabase, c'est une fonction `security definer` qui voit
        // toutes les lignes sans les exposer.
        setNumero(await repo.prochainNumeroDecision(new Date().getFullYear()))
        const m = membres.find((x) => x.id === user?.membre_id)
        setDernierAuteur(m ? `${m.prenom} ${m.nom}` : '')
      }
      setLoading(false)
    }
    init()
  }, [id, editing, user])

  useEffect(() => {
    if (!limiteEdited && datePublication) setDateLimite(addBusinessDaysISO(datePublication, 7))
  }, [datePublication, limiteEdited])

  const [kind, targetId] = target ? target.split(':') : ['', '']
  const selProjet = useMemo(() => (kind === 'projet' ? projets.find((p) => p.id === targetId) : null), [kind, targetId, projets])
  const selRes = useMemo(() => (kind === 'resolution' ? agBudgets.find((b) => b.resolution_id === targetId) : null), [kind, targetId, agBudgets])

  // Une enveloppe rattachée à un projet y est passée EN ENTIER : son restant est nul
  // et un engagement direct dessus serait forcément refusé. On ne la propose donc
  // pas — l'engagement se fait sur le projet. Exception : la cible déjà choisie par
  // la décision qu'on édite, sinon elle disparaîtrait de son propre formulaire.
  const engageablesDirect = useMemo(
    () => agBudgets.filter((b) => !b.projet_id || b.resolution_id === targetId),
    [agBudgets, targetId],
  )

  // Restant disponible sur la cible (en réintégrant l'engagement de CETTE décision si on l'édite).
  const restantDispo = useMemo(() => {
    const src = selProjet || selRes
    if (!src) return null
    const own = editing ? (src.engagements?.find((e) => e.id === id && e.enregistree && e.statut === 'adoptee')?.montant || 0) : 0
    return src.restant + own
  }, [selProjet, selRes, editing, id])

  // Une décision pas encore soumise (brouillon ou planifiée) : ses dates de
  // publication et de limite de réponse n'ont pas de sens tant que le vote n'est
  // pas ouvert — elles sont REPOSÉES au jour de l'ouverture réelle. On ne les
  // montre donc pas : les faire saisir reviendrait à faire écrire une date fausse.
  const enPreparation = avantSoumission({ phase })

  if (isMobile) {
    return (
      <div>
        <PageHeader title={editing ? 'Modifier la décision' : 'Nouvelle décision'} />
        <DesktopOnly what="La création et la modification des décisions" onBack={() => navigate(-1)} />
      </div>
    )
  }
  if (loading) return <Spinner />
  if (blocked === 'locked') {
    return (
      <div>
        <PageHeader title="Décision enregistrée" />
        <Card className="p-6 text-sm text-slate-600">Cette décision est enregistrée : elle n’est plus modifiable. <button className="text-navy-600 underline" onClick={() => navigate(`/registre/${id}`)}>Retour au détail</button></Card>
      </div>
    )
  }
  if (blocked === 'annulee') {
    return (
      <div>
        <PageHeader title="Décision annulée" />
        <Card className="p-6 text-sm text-slate-600">Cette décision a été annulée avant l’ouverture du vote : elle reste au registre avec son motif, mais n’est plus modifiable. <button className="text-navy-600 underline" onClick={() => navigate(`/registre/${id}`)}>Retour au détail</button></Card>
      </div>
    )
  }
  if (blocked === 'introuvable') {
    return (
      <div>
        <PageHeader title="Décision introuvable" />
        <Card className="p-6 text-sm text-slate-600">Cette décision n’existe pas, ou n’est pas accessible depuis votre compte. <button className="text-navy-600 underline" onClick={() => navigate('/registre')}>Retour au registre</button></Card>
      </div>
    )
  }
  if (blocked === 'notowner') {
    return (
      <div>
        <PageHeader title="Accès restreint" />
        <Card className="p-6 text-sm text-slate-600">Seul le créateur de la décision peut la modifier. <button className="text-navy-600 underline" onClick={() => navigate(`/registre/${id}`)}>Retour au détail</button></Card>
      </div>
    )
  }

  // Le fichier part dans le bucket dès qu'il est choisi, pas à la soumission :
  // le membre voit tout de suite si l'envoi passe, et le formulaire ne garde
  // qu'un chemin.
  //
  // ⚠ Contrepartie assumée : un fichier téléversé puis abandonné (formulaire
  // quitté, ou « Retirer » ci-dessous) reste dans le bucket, orphelin. « Retirer »
  // ne supprime volontairement PAS l'objet — annuler ensuite le formulaire
  // laisserait sinon la ligne enregistrée avec un chemin mort. Quelques Mo perdus
  // sur 1 Go valent mieux qu'un devis introuvable dans un registre légal.
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
      const record = await repo.uploadDocument('decisions', entityId, file, (value) =>
        setUpload((u) => (u ? { ...u, value } : u)),
      )
      setDocuments((docs) => [...docs, record])
    } catch (err) {
      setError(`Envoi du fichier impossible : ${err.message}`)
    } finally {
      setUpload(null)
    }
  }

  // `action` (migration 026) : ce n'est pas « enregistrer un formulaire », c'est
  // un ACTE, et l'acte détermine la phase visée.
  //   'garder'    — je continue à rédiger : la phase actuelle est conservée
  //                 (brouillon, ou planifiée si une date était déjà fixée — sauver
  //                 une correction ne doit pas déplanifier au passage)
  //   'planifier' — je fixe la date à laquelle le vote s'ouvrira tout seul
  //   'soumettre' — j'ouvre le vote maintenant (le texte est alors GELÉ)
  //   null        — décision déjà ouverte : simple mise à jour, phase inchangée
  const submit = async (e, action) => {
    e.preventDefault()
    setError('')
    if (!titre.trim()) return setError('Le titre est obligatoire.')
    const soumissionISO = fromDateTimeLocal(dateSoumission)
    const phaseVisee = action === 'soumettre' ? 'ouverte_au_vote' : action === 'planifier' ? 'planifiee' : phase
    if (phaseVisee === 'planifiee') {
      if (!soumissionISO) return setError('Indiquez la date et l’heure d’ouverture du vote.')
      if (new Date(soumissionISO) <= new Date()) {
        return setError('La date d’ouverture doit être dans le futur. Pour ouvrir le vote tout de suite, utilisez « Soumettre au vote maintenant ».')
      }
    }
    const engage = parseMontant(montantEngage)
    // Le budget (enveloppe AG) est TTC : la consommation se compare en TTC.
    const engageTTC = engage == null ? null : engagementTTC({ montant_engage: engage, tva_taux: Number(tvaTaux), tva_incluse: tvaIncluse })
    if (engage != null && !target) return setError('Pour engager un montant, choisissez un projet ou une résolution.')
    if (engageTTC != null && restantDispo != null && engageTTC > restantDispo) {
      return setError(`Coût TTC engagé (${eur(engageTTC)}) supérieur au disponible (${eur(restantDispo)}).`)
    }
    // Résout la cible en projet_id / resolution_id / ag_id.
    // Un projet peut être financé par plusieurs AG : `ag_id` ne vaut que s'il n'y
    // en a qu'une. Sinon on le laisse vide plutôt que d'en élire une arbitrairement
    // — l'AG d'origine se lit sur la fiche projet, qui les montre toutes.
    let projet_id = null, resolution_id = null, ag_id = null
    if (kind === 'projet' && selProjet) {
      projet_id = selProjet.id
      ag_id = selProjet.ags?.length === 1 ? selProjet.ags[0].id : null
    } else if (kind === 'resolution' && selRes) {
      resolution_id = selRes.resolution_id
      ag_id = selRes.ag_id || null
    }
    setSaving(true)
    try {
      const payload = {
        titre,
        description: description && description !== '<br>' ? description : '',
        projet_id,
        resolution_id,
        ag_id,
        montant_engage: engage,
        // TVA : n'a de sens que s'il y a un engagement. Sinon on remet à null.
        tva_taux: engage != null ? (Number(tvaTaux) || 0) : null,
        tva_incluse: engage != null ? tvaIncluse : null,
        // N'a de sens que sur un projet : une décision rattachée à une résolution
        // ou à rien ne peut pas suspendre quoi que ce soit.
        projet_action: kind === 'projet' && projetAction ? projetAction : null,
        documents,
        visibilite,
      }

      if (action) {
        // Décision pas encore soumise : la phase visée part avec le contenu, en
        // UNE écriture. C'est le trigger `decisions_cycle_guard` (et son miroir
        // dans le mock) qui gèle le texte, calcule l'empreinte, incrémente la
        // version et RECALE les dates au jour de l'ouverture réelle.
        payload.phase = phaseVisee
        payload.date_soumission_prevue = soumissionISO
        payload.delai_vote_jours = Number(delaiVote) || 7
        // Le brouillon n'a pas de date de publication réelle : on pose celle du
        // jour pour satisfaire la colonne, elle sera reposée à l'ouverture.
        payload.date_publication = editing ? datePublication : todayISO()
        payload.date_limite_reponse = null
      } else {
        payload.date_publication = datePublication
        payload.date_limite_reponse = dateLimite || null
      }

      if (editing) {
        await repo.updateDecision(id, payload)
        navigate(`/registre/${id}`)
      } else {
        // `id` explicite : les pièces jointes ont déjà été téléversées sous
        // `decisions/<newId>/…`. Laisser Postgres en générer un autre mettrait
        // les fichiers hors de portée des policies (migration 012).
        const created = await repo.createDecision({ id: newId, numero, created_by: user?.membre_id ?? null, ...payload })
        navigate(`/registre/${created.id}`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  const titreEcran = editing ? 'Modifier la décision' : 'Nouvelle décision'

  return (
    <div>
      <PageHeader
        title={titreEcran}
        subtitle={
          editing
            ? `${PHASE_LABELS[phase]} · version ${version}${dernierAuteur ? ` · dernière main : ${dernierAuteur}` : ''}`
            : 'La décision part en brouillon : rien n’est soumis au conseil tant que vous ne l’avez pas décidé.'
        }
      />
      <Card className="p-6">
        <form onSubmit={(e) => submit(e, enPreparation ? 'garder' : null)} className="space-y-4">
          {enPreparation ? (
            /* Pas encore soumise au vote : on saisit QUAND le vote s'ouvrira et
               COMBIEN DE TEMPS il restera ouvert — pas des dates de publication,
               qui n'existeront qu'à l'ouverture. */
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Numéro" value={numero} readOnly className="bg-slate-50" />
                <Input
                  label="Ouverture du vote prévue le"
                  type="datetime-local"
                  value={dateSoumission}
                  onChange={(e) => setDateSoumission(e.target.value)}
                />
                <Input
                  label="Durée du vote (jours ouvrés)"
                  type="number"
                  min="1"
                  max="60"
                  value={delaiVote}
                  onChange={(e) => setDelaiVote(e.target.value)}
                />
              </div>
              <p className="-mt-2 text-xs text-slate-400">
                À l’ouverture, la décision est <strong>publiée à cette date-là</strong> — c’est elle qui détermine la
                composition du conseil appelée à voter — et la date limite de réponse est posée à + {Number(delaiVote) || 7} jours ouvrés.
              </p>
            </>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Numéro" value={numero} readOnly className="bg-slate-50" />
                <Input label="Date de publication" type="date" value={datePublication} onChange={(e) => setDatePublication(e.target.value)} required />
                <Input label="Date limite de réponse" type="date" value={dateLimite} onChange={(e) => { setDateLimite(e.target.value); setLimiteEdited(true) }} />
              </div>
              <p className="-mt-2 text-xs text-slate-400">Date limite par défaut : publication + 7 jours ouvrables (modifiable).</p>
            </>
          )}

          {/* Texte GELÉ (migration 026) : une fois le vote ouvert, on ne réécrit
              plus ce sur quoi les membres votent. Les champs deviennent des
              champs de lecture — le refus viendrait de toute façon de la base,
              autant ne pas laisser croire que c'est modifiable. */}
          {gele && (
            <div className="rounded-md border border-navy-200 bg-navy-50/60 px-4 py-3 text-xs text-navy-800">
              <p className="font-semibold">Texte gelé depuis le {formatDateTime(soumiseLe)}</p>
              <p className="mt-1">
                Le titre et le corps de la décision ne sont plus modifiables : les membres votent sur ce texte-là, et son
                empreinte le prouve. Le rattachement, le montant et les pièces jointes restent modifiables jusqu’à l’enregistrement.
              </p>
            </div>
          )}

          <Input label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} required readOnly={gele} className={gele ? 'bg-slate-50' : undefined} placeholder="Objet de la décision" />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-400">(optionnel)</span></span>
            {gele ? (
              <div className="rich-text min-h-[80px] rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: description || '<p class="text-slate-400">—</p>' }} />
            ) : (
              <RichTextEditor value={description} onChange={setDescription} placeholder="Corps de la décision…" />
            )}
          </div>

          {/* Engagement budgétaire : projet ou résolution directe */}
          <div className="rounded-md border border-navy-100 bg-navy-50/40 p-4">
            <p className="mb-3 text-sm font-medium text-navy-800">Rattachement & engagement budgétaire (optionnel)</p>
            <Select label="Rattacher à…" value={target} onChange={(e) => { setTarget(e.target.value); if (!e.target.value) setMontantEngage(''); if (!e.target.value.startsWith('projet:')) setProjetAction('') }}>
              <option value="">— Aucun —</option>
              {projets.length > 0 && (
                <optgroup label="Projets">
                  {projets.map((p) => <option key={p.id} value={`projet:${p.id}`}>{p.nom} (restant {eur(p.restant)})</option>)}
                </optgroup>
              )}
              {engageablesDirect.length > 0 && (
                <optgroup label="Résolutions AG (engagement direct)">
                  {engageablesDirect.map((b) => <option key={b.resolution_id} value={`resolution:${b.resolution_id}`}>{b.ag_numero} · {b.intitule} (restant {eur(b.restant)})</option>)}
                </optgroup>
              )}
            </Select>

            {(selProjet || selRes) && (
              <div className="mt-4">
                <div className="mb-2 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded bg-white px-2 py-1.5"><p className="text-slate-500">Alloué</p><p className="font-semibold text-navy-800">{eur((selProjet || selRes).alloue)}</p></div>
                  <div className="rounded bg-white px-2 py-1.5"><p className="text-slate-500">Déjà engagé</p><p className="font-semibold text-amber-700">{eur((selProjet || selRes).engage)}</p></div>
                  <div className="rounded bg-white px-2 py-1.5"><p className="text-slate-500">Restant</p><p className="font-semibold text-emerald-700">{eur(restantDispo)}</p></div>
                </div>
                {/* type="text" (pas number) À DESSEIN : un input number capte la
                    molette et décrémente la valeur (20000 -> 19999.99), et refuse
                    le format suisse « 20'000 ». inputMode decimal garde le clavier
                    numérique sur mobile ; parseMontant tolère apostrophe/espace. */}
                <Input label="Montant du devis engagé (€)" type="text" inputMode="decimal" value={montantEngage} onChange={(e) => setMontantEngage(e.target.value)} placeholder="ex : 12000 ou 20'000" />
                {parseMontant(montantEngage) != null && (
                  <>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Select label="Taux de TVA" value={tvaTaux} onChange={(e) => setTvaTaux(e.target.value)}>
                        <option value="0">Hors TVA / exonéré (0 %)</option>
                        <option value="5.5">5,5 %</option>
                        <option value="10">10 %</option>
                        <option value="20">20 %</option>
                      </Select>
                      <Select label="Le montant saisi est…" value={tvaIncluse ? 'ttc' : 'ht'} onChange={(e) => setTvaIncluse(e.target.value === 'ttc')}>
                        <option value="ht">Hors taxe (HT) — la TVA s’ajoute</option>
                        <option value="ttc">TVA incluse (TTC)</option>
                      </Select>
                    </div>
                    {(() => {
                      const m = parseMontant(montantEngage)
                      const ttc = engagementTTC({ montant_engage: m, tva_taux: Number(tvaTaux), tva_incluse: tvaIncluse })
                      const over = restantDispo != null && ttc > restantDispo
                      return (
                        <p className={`mt-1 text-xs ${over ? 'font-medium text-red-600' : 'text-slate-600'}`}>
                          Coût <strong>TTC : {eur(ttc)}</strong>{!tvaIncluse && Number(tvaTaux) > 0 ? ` (${eur(m)} HT + ${tvaTaux} % de TVA)` : ''}
                          {over ? ` — dépasse le disponible (${eur(restantDispo)})` : ''}
                        </p>
                      )
                    })()}
                  </>
                )}
              </div>
            )}

            {/* Suspendre ou terminer un projet est une DÉLIBÉRATION : ça se décide
                ici, se vote, et ne prend effet qu'à l'enregistrement. Le formulaire
                projet n'a plus de champ statut. */}
            {selProjet && (
              <div className="mt-4">
                <Select label="Effet sur le projet (optionnel)" value={projetAction} onChange={(e) => setProjetAction(e.target.value)}>
                  <option value="">— Aucun : la décision engage seulement —</option>
                  {PROJET_ACTION_VALUES.map((a) => <option key={a} value={a}>{PROJET_ACTION_LABELS[a]}</option>)}
                </Select>
                {projetAction && (
                  <p className="mt-1 text-xs text-slate-500">
                    « {selProjet.nom} » passera en <strong>{PROJET_ACTION_STATUT[projetAction] ? PROJET_STATUT_LABELS[PROJET_ACTION_STATUT[projetAction]] : 'statut naturel (en préparation ou en cours, selon la date d’ouverture)'}</strong>{' '}
                    une fois cette décision <strong>adoptée et enregistrée</strong> — pas avant. Une décision ultérieure pourra revenir dessus.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Visibilité prévue. ⚠ Aucun effet AUJOURD'HUI : le registre
              consultable par les colotis est hors périmètre (spec §9). Le champ
              existe pour ne pas avoir à redemander l'intention, décision par
              décision, le jour où cet accès sera ouvert. */}
          <div>
            <Select label="Visibilité prévue" value={visibilite} onChange={(e) => setVisibilite(e.target.value)}>
              {VISIBILITE_VALUES.map((v) => <option key={v} value={v}>{VISIBILITE_LABELS[v]}</option>)}
            </Select>
            <p className="mt-1 text-xs text-slate-400">
              Enregistre l’intention. L’accès des colotis au registre n’existe pas encore : aujourd’hui, toute décision
              n’est visible que des membres du CS connectés.
            </p>
          </div>

          {/* Pièces jointes */}
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Pièces jointes (offres, devis…)</span>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate text-slate-700">{doc.name} <span className="text-xs text-slate-400">({Math.round((doc.size || 0) / 1024)} Ko)</span></span>
                  <button type="button" onClick={() => setDocuments((d) => d.filter((x) => x.id !== doc.id))} className="text-xs text-red-600 underline">Retirer</button>
                </div>
              ))}
              {upload && <UploadProgress value={upload.value} name={upload.name} />}
              <label className={`inline-flex items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 ${upload ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-navy-100'}`}>
                + Ajouter un fichier
                <input type="file" className="hidden" disabled={Boolean(upload)} onChange={onFile} />
              </label>
              <p className="text-xs text-slate-400">
                {Math.round(MAX_DOC_BYTES / 1024 / 1024)} Mo par fichier{BACKEND === 'mock' ? ' en mode démo' : ''}.
                {BACKEND === 'supabase' && ' Un gros fichier peut prendre plusieurs minutes sur une connexion mobile.'}
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Trois actes, pas un bouton « Enregistrer » (spec §7). L'acte le plus
              engageant — ouvrir le vote, donc geler le texte — est le seul en
              primaire, et il est annoncé comme tel juste en dessous. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>Annuler</Button>
            {enPreparation ? (
              <>
                <Button type="submit" variant="secondary" disabled={saving || Boolean(upload)}>
                  {saving ? 'Enregistrement…' : phase === 'planifiee' ? 'Enregistrer (reste planifiée)' : 'Enregistrer le brouillon'}
                </Button>
                <Button type="button" variant="secondary" disabled={saving || Boolean(upload)} onClick={(e) => submit(e, 'planifier')}>
                  Planifier la soumission
                </Button>
                <Button type="button" disabled={saving || Boolean(upload)} onClick={(e) => submit(e, 'soumettre')}>
                  Soumettre au vote maintenant
                </Button>
              </>
            ) : (
              <Button type="submit" disabled={saving || Boolean(upload)}>
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </Button>
            )}
          </div>
          {enPreparation && (
            <p className="text-right text-xs text-slate-400">
              Soumettre au vote <strong>gèle le texte</strong> et le rend non modifiable, y compris par vous.
            </p>
          )}
        </form>
      </Card>
    </div>
  )
}
