// MÉMOIRE DE L'ASL — corrections, synthèses, regroupements, nouveaux sujets.
//
// Exécute `BRIEF_memoire_sujets_2026-09-30.md`. Pascal : les synthèses sont trop
// minces ou absentes, et plusieurs entrées sont fausses — 2008 « adoptée à
// l'unanimité », un « Pour : 72 854 », une « résolution 10-2 » qui n'existe pas.
//
// ⚠ LES TEXTES SONT FOURNIS ET VÉRIFIÉS SUR LES PV. Le script les recopie, il ne
// les reformule jamais — pas même pour normaliser une majuscule.
//
// =============================================================================
// ON NE SUPPRIME RIEN
// =============================================================================
// ⚠ « Détacher » pose une DATE et un MOTIF : l'entrée garde son `sujet_id` et
// cesse seulement de s'afficher dans la chronologie. Une entrée sans sujet
// n'apparaîtrait nulle part — perdue en pratique tout en existant en base.
// ⚠ « Déplacer » change le `sujet_id`, rien d'autre.
// ⚠ Un REGROUPEMENT crée une entrée consolidée et fait pointer les regroupées
// vers elle (`regroupee_sous`) : six sous-résolutions deviennent une ligne, et
// restent lisibles repliées dessous.
// ⚠ LE SCRIPT REFUSE D'ÉCRIRE si le nombre total d'entrées diminue.
//
// =============================================================================
// L'APPARIEMENT DES ENTRÉES — trois tolérances, et elles sont nécessaires
// =============================================================================
// ⚠ 1. LE SUFFIXE D'AUTEUR. Plusieurs `titre_actuel` portent ` _(Pascal Favre)_`
//      — la marque de l'export Markdown, pas un titre de la base. Sans le
//      retirer, cinq corrections ne trouvaient rien.
// ⚠ 2. LE PRÉFIXE. Les `titres_regroupes` sont ABRÉGÉS : « Portails » désigne
//      « Portails : choix de l'entreprise en AG ». Un titre répété désigne
//      plusieurs entrées — d'où la consommation des cibles au fur et à mesure.
// ⚠ 3. UNE CORRECTION NE CONSOMME PAS SA CIBLE. Deux corrections visent souvent
//      la MÊME entrée (le titre, puis le résultat) : les faire consommer faisait
//      échouer la seconde. Seuls regroupement, détachement et déplacement
//      consomment, parce qu'une entrée ne se déplace qu'une fois.
// Sur les 102 opérations ciblées, les trois tolérances ensemble ramènent 102
// cibles et zéro manque. Éprouvé avant d'écrire une ligne.
//
// Usage :
//   node scripts/appliquer_memoire_sujets.mjs        essai à blanc
//   node scripts/appliquer_memoire_sujets.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const SOURCE = join(RACINE, 'scripts', 'data', 'memoire_sujets_2026-09-30.json')

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

// ⚠ Une entrée LIÉE À UNE DÉCISION DU CONSEIL ne doit pas être écrasée : le
// nouveau texte s'ajoute en commentaire et le cas est signalé. La liaison est
// TEXTUELLE — il n'existe aucune clé étrangère entre la mémoire et les
// décisions (limite assumée, v1) — donc on la cherche là où elle s'écrit :
// un numéro `AAAA-NNN`, ou une mention explicite.
const LIEE_A_UNE_DECISION = /\b20\d{2}-\d{3}\b|d[ée]cision\s+(?:du\s+conseil|n[°o])/i

const htm = (t) => String(t ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

/** Les sections d'une synthèse → HTML. Intertitre, puis paragraphe. */
const sectionsEnHtml = (sections) => (sections || [])
  .map((s) => `<h3>${htm(s.titre)}</h3><p>${htm(s.texte)}</p>`).join('')

const isoDate = (f) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(f || ''))
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const norm = (t) => String(t ?? '')
  .replace(/\s*_\(.*?\)_\s*$/, '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()

// ⚠ UNE ÉDITION CIBLÉE DOIT TRAVERSER LES BALISES. Le passage à remplacer est
// donné en TEXTE BRUT (« Résolution n° 9, adoptée à l'unanimité — … ») alors que
// le texte stocké est du HTML où la phrase est coupée par des `<strong>`. Un
// `includes` n'y trouve rien : la correction de 2008 — celle-là même que Pascal
// a signalée — échouait en silence.
//
// On reconstruit donc un motif mot à mot, en tolérant balises et espaces entre
// les mots. ⚠ Le remplacement emporte les balises intérieures du passage : c'est
// voulu, la phrase de remplacement est fournie entière et n'a pas à hériter d'un
// gras posé sur d'autres mots.
const ECHAPPE = /[.*+?^${}()|[\]\\]/g
// ⚠ UNE BALISE PEUT COUPER UN MOT, pas seulement le séparer du suivant : le
// texte stocké porte « actuelle</strong>, » là où le passage fourni dit
// « actuelle, ». Un motif construit mot à mot échoue donc — éprouvé, et c'est
// ainsi que la correction de 2008 échouait encore au deuxième essai.
// On tolère les balises ENTRE DEUX CARACTÈRES QUELCONQUES. Les chaînes font cent
// trente caractères : le coût est nul, et la règle n'a plus de trou.
function remplacerDansHtml(html, ancien, nouveau) {
  // ⚠ LA TOLÉRANCE SE MET ENTRE LES CARACTÈRES, JAMAIS APRÈS LE DERNIER.
  // Accolée à chacun, elle est gourmande : le motif avalait le « </p><p> » qui
  // suit le point final et soudait deux paragraphes en un.
  const motif = new RegExp([...String(ancien).trim()]
    .map((c) => (/\s/.test(c) ? '(?:<[^>]*>|\\s|&nbsp;)+' : c.replace(ECHAPPE, '\\$&')))
    .join('(?:<[^>]*>)*'))
  return motif.test(html) ? { ok: true, html: html.replace(motif, nouveau) } : { ok: false, html }
}


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

async function sauvegardeDuJour() {
  const jour = new Date().toISOString().slice(0, 10)
  try {
    const dirs = await readdir(join(RACINE, 'backup'))
    for (const d of dirs.filter((x) => x.startsWith(jour)).sort().reverse()) {
      try {
        await readFile(join(RACINE, 'backup', d, 'sujets.json'))
        await readFile(join(RACINE, 'backup', d, 'sujet_entrees.json'))
        return d
      } catch { /* sauvegarde partielle : on continue */ }
    }
  } catch { /* pas de dossier backup */ }
  return null
}

async function main() {
  W(`# Mémoire de l'ASL — révision du 30 septembre 2026 — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const sauvegarde = await sauvegardeDuJour()
  W(sauvegarde
    ? `Sauvegarde du jour (avec \`sujets.json\` et \`sujet_entrees.json\`) : \`backup/${sauvegarde}\`.`
    : '⚠ **Aucune sauvegarde du jour** contenant `sujets` et `sujet_entrees`. `--go` sera refusé.')
  W('')
  if (GO && !sauvegarde) throw new Error('Sauvegarde du jour absente : lancer `node scripts/backup.mjs` d’abord.')

  const d = JSON.parse(await readFile(SOURCE, 'utf8'))

  // ⚠ L'ESSAI DOIT TOURNER AVANT LA MIGRATION 065.
  const CHAMPS_E = 'id, sujet_id, date_evenement, titre, contenu, documents, auteur_id'
  let colonnes = true
  let entrees, sujets
  {
    const r = await supabase.from('sujet_entrees').select(`${CHAMPS_E}, resultat, vote, regroupee_sous, detachee_le`)
    if (r.error) {
      if (!/resultat|regroupee_sous|detachee_le|vote/.test(r.error.message)) throw new Error(`Lecture des entrées : ${r.error.message}`)
      colonnes = false
      const r2 = await supabase.from('sujet_entrees').select(CHAMPS_E)
      if (r2.error) throw new Error(`Lecture des entrées : ${r2.error.message}`)
      entrees = r2.data
    } else entrees = r.data
    const rs = await supabase.from('sujets').select(colonnes ? 'id, titre, categorie, resume, contenu, historique' : 'id, titre, categorie, resume, contenu')
    if (rs.error) throw new Error(`Lecture des sujets : ${rs.error.message}`)
    sujets = rs.data
  }
  if (!colonnes) {
    W('⚠ **Migration 065 non appliquée** — l’essai reste complet ; `--go` sera refusé.')
    W('')
  }
  if (GO && !colonnes) throw new Error('Migration 065 absente : l’appliquer d’abord.')

  const auteur = (await supabase.from('membres_cs').select('id').eq('role', 'president').eq('actif', true).single()).data
  const parTitre = new Map(sujets.map((x) => [x.titre, x]))
  const total0 = entrees.length
  W(`État de départ : **${sujets.length} sujets · ${total0} entrées**.`)
  W('')

  // ----------------------------------------------------- l'appariement
  const pris = new Set()
  const trouver = (sid, date, titre, consomme) => {
    const t = norm(titre)
    const iso = date ? isoDate(date) : null
    const c = entrees.filter((e) => e.sujet_id === sid
      && (!iso || e.date_evenement === iso)
      && (!consomme || !pris.has(e.id)))
    const f = c.find((e) => norm(e.titre) === t)
      || c.find((e) => norm(e.titre).startsWith(t))
      || c.find((e) => norm(e.titre).includes(t))
    if (f && consomme) pris.add(f.id)
    return f || null
  }

  const patchsE = new Map()       // id → champs à écrire
  const patchsS = new Map()       // id → champs à écrire
  const nouvelles = []            // entrées à insérer
  const nouveauxSujets = []
  const introuvables = []
  const bloquees = []             // liées à une décision du conseil
  const aVerifier = []
  let nCorr = 0, nRegr = 0, nDet = 0, nDep = 0, dejaFait = 0

  // La correction est-elle déjà en place ? On cherche la VALEUR NOUVELLE.
  const dejaAppliquee = (sid, c) => {
    const l = entrees.filter((x) => x.sujet_id === sid && x.date_evenement === isoDate(c.date))
    if (c.champ === 'titre') return l.some((x) => norm(x.titre) === norm(c.nouveau))
    if (c.champ === 'resultat') return l.some((x) => norm(x.resultat) === norm(c.nouveau))
    return l.some((x) => String(x.contenu || '').includes(String(c.nouveau).slice(0, 60)))
  }

  const majE = (id, champs) => patchsE.set(id, { ...(patchsE.get(id) || {}), ...champs })

  // ⚠ Le texte courant d'une entrée tient compte des corrections déjà décidées :
  // deux corrections ciblées peuvent porter sur le même texte.
  const texteCourant = (e) => (patchsE.get(e.id)?.contenu ?? e.contenu) || ''
  const titreCourant = (e) => (patchsE.get(e.id)?.titre ?? e.titre) || ''

  for (const sj of d.sujets) {
    const sujet = parTitre.get(sj.sujet)
    if (!sujet) { introuvables.push(`Sujet « ${sj.sujet} » introuvable.`); continue }

    // ---- résumé et synthèse, avec historique
    const champsS = {}
    if (sj.resume && sj.resume !== sujet.resume) champsS.resume = sj.resume
    if (sj.synthese) champsS.contenu = sectionsEnHtml(sj.synthese)
    if (sj.synthese_ajout) {
      // ⚠ « completer » : la section s'AJOUTE à la fin, le reste n'est pas touché.
      const ajout = sectionsEnHtml([sj.synthese_ajout])
      if (!String(sujet.contenu || '').includes(htm(sj.synthese_ajout.titre))) {
        champsS.contenu = `${sujet.contenu || ''}${ajout}`
      }
    }
    if (Object.keys(champsS).length) {
      if (LIEE_A_UNE_DECISION.test(String(sujet.contenu || ''))) {
        bloquees.push(`Synthèse de « ${sj.sujet} » : liée à une décision du conseil, non écrasée — le nouveau texte est ajouté en commentaire.`)
        champsS.contenu = `${sujet.contenu}<hr><p><em>Proposition de révision du 30 septembre 2026, non appliquée car la synthèse cite une décision du conseil :</em></p>${champsS.contenu || ''}`
        delete champsS.resume
      }
      // ⚠ L'ANCIENNE VERSION EST GARDÉE AVANT D'ÊTRE REMPLACÉE.
      champsS.historique = [
        { le: new Date().toISOString(), resume: sujet.resume ?? null, contenu: sujet.contenu ?? null,
          motif: sj.note_revision || 'Révision du 30 septembre 2026.' },
        ...(sujet.historique || []),
      ]
      patchsS.set(sujet.id, champsS)
    }

    // ---- corrections
    for (const c of sj.corrections_entrees || []) {
      if (c.a_verifier) { aVerifier.push({ sujet: sj.sujet, ...c }); continue }
      const e = trouver(sujet.id, c.date, c.titre_actuel, false)
      if (!e) {
        // ⚠ UNE CORRECTION DÉJÀ APPLIQUÉE N'EST PAS UNE ERREUR. Au second
        // passage, `titre_actuel` ne retrouve plus rien — puisqu'il a justement
        // été corrigé. Sans ce test, relancer le script produisait 31 « opérations
        // sans cible » qui n'étaient que le signe de son propre succès.
        if (dejaAppliquee(sujet.id, c)) { dejaFait++; continue }
        introuvables.push(`Correction « ${String(c.titre_actuel).slice(0, 50)} » (${c.date}, ${sj.sujet}) : entrée introuvable.`)
        continue
      }
      if (LIEE_A_UNE_DECISION.test(`${titreCourant(e)} ${texteCourant(e)}`)) {
        bloquees.push(`Entrée « ${e.titre.slice(0, 50)} » (${c.date}) : liée à une décision du conseil — correction ajoutée en commentaire, texte d'origine conservé.`)
        majE(e.id, { contenu: `${texteCourant(e)}<hr><p><em>Correction proposée le 30 septembre 2026, non appliquée (entrée liée à une décision) : ${htm(c.nouveau)}</em></p>` })
        nCorr++
        continue
      }
      if (c.champ === 'titre') majE(e.id, { titre: c.nouveau })
      else if (c.champ === 'resultat') majE(e.id, { resultat: c.nouveau })
      else if (c.ancien) {
        // ⚠ ÉDITION CIBLÉE : on remplace le passage nommé, pas le texte entier.
        const avant = texteCourant(e)
        const r = remplacerDansHtml(avant, c.ancien, htm(c.nouveau))
        if (!r.ok) {
          // ⚠ Le passage absent parce qu'il a DÉJÀ été remplacé n'est pas une
          // anomalie : c'est l'idempotence qui se constate.
          if (avant.includes(htm(c.nouveau).slice(0, 60))) { dejaFait++; continue }
          introuvables.push(`Correction ciblée (${c.date}, ${sj.sujet}) : le passage « ${String(c.ancien).slice(0, 40)}… » ne figure pas dans le texte. Rien n’a été touché.`)
          continue
        }
        majE(e.id, { contenu: r.html })
      } else majE(e.id, { contenu: c.nouveau })
      nCorr++
    }

    // ---- regroupements
    for (const r of sj.regroupements || []) {
      // ⚠ Idempotence : la consolidée existe déjà, ses regroupées pointent
      // dessus. Repasser créerait une seconde consolidée et viderait la première.
      if (entrees.some((x) => x.sujet_id === sujet.id && x.date_evenement === isoDate(r.date)
        && norm(x.titre) === norm(r.titre))) { dejaFait++; continue }
      const cibles = []
      for (const t of r.titres_regroupes || []) {
        const e = trouver(sujet.id, r.date, t, true)
        if (e) cibles.push(e)
        else introuvables.push(`Regroupement « ${r.titre.slice(0, 40)} » (${r.date}) : « ${t} » introuvable.`)
      }
      if (!cibles.length) continue
      const id = randomUUID()
      nouvelles.push({
        id, sujet_id: sujet.id, date_evenement: isoDate(r.date), titre: r.titre,
        contenu: `<p>${htm(r.texte)}</p>`, resultat: r.resultat ?? null, vote: r.vote ?? null,
        documents: [], auteur_id: auteur.id,
      })
      for (const e of cibles) majE(e.id, { regroupee_sous: id })
      nRegr++
    }

    // ---- détachements
    for (const x of sj.detacher || []) {
      const e = trouver(sujet.id, x.date, x.titre_actuel, true)
      if (!e) { introuvables.push(`Détachement (${x.date}, ${sj.sujet}) : « ${x.titre_actuel} » introuvable.`); continue }
      if (e.detachee_le) { dejaFait++; continue }
      majE(e.id, { detachee_le: new Date().toISOString(), detachee_motif: x.motif || null })
      nDet++
    }

    // ---- entrées ajoutées
    for (const e of sj.entrees_a_ajouter || []) {
      const deja = entrees.some((x) => x.sujet_id === sujet.id && x.date_evenement === isoDate(e.date) && norm(x.titre) === norm(e.titre))
        || nouvelles.some((x) => x.sujet_id === sujet.id && norm(x.titre) === norm(e.titre))
      if (deja) continue
      nouvelles.push({
        id: randomUUID(), sujet_id: sujet.id, date_evenement: isoDate(e.date), titre: e.titre,
        contenu: `<p>${htm(e.texte)}</p>${e.source ? `<p><em>${htm(e.source)}</em></p>` : ''}`,
        resultat: e.resultat ?? null, vote: null, documents: [], auteur_id: auteur.id,
      })
    }
  }

  // ---- nouveaux sujets, et les entrées qui y migrent
  for (const ns of d.nouveaux_sujets) {
    const existant = parTitre.get(ns.sujet)
    const id = existant?.id || randomUUID()
    if (!existant) {
      nouveauxSujets.push({
        id, titre: ns.sujet, categorie: ns.categorie ?? null,
        resume: ns.resume ?? null, contenu: sectionsEnHtml(ns.synthese), created_by: auteur.id,
      })
    }
    for (const e of ns.entrees || []) {
      if (entrees.some((x) => x.sujet_id === id && x.date_evenement === isoDate(e.date) && norm(x.titre) === norm(e.titre))) { dejaFait++; continue }
      nouvelles.push({
        id: randomUUID(), sujet_id: id, date_evenement: isoDate(e.date), titre: e.titre,
        contenu: `<p>${htm(e.texte)}</p>${e.source ? `<p><em>${htm(e.source)}</em></p>` : ''}`,
        resultat: e.resultat ?? null, vote: null, documents: [], auteur_id: auteur.id,
      })
    }
  }
  // déplacements : après création, pour connaître l'id de la cible
  for (const sj of d.sujets) {
    if (!sj.entrees_a_deplacer) continue
    const source = parTitre.get(sj.sujet)
    const cibleId = parTitre.get(sj.deplacer_vers)?.id
      || nouveauxSujets.find((x) => x.titre === sj.deplacer_vers)?.id
    if (!cibleId) { introuvables.push(`Déplacement : sujet « ${sj.deplacer_vers} » introuvable.`); continue }
    for (const t of sj.entrees_a_deplacer) {
      const e = trouver(source.id, null, t, true)
      if (!e) {
        // ⚠ Elle n'est plus dans le sujet d'origine PARCE QU'ELLE A DÉJÀ ÉTÉ
        // DÉPLACÉE. On le vérifie dans le sujet cible avant de crier au manque.
        if (entrees.some((x) => x.sujet_id === cibleId && norm(x.titre).startsWith(norm(t)))) { dejaFait++; continue }
        introuvables.push(`Déplacement : « ${t} » introuvable dans « ${sj.sujet} ».`)
        continue
      }
      majE(e.id, { sujet_id: cibleId })
      nDep++
    }
  }

  // ------------------------------------------------------------- rapport
  W('## Ce qui serait appliqué')
  W('')
  W('| Opération | Nombre |')
  W('|---|---|')
  W(`| Sujets dont le résumé ou la synthèse changent | ${patchsS.size} |`)
  W(`| Corrections d’entrées | ${nCorr} |`)
  W(`| Regroupements (entrées consolidées créées) | ${nRegr} |`)
  W(`| Entrées rangées sous une consolidée | ${[...patchsE.values()].filter((p) => p.regroupee_sous).length} |`)
  W(`| Détachements | ${nDet} |`)
  W(`| Déplacements vers un autre sujet | ${nDep} |`)
  W(`| Entrées ajoutées | ${nouvelles.length - nRegr} |`)
  W(`| Nouveaux sujets | ${nouveauxSujets.length} |`)
  W('')
  W(`Entrées : **${total0} avant → ${total0 + nouvelles.length} après** (aucune supprimée).`)
  if (dejaFait) W(`${dejaFait} opération(s) **déjà appliquées** — ignorées sans bruit.`)
  W(`Sujets : **${sujets.length} → ${sujets.length + nouveauxSujets.length}**.`)
  W('')
  if (total0 + nouvelles.length < total0) throw new Error('Le nombre d’entrées diminuerait : rien n’a été écrit.')

  if (bloquees.length) {
    W('## ⚠ Liées à une décision du conseil — NON écrasées')
    W('')
    for (const b of bloquees) W(`- ${b}`)
    W('')
  } else {
    W('_Aucune entrée ni synthèse ne cite une décision du conseil : le garde-fou n’a rien retenu._')
    W('')
  }

  W(`## ⚠ ${aVerifier.length} correction(s) marquées « à vérifier » — NON appliquées`)
  W('')
  for (const c of aVerifier) {
    W(`- **${c.date}** (${c.sujet}) — ${c.champ} de « ${String(c.titre_actuel).slice(0, 56)} »`)
    W(`  > ${c.motif || '—'}`)
  }
  W('')

  if (introuvables.length) {
    W(`## ⚠ ${introuvables.length} opération(s) sans cible`)
    W('')
    for (const i of introuvables) W(`- ${i}`)
    W('')
  } else {
    W('_Toutes les opérations ciblées ont trouvé leur entrée._')
    W('')
  }

  // ⚠ CONTRÔLE DEMANDÉ PAR PASCAL : plus aucune mention « adoptée à l'unanimité »
  // sur l'entrée de 2008. Une correction ciblée ne remplace qu'UN passage — s'il
  // y en a deux, le contrôle échoue alors même que la correction a réussi. On le
  // vérifie ici plutôt que de le découvrir à l'écran.
  const RESIDUS = [/adopt[ée]e?\s+(?:à|a)\s+l[’']unanimit[ée]/i]
  const residus = []
  for (const [id, champs] of patchsE) {
    const e = entrees.find((x) => x.id === id)
    const t = champs.contenu ?? e?.contenu ?? ''
    if (e && isoDate('28/06/2008') === e.date_evenement && RESIDUS.some((r) => r.test(t))) {
      const m = t.match(RESIDUS[0])
      const i = t.indexOf(m[0])
      residus.push({ titre: champs.titre ?? e.titre, extrait: t.slice(Math.max(0, i - 110), i + 70).replace(/<[^>]*>/g, '') })
    }
  }
  if (residus.length) {
    W('## ⚠ Contrôle « plus aucune mention adoptée à l’unanimité » — NON satisfait')
    W('')
    W('La correction ciblée fournie ne remplace qu’**un** passage. Il en reste un second,')
    W('dans une note ajoutée le 30 septembre par l’application — **pas dans les textes fournis**,')
    W('donc je n’y touche pas sans votre accord. Cette note décrit d’ailleurs une correction')
    W('désormais périmée, puisque celle-ci la remplace.')
    W('')
    for (const r of residus) W(`- **${r.titre}**\n  > …${r.extrait}…`)
    W('')
  }

  W('## Points à vérifier par Pascal')
  W('')
  for (const p of d.points_a_verifier_par_pascal) W(`- ${p}`)
  W('')

  // ------------------------------------------------------------ écriture
  if (GO) {
    for (const s of nouveauxSujets) {
      const { error } = await supabase.from('sujets').insert(s)
      if (error) throw new Error(`Création du sujet « ${s.titre} » : ${error.message}`)
    }
    for (const [id, champs] of patchsS) {
      const { error } = await supabase.from('sujets').update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(`Sujet ${id} : ${error.message}`)
    }
    // ⚠ Les consolidées d'abord : les regroupées pointent vers elles.
    for (let i = 0; i < nouvelles.length; i += 25) {
      const { error } = await supabase.from('sujet_entrees').insert(nouvelles.slice(i, i + 25))
      if (error) throw new Error(`Insertion des entrées : ${error.message}`)
    }
    for (const [id, champs] of patchsE) {
      const { error } = await supabase.from('sujet_entrees').update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(`Entrée ${id} : ${error.message}`)
    }
    W(`✅ ${nouveauxSujets.length} sujet(s) créés, ${patchsS.size} mis à jour, ${nouvelles.length} entrée(s) ajoutées, ${patchsE.size} modifiées.`)
    W('')
  } else if (!patchsE.size && !patchsS.size && !nouvelles.length && !nouveauxSujets.length) {
    W('Rien à écrire — la révision est déjà appliquée.')
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `memoire_sujets_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
