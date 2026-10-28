#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// METTRE DE L'ORDRE DANS CIVILITÉ / PRÉNOM / NOM (migration 068)
//
// Pascal, 28 octobre 2026 : « il y a maintenant civilité prénom et nom. Est-ce
// que tu peux faire de l'ordre et mettre ces valeurs au mieux depuis le champ
// nom ».
//
// La reprise du 22 octobre a versé la chaîne entière dans `nom` — « Berseth
// Gilbert », « Mme Junod », « Indivision Trosselli Corrine ». Les trois colonnes
// existent, elles sont vides.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ POURQUOI PAS UNE RÈGLE UNIQUE
// ──────────────────────────────────────────────────────────────────────────────
// Le registre écrit « NOM Prénom » dans son immense majorité (convention du
// syndic), MAIS TROIS LIGNES AU MOINS SONT INVERSÉES : « Sarah Clozel »,
// « Nayla Akel », « Tino Pais ». Appliquer « le premier mot est le patronyme »
// à toutes aurait rebaptisé ces personnes — et dans un registre légal, écrire
// Mme Sarah comme nom de famille n'est pas une imperfection, c'est une erreur
// d'état civil.
//
// On ne devine donc pas : on RECOUPE. Trois sources, toutes internes et
// vérifiables :
//
//   1. `membres_cs` porte déjà prénom et nom SÉPARÉS pour les cinq membres du
//      conseil. Quand une ligne leur correspond, le découpage est CERTAIN.
//   2. Les patronymes connus du registre lui-même : un mot qui apparaît en
//      PREMIÈRE position sur une autre ligne est un patronyme (« Pais » dans
//      « Pais Laurent », « Clozel » dans « Clozel Aurélien »). S'il apparaît en
//      DERNIÈRE position ailleurs, cette ligne-là est inversée.
//   3. Les prénoms déjà attestés dans le registre, formés de la même façon.
//
// Tout ce qui ne tombe dans aucun de ces trois cas est marqué À VÉRIFIER et
// présenté à part : c'est à un humain de trancher, pas à un script.
//
// ⚠ CE QUI N'EST JAMAIS DÉCOUPÉ
//   - les PERSONNES MORALES : « SCI Villa Aysha » n'a pas de prénom, et
//     « Maison du Lac » encore moins ;
//   - les noms d'un seul mot (« Delachaux », « Soliman ») ;
//   - « van den Berg/Gridello » : deux patronymes séparés par une barre, pas un
//     nom et un prénom ;
//   - le mandataire connu par son seul numéro de téléphone.
//
// ⚠ LA CIVILITÉ N'EST JAMAIS DÉDUITE D'UN PRÉNOM. On ne la pose que si elle est
// ÉCRITE dans la chaîne (« Mme Junod »). Déduire « Mme » de « Josette » serait
// attribuer un genre à quelqu'un sur la foi de son prénom, dans un registre qui
// sert à convoquer et à notifier.
//
// ⚠ « INDIVISION » EST RETIRÉ DU NOM. Le mot y avait été mis quand une ligne
// devait porter deux personnes ; le rôle `indivisaire` le dit maintenant, et
// « Indivision Trosselli Corrine » n'est le nom de personne.
//
// Usage :
//   node scripts/separer_noms_titulaires_2026-10-28.mjs        essai à blanc
//   node scripts/separer_noms_titulaires_2026-10-28.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
// ⚠ Les découpages DOUTEUX ne s'écrivent pas par défaut : un état civil faux
// dans un registre légal ne se rattrape pas en le relisant. Précédent des
// entrées `attente_pascal` du 5 octobre — on liste, on attend, et on écrit
// sur un drapeau explicite.
const AVEC_DOUTES = process.argv.includes('--avec-doutes')

const CIVILITES = [
  [/^(M\.?\s+et\s+Mme|M\.?\s*\/\s*Mme|M\.?\s+Mme)\s+/i, 'M. et Mme'],
  [/^(Mme|Madame)\.?\s+/i, 'Mme'],
  [/^(Mlle|Mademoiselle)\.?\s+/i, 'Mme'],
  [/^(M\.|Monsieur|Mr\.?)\s+/i, 'M.'],
]

// Particules : elles appartiennent au PATRONYME et ne s'en détachent jamais.
const PARTICULES = ['van', 'von', 'de', 'den', 'der', 'du', 'des', 'le', 'la', 'di', 'del', 'al']

async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
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

const { data: titulaires, error } = await supabase.from('titulaires').select('*')
if (error) { console.error(`❌ Lecture de \`titulaires\` : ${error.message}`); process.exit(1) }
const { data: membres } = await supabase.from('membres_cs').select('prenom,nom')
const { data: periodes } = await supabase.from('proprietaires').select('id,lot_id')
const { data: lots } = await supabase.from('lots').select('id,numero')
const numeroDe = (t) => {
  const p = (periodes || []).find((x) => x.id === t.proprietaire_id)
  return (lots || []).find((l) => l.id === p?.lot_id)?.numero || '?'
}

const sansAccents = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// ── Les deux dictionnaires, construits SUR LE REGISTRE LUI-MÊME ───────────────
// Un mot vu en PREMIÈRE position d'un nom à plusieurs mots est un patronyme ;
// vu en DERNIÈRE position, c'est un prénom. Un mot qui apparaît dans les deux
// rôles ne tranche rien — il sort des deux dictionnaires.
// ⚠ ON COMPTE, ET ON S'EXCLUT SOI-MÊME. Premier jet : deux ensembles, et un mot
// présent dans les deux était déclaré ambigu — si bien que « Pais », patronyme
// dans « Pais Laurent » et « Pais Marc », devenait indécidable À CAUSE de
// « Tino Pais », la ligne même qu'il fallait redresser. Le dictionnaire se
// nourrissait des erreurs qu'il devait détecter, et les trois inversions
// connues passaient toutes au travers.
const nbTete = new Map()
const nbQueue = new Map()
const compter = (m, mot) => m.set(mot, (m.get(mot) || 0) + 1)
for (const t of titulaires) {
  if (t.est_personne_morale) continue
  const mots = nettoyer(t.nom).split(/\s+/).filter(Boolean)
  if (mots.length < 2) continue
  compter(nbTete, sansAccents(mots[0]))
  compter(nbQueue, sansAccents(mots[mots.length - 1]))
}
const enTete = new Set(nbTete.keys())
const enQueue = new Set(nbQueue.keys())

// Les compteurs d'un mot, la ligne courante retirée : c'est ce qui permet de
// demander « les AUTRES lignes disent-elles que ce mot est un patronyme ? ».
function horsDeSoi(mots) {
  const tete = sansAccents(mots[0])
  const queue = sansAccents(mots[mots.length - 1])
  return (mot) => ({
    tete: (nbTete.get(mot) || 0) - (mot === tete ? 1 : 0),
    queue: (nbQueue.get(mot) || 0) - (mot === queue ? 1 : 0),
  })
}

// ⚠ L'ADRESSE ÉLECTRONIQUE EST UN INDICE, PAS UN ÉTAT CIVIL. « nayla.akel@ »
// dit l'ordre prénom.nom là où le registre ne porte rien — c'est le seul
// moyen de redresser « Nayla Akel », dont aucune autre ligne ne parle. On s'en
// sert donc, et le rapport le dit : une convention de messagerie n'est pas une
// pièce d'identité.
function ordreSelonEmail(email, mots) {
  const local = sansAccents((email || '').split('@')[0] || '')
  if (!local || mots.length !== 2) return null
  const [a, b] = mots.map(sansAccents)
  if (new RegExp(`^${a}[._-]${b}$`).test(local)) return 'prenom_nom'
  if (new RegExp(`^${b}[._-]${a}$`).test(local)) return 'nom_prenom'
  return null
}
// ⚠ `membres_cs` TRANCHE : ses cinq lignes portent prénom et nom séparés, donc
// elles disent avec certitude de quel côté sont ces mots-là.
const patronymesCertains = new Set((membres || []).map((m) => sansAccents(m.nom || '')).filter(Boolean))
const prenomsCertains = new Set((membres || []).map((m) => sansAccents(m.prenom || '')).filter(Boolean))
for (const m of patronymesCertains) enQueue.delete(m)
for (const p of prenomsCertains) enTete.delete(p)
const ambigus = new Set([...enTete].filter((x) => (nbQueue.get(x) || 0) >= (nbTete.get(x) || 0)))

function nettoyer(nom) {
  // « Indivision » n'est le nom de personne : le rôle le dit désormais.
  return (nom || '').replace(/^indivision\s+/i, '').trim()
}

function separer(t) {
  const brut = (t.nom || '').trim()
  const sortie = { civilite: null, prenom: null, nom: brut, confiance: null, pourquoi: '' }

  // ⚠⚠ UNE LIGNE DÉJÀ RENSEIGNÉE NE SE RETOUCHE PAS, et c'est la garde la plus
  // importante du script. Sans elle, une seconde exécution relisait `nom` —
  // désormais réduit au seul patronyme — n'y voyait plus qu'un mot, et
  // proposait de VIDER le prénom qu'elle venait d'écrire. Le script détruisait
  // son propre travail au deuxième passage, en silence et sans rien signaler.
  // Vaut aussi pour les corrections faites à la main : elles priment toujours.
  if (t.prenom || t.civilite) {
    // ⚠ On rend les valeurs ACTUELLES, pas des nulls : une proposition qui
    // diffère de la base, même pour dire « ne touche à rien », compte comme un
    // changement et ressort dans la liste à relire.
    return {
      civilite: t.civilite, prenom: t.prenom, nom: brut,
      confiance: 'intact', pourquoi: 'déjà renseigné, laissé tel quel',
    }
  }

  // Une personne morale n'a ni civilité ni prénom.
  if (t.est_personne_morale) {
    return { ...sortie, confiance: 'intact', pourquoi: 'personne morale' }
  }
  // Le mandataire connu par son seul numéro.
  if (/^[+\d][\d\s.()-]{6,}$/.test(brut)) {
    return { ...sortie, confiance: 'intact', pourquoi: 'numéro de téléphone, pas un nom' }
  }

  let reste = nettoyer(brut)
  const indivisionRetiree = reste !== brut.trim()

  for (const [motif, valeur] of CIVILITES) {
    if (motif.test(reste)) { sortie.civilite = valeur; reste = reste.replace(motif, '').trim(); break }
  }

  // Deux patronymes séparés par une barre : on ne découpe pas — mais si
  // « Indivision » a été retiré, la ligne CHANGE quand même, et doit donc être
  // écrite. ⚠ `intact` ne vaut que pour ce qui ne bouge pas du tout.
  if (reste.includes('/')) {
    return {
      ...sortie,
      nom: reste,
      confiance: indivisionRetiree ? 'sûr' : 'intact',
      pourquoi: indivisionRetiree
        ? 'mot « Indivision » retiré ; deux patronymes séparés par une barre, non découpés'
        : 'deux patronymes séparés par une barre',
    }
  }

  const mots = reste.split(/\s+/).filter(Boolean)
  if (mots.length <= 1) {
    return { ...sortie, nom: reste, confiance: sortie.civilite || indivisionRetiree ? 'sûr' : 'intact',
      pourquoi: sortie.civilite ? 'civilité détachée, patronyme seul' : indivisionRetiree ? 'mot « Indivision » retiré' : 'un seul mot' }
  }

  const premier = sansAccents(mots[0])
  const dernier = sansAccents(mots[mots.length - 1])
  const autres = horsDeSoi(mots)

  // ⚠ L'INVERSION, DÉTECTÉE ET NON SUPPOSÉE. Deux chemins, et aucun ne repose
  // sur l'allure d'un prénom : les AUTRES lignes du registre désignent le
  // dernier mot comme patronyme, ou l'adresse électronique donne l'ordre.
  const dernierEstPatronyme = patronymesCertains.has(dernier)
    || (autres(dernier).tete > 0 && autres(dernier).tete >= autres(dernier).queue)
  const premierEstPatronyme = patronymesCertains.has(premier)
    || (autres(premier).tete > 0 && autres(premier).tete >= autres(premier).queue)
  const parEmail = ordreSelonEmail(t.email, mots)

  if (mots.length === 2 && ((dernierEstPatronyme && !premierEstPatronyme) || parEmail === 'prenom_nom')) {
    return {
      ...sortie,
      nom: mots[1],
      prenom: mots[0],
      confiance: parEmail === 'prenom_nom' && !dernierEstPatronyme ? 'probable' : 'sûr',
      pourquoi: dernierEstPatronyme
        ? `inversé — « ${mots[1]} » est le patronyme d’une autre ligne du registre, « ${mots[0]} » non`
        : `inversé — l’adresse « ${t.email} » est de la forme prénom.nom`,
    }
  }

  // Le cas ordinaire : NOM Prénom, le patronyme d'abord, particules comprises.
  let coupe = 1
  const particule = PARTICULES.includes(premier)
  while (coupe < mots.length && PARTICULES.includes(sansAccents(mots[coupe - 1]))) coupe += 1

  // ⚠ PATRONYME COMPOSÉ : si le DEUXIÈME mot est lui-même un patronyme attesté
  // ailleurs dans le registre, il fait partie du nom et non du prénom.
  // « Schwitzgebel Lüscher Valérie » — « Lüscher » est le nom de famille d'un
  // autre dirigeant. Coupé après le premier mot, Mme Valérie Schwitzgebel se
  // serait retrouvée avec « Lüscher » pour prénom.
  let compose = false
  if (coupe === 1 && mots.length >= 3 && enTete.has(sansAccents(mots[1])) && !ambigus.has(sansAccents(mots[1]))) {
    coupe = 2
    compose = true
  }

  const nom = mots.slice(0, coupe).join(' ')
  const prenom = mots.slice(coupe).join(' ')

  // ⚠ LE NOM DE LA SOCIÉTÉ DU MÊME LOT CORROBORE : « SCI Aljasser Family
  // Company » dit que « Aljasser » est bien le patronyme de ses deux
  // dirigeants. C'est une vérification interne, pas une intuition sur
  // l'origine d'un nom — et c'est précisément là qu'une règle naïve dérape.
  const societeDuLot = titulaires.some((x) =>
    x.proprietaire_id === t.proprietaire_id && x.est_personne_morale
    && sansAccents(x.nom || '').split(/\s+/).includes(sansAccents(nom)))

  // ⚠ UN INDICE DE PLUS POUR LES LIGNES DOUTEUSES, jamais une décision : une
  // adresse du même lot qui contient l'un des mots dit lequel la famille
  // emploie pour se nommer. « bougarye@mac.com » sur 0B 240 désigne
  // « Bougary » — ce que le découpage par défaut range dans le prénom.
  const adressesDuLot = titulaires
    .filter((x) => x.proprietaire_id === t.proprietaire_id && x.email)
    .map((x) => sansAccents(x.email.split('@')[0]))
  const indices = mots
    .map((m) => sansAccents(m))
    .filter((m) => m.length > 3 && adressesDuLot.some((a) => a.includes(m)))

  // La confiance, et seulement elle, décide de ce qui part en relecture.
  let confiance = 'a_verifier'
  let pourquoi = mots.length - coupe > 1
    ? `${mots.length - coupe} prénoms supposés après « ${nom} »`
    : `${mots.length} mots — ordre supposé « nom prénom »`
  if (patronymesCertains.has(sansAccents(nom)) && prenomsCertains.has(sansAccents(prenom))) {
    confiance = 'sûr'; pourquoi = 'prénom et nom confirmés par `membres_cs`'
  } else if (mots.length === 2 && premierEstPatronyme && !dernierEstPatronyme) {
    confiance = 'sûr'; pourquoi = `« ${nom} » est un patronyme attesté ailleurs dans le registre`
  } else if (compose) {
    confiance = 'probable'; pourquoi = `patronyme composé — « ${mots[1]} » est un nom de famille du registre`
  } else if (particule) {
    confiance = 'probable'; pourquoi = `particule « ${mots[0]} » rattachée au patronyme`
  } else if (societeDuLot) {
    confiance = 'probable'; pourquoi = `« ${nom} » figure dans la raison sociale du même lot`
  } else if (mots.length === 2 && coupe === 1) {
    confiance = 'probable'; pourquoi = 'deux mots, convention « NOM Prénom » du registre'
  }
  if (confiance === 'a_verifier' && indices.length) {
    pourquoi += ` — ⚠ une adresse du lot contient « ${indices.join(' », « ')} »`
  }
  return { ...sortie, nom, prenom, confiance, pourquoi }
}

const propositions = titulaires
  .map((t) => ({ t, p: separer(t) }))
  .filter(({ t, p }) => p.civilite !== t.civilite || p.prenom !== t.prenom || p.nom !== t.nom)

const parConfiance = (c) => propositions.filter(({ p }) => p.confiance === c)
const sûrs = [...parConfiance('sûr'), ...parConfiance('probable')]
const aVerifier = parConfiance('a_verifier')
// ⚠ FILET : une proposition qui modifie la ligne sans appartenir à l'une des
// deux catégories ne serait ni écrite ni affichée. Six lignes y sont tombées au
// premier passage. On les range avec celles à relire plutôt que de les perdre.
for (const x of propositions) {
  if (!sûrs.includes(x) && !aVerifier.includes(x)) {
    x.p.pourquoi = `${x.p.pourquoi} — ⚠ non classé, à relire`
    aVerifier.push(x)
  }
}

// ── Rapport ───────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
W(`# Civilité, prénom, nom — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`${titulaires.length} titulaires · **${propositions.length} à découper** `
  + `· ${sûrs.length} sûrs ou probables · ${aVerifier.length} à vérifier `
  + `· ${titulaires.length - propositions.length} laissés intacts.`)
W('')
W('⚠ La civilité n’est **jamais déduite d’un prénom** : elle n’est posée que')
W('lorsqu’elle est écrite dans la chaîne. Attribuer un genre d’après un prénom,')
W('dans un registre qui sert à convoquer, n’est pas une commodité.')
W('')

const tableau = (titre, liste) => {
  if (!liste.length) return
  W(`## ${titre} (${liste.length})`)
  W('')
  W('| Parcelle | Avant | Civilité | Prénom | Nom | Pourquoi |')
  W('|---|---|---|---|---|---|')
  for (const { t, p } of liste) {
    W(`| ${numeroDe(t)} | \`${t.nom}\` | ${p.civilite || '—'} | ${p.prenom || '—'} | **${p.nom}** | ${p.pourquoi} |`)
  }
  W('')
}
tableau('⚠ À VÉRIFIER avant d’écrire', aVerifier)
tableau('Découpages sûrs ou probables', sûrs)

const intacts = titulaires.filter((t) => !propositions.some((x) => x.t.id === t.id))
if (intacts.length) {
  W(`## Laissés intacts (${intacts.length})`)
  W('')
  for (const t of intacts) {
    const p = separer(t)
    W(`- ${numeroDe(t)} — \`${t.nom}\` : ${p.pourquoi}`)
  }
  W('')
}

const aEcrire = AVEC_DOUTES ? propositions : sûrs

let faits = 0
if (GO && aEcrire.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `noms-titulaires-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'titulaires.json'), JSON.stringify(titulaires, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/noms-titulaires-${jour}\``)
  W('')
  for (const { t, p } of aEcrire) {
    const { error: e } = await supabase.from('titulaires')
      .update({ civilite: p.civilite, prenom: p.prenom, nom: p.nom }).eq('id', t.id)
    if (e) { W(`> ⚠ ${numeroDe(t)} — ${t.nom} : ${e.message}`); continue }
    faits += 1
  }
  W(`**${faits} ligne(s) écrites.**`)
  W('')
}

W('---')
W('')
W(GO
  ? `**${faits} écrites${AVEC_DOUTES ? '' : `, ${aVerifier.length} laissées en l’état (à relire)`}.**`
  : `**Essai à blanc : ${aEcrire.length} à écrire · ${AVEC_DOUTES ? 0 : aVerifier.length} laissées à relire. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `noms_titulaires_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} écrites · ${AVEC_DOUTES ? 0 : aVerifier.length} laissées à relire.`
  : `${aEcrire.length} à écrire · ${AVEC_DOUTES ? 0 : aVerifier.length} laissées à relire (essai à blanc).`)
