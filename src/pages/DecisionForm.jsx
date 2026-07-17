import { useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, eur, DesktopOnly } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import { nextNumero } from '../lib/decisionLogic'
import { todayISO, addBusinessDaysISO } from '../lib/format'
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
  // Effet sur le statut du projet ('' | suspendre | reprendre | terminer).
  const [projetAction, setProjetAction] = useState('')
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [projets, setProjets] = useState([])
  const [agBudgets, setAgBudgets] = useState([])
  const [error, setError] = useState('')

  // L'id de la décision est tiré ICI, pas par Postgres, parce qu'une pièce
  // jointe est téléversée AVANT que la ligne existe et que son chemin dans le
  // bucket doit porter cet id (`decisions/<id>/…`, migration 012). `useState`
  // avec initialiseur : un seul id pour toute la vie du formulaire, alors qu'un
  // appel direct en tirerait un neuf à chaque rendu.
  const [newId] = useState(() => crypto.randomUUID())
  const entityId = editing ? id : newId

  useEffect(() => {
    async function init() {
      const [all, projs, budgets] = await Promise.all([
        repo.listDecisions().catch(() => []),
        repo.listProjets().catch(() => []),
        repo.listAGBudgets().catch(() => []),
      ])
      setProjets(projs)
      setAgBudgets(budgets)
      if (editing) {
        const d = await repo.getDecision(id)
        if (d) {
          if (d.enregistree) setBlocked('locked')
          else if (d.created_by && d.created_by !== user?.membre_id) setBlocked('notowner')
          setNumero(d.numero)
          setDatePublication(d.date_publication)
          setDateLimite(d.date_limite_reponse || '')
          setLimiteEdited(true)
          setTitre(d.titre)
          setDescription(d.description)
          setMontantEngage(d.montant_engage ?? '')
          setDocuments(d.documents || [])
          if (d.projet_id) setTarget(`projet:${d.projet_id}`)
          else if (d.resolution_id) setTarget(`resolution:${d.resolution_id}`)
          setProjetAction(d.projet_action || '')
        }
      } else {
        setNumero(nextNumero(new Date().getFullYear(), all))
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
    setUploading(true)
    try {
      const record = await repo.uploadDocument('decisions', entityId, file)
      setDocuments((docs) => [...docs, record])
    } catch (err) {
      setError(`Envoi du fichier impossible : ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!titre.trim()) return setError('Le titre est obligatoire.')
    const engage = montantEngage === '' ? null : Number(montantEngage)
    if (engage != null && !target) return setError('Pour engager un montant, choisissez un projet ou une résolution.')
    if (engage != null && restantDispo != null && engage > restantDispo) {
      return setError(`Montant engagé (${eur(engage)}) supérieur au disponible (${eur(restantDispo)}).`)
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
        date_publication: datePublication,
        date_limite_reponse: dateLimite || null,
        titre,
        description: description && description !== '<br>' ? description : '',
        projet_id,
        resolution_id,
        ag_id,
        montant_engage: engage,
        // N'a de sens que sur un projet : une décision rattachée à une résolution
        // ou à rien ne peut pas suspendre quoi que ce soit.
        projet_action: kind === 'projet' && projetAction ? projetAction : null,
        documents,
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

  return (
    <div>
      <PageHeader title={editing ? 'Modifier la décision' : 'Nouvelle décision'} />
      <Card className="p-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Input label="Numéro" value={numero} readOnly className="bg-slate-50" />
            <Input label="Date de publication" type="date" value={datePublication} onChange={(e) => setDatePublication(e.target.value)} required />
            <Input label="Date limite de réponse" type="date" value={dateLimite} onChange={(e) => { setDateLimite(e.target.value); setLimiteEdited(true) }} />
          </div>
          <p className="-mt-2 text-xs text-slate-400">Date limite par défaut : publication + 7 jours ouvrables (modifiable).</p>

          <Input label="Titre" value={titre} onChange={(e) => setTitre(e.target.value)} required placeholder="Objet de la décision" />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Description <span className="font-normal text-slate-400">(optionnel)</span></span>
            <RichTextEditor value={description} onChange={setDescription} placeholder="Corps de la décision…" />
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
                <Input label="Montant engagé par cette décision (€)" type="number" min="0" step="0.01" value={montantEngage} onChange={(e) => setMontantEngage(e.target.value)} placeholder="ex : 12000" />
                {montantEngage !== '' && restantDispo != null && Number(montantEngage) > restantDispo && (
                  <p className="mt-1 text-xs text-red-600">Dépasse le disponible ({eur(restantDispo)}).</p>
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
                    « {selProjet.nom} » passera en <strong>{PROJET_ACTION_STATUT[projetAction] ? PROJET_STATUT_LABELS[PROJET_ACTION_STATUT[projetAction]] : 'statut naturel (ouvert / en cours)'}</strong>{' '}
                    une fois cette décision <strong>adoptée et enregistrée</strong> — pas avant. Une décision ultérieure pourra revenir dessus.
                  </p>
                )}
              </div>
            )}
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
              <label className={`inline-flex items-center gap-2 rounded-md border border-navy-200 bg-navy-50 px-3 py-2 text-sm text-navy-700 ${uploading ? 'cursor-wait opacity-60' : 'cursor-pointer hover:bg-navy-100'}`}>
                {uploading ? 'Envoi…' : '+ Ajouter un fichier'}
                <input type="file" className="hidden" disabled={uploading} onChange={onFile} />
              </label>
              <p className="text-xs text-slate-400">
                {Math.round(MAX_DOC_BYTES / 1024 / 1024)} Mo par fichier{BACKEND === 'mock' ? ' en mode démo' : ''}.
              </p>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => navigate(-1)}>Annuler</Button>
            <Button type="submit" disabled={saving || uploading}>{saving ? 'Enregistrement…' : editing ? 'Enregistrer les modifications' : 'Créer la décision'}</Button>
          </div>
        </form>
      </Card>
    </div>
  )
}
