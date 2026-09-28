import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, CardHeader, Button, Input, Select, Textarea, Spinner, Badge } from '../components/ui'
import { useAuth } from '../lib/AuthContext'
import { formatDate } from '../lib/format'
import {
  TYPE_LABELS, QUALITE_LABELS, QUALITE_TONES, intituleAuto, tagLibelle,
  partagerResolutions,
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

/** Une rubrique d'en-tête : le titre, puis la valeur — ou un tiret assumé. */
function Rubrique({ titre, valeur }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-slate-500">{titre}</p>
      <p className="mt-0.5 text-sm text-slate-700">
        {valeur || <span className="text-slate-400">—</span>}
      </p>
    </div>
  )
}

// LE TABLEAU DES RÉSOLUTIONS, dans la forme du résumé.
//
// ⚠ LES VOIX NE SONT PAS RECALCULÉES, ni totalisées, ni converties en
// pourcentage. L'unité change avec les décennies — lots avant 2003, voix sur
// 5 100 ensuite, m² sur 104 646 depuis 2026 — et un pourcentage sans assiette
// serait faux. On affiche le texte tel que le procès-verbal l'exprime, y compris
// « non chiffré ».
const TON_RESULTAT = {
  'Adoptée': 'text-emerald-700',
  'Adoptée (unanimité)': 'text-emerald-700',
  'Rejetée': 'text-red-700',
  'Rejetée (unanimité)': 'text-red-700',
  'Non votée': 'text-slate-500',
  'Reportée': 'text-amber-700',
  'Information': 'text-slate-500',
}

// LES VOIX, RÉDUITES AUX NOMBRES (Pascal, 2026-09-28 : « diminuer voix, pas
// nécessaire de lister nommément les contres, n'indiquer que les tantièmes sans
// marquer tantième »).
//
// ⚠ La colonne affichait le texte brut du procès-verbal — « 1 500 sur 3 200
// tantièmes (ALLEN PEREGRINE, BERSETH GILBERT, …) ». Sur certaines résolutions
// cette liste fait six lignes et mange la moitié du tableau, au détriment de
// l'objet, qui est ce qu'on vient lire.
//
// ⚠ RIEN N'EST PERDU : le texte complet, assiette et votants compris, reste dans
// l'infobulle de la cellule — et surtout dans `voix_texte`, que la base garde
// intact. On réduit l'AFFICHAGE, pas la donnée.
//
// ⚠ On affiche le nombre ENTIER déjà analysé (`pour`/`contre`/`abstention`), pas
// un extrait du texte : c'est lui qui est juste, et c'est lui que la
// confrontation aux résumés a vérifié. Un `null` reste un tiret — le PV ne
// chiffre pas ce vote, il ne dit pas « zéro ».
// ⚠ LES TROIS VOIX SUR UNE SEULE LIGNE (Pascal, 2026-09-28 : « il faut que
// chaque décision tienne sur une ligne, donc élargir la colonne voix »). Empilées
// — Pour / Contre / Abst. l'une sous l'autre — elles imposaient à elles seules
// trois lignes de hauteur à CHAQUE résolution : un tableau de vingt décisions
// faisait soixante lignes, et l'année ne se parcourait plus d'un coup d'œil.
// Même règle que le journal de bord des projets : une entrée tient sur une ligne.
//
// ⚠ Les absentes sont OMISES, pas affichées à zéro : « Abst. 0 » occupe la place
// sans rien apprendre, et `null` ne veut pas dire zéro — le PV ne chiffre pas ce
// vote, il ne dit pas que personne ne s'est abstenu.
function voixEnLigne(r) {
  return [['Pour', r.pour], ['Contre', r.contre], ['Abst.', r.abstention]]
    .filter(([, v]) => v != null)
    .map(([libelle, v]) => `${libelle} ${v.toLocaleString('fr-FR')}`)
    .join(' · ')
}

function Resolutions({ liste, unite }) {
  return (
    <div className="mt-3">
      {unite && <p className="mb-1 text-xs text-slate-500">{unite}</p>}
      <div className="overflow-x-auto">
        {/* ⚠ `table-fixed` + largeurs explicites : c'est ce qui permet de couper
            l'objet à l'ellipse. En disposition automatique, un `truncate` ne
            tronque rien — le navigateur élargit la colonne jusqu'à contenir le
            texte, et c'est le tableau entier qui déborde. */}
        <table className="w-full table-fixed text-sm">
          {/* ⚠ LARGEURS MESURÉES SUR LES DONNÉES RÉELLES, pas estimées à l'œil :
              42 caractères au plus pour les voix (« Pour 25 723 · Contre 53 124 ·
              Abst. 13 299 », AG 2026), 24 pour le résultat (« Inconnu (page
              manquante) ») et 24 pour le numéro (« V (IV de la convocation) »).
              Un premier jeu de largeurs tronquait les trois — et un RÉSULTAT
              tronqué est la pire des économies de place : c'est la colonne pour
              laquelle on lit le tableau. L'objet prend tout le reste. */}
          <colgroup>
            <col className="w-20" />
            <col />
            <col className="w-40" />
            <col className="w-72" />
          </colgroup>
          <thead>
            <tr className="border-b border-navy-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2 pr-3 font-medium">N°</th>
              <th className="py-2 pr-3 font-medium">Objet</th>
              <th className="py-2 pr-3 font-medium">Résultat</th>
              <th className="py-2 font-medium">Voix</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-navy-50">
            {liste.map((r, i) => {
              // ⚠ LE DÉTAIL N'EST PLUS UNE SECONDE LIGNE. Certains objets portent
              // dix lignes de détail, qui repoussaient la décision suivante hors
              // de l'écran. Il passe dans l'infobulle, avec le texte brut des
              // voix : rien n'est perdu, tout est à un survol.
              const brut = [r.voix_texte?.pour, r.voix_texte?.contre, r.voix_texte?.abstention]
                .filter((t) => t && t !== '—').join(' · ')
              const voix = voixEnLigne(r)
              return (
                <tr key={`${r.numero}-${i}`}>
                  <td className="truncate py-2 pr-3 text-xs text-slate-500" title={r.numero}>{r.numero}</td>
                  <td className="truncate py-2 pr-3 text-slate-700" title={r.detail ? `${r.objet}\n\n${r.detail}` : r.objet}>
                    {r.objet}
                  </td>
                  <td className={`truncate py-2 pr-3 text-xs font-medium ${TON_RESULTAT[r.resultat] || 'text-slate-600'}`} title={r.resultat}>
                    {r.resultat}
                  </td>
                  <td className="truncate py-2 text-xs text-slate-500" title={brut || undefined}>
                    {voix || <span className="text-slate-400">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function PVArchiveDetail() {
  const { id } = useParams()
  const { isAdmin, isSecretaire } = useAuth()
  const bureau = isAdmin || isSecretaire
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pv, setPv] = useState(null)
  const [form, setForm] = useState(null)
  const [ags, setAgs] = useState([])
  const [voisines, setVoisines] = useState([])
  const [toutVoir, setToutVoir] = useState(false)
  const [voirTexte, setVoirTexte] = useState(false)
  const [busy, setBusy] = useState(false)
  const [enregistre, setEnregistre] = useState(false)

  useEffect(() => {
    Promise.all([
      repo.getPVArchive(id),
      // Idiome de résilience : sans la liste des AG, la fiche reste lisible.
      repo.listAG().catch(() => []),
      // Le fonds entier, pour savoir quelle assemblée précède et laquelle suit.
      repo.listPVArchives().catch(() => []),
    ])
      .then(([a, listeAg, fonds]) => {
        setPv(a)
        setAgs(listeAg)
        setVoisines(fonds)
        // Revenir à la sélection resserrée en changeant d'assemblée : l'état
        // déplié appartient à la fiche qu'on quitte, pas à celle qu'on ouvre.
        setToutVoir(false)
        setVoirTexte(false)
        if (a) {
          setForm({
            date_ag: a.date_ag || '',
            annee: a.annee ?? '',
            type_ag: a.type_ag || 'inconnu',
            intitule: a.intitule || '',
            lieu: a.lieu || '',
            syndic: a.syndic || '',
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

  const { impactantes, ecartees } = partagerResolutions(pv.resolutions)

  // ALLER D'UNE ASSEMBLÉE À L'AUTRE SANS REPASSER PAR LA LISTE.
  //
  // ⚠ Le fonds est rendu de la plus RÉCENTE à la plus ancienne : la voisine
  // suivante dans le tableau est donc la PRÉCÉDENTE dans le temps. C'est le sens
  // qu'on lit — « précédente » veut dire l'assemblée d'avant, pas la ligne d'au-
  // dessus.
  // ⚠ Les boutons ne sont RENDUS que s'il y a une voisine : un bouton désactivé
  // en bout de fonds invite à cliquer sur ce qui n'existe pas.
  const rang = voisines.findIndex((x) => x.id === pv.id)
  const plusRecente = rang > 0 ? voisines[rang - 1] : null
  const plusAncienne = rang > -1 && rang < voisines.length - 1 ? voisines[rang + 1] : null

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
        actions={(
          <div className="flex flex-wrap items-center gap-3">
            {plusAncienne && (
              <Link
                to={`/ag/archives/${plusAncienne.id}`}
                className="text-sm text-navy-600 underline"
                title={plusAncienne.intitule}
              >
                ← {plusAncienne.annee}
              </Link>
            )}
            {plusRecente && (
              <Link
                to={`/ag/archives/${plusRecente.id}`}
                className="text-sm text-navy-600 underline"
                title={plusRecente.intitule}
              >
                {plusRecente.annee} →
              </Link>
            )}
            <Link to="/ag/archives" className="text-sm text-navy-600 underline">Retour aux archives</Link>
          </div>
        )}
      />

      {error && <Card className="mb-4 p-4 text-sm text-red-700">{error}</Card>}

      {/* ------------------------------ LES DÉCISIONS DE CETTE ASSEMBLÉE, EN TÊTE
          ⚠ Pascal (2026-09-28) : « en en-tête de chaque AG on a un résumé avec
          les décisions principales ». C'est ce qu'on vient chercher — pas le
          nombre de pages ni la qualité du scan. Il passe donc AVANT le document,
          en pleine largeur.
          ⚠ Quand il manque, on le dit plutôt que de ne rien afficher : une
          absence muette se lirait « cette assemblée n'a rien décidé ». */}
      <Card className="mb-6 overflow-hidden">
        {/* Les rubriques d'en-tête du résumé, dans son ordre.
            ⚠ LE LIEU SUR SA PROPRE LIGNE, en pleine largeur (`sm:col-span-4`).
            C'est une adresse — « Salle polyvalente, mairie, route de Messery,
            74140 Nernier » — qui, dans une colonne au quart de la carte, se
            casserait sur trois lignes et déformerait les quatre rubriques
            voisines. Il ouvre l'en-tête parce que c'est l'ordre du résumé : où,
            puis qui, puis combien.
            ⚠ Il porte parfois « Non indiqué au procès-verbal » (AG 2005) : c'est
            la source qui constate l'absence, et on la rend telle quelle plutôt
            que de laisser un tiret qui se lirait « pas encore renseigné ». */}
        <div className="grid gap-4 border-b border-navy-100 px-5 py-4 sm:grid-cols-4">
          {pv.lieu && (
            <div className="sm:col-span-4">
              <Rubrique titre="Lieu de la séance" valeur={pv.lieu} />
            </div>
          )}
          <Rubrique titre="Président de séance" valeur={pv.president_seance} />
          <Rubrique titre="Scrutateur" valeur={pv.scrutateur} />
          <Rubrique titre="Secrétaire" valeur={pv.syndic} />
          <Rubrique titre="Présents ou représentés" valeur={pv.presents_representes} />
        </div>

        <div className="px-5 py-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Ce qui a été décidé</p>

          {/* LES RÉSERVES SUR CE DOCUMENT, AU-DESSUS DU TABLEAU.
              ⚠ Elles n'étaient affichées qu'aux membres NON bureau, tout en bas,
              sous un titre « Commentaire » : le président — celui qui en a le plus
              besoin — ne les voyait que dans sa zone de saisie. Or elles disent
              qu'une page du PV manque, qu'une résolution a été déclarée adoptée
              avec moins de voix qu'il n'en fallait, ou que deux versions du PV se
              contredisent. Une réserve qu'on lit après le tableau qu'elle
              qualifie arrive trop tard. */}
          {pv.commentaire && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
              <span className="font-medium">Réserve sur ce document — </span>
              <span className="whitespace-pre-wrap">{pv.commentaire}</span>
            </div>
          )}

          {pv.resolutions?.length > 0 ? (
            <>
              {impactantes.length > 0 ? (
                <Resolutions liste={impactantes} unite={pv.unite_vote} />
              ) : (
                /* ⚠ DÉPOUILLÉE MAIS SANS AUCUNE DÉCISION, ce n'est PAS « pas
                   encore dépouillée ». Le cas existe : l'AG de 1988 n'a qu'une
                   ligne, et c'est « Inconnu (page manquante) ». Servir le message
                   d'attente y ferait croire à un travail qui reste à faire, alors
                   que le travail est fait et que c'est le DOCUMENT qui est
                   incomplet — ce que la réserve, juste au-dessus, explique. */
                <p className="mt-2 text-sm text-slate-500">
                  Aucune résolution de cette assemblée n’a été mise aux voix avec un résultat connu.
                </p>
              )}
              {/* ⚠ LES ÉCARTÉES RESTENT ACCESSIBLES, à un clic. Les montrer en
                  premier noie les deux ou trois décisions qui ont réellement
                  engagé le lotissement. Les SUPPRIMER serait autre chose — un
                  fonds d'archives ne choisit pas ce qui mérite mémoire, il
                  choisit ce qu'il montre en premier. */}
              {ecartees.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setToutVoir((v) => !v)}
                    className="text-xs text-navy-600 underline"
                  >
                    {/* ⚠ LE LIBELLÉ NE NOMME PAS CE QU'IL REPLIE. Une première
                        version annonçait « bureau, comptes, quitus, budget,
                        syndic » : vrai de la plupart des assemblées, faux de
                        2023, dont les écartées sont des comptes rendus de
                        procédure et des points tombés avec un rejet. Un libellé
                        qui décrit à côté est pire que muet. */}
                    {toutVoir
                      ? 'Masquer les autres points'
                      : `Afficher les ${ecartees.length} autres points de l’ordre du jour`}
                  </button>
                  {toutVoir && <Resolutions liste={ecartees} unite={pv.unite_vote} />}
                </div>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-slate-400">
              Les décisions de cette assemblée n’ont pas encore été dépouillées. Le procès-verbal
              ci-dessous reste consultable en attendant.
            </p>
          )}
          {/* ⚠ CETTE MENTION RESTE, quoi qu'il arrive au reste de l'écran : un
              résumé est une lecture, le procès-verbal est l'acte. Celui qui cite
              le premier sans avoir ouvert le second se trompera un jour. */}
          {pv.resolutions?.length > 0 && (
            <p className="mt-3 text-xs text-slate-400">
              Résumé{pv.resume_etabli_le ? ` établi le ${formatDate(pv.resume_etabli_le)}` : ''} d’après le
              procès-verbal ; <strong>seul le procès-verbal fait foi</strong>.
              {ecartees.length > 0 && ` Ne figurent ici que les résolutions RÉELLEMENT MISES AUX VOIX, hors points de routine. Les ${ecartees.length} autres — non votées, reportées, points d’information, élection du bureau, comptes, quitus, budget courant et désignation du syndic — sont repliées ci-dessus.`}
            </p>
          )}
        </div>
      </Card>

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
                {/* C'est CE champ qui alimente l'en-tête de la fiche : le dire
                    évite de chercher où se saisit le résumé qu'on vient de lire. */}
                {/* ⚠ `resume` (texte libre) A ÉTÉ RETIRÉ DE L'ÉCRAN (Pascal,
                    2026-09-28 : « je ne vois pas à quoi sert le champ résumé »).
                    Il datait d'avant la 062, quand « ce qui a été décidé » ne
                    pouvait s'écrire qu'en paragraphe. Le tableau des résolutions
                    le fait maintenant, en mieux : il est cherchable et comparable
                    d'une année à l'autre. Le champ était VIDE sur les 25 archives
                    — le proposer encore invitait à recopier à la main ce que la
                    ligne du dessus dit déjà, et deux versions d'une même chose
                    finissent toujours par diverger.
                    ⚠ La COLONNE reste en base : aucune donnée à perdre, et une
                    migration pour supprimer un champ vide serait du risque pur. */}
                <Textarea
                  label="Réserve sur ce document — affichée en tête, au-dessus des décisions"
                  rows={3}
                  value={form.commentaire}
                  onChange={set('commentaire')}
                  placeholder="Ce qui empêche de lire ce procès-verbal au pied de la lettre : une page manquante, deux versions qui se contredisent, un vote déclaré adopté sans les voix requises."
                />
                <div className="flex items-center justify-end gap-2">
                  {enregistre && <span className="text-xs text-emerald-700">Enregistré.</span>}
                  <Button onClick={enregistrer} disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer'}</Button>
                </div>
              </div>
            </Card>
          )}

          {/* LE TEXTE OCÉRISÉ — REPLIÉ (Pascal, 2026-09-28 : « je ne vois pas à
              quoi sert […] le champ texte en bas »).
              ⚠ IL NE SE LIT PAS, IL FAIT CHERCHER. C'est ce texte qui alimente la
              recherche du fonds et les dossiers ; personne ne vient lire une
              reconnaissance de caractères sur un scan de 1961. Déplié par défaut,
              il occupait un écran entier sous le document qu'il transcrit.
              ⚠ IL N'EST PAS SUPPRIMÉ POUR AUTANT : c'est le seul endroit où l'on
              constate qu'un document n'a AUCUN texte — donc qu'il ne ressortira
              d'aucune recherche et ne portera aucun dossier. Cette absence-là doit
              rester visible, et elle s'affiche sans qu'on ait à déplier. */}
          <Card>
            <CardHeader
              title="Texte reconnu automatiquement"
              subtitle="Sert à retrouver le document dans les recherches. Ne pas citer."
            />
            <div className="p-5">
              {pv.texte_ocr ? (
                <>
                  <button
                    type="button"
                    onClick={() => setVoirTexte((v) => !v)}
                    className="text-sm text-navy-600 underline"
                  >
                    {voirTexte ? 'Masquer la transcription' : 'Afficher la transcription'}
                  </button>
                  {voirTexte && (
                    <>
                      {/* ⚠ L'avertissement est AU-DESSUS du texte, pas en note de
                          bas de page : on le lit avant de lire ce qu'il qualifie. */}
                      <div className="mb-3 mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                        Transcription <strong>approximative</strong>, produite automatiquement à partir du scan. Elle comporte
                        des erreurs, d’autant plus sur les documents anciens. <strong>Le document scanné fait foi</strong> :
                        ne recopiez jamais ce texte dans un courrier ou une délibération sans l’avoir vérifié sur l’original.
                      </div>
                      <div className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded border border-navy-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                        {pv.texte_ocr}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Aucun texte n’a pu être extrait de ce document. Il reste consultable, mais la recherche plein texte
                  ne le trouvera pas, et il n’apparaîtra sous aucun dossier.
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
                    {/* Le libellé du vocabulaire, pas la clé technique : « Eaux
                        pluviales » et non « eaux ». */}
                    {pv.mots_cles.map((m) => <Badge key={m} tone="gray">{tagLibelle(m)}</Badge>)}
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
