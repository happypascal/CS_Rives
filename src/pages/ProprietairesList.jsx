import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Spinner, EmptyState, num } from '../components/ui'
import { RgpdGate } from '../components/RgpdGate'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'

// Colonnes de la liste, déclarées en table plutôt qu'en JSX : l'en-tête, les
// tris et les cellules se lisent alors au même endroit.
//
// `valeur` renvoie ce sur quoi on TRIE, pas ce qu'on affiche : le propriétaire
// vit sur une autre ligne que la parcelle, et une parcelle vacante doit se
// ranger sans faire échouer la comparaison — d'où les chaînes vides par défaut.
//
// CINQ colonnes, chacune regroupant ce qui se lit ensemble : la parcelle et sa
// surface, l'adresse du bien, l'adresse où l'on écrit, la personne et ses
// coordonnées, l'intermédiaire et les siennes. Une colonne par champ obligeait à
// balayer huit cases pour reconstituer un interlocuteur.
//
// Une colonne peut porter DEUX tris (`tris`) : l'empilement fait perdre l'en-tête
// cliquable de la donnée du dessous, alors qu'ici la superficie est l'assiette
// des voix et des charges — on doit pouvoir classer dessus. Les deux clés
// restent donc offertes dans le même en-tête.
const COLONNES = [
  {
    // ⚠ « Parcelle » et non « Lot » : la ligne porte la parcelle cadastrale, et
    // une parcelle n'est pas un lot — deux d'entre elles pèsent 1,81 et 1,19 lot,
    // soit 51 lots pour 50 parcelles. Le nombre de lots se lit sur la fiche.
    libelle: 'Parcelle',
    tris: [
      { cle: 'lot', libelle: 'parcelle', valeur: (l) => l.numero || '', numerique: true },
      // Superficie triée en NUMÉRIQUE : en texte, 90 passerait après 1000.
      { cle: 'superficie', libelle: 'surface', valeur: (l) => (l.superficie != null ? String(l.superficie) : ''), numerique: true },
      // Tri par n° Foncia : c'est l'ordre des appels de fonds, donc celui dans
      // lequel on rapproche le registre des documents du syndic. Numérique, ces
      // références étant des nombres codés par zone (1xx = A … 5xx = E).
      { cle: 'numero_syndic', libelle: 'n° Foncia', valeur: (l) => l.numero_syndic || '', numerique: true },
    ],
  },
  {
    libelle: 'Adresse de la parcelle',
    tris: [{ cle: 'adresse_lotissement', libelle: 'adresse', valeur: (l) => l.adresse_lotissement || '' }],
  },
  {
    libelle: 'Adresse de communication',
    tris: [{ cle: 'adresse_communication', libelle: 'adresse', valeur: (l) => l.proprietaire?.adresse_communication || '' }],
  },
  {
    libelle: 'Propriétaire',
    tris: [
      { cle: 'proprietaire', libelle: 'nom', valeur: (l) => l.proprietaire?.nom || '' },
      { cle: 'email', libelle: 'email', valeur: (l) => l.proprietaire?.email || '' },
    ],
  },
  {
    // MANDATAIRE — l'intermédiaire à qui l'on parle quand on n'atteint pas le
    // propriétaire (colotis étrangers surtout). Il a sa colonne parce que sur
    // ces parcelles-là c'est LA seule adresse utilisable : s'en tenir à celle du
    // propriétaire laisserait croire qu'on n'a aucun moyen de les joindre.
    // ⚠ Ce n'est pas un dirigeant — le dirigeant engage la société, le mandataire relaie.
    libelle: 'Mandataire',
    // Tri sur le NOM quand il existe, sinon sur l'adresse : une fiche sans nom
    // (0B 240) doit se ranger avec les autres mandataires, pas avec les vides.
    tris: [{ cle: 'mandataire', libelle: 'nom', valeur: (l) => l.proprietaire?.mandataire_nom || l.proprietaire?.mandataire_email || '' }],
  },
]

// Toutes les clés de tri à plat : l'écran range par une CLÉ, pas par une colonne.
const TRIS = COLONNES.flatMap((c) => c.tris)

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
    if (brut && TRIS.some((t) => t.cle === brut.cle) && (brut.sens === 1 || brut.sens === -1)) return brut
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

  const colonne = TRIS.find((t) => t.cle === tri.cle) || TRIS[0]
  const filtres = useMemo(() => {
    const terme = q.trim().toLowerCase()
    const liste = terme
      ? lots.filter((l) =>
          [l.numero, l.numero_syndic, l.adresse_lotissement, l.proprietaire?.nom, l.proprietaire?.nom_2,
           l.proprietaire?.dirigeant_nom, l.proprietaire?.dirigeant_nom_2, l.proprietaire?.mandataire_nom,
           l.proprietaire?.email, l.proprietaire?.email_2, l.proprietaire?.mandataire_email]
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

  // Une indivision compte pour UN propriétaire : deux personnes, mais une seule
  // propriété — une part de charges, une voix. Les compter pour deux gonflerait
  // le total au-dessus du nombre réel de colotis.
  const proprietaires = lots.filter((l) => l.proprietaire).length
  // ⚠ On compte les indivisions DÉCLARÉES, pas les biens à deux noms : détenir
  // à deux n'est pas être en indivision (communauté entre époux, tontine).
  const indivisions = lots.filter((l) => l.proprietaire?.est_indivision).length
  const aDeuxNoms = lots.filter((l) => l.proprietaire?.nom_2).length
  const vacants = lots.filter((l) => !l.proprietaire).length
  // Somme des `nombre_lots`, jamais un compte de lignes — cf. le commentaire des
  // totaux ci-dessous.
  const totalLots = lots.reduce((s2, l) => s2 + (Number(l.nombre_lots) || 0), 0)

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
        subtitle="Membres de l’ASL : une parcelle, son propriétaire actuel, et l’historique des mutations."
      />

      {/* Totaux du registre. ⚠ Le nombre de lots N'EST PAS le nombre de lignes :
          une ligne est une PARCELLE, et deux d'entre elles pèsent 1,81 et 1,19
          lot — 51 lots pour 50 parcelles. Il se somme donc sur `nombre_lots`,
          jamais sur `lots.length`, dans un registre qui sert d'assiette aux voix
          et aux charges.

          La superficie totale est le DÉNOMINATEUR des voix en AG et des charges :
          on l'affiche avec le nombre de superficies qui y contribuent, pour que
          des parts calculées sur un registre incomplet ne passent pas pour
          définitives. */}
      {lots.length > 0 && (
        <Card className="mb-4 grid gap-3 px-5 py-3 sm:grid-cols-3">
          <Total
            valeur={proprietaires}
            libelle="propriétaire(s) actuel(s)"
            detail={aDeuxNoms > 0 ? `dont ${aDeuxNoms} à deux noms${indivisions > 0 ? `, ${indivisions} en indivision` : ''}` : null}
            alerte={vacants > 0 ? `${vacants} parcelle(s) sans propriétaire` : null}
          />
          <Total valeur={num(totalLots)} libelle="lot(s)" detail={`sur ${lots.length} parcelle(s)`} />
          <Total
            valeur={`${num(lots[0].superficie_totale)} m²`}
            libelle="superficie totale"
            detail={`sur ${lots.filter((l) => l.superficie).length} superficie(s) renseignée(s)`}
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
          <Input placeholder="Rechercher (parcelle, n° Foncia, nom, adresse, email)…" value={q} onChange={(e) => setQ(e.target.value)} />
          {/* La création d'un lot se fait ici parce qu'un lot n'est qu'un
              numéro : tout le reste — propriétaire, adresses, coordonnées — se
              saisit sur la fiche, comme demandé. */}
          {isAdmin && !isMobile && (
            <div className="flex items-end gap-2">
              <Input placeholder="Parcelle à créer (ex : 0B 220)" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className="min-w-0 flex-1" />
              <Button onClick={creer} disabled={busy || !nouveau.trim()}>Ajouter</Button>
            </div>
          )}
        </div>
      </Card>

      {filtres.length === 0 ? (
        <EmptyState
          title="Aucun lot"
          hint="Le registre sera alimenté depuis les fichiers du syndic. Vous pouvez aussi ajouter une parcelle à la main."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
                  {COLONNES.map((c) => (
                    <th key={c.libelle} className="px-4 py-2.5 align-top font-medium">
                      <span className="block">{c.libelle}</span>
                      {/* Les clés de tri sous l'intitulé. Une seule clé pour la
                          plupart des colonnes ; deux quand la cellule empile
                          deux données qu'on peut vouloir classer. */}
                      <span className="mt-0.5 flex flex-wrap gap-2 text-[10px] normal-case">
                        {c.tris.map((t) => (
                          <button
                            key={t.cle}
                            onClick={() => trierPar(t.cle)}
                            className={`inline-flex items-center gap-0.5 hover:text-navy-700 ${
                              tri.cle === t.cle ? 'font-semibold text-navy-700' : 'text-slate-400'
                            }`}
                          >
                            {t.libelle}
                            {tri.cle === t.cle && <span>{tri.sens === 1 ? '▲' : '▼'}</span>}
                          </button>
                        ))}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-50">
                {/* Fond jaune pâle sur les SOCIÉTÉS. Ce n'est pas décoratif : une
                    SCI ne se convoque pas comme une personne — on écrit à la
                    société, ce sont ses dirigeants qui votent et signent pour
                    elle, et c'est le premier réflexe à avoir en préparant une AG.
                    Les repérer d'un coup d'œil évite de les traiter comme les
                    autres.
                    ⚠ La couleur ne porte pas seule l'information : le nom commence
                    par « SCI » et la fiche le dit aussi — un daltonien ou une
                    impression en noir et blanc n'y perdent rien. */}
                {filtres.map((l) => (
                  <tr
                    key={l.id}
                    className={`align-top ${
                      l.proprietaire?.est_societe ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-navy-50/40'
                    }`}
                  >
                    {/* 1 — la parcelle, et sa surface dessous. La surface est
                        l'assiette des voix et des charges : elle appartient à la
                        parcelle, pas au propriétaire, d'où le regroupement. */}
                    <td className="whitespace-nowrap px-4 py-3">
                      <Link to={`/proprietaires/${l.id}`} className="font-medium text-navy-700 hover:underline">{l.numero}</Link>
                      {l.anciens > 0 && <span className="ml-2 text-xs text-slate-400">{l.anciens} ancien(s)</span>}
                      {l.superficie != null ? (
                        <span className="block text-xs text-slate-500">
                          {num(l.superficie)} m²
                          {/* La part n'a de sens que rapportée au total : c'est
                              elle, pas la surface, qui donne le poids de vote. */}
                          {l.part != null && <span className="text-slate-400"> · {l.part.toFixed(2)} %</span>}
                        </span>
                      ) : <span className="block text-xs italic text-slate-400">surface à renseigner</span>}
                      {/* Une parcelle vaut un lot, sauf les deux qui pèsent 1,81
                          et 1,19 : c'est trop structurant pour rester sur la fiche. */}
                      {Number(l.nombre_lots) !== 1 && (
                        <span className="block text-xs font-medium text-navy-600">{num(l.nombre_lots)} lots</span>
                      )}
                      {/* La référence FONCIA, sous l'identifiant cadastral et non
                          à sa place : c'est celle qui revient dans les appels de
                          fonds, donc celle qu'on cherche pour rapprocher le
                          registre des documents du syndic.
                          ⚠ Ce n'est PAS l'identifiant de la parcelle — il vient du
                          cadastre et vit dans `numero`. Aucune unicité, c'est une
                          référence étrangère tenue par un tiers. */}
                      {l.numero_syndic && (
                        <span className="block text-xs text-slate-400">Foncia {l.numero_syndic}</span>
                      )}
                    </td>

                    {/* 2 — l'adresse du bien. */}
                    <td className="px-4 py-3 text-slate-600">{l.adresse_lotissement || '—'}</td>

                    {/* 3 — l'adresse où l'on écrit, souvent très différente. */}
                    <td className="px-4 py-3 text-slate-600">{l.proprietaire?.adresse_communication || '—'}</td>

                    {/* 4 — la personne et ses coordonnées, d'un seul tenant :
                        éparpillées en trois colonnes, il fallait balayer la ligne
                        pour reconstituer un interlocuteur. */}
                    <td className="px-4 py-3 text-slate-700">
                      {l.proprietaire?.nom || <span className="italic text-slate-400">vacant</span>}
                      {/* Le dirigeant sous la raison sociale : pour une SCI, le
                          nom seul ne dit pas à qui l'on s'adresse. */}
                      {l.proprietaire?.dirigeant_nom && (
                        <span className="block text-xs text-slate-400">
                          {l.proprietaire.dirigeant_fonction ? `${l.proprietaire.dirigeant_fonction} : ` : ''}{l.proprietaire.dirigeant_nom}
                        </span>
                      )}
                      {/* Le second dirigeant : lui aussi engage la SCI, donc vote
                          et signe pour elle. */}
                      {l.proprietaire?.dirigeant_nom_2 && (
                        <span className="block text-xs text-slate-400">
                          {l.proprietaire.dirigeant_fonction_2 ? `${l.proprietaire.dirigeant_fonction_2} : ` : ''}{l.proprietaire.dirigeant_nom_2}
                        </span>
                      )}
                      {l.proprietaire?.email && <span className="block text-xs text-slate-500">{l.proprietaire.email}</span>}
                      {l.proprietaire?.telephone && <span className="block whitespace-nowrap text-xs text-slate-500">{l.proprietaire.telephone}</span>}
                      {/* LE SECOND INDIVISAIRE, avec SES propres coordonnées.
                          Deux noms, une seule propriété — une part de charges,
                          une voix — mais rien n'oblige les deux personnes à
                          partager une adresse ou un téléphone, et c'est même
                          l'inverse quand une indivision naît d'une succession.
                          Le bloc est visuellement détaché pour qu'on ne prête
                          pas à l'un les coordonnées de l'autre. */}
                      {l.proprietaire?.nom_2 && (
                        <span className="mt-1 block border-t border-navy-50 pt-1">
                          <span className="block text-xs text-slate-600">
                            et {l.proprietaire.nom_2}
                            {l.proprietaire.est_indivision && <span className="text-slate-400"> · indivision</span>}
                          </span>
                          {l.proprietaire.email_2 && <span className="block text-xs text-slate-500">{l.proprietaire.email_2}</span>}
                          {l.proprietaire.telephone_2 && <span className="block whitespace-nowrap text-xs text-slate-500">{l.proprietaire.telephone_2}</span>}
                        </span>
                      )}
                    </td>

                    {/* 5 — le mandataire, nom et adresse ensemble : séparés, on ne
                        saurait pas à qui appartient l'adresse. Une fiche peut
                        n'avoir que l'adresse, le nom restant à établir. */}
                    <td className="px-4 py-3 text-slate-600">
                      {l.proprietaire?.mandataire_nom || l.proprietaire?.mandataire_email ? (
                        <>
                          {l.proprietaire.mandataire_nom || <span className="italic text-slate-400">nom inconnu</span>}
                          {l.proprietaire.mandataire_email && (
                            <span className="block text-xs text-slate-500">{l.proprietaire.mandataire_email}</span>
                          )}
                          {l.proprietaire.mandataire_telephone && (
                            <span className="block whitespace-nowrap text-xs text-slate-500">{l.proprietaire.mandataire_telephone}</span>
                          )}
                        </>
                      ) : '—'}
                    </td>
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
