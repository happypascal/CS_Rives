#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LES DÉNOMINATIONS DES SOCIÉTÉS, CONFRONTÉES AU REGISTRE OFFICIEL
//
// Pascal, 31 octobre 2026 : « Les noms des SCI ne sont pas justes. Il n'y a
// jamais SCI alors que la plupart se nomment SCI Kitka dans les recherches
// internet. »
//
// ⚠ LE DÉPÔT AFFIRME L'INVERSE, et c'est pour cela que ce script existe.
// Le CLAUDE.md porte, daté du 28 août 2026 :
//
//   « six des douze SCI ne portent pas "SCI" dans leur nom (Logudoro, Le
//     Clapotis, Entre Lac et Montagnes, Kitka, Maison du Lac, Precettes) —
//     nous l'avions ajouté à l'import »
//
// Deux récits contradictoires sur un registre légal ne se tranchent pas de
// mémoire, ni par une recherche d'opinion. On interroge la SOURCE : l'API
// publique `recherche-entreprises.api.gouv.fr`, adossée aux données INSEE et
// au Registre National des Entreprises.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ POURQUOI LES DEUX PEUVENT ÊTRE VRAIS EN MÊME TEMPS
// ──────────────────────────────────────────────────────────────────────────────
// Une société a une DÉNOMINATION (« KITKA ») et une FORME JURIDIQUE (société
// civile immobilière). Les annuaires du web — societe.com, pappers, infogreffe
// — affichent couramment « SCI KITKA » en PRÉFIXANT la forme à la dénomination,
// alors que le sigle ne fait pas partie du nom déclaré. C'est exactement ce
// qu'une recherche internet montre, et ce n'est pas une faute de leur part :
// c'est un affichage.
//
// Mais l'inverse existe aussi : beaucoup de sociétés déclarent réellement
// « SCI DUPONT » comme dénomination. Alors le sigle EST le nom.
//
// ⚠ ON NE PEUT DONC PAS TRANCHER PAR UNE RÈGLE. Il faut regarder, société par
// société, ce que porte le champ `nom_complet` du registre officiel.
//
// ──────────────────────────────────────────────────────────────────────────────
// CE QUE CE SCRIPT FAIT, ET CE QU'IL NE FAIT PAS
// ──────────────────────────────────────────────────────────────────────────────
// Il LIT et il RAPPORTE. Il n'écrit rien, ni en base ni ailleurs — la
// correction, s'il y en a une, sera un second script avec son essai à blanc et
// sa sauvegarde, comme tous les autres du dépôt.
//
// ⚠ IL N'ENVOIE AUCUNE DONNÉE PERSONNELLE À L'EXTÉRIEUR. Seules les
// DÉNOMINATIONS SOCIALES partent vers l'API — elles sont publiques par
// construction, c'est l'objet même du registre du commerce. Aucun nom de
// personne physique, aucune adresse de coloti, aucune adresse électronique.
//
// ⚠ ET IL NE DEVINE PAS. Quand la recherche ne rend rien, ou rend plusieurs
// sociétés sans qu'on puisse choisir, il l'écrit « à vérifier à la main »
// plutôt que de retenir le premier résultat. Le 28 août, c'est précisément une
// correspondance prise pour acquise qui avait fait attribuer à deux SCI un
// dirigeant qui n'était pas le leur.
//
// Usage : node scripts/verifier_denominations_sci_2026-10-31.mjs
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = 'https://recherche-entreprises.api.gouv.fr/search'

async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // ⚠ Les caractères invisibles sont écrits en SÉQUENCES d échappement :
      // posés en clair, U+2028 et U+2029 sont des terminateurs de ligne pour
      // JavaScript et coupent le littéral de regex en deux.
      const propre = ligne.replace(/[\u2028\u2029\uFEFF\u00A0\u200B]/g, '').trim()
      if (!propre || propre.startsWith('#')) continue
      const i = propre.indexOf('=')
      if (i < 1) continue
      out[propre.slice(0, i).trim()] = propre.slice(i + 1).trim().replace(/^["']|["']$/g, '')
    }
    return out
  } catch {
    return {}
  }
}

const env = await lireEnvFichier()
const url = (process.env.SUPABASE_URL || env.SUPABASE_URL || '').trim()
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
if (!url || !key) {
  console.error('❌ Clé Supabase introuvable — voir .env.export à la racine du projet.')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

// ── Ce que le registre porte ────────────────────────────────────────────────
// Deux sources dans notre propre base, et elles peuvent diverger : le TITULAIRE
// personne morale (068) et le LIBELLÉ de la période (`proprietaires.nom`).
// Les afficher toutes les deux est le seul moyen de voir laquelle corriger.
const { data: titulaires, error: e1 } = await supabase
  .from('titulaires').select('id,nom,role,proprietaire_id,est_personne_morale')
  .eq('est_personne_morale', true).is('date_fin', null)
if (e1) { console.error(`❌ Lecture de \`titulaires\` : ${e1.message}`); process.exit(1) }

// ⚠ ON LIT AUSSI LES DIRIGEANTS QUE NOUS CONNAISSONS, et c'est ce qui permet
// de trancher. Deux sources : les colonnes de la 042 (`dirigeant_nom`), qui
// restent en base bien qu'elles aient quitté l'écran, et les titulaires de
// rôle `representant_legal` (068). Sans ce recoupement, huit sociétés sur
// quatorze restent ambiguës — « VIOLETTE » rend cinq sociétés en France.
const { data: periodes, error: e2 } = await supabase
  .from('proprietaires')
  .select('id,lot_id,nom,est_societe,dirigeant_nom,dirigeant_nom_2,dirigeant_fonction,dirigeant_fonction_2')
  .is('date_cession', null)
if (e2) { console.error(`❌ Lecture de \`proprietaires\` : ${e2.message}`); process.exit(1) }

const { data: lots, error: e3 } = await supabase.from('lots').select('id,numero')
if (e3) { console.error(`❌ Lecture de \`lots\` : ${e3.message}`); process.exit(1) }

const lotDe = new Map(lots.map((l) => [l.id, l.numero]))
const periodeDe = new Map(periodes.map((p) => [p.id, p]))

// ⚠ ON PART DES TITULAIRES, PAS DE `est_societe`. Depuis le 31 octobre cette
// colonne est DÉRIVÉE des titulaires : s'en servir pour trouver les sociétés,
// ce serait vérifier une donnée avec ce qui l'a produite.
const { data: tousTitulaires } = await supabase
  .from('titulaires').select('nom,prenom,role,proprietaire_id').is('date_fin', null)

// ⚠ APPARIEMENTS TRANCHÉS À LA MAIN, parce que la recherche ne les trouve pas.
// Ce n'est PAS coder un résultat dans le vérificateur : c'est enregistrer un
// arbitrage humain, daté et motivé, exactement comme les exceptions nommées de
// `corriger_pv_archives.mjs`. Sans cela, la société concernée resterait
// éternellement « à vérifier » et ses dirigeants ne seraient jamais contrôlés.
const APPARIEMENTS_ARBITRES = {
  '0B 216': {
    siren: '448709139',
    motif: 'Identifiée par Pascal le 31 octobre 2026 : 7 avenue Alsace-Lorraine, '
      + '74100 Annemasse. Introuvable par recherche — « SCI MARGUERITE » rend '
      + 'plus de dix mille résultats et celle-ci n’est dans aucune des '
      + 'premières pages.',
  },
}

const societes = titulaires.map((t) => {
  const p = periodeDe.get(t.proprietaire_id)
  // Les personnes que NOUS rattachons à cette société. Deux sources, et elles
  // ne se valent pas : les titulaires `representant_legal` (068) portent nom
  // et prénom séparés, les colonnes de la 042 un texte libre.
  const representants = (tousTitulaires || [])
    .filter((x) => x.proprietaire_id === t.proprietaire_id && x.role === 'representant_legal')
  const nôtres = [
    ...representants.map((x) => `${x.prenom || ''} ${x.nom}`.trim()),
    p?.dirigeant_nom || '',
    p?.dirigeant_nom_2 || '',
  ].filter(Boolean)
  return {
    titulaire_id: t.id,
    nom_titulaire: t.nom,
    nom_periode: p?.nom || '',
    parcelle: p ? lotDe.get(p.lot_id) || '' : '',
    dirigeantsConnus: [...new Set(nôtres)],
    // Les PATRONYMES que nous portons, pour la comparaison des dirigeants.
    // ⚠ Pris sur le champ `nom` du titulaire, jamais sur la chaîne entière :
    // comparer « Catherine » à « Catherine » apparierait deux sociétés sans
    // rapport, ce qui est précisément arrivé sur 0B 216.
    patronymesConnus: representants.map((x) => x.nom).filter(Boolean),
    // Nom ET prénom séparés, pour pouvoir détecter l'INVERSION des deux.
    representants: representants.map((x) => ({ nom: x.nom || '', prenom: x.prenom || '' })),
    fonctionsConnues: [p?.dirigeant_fonction, p?.dirigeant_fonction_2].filter(Boolean),
  }
}).sort((a, b) => a.nom_titulaire.localeCompare(b.nom_titulaire, 'fr'))

if (!societes.length) {
  console.log('Aucun titulaire personne morale au registre.')
  process.exit(0)
}

// ── Ce que le registre OFFICIEL porte ───────────────────────────────────────
// ⚠ La dénomination est interrogée SANS le sigle et AVEC, parce que c'est
// justement la question posée : si « SCI KITKA » rend une société et « KITKA »
// une autre, ce n'est pas la même entreprise et il faut le voir.
const sansSigle = (n) => n.replace(/^\s*(SCI|SARL|SAS|SASU|SCCV|SNC)\s+/i, '').trim()

// Les catégories juridiques de l'INSEE qu'on peut rencontrer ici. ⚠ `1000`
// est une PERSONNE PHYSIQUE (entrepreneur individuel) : une recherche sur
// « Kitka » en rend trois, et deux sont des artisans qui portent ce patronyme.
// Sans ce filtre, le script retiendrait un menuisier de Villejuif comme
// propriétaire d'une parcelle à Nernier.
const NATURES = {
  1000: 'personne physique (entrepreneur individuel)',
  5499: 'SARL',
  5710: 'SAS',
  5720: 'SASU',
  6540: 'société civile immobilière',
  6599: 'autre société civile',
}
const estUneSociete = (n) => String(n || '').startsWith('6') || String(n || '').startsWith('5')

async function chercher(q, { departement } = {}) {
  const u = `${API}?q=${encodeURIComponent(q)}&per_page=25`
    + (departement ? `&departement=${departement}` : '')
  const r = await fetch(u, { headers: { accept: 'application/json' } })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  const d = await r.json()
  return (d.results || []).map((x) => ({
    nom: x.nom_complet || x.nom_raison_sociale || '',
    siren: x.siren,
    nature: x.nature_juridique,
    natureLibelle: NATURES[x.nature_juridique] || `catégorie ${x.nature_juridique}`,
    cp: x.siege?.code_postal || '',
    commune: x.siege?.libelle_commune || '',
    etat: x.etat_administratif,
    creation: x.date_creation || '',
    // ⚠ LES DIRIGEANTS SONT LE SEUL RECOUPEMENT INDÉPENDANT dont on dispose.
    // Le siège ne prouve rien — celui de Kitka est à La Réunion, celui de
    // Violette à Toulouse : c'est le domicile du gérant, pas le lot. Sans les
    // dirigeants, une homonymie passerait pour une correspondance.
    dirigeants: (x.dirigeants || [])
      .filter((p) => p.type_dirigeant === 'personne physique')
      .map((p) => `${(p.prenoms || '').split(' ')[0]} ${p.nom}`.trim()),
    // ⚠ LES PATRONYMES SÉPARÉMENT, et c'est ce qui fait la validité du
    // recoupement. Comparer la chaîne entière revient à comparer aussi les
    // PRÉNOMS : le script a retenu pour 0B 216 une « MARGUERITE » dont la
    // gérante est Catherine CHAVANNE, au seul motif que notre représentante
    // légale s'appelle Catherine DELUCINGE. Un prénom commun ne prouve
    // strictement rien — un patronyme, si.
    patronymes: (x.dirigeants || [])
      .filter((p) => p.type_dirigeant === 'personne physique')
      .flatMap((p) => String(p.nom || '').split(/[\s()]+/))
      .filter(Boolean),
    // ⚠ LA QUALITÉ DISTINGUE LE GÉRANT DE L'ASSOCIÉ, et la distinction n'est
    // pas formelle : dans une SCI, c'est le GÉRANT qui représente la société
    // et qui engage donc son vote et sa signature en assemblée. Un « associé
    // indéfiniment responsable » est tenu des dettes, il ne représente rien.
    // Les confondre ferait convoquer la mauvaise personne — et c'est la faute
    // que la 042 a corrigée en séparant la CATÉGORIE de la FONCTION.
    personnes: (x.dirigeants || [])
      .filter((p) => p.type_dirigeant === 'personne physique')
      .map((p) => ({
        patronyme: String(p.nom || '').split(/[\s()]+/)[0] || '',
        patronymeComplet: String(p.nom || ''),
        prenom: (p.prenoms || '').split(' ')[0] || '',
        affiche: `${(p.prenoms || '').split(' ')[0]} ${p.nom}`.trim(),
        qualite: p.qualite || '',
        gerant: /g[ée]rant|pr[ée]sident/i.test(p.qualite || ''),
      })),
  }))
}

// ⚠ DEUX CONDITIONS POUR UNE CORRESPONDANCE, PAS UNE. Le premier jet n'en
// posait qu'une — la dénomination au mot près, sigle mis à part — et il a
// annoncé « 14 correspondances certaines, 0 à vérifier » en ayant retenu des
// homonymes possibles. C'est la faute du 28 août, celle qui avait attribué à
// deux SCI un dirigeant qui n'était pas le leur.
//
// La seconde condition est la NATURE JURIDIQUE : une parcelle ne se détient
// pas par un entrepreneur individuel homonyme. Et le rapport rend désormais
// les DIRIGEANTS, seul recoupement indépendant disponible — le siège ne
// prouve rien, celui de Kitka est à La Réunion.
const normaliser = (s) => (s || '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

const lignes = []
for (const s of societes) {
  const noyau = sansSigle(s.nom_titulaire)
  let trouves = []
  try {
    // ⚠ ON INTERROGE LES DEUX FORMES, et ce n'est pas une précaution de
    // confort. Pascal, 31 octobre : « maison du lac n'a pas SCI mais SCI
    // Ravoire oui ». Le premier jet ne cherchait que le noyau : « RAVOIRE »
    // rend dix sociétés triées par pertinence, et « SCI RAVOIRE » — celle de
    // Nernier, dirigeants Lüscher et Schwitzgebel — n'y figurait pas. Le
    // script concluait « à vérifier » sur une société parfaitement trouvable.
    // Les deux listes sont fusionnées et dédoublonnées par SIREN.
    // ⚠ ET UNE TROISIÈME PASSE, RESTREINTE À LA HAUTE-SAVOIE. « SCI MARGUERITE »
    // rend plus de DIX MILLE résultats, triés par pertinence : celle du
    // lotissement — 7 avenue Alsace-Lorraine à Annemasse, dirigeantes Baud et
    // Delucinge — n'était dans aucune des deux premières pages. Le script a
    // conclu « à vérifier à la main » sur une société parfaitement trouvable,
    // et c'est Pascal qui l'a identifiée.
    //
    // ⚠ Le département ne RESTREINT pas la recherche, il l'ÉLARGIT : les trois
    // passes sont fusionnées. Filtrer sur le 74 seul écarterait Kitka (siège à
    // La Réunion) et Violette (Toulouse) — le siège d'une SCI est souvent le
    // domicile de son gérant, pas le lot.
    const [sans, avec, local] = [
      await chercher(noyau),
      await chercher(`SCI ${noyau}`),
      await chercher(noyau, { departement: '74' }),
    ]
    const parSiren = new Map()
    for (const r of [...sans, ...avec, ...local]) if (!parSiren.has(r.siren)) parSiren.set(r.siren, r)
    trouves = [...parSiren.values()]
    // Pause courte : l'API publique est limitée en débit, et une rafale de
    // requêtes se fait refuser silencieusement.
    await new Promise((r) => setTimeout(r, 400))
  } catch (e) {
    lignes.push({ ...s, verdict: `recherche impossible (${e.message})`, candidats: [] })
    continue
  }
  const cible = normaliser(noyau)
  const exacts = trouves.filter((t) => {
    const n = normaliser(t.nom)
    const memeNom = n === cible || n === `SCI ${cible}` || n === `${cible} SCI`
    return memeNom && estUneSociete(t.nature)
  })

  // ⚠ LE DÉPARTAGE SE FAIT SUR LES DIRIGEANTS, jamais sur le siège. Quand
  // plusieurs sociétés portent le même nom — « VIOLETTE » en rend cinq — on
  // retient celle dont un dirigeant porte un patronyme que NOTRE registre
  // rattache déjà à ce lot. C'est le seul recoupement indépendant disponible :
  // il vient de notre base d'un côté, du RNE de l'autre.
  // ⚠ LA COMPARAISON PORTE SUR LE PATRONYME DÉCLARÉ AU RNE, pas sur la chaîne
  // « prénom nom ». Côté nous on garde tous les mots — le format des colonnes
  // de 042 est libre (« Delucinge Catherine ») — mais côté RNE on ne compare
  // qu'au nom de famille. Sans cela, « Catherine » suffisait à apparier deux
  // sociétés sans rapport.
  const nôtres = new Set(
    s.dirigeantsConnus.flatMap((n) => normaliser(n).split(' ')).filter((m) => m.length > 2),
  )
  const parDirigeant = exacts.filter((t) =>
    t.patronymes.some((p) => nôtres.has(normaliser(p))))

  // ⚠ LE SIÈGE NE DÉPARTAGE QU'EN DERNIER, et seulement s'il est à NERNIER —
  // c'est-à-dire dans le lotissement lui-même. Ailleurs il ne prouve rien :
  // celui de Kitka est à La Réunion, celui de Violette à Toulouse, parce que
  // c'est le domicile du gérant. Une correspondance obtenue ainsi est marquée
  // comme telle dans le rapport : elle est probable, pas établie.
  const aNernier = exacts.filter((t) => t.cp === '74140' && /NERNIER/i.test(t.commune))

  // ⚠ DEUX CANDIDATES PEUVENT CORRESPONDRE PAR DIRIGEANT — une société
  // radiée et celle qui l'a remplacée, par exemple. Le siège les départage
  // alors, et l'étiquette doit dire que les dirigeants concordent AUSSI :
  // « siège à Nernier (à confirmer) » tout court laissait croire qu'on avait
  // choisi sur la seule adresse, ce qui aurait été bien plus faible.
  const dirigeantEtNernier = parDirigeant.filter((t) => aNernier.includes(t))

  // ⚠ L'ARBITRAGE HUMAIN PASSE AVANT TOUT LE RESTE. Quand un SIREN a été
  // tranché à la main, on va le chercher par son identifiant — pas par son
  // nom, qui est justement ce qui n'a pas marché.
  const arbitre = APPARIEMENTS_ARBITRES[s.parcelle]
  if (arbitre) {
    let parSiren = trouves.find((t) => t.siren === arbitre.siren)
    if (!parSiren) {
      try {
        parSiren = (await chercher(arbitre.siren)).find((t) => t.siren === arbitre.siren)
        await new Promise((r) => setTimeout(r, 400))
      } catch { /* on retombe sur le traitement ordinaire */ }
    }
    if (parSiren) {
      lignes.push({ ...s, candidats: trouves.slice(0, 6), exacts: [parSiren], preuve: 'arbitré à la main', arbitre })
      continue
    }
  }

  const retenu = parDirigeant.length === 1 ? parDirigeant
    : dirigeantEtNernier.length === 1 ? dirigeantEtNernier
      : exacts.length === 1 ? exacts
        : aNernier.length === 1 ? aNernier
          : []

  lignes.push({
    ...s,
    candidats: trouves.slice(0, 6),
    exacts: retenu,
    preuve: parDirigeant.length === 1 ? 'dirigeant'
      : dirigeantEtNernier.length === 1 ? 'dirigeant + siège à Nernier'
        : exacts.length === 1 ? 'seule société de ce nom'
          : aNernier.length === 1 ? 'siège à Nernier (à confirmer)'
            : null,
    homonymes: exacts.length > 1 ? exacts.length : 0,
  })
}

// ── Le rapport ──────────────────────────────────────────────────────────────
const jour = new Date().toISOString().slice(0, 10)
const out = []
out.push(`# Les dénominations des sociétés, confrontées au registre officiel`)
out.push('')
out.push(`Relevé du ${jour}. Source : \`recherche-entreprises.api.gouv.fr\` (INSEE / RNE).`)
out.push('')
out.push('> ⚠ Ce document ne corrige rien. Il montre, société par société, ce que')
out.push('> notre registre porte et ce que le registre officiel déclare.')
out.push('>')
out.push('> ⚠ Une recherche internet affiche souvent « SCI X » en PRÉFIXANT la forme')
out.push('> juridique à la dénomination. Ce n’est pas forcément le nom déclaré.')
out.push('> La colonne « déclaré au RNE » est la seule qui fasse foi.')
out.push('')
out.push('| Parcelle | Chez nous | Déclaré au RNE | Reconnue par | Dirigeants au RNE | SIREN |')
out.push('|---|---|---|---|---|---|')
for (const l of lignes) {
  const e = (l.exacts || [])[0]
  // ⚠ Le libellé de la période n'est montré que s'il DIFFÈRE du titulaire :
  // une colonne qui répète la précédente sur treize lignes sur quatorze cache
  // la seule qui diverge.
  const chezNous = l.nom_periode && l.nom_periode !== l.nom_titulaire
    ? `${l.nom_titulaire}<br>_période : ${l.nom_periode}_`
    : l.nom_titulaire
  const declare = e ? `**${e.nom}**` : (l.verdict ? `_${l.verdict}_` : '_à vérifier_')
  out.push(`| ${l.parcelle} | ${chezNous} | ${declare} | ${e ? l.preuve : ''} `
    + `| ${e ? e.dirigeants.join(', ') : ''} | ${e ? e.siren : ''} |`)
}
out.push('')
out.push('> ⚠ Le SIÈGE ne figure pas dans ce tableau et c’est voulu : il ne prouve')
out.push('> rien. Celui de Kitka est à La Réunion, celui de Violette à Toulouse —')
out.push('> c’est le domicile du gérant, pas le lot. Ce sont les DIRIGEANTS qui')
out.push('> permettent de reconnaître la société du lotissement.')
out.push('')

// ── La question posée : le sigle fait-il partie du nom ? ────────────────────
const avecSigleChezNous = lignes.filter((l) => /^\s*SCI\b/i.test(l.nom_titulaire))
const avecSigleAuRNE = lignes.filter((l) => (l.exacts || [])[0] && /^\s*SCI\b/i.test(l.exacts[0].nom))
out.push('## Le sigle « SCI » fait-il partie de la dénomination ?')
out.push('')
out.push(`- **${avecSigleAuRNE.length} sur ${lignes.length}** le portent dans leur dénomination DÉCLARÉE.`)
out.push(`- **${avecSigleChezNous.length} sur ${lignes.length}** le portent dans notre registre.`)
out.push('')
out.push('⚠ Une société a une **dénomination** et une **forme juridique**, et les')
out.push('annuaires du web affichent couramment la seconde devant la première —')
out.push('« SCI KITKA » pour une société qui s’appelle « KITKA ». Le sigle y est un')
out.push('AFFICHAGE, pas le nom. C’est pourquoi une recherche internet donne')
out.push('l’impression que toutes s’appellent « SCI quelque chose ».')
out.push('')

const aVerifier = lignes.filter((l) => !(l.exacts || []).length)
if (aVerifier.length) {
  out.push('## À vérifier à la main')
  out.push('')
  out.push('Aucune correspondance certaine : le siège d’une société n’est pas')
  out.push('forcément à Nernier, et une dénomination peut avoir changé. Les')
  out.push('candidats trouvés sont listés tels quels, sans en retenir aucun.')
  out.push('')
  for (const l of aVerifier) {
    out.push(`### ${l.nom_titulaire} — parcelle ${l.parcelle}`)
    if (!l.candidats.length) {
      out.push('')
      out.push('Aucun candidat.')
    } else {
      out.push('')
      for (const c of l.candidats) {
        out.push(`- ${c.nom} · SIREN ${c.siren} · ${c.cp} ${c.commune} · ${c.nature || 'nature inconnue'} · ${c.etat || ''}`)
      }
    }
    out.push('')
  }
}

const divergentes = lignes.filter((l) => {
  const e = (l.exacts || [])[0]
  return e && normaliser(e.nom) !== normaliser(l.nom_titulaire)
})
out.push('## Ce qui diverge de notre registre')
out.push('')
if (!divergentes.length) {
  out.push('Aucune divergence sur les correspondances certaines.')
} else {
  for (const l of divergentes) {
    out.push(`- **${l.parcelle}** — nous : « ${l.nom_titulaire} » · RNE : « ${l.exacts[0].nom} »`)
  }
}
out.push('')

// ── LES DIRIGEANTS ──────────────────────────────────────────────────────────
// Demande de Pascal, 31 octobre : « vérifie aussi les dirigeants dans le
// registre ». Le 28 août, trois sur douze étaient faux — le gérant de Logudoro
// était Marc Pais et non Laurent, celui de Kitka Nicolas Kah et non Isabelle
// Kittler, et l'associée de Precettes avait été prise pour une mandataire.
//
// ⚠ TROIS ÉCARTS DE NATURES DIFFÉRENTES, et les confondre rendrait la liste
// illisible :
//   - chez nous mais plus au RNE  → a pu céder ses parts ou démissionner ;
//   - au RNE mais pas chez nous   → manque au registre, s'il est GÉRANT ;
//   - associé non gérant           → n'est PAS une anomalie : il n'a pas à
//     figurer comme représentant, il ne représente rien.
// ⚠ LA COMPARAISON SE FAIT PAR MOTS, PAS PAR CHAÎNES ÉGALES. Les noms
// composés et les noms d'usage l'imposent : notre registre porte « Valérie
// Schwitzgebel Lüscher » là où le RNE déclare le patronyme « SCHWITZGEBEL »
// et le nom d'usage « SCHWITZGEBEL LÜSCHER ». Une égalité stricte signalait
// un écart sur une saisie parfaitement juste.
const mots = (s) => new Set(normaliser(s).split(' ').filter((m) => m.length > 2))
const seRecoupent = (a, b) => [...mots(a)].some((m) => mots(b).has(m))

const ecarts = []
for (const l of lignes) {
  const e = (l.exacts || [])[0]
  if (!e) continue
  const gerants = e.personnes.filter((p) => p.gerant)
  // ⚠ Si le RNE ne qualifie AUCUN dirigeant de gérant — cas des SCI où tous
  // sont « associé indéfiniment responsable » — on ne peut rien exiger : on
  // compare alors à l'ensemble, et le rapport le dit.
  const aComparer = gerants.length ? gerants : e.personnes
  const manquants = aComparer.filter((p) =>
    !l.representants.some((r) => seRecoupent(p.patronymeComplet, r.nom)))
  const enTrop = l.representants.filter((r) =>
    !e.personnes.some((p) => seRecoupent(p.patronymeComplet, r.nom))
    // ⚠ Une personne dont le prénom et le nom sont inversés n'est pas « en
    // trop » : elle est bien dirigeante, c'est sa saisie qui est fautive.
    // La compter deux fois ferait croire à deux problèmes distincts.
    && !e.personnes.some((p) => seRecoupent(r.prenom, p.patronymeComplet) && seRecoupent(r.nom, p.prenom)))

  // ⚠ PRÉNOM ET NOM INVERSÉS : l'erreur de saisie la plus difficile à voir,
  // parce que la fiche se lit sans heurt — « Mehdi Deena » n'a l'air faux
  // qu'à qui connaît la personne. On la détecte en croisant : notre PRÉNOM
  // correspond à leur PATRONYME, et notre NOM à leur prénom.
  const inverses = []
  for (const r of l.representants) {
    for (const p of e.personnes) {
      if (seRecoupent(r.prenom, p.patronymeComplet) && seRecoupent(r.nom, p.prenom)) {
        inverses.push({ nôtre: r, leur: p })
      }
    }
  }

  if (manquants.length || enTrop.length || inverses.length) {
    ecarts.push({ l, e, manquants, enTrop, inverses, sansGerantDeclare: !gerants.length })
  }
}

out.push('## Les dirigeants')
out.push('')
out.push('> ⚠ Dans une SCI, c’est le **gérant** qui représente la société, donc qui')
out.push('> vote et signe en assemblée. Un « associé indéfiniment responsable » est')
out.push('> tenu des dettes et ne représente rien : son absence de notre registre')
out.push('> n’est pas une anomalie, et l’y inscrire comme représentant en serait une.')
out.push('')
if (!ecarts.length) {
  out.push('Aucun écart : pour chaque société appariée, les gérants déclarés au RNE')
  out.push('sont ceux que porte le registre.')
} else {
  for (const x of ecarts) {
    out.push(`### ${x.l.nom_titulaire} — parcelle ${x.l.parcelle}`)
    out.push('')
    out.push(`- Chez nous : ${x.l.dirigeantsConnus.join(', ') || '_personne_'}`)
    out.push(`- Au RNE : ${x.e.personnes.map((p) => `${p.affiche} (${p.qualite || 'qualité non précisée'})`).join(' · ')}`)
    for (const i of x.inverses) {
      out.push(`- 🔴 **PRÉNOM ET NOM INVERSÉS** : nous portons prénom « ${i.nôtre.prenom} », nom « ${i.nôtre.nom} » ;`
        + ` le RNE déclare « ${i.leur.affiche} » (${i.leur.qualite || 'qualité non précisée'}).`)
    }
    if (x.manquants.length) {
      out.push(`- ⚠ **Absent(s) de notre registre** : ${x.manquants.map((p) => p.affiche).join(', ')}`)
    }
    if (x.enTrop.length) {
      out.push(`- ⚠ **Chez nous mais pas au RNE** : ${x.enTrop.map((r) => `${r.prenom} ${r.nom}`.trim()).join(', ')} — a pu céder ses parts ou démissionner, à vérifier sur pièce.`)
    }
    if (x.sansGerantDeclare) {
      out.push('- _Le RNE ne qualifie aucun de ces dirigeants de gérant : la comparaison porte sur l’ensemble._')
    }
    out.push('')
  }
}
out.push('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const chemin = join(RACINE, 'export', `denominations_sci_${jour}.md`)
await writeFile(chemin, out.join('\n'), 'utf8')

console.log(`${societes.length} société(s) au registre`)
console.log(`  ${lignes.length - aVerifier.length} correspondance(s) certaine(s)`)
console.log(`  ${divergentes.length} divergence(s) de dénomination`)
console.log(`  ${aVerifier.length} à vérifier à la main`)
console.log(`  → ${chemin.replace(RACINE + '/', '')}`)
