import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Modal, Spinner, EmptyState, num } from '../components/ui'
import { RgpdGate } from '../components/RgpdGate'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { destinataires, CONTACT_PROPRIETAIRE, CONTACT_LABELS, lireTri, ecrireTri, trierLots } from '../lib/proprietaireLogic'
import { formatDate } from '../lib/format'
import { downloadRegistreNotairePDF } from '../lib/pdf'
import { colotisNotaireToCSV, downloadCSV } from '../lib/csv'

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
    tris: [['lot', 'parcelle'], ['superficie', 'surface'], ['numero_syndic', 'n° Foncia']],
  },
  { libelle: 'Adresse de la parcelle', tris: [['adresse_lotissement', 'adresse']] },
  { libelle: 'Adresse de communication', tris: [['adresse_communication', 'adresse']] },
  { libelle: 'Propriétaire', tris: [['proprietaire', 'nom'], ['email', 'email']] },
  {
    // MANDATAIRE — l'intermédiaire à qui l'on parle quand on n'atteint pas le
    // propriétaire (colotis étrangers surtout). Il a sa colonne parce que sur
    // ces parcelles-là c'est LA seule adresse utilisable.
    // ⚠ Ce n'est pas un dirigeant — le dirigeant engage la société, le mandataire relaie.
    libelle: 'Mandataire',
    tris: [['mandataire', 'nom']],
  },
]

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
  const [exportOuvert, setExportOuvert] = useState(false)
  const [seulementSansActe, setSeulementSansActe] = useState(false)

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

  const filtres = useMemo(() => {
    const terme = q.trim().toLowerCase()
    const base = seulementSansActe
      ? lots.filter((l) => l.proprietaire && !l.proprietaire.acte_transmis_le)
      : lots
    const liste = terme
      ? base.filter((l) =>
          [l.numero, l.numero_syndic, l.adresse_lotissement, l.proprietaire?.nom, l.proprietaire?.nom_2,
           l.proprietaire?.dirigeant_nom, l.proprietaire?.dirigeant_nom_2, l.proprietaire?.mandataire_nom,
           l.proprietaire?.email, l.proprietaire?.email_2, l.proprietaire?.mandataire_email]
            .filter(Boolean).join(' ').toLowerCase().includes(terme),
        )
      : [...base]
    // ⚠ Même fonction que celle dont se sert la navigation de la fiche : c'est
    // ce qui garantit que « suivante » mène bien à la ligne d'en dessous.
    return trierLots(liste, tri)
  }, [lots, q, tri, seulementSansActe])

  // ⚠ L'EXPORT PORTE SUR TOUT LE REGISTRE, jamais sur la recherche en cours.
  // Un « état des colotis » amputé des lignes qui ne correspondaient pas au
  // terme tapé serait lu comme exhaustif par le notaire — et les parcelles
  // absentes passeraient pour n'avoir rien à transmettre. Seul l'ORDRE est repris
  // de l'écran, pour que le document se relise comme la liste.
  const tousTries = useMemo(() => trierLots(lots, tri), [lots, tri])

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

  // SUIVI DES TITRES (059) — la question que l'écran doit trancher d'un coup
  // d'œil : qui n'a pas encore transmis ?
  //
  // ⚠ Le dénominateur est le nombre de PROPRIÉTAIRES, pas de parcelles : on ne
  // réclame pas un titre à une parcelle vacante, et l'y compter ferait croire à
  // un retard qui n'existe pas.
  const avecActe = lots.filter((l) => l.proprietaire?.acte_transmis_le).length
  const sansActe = lots.filter((l) => l.proprietaire && !l.proprietaire.acte_transmis_le).length

  const trierPar = (cle) =>
    setTri((t) => {
      const suivant = t.cle === cle ? { cle, sens: -t.sens } : { cle, sens: 1 }
      ecrireTri(suivant)
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
        actions={
          // ⚠ Desktop seulement : on n'envoie pas un état des colotis au notaire
          // depuis un téléphone. Pas de test de rôle ici — tout l'écran est
          // derrière `RgpdGate`, donc déjà réservé au président et au secrétaire.
          !isMobile && lots.length > 0 && (
            <>
              <Button variant="secondary" onClick={() => setExportOuvert(true)}>
                Export pour le notaire
              </Button>
            </>
          )
        }
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
        <Card className="mb-4 grid gap-3 px-5 py-3 sm:grid-cols-4">
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
          {/* ⚠ Le suivi des titres a sa case parce que c'est une ÉCHÉANCE, pas
              une statistique : au 31 octobre, chaque titre manquant devient une
              recherche facturée 100 € au propriétaire (résolution n° 15). */}
          <Total
            valeur={`${avecActe} / ${proprietaires}`}
            libelle="titre(s) reçu(s) par le notaire"
            detail={sansActe === 0 && proprietaires > 0 ? 'tous transmis' : null}
            alerte={sansActe > 0 ? `${sansActe} manquant(s)` : null}
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
          <div className="flex items-center gap-2">
            <Input placeholder="Rechercher (parcelle, n° Foncia, nom, adresse, email)…" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-0 flex-1" />
            {/* ⚠ Bouton plutôt que case à cocher : c'est la question qu'on vient
                poser à cet écran en octobre, elle doit se déclencher d'un clic et
                se voir enfoncée. Masqué s'il n'y a rien à relancer — un filtre
                qui ne filtrerait rien est du bruit. */}
            {sansActe > 0 && (
              <Button
                variant={seulementSansActe ? 'primary' : 'secondary'}
                onClick={() => setSeulementSansActe((v) => !v)}
                title="N’afficher que les propriétaires dont le notaire n’a pas encore reçu le titre"
              >
                Sans titre ({sansActe})
              </Button>
            )}
          </div>
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
                        {c.tris.map(([cle, libelle]) => (
                          <button
                            key={cle}
                            onClick={() => trierPar(cle)}
                            className={`inline-flex items-center gap-0.5 hover:text-navy-700 ${
                              tri.cle === cle ? 'font-semibold text-navy-700' : 'text-slate-400'
                            }`}
                          >
                            {libelle}
                            {tri.cle === cle && <span>{tri.sens === 1 ? '▲' : '▼'}</span>}
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
                    <td className="whitespace-pre-line px-4 py-3 text-slate-600">{l.proprietaire?.adresse_communication || '—'}</td>

                    {/* 4 — la personne et ses coordonnées, d'un seul tenant :
                        éparpillées en trois colonnes, il fallait balayer la ligne
                        pour reconstituer un interlocuteur. */}
                    <td className="px-4 py-3 text-slate-700">
                      {l.proprietaire?.nom || <span className="italic text-slate-400">vacant</span>}
                      {/* ⚠ L'état du titre SOUS le nom, pas en colonne : une
                          sixième colonne aurait élargi un tableau déjà dense,
                          alors que l'information se lit avec la personne à qui
                          on va la réclamer. Rien n'est affiché sur une parcelle
                          vacante — on ne réclame pas un titre à personne. */}
                      {l.proprietaire && (
                        l.proprietaire.acte_transmis_le ? (
                          <span className="block text-xs text-emerald-700" title={l.proprietaire.acte_observations || undefined}>
                            titre reçu le {formatDate(l.proprietaire.acte_transmis_le)}
                          </span>
                        ) : (
                          <span className="block text-xs text-amber-700">titre non reçu</span>
                        )
                      )}
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
                      {(() => {
                        // TOUS les destinataires, pas seulement le premier : une
                        // convocation part à plusieurs, et n'en montrer qu'un
                        // laisserait croire que les autres ne sont pas prévenus.
                        const liste = destinataires(l.proprietaire)
                        if (l.proprietaire && liste.length === 0) {
                          return <span className="block text-xs font-medium text-amber-700">injoignable</span>
                        }
                        return liste.map((d, i) => (
                          <span key={`${d.source}-${i}`} className="mt-0.5 block text-xs text-slate-500">
                            {d.email || d.telephone}
                            {/* D'où vient l'adresse : sans cela on croirait écrire
                                au propriétaire alors qu'on écrit à son relais ou
                                à l'un de ses dirigeants. */}
                            {d.source !== CONTACT_PROPRIETAIRE && (
                              <span className="block italic text-slate-400">
                                {CONTACT_LABELS[d.source].toLowerCase()}{d.nom ? ` — ${d.nom}` : ''}
                              </span>
                            )}
                            {d.email && d.telephone && (
                              <span className="block whitespace-nowrap text-slate-400">{d.telephone}</span>
                            )}
                          </span>
                        ))
                      })()}
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

      <ExportNotaireModal open={exportOuvert} onClose={() => setExportOuvert(false)} lots={tousTries} />
    </div>
  )
}

// EXPORT POUR LE NOTAIRE — ce qui sort du registre, et ce qui n'en sort pas.
//
// ⚠ LA MODALE EXISTE POUR DIRE CE QU'ELLE N'EXPORTE PAS. Télécharger d'un clic
// un fichier de cinquante propriétaires sans rien afficher laisserait croire
// qu'il contient tout le registre — et celui qui l'envoie engage sa
// responsabilité personnelle (mention RGPD, migration 035). On montre donc la
// liste des champs retenus ET celle des champs écartés, avant le téléchargement.
function ExportNotaireModal({ open, onClose, lots }) {
  const vacants = lots.filter((l) => !l.proprietaire).length
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Export pour le notaire"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => { downloadCSV(`etat-colotis-ASL-Rives-${new Date().toISOString().slice(0, 10)}.csv`, colotisNotaireToCSV(lots)); onClose() }}
          >
            Tableur (CSV)
          </Button>
          <Button onClick={() => { downloadRegistreNotairePDF(lots); onClose() }}>
            Document (PDF)
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-slate-600">
        <p>
          La liste des <strong>{lots.length} parcelles</strong>, de leurs propriétaires et de leurs adresses
          électroniques, avec deux colonnes laissées vides — <em>Acte reçu le</em> et <em>Observations</em> —
          que le notaire remplit et vous retourne.
        </p>
        <div className="rounded-md border border-navy-100 bg-slate-50 p-3">
          <p className="text-xs font-semibold text-navy-800">Le fichier contient :</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">
            <li>la parcelle et le nom du ou des propriétaires</li>
            <li>l’adresse électronique de chaque contact officiel</li>
            <li>l’adresse dans le lotissement et la superficie</li>
          </ul>
          <p className="mt-1 text-xs text-slate-500">
            Ni domiciles hors lotissement, ni numéros de téléphone.
          </p>
        </div>
        {/* ⚠ CE BLOC N'EST PAS UNE POLITESSE. Les adresses électroniques ne
            sortent normalement PAS de ce registre ; elles figurent ici sur
            arbitrage du président, pour un destinataire précis. Celui qui
            télécharge doit le savoir avant d'envoyer, parce que c'est lui qui
            engage sa responsabilité. */}
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-900">Ce fichier est destiné au notaire de l’association, et à lui seul.</p>
          <p className="mt-1 text-xs text-amber-900">
            Les adresses électroniques ne sortent pas de ce registre. Elles figurent ici par exception,
            décidée par le président, pour que le notaire puisse rapprocher les actes reçus et relancer
            qui n’a pas répondu — au titre de la résolution n° 15 de l’AG 2026.
          </p>
          <p className="mt-2 text-xs text-amber-900">
            La même liste adressée à un coloti, à un prestataire ou au syndic serait une divulgation, et
            votre responsabilité personnelle serait engagée.
          </p>
        </div>
        {vacants > 0 && (
          <p className="text-xs text-slate-500">
            {vacants} parcelle{vacants > 1 ? 's' : ''} sans propriétaire connu figure{vacants > 1 ? 'nt' : ''} dans la liste,
            signalée{vacants > 1 ? 's' : ''} comme telle{vacants > 1 ? 's' : ''} : le notaire doit savoir à qui il ne peut rien réclamer.
          </p>
        )}
      </div>
    </Modal>
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
