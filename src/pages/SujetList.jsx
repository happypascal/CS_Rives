import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Select, Spinner, EmptyState, Badge } from '../components/ui'
import { useIsMobile } from '../lib/useIsMobile'
import { grouperParCategorie, categoriesConnues, CATEGORIE_AUTRE } from '../lib/sujetLogic'

// LA MÉMOIRE DU LOTISSEMENT — liste par sujet.
//
// Un sujet n'est ni un projet ni une décision : c'est le fil d'un dossier qui
// traverse les années (le portail, la zone C, le recouvrement). Il répond à la
// question qu'aucun autre écran ne traite : POURQUOI en est-on là ?

export default function SujetList() {
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sujets, setSujets] = useState([])
  const [q, setQ] = useState('')
  const [titre, setTitre] = useState('')
  const [categorie, setCategorie] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setError('')
    try {
      setSujets(await repo.listSujets())
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

  const filtres = useMemo(() => {
    const terme = q.trim().toLowerCase()
    if (!terme) return sujets
    // La recherche porte aussi sur la SYNTHÈSE : on cherche souvent un sujet par
    // un mot qui n'est ni dans son titre ni dans son résumé.
    return sujets.filter((s) =>
      [s.titre, s.categorie, s.resume, s.contenu]
        .filter(Boolean).join(' ').toLowerCase().includes(terme),
    )
  }, [sujets, q])

  const creer = async () => {
    if (!titre.trim()) return
    setBusy(true)
    setError('')
    try {
      await repo.createSujet({ titre: titre.trim(), categorie: categorie || null })
      setTitre('')
      setCategorie('')
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  const groupes = grouperParCategorie(filtres)

  return (
    <div>
      <PageHeader
        title="Mémoire du lotissement"
        subtitle="Ce qu’il faut savoir sur chaque dossier, et comment on en est arrivé là."
      />

      <Card className="mb-4 px-5 py-4">
        <p className="text-sm text-slate-700">
          Un conseil hérite des décisions, mais rarement du <strong>pourquoi</strong>. Cette
          mémoire existe pour que les débats déjà tranchés ne soient pas refaits : l’état d’un
          dossier, son histoire, et les pièces qui s’y rapportent.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Chacun peut créer un sujet et compléter une synthèse. Dans la chronologie, chacun
          corrige ses propres entrées.
        </p>
      </Card>

      {error && (
        <Card className="mb-4 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </Card>
      )}

      <Card className="mb-6 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            placeholder="Rechercher (titre, catégorie, contenu)…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {!isMobile && (
            <div className="flex items-end gap-2">
              <Input
                placeholder="Nouveau sujet (ex : Portail)"
                value={titre}
                onChange={(e) => setTitre(e.target.value)}
                className="min-w-0 flex-1"
              />
              <Select value={categorie} onChange={(e) => setCategorie(e.target.value)} className="w-44">
                <option value="">— Catégorie —</option>
                {categoriesConnues(sujets).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Button onClick={creer} disabled={busy || !titre.trim()}>Ajouter</Button>
            </div>
          )}
        </div>
      </Card>

      {filtres.length === 0 ? (
        <EmptyState
          title={q ? 'Aucun sujet ne correspond' : 'La mémoire est vide'}
          hint={
            q
              ? 'Essayez un autre mot.'
              : 'Créez un premier sujet — le portail, la plage, les canalisations, la zone C, le recouvrement… un par dossier qui revient d’une année sur l’autre.'
          }
        />
      ) : (
        <div className="space-y-8">
          {groupes.map(([cat, liste]) => (
            <div key={cat}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {liste.map((s) => (
                  <Link key={s.id} to={`/memoire/${s.id}`} className="block">
                    <Card className="h-full p-4 transition-colors hover:bg-navy-50/40">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-navy-800">{s.titre}</p>
                        {/* Le compte d'entrées distingue une fiche nourrie d'un
                            simple titre — sans ouvrir chaque sujet. */}
                        {s.entrees > 0 ? (
                          <Badge tone="navy">{s.entrees}</Badge>
                        ) : (
                          <Badge tone="gray">vide</Badge>
                        )}
                      </div>
                      {s.resume && <p className="mt-1 text-sm text-slate-600">{s.resume}</p>}
                      {!s.resume && !s.contenu && (
                        <p className="mt-1 text-sm italic text-slate-400">
                          Aucune synthèse pour l’instant.
                        </p>
                      )}
                      {cat === CATEGORIE_AUTRE && !s.categorie && (
                        <p className="mt-2 text-xs text-amber-700">à ranger dans une catégorie</p>
                      )}
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
