import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Spinner, Badge } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { formatDate } from '../lib/format'
import {
  TYPE_LABELS, QUALITE_LABELS, QUALITE_TONES, intituleAuto,
} from '../lib/pvArchiveLogic'

// UN PROCÈS-VERBAL ARCHIVÉ — le document, et ce qu'on sait de lui.
//
// ⚠ LE SCAN FAIT FOI, PAS LE TEXTE. Ce qui est affiché en bas est le résultat
// d'une reconnaissance de caractères sur du papier parfois vieux de soixante-dix
// ans : il sert à RETROUVER le document, jamais à le citer. L'écran doit
// continuer de le dire — sans cet avertissement, quelqu'un finira par recopier
// une phrase océrisée dans un courrier.

const TYPES = ['AGO', 'AGE', 'reunion_syndicat', 'inconnu']
const QUALITES = ['bonne', 'moyenne', 'illisible_partiel']

export default function PVArchiveDetail() {
  const { id } = useParams()
  const { isAdmin, isSecretaire } = useAuth()
  const bureau = isAdmin || isSecretaire
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pv, setPv] = useState(null)
  const [form, setForm] = useState(null)
  const [ags, setAgs] = useState([])
  const [busy, setBusy] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    Promise.all([
      repo.getPVArchive(id),
      // Idiome de résilience : sans la liste des AG, la fiche reste lisible.
      repo.listAG().catch(() => []),
    ])
      .then(([a, listeAg]) => {
        setPv(a)
        setAgs(listeAg)
        if (a) {
          setForm({
            date_ag: a.date_ag || '',
            annee: a.annee ?? '',
            type_ag: a.type_ag || 'inconnu',
            intitule: a.intitule || '',
            lieu: a.lieu || '',
            syndic: a.syndic || '',
            resume: a.resume || '',
            mots_cles: (a.mots_cles || []).join(', '),
            qualite: a.qualite || '',
            assemblee_id: a.assemblee_id || '',
            commentaire: a.commentaire || '',
          })
        }
      })
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <Spinner />
  if (error && !pv) return <Card className="p-6 text-sm text-red-700">{error}</Card>
  if (!pv) return <Card className="p-6 text-sm text-slate-600">Document introuvable.</Card>

  const set = (champ) => (e) => { setForm((f) => ({ ...f, [champ]: e.target.value })); setEnregistre(false) }

  const ouvrir = async () => {
    setError('')
    try {
      const url = await repo.getDocumentUrl(pv.document)
      // ⚠ Le mock n'a pas de bucket : il n'a rien à ouvrir, et le dire vaut
      // mieux qu'un onglet blanc.
      if (!url) { setError('Document indisponible en mode démo (aucun fichier n’est stocké localement).'); return }
      window.open(url, '_blank', 'noopener')
    } catch (e) {
      setError(e?.message || 'Ouverture impossible.')
    }
  }

  const enregistrer = async () => {
    setBusy(true)
    setError('')
    setEnregistre(false)
    try {
      const patch = {
        // ⚠ Chaîne vide → `null`, jamais l'inverse : une date vide est une date
        // INCONNUE, et `''` ferait échouer la contrainte de date en base.
        date_ag: form.date_ag || null,
        annee: Number(form.annee),
        type_ag: form.type_ag || 'inconnu',
        intitule: form.intitule.trim(),
        lieu: form.lieu.trim() || null,
        syndic: form.syndic.trim() || null,
        resume: form.resume.trim() || null,
        // Mots-clés saisis en clair, séparés par des virgules : une interface à
        // étiquettes coûterait cher pour un champ qu'on remplit trois fois par an.
        mots_cles: form.mots_cles.split(',').map((m) => m.trim()).filter(Boolean),
        qualite: form.qualite || null,
        assemblee_id: form.assemblee_id || null,
        commentaire: form.commentaire.trim() || null,
      }
      const maj = await repo.updatePVArchive(id, patch)
      setPv((p) => ({ ...p, ...maj }))
      setEnregistre(true)
    } catch (e) {
      setError(e?.message || 'Enregistrement impossible.')
    } finally {
      setBusy(false)
    }
  }

  const agLiee = ags.find((a) => a.id === pv.assemblee_id)

  return (
    <div>
      <PageHeader
        title={pv.intitule}
        subtitle={`${pv.date_ag ? formatDate(pv.date_ag) : `${pv.annee} — jour inconnu`}${pv.type_ag ? ` · ${TYPE_LABELS[pv.type_ag] || pv.type_ag}` : ''}`}
        actions={<Link to="/archives-pv" className="text-sm text-navy-600 underline">Retour aux archives</Link>}
      />

      {error && <Card className="mb-4 p-4 text-sm text-red-700">{error}</Card>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Le document"
              subtitle="C’est lui qui fait foi. Le texte ci-dessous n’en est qu’une transcription automatique."
            />
            <div className="p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button onClick={ouvrir}>Ouvrir le procès-verbal</Button>
                <span className="text-xs text-slate-500">
                  {pv.document?.name}
                  {pv.nb_pages != null && ` · ${pv.nb_pages} page${pv.nb_pages > 1 ? 's' : ''}`}
                  {pv.document?.size != null && ` · ${Math.round(pv.document.size / 1024)} Ko`}
                </span>
              </div>
              {agLiee && (
                <p className="mt-3 text-sm text-slate-600">
                  Rattaché à l’assemblée{' '}
                  <Link to={`/ag/${agLiee.id}`} className="text-navy-700 underline">{agLiee.numero}</Link> de l’application.
                </p>
              )}
            </div>
          </Card>

          {bureau && form && (
            <Card>
              <CardHeader
                title="Ce que l’on sait de ce document"
                subtitle="À compléter à la main : ce que le nom du fichier ne disait pas est resté vide."
              />
              <div className="space-y-4 p-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Intitulé" value={form.intitule} onChange={set('intitule')} />
                  <div>
                    <Select label="Type d’assemblée" value={form.type_ag} onChange={set('type_ag')}>
                      {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                    </Select>
                  </div>
                  <Input label="Année" type="number" value={form.annee} onChange={set('annee')} />
                  <div>
                    <Input label="Date de séance" type="date" value={form.date_ag} onChange={set('date_ag')} />
                    {/* ⚠ Ne pas inventer un jour pour « compléter » : l'année
                        seule est une information juste, une date fausse ne l'est
                        pas. La base exige d'ailleurs que les deux concordent. */}
                    <p className="mt-1 text-xs text-slate-400">Laissez vide si le jour est illisible : l’année suffit à classer le document.</p>
                  </div>
                  <Input label="Lieu" value={form.lieu} onChange={set('lieu')} />
                  <Input label="Gestionnaire de l’époque" value={form.syndic} onChange={set('syndic')} />
                  <div>
                    <Select label="Qualité du document" value={form.qualite} onChange={set('qualite')}>
                      <option value="">— non précisée —</option>
                      {QUALITES.map((q) => <option key={q} value={q}>{QUALITE_LABELS[q]}</option>)}
                    </Select>
                  </div>
                  <div>
                    {/* Lien FACULTATIF : les assemblées antérieures à
                        l'application n'y figurent pas et n'y figureront jamais. */}
                    <Select label="Assemblée correspondante dans l’application" value={form.assemblee_id} onChange={set('assemblee_id')}>
                      <option value="">— aucune —</option>
                      {ags.map((a) => <option key={a.id} value={a.id}>{a.numero} — {formatDate(a.date_ag)}</option>)}
                    </Select>
                  </div>
                </div>
                <Input label="Mots-clés (séparés par des virgules)" value={form.mots_cles} onChange={set('mots_cles')} />
                <Textarea label="Résumé" rows={3} value={form.resume} onChange={set('resume')} placeholder="Quelques lignes : ce qui a été décidé, et ce qui compte encore aujourd’hui." />
                <Textarea label="Commentaire" rows={2} value={form.commentaire} onChange={set('commentaire')} />
                <div className="flex items-center justify-end gap-2">
                  {enregistre && <span className="text-xs text-emerald-700">Enregistré.</span>}
                  <Button onClick={enregistrer} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <CardHeader
              title="Texte reconnu automatiquement"
              subtitle="Sert à retrouver le document. Ne pas citer."
            />
            <div className="p-5">
              {/* ⚠ L'avertissement est AU-DESSUS du texte, pas en note de bas de
                  page : on le lit avant de lire ce qu'il qualifie. */}
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                Transcription <strong>approximative</strong>, produite automatiquement à partir du scan. Elle comporte
                des erreurs, d’autant plus sur les documents anciens. <strong>Le document scanné fait foi</strong> :
                ne recopiez jamais ce texte dans un courrier ou une délibération sans l’avoir vérifié sur l’original.
              </div>
              {pv.texte_ocr ? (
                <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-navy-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                  {pv.texte_ocr}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucun texte n’a pu être extrait de ce document. Il reste consultable, mais la recherche plein texte
                  ne le trouvera pas.
                </p>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Repères" />
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Année</dt>
                <dd className="text-slate-700">{pv.annee}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Date de séance</dt>
                <dd className="text-slate-700">{pv.date_ag ? formatDate(pv.date_ag) : <span className="text-slate-400">jour inconnu</span>}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">Type</dt>
                <dd className="text-slate-700">{TYPE_LABELS[pv.type_ag] || '—'}</dd>
              </div>
              {pv.lieu && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Lieu</dt>
                  <dd className="text-slate-700">{pv.lieu}</dd>
                </div>
              )}
              {pv.syndic && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Gestionnaire de l’époque</dt>
                  <dd className="text-slate-700">{pv.syndic}</dd>
                </div>
              )}
              {pv.qualite && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Qualité</dt>
                  <dd><Badge tone={QUALITE_TONES[pv.qualite]}>{QUALITE_LABELS[pv.qualite]}</Badge></dd>
                </div>
              )}
              {pv.mots_cles?.length > 0 && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Mots-clés</dt>
                  <dd className="flex flex-wrap gap-1 pt-1">
                    {pv.mots_cles.map((m) => <Badge key={m} tone="gray">{m}</Badge>)}
                  </dd>
                </div>
              )}
              {pv.source && (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-slate-500">Provenance</dt>
                  <dd className="text-slate-700">{pv.source}</dd>
                </div>
              )}
            </dl>
          </Card>

          {!bureau && pv.commentaire && (
            <Card>
              <CardHeader title="Commentaire" />
              <p className="whitespace-pre-wrap p-5 text-sm text-slate-700">{pv.commentaire}</p>
            </Card>
          )}

          {bureau && form && form.intitule !== intituleAuto(pv, pv.intitule) && (
            <Card className="p-4 text-xs text-slate-500">
              L’intitulé a été repris à la main. L’intitulé déduit du nom de fichier était
              « {intituleAuto(pv, pv.document?.name)} ».
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
