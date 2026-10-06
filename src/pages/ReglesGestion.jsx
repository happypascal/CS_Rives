import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { useAuth } from '../lib/AuthContext'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Textarea, Select, Badge, Spinner, EmptyState, Modal, DesktopOnly } from '../components/ui'
import { useConfirm } from '../components/useConfirm'
import { useIsMobile } from '../lib/useIsMobile'
import { formatDate } from '../lib/format'
import {
  STATUTS, STATUT_LABELS, STATUT_TONES, CATEGORIES, PERIODICITES,
  valeursConnues, grouperParCategorie, libelleSource, manques, compter, filtrerParTexte,
} from '../lib/regleLogic'

// =============================================================================
// LES RÈGLES DE GESTION PERMANENTES (migration 066)
//
// Demande de Pascal (2026-10-06) : « les règles de gestion adoptées en AG qui
// doivent perdurer dans le temps ». Le constat annuel des haies et sa mise en
// demeure d'un mois, le constat d'huissier avant travaux, les intérêts de
// retard de plein droit : toutes votées, toutes encore applicables, et toutes
// introuvables sans relire trente-huit procès-verbaux.
//
// ⚠ CET ÉCRAN RAPPELLE, IL N'ARME RIEN. Il ne dira jamais « la visite des haies
// est due le 12 mai » : personne ne l'a constaté. `periodicite` et `delai` sont
// des libellés qu'on lit, pas une récurrence qu'un planificateur exécute —
// afficher une échéance que nul n'a fixée serait exactement la faute que ce
// registre s'interdit partout ailleurs.
//
// ⚠ IL NE DÉPLACE RIEN NON PLUS. La résolution d'origine reste dans son
// procès-verbal ; la règle la CITE, et renvoie à l'archive quand elle existe.
// =============================================================================

const VIDE = {
  titre: '', enonce: '', categorie: '', periodicite: '', delai: '', qui: '',
  source_annee: '', source_reference: '', statut: 'en_vigueur',
  fin_le: '', fin_reference: '', commentaire: '',
}

/**
 * ⚠ LES `null` DE LA BASE TRAVERSENT LE SPREAD — leçon de `Membres.jsx` :
 * `{ ...VIDE, ...ligne }` ne suffit PAS, car `null` écrase la chaîne vide du
 * modèle (seul `undefined` laisse la valeur de gauche) et le `.trim()` suivant
 * plante. Les traiter TOUS, une fois : les normaliser champ par champ est
 * précisément ce qui avait produit le bug.
 */
const sansNull = (ligne) =>
  Object.fromEntries(Object.entries({ ...VIDE, ...ligne }).map(([k, v]) => [k, v ?? '']))

export default function ReglesGestion() {
  const { isAdmin, membre } = useAuth()
  const isMobile = useIsMobile()
  const [confirm, confirmModal] = useConfirm()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [regles, setRegles] = useState([])
  const [q, setQ] = useState('')
  const [filtreStatut, setFiltreStatut] = useState('en_vigueur')
  const [filtreCategorie, setFiltreCategorie] = useState('')
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  // Le bureau tient les règles : elles viennent d'un vote d'assemblée, elles ne
  // se rédigent pas au fil de l'eau comme une synthèse de la mémoire.
  const peutEcrire = isAdmin || membre?.role === 'secretaire'

  const reload = async () => {
    setError('')
    try {
      setRegles(await repo.listReglesGestion())
    } catch (e) {
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const compte = useMemo(() => compter(regles), [regles])
  const categoriesVues = useMemo(() => valeursConnues(regles, 'categorie', CATEGORIES), [regles])
  const periodicitesVues = useMemo(() => valeursConnues(regles, 'periodicite', PERIODICITES), [regles])

  const visibles = useMemo(() => {
    let out = regles
    if (filtreStatut) out = out.filter((r) => r.statut === filtreStatut)
    if (filtreCategorie) out = out.filter((r) => (r.categorie || '') === filtreCategorie)
    return filtrerParTexte(out, q)
  }, [regles, filtreStatut, filtreCategorie, q])

  const enregistrer = async () => {
    if (!form.titre.trim() || !form.enonce.trim()) {
      setError('Le titre et l’énoncé sont obligatoires.')
      return
    }
    // ⚠ La contrainte `regles_gestion_fin_motivee` refuse en base une règle qui
    // n'est plus en vigueur sans dire par quoi. On le dit ici en français :
    // l'erreur de Postgres serait illisible.
    if (form.statut !== 'en_vigueur' && !form.fin_reference.trim()) {
      setError('Une règle qui n’est plus en vigueur doit dire par quoi elle a pris fin.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const payload = {
        titre: form.titre.trim(),
        enonce: form.enonce.trim(),
        categorie: form.categorie.trim() || null,
        periodicite: form.periodicite.trim() || null,
        delai: form.delai.trim() || null,
        qui: form.qui.trim() || null,
        source_annee: form.source_annee ? Number(form.source_annee) : null,
        source_reference: form.source_reference.trim() || null,
        statut: form.statut,
        fin_le: form.fin_le || null,
        fin_reference: form.fin_reference.trim() || null,
        commentaire: form.commentaire.trim() || null,
      }
      if (form.id) await repo.updateRegleGestion(form.id, payload)
      else await repo.createRegleGestion(payload)
      setForm(null)
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const supprimer = async (r) => {
    const ok = await confirm({
      title: 'Supprimer cette règle ?',
      message: `« ${r.titre} » disparaîtra du registre. Si elle a simplement cessé de s’appliquer, la passer en « abrogée » garde la trace de son vote et de sa fin.`,
      confirmLabel: 'Supprimer',
      danger: true,
    })
    if (!ok) return
    try {
      await repo.deleteRegleGestion(r.id)
      await reload()
    } catch (e) {
      setError(e.message)
    }
  }

  if (loading) return <Spinner />

  const groupes = grouperParCategorie(visibles)

  return (
    <div>
      <PageHeader
        title="Règles de gestion"
        subtitle="Ce que les assemblées ont voté une fois et qui s’applique encore."
        actions={peutEcrire && !isMobile ? (
          <Button onClick={() => setForm({ ...VIDE })}>Inscrire une règle</Button>
        ) : null}
      />

      {error && <Card className="mb-4 border-red-200 px-5 py-3 text-sm text-red-700">{error}</Card>}

      <Card className="mb-4 px-5 py-4">
        <p className="text-sm text-slate-700">
          Une règle de gestion n’est ni une décision du conseil, ni un dossier de la mémoire :
          c’est une obligation <strong>votée en assemblée</strong> qui continue de produire ses
          effets — le constat annuel des haies et sa mise en demeure, le constat d’huissier avant
          travaux, les intérêts de retard. Elles sont dispersées dans les procès-verbaux ; elles
          sont rassemblées ici.
        </p>
        {/* ⚠ CETTE PHRASE N'EST PAS UNE PRÉCAUTION DE STYLE. L'écran rappelle,
            il n'arme rien : aucune échéance n'est calculée, aucune alerte n'est
            levée. Le dire évite qu'on s'y fie comme à un agenda. */}
        <p className="mt-2 text-xs text-slate-500">
          L’application <strong>n’en calcule aucune échéance</strong> et ne déclenche aucune
          alerte : la périodicité et le délai sont reproduits tels qu’ils figurent au
          procès-verbal. Le procès-verbal fait foi.
        </p>
      </Card>

      {regles.length > 0 && (
        <Card className="mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <span className="text-slate-700">
              <strong className="text-lg text-navy-700">{compte.en_vigueur}</strong> en vigueur
            </span>
            {compte.suspendue > 0 && <span className="text-slate-500">{compte.suspendue} suspendue{compte.suspendue > 1 ? 's' : ''}</span>}
            {compte.abrogee > 0 && <span className="text-slate-500">{compte.abrogee} abrogée{compte.abrogee > 1 ? 's' : ''}</span>}
            {/* ⚠ On ne signale que ce qu'on peut NOMMER (règle de la mémoire,
                045) : une règle sans catégorie n'est pas incomplète, une règle
                sans source l'est — elle devient invérifiable. */}
            {compte.aCompleter > 0 && (
              <span className="text-amber-700">
                {compte.aCompleter} à compléter
              </span>
            )}
          </div>
        </Card>
      )}

      <Card className="mb-4 px-5 py-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[14rem] flex-1">
            <Input
              label="Rechercher"
              placeholder="haies, huissier, recouvrement…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select label="État" value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
            <option value="">Tous</option>
            {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
          </Select>
          <Select label="Catégorie" value={filtreCategorie} onChange={(e) => setFiltreCategorie(e.target.value)}>
            <option value="">Toutes</option>
            {categoriesVues.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
      </Card>

      {visibles.length === 0 ? (
        <EmptyState
          title={regles.length === 0 ? 'Aucune règle inscrite' : 'Aucune règle ne correspond'}
          hint={regles.length === 0
            ? 'Les règles permanentes votées en assemblée — constat des haies, constat d’huissier avant travaux, recouvrement — seront inscrites ici.'
            : 'Élargir la recherche ou changer les filtres.'}
        />
      ) : (
        groupes.map(({ categorie, regles: liste }) => (
          <section key={categorie} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{categorie}</h2>
            <div className="space-y-3">
              {liste.map((r) => (
                <LigneRegle
                  key={r.id}
                  r={r}
                  peutEcrire={peutEcrire && !isMobile}
                  onEditer={() => setForm(sansNull(r))}
                  onSupprimer={() => supprimer(r)}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {form && (
        <Modal
          open
          wide
          onClose={() => setForm(null)}
          title={form.id ? 'Modifier la règle' : 'Inscrire une règle de gestion'}
          footer={(
            <>
              <Button variant="secondary" onClick={() => setForm(null)}>Annuler</Button>
              <Button onClick={enregistrer} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
            </>
          )}
        >
          {isMobile ? <DesktopOnly what="Tenir les règles de gestion" /> : (
            <Formulaire
              form={form}
              setForm={setForm}
              categories={categoriesVues}
              periodicites={periodicitesVues}
            />
          )}
        </Modal>
      )}

      {confirmModal}
    </div>
  )
}

/** Une règle : ce qu'elle impose, à qui, sous quel délai, et d'où elle vient. */
function LigneRegle({ r, peutEcrire, onEditer, onSupprimer }) {
  const incomplet = manques(r)
  const source = libelleSource(r)
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium text-navy-700">{r.titre}</h3>
            <Badge tone={STATUT_TONES[r.statut] || 'gray'}>{STATUT_LABELS[r.statut] || r.statut}</Badge>
            {r.periodicite && <Badge tone="navy">{r.periodicite}</Badge>}
          </div>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{r.enonce}</p>
        </div>
        {peutEcrire && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" size="sm" onClick={onEditer}>Modifier</Button>
            <Button variant="danger" size="sm" onClick={onSupprimer}>Supprimer</Button>
          </div>
        )}
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-500">
        {r.qui && <div><dt className="inline font-medium">Qui : </dt><dd className="inline">{r.qui}</dd></div>}
        {r.delai && <div><dt className="inline font-medium">Délai : </dt><dd className="inline">{r.delai}</dd></div>}
        {source && (
          <div>
            <dt className="inline font-medium">Source : </dt>
            <dd className="inline">
              {/* ⚠ Le lien n'apparaît QUE si l'archive est rattachée : un lien
                  mort vers un procès-verbal non scanné ferait croire à une
                  pièce consultable. */}
              {r.pv_archive_id
                ? <Link to={`/ag/archives/${r.pv_archive_id}`} className="underline hover:text-navy-700">{source}</Link>
                : source}
            </dd>
          </div>
        )}
        {r.statut !== 'en_vigueur' && r.fin_reference && (
          <div>
            <dt className="inline font-medium">Fin : </dt>
            <dd className="inline">{r.fin_reference}{r.fin_le ? ` (${formatDate(r.fin_le)})` : ''}</dd>
          </div>
        )}
      </dl>

      {/* Les réserves, au-dessus de rien d'autre : une réserve lue après ce
          qu'elle qualifie arrive trop tard (leçon des archives, 2026-09-28). */}
      {r.commentaire && (
        <p className="mt-2 rounded bg-slate-50 px-3 py-2 text-xs italic text-slate-600">{r.commentaire}</p>
      )}

      {incomplet.length > 0 && (
        <p className="mt-2 text-xs text-amber-700">⚠ À compléter : {incomplet.join(' · ')}</p>
      )}
    </Card>
  )
}

function Formulaire({ form, setForm, categories, periodicites }) {
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <div className="space-y-4">
      {/* ⚠ Le titre doit nommer la RÈGLE, jamais la question posée — c'est la
          leçon de l'intitulé fautif de l'AG 2008, où « Fermeture du
          lotissement » accolé à « Adoptée » faisait lire l'inverse du vote. */}
      <Input
        label="Titre — ce que la règle impose, pas la question posée"
        placeholder="Constat annuel des haies empiétant sur les allées"
        value={form.titre}
        onChange={set('titre')}
      />
      <Textarea
        label="Énoncé — la règle telle qu’elle s’applique"
        rows={4}
        placeholder="Constat annuel par le conseil syndical et le syndic ; mise en demeure d’un mois ; à défaut, taille de la face visible par le syndic aux frais du propriétaire."
        value={form.enonce}
        onChange={set('enonce')}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Input label="Catégorie" list="regles-categories" value={form.categorie} onChange={set('categorie')} />
          <datalist id="regles-categories">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div>
          <Input label="Périodicité" list="regles-periodicites" placeholder="Annuelle" value={form.periodicite} onChange={set('periodicite')} />
          <datalist id="regles-periodicites">
            {periodicites.map((p) => <option key={p} value={p} />)}
          </datalist>
        </div>
        {/* ⚠ DU TEXTE, PAS UN NOMBRE DE JOURS : les PV écrivent « un mois »,
            « sous 90 jours », « à compter du 91e jour après notification ».
            Les ramener à un entier obligerait à choisir un point de départ que
            le procès-verbal ne donne pas toujours. */}
        <Input label="Délai — tel qu’il est écrit au PV" placeholder="Mise en demeure d’un mois" value={form.delai} onChange={set('delai')} />
        <Input label="Qui doit agir" placeholder="Le conseil syndical et le syndic" value={form.qui} onChange={set('qui')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* ⚠ L'année et la référence sont du TEXTE LIBRE et les liens sont
            facultatifs : une règle de 1991 vient d'une assemblée qui ne figure
            pas dans l'application et n'y figurera jamais. On ne fabrique pas
            une AG pour satisfaire une clé étrangère (même patron qu'en 051). */}
        <Input label="Année de l’assemblée" type="number" placeholder="2025" value={form.source_annee} onChange={set('source_annee')} />
        <Input label="Référence au procès-verbal" placeholder="résolution n° 28" value={form.source_reference} onChange={set('source_reference')} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Select label="État" value={form.statut} onChange={set('statut')}>
          {STATUTS.map((s) => <option key={s} value={s}>{STATUT_LABELS[s]}</option>)}
        </Select>
        <Input label="Fin le" type="date" value={form.fin_le} onChange={set('fin_le')} disabled={form.statut === 'en_vigueur'} />
        <Input
          label="Fin — par quoi"
          placeholder="statuts du 15 septembre 2026"
          value={form.fin_reference}
          onChange={set('fin_reference')}
          disabled={form.statut === 'en_vigueur'}
        />
      </div>
      {form.statut !== 'en_vigueur' && (
        <p className="text-xs text-amber-700">
          ⚠ Une règle qui n’est plus en vigueur doit dire <strong>par quoi</strong> elle a pris
          fin : sans cela, un lecteur futur la croirait abrogée par erreur.
        </p>
      )}

      <Textarea
        label="Réserves et commentaire"
        rows={3}
        placeholder="Ce qui reste incertain, contredit, ou resté sans suite."
        value={form.commentaire}
        onChange={set('commentaire')}
      />
    </div>
  )
}
