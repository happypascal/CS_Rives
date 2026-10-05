#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// LES RÉPONSES DE CLAUDE sur les huit synthèses de la Mémoire de l'ASL
// (5 octobre 2026 — `A_VERIFIER_syntheses_memoire_2026-10-05.md`, section
// « Réponses de Claude »)
//
// Trois écritures, dans cet ORDRE :
//   1. CORRECTIONS d'entrées (8) — des titres et des textes que Claude a trouvés
//      faux après relecture des PV sur l'image : « premier PV du cabinet Pillet »
//      quand ceux de 1978 et 1979 manquent, « toutes non conformes » quand le
//      compte rendu dit « anomalies », une causalité présentée comme établie.
//   2. ENTRÉES AJOUTÉES (3) — Arbres 1971, Portails 1974 et 1977. ⚠ Elles passent
//      AVANT les paragraphes : ceux d'Arbres et de Portails s'appuient dessus, et
//      une synthèse qui cite un fait absent de la chronologie est une synthèse
//      invérifiable.
//   3. PARAGRAPHES de synthèse (8).
//
// ⚠ LES TEXTES SONT LUS DANS LE DOCUMENT, PAS RECOPIÉS ICI. Huit paragraphes et
// onze lignes de tableau retranscrits à la main, c'est onze occasions de changer
// un mot sans le voir. Le document est l'autorité ; le script l'analyse. S'il
// n'y trouve pas ses huit blocs et ses deux tableaux, il REFUSE de tourner.
//
// ⚠ RÉPONSE À LA QUESTION 1 — Portails et eaux pluviales reçoivent leur PROPRE
// section (`<h3>Avant 1989</h3>`, `<h3>Avant 1990</h3>`) insérée AVANT la section
// existante, et la phrase d'attaque du paragraphe (« Avant 1989. », « Les
// premières inondations. ») est RETIRÉE puisqu'elle devient le titre. Motif :
// « Trente ans d'hésitation » et « Trente ans de réparations » restent exacts
// pour leur période, alors qu'y verser 1968-1987 les rendait faux. Un titre qui
// compte les années doit compter juste.
//
// ⚠ RÉPONSE À LA QUESTION 2 — « Urbanisme et servitudes » reçoit son paragraphe
// À LA FIN, en pseudo-section `<p><strong>Application dans le temps</strong></p>`.
// C'est la seule synthèse organisée par RÈGLE et non par date : y glisser un
// paragraphe chronologique en tête aurait cassé son plan.
//
// ⚠ L'APOSTROPHE SUIT LE CHAMP, RELEVÉE À L'EXÉCUTION. Sept synthèses utilisent
// la droite `'`, « Urbanisme » la typographique `’`, et les entrées varient selon
// l'import qui les a créées. Une valeur codée en dur se verrait dans le texte —
// et, plus grave, ferait ÉCHOUER la recherche d'un `ancien` écrit dans l'autre
// convention. On normalise les deux sens avant toute comparaison.
//
// ⚠ L'IDEMPOTENCE SE TESTE SUR `nouveau`, ET AVANT DE CHERCHER `ancien`. Ici le
// piège est réel : pour l'entrée Arbres 1963, `ancien` = « Relevé sans vote. »
// SURVIT dans `nouveau`. Un script qui vérifie `ancien` d'abord réécrirait à
// chaque exécution, en empilant. ⚠ Et jamais sur un PRÉFIXE de `nouveau`.
//
// ⚠ CE QUI N'EST PAS FAIT, ET POURQUOI : les entrées « si tu le souhaites » de la
// question 7 (statut juridique 1980, eaux pluviales 1976 Grando, bouches
// d'incendie 1971). Pascal a demandé les paragraphes, les corrections et LES
// TROIS entrées — pas celles-là. Elles restent ouvertes.
//
// Usage :
//   node scripts/appliquer_syntheses_memoire_2026-10-05.mjs        essai à blanc
//   node scripts/appliquer_syntheses_memoire_2026-10-05.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const DOC = join(RACINE, 'A_VERIFIER_syntheses_memoire_2026-10-05.md')
const AUTEUR_ROLE = 'president' // les 42 entrées du lot portent déjà cet auteur

// ── Où va chaque paragraphe ──────────────────────────────────────────────────
// `ordre` suit les titres « ## N. … » du document ; `titre` est le titre EXACT en
// base (celui d'« eaux pluviales » porte une apostrophe typographique).
const PLAN = [
  { ordre: 1, titre: 'Eaux usées et assainissement', mode: 'apres_h3', h3: 'Historique' },
  { ordre: 2, titre: 'Syndic et gestion', mode: 'apres_h3', h3: "L'héritage de la copropriété" },
  {
    ordre: 3,
    titre: 'Réseau eaux pluviales — mémoire de l’association',
    mode: 'section_avant',
    h3: 'Trente ans de réparations',
    nouveauH3: 'Avant 1990',
    retirer: 'Les premières inondations. ',
  },
  { ordre: 4, titre: 'Arbres et plantations (article 15)', mode: 'apres_h3', h3: 'La règle' },
  {
    ordre: 5,
    titre: 'Urbanisme et servitudes',
    mode: 'pseudo_section_fin',
    pseudoTitre: 'Application dans le temps',
    retirer: 'Application dans le temps. ',
  },
  {
    ordre: 6,
    titre: 'Portails et fermeture du lotissement',
    mode: 'section_avant',
    h3: "Trente ans d'hésitation",
    nouveauH3: 'Avant 1989',
    retirer: 'Avant 1989. ',
  },
  { ordre: 7, titre: 'Plage', mode: 'apres_h3', h3: 'Usages et entretien' },
  { ordre: 8, titre: 'Biens communs et indivis', mode: 'apres_h3', h3: 'Historique' },
]

// Les libellés abrégés des tableaux → le titre exact en base.
const ALIAS = {
  'Réseau eaux pluviales': 'Réseau eaux pluviales — mémoire de l’association',
}

// ⚠ LE DOCUMENT NOMME LE CHAMP « texte », LA COLONNE S'APPELLE `contenu`.
// Passé tel quel, PostgREST refuse : « Could not find the 'texte' column ». Il l'a
// fait, sur les cinq lignes concernées — et c'est heureux : le mock aurait avalé
// la clé inconnue sans rien dire. ⚠ L'ESSAI À BLANC NE POUVAIT PAS LE VOIR,
// puisqu'il n'appelle aucun `update` : un essai à blanc prouve que les cibles
// existent, jamais que l'écriture passe.
const COLONNE = { texte: 'contenu', titre: 'titre' }

const SOURCE_ENTREE = "Procès-verbal relu sur l'image le 5 octobre 2026."
const MOTIF = 'Réponses de Claude sur les synthèses, appliquées le 5 octobre 2026.'

// ── Apostrophes ──────────────────────────────────────────────────────────────
/** Convention d'un champ : la typographique si elle y domine. */
const convention = (t) => ((t.match(/’/g) || []).length > (t.match(/'/g) || []).length ? '’' : "'")
/** Met un texte dans la convention voulue, dans les deux sens. */
const aligner = (t, c) => (c === '’' ? t.replace(/'/g, '’') : t.replace(/’/g, "'"))

/**
 * Cherche `motif` dans `texte` en tolérant des BALISES entre deux caractères.
 * ⚠ La tolérance ne se met JAMAIS après le dernier caractère : accolée à chacun,
 * elle avale le `</p><p>` suivant et soude deux paragraphes (leçon de la 065).
 */
function chercherTolerant(texte, motif) {
  if (texte.includes(motif)) return { index: texte.indexOf(motif), longueur: motif.length, exact: true }
  const ech = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const corps = [...motif].map(ech).join('(?:<[^>]+>)*')
  const re = new RegExp(corps, 'g')
  const trouves = [...texte.matchAll(re)]
  if (trouves.length !== 1) return null
  return { index: trouves[0].index, longueur: trouves[0][0].length, exact: false }
}

// ── Lecture du document ──────────────────────────────────────────────────────
const doc = await readFile(DOC, 'utf8')

/** Les huit paragraphes, dans l'ordre des titres « ## N. … ». */
function lireParagraphes() {
  const out = new Map()
  const parts = doc.split(/^## (\d+)\. ([^\n]+)$/m)
  for (let i = 1; i < parts.length; i += 3) {
    const n = Number(parts[i])
    const corps = parts[i + 2]
    const bloc = /```\n([\s\S]*?)\n```/.exec(corps)
    if (bloc) out.set(n, bloc[1].split('\n').map((l) => l.trim()).join(' ').replace(/\s+/g, ' ').trim())
  }
  return out
}

/** Les lignes d'un tableau markdown situé sous un titre donné. */
function lireTableau(titreSection, colonnes) {
  const i = doc.indexOf(titreSection)
  if (i < 0) return null
  const suite = doc.slice(i + titreSection.length)
  const fin = suite.search(/\n##? /)
  const zone = fin < 0 ? suite : suite.slice(0, fin)
  const lignes = zone.split('\n').filter((l) => l.trim().startsWith('|'))
  const out = []
  for (const l of lignes) {
    const c = l.split('|').slice(1, -1).map((x) => x.trim())
    if (c.length !== colonnes) continue
    if (/^-+$/.test(c[0].replace(/[\s:]/g, '')) || c[0] === 'Sujet') continue
    out.push(c.map((x) => x.replace(/^`|`$/g, '').replace(/^\*\*|\*\*$/g, '')))
  }
  return out
}

const PARAS = lireParagraphes()
const CORRECTIONS = lireTableau('## Entrées de chronologie à corriger', 5)
const AJOUTS = lireTableau('## Entrées à ajouter', 4)

// ⚠ On refuse de tourner sur un document incomplet : écrire la moitié d'une
// révision est pire que ne rien écrire — rien ne signalerait la moitié absente.
const attendu = { paragraphes: 8, corrections: 8, ajouts: 3 }
const lu = { paragraphes: PARAS.size, corrections: CORRECTIONS?.length ?? 0, ajouts: AJOUTS?.length ?? 0 }
for (const [k, v] of Object.entries(attendu)) {
  if (lu[k] !== v) {
    console.error(`❌ Document inattendu : ${lu[k]} ${k} lus, ${v} attendus. Rien n'est écrit.`)
    process.exit(1)
  }
}

// ── Connexion ────────────────────────────────────────────────────────────────
async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // ⚠ En ÉCHAPPEMENTS : collés tels quels, U+2028 coupe le littéral en deux.
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

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `syntheses-memoire-${jour}`)
  await mkdir(dir, { recursive: true })
  for (const table of ['sujets', 'sujet_entrees']) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw new Error(`sauvegarde ${table} : ${error.message}`)
    await writeFile(join(dir, `${table}.json`), JSON.stringify(data, null, 2), 'utf8')
    console.log(`  ✓ ${table} : ${data.length} ligne(s)`)
  }
  return dir
}

// ── Rapport ──────────────────────────────────────────────────────────────────
const lignes = []
const W = (s = '') => lignes.push(s)
W(`# Synthèses de la Mémoire — réponses de Claude ${GO ? '· ÉCRITURE' : '· essai à blanc'}`)
W('')
W(`_${new Date().toISOString()}_`)
W('')
W(`Source : \`A_VERIFIER_syntheses_memoire_2026-10-05.md\` — ${lu.paragraphes} paragraphes, ${lu.corrections} corrections d'entrées, ${lu.ajouts} entrées à ajouter, lus dans le document.`)
W('')

let sauvegarde = null
if (GO) {
  console.log('Sauvegarde du jour…')
  sauvegarde = await sauvegardeDuJour()
  W(`Sauvegarde : \`${sauvegarde.replace(RACINE + '/', '')}\``)
  W('')
}

const { data: sujets, error: eSujets } = await supabase.from('sujets').select('id,titre,contenu,historique,resume')
if (eSujets) { console.error('❌ lecture des sujets :', eSujets.message); process.exit(1) }
const parTitre = new Map(sujets.map((s) => [s.titre, s]))
const resolve = (libelle) => parTitre.get(ALIAS[libelle] || libelle)

const { data: membres } = await supabase.from('membres_cs').select('id,role').eq('role', AUTEUR_ROLE).limit(1)
const auteurId = membres?.[0]?.id
if (!auteurId) { console.error(`❌ aucun membre « ${AUTEUR_ROLE} » pour porter les entrées.`); process.exit(1) }

const { count: entreesAvant } = await supabase.from('sujet_entrees').select('*', { count: 'exact', head: true })

const anomalies = []
const faitCorrections = []
const faitAjouts = []
const faitParas = []

// ── 1. Corrections d'entrées ─────────────────────────────────────────────────
W('## 1. Corrections d’entrées de chronologie')
W('')
W('| Sujet | Date | Champ | État | Détail |')
W('|---|---|---|---|---|')

for (const [libelle, dateFR, champ, ancienDoc, nouveauDoc] of CORRECTIONS) {
  const su = resolve(libelle)
  if (!su) { anomalies.push(`correction : sujet « ${libelle} » introuvable.`); continue }
  if (!COLONNE[champ]) { anomalies.push(`correction ${libelle} ${dateFR} : champ « ${champ} » inconnu — rien écrit.`); continue }
  const iso = dateFR.split('/').reverse().join('-')
  const { data: candidats, error } = await supabase
    .from('sujet_entrees')
    .select('id,titre,contenu,date_evenement')
    .eq('sujet_id', su.id)
    .eq('date_evenement', iso)
  if (error) { anomalies.push(`correction ${libelle} ${dateFR} : ${error.message}`); continue }

  // Candidats où le remplacement s'applique, ou est DÉJÀ appliqué.
  const vus = []
  for (const c of candidats) {
    const avant = (champ === 'titre' ? c.titre : c.contenu) || ''
    const conv = convention(avant)
    const ancien = aligner(ancienDoc, conv)
    const nouveau = aligner(nouveauDoc, conv)
    // ⚠ `nouveau` EN ENTIER ET D'ABORD : « Relevé sans vote. » survit dans son
    // propre remplacement, et le tester en premier relancerait l'empilement.
    if (avant.includes(nouveau)) { vus.push({ c, etat: 'déjà' }); continue }
    const t = chercherTolerant(avant, ancien)
    if (t) vus.push({ c, etat: 'à faire', avant, t, nouveau, exact: t.exact })
  }

  const dejas = vus.filter((v) => v.etat === 'déjà')
  const aFaire = vus.filter((v) => v.etat === 'à faire')
  if (!vus.length) {
    anomalies.push(`correction ${libelle} ${dateFR} (${champ}) : ni « ${ancienDoc.slice(0, 40)}… » ni son remplacement trouvés — rien écrit.`)
    W(`| ${libelle} | ${dateFR} | ${champ} | ⚠ introuvable | ni l’ancien ni le nouveau |`)
    continue
  }
  if (aFaire.length > 1) {
    anomalies.push(`correction ${libelle} ${dateFR} (${champ}) : ${aFaire.length} entrées candidates — on ne devine pas laquelle, rien écrit.`)
    W(`| ${libelle} | ${dateFR} | ${champ} | ⚠ ambigu | ${aFaire.length} candidates |`)
    continue
  }
  if (!aFaire.length) {
    W(`| ${libelle} | ${dateFR} | ${champ} | déjà en place | ${dejas.length} entrée(s) |`)
    continue
  }
  const v = aFaire[0]
  const apres = v.avant.slice(0, v.t.index) + v.nouveau + v.avant.slice(v.t.index + v.t.longueur)
  faitCorrections.push({ id: v.c.id, champ, apres, libelle, dateFR, titre: v.c.titre })
  W(`| ${libelle} | ${dateFR} | ${champ} | à écrire${v.exact ? '' : ' *(ancre traversant des balises)*'} | « ${ancienDoc.slice(0, 48)}… » → « ${nouveauDoc.slice(0, 48)}… » |`)
}
W('')

// ── 2. Entrées ajoutées ──────────────────────────────────────────────────────
W('## 2. Entrées de chronologie ajoutées')
W('')
for (const [libelle, dateFR, titre, texte] of AJOUTS) {
  const su = resolve(libelle)
  if (!su) { anomalies.push(`ajout : sujet « ${libelle} » introuvable.`); continue }
  const iso = dateFR.split('/').reverse().join('-')
  const { data: deja } = await supabase
    .from('sujet_entrees')
    .select('id')
    .eq('sujet_id', su.id)
    .eq('date_evenement', iso)
    .eq('titre', titre)
  if (deja?.length) { W(`- **${dateFR}** (${libelle}) — déjà présente : ${titre}`); continue }
  const contenu = `<p>${texte}</p><p><em>${SOURCE_ENTREE}</em></p>`
  faitAjouts.push({ sujet_id: su.id, date_evenement: iso, titre, contenu, auteur_id: auteurId, libelle, dateFR })
  W(`- **${dateFR}** (${libelle}) — à créer : **${titre}**`)
  W(`  > ${texte}`)
}
W('')

// ── 3. Paragraphes de synthèse ───────────────────────────────────────────────
W('## 3. Paragraphes de synthèse')
W('')
for (const p of PLAN) {
  const su = parTitre.get(p.titre)
  if (!su) { anomalies.push(`paragraphe : sujet « ${p.titre} » introuvable.`); continue }
  let texte = PARAS.get(p.ordre)
  if (!texte) { anomalies.push(`paragraphe ${p.ordre} absent du document.`); continue }

  const avant = su.contenu || ''
  const conv = convention(avant)
  if (p.retirer) {
    const r = aligner(p.retirer, convention(texte))
    if (!texte.startsWith(r)) {
      anomalies.push(`paragraphe « ${p.titre} » : la phrase d’attaque « ${p.retirer.trim()} » attendue en tête est absente — rien écrit.`)
      W(`### ⚠ ${p.titre} — phrase d’attaque introuvable, rien écrit`)
      W('')
      continue
    }
    texte = texte.slice(r.length)
  }
  const para = `<p>${aligner(texte, conv)}</p>`

  let apres = null
  let ou = ''
  if (p.mode === 'apres_h3') {
    const h3 = `<h3>${aligner(p.h3, conv)}</h3>`
    const n = avant.split(h3).length - 1
    if (n !== 1) { anomalies.push(`paragraphe « ${p.titre} » : ancre ${h3} trouvée ${n} fois — rien écrit.`); W(`### ⚠ ${p.titre} — ancre ${n}×, rien écrit`); W(''); continue }
    apres = avant.replace(h3, h3 + para)
    ou = `après \`${h3}\``
  } else if (p.mode === 'section_avant') {
    const h3 = `<h3>${aligner(p.h3, conv)}</h3>`
    const n = avant.split(h3).length - 1
    if (n !== 1) { anomalies.push(`paragraphe « ${p.titre} » : ancre ${h3} trouvée ${n} fois — rien écrit.`); W(`### ⚠ ${p.titre} — ancre ${n}×, rien écrit`); W(''); continue }
    const bloc = `<h3>${aligner(p.nouveauH3, conv)}</h3>${para}`
    apres = avant.replace(h3, bloc + h3)
    ou = `nouvelle section \`<h3>${p.nouveauH3}</h3>\`, insérée **avant** \`${h3}\``
  } else if (p.mode === 'pseudo_section_fin') {
    const bloc = `<p><strong>${aligner(p.pseudoTitre, conv)}</strong></p>${para}`
    apres = avant + bloc
    ou = `**à la fin**, pseudo-section \`<p><strong>${p.pseudoTitre}</strong></p>\``
  }

  // ⚠ Idempotence sur le paragraphe EN ENTIER.
  if (avant.includes(para)) { W(`### ${p.titre} — déjà en place`); W(''); continue }
  if (apres.length <= avant.length) { anomalies.push(`paragraphe « ${p.titre} » : la synthèse ne s’allonge pas — rien écrit.`); continue }

  faitParas.push({ su, avant, apres, titre: p.titre })
  W(`### ${p.titre}`)
  W('')
  W(`- synthèse : **${avant.length} → ${apres.length}** caractères · apostrophe du champ : \`${conv}\``)
  W(`- ${ou}`)
  W('')
  W('> ' + aligner(texte, conv))
  W('')
}

// ── Bilan ────────────────────────────────────────────────────────────────────
if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}
W('---')
W('')
W(`**${faitCorrections.length} correction(s) · ${faitAjouts.length} entrée(s) ajoutée(s) · ${faitParas.length} synthèse(s) · ${anomalies.length} anomalie(s).**`)
W('')
W(`Entrées : **${entreesAvant} → ${entreesAvant + faitAjouts.length}**. Aucune entrée supprimée ; \`pv_archives\` et \`resume_resolutions\` intacts.`)
W('')
W('Non appliqué, faute d’avoir été demandé — les entrées « si tu le souhaites » de la question 7 :')
W('statut juridique 1980 (article 42 de la loi de 1965), eaux pluviales 1976 (conduite Grando),')
W('biens communs 1971 (bouches d’incendie). Elles restent ouvertes.')
W('')

// ── Écriture ─────────────────────────────────────────────────────────────────
if (GO) {
  for (const c of faitCorrections) {
    const { error } = await supabase.from('sujet_entrees').update({ [COLONNE[c.champ]]: c.apres }).eq('id', c.id)
    if (error) { console.error(`❌ correction ${c.libelle} ${c.dateFR} : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ corrigé · ${c.libelle} ${c.dateFR} (${c.champ})`)
  }
  for (const a of faitAjouts) {
    const { libelle, dateFR, ...ligne } = a
    const { error } = await supabase.from('sujet_entrees').insert(ligne)
    if (error) { console.error(`❌ ajout ${libelle} ${dateFR} : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ ajoutée · ${libelle} ${dateFR} — ${ligne.titre}`)
  }
  for (const f of faitParas) {
    const historique = [...(f.su.historique || []), { le: new Date().toISOString(), motif: MOTIF, resume: f.su.resume ?? null, contenu: f.avant }]
    const { error } = await supabase.from('sujets').update({ contenu: f.apres, historique }).eq('id', f.su.id)
    if (error) { console.error(`❌ synthèse ${f.titre} : ${error.message}`); process.exitCode = 1 }
    else console.log(`✅ synthèse · ${f.titre} (version précédente conservée, ${historique.length} au total)`)
  }
  // Garde-fou final : le nombre d'entrées ne peut que croître.
  const { count: apresCount } = await supabase.from('sujet_entrees').select('*', { count: 'exact', head: true })
  if (apresCount < entreesAvant) {
    console.error(`❌ ALERTE : ${entreesAvant} entrées avant, ${apresCount} après. Restaurer depuis la sauvegarde.`)
    process.exitCode = 1
  } else {
    console.log(`\nEntrées : ${entreesAvant} → ${apresCount}.`)
  }
} else {
  console.log('Essai à blanc — rien n’a été écrit. Relancer avec --go.')
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `syntheses_memoire_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
