import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Input, Button, Spinner, EmptyState, Badge } from '../components/ui'
import { formatDate } from '../lib/format'
import {
  TYPE_COURT, TYPE_LABELS, QUALITE_LABELS, QUALITE_TONES,
  grouperParDecennie, anneesCouvertes, intervallesManquants, extrait, PREMIERE_ANNEE,
  tagsPresents, tagLibelle, synthesePV, CLE_SYNTHESE,
  estProcesVerbal, TYPE_DOCUMENT_LABELS,
} from '../lib/pvArchiveLogic'
import PiecesJointes from '../components/PiecesJointes'
import { useAuth } from '../lib/AuthContext'

// ARCHIVES DES PROCÈS-VERBAUX DEPUIS 1955 (migration 057).
//
// ⚠ CE N'EST PAS L'ÉCRAN DES ASSEMBLÉES. Les AG de l'application ont un cycle de
// vie, des résolutions, des votes et des comptes ; ceci est un FONDS
// DOCUMENTAIRE, en lecture, relié facultativement à une AG quand elle existe.
// Verser soixante-dix ans d'assemblées fantômes dans `assemblees_generales`
// aurait faussé les écrans de gestion et les budgets.
//
// ⚠ LA FRISE DES ANNÉES MANQUANTES EST LE CŒUR DE L'ÉCRAN, pas une décoration :
// une archive qui montre seulement ce qu'elle contient laisse croire qu'elle est
// complète. C'est cette liste qui dit ce qu'il reste à chercher dans le carton.

// LES TROIS ÉTATS D'UNE CASE, DÉFINIS UNE SEULE FOIS — la frise et sa légende
// lisent le même objet. Écrites deux fois, les couleurs finissent par diverger,
// et une légende qui annonce une couleur que la frise n'emploie plus est pire
// qu'une absence de légende : elle se lit sans être vérifiée.
// ⚠ LE LIBELLÉ DE L'AMBRE DIT QUE L'ANNÉE MANQUE QUAND MÊME. C'est toute sa
// raison d'être : 1988 porte sa convocation, 1963 un relevé de décisions, 1982
// un compte rendu de commission — aucun n'est le procès-verbal, et ces années
// restent dans la liste de ce qu'il faut retrouver. Un libellé qui dirait
// seulement « autre document » laisserait croire l'année couverte.
const ETATS_FRISE = {
  pv: { classe: 'bg-navy-600', libelle: 'procès-verbal au fonds' },
  autre: { classe: 'bg-amber-200', libelle: 'un autre document, mais le procès-verbal manque' },
  rien: { classe: 'bg-slate-200', libelle: 'rien pour cette année' },
}

/** La légende des trois couleurs, sous la frise. */
function LegendeFrise() {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
      <span>Une case par année, de {PREMIERE_ANNEE} à aujourd’hui.</span>
      {Object.entries(ETATS_FRISE).map(([clef, { classe, libelle }]) => (
        <span key={clef} className="flex items-center gap-1.5">
          <span className={`h-3 w-2 shrink-0 rounded-[2px] ${classe}`} />
          {libelle}
        </span>
      ))}
    </div>
  )
}

/** La frise 1955 → aujourd'hui : une case par année, pleine ou vide. */
function Frise({ archives }) {
  const cetteAnnee = new Date().getFullYear()
  // ⚠ LA FRISE NE COMPTE QUE LES PROCÈS-VERBAUX. 1988 porte une convocation et
  // non son PV : comptée, sa case s'allumait et l'année sortait de la liste de
  // ce qu'il reste à retrouver. La frise et les « années manquantes » lisent
  // donc la même règle — se contredire d'un bloc à l'autre du même écran serait
  // pire que se tromper.
  const parAnnee = useMemo(() => {
    const m = new Map()
    for (const a of archives) {
      if (!estProcesVerbal(a)) continue
      m.set(a.annee, (m.get(a.annee) || 0) + 1)
    }
    return m
  }, [archives])
  // Les documents qui ne sont pas des PV, par année : la case reste vide, mais
  // l'infobulle dit ce que le fonds détient tout de même pour cette année-là.
  const autresParAnnee = useMemo(() => {
    const m = new Map()
    for (const a of archives) {
      if (estProcesVerbal(a)) continue
      m.set(a.annee, [...(m.get(a.annee) || []), TYPE_DOCUMENT_LABELS[a.type_document] || a.type_document])
    }
    return m
  }, [archives])

  const annees = []
  for (let a = PREMIERE_ANNEE; a <= cetteAnnee; a++) annees.push(a)

  return (
    <div className="flex flex-wrap gap-0.5">
      {annees.map((a) => {
        const n = parAnnee.get(a) || 0
        const autres = autresParAnnee.get(a)
        const titre = n
          ? `${a} — ${n} procès-verbal${n > 1 ? 'aux' : ''}`
          : `${a} — aucun procès-verbal${autres ? ` (le fonds détient : ${autres.join(', ')})` : ''}`
        return (
          <span key={a} title={titre} className="flex w-2.5 flex-col items-center">
            <span
              className={`h-4 w-2.5 rounded-[2px] ${(n ? ETATS_FRISE.pv : autres ? ETATS_FRISE.autre : ETATS_FRISE.rien).classe}`}
            />
            {/* L'ÉCHELLE — une année tous les cinq ans (Pascal, 2026-10-06).
                ⚠ LE REPÈRE EST DANS LA COLONNE DE SON ANNÉE, pas sur une ligne
                d'axe en dessous : la frise est en `flex-wrap`, et une rangée de
                libellés posée sous la bande se décalerait d'un cran à chaque
                retour à la ligne — c'est-à-dire exactement sur mobile, où elle
                passe sur trois rangées. Porté par la case, le repère la suit où
                qu'elle tombe.
                ⚠ LA BANDE A UNE HAUTEUR FIXE sur TOUTES les colonnes, même sans
                libellé : laissée libre, une rangée sans multiple de cinq serait
                plus courte que les autres et la frise aurait l'air cassée.
                ⚠ ÉCRIT EN VERTICAL (`writing-mode`) parce qu'une colonne mesure
                10 px : « 1955 » à l'horizontale couvrirait quatre ans de frise
                et ferait lire le repère à côté de sa case.
                ⚠ `h-8` est MESURÉ, pas estimé : en vertical, quatre chiffres de
                10 px occupent 23,8 px (la somme des chasses, pas la taille de
                police), plus 4 px de trait. Un premier jet à `h-11` laissait
                20 px de vide sous la frise. */}
            <span className="flex h-8 flex-col items-center">
              {a % 5 === 0 && (
                <>
                  <span className="h-1 w-px bg-slate-300" />
                  <span className="text-[10px] leading-none text-slate-400 [writing-mode:vertical-rl]">{a}</span>
                </>
              )}
            </span>
          </span>
        )
      })}
    </div>
  )
}

function LigneArchive({ a, requete }) {
  const morceau = requete ? extrait(a.texte_ocr, requete) : ''
  return (
    <li className="px-5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/ag/archives/${a.id}`} className="font-medium text-navy-700 hover:underline">
            {a.intitule}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {/* ⚠ La date n'est affichée que si elle est connue : sur un document
                de 1957 le jour est souvent illisible, et « 01/01 » serait faux. */}
            {a.date_ag ? formatDate(a.date_ag) : `${a.annee} — jour inconnu`}
            {a.type_ag && <span> · {TYPE_LABELS[a.type_ag] || a.type_ag}</span>}
            {a.nb_pages != null && <span> · {a.nb_pages} page{a.nb_pages > 1 ? 's' : ''}</span>}
          </p>
          {/* LE GESTIONNAIRE DE L'ÉPOQUE (Pascal, 2026-09-28).
              ⚠ Ce n'est pas le gestionnaire ACTUEL, celui de la barre de gauche :
              c'est celui qui tenait le secrétariat de CETTE assemblée-là. Parcourir
              la liste montre alors les changements de cabinet et d'interlocuteur —
              Moynat Pillet, Maison de l'Immobilier, Lemanique — qu'aucun autre
              écran ne raconte. D'où l'affichage sur sa propre ligne, et pas dans la
              ligne de métadonnées : c'est une information qu'on parcourt du regard
              d'une année à l'autre. */}
          {a.syndic && <p className="mt-0.5 text-xs text-slate-500">Syndic : {a.syndic}</p>}
          {a.mots_cles?.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {a.mots_cles.map((m) => <Badge key={m} tone="gray">{tagLibelle(m)}</Badge>)}
            </div>
          )}
          {morceau && (
            <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs italic text-slate-500">{morceau}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* ⚠ CE QUI N'EST PAS UN PV SE VOIT DANS LA LISTE. Le document de 1988
              est la convocation, son procès-verbal n'a pas été retrouvé : sans
              ce badge, la ligne se lit comme les trente-quatre autres et
              l'année passe pour documentée. L'année figure d'ailleurs aussi
              dans la frise des manquantes — les deux disent la même chose au
              même moment. */}
          {!estProcesVerbal(a) && (
            <Badge tone="amber">{TYPE_DOCUMENT_LABELS[a.type_document] || a.type_document}</Badge>
          )}
          <Badge tone="navy">{TYPE_COURT[a.type_ag] || '?'}</Badge>
          {a.qualite && <Badge tone={QUALITE_TONES[a.qualite]}>{QUALITE_LABELS[a.qualite]}</Badge>}
        </div>
      </div>
    </li>
  )
}

export default function PVArchivesList() {
  const { user, isAdmin, isSecretaire } = useAuth()
  const bureau = isAdmin || isSecretaire
  const [synthese, setSynthese] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archives, setArchives] = useState([])
  const [q, setQ] = useState('')
  const [requete, setRequete] = useState('')
  const [resultats, setResultats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [voirTrous, setVoirTrous] = useState(false)
  // ⚠ UN SEUL dossier à la fois : à dix tags, un cumul « ou » ramènerait presque
  // tout et un cumul « et » presque rien. La question posée est « que s'est-il
  // dit sur la plage ? » — elle porte sur un dossier.
  const [tag, setTag] = useState('')

  useEffect(() => {
    Promise.all([
      repo.listPVArchives(),
      // Idiome de résilience : sans les paramètres, le fonds reste consultable.
      repo.getParametres().catch(() => ({})),
    ])
      .then(([liste, params]) => {
        setArchives(liste)
        setSynthese(synthesePV(params))
      })
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [])

  // ⚠ Le document est SÉRIALISÉ dans un paramètre texte (cf. `synthesePV`).
  const enregistrerSynthese = async (doc) => {
    await repo.setParametre(CLE_SYNTHESE, doc ? JSON.stringify(doc) : '', user?.membre_id || null)
    setSynthese(doc)
  }

  const chercher = async (e) => {
    e?.preventDefault()
    const texte = q.trim()
    setRequete(texte)
    if (!texte) { setResultats(null); return }
    setBusy(true)
    setError('')
    try {
      setResultats(await repo.searchPVArchives(texte))
    } catch (err) {
      setError(err?.message || 'Recherche impossible.')
    } finally {
      setBusy(false)
    }
  }

  const dossiers = useMemo(() => tagsPresents(archives), [archives])
  const trous = useMemo(() => intervallesManquants(archives), [archives])
  const couvertes = useMemo(() => anneesCouvertes(archives), [archives])
  // Le filtre par dossier s'applique AUSSI aux résultats de recherche : chercher
  // « portail » puis restreindre à « Plage » est une question légitime.
  const visibles = useMemo(() => {
    const base = resultats ?? archives
    return tag ? base.filter((a) => (a.mots_cles || []).includes(tag)) : base
  }, [resultats, archives, tag])
  const groupes = useMemo(() => grouperParDecennie(visibles), [visibles])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Archives des procès-verbaux"
        subtitle="Les assemblées du lotissement depuis 1955, telles qu’elles ont été consignées."
        // ⚠ Ce retour n'est pas décoratif : l'écran n'a plus d'entrée de menu
        // (arbitrage Pascal, 2026-09-25), on y vient depuis les Assemblées
        // Générales. Sans ce lien, on n'en ressort que par le bouton du
        // navigateur — et le menu de gauche ne montre alors aucune page active.
        actions={(
          <Link to="/ag"><Button variant="secondary">Retour aux assemblées</Button></Link>
        )}
      />

      {error && <Card className="mb-4 p-4 text-sm text-red-700">{error}</Card>}

      {/* ---------------------------------------- SYNTHÈSE DU FONDS, EN TÊTE
          ⚠ UN SEUL document pour soixante-dix ans d'assemblées (Pascal,
          2026-09-28), pas un par procès-verbal : il raconte les grandes lignes
          du fonds, ce qu'aucune fiche ne peut faire. Chaque assemblée a son
          résumé propre, en tête de sa fiche.
          ⚠ Rangé dans `parametres`, pas dans une colonne : le poser sur une
          archive obligerait à désigner laquelle le porte, et ce serait faux. */}
      {(synthese || bureau) && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-navy-800">Synthèse du fonds</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Ce que ces {archives.length} assemblées racontent, lu d’un bout à l’autre. À lire avant de
            chercher un procès-verbal en particulier.
          </p>
          <div className="mt-3">
            <PiecesJointes
              scope="pv-archives"
              entityId="synthese"
              label=""
              readOnly={!bureau}
              documents={synthese ? [synthese] : []}
              onChange={(liste) => enregistrerSynthese(liste.length ? liste[liste.length - 1] : null)}
            />
          </div>
          {!synthese && !bureau && (
            <p className="text-sm text-slate-500">Aucune synthèse pour l’instant.</p>
          )}
        </Card>
      )}

      {/* ------------------------------------------------ couverture du fonds */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm text-slate-600">
            {couvertes.length === 0
              ? 'Aucun procès-verbal archivé pour l’instant.'
              : <>
                  <strong>{archives.length}</strong> document{archives.length > 1 ? 's' : ''} ·{' '}
                  <strong>{couvertes.length}</strong> année{couvertes.length > 1 ? 's' : ''} couverte{couvertes.length > 1 ? 's' : ''},
                  de {couvertes[0]} à {couvertes[couvertes.length - 1]}
                </>}
          </p>
          {trous.length > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setVoirTrous((v) => !v)}>
              {voirTrous ? 'Masquer' : `Voir les ${trous.length} période${trous.length > 1 ? 's' : ''} manquante${trous.length > 1 ? 's' : ''}`}
            </Button>
          )}
        </div>
        <div className="mt-3"><Frise archives={archives} /></div>
        <LegendeFrise />
        {voirTrous && (
          <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-900">Années sans aucun procès-verbal — à chercher :</p>
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-amber-900">
              {trous.map((t) => (
                <li key={t.debut}>{t.debut === t.fin ? t.debut : `${t.debut} → ${t.fin}`}</li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- recherche */}
      <Card className="mb-4 p-4">
        <form onSubmit={chercher} className="flex flex-wrap items-center gap-2">
          {/* ⚠ Enveloppé dans un div porteur du `flex-1` : `Input` rend TOUJOURS
              son champ dans un `<label>`, même sans étiquette, donc une classe
              passée à `Input` atterrit sur le champ et non sur l'enfant flex —
              le champ restait large de 182 px dans un formulaire de 1118.
              `Textarea` a été corrigé de ce piège (il se rend nu sans label),
              `Input` non : on contourne ici plutôt que de toucher une primitive
              utilisée par une trentaine d'écrans. */}
          <div className="min-w-0 flex-1">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher un mot dans les procès-verbaux (plage, portail, canalisations…)"
            />
          </div>
          <Button type="submit" disabled={busy}>{busy ? 'Recherche…' : 'Rechercher'}</Button>
          {resultats && (
            <Button type="button" variant="ghost" onClick={() => { setQ(''); setRequete(''); setResultats(null) }}>
              Effacer
            </Button>
          )}
        </form>
        {/* ⚠ MENTION OBLIGATOIRE, et elle doit rester : sur du papier de 1955 la
            reconnaissance de caractères se trompe. Sans cet avertissement, une
            recherche sans résultat se lirait « le sujet n'a jamais été abordé »,
            ce qui est une conclusion, pas un constat. */}
        <p className="mt-2 text-xs text-slate-500">
          Recherche sur un texte océrisé, <strong>approximatif pour les documents anciens</strong> : une absence de
          résultat ne prouve pas qu’un sujet n’a pas été traité. Le document scanné fait foi.
        </p>
        {resultats && (
          <p className="mt-2 text-sm text-slate-600">
            {resultats.length} document{resultats.length > 1 ? 's' : ''} pour « {requete} ».
          </p>
        )}

        {/* ------------------------------------------------ FILTRE PAR DOSSIER
            ⚠ Les tags sont posés automatiquement à partir du texte, donc de sa
            qualité : un document sans texte exploitable n'en porte aucun et
            n'apparaîtra sous aucun dossier. L'écran le dit, sinon son absence
            se lirait « ce PV n'en parle pas ». */}
        {dossiers.length > 0 && (
          <div className="mt-3 border-t border-navy-100 pt-3">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Filtrer par dossier</p>
            <div className="flex flex-wrap gap-1.5">
              {dossiers.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTag((t) => (t === d ? '' : d))}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    tag === d
                      ? 'bg-navy-700 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tagLibelle(d)}
                </button>
              ))}
              {tag && (
                <button type="button" onClick={() => setTag('')} className="px-2 text-xs text-navy-600 underline">
                  Tout afficher
                </button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Les dossiers sont repérés automatiquement dans le texte des procès-verbaux. Un document
              dont le texte n’a pas pu être lu n’apparaît sous aucun dossier.
            </p>
          </div>
        )}
      </Card>

      {/* ---------------------------------------------------------- la liste */}
      {visibles.length === 0 ? (
        <EmptyState
          title={tag ? 'Aucun document pour ce dossier' : resultats ? 'Aucun document trouvé' : 'Aucune archive'}
          hint={tag
            ? 'Aucun procès-verbal retenu ne mentionne ce dossier — ou son texte n’a pas pu être lu.'
            : resultats
              ? 'Essayez un autre mot : le texte reconnu sur les scans anciens est approximatif.'
              : 'Les procès-verbaux s’ajoutent par le script d’import, une fois les scans réalisés.'}
        />
      ) : (
        groupes.map((g) => (
          <Card key={g.decennie} className="mb-4 overflow-hidden">
            <div className="border-b border-navy-100 bg-navy-50/60 px-5 py-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-navy-700">
                Années {g.decennie}
              </h2>
            </div>
            <ul className="divide-y divide-navy-50">
              {g.archives.map((a) => <LigneArchive key={a.id} a={a} requete={requete} />)}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}
