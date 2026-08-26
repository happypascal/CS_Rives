import { useEffect, useState, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Spinner, Textarea, Input, eur } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { ProjetStatutBadge, DecisionEtatBadge } from '../components/badges'
import { engagementTTC } from '../lib/decisionLogic'
import { formatDate, formatDateTime, todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { downloadDocument } from '../lib/documents'

export default function ProjetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const canManage = isAdmin && !isMobile
  const [projet, setProjet] = useState(null)
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [docError, setDocError] = useState('')
  const [qText, setQText] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [cText, setCText] = useState('')
  // Journal de bord : la date par défaut est aujourd'hui, mais elle se change —
  // c'est le point de la demande, on note souvent après coup.
  const [jDate, setJDate] = useState(todayISO())
  const [jTexte, setJTexte] = useState('')
  const [jEdit, setJEdit] = useState(null) // { id, date_action, texte } en cours de correction
  const [confirm, confirmModal] = useConfirm()

  // Bucket privé : l'URL est signée au clic, un échec doit se voir.
  const openDoc = async (doc) => {
    setDocError('')
    try {
      await downloadDocument(doc)
    } catch (err) {
      setDocError(`« ${doc.name} » n’a pas pu être ouvert : ${err.message}`)
    }
  }

  const reload = useCallback(async () => {
    try {
      // Les membres servent à nommer les auteurs du fil d'échanges. Secondaire :
      // un échec dégrade les noms, il ne doit pas vider la fiche du projet.
      const [p, mem] = await Promise.all([
        repo.getProjet(id),
        repo.listMembres().catch(() => []),
      ])
      setProjet(p)
      setMembres(mem)
    } catch {
      setProjet(null)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    reload()
  }, [reload])

  if (loading) return <Spinner />
  if (!projet) {
    return (
      <div>
        <PageHeader title="Projet introuvable" />
        <Link to="/projets" className="text-navy-600 underline">← Retour aux projets</Link>
      </div>
    )
  }

  // Dès qu'une décision ENREGISTRÉE est rattachée, le projet n'est plus effaçable.
  // Deux raisons qui se rejoignent : l'argent engagé vient forcément d'une décision
  // enregistrée et adoptée ; et la suppression détache les décisions (projet_id à
  // null), ce qui MODIFIERAIT une délibération figée au registre légal.
  const decisionsEnregistrees = projet.decisions.filter((d) => d.enregistree)
  const canDelete = canManage && decisionsEnregistrees.length === 0
  // Modification : le chef de projet, son ADJOINT (migration 028) ou le
  // président (desktop). L'adjoint a exactement les mêmes droits que le chef —
  // c'est tout l'objet du rôle : qu'un projet ne s'arrête pas parce qu'une seule
  // personne est indisponible. Suppression : président seul (canManage), et
  // projet non engagé — ni le chef ni l'adjoint ne suppriment (migration 013).
  const estPilote = projet.chef_projet_id === user?.membre_id || projet.adjoint_projet_id === user?.membre_id
  const canEdit = !isMobile && (isAdmin || estPilote)

  const del = async () => {
    if (!(await confirm({ title: `Supprimer le projet « ${projet.nom} » ?`, message: 'Les décisions et les résolutions rattachées seront détachées (elles ne sont pas supprimées).', confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await repo.deleteProjet(id)
      navigate('/projets')
    } catch (e) {
      alert(e.message)
    }
  }

  const pct = projet.alloue > 0 ? Math.min(100, Math.round((projet.engage / projet.alloue) * 100)) : 0

  // ---- Fil d'échanges (migration 028) ----
  const qa = projet.qa || []
  const questions = qa.filter((q) => q.type === 'question')
  const reponsesByParent = qa
    .filter((q) => q.type === 'reponse' && q.parent_id)
    .reduce((acc, r) => { (acc[r.parent_id] ||= []).push(r); return acc }, {})
  const commentaires = qa.filter((q) => q.type === 'commentaire')
  const nameOf = (mid) => {
    const m = membres.find((x) => x.id === mid)
    return m ? `${m.prenom} ${m.nom}` : 'Membre du CS'
  }

  // Tout membre du CS connecté participe au fil : le projet est une affaire
  // collective, et restreindre l'échange au seul binôme chef/adjoint priverait
  // le conseil du moyen de poser une question sans convoquer une réunion.
  const peutEchanger = Boolean(user?.membre_id)

  // ---- Journal de bord (migration 029) ----
  const journal = projet.journal || []
  const addJournal = async () => {
    if (!jTexte.trim() || !jDate) return
    try {
      await repo.addJournalProjet({ projet_id: id, date_action: jDate, texte: jTexte.trim(), auteur_id: user.membre_id })
      setJTexte('')
      setJDate(todayISO())
      await reload()
    } catch (e) {
      alert('L’entrée n’a pas pu être enregistrée : ' + e.message)
    }
  }
  const saveJournal = async () => {
    if (!jEdit?.texte.trim() || !jEdit?.date_action) return
    try {
      await repo.updateJournalProjet(jEdit.id, { date_action: jEdit.date_action, texte: jEdit.texte.trim() })
      setJEdit(null)
      await reload()
    } catch (e) {
      alert('La correction n’a pas pu être enregistrée : ' + e.message)
    }
  }
  const delJournal = async (entree) => {
    if (!(await confirm({ title: 'Supprimer cette entrée du journal ?', message: `« ${entree.texte.slice(0, 80)}… » du ${formatDate(entree.date_action)}.`, confirmLabel: 'Supprimer', danger: true }))) return
    try {
      await repo.deleteJournalProjet(entree.id)
      await reload()
    } catch (e) {
      alert(e.message)
    }
  }

  const addQA = async (type, texte, parentId = null) => {
    if (!texte.trim()) return
    try {
      await repo.addQAProjet({ projet_id: id, auteur_id: user.membre_id, type, parent_id: parentId, texte: texte.trim() })
      // Vidé APRÈS succès seulement : sur rejet RLS, la saisie n'est pas perdue.
      if (type === 'question') setQText('')
      if (type === 'commentaire') setCText('')
      if (type === 'reponse') { setReplyText(''); setReplyTo(null) }
      await reload()
    } catch (e) {
      alert('Le message n’a pas pu être publié : ' + e.message)
    }
  }

  return (
    <div>
      <PageHeader
        title={projet.nom}
        subtitle={projet.ags?.length ? `Financé par ${projet.ags.map((a) => a.numero).join(' · ')}` : 'Aucune résolution rattachée'}
        actions={
          (canEdit || canManage) && (
            <>
              {canEdit && <Link to={`/projets/${id}/modifier`}><Button variant="ghost">Modifier</Button></Link>}
              {canManage && (canDelete ? (
                <Button variant="danger" onClick={del}>Supprimer</Button>
              ) : (
                <span className="text-xs text-slate-400" title="Une décision enregistrée y est rattachée">
                  🔒 non supprimable
                </span>
              ))}
            </>
          )
        }
      />

      {canManage && !canDelete && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-600">
          Projet non supprimable : {decisionsEnregistrees.length} décision(s) enregistrée(s) y sont rattachées
          {projet.engage > 0 && <> et {eur(projet.engage)} y sont engagés</>}. Une décision enregistrée est figée au
          registre : elle ne peut pas être détachée de son projet.
        </div>
      )}

      <div className="mb-6 grid gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Statut</p>
          <div className="mt-1"><ProjetStatutBadge statut={projet.statut} /></div>
          {/* Le statut est dérivé : dire d'où il vient, sinon il paraît arbitraire. */}
          {projet.statut_decision ? (
            <p className="mt-1 text-xs text-slate-500">
              Par la décision{' '}
              <Link to={`/registre/${projet.statut_decision.decision_id}`} className="text-navy-600 underline">
                {projet.statut_decision.numero}
              </Link>
              {projet.statut_decision.date && <> du {formatDate(projet.statut_decision.date)}</>}
            </p>
          ) : projet.statut === 'en_preparation' ? (
            // Dire la date, sinon « En préparation » ressemble à un état saisi à
            // la main alors qu'il se déduit de la seule date d'ouverture.
            <p className="mt-1 text-xs text-slate-500">
              Ouverture prévue le {formatDate(projet.date_ouverture)} — le projet passera « ouvert » ce jour-là.
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              {projet.engage > 0 ? 'Des décisions y engagent de l’argent' : 'Rien d’engagé à ce jour'}
            </p>
          )}
          {projet.date_ouverture && projet.statut !== 'en_preparation' && (
            <p className="mt-3 text-xs text-slate-500">Ouvert le {formatDate(projet.date_ouverture)}</p>
          )}
        </Card>

        {/* ÉQUIPE PROJET — trois rôles, dont un seul n'est pas encore ouvert.
            Le chef et l'adjoint (migration 028) pilotent le projet et ont
            exactement les mêmes droits. Le troisième, « membre de l'équipe »,
            est destiné à des COLOTIS extérieurs au CS : il est annoncé ici mais
            pas assignable, parce qu'il suppose que des non-membres puissent se
            connecter à l'application — ce qui n'existe pas et se spécifie à part
            (docs/SPEC_ONBOARDING_COLOTIS.md). Afficher le rôle sans le rendre
            actif est un choix : le CS doit pouvoir se projeter, sans croire que
            c'est déjà possible. D'où l'absence de tout bouton. */}
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Équipe projet</p>
          <p className="mt-1 text-xs text-slate-400">Chef de projet</p>
          <p className="text-sm font-medium text-navy-800">{projet.chef_nom || '— à définir —'}</p>
          <p className="mt-2 text-xs text-slate-400">Adjoint <span className="font-normal">(facultatif)</span></p>
          <p className="text-sm font-medium text-navy-800">{projet.adjoint_nom || '— aucun —'}</p>
          <p className="mt-2 text-xs text-slate-400">Membres de l’équipe</p>
          <p className="text-sm text-slate-400">— à venir —</p>
          <p className="mt-1 text-xs leading-snug text-slate-400">
            Ce rôle, ouvert aux colotis hors CS, suppose qu’ils puissent se connecter à l’application. Le mécanisme
            est en cours de spécification : aucun membre d’équipe n’est assignable pour l’instant.
          </p>
        </Card>

        <Card className="p-4 lg:col-span-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Budget</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div><p className="text-xs text-slate-500">Alloué</p><p className="text-lg font-semibold text-navy-800">{eur(projet.alloue)}</p></div>
            <div><p className="text-xs text-slate-500">Engagé</p><p className="text-lg font-semibold text-amber-700">{eur(projet.engage)}{projet.engage_en_cours > 0 && <span className="block text-xs font-normal text-slate-400">+{eur(projet.engage_en_cours)} en cours</span>}</p></div>
            <div><p className="text-xs text-slate-500">Restant</p><p className={`text-lg font-semibold ${projet.restant < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{eur(projet.restant)}</p></div>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full ${projet.restant < 0 ? 'bg-red-500' : 'bg-navy-500'}`} style={{ width: `${pct}%` }} />
          </div>
        </Card>
      </div>

      {/* D'où vient l'alloué : le budget n'est stocké nulle part, il est la somme
          des enveloppes votées. L'afficher ligne à ligne est le seul moyen de
          rendre ce total vérifiable — et de montrer qu'une rallonge non encore
          votée ne compte pas. */}
      <Card className="mb-6">
        <CardHeader
          title="Résolutions qui financent ce projet"
          subtitle="Le budget alloué est la somme des enveloppes votées en AG. Il ne se saisit pas : il se rattache."
        />
        <ul className="divide-y divide-navy-50">
          {(!projet.resolutions || projet.resolutions.length === 0) && (
            <li className="px-5 py-6 text-center text-sm text-slate-500">
              Aucune résolution rattachée : ce projet n’a aucun budget. Rattachez-lui une résolution adoptée depuis la fiche de l’AG.
            </li>
          )}
          {projet.resolutions?.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <Link to={`/ag/${r.ag_id}`} className="text-sm font-medium text-navy-700 hover:underline">
                  {r.ag_numero} — résolution n° {r.numero}
                </Link>
                <p className="truncate text-xs text-slate-500">{r.titre}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${r.compte_dans_alloue ? 'text-navy-800' : 'text-slate-400 line-through'}`}>
                  {r.budget_alloue == null ? '—' : eur(r.budget_alloue)}
                </p>
                {!r.compte_dans_alloue && (
                  <p className="text-xs text-amber-700">non voté — hors budget</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {projet.description && (
        <Card className="mb-6">
          <CardHeader title="Description" />
          <p className="whitespace-pre-wrap px-5 py-4 text-sm text-slate-700">{projet.description}</p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Décisions rattachées */}
        <Card>
          <CardHeader title="Décisions rattachées" subtitle={`${projet.decisions.length} décision(s)`} />
          <ul className="divide-y divide-navy-50">
            {projet.decisions.length === 0 && <li className="px-5 py-6 text-center text-sm text-slate-500">Aucune décision rattachée.</li>}
            {projet.decisions.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link to={`/registre/${d.id}`} className="min-w-0 truncate text-sm font-medium text-navy-700 hover:underline">
                  <span className="text-slate-400">{d.numero}</span> · {d.titre}
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {d.montant_engage != null && (
                    <span className="text-sm text-slate-600" title={d.tva_incluse === false ? `${eur(d.montant_engage)} HT + ${Number(d.tva_taux) || 0} % TVA` : `TVA ${Number(d.tva_taux) || 0} % incluse`}>{eur(engagementTTC(d))} TTC</span>
                  )}
                  <DecisionEtatBadge decision={d} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Documents partagés */}
        <Card>
          <CardHeader title="Documents partagés" />
          <div className="px-5 py-4">
            {(projet.documents || []).length === 0 ? (
              <p className="text-sm text-slate-500">Aucun document.</p>
            ) : (
              <ul className="space-y-2">
                {projet.documents.map((doc) => (
                  <li key={doc.id}>
                    <button type="button" onClick={() => openDoc(doc)} className="flex w-full cursor-pointer items-center justify-between rounded border border-slate-200 px-3 py-2 text-left text-sm hover:bg-navy-50/50">
                      <span className="truncate text-navy-700">{doc.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-slate-400">{Math.round((doc.size || 0) / 1024)} Ko</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {docError && <p className="mt-2 text-xs text-red-600">{docError}</p>}
            {canEdit && <p className="mt-2 text-xs text-slate-400">Ajout / retrait via « Modifier ».</p>}
          </div>
        </Card>
      </div>

      {/* JOURNAL DE BORD (migration 029) — ce que l'équipe a FAIT, daté du jour
          où ça s'est passé.
          ⚠ Rien à voir avec le journal d'audit (Paramètres), qui est automatique
          et immuable. Celui-ci est saisi à la main et CORRIGEABLE par son
          auteur : ce n'est pas une délibération, il n'entre pas au registre.
          Les deux dates restent distinctes en base — `date_action` (modifiable)
          et `created_at` (jamais touchée) — mais SEULE celle de l'action est
          affichée : c'est la seule qui intéresse le lecteur du journal. */}
      <Card className="mt-6">
        <CardHeader
          title="Journal du projet"
          subtitle="Ce qui a été fait, à la date où cela s’est passé. Corrigeable par son auteur."
        />
        <div className="px-5 py-4">
          {peutEchanger && (
            <div className="mb-4 rounded-md border border-navy-100 bg-navy-50/40 p-3">
              <div className="flex flex-wrap items-end gap-2">
                <Input label="Date de l’action" type="date" value={jDate} onChange={(e) => setJDate(e.target.value)} className="w-44" />
                <Textarea autoGrow rows={2} value={jTexte} onChange={(e) => setJTexte(e.target.value)} placeholder="ex : visite de chantier, relance du prestataire, rendez-vous en mairie…" className="min-w-0 flex-1" />
                <Button onClick={addJournal} disabled={!jTexte.trim() || !jDate}>Consigner</Button>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                La date est celle de <strong>l’action</strong>, pas de la saisie : notez aujourd’hui ce qui s’est passé la
                semaine dernière, en reculant la date.
              </p>
            </div>
          )}

          {journal.length === 0 ? (
            <p className="text-sm text-slate-500">Aucune entrée pour l’instant.</p>
          ) : (
            <ul className="space-y-2">
              {journal.map((j) => {
                const mien = j.auteur_id === user?.membre_id || isAdmin
                return (
                  <li key={j.id} className="rounded-md border border-slate-200 px-3 py-2">
                    {jEdit?.id === j.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <Input label="Date de l’action" type="date" value={jEdit.date_action} onChange={(e) => setJEdit({ ...jEdit, date_action: e.target.value })} className="w-44" />
                        <Textarea autoGrow rows={2} value={jEdit.texte} onChange={(e) => setJEdit({ ...jEdit, texte: e.target.value })} className="min-w-0 flex-1" />
                        <Button size="sm" onClick={saveJournal}>Enregistrer</Button>
                        <Button size="sm" variant="ghost" onClick={() => setJEdit(null)}>Annuler</Button>
                      </div>
                    ) : (
                      /* UNE SEULE LIGNE quand le sujet est court : date, sujet,
                         boutons, auteur. Le sujet prend la place restante
                         (`flex-1`) et repasse à la ligne tout seul s'il est long,
                         sans casser l'alignement du reste.
                         La date de SAISIE n'est plus affichée (Pascal) : seule
                         celle de l'action intéresse le lecteur. Elle reste
                         stockée dans `created_at` — on cesse de la montrer, on
                         ne cesse pas de la garder. */
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <span className="whitespace-nowrap text-sm font-semibold text-navy-800">{formatDate(j.date_action)}</span>
                        <span className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-slate-700">{j.texte}</span>
                        {mien && (
                          <span className="flex shrink-0 gap-2">
                            <button onClick={() => setJEdit({ id: j.id, date_action: j.date_action, texte: j.texte })} className="text-xs text-navy-600 underline">Corriger</button>
                            <button onClick={() => delJournal(j)} className="text-xs text-red-600 underline">Supprimer</button>
                          </span>
                        )}
                        <span className="shrink-0 whitespace-nowrap text-xs text-slate-400">{nameOf(j.auteur_id)}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Card>

      {/* Fil d'échanges de l'équipe (migration 028). Même distinction que sur une
          décision : une QUESTION attend une réponse, un COMMENTAIRE est une note
          de suivi qui n'en attend pas. Différence tenue avec les décisions : le
          fil ne se ferme jamais — un projet ne se fige pas, son suivi court tant
          qu'il vit. C'est ce qui rend l'échange TRAÇABLE : ce qui se disait par
          téléphone ou en aparté reste ici, attaché au projet. */}
      <Card className="mt-6">
        <CardHeader
          title="Échanges de l’équipe"
          subtitle="Trace écrite des questions et du suivi, attachée au projet."
        />
        <div className="space-y-4 px-5 py-4">
          {questions.length === 0 && commentaires.length === 0 && (
            <p className="text-sm text-slate-500">Aucun échange pour l’instant.</p>
          )}

          {questions.map((question) => (
            <div key={question.id} className="rounded-md border border-navy-100 bg-navy-50/30 p-3">
              <p className="text-sm text-slate-800">
                <span className="font-medium text-navy-700">{nameOf(question.auteur_id)}</span>
                <span className="ml-2 text-xs text-slate-400">{formatDateTime(question.created_at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{question.texte}</p>
              {(reponsesByParent[question.id] || []).map((r) => (
                <div key={r.id} className="mt-2 ml-4 border-l-2 border-navy-200 pl-3">
                  <p className="text-xs">
                    <span className="font-medium text-navy-700">{nameOf(r.auteur_id)}</span>
                    <span className="ml-2 text-slate-400">{formatDateTime(r.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{r.texte}</p>
                </div>
              ))}
              {peutEchanger && (replyTo === question.id ? (
                <div className="mt-2 ml-4 flex flex-wrap items-start gap-2">
                  <Textarea autoGrow rows={2} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Votre réponse…" className="min-w-0 flex-1" />
                  <Button size="sm" onClick={() => addQA('reponse', replyText, question.id)}>Répondre</Button>
                  <Button size="sm" variant="ghost" onClick={() => { setReplyTo(null); setReplyText('') }}>Annuler</Button>
                </div>
              ) : (
                <button onClick={() => setReplyTo(question.id)} className="mt-2 ml-4 text-xs text-navy-600 underline">Répondre</button>
              ))}
            </div>
          ))}

          {commentaires.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Notes de suivi</p>
              <ul className="mt-2 space-y-2">
                {commentaires.map((c) => (
                  <li key={c.id} className="rounded-md border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-sm">
                      <span className="font-medium text-navy-700">{nameOf(c.auteur_id)}</span>
                      <span className="ml-2 text-xs text-slate-400">{formatDateTime(c.created_at)}</span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{c.texte}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {peutEchanger && (
            <div className="space-y-2 border-t border-navy-100 pt-3">
              <div className="flex items-start gap-2">
                <Textarea autoGrow rows={2} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Poser une question à l’équipe…" className="min-w-0 flex-1" />
                <Button onClick={() => addQA('question', qText)}>Publier</Button>
              </div>
              <div className="flex items-start gap-2">
                <Textarea autoGrow rows={2} value={cText} onChange={(e) => setCText(e.target.value)} placeholder="Ajouter une note de suivi (n’attend pas de réponse)…" className="min-w-0 flex-1" />
                <Button size="sm" variant="secondary" onClick={() => addQA('commentaire', cText)}>Noter</Button>
              </div>
            </div>
          )}
        </div>
      </Card>
      {confirmModal}
    </div>
  )
}
