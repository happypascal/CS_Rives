import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { repo } from '../lib/api'
import { PageHeader } from '../components/ProtectedRoute'
import { Card, Button, Input, Modal, Spinner, EmptyState, num } from '../components/ui'
import { RgpdGate } from '../components/RgpdGate'
import { useAuth } from '../lib/AuthContext'
import { useIsMobile } from '../lib/useIsMobile'
import { destinatairesDuLot, aDesTitulaires, CONTACT_PROPRIETAIRE, CONTACT_LABELS, lireTri, ecrireTri, trierLots } from '../lib/proprietaireLogic'
import { controles, ROLE_LABELS } from '../lib/titulaireLogic'
import {
  compterTitres, statutDuTitre, TITRE_LABELS_COURTS, TITRE_TONS,
  TITRE_NON_ENVOYE, TITRE_A_VERIFIER, TITRE_INCOMPLET, TITRE_RECU,
} from '../lib/titreLogic'
import { formatDate } from '../lib/format'
import { downloadRegistreNotairePDF } from '../lib/pdf'
import { classeurXLSX, colotisNotaireLignes, COLOTIS_LARGEURS, downloadXLSX } from '../lib/xlsx'

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
    tris: [['lot', 'parcelle'], ['superficie', 'surface'], ['numero_syndic', 'n° Foncia'], ['lot_origine', 'lot 1955']],
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

// Cette personne figure-t-elle déjà dans le libellé de la période ?
//
// ⚠ DEUX FORMES À TESTER, ET C'EST LE PIÈGE. `destinatairesDuLot` compose le
// nom avec la CIVILITÉ — « M. Danil Gladkov » — tandis que le libellé n'y met
// la civilité que lorsque le prénom manque : « Danil Gladkov / Mme Gladkov ».
// Ne tester que la forme avec civilité ferait répéter tous ceux qui ont un
// prénom, c'est-à-dire la quasi-totalité ; ne tester que la forme sans
// civilité ferait répéter ceux qui n'en ont pas. On teste les deux.
// Les tons de `titreLogic` rendus en classes Tailwind. ⚠ Ici et non dans la
// logique : celle-ci est partagée avec le PDF et le classeur, qui ne
// connaissent pas Tailwind.
const COULEURS_TITRE = {
  green: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-700',
}

const CIVILITES = /^(M\.|Mme|Mlle|M)\s+/i
function dejaAuLibelle(libelle, nom) {
  const l = libelle || ''
  if (!l || !nom) return false
  return l.includes(nom) || l.includes(nom.replace(CIVILITES, ''))
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
  const [exportOuvert, setExportOuvert] = useState(false)
  // ⚠ UN SEUL ÉTAT POUR TROIS FILTRES, et non trois booléens : deux cases
  // cochées en même temps donneraient une liste vide sans raison visible.
  // `null` = aucun filtre de titre.
  const [filtreTitre, setFiltreTitre] = useState(null)
  // ⚠ Les deux filtres s'excluent : cumulés, une liste vide ne dirait pas
  // lequel des deux l'a vidée.
  const [seulementACompleter, setSeulementACompleter] = useState(false)

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

  // ⚠ CE QUI MANQUE, LOT PAR LOT (068). Sans cela, savoir QUELS lots sont
  // incomplets obligeait à ouvrir les cinquante fiches — « je ne vois pas les
  // 17 ambre dans la liste » (Pascal, 22 octobre). Un décompte qu'on annonce et
  // qu'on ne peut pas parcourir ne sert à rien.
  // ⚠ Calculé seulement sur les périodes REPRISES : une période encore décrite
  // par les colonnes de 044 n'a pas de titulaires, et le crier « aucun
  // titulaire » sur tout le registre noierait les vrais manques.
  const alertesParLot = useMemo(() => {
    const m = new Map()
    for (const l of lots) {
      if (!l.proprietaire || !(l.proprietaire.titulaires || []).length) continue
      const a = controles(l.proprietaire.titulaires)
      if (a.length) m.set(l.id, a)
    }
    return m
  }, [lots])
  const aCompleter = alertesParLot.size

  const filtres = useMemo(() => {
    const terme = q.trim().toLowerCase()
    // ⚠ Le filtre porte sur UN statut nommé, plus sur « pas de date » : les
    // trois états se filtrent du même geste, et « à vérifier » ne se confond
    // plus avec « pas envoyé ».
    const base = filtreTitre
      ? lots.filter((l) => l.proprietaire && statutDuTitre(l.proprietaire) === filtreTitre)
      : seulementACompleter
        ? lots.filter((l) => alertesParLot.has(l.id))
        : lots
    const liste = terme
      ? base.filter((l) =>
          [l.numero, l.numero_syndic, l.adresse_lotissement,
           // Le lot d'origine se cherche : c'est sous ce nom que le cahier des
           // charges de 1955 et les actes désignent les terrains.
           l.numero_origine && `lot ${l.numero_origine}`, l.zone && `zone ${l.zone}`,
           l.proprietaire?.nom, l.proprietaire?.nom_2,
           l.proprietaire?.dirigeant_nom, l.proprietaire?.dirigeant_nom_2, l.proprietaire?.mandataire_nom,
           l.proprietaire?.email, l.proprietaire?.email_2, l.proprietaire?.mandataire_email]
            .filter(Boolean).join(' ').toLowerCase().includes(terme),
        )
      : [...base]
    // ⚠ Même fonction que celle dont se sert la navigation de la fiche : c'est
    // ce qui garantit que « suivante » mène bien à la ligne d'en dessous.
    return trierLots(liste, tri)
  }, [lots, q, tri, filtreTitre, seulementACompleter, alertesParLot])

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
  // ⚠ TROIS ÉTATS DEPUIS LA 071, plus deux. Compter « sans titre » comme
  // l'absence de date mettait dans le même sac celui qui n'a rien envoyé et
  // celui qui déclare l'avoir fait — et c'est ce qui a fait relancer des
  // colotis à jour le 30 octobre.
  const titres = compterTitres(lots)
  const avecActe = titres[TITRE_RECU]
  const sansActe = titres[TITRE_NON_ENVOYE]
  const aVerifier = titres[TITRE_A_VERIFIER]
  const incomplets = titres[TITRE_INCOMPLET]

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
          {/* ⚠ Les manques des titulaires (068) ont leur tuile, au même titre
              que les titres : ce sont des obligations statutaires non remplies
              — un représentant d'indivision que personne n'a désigné (art. 6),
              une personne à notifier qu'on ne sait pas joindre (art. 13). */}
          {aCompleter > 0 && (
            <Total
              valeur={`${aCompleter}`}
              libelle="parcelle(s) à compléter"
              alerte="titulaires incomplets"
            />
          )}
          {/* ⚠ LA TUILE DIT MAINTENANT LES TROIS ÉTATS. Annoncer « 11 / 50 »
              et « 39 manquants » mettait les colotis à jour dans la colonne
              des retardataires — c'est ce chiffre qui a servi à bâtir la
              relance du 30 octobre. */}
          <Total
            valeur={`${avecActe} / ${proprietaires}`}
            libelle="titre(s) reçu(s) par le notaire"
            detail={[aVerifier > 0 ? `${aVerifier} à vérifier` : null,
              incomplets > 0 ? `${incomplets} incomplet(s)` : null].filter(Boolean).join(' · ')
              || (sansActe === 0 && proprietaires > 0 ? 'tous transmis' : null)}
            alerte={sansActe > 0 ? `${sansActe} pas envoyé(s)` : null}
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
            {aCompleter > 0 && (
              <Button
                variant={seulementACompleter ? 'primary' : 'secondary'}
                onClick={() => { setSeulementACompleter((v) => !v); setFiltreTitre(null) }}
                title="N’afficher que les parcelles dont les titulaires sont incomplets"
              >
                À compléter ({aCompleter})
              </Button>
            )}
            {/* ⚠ DEUX BOUTONS, PAS UN. « Sans titre » mettait dans le même
                sac celui qui n'a rien envoyé et celui qui déclare l'avoir
                fait : c'est ce qui a fait relancer des colotis à jour. Les
                deux populations ne se traitent pas pareil — l'une se relance,
                l'autre se vérifie auprès de l'étude. */}
            {aVerifier > 0 && (
              <Button
                variant={filtreTitre === TITRE_A_VERIFIER ? 'primary' : 'secondary'}
                onClick={() => { setFiltreTitre((v) => (v === TITRE_A_VERIFIER ? null : TITRE_A_VERIFIER)); setSeulementACompleter(false) }}
                title="Le coloti déclare avoir envoyé son titre, l’état du notaire ne le montre pas"
              >
                À vérifier ({aVerifier})
              </Button>
            )}
            {incomplets > 0 && (
              <Button
                variant={filtreTitre === TITRE_INCOMPLET ? 'primary' : 'secondary'}
                onClick={() => { setFiltreTitre((v) => (v === TITRE_INCOMPLET ? null : TITRE_INCOMPLET)); setSeulementACompleter(false) }}
                title="Le notaire a reçu une pièce, mais il en manque une autre"
              >
                Incomplet ({incomplets})
              </Button>
            )}
            {sansActe > 0 && (
              <Button
                variant={filtreTitre === TITRE_NON_ENVOYE ? 'primary' : 'secondary'}
                onClick={() => { setFiltreTitre((v) => (v === TITRE_NON_ENVOYE ? null : TITRE_NON_ENVOYE)); setSeulementACompleter(false) }}
                title="N’afficher que les propriétaires qui n’ont pas envoyé leur titre"
              >
                Pas envoyé ({sansActe})
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
                    ⚠ La couleur ne porte pas seule l'information : une mention
                    « société » suit le nom, et la fiche le dit aussi — un
                    daltonien ou une impression en noir et blanc n'y perdent rien.
                    ⚠ CE COMMENTAIRE A ÉTÉ FAUX JUSQU'AU 31 OCTOBRE : il
                    affirmait que « le nom commence par SCI », alors que neuf des
                    quatorze sociétés du lotissement sont déclarées sans le sigle.
                    La couleur portait donc bien seule l'information pour elles. */}
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
                      {/* La numérotation d'ORIGINE (069) — celle du cahier des
                          charges de 1955. ⚠ Zone et numéro ensemble, jamais le
                          numéro seul : six parcelles portent le n° 4, chacune
                          dans une zone différente. Affiché seulement s'il est
                          connu — il manque sur la moitié des parcelles, et une
                          mention vide sur chaque ligne n'apprendrait rien. */}
                      {l.numero_origine && (
                        <span className="block text-xs text-navy-600">
                          lot {l.numero_origine}{l.zone ? `, zone ${l.zone}` : ''} <span className="text-slate-400">(1955)</span>
                        </span>
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
                      {/* ⚠ LA QUALITÉ DE SOCIÉTÉ EST ÉCRITE, PAS DEVINÉE DU NOM.
                          Le commentaire du corps de tableau affirmait que « le
                          nom commence par SCI » — c'est faux pour NEUF sociétés
                          sur quatorze. Vérifié au registre officiel le
                          31 octobre : Logudoro, Jeanlu, Precettes, Maison du
                          Lac, Le Clapotis, GABISAM, Entre Lac et Montagnes et
                          Kitka sont déclarées SANS le sigle — ce sont les
                          annuaires du web qui préfixent la forme juridique à la
                          dénomination. Sans cette mention, la couleur ambre
                          portait seule l'information, ce que ce tableau
                          s'interdit, et « Logudoro » se lisait comme un nom de
                          personne. C'est la remarque de Pascal (« il n'y a
                          jamais SCI »).
                          ⚠ « société » et non « SCI » : la FORME exacte n'est
                          pas en base — on sait qu'il s'agit d'une personne
                          morale, pas si c'est une SCI, une SARL ou autre chose.
                          Écrire « SCI » serait réintroduire par l'affichage la
                          supposition qu'on vient de retirer du nom. */}
                      {l.proprietaire?.est_societe && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          société
                        </span>
                      )}
                      {/* ⚠ L'état du titre SOUS le nom, pas en colonne : une
                          sixième colonne aurait élargi un tableau déjà dense,
                          alors que l'information se lit avec la personne à qui
                          on va la réclamer. Rien n'est affiché sur une parcelle
                          vacante — on ne réclame pas un titre à personne. */}
                      {/* ⚠ TROIS ÉTATS DEPUIS LA 071, et le troisième porte sa
                          date : « à vérifier » tout court ne dit pas depuis
                          quand le coloti affirme avoir envoyé, or c'est
                          exactement ce que l'étude peut recouper. */}
                      {l.proprietaire && (() => {
                        const s = statutDuTitre(l.proprietaire)
                        // ⚠ La couleur vient de `TITRE_TONS`, pas d'une
                        // cascade de conditions : écrite à la main, elle
                        // oubliait « incomplet », qui tombait dans le rouge
                        // des dossiers où rien n'a été fait — alors que le
                        // notaire a bien reçu quelque chose.
                        const couleur = COULEURS_TITRE[TITRE_TONS[s]]
                        const quand = s === TITRE_RECU || s === TITRE_INCOMPLET
                          ? l.proprietaire.acte_transmis_le
                          : s === TITRE_A_VERIFIER ? l.proprietaire.acte_declare_le
                            : null
                        return (
                          <span className={`block text-xs ${couleur}`} title={l.proprietaire.acte_observations || undefined}>
                            titre : {TITRE_LABELS_COURTS[s].toLowerCase()}
                            {quand ? ` le ${formatDate(quand)}` : ''}
                          </span>
                        )
                      })()}
                      {/* ⚠ CE QUI MANQUE, SUR LA LIGNE. Le compte seul ne sert à
                          rien si l'on ne sait pas quelles parcelles il désigne.
                          Le détail reste sur la fiche : ici on dit qu'il y a
                          quelque chose à y faire, pas quoi. */}
                      {alertesParLot.has(l.id) && (
                        <span className="mt-0.5 block text-xs font-medium text-amber-700">
                          ⚠ {alertesParLot.get(l.id).length} point(s) à compléter
                        </span>
                      )}
                      {/* Le dirigeant sous la raison sociale : pour une SCI, le
                          nom seul ne dit pas à qui l'on s'adresse.
                          ⚠ Masqué dès que la période est reprise : les dirigeants
                          y sont des titulaires, et la liste des destinataires
                          juste au-dessus les nomme déjà. Les deux ensemble
                          affichaient la même personne deux fois. */}
                      {!aDesTitulaires(l.proprietaire) && l.proprietaire?.dirigeant_nom && (
                        <span className="block text-xs text-slate-400">
                          {l.proprietaire.dirigeant_fonction ? `${l.proprietaire.dirigeant_fonction} : ` : ''}{l.proprietaire.dirigeant_nom}
                        </span>
                      )}
                      {/* Le second dirigeant : lui aussi engage la SCI, donc vote
                          et signe pour elle. */}
                      {!aDesTitulaires(l.proprietaire) && l.proprietaire?.dirigeant_nom_2 && (
                        <span className="block text-xs text-slate-400">
                          {l.proprietaire.dirigeant_fonction_2 ? `${l.proprietaire.dirigeant_fonction_2} : ` : ''}{l.proprietaire.dirigeant_nom_2}
                        </span>
                      )}
                      {(() => {
                        // TOUS les destinataires, pas seulement le premier : une
                        // convocation part à plusieurs, et n'en montrer qu'un
                        // laisserait croire que les autres ne sont pas prévenus.
                        const liste = destinatairesDuLot(l.proprietaire)
                        if (l.proprietaire && liste.length === 0) {
                          return <span className="block text-xs font-medium text-amber-700">injoignable</span>
                        }
                        return liste.map((d, i) => {
                          // ⚠ UNE LIGNE QUI N'APPREND RIEN NE S'AFFICHE PAS.
                          // Depuis que le libellé nomme tous les détenteurs,
                          // un indivisaire sans adresse électronique ni
                          // téléphone ne laissait plus qu'un « indivisaire »
                          // orphelin — répété cinq fois sur l'indivision de la
                          // parcelle 0B 247+263. Le registre compte des
                          // titulaires sans e-mail : ce cas est courant, pas
                          // théorique.
                          const rôle = d.source !== CONTACT_PROPRIETAIRE
                          const nom = d.nom && !dejaAuLibelle(l.proprietaire?.nom, d.nom) ? d.nom : ''
                          if (!d.email && !d.telephone && !nom && !d.refus_electronique) return null
                          return (
                          <span key={`${d.source}-${i}`} className="mt-0.5 block text-xs text-slate-500">
                            {d.email || d.telephone}
                            {/* D'où vient l'adresse : sans cela on croirait écrire
                                au propriétaire alors qu'on écrit à son relais ou
                                à l'un de ses dirigeants. */}
                            {/* ⚠ `source` est une source de 044 OU un rôle de
                                068 : la bascule se fait période par période, et
                                une liste mêle donc les deux. Sans la seconde
                                table, un lot repris afficherait « undefined ». */}
                            {/* ⚠ LE NOM N'EST RÉPÉTÉ QUE S'IL N'EST PAS DÉJÀ AU
                                LIBELLÉ. Depuis que celui-ci nomme TOUS les
                                détenteurs — « Danil Gladkov / Mme Gladkov » —
                                le redire ligne par ligne recrée exactement le
                                doublon que Pascal a signalé sur la fiche le
                                31 octobre : les mêmes noms deux fois sur le
                                même écran. On garde le RÔLE, qui lui n'est
                                nulle part ailleurs, et le nom ne reparaît que
                                pour ceux qui ne possèdent pas — le dirigeant
                                d'une SCI, un mandataire, un nu-propriétaire. */}
                            {rôle && (
                              <span className="block italic text-slate-400">
                                {(CONTACT_LABELS[d.source] || ROLE_LABELS[d.source] || d.source).toLowerCase()}
                                {nom ? ` — ${nom}` : ''}
                                {d.refus_electronique && <span className="not-italic text-amber-700"> · courrier postal</span>}
                              </span>
                            )}
                            {d.email && d.telephone && (
                              <span className="block whitespace-nowrap text-slate-400">{d.telephone}</span>
                            )}
                          </span>
                          )
                        })
                      })()}
                      {/* LE SECOND INDIVISAIRE, avec SES propres coordonnées.
                          Deux noms, une seule propriété — une part de charges,
                          une voix — mais rien n'oblige les deux personnes à
                          partager une adresse ou un téléphone, et c'est même
                          l'inverse quand une indivision naît d'une succession.
                          Le bloc est visuellement détaché pour qu'on ne prête
                          pas à l'un les coordonnées de l'autre. */}
                      {!aDesTitulaires(l.proprietaire) && l.proprietaire?.nom_2 && (
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
                      {/* ⚠ Sur une période reprise, le mandataire est un RÔLE et
                          non une colonne : on lit le titulaire, sinon la colonne
                          se figerait sur la valeur d'avant la reprise et ne
                          suivrait plus les corrections. */}
                      {(() => {
                        const t068 = (l.proprietaire?.titulaires || [])
                          .find((x) => !x.date_fin && x.role === 'mandataire')
                        if (!t068) return null
                        return (
                          <>
                            {[t068.civilite, t068.prenom, t068.nom].filter(Boolean).join(' ')}
                            {t068.email && <span className="block text-xs text-slate-500">{t068.email}</span>}
                            {t068.telephone && <span className="block whitespace-nowrap text-xs text-slate-500">{t068.telephone}</span>}
                          </>
                        )
                      })()}
                      {!aDesTitulaires(l.proprietaire) && (l.proprietaire?.mandataire_nom || l.proprietaire?.mandataire_email) ? (
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
            // ⚠ UN VRAI CLASSEUR, PAS UN CSV. Le CSV ne décrit ni son encodage
            // ni son séparateur : il est sorti deux fois de travers (une seule
            // colonne, puis accents cassés) selon la locale de qui l'ouvre. Le
            // raisonnement complet est en tête de `xlsx.js`.
            onClick={() => {
              const octets = classeurXLSX(colotisNotaireLignes(lots), {
                feuille: 'État des colotis',
                largeurs: COLOTIS_LARGEURS,
              })
              downloadXLSX(`etat-colotis-ASL-Rives-${new Date().toISOString().slice(0, 10)}.xlsx`, octets)
              onClose()
            }}
          >
            Tableur (Excel)
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
