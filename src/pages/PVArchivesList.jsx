import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Input, Button, Spinner, EmptyState, Badge } from '../components/ui'
import { formatDate } from '../lib/format'
import {
  TYPE_COURT, TYPE_LABELS, QUALITE_LABELS, QUALITE_TONES,
  grouperParDecennie, anneesCouvertes, intervallesManquants, extrait, PREMIERE_ANNEE,
} from '../lib/pvArchiveLogic'

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

/** La frise 1955 → aujourd'hui : une case par année, pleine ou vide. */
function Frise({ archives }) {
  const cetteAnnee = new Date().getFullYear()
  const parAnnee = useMemo(() => {
    const m = new Map()
    for (const a of archives) m.set(a.annee, (m.get(a.annee) || 0) + 1)
    return m
  }, [archives])

  const annees = []
  for (let a = PREMIERE_ANNEE; a <= cetteAnnee; a++) annees.push(a)

  return (
    <div className="flex flex-wrap gap-0.5">
      {annees.map((a) => {
        const n = parAnnee.get(a) || 0
        return (
          <span
            key={a}
            title={n ? `${a} — ${n} document${n > 1 ? 's' : ''}` : `${a} — aucun procès-verbal`}
            className={`h-4 w-2.5 rounded-[2px] ${n ? 'bg-navy-600' : 'bg-slate-200'}`}
          />
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
          <Link to={`/archives-pv/${a.id}`} className="font-medium text-navy-700 hover:underline">
            {a.intitule}
          </Link>
          <p className="mt-0.5 text-xs text-slate-500">
            {/* ⚠ La date n'est affichée que si elle est connue : sur un document
                de 1957 le jour est souvent illisible, et « 01/01 » serait faux. */}
            {a.date_ag ? formatDate(a.date_ag) : `${a.annee} — jour inconnu`}
            {a.type_ag && <span> · {TYPE_LABELS[a.type_ag] || a.type_ag}</span>}
            {a.nb_pages != null && <span> · {a.nb_pages} page{a.nb_pages > 1 ? 's' : ''}</span>}
          </p>
          {a.resume && <p className="mt-1 text-sm text-slate-600">{a.resume}</p>}
          {morceau && (
            <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-xs italic text-slate-500">{morceau}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone="navy">{TYPE_COURT[a.type_ag] || '?'}</Badge>
          {a.qualite && <Badge tone={QUALITE_TONES[a.qualite]}>{QUALITE_LABELS[a.qualite]}</Badge>}
        </div>
      </div>
    </li>
  )
}

export default function PVArchivesList() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [archives, setArchives] = useState([])
  const [q, setQ] = useState('')
  const [requete, setRequete] = useState('')
  const [resultats, setResultats] = useState(null)
  const [busy, setBusy] = useState(false)
  const [voirTrous, setVoirTrous] = useState(false)

  useEffect(() => {
    repo.listPVArchives()
      .then(setArchives)
      .catch((e) => setError(e?.message || 'Chargement impossible.'))
      .finally(() => setLoading(false))
  }, [])

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

  const trous = useMemo(() => intervallesManquants(archives), [archives])
  const couvertes = useMemo(() => anneesCouvertes(archives), [archives])
  const groupes = useMemo(() => grouperParDecennie(resultats ?? archives), [resultats, archives])

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Archives des procès-verbaux"
        subtitle="Les assemblées du lotissement depuis 1955, telles qu’elles ont été consignées."
      />

      {error && <Card className="mb-4 p-4 text-sm text-red-700">{error}</Card>}

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
        <p className="mt-1 text-xs text-slate-400">Une case par année, de {PREMIERE_ANNEE} à aujourd’hui. Les cases claires n’ont aucun procès-verbal.</p>
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
      </Card>

      {/* ---------------------------------------------------------- la liste */}
      {(resultats ?? archives).length === 0 ? (
        <EmptyState
          title={resultats ? 'Aucun document trouvé' : 'Aucune archive'}
          hint={resultats
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
