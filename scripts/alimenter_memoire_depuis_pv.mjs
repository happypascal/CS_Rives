// LA MÉMOIRE DU LOTISSEMENT, ALIMENTÉE PAR LES ARCHIVES DE PROCÈS-VERBAUX.
//
// Pascal (2026-09-29), après inventaire : « lance sur les quatre sujets et crée
// le sujet Portails ».
//
// La mémoire commençait pour l'essentiel en 2021 ; le fonds couvre 1988→2026.
// L'origine de presque tous les dossiers manquait — et c'est précisément ce que
// la mémoire existe pour conserver.
//
// =============================================================================
// CE QU'UNE RÉSOLUTION APPORTE, ET CE QU'ELLE N'APPORTE PAS
// =============================================================================
// ⚠ UNE RÉSOLUTION N'EST PAS UN « POURQUOI ». Elle dit ce qui a été voté, pas
// pourquoi. Elle DATE le fil et en donne l'ossature ; la synthèse — « où en
// est-on ? » — reste à écrire à la main. C'est exactement la séparation des deux
// tables de la 045 : `sujet_entrees` s'ajoute, `sujets.contenu` se réécrit.
//
// ⚠ ON IMPORTE AUSSI CE QUI N'A PAS ÉTÉ VOTÉ. « Non votée », « Reportée »,
// « Rejetée », « Information » : la mémoire n'est PAS le registre des décisions.
// Que les portails aient été refusés en 2002, que la provision spéciale ait été
// rejetée cinq fois entre 2005 et 2015, que tout le lot « portails » de 2020
// soit resté non voté — c'est cela, l'histoire du dossier. Ne garder que les
// adoptions donnerait à lire une suite de succès, ce qui serait faux.
// ⚠ Le résultat est TOUJOURS écrit en tête du contenu : une entrée qui tait
// qu'une résolution a été rejetée se lit comme si elle avait été adoptée.
//
// =============================================================================
// LE RATTACHEMENT
// =============================================================================
// ⚠ FRONTIÈRES DE MOT, JAMAIS `includes`. Un premier inventaire cherchait
// « syndic » : il s'allumait sur « conseil SYNDICal » et ramenait 114
// résolutions sur 303. Même leçon que les dossiers du fonds (060) : un critère
// qui retient tout ne retient rien.
//
// ⚠ UNE RÉSOLUTION PEUT NOURRIR DEUX SUJETS, et c'est voulu. « Portails :
// mobilisation du fonds travaux » appartient au fil des portails ET à celui du
// fonds ; « Assignation de la SCI Villa Aysha (article 15) » au contentieux ET à
// l'article 15. Un sujet est un FIL, pas un tiroir : forcer chaque fait dans un
// seul rendrait l'autre fil incompréhensible à l'endroit précis où il compte.
//
// =============================================================================
// IDEMPOTENCE
// =============================================================================
// ⚠ Dédoublonnage sur (sujet, date, intitulé normalisé). Relancer n'écrit rien.
// ⚠ Les entrées déjà saisies À LA MAIN portant la même date sont SIGNALÉES au
// rapport sans être touchées : on ne peut pas deviner si elles disent la même
// chose, et supprimer le travail de quelqu'un sur une ressemblance serait pire
// que laisser un doublon qu'un humain verra.
//
// Usage :
//   node scripts/alimenter_memoire_depuis_pv.mjs        essai à blanc
//   node scripts/alimenter_memoire_depuis_pv.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { cleIntitule } from '../src/lib/pvArchiveLogic.js'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ⚠ LE SUJET « PORTAILS » N'EXISTAIT PAS, alors que c'est le fil le plus long du
// fonds après l'article 15 : trente-cinq résolutions de 2001 à 2026, et pas une
// ligne dans la mémoire. Catégorie « Équipements », comme la plage.
const SUJET_NOUVEAU = {
  titre: 'Portails et fermeture du lotissement',
  categorie: 'Équipements',
  // ⚠ `sujets.contenu` EST DU HTML (rendu par `dangerouslySetInnerHTML`, comme
  // `sujet_entrees.contenu`) : un texte à sauts de ligne s'y écrase en un seul
  // bloc. D'où les `<p>` — et l'échappement systématique de ce qui vient des
  // archives, sinon une esperluette casse l'affichage de la fiche.
  contenu: [
    'Fermer le lotissement est une question posée à l’assemblée depuis 2001, et',
    'tranchée dans les deux sens selon les décennies.',
    '',
    'L’assemblée REFUSE de fermer les deux accès en 2002, puis accepte deux',
    'portails manuels chemin de Messery en 2003. Le principe d’une fermeture est',
    'adopté en 2008. En 2020, tout le dossier — principe, entreprise, mandat,',
    'honoraires, financement — est soit rejeté soit laissé sans vote.',
    '',
    'Il repart en 2023 : remise en fonction des portails et de l’interphone,',
    'mandat au conseil syndical pour 50 000 € TTC, appel de fonds au 1er juillet',
    '2024 — mais le financement par le fonds de travaux est refusé. En 2025, le',
    'budget est jugé insuffisant, la délégation est portée à 70 000 € TTC et la',
    'mobilisation du fonds de travaux est cette fois adoptée.',
    '',
    'Le portail de la PLAGE est un dossier distinct, refusé en 2023 puis en 2026 ;',
    'seule la serrure a été changée.',
    '',
    'Synthèse établie le 29 septembre 2026 d’après les résolutions d’assemblée.',
    'Seuls les procès-verbaux font foi.',
  ].join('\n').split('\n\n').map((p) => `<p>${p.split('\n').join(' ')}</p>`).join(''),
}

// ⚠ Les motifs sont éprouvés sur les 303 résolutions du fonds avant d'être
// figés ici : chacun a été relu ligne à ligne dans l'inventaire du 2026-09-29.
const RATTACHEMENTS = {
  'Fonds travaux': [
    'provision speciale', 'fonds de reserve', 'fonds de travaux', 'fonds travaux', 'livret a',
  ],
  'Urbanisme et servitudes': [
    'article 15', 'article 12 bis', 'hauteur des arbres', 'hauteur des plantations',
    'commission des sages',
  ],
  'Plage': ['plage', 'ponton', 'rampe', 'epave', 'marchepied'],
  'Contentieux SCI Villa Aysha': ['aysha'],
  [SUJET_NOUVEAU.titre]: [
    'portail', 'fermeture du lotissement', 'securisation', 'interphone',
  ],
}

const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036F]/g, '').toLowerCase()
// ⚠ Précédé et suivi d'autre chose qu'une lettre, le `s` du pluriel toléré.
const contient = (texte, motif) => new RegExp(`(^|[^a-z])${motif}(s|es)?([^a-z]|$)`).test(norm(texte))

async function lireEnvFichier() {
  try {
    const texte = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of texte.split('\n')) {
      const propre = ligne.replace(/[\u2028\u2029\uFEFF\u00A0\u200B]/g, '').trim()
      if (!propre || propre.startsWith('#')) continue
      const i = propre.indexOf('=')
      if (i < 1) continue
      out[propre.slice(0, i).trim()] = propre.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch { return {} }
}

const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

// ⚠ TOUT CE QUI VIENT DES ARCHIVES EST ÉCHAPPÉ. `sujet_entrees.contenu` est
// rendu en HTML : une esperluette dans « haies & fossés » casserait la fiche, et
// un `<` avalerait la suite du texte. Même leçon qu'avec `&apos;` dans le
// registre — un texte de données ne doit jamais porter le balisage de son
// support.
const htm = (t) => String(t ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Le contenu d'une entrée : le résultat d'abord, puis le détail, puis la source. */
function contenuEntree(r, archive) {
  const p = [`<p>Résolution ${htm(r.numero)} — <strong>${htm(r.resultat)}</strong>.</p>`]
  if (r.detail) p.push(`<p>${htm(r.detail)}</p>`)
  const voix = [['Pour', r.pour], ['Contre', r.contre], ['Abst.', r.abstention]]
    .filter(([, v]) => v != null)
    .map(([l, v]) => `${l} ${v.toLocaleString('fr-FR')}`)
    .join(' · ')
  if (voix) p.push(`<p>Voix : ${htm(voix)}${archive.unite_vote ? ` (${htm(archive.unite_vote)})` : ''}.</p>`)
  // ⚠ LA PROVENANCE EST ÉCRITE DANS L'ENTRÉE, pas seulement connue du script :
  // dans cinq ans, personne ne saura d'où vient cette ligne si elle ne le dit pas.
  p.push(`<p><em>Source : archives des procès-verbaux — ${htm(archive.intitule)}.</em></p>`)
  return p.join('')
}

async function main() {
  W(`# La mémoire alimentée par les archives de PV — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  // ---------------------------------------------------------- l'auteur
  // ⚠ Les entrées APPARTIENNENT à leur auteur (045) : il faut en désigner un.
  // C'est le président qui a demandé cet import, et c'est lui qui pourra les
  // corriger. Sans propriétaire, personne ne peut plus y toucher.
  const { data: membres } = await supabase.from('membres_cs').select('id, nom, prenom, role').eq('role', 'president').eq('actif', true)
  const auteur = membres?.[0]
  if (!auteur) throw new Error('Aucun président actif : impossible de désigner l’auteur des entrées.')
  W(`Auteur des entrées créées : **${auteur.prenom} ${auteur.nom}** (président).`)
  W('')

  // ---------------------------------------------------------- le fonds
  const { data: archives, error: eArch } = await supabase
    .from('pv_archives').select('annee, date_ag, intitule, unite_vote, resolutions, type_document').order('annee')
  if (eArch) throw new Error(`Lecture du fonds : ${eArch.message}`)

  const resolutions = []
  for (const a of archives) {
    // ⚠ Une archive SANS date de séance ne peut pas dater une entrée de
    // chronologie, et `date_evenement` est `not null`. On la saute en le disant.
    if (!a.date_ag) continue
    for (const r of a.resolutions || []) resolutions.push({ ...r, archive: a })
  }
  W(`${resolutions.length} résolution(s) lisibles dans ${archives.length} archive(s).`)
  W('')

  // ---------------------------------------------------------- les sujets
  const { data: sujets, error: eSuj } = await supabase.from('sujets').select('id, titre, categorie, contenu')
  if (eSuj) throw new Error(`Lecture des sujets : ${eSuj.message}`)
  const parTitre = new Map(sujets.map((x) => [x.titre, x]))

  let nouveau = parTitre.get(SUJET_NOUVEAU.titre)
  if (!nouveau) {
    W(`## Sujet à créer : « ${SUJET_NOUVEAU.titre} » (${SUJET_NOUVEAU.categorie})`)
    W('')
    W('> ' + SUJET_NOUVEAU.contenu.split('\n').join('\n> '))
    W('')
    if (GO) {
      const { data, error } = await supabase.from('sujets')
        .insert({ ...SUJET_NOUVEAU, created_by: auteur.id }).select().single()
      if (error) throw new Error(`Création du sujet : ${error.message}`)
      nouveau = data
      parTitre.set(nouveau.titre, nouveau)
      W(`✅ Sujet créé.`)
      W('')
    }
  }

  const { data: existantes, error: eEnt } = await supabase
    .from('sujet_entrees').select('sujet_id, date_evenement, titre')
  if (eEnt) throw new Error(`Lecture des entrées : ${eEnt.message}`)

  // ---------------------------------------------------- ce qui entrerait
  const aInserer = []
  const soucis = []
  W('| Sujet | Déjà en mémoire | À ajouter | Période ajoutée |')
  W('|---|---|---|---|')

  for (const [titre, motifs] of Object.entries(RATTACHEMENTS)) {
    const sujet = parTitre.get(titre)
    if (!sujet) {
      // Le sujet neuf n'existe pas encore en essai à blanc : on compte quand même.
      if (titre !== SUJET_NOUVEAU.titre) {
        soucis.push(`Sujet « ${titre} » introuvable : aucune entrée n’a été préparée pour lui.`)
        continue
      }
    }
    const dejaLa = existantes.filter((e) => sujet && e.sujet_id === sujet.id)
    const clesLa = new Set(dejaLa.map((e) => `${e.date_evenement}|${cleIntitule(e.titre)}`))

    const retenues = resolutions.filter((r) => motifs.some((m) => contient(r.objet, m)))
    const neuves = []
    for (const r of retenues) {
      const cle = `${r.archive.date_ag}|${cleIntitule(r.objet)}`
      if (clesLa.has(cle)) continue
      clesLa.add(cle)
      neuves.push(r)
      aInserer.push({
        sujet_id: sujet?.id || null,
        sujetTitre: titre,
        date_evenement: r.archive.date_ag,
        titre: r.objet,
        contenu: contenuEntree(r, r.archive),
        resultat: r.resultat,
        auteur_id: auteur.id,
      })
    }

    // ⚠ Les entrées MANUELLES de même date sont signalées, jamais touchées : on
    // ne peut pas deviner si elles disent la même chose, et effacer le travail
    // de quelqu'un sur une ressemblance serait pire qu'un doublon qu'un humain voit.
    const datesNeuves = new Set(neuves.map((r) => r.archive.date_ag))
    const voisines = dejaLa.filter((e) => datesNeuves.has(e.date_evenement))
    if (voisines.length) {
      soucis.push(`${titre} — ${voisines.length} entrée(s) déjà saisie(s) portent une date désormais couverte par les archives : ${voisines.map((e) => `${e.date_evenement} « ${e.titre.slice(0, 50)} »`).join(' ; ')}. Rien n’a été modifié.`)
    }

    const an = neuves.map((r) => r.archive.annee)
    W(`| ${titre} | ${dejaLa.length} | ${neuves.length} | ${an.length ? `${Math.min(...an)} → ${Math.max(...an)}` : '—'} |`)
  }
  W('')

  // Le détail, sujet par sujet : c'est lui qu'on relit avant d'écrire.
  for (const titre of Object.keys(RATTACHEMENTS)) {
    // ⚠ TRIÉ PAR DATE D'ÉVÉNEMENT, pas par ordre de lecture du fonds : celui-ci
    // suit l'ANNÉE D'EXERCICE, si bien que la séance du 19/01/2026 (exercice
    // 2025) sort avant celle du 19/06/2025. Un rapport qu'on relit ligne à ligne
    // avant d'écrire cent dix entrées doit se lire dans l'ordre du temps.
    const lignes = aInserer.filter((x) => x.sujetTitre === titre)
      .sort((a, b) => a.date_evenement.localeCompare(b.date_evenement))
    if (!lignes.length) continue
    W(`### ${titre} — ${lignes.length} entrée(s)`)
    W('')
    for (const l of lignes) {
      W(`- **${l.date_evenement}** — ${l.titre} *(${l.resultat})*`)
    }
    W('')
  }

  if (soucis.length) {
    W('## ⚠ À regarder')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  W(`**${aInserer.length} entrée(s) à créer.**`)
  W('')

  if (GO && aInserer.length) {
    const lignes = aInserer
      .filter((x) => x.sujet_id)
      .map(({ sujetTitre: _t, resultat: _r, ...reste }) => reste)
    if (lignes.length !== aInserer.length) {
      throw new Error('Une entrée n’a pas de sujet : rien n’a été écrit.')
    }
    // Par paquets : un insert de cent lignes passe, mais un échec au milieu
    // laisserait une chronologie à moitié remplie sans qu'on sache où.
    for (let i = 0; i < lignes.length; i += 25) {
      const { error } = await supabase.from('sujet_entrees').insert(lignes.slice(i, i + 25))
      if (error) throw new Error(`Écriture (paquet ${1 + i / 25}) : ${error.message}`)
    }
    W(`✅ ${lignes.length} entrée(s) créée(s).`)
    W('')
  } else if (!aInserer.length) {
    W('Rien à écrire — la mémoire est déjà à jour.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `memoire_depuis_pv_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
