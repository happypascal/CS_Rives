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
  .from('proprietaires').select('id,lot_id,nom,est_societe,dirigeant_nom,dirigeant_nom_2')
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

const societes = titulaires.map((t) => {
  const p = periodeDe.get(t.proprietaire_id)
  // Les personnes que NOUS rattachons à cette société : ses représentants
  // légaux (068) et les dirigeants hérités de la 042.
  const nôtres = [
    ...(tousTitulaires || [])
      .filter((x) => x.proprietaire_id === t.proprietaire_id && x.role === 'representant_legal')
      .map((x) => `${x.prenom || ''} ${x.nom}`.trim()),
    p?.dirigeant_nom || '',
    p?.dirigeant_nom_2 || '',
  ].filter(Boolean)
  return {
    titulaire_id: t.id,
    nom_titulaire: t.nom,
    nom_periode: p?.nom || '',
    parcelle: p ? lotDe.get(p.lot_id) || '' : '',
    dirigeantsConnus: [...new Set(nôtres)],
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

async function chercher(q) {
  const u = `${API}?q=${encodeURIComponent(q)}&per_page=10`
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
    const [sans, avec] = [await chercher(noyau), await chercher(`SCI ${noyau}`)]
    const parSiren = new Map()
    for (const r of [...sans, ...avec]) if (!parSiren.has(r.siren)) parSiren.set(r.siren, r)
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
  const patronymes = new Set(
    s.dirigeantsConnus.flatMap((n) => normaliser(n).split(' ')).filter((m) => m.length > 2),
  )
  const parDirigeant = exacts.filter((t) =>
    t.dirigeants.some((d) => normaliser(d).split(' ').some((m) => patronymes.has(m))))

  // ⚠ LE SIÈGE NE DÉPARTAGE QU'EN DERNIER, et seulement s'il est à NERNIER —
  // c'est-à-dire dans le lotissement lui-même. Ailleurs il ne prouve rien :
  // celui de Kitka est à La Réunion, celui de Violette à Toulouse, parce que
  // c'est le domicile du gérant. Une correspondance obtenue ainsi est marquée
  // comme telle dans le rapport : elle est probable, pas établie.
  const aNernier = exacts.filter((t) => t.cp === '74140' && /NERNIER/i.test(t.commune))

  const retenu = parDirigeant.length === 1 ? parDirigeant
    : exacts.length === 1 ? exacts
      : aNernier.length === 1 ? aNernier
        : []

  lignes.push({
    ...s,
    candidats: trouves.slice(0, 6),
    exacts: retenu,
    preuve: parDirigeant.length === 1 ? 'dirigeant'
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

await mkdir(join(RACINE, 'export'), { recursive: true })
const chemin = join(RACINE, 'export', `denominations_sci_${jour}.md`)
await writeFile(chemin, out.join('\n'), 'utf8')

console.log(`${societes.length} société(s) au registre`)
console.log(`  ${lignes.length - aVerifier.length} correspondance(s) certaine(s)`)
console.log(`  ${divergentes.length} divergence(s) de dénomination`)
console.log(`  ${aVerifier.length} à vérifier à la main`)
console.log(`  → ${chemin.replace(RACINE + '/', '')}`)
