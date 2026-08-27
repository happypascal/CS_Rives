import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Spinner, EmptyState, num } from '../components/ui'
import { RgpdGate } from '../components/RgpdGate'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

// Colonnes de la liste, et clé de tri de chacune. Déclarées en table plutôt
// qu'en JSX : l'en-tête, le tri et les cellules se lisent alors au même endroit,
// et ajouter une colonne ne demande pas de modifier trois blocs séparés.
//
// `valeur` renvoie ce sur quoi on TRIE, pas ce qu'on affiche : le propriétaire
// vit sur une autre ligne que le lot, et un lot vacant doit se ranger sans faire
// échouer la comparaison — d'où les chaînes vides par défaut.
const COLONNES = [
  { cle: 'lot', libelle: 'Lot', valeur: (l) => l.numero || '', numerique: true },
  { cle: 'proprietaire', libelle: 'Propriétaire', valeur: (l) => l.proprietaire?.nom || '' },
  { cle: 'adresse_lotissement', libelle: 'Adresse dans le lotissement', valeur: (l) => l.adresse_lotissement || '' },
  // Superficie triée en NUMÉRIQUE : en texte, 90 passerait après 1000.
  { cle: 'superficie', libelle: 'Superficie', valeur: (l) => (l.superficie != null ? String(l.superficie) : ''), numerique: true },
  { cle: 'adresse_communication', libelle: 'Adresse de communication', valeur: (l) => l.proprietaire?.adresse_communication || '' },
  { cle: 'email', libelle: 'Email', valeur: (l) => l.proprietaire?.email || '' },
  { cle: 'telephone', libelle: 'Téléphone', valeur: (l) => l.proprietaire?.telephone || '' },
]

// Le tri choisi est mémorisé PAR NAVIGATEUR : on consulte ce registre en
// allers-retours (liste → fiche → liste), et retrouver la colonne « Superficie »
// ou « Propriétaire » à chaque retour est une corvée. `localStorage` suffit —
// c'est un confort d'affichage, propre à la personne et à son poste, il n'a rien
// à faire en base. Toute lecture ou écriture peut lever (navigation privée,
// site data bloqué) : on retombe alors silencieusement sur le tri par défaut.
const CLE_TRI = 'cs-rives.registre-proprietaires.tri'
const TRI_DEFAUT = { cle: 'lot', sens: 1 }

function lireTri() {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_TRI) || 'null')
    // Une colonne supprimée depuis, ou un contenu bricolé à la main, ne doit pas
    // casser l'écran : on ne retient que ce qui existe encore.
    if (brut && COLONNES.some((c) => c.cle === brut.cle) && (brut.sens === 1 || brut.sens === -1)) return brut
  } catch { /* stockage indisponible */ }
  return TRI_DEFAUT
}

export default function ProprietairesList() {
  return (
    <RgpdGate>
      <Contenu />
    </RgpdGate>
  )
}

function Contenu() {
  const { isAdmin } = useAuth()
  const isMobile = useIsMobile()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lots, setLots] = useState([])
  const [q, setQ] = useState('')
  const [tri, setTri] = useState(lireTri)
  const [nouveau, setNouveau] = useState('')
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    setError('')
    try {
      setLots(await repo.listLots())
    } catch (e) {
      // Un refus de la RLS doit se VOIR : sur ce registre plus qu'ailleurs, un
      // écran vide se lirait « aucun propriétaire » alors qu'il signifie
      // « vous n'avez pas le droit ».
      setError(e?.message || 'Chargement impossible.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const colonne = COLONNES.find((c) => c.cle === tri.cle) || COLONNES[0]
  const filtres = useMemo(() => {
    const terme = q.trim().toLowerCase()
    const liste = terme
      ? lots.filter((l) =>
          [l.numero, l.adresse_lotissement, l.proprietaire?.nom, l.proprietaire?.gerant_nom,
           l.proprietaire?.mandataire_nom, l.proprietaire?.email]
            .filter(Boolean).join(' ').toLowerCase().includes(terme),
        )
      : [...lots]
    return liste.sort((a, b) => {
      const va = colonne.valeur(a)
      const vb = colonne.valeur(b)
      // `numeric` pour que le lot 10 vienne après le 9, et non entre le 1 et le 2.
      return va.localeCompare(vb, 'fr', { numeric: colonne.numerique }) * tri.sens
    })
  }, [lots, q, colonne, tri.sens])

  const vacants = lots.filter((l) => !l.proprietaire).length

  const trierPar = (cle) =>
    setTri((t) => {
      const suivant = t.cle === cle ? { cle, sens: -t.sens } : { cle, sens: 1 }
      try {
        localStorage.setItem(CLE_TRI, JSON.stringify(suivant))
      } catch { /* stockage indisponible : le tri vaut pour la session */ }
      return suivant
    })

  const creer = async () => {
    if (!nouveau.trim()) return
    setBusy(true)
    try {
      await repo.createLot({ numero: nouveau.trim() })
      setNouveau('')
      await reload()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Spinner />

  return (
    <div>
      <PageHeader
        title="Registre des propriétaires"
        subtitle="Membres de l’ASL : un lot, son propriétaire actuel, et l’historique des mutations."
      />

      {/* Totaux du registre. La superficie totale est le DÉNOMINATEUR des voix
          en AG et des charges — on l'affiche avec le nombre de lots qui y
          contribuent : tant que le registre est incomplet, les parts sont
          provisoires, et le taire donnerait des tantièmes faux qui auraient
          l'air justes. Le compte des propriétaires est distinct de celui des
          lots : un lot vacant n'en a pas, et un même propriétaire peut en
          détenir plusieurs. */}
      {lots.length > 0 && (
        <Card className="mb-4 grid gap-3 px-5 py-3 sm:grid-cols-3">
          <Total valeur={lots.length} libelle="lot(s) au registre" />
          <Total
            valeur={lots.filter((l) => l.proprietaire).length}
            libelle="propriétaire(s) actuel(s)"
            detail={vacants > 0 ? `${vacants} lot(s) sans propriétaire` : null}
          />
          <Total
            valeur={`${num(lots[0].superficie_totale)} m²`}
            libelle="superficie totale"
            detail={`sur ${lots.filter((l) => l.superficie).length} lot(s) renseigné(s)`}
            alerte={lots.some((l) => !l.superficie) ? 'parts provisoires' : null}
          />
        </Card>
      )}

      {error && (
        <Card className="mb-4 p-4">
          <p className="text-sm font-semibold text-red-700">Impossible de charger le registre.</p>
          <p className="mt-1 text-sm text-slate-600">{error}</p>
        </Card>
      )}

      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input placeholder="Rechercher (lot, nom, adresse, email)…" value={q} onChange={(e) => setQ(e.target.value)} />
          {/* La création d'un lot se fait ici parce qu'un lot n'est qu'un
              numéro : tout le reste — propriétaire, adresses, coordonnées — se
              saisit sur la fiche, comme demandé. */}
          {isAdmin && !isMobile && (
            <div className="flex items-end gap-2">
              <Input placeholder="Numéro de lot à créer (ex : 12 ou 12A)" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className="min-w-0 flex-1" />
              <Button onClick={creer} disabled={busy || !nouveau.trim()}>Ajouter</Button>
            </div>
          )}
        </div>
      </Card>

      {filtres.length === 0 ? (
        <EmptyState
          title="Aucun lot"
          hint="Le registre sera alimenté depuis les fichiers du syndic. Vous pouvez aussi ajouter un lot à la main."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  {COLONNES.map((c) => (
                    <th key={c.cle} className="px-4 py-2.5 font-medium">
                      <button onClick={() => trierPar(c.cle)} className="inline-flex items-center gap-1 hover:text-navy-700">
                        {c.libelle}
                        {tri.cle === c.cle && <span className="text-navy-600">{tri.sens === 1 ? '▲' : '▼'}</span>}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {filtres.map((l) => (
                  <tr key={l.id} className="hover:bg-navy-50/40">
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/proprietaires/${l.id}`} className="font-medium text-navy-700 hover:underline">{l.numero}</Link>
                      {l.anciens > 0 && <span className="ml-2 text-xs text-slate-400">{l.anciens} ancien(s)</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {l.proprietaire?.nom || <span className="italic text-slate-400">vacant</span>}
                      {/* Le gérant sous la raison sociale : pour une SCI, le nom
                          seul ne dit pas à qui l'on s'adresse. */}
                      {l.proprietaire?.gerant_nom && (
                        <span className="block text-xs text-slate-400">
                          {l.proprietaire.gerant_fonction ? `${l.proprietaire.gerant_fonction} : ` : ''}{l.proprietaire.gerant_nom}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.adresse_lotissement || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-slate-700">
                      {l.superficie != null ? (
                        <>
                          {num(l.superficie)} m²
                          {/* La part n'a de sens que rapportée au total : c'est
                              elle, pas la surface, qui donne le poids de vote. */}
                          {l.part != null && <span className="block text-xs text-slate-400">{l.part.toFixed(2)} %</span>}
                        </>
                      ) : <span className="italic text-slate-400">à renseigner</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{l.proprietaire?.adresse_communication || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{l.proprietaire?.email || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.proprietaire?.telephone || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// Une case de total : le chiffre d'abord, ce qu'il compte ensuite.
function Total({ valeur, libelle, detail, alerte }) {
  return (
    <div>
      <p className="text-lg font-semibold text-navy-800">{valeur}</p>
      <p className="text-xs uppercase tracking-wide text-slate-500">{libelle}</p>
      {detail && <p className="text-xs text-slate-400">{detail}</p>}
      {alerte && <p className="text-xs font-medium text-amber-700">{alerte}</p>}
    </div>
  )
}
