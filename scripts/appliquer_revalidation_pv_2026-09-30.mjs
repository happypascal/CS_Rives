// REVALIDATION DES ARCHIVES DE PV — 30 septembre 2026.
//
// Exécute `BRIEF_corrections_pv_archives_2026-09-30.md`. Les 39 PV ont été relus
// sur l'IMAGE de chaque page, sans OCR : 21 erreurs, 139 imprécisions, 21 doutes
// et 4 omissions. Cause principale — des décisions relatées sans formule de vote
// ni décompte (« l'assemblée considère », « prend acte et entérine », « donne
// mission », « il est décidé ») étaient qualifiées « Adoptée ».
//
// =============================================================================
// CE QUE CE SCRIPT ÉCRIT, ET CE QU'IL NE TOUCHE JAMAIS
// =============================================================================
// ⚠ L'EN-TÊTE EST INTOUCHABLE : président, scrutateur, secrétaire/syndic, quorum,
// lieu, unité des votes, note. Le nom du syndic et le lieu ont été corrigés À LA
// MAIN dans l'application ; les réécrire depuis le JSON effacerait ce travail.
// Le JSON les contient pourtant — c'est précisément pourquoi il faut l'écrire
// ici : une source qui porte un champ invite toujours à l'importer.
//
// Seules quatre valeurs par résolution viennent du JSON : NUMÉRO, SUJET,
// DÉCISION, RÉSULTAT DU VOTE.
//
// =============================================================================
// ⚠ LE JSON EST LE RÉSUMÉ (207 lignes), LA BASE EST LE REGISTRE (303)
// =============================================================================
// C'est l'écart le plus lourd de conséquences, et il n'est pas décrit par le
// brief. Le JSON ne reprend pas les points de routine ni la plupart des lignes
// « Information » : remplacer la liste à l'identique SUPPRIMERAIT 96 lignes —
// par exemple, pour 2007, le rappel du jugement du 12 mai 2005, le ponton de la
// plage et la dégradation des voies par les camions ; pour 2008, l'entretien des
// entrées de villas et la liquidation de l'astreinte.
//
// ⚠ Certaines de ces lignes sont CITÉES PAR LA MÉMOIRE DU LOTISSEMENT (le ponton
// de 2007 est une entrée du sujet « Plage »). Les faire disparaître du registre
// laisserait la mémoire renvoyer à des faits que le fonds ne porte plus.
//
// ARBITRAGE DE PASCAL (2026-09-30) : mode CONSERVATION. Les 96 lignes restent —
// mais elles ne restent pas TELLES QUELLES : la revalidation les a corrigées
// aussi. Leur résultat et leur objet sont donc repris du REGISTRE CORRIGÉ
// (`1_AG/_travail_registre_2026-09-28/json/<clé>.json`), qui incorpore les 118
// corrections « Registre » du journal. Sans cela, on garderait des lignes
// justement pour les laisser fausses — neuf d'entre elles passent de « Adoptée »
// ou « Information » à « Décision sans vote formel ».
//
// `--strict` reste disponible : remplacement littéral, les 96 lignes partent.
//
// ⚠ LE DÉTAIL N'EST JAMAIS RÉÉCRIT — ni depuis le résumé, ni depuis le registre.
// Il porte 299 textes rédigés, et Pascal les corrigera à la main.
// ⚠ MAIS UN DÉTAIL PEUT CONTREDIRE SON PROPRE RÉSULTAT : « adopté à l'unanimité »
// sous une ligne devenue « Décision sans vote formel ». Le rapport les NOMME
// toutes, une par une. Les taire reviendrait à corriger la colonne qu'on regarde
// et à laisser mentir celle qu'on lit.
//
// ⚠ LES VOIX CHIFFRÉES SONT RELUES depuis `resultat_vote` quand il les porte
// (« Pour 75 540 · Contre 16 606 · Abst. 0 »). Le texte devient la source ; les
// nombres en sont dérivés, jamais conservés en contradiction avec lui.
//
// ⚠ `au_resume` EST PERDUE À L'ÉCRITURE et doit être reposée :
// `completer_depuis_resumes_ag.mjs` après ce script. Le rapport le rappelle.
//
// =============================================================================
// SAUVEGARDE
// =============================================================================
// ⚠ `--go` REFUSE d'écrire sans une sauvegarde DU JOUR dans `backup/`. Ce n'est
// pas une politesse : ce script réécrit 303 lignes de résolutions d'un coup.
//
// Usage :
//   node scripts/appliquer_revalidation_pv_2026-09-30.mjs            essai
//   node scripts/appliquer_revalidation_pv_2026-09-30.mjs --strict   essai, mode littéral
//   node scripts/appliquer_revalidation_pv_2026-09-30.mjs --go       écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const STRICT = process.argv.includes('--strict')
const SOURCE = join(RACINE, 'scripts', 'data', 'resumes_pv_archives_2026-09-30.json')
const SYNTHESE_PDF = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/1_AG/Synthese_AG_Rives_par_sujet.pdf'
const CLE_SYNTHESE = 'pv_archives_synthese'
const REGISTRE_CORRIGE = '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/1_AG/_travail_registre_2026-09-28/json'
// ⚠ Un résultat qui ne commence ni par « Adoptée » ni par « Rejetée » n'est PAS
// une décision votée (règle du brief, §3) : c'est là que le détail peut mentir.
const VOTEE = /^(adoptee|rejetee)/
// Les mots qui, dans un détail, affirment un vote.
const AFFIRME_UN_VOTE = /unanimit|adopt|rejet|mise[s]? aux voix|scrutin|majorit[ée] (?:requise |n[ée]cessaire )?(?:de |des )?\d/i
const BUCKET = 'documents'

// ⚠ Les champs d'en-tête du JSON sont listés pour être IGNORÉS explicitement.
// Les nommer coûte une ligne et évite qu'un lecteur pressé les importe « puisque
// la source les a ».
// ⚠ TROIS DÉTAILS CORRIGÉS À LA DEMANDE DE PASCAL (2026-09-30), sur les neuf
// contradictions signalées par l'essai. Les six autres sont cohérentes et ne
// doivent PAS être touchées — c'est lui qui a tranché, ligne par ligne.
// ⚠ Chaque correction porte son texte ATTENDU AVANT : si le détail a changé,
// elle est refusée plutôt qu'appliquée à l'aveugle.
const DETAILS = [
  {
    date_ag: '2016-09-03', numero: '14', mode: 'ajouter',
    // La provision de 10 000 € est déclarée adoptée alors que l'article 25
    // exigeait 2 551 voix : le détail doit porter le chiffre, pas seulement la
    // mention d'une irrégularité.
    texte: 'Déclarée adoptée avec 2 500 voix sur 5 100 alors que la majorité de l’article 25 exigeait 2 551 voix ; aucun second vote n’est mentionné.',
  },
  {
    date_ag: '2005-06-18', numero: '6.2', mode: 'remarque',
    avant: "Déclarée 'SANS OBJET' suite au rejet de 6.1.",
    texte: 'Sans objet : conséquence du rejet de la provision spéciale (6.1).',
  },
  {
    date_ag: '2013-06-29', numero: '10', mode: 'remarque',
    avant: 'Sans objet (provision spéciale rejetée)',
    texte: 'Sans objet au PV : la provision spéciale ayant été rejetée, son placement n’est pas mis aux voix.',
  },
]

const ENTETE_IGNOREE = ['president', 'scrutateur', 'secretaire_foncia', 'quorum',
  'lieu', 'unite_des_votes', 'note', 'titre', 'type_ag', 'annee_exercice']

const norm = (t) => String(t ?? '').normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * « Pour 75 540 · Contre 16 606 · Abst. 0 » → { pour, contre, abstention }.
 * ⚠ Rend `null` sur tout ce qui n'est pas chiffré (« Unanimité (non chiffré) »,
 * « Inconnu », « — ») : un zéro serait une défaite, un null est une lacune.
 */
function voixChiffrees(texte) {
  const lire = (motif) => {
    const m = new RegExp(`${motif}\\s*:?\\s*([\\d][\\d\\s\\u00A0\\u202F.]*)`, 'i').exec(String(texte || ''))
    if (!m) return null
    const n = Number(m[1].replace(/[^\d]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return { pour: lire('Pour'), contre: lire('Contre'), abstention: lire('Abst\\.?') }
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

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

/** Une sauvegarde faite AUJOURD'HUI existe-t-elle ? */
async function sauvegardeDuJour() {
  const jour = new Date().toISOString().slice(0, 10)
  try {
    const dirs = await readdir(join(RACINE, 'backup'))
    return dirs.filter((d) => d.startsWith(jour)).sort().pop() || null
  } catch { return null }
}

async function main() {
  W(`# Revalidation des archives de PV du 30 septembre 2026 — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W(`Mode : **${STRICT ? 'STRICT — remplacement littéral de la liste' : 'CONSERVATION — les lignes absentes du JSON sont gardées'}**.`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const sauvegarde = await sauvegardeDuJour()
  W(sauvegarde
    ? `Sauvegarde du jour : \`backup/${sauvegarde}\`.`
    : '⚠ **Aucune sauvegarde du jour dans `backup/`.** `--go` sera refusé.')
  W('')
  if (GO && !sauvegarde) throw new Error('Sauvegarde du jour absente : lancer `node scripts/backup.mjs` d’abord.')

  const json = JSON.parse(await readFile(SOURCE, 'utf8'))

  // ⚠ LE REGISTRE CORRIGÉ, indexé par DATE de séance — jamais par nom de fichier :
  // les clés sont « 2008 » mais aussi « 1996-07 », « 2026-01 ». La date est la
  // seule chose que les trois sources nomment pareil.
  const registre = new Map()
  for (const f of await readdir(REGISTRE_CORRIGE)) {
    if (!f.endsWith('.json')) continue
    try {
      const d = JSON.parse(await readFile(join(REGISTRE_CORRIGE, f), 'utf8'))
      if (d?.date && Array.isArray(d.decisions)) registre.set(d.date, d.decisions)
    } catch { /* un fichier de travail qui n'est pas une assemblée */ }
  }
  W(`Registre corrigé : ${registre.size} assemblée(s) lue(s) dans \`${REGISTRE_CORRIGE.split('/').slice(-4).join('/')}\`.`)
  W('')
  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, date_ag, annee, intitule, resolutions').order('date_ag')
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)
  const parDate = new Map(archives.filter((a) => a.date_ag).map((a) => [a.date_ag, a]))

  // ------------------------------------------------- archives à créer
  const aCreer = json.filter((a) => !parDate.has(a.date_ag))
  W('## Archives à créer')
  W('')
  if (!aCreer.length) {
    W('**Aucune.** Le brief en annonce quatre (21/07/1990, 30/07/1994, 29/07/1995, 28/06/1997) :')
    W('elles ont été créées le 29 septembre, avec leur document scanné, leur lieu et leur en-tête.')
    W('Elles sont donc traitées ici comme les autres — mise à jour, pas création.')
  } else {
    for (const a of aCreer) W(`- ${a.date_ag} — ${a.titre}`)
    W('')
    W('⚠ Une archive créée ici n’aurait **aucun document scanné** : `pv_archives.document` est `not null`.')
    W('Passer par `importer_pv_archives.mjs`, qui dépose le PDF au Storage.')
  }
  W('')

  // ------------------------------------------------------ les résolutions
  const maj = []
  const supprimables = []
  const corrigeesRegistre = []
  const contradictions = []
  const horsRegistre = []
  const detailsCorriges = []
  const detailsRefuses = []
  let nRemplacees = 0, nDetailsGardes = 0, nDetailsPerdus = 0, nChiffrees = 0

  for (const a of json) {
    const cible = parDate.get(a.date_ag)
    if (!cible) continue
    const anciennes = cible.resolutions || []
    const restantes = [...anciennes]

    const nouvelles = a.resolutions.map((r) => {
      // ⚠ APPARIEMENT EN DEUX TEMPS. Le NUMÉRO d'abord : les sujets ont été
      // réécrits par la revalidation, s'apparier sur eux serait d'autant plus
      // faux que la correction est importante.
      // ⚠ Puis l'INTITULÉ, parce que la revalidation RENUMÉROTE aussi. Sans ce
      // repli, la ligne de 1988 — « V (IV de la convocation) » devenue
      // « V présumé (IV de la convocation) » — n'était pas retrouvée : son détail
      // était perdu et, en mode conservation, l'ancienne ligne SURVIVAIT à côté
      // de la nouvelle. Un doublon silencieux dans un registre légal, né d'un
      // mot ajouté à un numéro.
      let i = restantes.findIndex((x) => norm(x.numero) === norm(r.numero))
      if (i === -1) i = restantes.findIndex((x) => norm(x.objet) === norm(r.sujet))
      const ancienne = i > -1 ? restantes.splice(i, 1)[0] : null
      if (ancienne?.detail) nDetailsGardes++; else nDetailsPerdus++
      const v = voixChiffrees(r.resultat_vote)
      if (v.pour != null || v.contre != null || v.abstention != null) nChiffrees++
      nRemplacees++
      return {
        numero: r.numero,
        objet: r.sujet,
        // ⚠ CONSERVÉ : le brief remplace quatre champs, `detail` n'en est pas.
        detail: ancienne?.detail ?? null,
        resultat: r.decision,
        ...v,
        // Le texte du résumé devient la source ; les nombres en sont dérivés.
        voix_texte: { pour: r.resultat_vote || '—', contre: '—', abstention: '—' },
      }
    })

    // ------------------ ce que le résumé ne reprend pas : le REGISTRE corrigé
    // ⚠ Ces lignes restent au fonds, mais la revalidation les a corrigées elles
    // aussi. On reprend leur RÉSULTAT et leur OBJET du registre corrigé — sans
    // quoi on les garderait justement pour les laisser fausses.
    const corr = registre.get(a.date_ag) || []
    if (restantes.length) {
      const dispo = [...corr]
      const gardees = restantes.map((x) => {
        // Appariement par numéro puis par objet, comme ci-dessus et pour la
        // même raison : la revalidation touche aux deux.
        let k = dispo.findIndex((c) => norm(c.num) === norm(x.numero) && norm(c.objet) === norm(x.objet))
        if (k === -1) k = dispo.findIndex((c) => norm(c.objet) === norm(x.objet))
        if (k === -1) k = dispo.findIndex((c) => norm(c.num) === norm(x.numero))
        const c = k > -1 ? dispo.splice(k, 1)[0] : null
        if (!c) { horsRegistre.push({ date: a.date_ag, ligne: x }); return { ...x, au_resume: undefined } }
        const avant = { numero: x.numero, objet: x.objet, resultat: x.resultat }
        // ⚠ LE NUMÉRO SUIT AUSSI (Pascal, 2026-09-30). Deux lignes de 2013
        // portaient « 13 » alors que le PV les range sous « Annexes », une
        // rubrique distincte : garder « 13 » les faisait lire comme une suite du
        // point 13, qui est un simple rappel sur le bruit.
        const ligne = {
          ...x,
          numero: c.num ?? x.numero,
          objet: c.objet ?? x.objet,
          resultat: c.resultat ?? x.resultat,
        }
        delete ligne.au_resume
        if (norm(avant.resultat) !== norm(ligne.resultat) || norm(avant.objet) !== norm(ligne.objet)
          || norm(avant.numero) !== norm(ligne.numero)) {
          corrigeesRegistre.push({
            date: a.date_ag, numero: [avant.numero, ligne.numero],
            resultat: [avant.resultat, ligne.resultat],
            objet: [avant.objet, ligne.objet],
          })
        }
        return ligne
      })
      supprimables.push({ date: a.date_ag, intitule: cible.intitule, lignes: restantes })
      if (!STRICT) nouvelles.push(...gardees.map(({ au_resume: _m, ...reste }) => reste))
    }

    // ------------------------------------ les trois détails corrigés à la main
    // ⚠ APRÈS la reconstruction de la liste : le détail a été repris de l'ancienne
    // ligne, c'est donc ici qu'il est à jour et modifiable.
    for (const d of DETAILS.filter((x) => x.date_ag === a.date_ag)) {
      const l = nouvelles.find((x) => norm(x.numero) === norm(d.numero))
      if (!l) { detailsRefuses.push(`${d.date_ag} n°${d.numero} : ligne introuvable.`); continue }
      const ancien = l.detail || ''
      let nouveau
      if (d.mode === 'ajouter') {
        if (ancien.includes(d.texte)) continue
        nouveau = `${ancien.trim()} ${d.texte}`.trim()
      } else {
        // ⚠ On remplace le texte de la remarque EXISTANTE, repéré par sa valeur
        // attendue : réécrire tout le détail perdrait l'objet et la majorité.
        if (!ancien.includes(d.avant)) {
          if (ancien.includes(d.texte)) continue
          detailsRefuses.push(`${d.date_ag} n°${d.numero} : la remarque attendue « ${d.avant} » ne figure pas dans le détail. Rien n’a été touché.`)
          continue
        }
        nouveau = ancien.replace(d.avant, d.texte)
      }
      detailsCorriges.push({ date: a.date_ag, numero: d.numero, mode: d.mode, avant: ancien, apres: nouveau })
      l.detail = nouveau
    }

    // ⚠ UN DÉTAIL QUI CONTREDIT SON RÉSULTAT. On ne le réécrit pas — Pascal le
    // fera à la main — mais on le NOMME : « adopté à l'unanimité » sous une ligne
    // devenue « Décision sans vote formel » est exactement le genre de phrase
    // qu'on lit sans vérifier la colonne d'à côté.
    for (const l of nouvelles) {
      if (VOTEE.test(norm(l.resultat))) continue
      if (!l.detail || !AFFIRME_UN_VOTE.test(l.detail)) continue
      contradictions.push({ date: a.date_ag, numero: l.numero, resultat: l.resultat, objet: l.objet, detail: l.detail })
    }

    const change = JSON.stringify(nouvelles) !== JSON.stringify(anciennes.map(({ au_resume: _m, ...r }) => r))
    if (change) maj.push({ cible, nouvelles, avant: anciennes })
  }

  W('## Ce qui change, assemblée par assemblée')
  W('')
  W('| Assemblée | Lignes avant | Lignes après | Résolutions réécrites | Hors résumé |')
  W('|---|---|---|---|---|')
  for (const m of maj) {
    const hors = supprimables.find((s) => s.date === m.cible.date_ag)?.lignes.length || 0
    const duJson = json.find((x) => x.date_ag === m.cible.date_ag).resolutions.length
    W(`| ${m.cible.date_ag} — ${m.cible.intitule} | ${m.avant.length} | ${m.nouvelles.length} | ${duJson} | ${hors || '—'} |`)
  }
  W('')
  W(`**${maj.length} archive(s) à mettre à jour · ${nRemplacees} résolution(s) réécrites.**`)
  W(`Détails rédigés conservés : ${nDetailsGardes} · perdus (ligne non retrouvée) : ${nDetailsPerdus}.`)
  W(`Voix chiffrées relues depuis le texte du résumé : ${nChiffrees}.`)
  W('')

  // --------------------------------------- ce que le JSON ne reprend pas
  const totalHors = supprimables.reduce((n, s) => n + s.lignes.length, 0)
  W(`## ⚠ ${totalHors} ligne(s) du registre absentes du résumé`)
  W('')
  W(STRICT
    ? '**Mode STRICT : elles seront SUPPRIMÉES.** Les voici, nommées.'
    : '**Mode CONSERVATION : elles sont GARDÉES.** Les voici, pour que le choix soit éclairé.')
  W('')
  for (const s of supprimables) {
    W(`- **${s.date}** — ${s.lignes.map((l) => `n°${l.numero} « ${String(l.objet).slice(0, 62)} » *(${l.resultat})*`).join(' ; ')}`)
  }
  W('')

  // ------------------------- les lignes conservées, corrigées par le registre
  W(`## ${corrigeesRegistre.length} ligne(s) conservée(s) corrigée(s) par le registre revalidé`)
  W('')
  if (!corrigeesRegistre.length) {
    W('Aucune : les lignes hors résumé étaient déjà conformes au registre corrigé.')
  } else {
    W('| Assemblée | N° | Résultat avant | Résultat après | Objet réécrit |')
    W('|---|---|---|---|---|')
    for (const c of corrigeesRegistre) {
      const objetChange = norm(c.objet[0]) !== norm(c.objet[1])
      const num = norm(c.numero[0]) !== norm(c.numero[1]) ? `${c.numero[0]} → **${c.numero[1]}**` : c.numero[1]
      W(`| ${c.date} | ${num} | ${c.resultat[0]} | ${norm(c.resultat[0]) !== norm(c.resultat[1]) ? `**${c.resultat[1]}**` : '*(inchangé)*'} | ${objetChange ? `« ${String(c.objet[1]).slice(0, 70)} »` : '—'} |`)
    }
  }
  W('')
  if (horsRegistre.length) {
    W(`⚠ ${horsRegistre.length} ligne(s) conservée(s) **introuvables au registre corrigé**, laissées telles quelles :`)
    W('')
    for (const h of horsRegistre) W(`- ${h.date} — n°${h.ligne.numero} « ${String(h.ligne.objet).slice(0, 70)} » *(${h.ligne.resultat})*`)
    W('')
  }

  // ------------------------------------------- les trois détails corrigés
  W(`## ${detailsCorriges.length} détail(s) corrigé(s) à la demande de Pascal`)
  W('')
  if (!detailsCorriges.length) {
    W('Aucun — déjà appliqués.')
  } else {
    for (const d of detailsCorriges) {
      W(`**${d.date} — n°${d.numero}** *(${d.mode === 'ajouter' ? 'phrase ajoutée' : 'remarque remplacée'})*`)
      W('')
      W(`- Avant : ${d.avant.replace(/\s+/g, ' ')}`)
      W(`- Après : ${d.apres.replace(/\s+/g, ' ')}`)
      W('')
    }
  }
  if (detailsRefuses.length) {
    W('⚠ **Refusés** :')
    W('')
    for (const r of detailsRefuses) W(`- ${r}`)
    W('')
  }

  // ------------------------------- les détails qui contredisent leur résultat
  W(`## ⚠ ${contradictions.length} détail(s) qui contredisent leur nouveau résultat`)
  W('')
  W('**Non réécrits** — à corriger à la main. Le détail affirme un vote là où le résultat')
  W('n’en constate plus : c’est la phrase qu’on lit sans vérifier la colonne d’à côté.')
  W('')
  if (!contradictions.length) {
    W('Aucun.')
  } else {
    let dateCourante = null
    for (const c of contradictions) {
      if (c.date !== dateCourante) { W(''); W(`**${c.date}**`); dateCourante = c.date }
      const extrait = c.detail.replace(/\s+/g, ' ').slice(0, 190)
      W(`- n°${c.numero} — *${c.resultat}* — « ${String(c.objet).slice(0, 56)} »`)
      W(`  > ${extrait}${c.detail.length > 190 ? '…' : ''}`)
    }
  }
  W('')

  // ------------------------------------------------------- la synthèse
  W('## Document de synthèse')
  W('')
  const info = await stat(SYNTHESE_PDF).catch(() => null)
  const { data: param } = await supabase.from('parametres').select('valeur').eq('cle', CLE_SYNTHESE).maybeSingle()
  const actuel = param?.valeur ? JSON.parse(param.valeur) : null
  if (!info) {
    W(`⚠ \`${SYNTHESE_PDF}\` introuvable — la synthèse ne sera pas remplacée.`)
  } else {
    W(`- Actuelle : ${actuel?.name || '—'} (${actuel ? Math.round(actuel.size / 1024) : 0} ko, déposée le ${actuel?.uploaded_at?.slice(0, 10) || '—'})`)
    W(`- Nouvelle : Synthese_AG_Rives_par_sujet.pdf (${Math.round(info.size / 1024)} ko, fichier du ${info.mtime.toISOString().slice(0, 10)})`)
    W('')
    W('⚠ L’ancien objet **n’est pas supprimé** du Storage : même règle que « Retirer » dans les')
    W('formulaires — un fichier orphelin de quelques centaines de kilooctets coûte moins cher')
    W('qu’une synthèse introuvable si l’on veut revenir en arrière.')
  }
  W('')

  // ----------------------------------------------------------- écriture
  if (GO) {
    for (const m of maj) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ resolutions: m.nouvelles, updated_at: new Date().toISOString() }).eq('id', m.cible.id)
      if (e) throw new Error(`Écriture de « ${m.cible.intitule} » : ${e.message}`)
    }
    W(`✅ ${maj.length} archive(s) mise(s) à jour.`)

    if (info) {
      const path = `pv-archives/synthese/${randomUUID()}.pdf`
      const { error: eU } = await supabase.storage.from(BUCKET)
        .upload(path, await readFile(SYNTHESE_PDF), { contentType: 'application/pdf', upsert: false })
      if (eU) throw new Error(`Envoi de la synthèse : ${eU.message}`)
      const doc = {
        id: randomUUID(), path, name: 'Synthese_AG_Rives_par_sujet.pdf',
        type: 'application/pdf', size: info.size, uploaded_at: new Date().toISOString(),
      }
      const { error: eP } = await supabase.from('parametres')
        .upsert({ cle: CLE_SYNTHESE, valeur: JSON.stringify(doc), updated_at: new Date().toISOString() })
      if (eP) throw new Error(`Écriture du paramètre : ${eP.message}`)
      W('✅ Synthèse remplacée.')
    }
    W('')
    W('⚠ **À FAIRE MAINTENANT** : `node scripts/completer_depuis_resumes_ag.mjs --go` —')
    W('la marque `au_resume` est partie avec les résolutions réécrites.')
    W('')
  }

  W(`> Champs d’en-tête du JSON délibérément ignorés : ${ENTETE_IGNOREE.join(', ')}.`)
  W('')

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `revalidation_pv_${stamp}${GO ? '' : '-essai'}${STRICT ? '-strict' : ''}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
