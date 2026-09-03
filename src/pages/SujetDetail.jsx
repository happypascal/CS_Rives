import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Spinner } from '../components/ui'
import RichTextEditor from '../components/RichTextEditor'
import { useConfirm } from '../components/useConfirm'
import { formatDate, todayISO } from '../lib/format'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { categoriesConnues, trierEntrees } from '../lib/sujetLogic'

// Fiche d'un sujet : la SYNTHÈSE (où en est-on) puis la CHRONOLOGIE (comment y
// est-on arrivé). Deux questions différentes, deux zones distinctes.

export default function SujetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const [sujet, setSujet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirm, confirmModal] = useConfirm()

  const [form, setForm] = useState({ titre: '', categorie: '', resume: '', contenu: '' })
  const [editionSynthese, setEditionSynthese] = useState(false)
  const [nouvelle, setNouvelle] = useState(null) // { date_evenement, titre, contenu }
  const [editee, setEditee] = useState(null)

  const peutSaisir = !isMobile

  const reload = useCallback(async () => {
    setError('')
    try {
      const s = await repo.getSujet(id)
      setSujet(s)
      if (s) {
        setForm({
          titre: s.titre || '',
          categorie: s.categorie || '',
          resume: s.resume || '',
          contenu: s.contenu || '',
        })
      }
    } catch (e) {
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }, [id])
  useEffect(() => { reload() }, [reload])

  if (loading) return <Spinner />
  if (error && !sujet) {
    return (
      <div>
        <PageHeader title="Mémoire du lotissement" />
        <Card className="p-6"><p className="text-sm text-red-700">{error}</p></Card>
      </div>
    )
  }
  if (!sujet) {
    return (
      <div>
        <PageHeader title="Sujet introuvable" />
        <Link to="/memoire" className="text-navy-600 underline">← Retour à la mémoire</Link>
      </div>
    )
  }

  const enregistrerSynthese = async () => {
    if (!form.titre.trim()) return setError('Le titre est obligatoire.')
    setBusy(true)
    setError('')
    try {
      await repo.updateSujet(id, {
        titre: form.titre.trim(),
        categorie: form.categorie || null,
        resume: form.resume || null,
        contenu: form.contenu || null,
      })
      setEditionSynthese(false)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const ajouterEntree = async () => {
    if (!nouvelle?.titre?.trim() || !nouvelle?.date_evenement) return
    setBusy(true)
    setError('')
    try {
      await repo.addSujetEntree({
        sujet_id: id,
        date_evenement: nouvelle.date_evenement,
        titre: nouvelle.titre.trim(),
        contenu: nouvelle.contenu || null,
        auteur_id: user?.membre_id,
      })
      setNouvelle(null)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const enregistrerEntree = async () => {
    if (!editee?.titre?.trim() || !editee?.date_evenement) return
    setBusy(true)
    setError('')
    try {
      await repo.updateSujetEntree(editee.id, {
        date_evenement: editee.date_evenement,
        titre: editee.titre.trim(),
        contenu: editee.contenu || null,
      })
      setEditee(null)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const supprimerEntree = async (entree) => {
    if (!(await confirm({
      title: 'Supprimer cette entrée',
      message: `« ${entree.titre} » sera retirée de la chronologie. Cette action est définitive.`,
      confirmLabel: 'Supprimer',
      danger: true,
    }))) return
    try {
      await repo.deleteSujetEntree(entree.id)
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  const supprimerSujet = async () => {
    if (!(await confirm({
      title: `Supprimer « ${sujet.titre} »`,
      message: 'La synthèse et toute la chronologie seront perdues. Une mémoire nourrie par plusieurs personnes disparaît avec elle.',
      confirmLabel: 'Supprimer définitivement',
      danger: true,
    }))) return
    try {
      await repo.deleteSujet(id)
      navigate('/memoire')
    } catch (e) {
      setError(e.message)
    }
  }

  const entrees = trierEntrees(sujet.entrees || [])
  // L'auteur corrige les siennes ; le président garde tout. Même règle que le
  // journal de projet, et même raison : ce n'est pas une délibération.
  const peutModifier = (e) => isAdmin || e.auteur_id === user?.membre_id

  return (
    <div>
      <PageHeader
        title={sujet.titre}
        subtitle={sujet.categorie || 'Sans catégorie'}
        actions={
          <>
            <Link to="/memoire"><Button variant="ghost">Retour à la mémoire</Button></Link>
            {peutSaisir && !editionSynthese && (
              <Button variant="secondary" onClick={() => setEditionSynthese(true)}>
                Modifier la synthèse
              </Button>
            )}
            {isAdmin && !isMobile && (
              <Button variant="danger" onClick={supprimerSujet}>Supprimer le sujet</Button>
            )}
          </>
        }
      />

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Où en est-on ?"
              subtitle="La synthèse, réécrite au fil du temps. Elle doit rester juste aujourd’hui."
            />
            {editionSynthese ? (
              <div className="space-y-4 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    label="Titre"
                    value={form.titre}
                    onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                  />
                  <Select
                    label="Catégorie"
                    value={form.categorie}
                    onChange={(e) => setForm((f) => ({ ...f, categorie: e.target.value }))}
                  >
                    <option value="">— Aucune —</option>
                    {categoriesConnues([sujet]).map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                </div>
                <Input
                  label="Résumé (une ligne, visible dans la liste)"
                  value={form.resume}
                  onChange={(e) => setForm((f) => ({ ...f, resume: e.target.value }))}
                  placeholder="ex : Motorisation de 2019, en fin de vie ; devis en cours."
                />
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700">Synthèse</p>
                  <RichTextEditor
                    value={form.contenu}
                    onChange={(v) => setForm((f) => ({ ...f, contenu: v }))}
                    placeholder="Ce qu’il faut savoir : l’état actuel, ce qui a été tranché et pourquoi, ce qui reste ouvert…"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Écrivez pour quelqu’un qui arrive : ce qui a été décidé, mais surtout
                    <strong> pourquoi</strong>. Les pistes écartées valent autant que celles retenues.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => { setEditionSynthese(false); reload() }}>
                    Annuler
                  </Button>
                  <Button onClick={enregistrerSynthese} disabled={busy || !form.titre.trim()}>
                    {busy ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                {sujet.resume && <p className="mb-3 text-sm text-slate-700">{sujet.resume}</p>}
                {sujet.contenu ? (
                  <div className="rich-text text-sm text-slate-700" dangerouslySetInnerHTML={{ __html: sujet.contenu }} />
                ) : (
                  <p className="text-sm italic text-slate-400">
                    Aucune synthèse pour l’instant. C’est ici qu’on écrit ce qu’un nouveau membre
                    doit savoir sur ce dossier.
                  </p>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Comment y est-on arrivé ?"
              subtitle="La chronologie. Elle s’ajoute et ne se réécrit pas."
              actions={
                peutSaisir && !nouvelle && (
                  <Button
                    variant="secondary"
                    onClick={() => setNouvelle({ date_evenement: todayISO(), titre: '', contenu: '' })}
                  >
                    Ajouter une entrée
                  </Button>
                )
              }
            />

            {nouvelle && (
              <div className="space-y-3 border-b border-navy-100 bg-navy-50/40 px-5 py-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {/* ⚠ La date de l'ÉVÉNEMENT, pas celle de la saisie : une
                      réunion de mars notée en juin se range en mars. */}
                  <Input
                    label="Date de l’événement"
                    type="date"
                    value={nouvelle.date_evenement}
                    onChange={(e) => setNouvelle((n) => ({ ...n, date_evenement: e.target.value }))}
                  />
                  <div className="sm:col-span-2">
                    <Input
                      label="Ce qui s’est passé"
                      value={nouvelle.titre}
                      onChange={(e) => setNouvelle((n) => ({ ...n, titre: e.target.value }))}
                      placeholder="ex : Refus de la mairie sur l’implantation"
                    />
                  </div>
                </div>
                <RichTextEditor
                  value={nouvelle.contenu}
                  onChange={(v) => setNouvelle((n) => ({ ...n, contenu: v }))}
                  placeholder="Détail, contexte, qui était présent, ce qui a été dit… (facultatif)"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={() => setNouvelle(null)}>Annuler</Button>
                  <Button onClick={ajouterEntree} disabled={busy || !nouvelle.titre.trim() || !nouvelle.date_evenement}>
                    Ajouter
                  </Button>
                </div>
              </div>
            )}

            {entrees.length === 0 && !nouvelle ? (
              <p className="px-5 py-6 text-center text-sm text-slate-500">
                Aucune entrée. La chronologie se construit par petites touches : une réunion, un
                courrier, un refus, un devis.
              </p>
            ) : (
              <ul className="divide-y divide-navy-50">
                {entrees.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    {editee?.id === e.id ? (
                      <div className="space-y-3">
                        <div className="grid gap-3 sm:grid-cols-3">
                          <Input
                            label="Date de l’événement"
                            type="date"
                            value={editee.date_evenement}
                            onChange={(ev) => setEditee((x) => ({ ...x, date_evenement: ev.target.value }))}
                          />
                          <div className="sm:col-span-2">
                            <Input
                              label="Ce qui s’est passé"
                              value={editee.titre}
                              onChange={(ev) => setEditee((x) => ({ ...x, titre: ev.target.value }))}
                            />
                          </div>
                        </div>
                        <RichTextEditor
                          value={editee.contenu}
                          onChange={(v) => setEditee((x) => ({ ...x, contenu: v }))}
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setEditee(null)}>Annuler</Button>
                          <Button onClick={enregistrerEntree} disabled={busy}>Enregistrer</Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <p className="text-sm font-medium text-navy-800">
                            <span className="mr-2 text-slate-500">{formatDate(e.date_evenement)}</span>
                            {e.titre}
                          </p>
                          {peutSaisir && peutModifier(e) && (
                            <span className="flex gap-2">
                              <button
                                onClick={() => setEditee({ id: e.id, date_evenement: e.date_evenement, titre: e.titre, contenu: e.contenu || '' })}
                                className="text-xs text-navy-600 underline hover:text-navy-800"
                              >
                                Corriger
                              </button>
                              <button
                                onClick={() => supprimerEntree(e)}
                                className="text-xs text-red-600 underline hover:text-red-800"
                              >
                                Supprimer
                              </button>
                            </span>
                          )}
                        </div>
                        {e.contenu && (
                          <div className="rich-text mt-1 text-sm text-slate-600" dangerouslySetInnerHTML={{ __html: e.contenu }} />
                        )}
                        {e.auteur && <p className="mt-1 text-xs text-slate-400">{e.auteur}</p>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Repères" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Entrées</p>
                <p className="text-slate-700">{entrees.length}</p>
              </div>
              {entrees.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Période couverte</p>
                  <p className="text-slate-700">
                    {formatDate(entrees[entrees.length - 1].date_evenement)} → {formatDate(entrees[0].date_evenement)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Catégorie</p>
                <p className="text-slate-700">
                  {sujet.categorie || <span className="italic text-slate-400">à ranger</span>}
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Comment nourrir ce sujet" />
            <ul className="space-y-2 px-5 py-4 text-xs text-slate-600">
              <li>
                <strong className="text-slate-700">La synthèse</strong> se réécrit : elle décrit
                l’état d’aujourd’hui, pas l’historique.
              </li>
              <li>
                <strong className="text-slate-700">La chronologie</strong> s’ajoute : un fait, une
                date, ce qui a été dit ou décidé.
              </li>
              <li>
                <strong className="text-slate-700">Citez les décisions</strong> par leur numéro
                (2026-014) : le registre en garde le texte exact et les votes.
              </li>
              <li>
                <strong className="text-slate-700">Écrivez les impasses.</strong> Savoir qu’une
                piste a été écartée, et pourquoi, évite de la reprendre dans trois ans.
              </li>
            </ul>
          </Card>
        </div>
      </div>

      {confirmModal}
    </div>
  )
}
