#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// MÉMOIRE — LA RÉTROCESSION D'HONORAIRES DE 2 015 €, VALIDÉE À TITRE PROVISOIRE
// Demande de Pascal, 19 novembre 2026 : « inscris-le dans la mémoire comme
// rétrocession validé provisoirement jusqu'au contrôle des comptes 2026-2027 ».
//
// Une entrée de chronologie dans « Syndic et gestion » + une édition ciblée des
// « Questions ouvertes » de sa synthèse.
// Textes : `scripts/data/memoire_retrocession_2026-11-19.json`.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ POURQUOI LE GRAND LIVRE N'EST PAS JOINT EN PIÈCE
// ──────────────────────────────────────────────────────────────────────────────
// Une entrée vaut cent fois plus accompagnée de sa pièce (046) — mais pas
// celle-ci. Les pages 6 à 25 du grand livre sont les COMPTES INDIVIDUELS des
// cinquante colotis, soldes débiteurs compris, et `sujets` / `sujet_entrees`
// sont lues par TOUT membre authentifié (045), pas par le bureau seul.
//
// La 035 ferme ces données au président et au secrétaire ; la 056 a déjà refusé
// de les laisser repasser par la table des envois. Les joindre ici les ferait
// fuir par la même porte de derrière, et personne ne le verrait. La provenance
// est donc écrite dans le texte de l'entrée, qui nomme les documents consultés
// sans les exposer.
//
// ⚠ Pour la même raison, l'entrée ne NOMME PAS les deux colotis dont les frais
// de mise en demeure ont été rétrocédés : le rapport du conseil lui-même, qui
// part à tous les colotis, écrit « seize comptes présentent un solde débiteur »
// sans citer personne.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ L'IDEMPOTENCE DE L'ÉDITION SE TESTE SUR `nouveau`, ET D'ABORD
// ──────────────────────────────────────────────────────────────────────────────
// `ancien` SURVIT DANS `nouveau` : la phrase visée est conservée et la suite
// ajoutée derrière. Un script qui raisonne « `ancien` est présent, donc
// j'applique » réécrit à chaque exécution, en empilant (leçon de la lettre du
// SIVOM, 1er octobre). On teste donc `nouveau` EN ENTIER, AVANT de chercher
// `ancien` — et jamais sur un préfixe de `nouveau`, qui répondrait « déjà fait »
// dès le premier passage.
//
// ⚠ EXACTEMENT UNE OCCURRENCE, SINON ON N'ÉCRIT PAS. Zéro : la cible a changé.
// Plusieurs : on ne sait pas laquelle viser, et prendre la première serait un
// tirage au sort.
//
// ──────────────────────────────────────────────────────────────────────────────
// ⚠ POURQUOI LA SYNTHÈSE EST TOUCHÉE ALORS QU'ON N'AJOUTE QU'UNE ENTRÉE
// ──────────────────────────────────────────────────────────────────────────────
// Ajouter une entrée ne met PAS à jour la synthèse — c'est la séparation voulue
// des deux tables de la 045, et les briefs disent de ne pas y toucher. Mais la
// demande porte précisément sur un état : « validé PROVISOIREMENT ». Une
// synthèse dont les « Questions ouvertes » ne mentionnent pas la réserve ferait
// lire l'affaire comme close par qui ne déplie pas la chronologie — exactement
// le trou que la question de Pascal du 5 octobre avait mis au jour sur la zone C.
//
// L'ancienne version est conservée dans `sujets.historique` (065).
//
// ⚠ APOSTROPHES DROITES : `sujets.contenu` et les entrées de ce sujet n'en
// portent aucune courbe. On aligne sur le CHAMP, pas sur la convention d'UI —
// une apostrophe courbe au milieu d'un paragraphe droit se voit. Vérifié.
//
// Usage :
//   node scripts/memoire_retrocession_2026-11-19.mjs               essai à blanc
//   node scripts/memoire_retrocession_2026-11-19.mjs --go          écrit
//   node scripts/memoire_retrocession_2026-11-19.mjs --go --remplacer
//        réécrit le texte d'une entrée de même date et de même titre déjà en
//        base. ABSENT PAR DÉFAUT : écraser une entrée de la mémoire ne doit
//        jamais être l'effet de bord d'un import.
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const REMPLACER = process.argv.includes('--remplacer')
const DONNEES = join(RACINE, 'scripts', 'data', 'memoire_retrocession_2026-11-19.json')

const esc = (t) => String(t ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Texte brut → HTML : ligne vide = paragraphe, saut simple = `<br>`. */
const enHTML = (texte) => String(texte)
  .split(/\n{2,}/)
  .map((bloc) => `<p>${bloc.split('\n').map(esc).join('<br>')}</p>`)
  .join('')

// ⚠ LES CARACTÈRES PARASITES SE DÉSIGNENT PAR LEUR POINT DE CODE, jamais en
// littéral dans une expression rationnelle : U+2028 et U+2029 sont des fins de
// ligne pour l'analyseur JavaScript, donc collés tels quels ils COUPENT le
// littéral en deux et le fichier ne compile plus. Constaté, puis corrigé.
// Séparateur de ligne, séparateur de paragraphe, BOM, espace insécable,
// espace sans largeur.
const PARASITES = new Set([0x2028, 0x2029, 0xfeff, 0x00a0, 0x200b])

// ── Connexion ────────────────────────────────────────────────────────────────
async function lireEnvFichier() {
  try {
    const brut = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of brut.split(/\r?\n|\r/)) {
      // Voir `PARASITES` : on filtre par point de code, pas par littéral.
      const propre = [...ligne].filter((c) => !PARASITES.has(c.codePointAt(0))).join('').trim()
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

// ── Les textes ───────────────────────────────────────────────────────────────
// ⚠ Le script REFUSE DE TOURNER s'il manque un bloc : écrire la moitié d'une
// inscription est pire que ne rien écrire, rien ne signalerait l'autre moitié.
const D = JSON.parse(await readFile(DONNEES, 'utf8'))
for (const [chemin, valeur] of [
  ['sujet', D.sujet],
  ['entree.date', D.entree?.date],
  ['entree.titre', D.entree?.titre],
  ['entree.contenu', D.entree?.contenu],
  ['entree.provenance', D.entree?.provenance],
  ['synthese.ancien', D.synthese?.ancien],
  ['synthese.nouveau', D.synthese?.nouveau],
  ['synthese.motif', D.synthese?.motif],
]) {
  if (!String(valeur || '').trim()) {
    console.error(`❌ Bloc manquant dans le fichier de données : \`${chemin}\`. Rien n'est écrit.`)
    process.exit(1)
  }
}
if (!/^\d{4}-\d{2}-\d{2}$/.test(D.entree.date)) {
  console.error(`❌ Date illisible : « ${D.entree.date} ». On n'en invente pas.`)
  process.exit(1)
}
// ⚠ La garde du SIVOM, posée ici une fois pour toutes : si `nouveau` ne
// contenait pas `ancien`, l'édition ne serait pas un ajout mais un remplacement,
// et le test d'idempotence ci-dessous ne voudrait plus rien dire.
if (!D.synthese.nouveau.includes(D.synthese.ancien)) {
  console.error('❌ `nouveau` ne contient pas `ancien` : ce n\'est plus une édition ciblée.')
  process.exit(1)
}

const CONTENU = enHTML(D.entree.contenu) + `<p><em>${esc(D.entree.provenance)}</em></p>`

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `memoire-retrocession-${jour}`)
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
W(`# Mémoire — rétrocession d'honoraires ${GO ? '· ÉCRITURE' : '· essai à blanc'}`)
W('')
W(`_${new Date().toISOString()}_`)
W('')

if (GO) {
  console.log('Sauvegarde du jour…')
  const dir = await sauvegardeDuJour()
  W(`Sauvegarde : \`${dir.replace(RACINE + '/', '')}\``)
  W('')
}

const anomalies = []

// ── La cible ─────────────────────────────────────────────────────────────────
const { data: sujet, error: eSujet } = await supabase.from('sujets')
  .select('id,titre,contenu,historique').eq('titre', D.sujet).maybeSingle()
if (eSujet) { console.error(`❌ lecture du sujet : ${eSujet.message}`); process.exit(1) }
if (!sujet) { console.error(`❌ Sujet introuvable : « ${D.sujet} ».`); process.exit(1) }

// ⚠ L'auteur se résout par son RÔLE, pas par un UUID codé en dur : un
// identifiant opaque dans un script n'est plus relisible dans dix ans.
const { data: presidents, error: eMembre } = await supabase.from('membres_cs')
  .select('id,nom,prenom').eq('role', 'president').eq('actif', true)
if (eMembre) { console.error(`❌ lecture des membres : ${eMembre.message}`); process.exit(1) }
if (presidents?.length !== 1) {
  console.error(`❌ ${presidents?.length ?? 0} président actif : on ne devine pas l'auteur.`)
  process.exit(1)
}
const auteur = presidents[0]

// ── 1. L'entrée de chronologie ───────────────────────────────────────────────
const { data: dejaLa, error: eEntrees } = await supabase.from('sujet_entrees')
  .select('id,titre,contenu,date_evenement')
  .eq('sujet_id', sujet.id).eq('date_evenement', D.entree.date).eq('titre', D.entree.titre)
if (eEntrees) { console.error(`❌ lecture des entrées : ${eEntrees.message}`); process.exit(1) }

let actionEntree = 'creer'
if (dejaLa?.length > 1) {
  actionEntree = 'rien'
  anomalies.push(`${dejaLa.length} entrées portent déjà cette date et ce titre — on ne devine pas laquelle viser.`)
} else if (dejaLa?.length === 1) {
  // ⚠ UN TITRE INCHANGÉ NE GARANTIT PAS UN TEXTE INCHANGÉ (leçon des règles de
  // gestion) : la comparaison porte sur le CONTENU.
  if (dejaLa[0].contenu === CONTENU) actionEntree = 'rien'
  else if (REMPLACER) actionEntree = 'remplacer'
  else {
    actionEntree = 'rien'
    anomalies.push("une entrée de même date et de même titre existe avec un AUTRE texte — non écrasée (relancer avec --remplacer pour l'imposer).")
  }
}

W("## 1. L'entrée de chronologie")
W('')
W(`- sujet : **${sujet.titre}**`)
W(`- date de l'évènement : **${D.entree.date}**`)
W(`- titre : ${D.entree.titre}`)
W(`- auteur : ${auteur.prenom ?? ''} ${auteur.nom} (président actif)`)
W(`- texte : ${CONTENU.length} caractères, ${(CONTENU.match(/<p>/g) || []).length} paragraphes`)
W(`- **action : ${{ creer: 'à créer', remplacer: 'texte à remplacer', rien: 'rien à faire' }[actionEntree]}**`)
W('- aucune pièce jointe — voir l\'en-tête du script : le grand livre porte les comptes individuels des colotis.')
W('')

// ── 2. L'édition de la synthèse ──────────────────────────────────────────────
const contenuSujet = sujet.contenu || ''
// ⚠ ORDRE IMPOSÉ : `nouveau` d'abord (il contient `ancien`), `ancien` ensuite.
const synthDejaFaite = contenuSujet.includes(D.synthese.nouveau)
const occurrences = synthDejaFaite
  ? 0
  : contenuSujet.split(D.synthese.ancien).length - 1

let actionSynthese = 'appliquer'
if (synthDejaFaite) actionSynthese = 'rien'
else if (occurrences === 0) {
  actionSynthese = 'rien'
  anomalies.push('la phrase visée dans la synthèse est introuvable — ni déjà corrigée, ni présente. À revoir à la main.')
} else if (occurrences > 1) {
  actionSynthese = 'rien'
  anomalies.push(`la phrase visée apparaît ${occurrences} fois dans la synthèse — on n'en choisit pas une au hasard.`)
}

W('## 2. Les « Questions ouvertes » de la synthèse')
W('')
W(`- **action : ${{ appliquer: 'édition ciblée à appliquer', rien: 'rien à faire' }[actionSynthese]}**`)
if (synthDejaFaite) W('- la phrase révisée est **déjà en place** — rien à écrire.')
if (actionSynthese === 'appliquer') {
  W(`- occurrence(s) de la phrase visée : **${occurrences}** (une seule autorise l'écriture)`)
  W(`- synthèse : ${contenuSujet.length} → ${(contenuSujet.replace(D.synthese.ancien, D.synthese.nouveau)).length} caractères`)
  W(`- version précédente conservée dans \`sujets.historique\` (${(sujet.historique || []).length} → ${(sujet.historique || []).length + 1})`)
  W('')
  W(`  > ${D.synthese.motif}`)
}
W('')

if (anomalies.length) {
  W('## ⚠ Anomalies')
  W('')
  for (const a of anomalies) W(`- ${a}`)
  W('')
}

W('---')
W('')
const aFaire = (actionEntree === 'rien' ? 0 : 1) + (actionSynthese === 'rien' ? 0 : 1)
W(`**${aFaire} opération(s) · ${anomalies.length} anomalie(s).**`)
W('')
W('Aucune entrée supprimée, aucun autre sujet touché. `pv_archives`, `resolutions_ag` et')
W('`regles_gestion` intacts : une vérification comptable ne se vote pas et ne fonde aucune règle.')
W('')

// ── Écriture ─────────────────────────────────────────────────────────────────
if (GO) {
  if (actionEntree === 'creer') {
    const { error } = await supabase.from('sujet_entrees').insert({
      sujet_id: sujet.id,
      date_evenement: D.entree.date,
      titre: D.entree.titre,
      contenu: CONTENU,
      auteur_id: auteur.id,
      documents: [],
    })
    if (error) { console.error(`❌ création de l'entrée : ${error.message}`); process.exit(1) }
    console.log('✅ entrée créée.')
  } else if (actionEntree === 'remplacer') {
    const ancienne = dejaLa[0]
    const { error } = await supabase.from('sujet_entrees')
      .update({ contenu: CONTENU }).eq('id', ancienne.id)
    if (error) { console.error(`❌ mise à jour de l'entrée : ${error.message}`); process.exit(1) }
    // `sujet_entrees` n'a pas d'historique : la version précédente va dans
    // celui du sujet parent, NOMMÉE, pour qu'on ne la prenne pas pour une
    // ancienne synthèse (même choix que la correction du 14 octobre).
    const historique = [...(sujet.historique || []), {
      le: new Date().toISOString(),
      motif: 'réécriture du texte de l\'entrée sur la rétrocession (--remplacer)',
      entree: { id: ancienne.id, date: ancienne.date_evenement, titre: ancienne.titre },
      contenu: ancienne.contenu,
    }]
    const { error: eH } = await supabase.from('sujets').update({ historique }).eq('id', sujet.id)
    if (eH) { console.error(`❌ historique : ${eH.message}`); process.exitCode = 1 }
    else console.log('✅ texte de l\'entrée remplacé, version précédente conservée.')
    sujet.historique = historique
  } else {
    console.log("Entrée : rien à écrire.")
  }

  if (actionSynthese === 'appliquer') {
    const revisee = contenuSujet.replace(D.synthese.ancien, D.synthese.nouveau)
    const historique = [...(sujet.historique || []), {
      le: new Date().toISOString(),
      motif: D.synthese.motif,
      contenu: contenuSujet,
    }]
    const { error } = await supabase.from('sujets')
      .update({ contenu: revisee, historique }).eq('id', sujet.id)
    if (error) { console.error(`❌ édition de la synthèse : ${error.message}`); process.exit(1) }
    console.log(`✅ synthèse révisée, version précédente conservée (${historique.length} au total).`)
  } else {
    console.log('Synthèse : rien à écrire.')
  }
} else {
  console.log("Essai à blanc — rien n'a été écrit. Relancer avec --go.")
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const out = join(RACINE, 'export', `memoire_retrocession_${stamp}${GO ? '' : '-essai'}.md`)
await mkdir(dirname(out), { recursive: true })
await writeFile(out, lignes.join('\n'), 'utf8')
console.log(`\n📄 Rapport : ${out}`)
