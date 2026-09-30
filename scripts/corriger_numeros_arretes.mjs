// LES NUMÉROS DES ARRÊTÉS PRÉFECTORAUX, ET LA 2e CONSULTATION.
//
// Exécute `BRIEF_numeros_arretes_consultation_2026-09-30.md`. Les numéros
// inscrits dans la mémoire (5184-55, 7955-56, 5835-61) viennent d'une mauvaise
// lecture ; Claude les a vérifiés sur l'IMAGE des actes : 3184-55, 755-56,
// 583-61. Et pour la consultation du 17 avril 2025, l'application retenait pour
// les colotis la colonne « D'accord TOTAL » mais pour les superficies la colonne
// « D'accord » seule — deux colonnes différentes dans la même phrase.
//
// ⚠ CES NUMÉROS ÉTAIENT DÉJÀ SIGNALÉS. La révision du 30 septembre au matin les
// portait en `a_verifier`, et ils n'avaient donc PAS été corrigés : « une
// correction marquée à vérifier ne s'applique pas, elle est seulement listée ».
// C'est ce signalement qui a déclenché la vérification sur les actes. Le
// garde-fou a servi exactement à ce qu'il était fait.
//
// =============================================================================
// SEULEMENT DES REMPLACEMENTS CIBLÉS
// =============================================================================
// ⚠ On remplace LA CHAÎNE `ancien` PAR `nouveau`, dans le champ indiqué, et rien
// d'autre. Pas de réécriture de texte, pas de reformulation : le reste de
// l'entrée — sa date, son auteur, ses pièces jointes, ses autres paragraphes —
// n'est pas touché.
//
// ⚠ EXACTEMENT UNE OCCURRENCE, sinon on n'écrit pas. Zéro : la correction est
// peut-être déjà faite (on le vérifie) ou la cible a changé. Plusieurs : on ne
// sait pas laquelle viser, et remplacer la première serait un tirage au sort.
// Dans les deux cas, on le dit et on passe.
//
// ⚠ LE REMPLACEMENT TRAVERSE LES BALISES. Le texte stocké est du HTML produit
// par l'éditeur riche : la chaîne cherchée peut y être coupée par un `<strong>`,
// y compris AU MILIEU D'UN MOT. Un `includes` n'y voit rien — c'est ainsi qu'une
// correction a échoué en silence le 30 septembre au matin.
//
// =============================================================================
// ET UNE RECHERCHE GLOBALE, EN LECTURE SEULE
// =============================================================================
// ⚠ Les numéros faux peuvent traîner ailleurs que dans les sept cibles. On les
// cherche PARTOUT — sujets, entrées, décisions du conseil, commentaires,
// paramètres — et on liste ce qui reste SANS Y TOUCHER : corriger à l'aveugle
// une occurrence qu'on n'a pas vérifiée serait refaire l'erreur d'origine.
//
// ⚠ `sujets.historique` EST EXCLU, et c'est le contraire d'un oubli : il garde
// les versions ANTÉRIEURES des synthèses. Elles doivent contenir les vieux
// numéros — c'est leur raison d'être. Les « corriger » effacerait la trace de
// ce qui a été corrigé.
//
// Usage :
//   node scripts/corriger_numeros_arretes.mjs        essai à blanc
//   node scripts/corriger_numeros_arretes.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')
const SOURCE = join(RACINE, 'scripts', 'data', 'numeros_arretes_consultation_2026-09-30.json')

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }

// Liaison à une décision du conseil : textuelle, faute de clé étrangère (v1).
const LIEE_A_UNE_DECISION = /\b20\d{2}-\d{3}\b|d[ée]cision\s+(?:du\s+conseil|n[°o])/i

// ⚠ Tolérante aux apostrophes et tirets typographiques : la base porte « — » et
// « ’ » là où le fichier de données peut porter « - » et « ' ».
const norm = (t) => String(t ?? '')
  .replace(/\s*_\(.*?\)_\s*$/, '')
  .normalize('NFD').replace(/[\u0300-\u036F]/g, '')
  .toLowerCase()
  .replace(/[\u2018\u2019']/g, "'")
  .replace(/[\u2013\u2014-]/g, '-')
  .replace(/\s+/g, ' ')
  .trim()

const ECHAPPE = /[.*+?^${}()|[\]\\]/g
/**
 * Le motif d'une chaîne, tolérant aux balises HTML entre deux caractères.
 * ⚠ La tolérance se met ENTRE les caractères, jamais après le dernier : accolée
 * à chacun, elle est gourmande et avale la balise fermante qui suit.
 */
const motifDe = (texte) => new RegExp([...String(texte).trim()]
  .map((c) => (/\s/.test(c) ? '(?:<[^>]*>|\\s|&nbsp;)+' : c.replace(ECHAPPE, '\\$&')))
  .join('(?:<[^>]*>)*'), 'g')

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
    for (const d of (await readdir(join(RACINE, 'backup'))).filter((x) => x.startsWith(jour)).sort().reverse()) {
      try {
        await readFile(join(RACINE, 'backup', d, 'sujets.json'))
        await readFile(join(RACINE, 'backup', d, 'sujet_entrees.json'))
        return d
      } catch { /* sauvegarde partielle */ }
    }
  } catch { /* pas de dossier backup */ }
  return null
}

async function main() {
  W(`# Numéros des arrêtés et 2e consultation — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
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
  const { data: sujets, error: eS } = await supabase.from('sujets').select('id, titre, resume, contenu, historique')
  if (eS) throw new Error(`Lecture des sujets : ${eS.message}`)
  const { data: entrees, error: eE } = await supabase.from('sujet_entrees')
    .select('id, sujet_id, date_evenement, titre, contenu, resultat, documents, auteur_id')
  if (eE) throw new Error(`Lecture des entrées : ${eE.message}`)
  const total0 = entrees.length
  W(`État de départ : **${sujets.length} sujets · ${total0} entrées**.`)
  W('')

  // ------------------------------------------------- les 7 corrections
  const patchs = new Map()
  const refus = []
  const bloquees = []
  let nFaites = 0, nDeja = 0

  W('## Les 7 corrections')
  W('')
  W('| Sujet | Date | Champ | Avant | Après | État |')
  W('|---|---|---|---|---|---|')

  for (const c of d.corrections_entrees) {
    const sujet = sujets.find((x) => x.titre === c.sujet)
    const dire = (etat) => W(`| ${c.sujet} | ${c.date} | ${c.champ} | \`${c.ancien.slice(0, 34)}\` | \`${c.nouveau.slice(0, 34)}\` | ${etat} |`)
    if (!sujet) { refus.push(`Sujet « ${c.sujet} » introuvable.`); dire('❌ sujet introuvable'); continue }

    const cands = entrees.filter((e) => e.sujet_id === sujet.id && e.date_evenement === c.date)
    const cible = cands.find((e) => norm(e.titre) === norm(c.titre_actuel))
      || cands.find((e) => norm(e.titre).startsWith(norm(c.titre_actuel)))
      || cands.find((e) => norm(e.titre).includes(norm(c.titre_actuel)))
    if (!cible) {
      // ⚠ UNE CORRECTION DE TITRE SE REND ELLE-MÊME INTROUVABLE. Au second
      // passage, `titre_actuel` porte l'ANCIEN numéro — que l'on vient
      // précisément de remplacer. L'entrée n'a pas disparu : elle a le nouveau
      // titre. Sans ce test, relancer signalait trois « entrées introuvables »
      // qui n'étaient que la preuve du succès du premier passage.
      const attendu = norm(c.titre_actuel).replace(norm(c.ancien), norm(c.nouveau))
      if (c.champ === 'titre' && cands.some((e) => norm(e.titre).startsWith(attendu))) {
        nDeja++; dire('déjà appliquée'); continue
      }
      refus.push(`« ${String(c.titre_actuel).slice(0, 48)} » (${c.date}, ${c.sujet}) : entrée introuvable parmi ${cands.length} à cette date.`)
      dire('❌ entrée introuvable'); continue
    }

    // Valeur courante : une correction précédente peut déjà l'avoir modifiée.
    const courant = patchs.get(cible.id)?.[c.champ === 'titre' ? 'titre' : 'contenu']
      ?? (c.champ === 'titre' ? cible.titre : cible.contenu) ?? ''

    // ⚠ Déjà appliquée ? On cherche la valeur NOUVELLE avant de crier au manque.
    if ([...String(courant).matchAll(motifDe(c.nouveau))].length > 0) { nDeja++; dire('déjà appliquée'); continue }

    const trouvees = [...String(courant).matchAll(motifDe(c.ancien))]
    if (trouvees.length === 0) {
      refus.push(`« ${String(c.titre_actuel).slice(0, 48)} » (${c.date}) : la chaîne « ${c.ancien.slice(0, 40)}… » est absente. Rien n’a été écrit.`)
      dire('❌ chaîne absente'); continue
    }
    if (trouvees.length > 1) {
      refus.push(`« ${String(c.titre_actuel).slice(0, 48)} » (${c.date}) : la chaîne « ${c.ancien.slice(0, 40)}… » apparaît ${trouvees.length} fois — on ne sait pas laquelle viser. Rien n’a été écrit.`)
      dire(`❌ ${trouvees.length} occurrences`); continue
    }

    // ⚠ Une entrée liée à une décision du conseil ne s'écrase pas.
    if (LIEE_A_UNE_DECISION.test(`${cible.titre} ${cible.contenu}`)) {
      bloquees.push(`« ${cible.titre.slice(0, 48)} » (${c.date}) : liée à une décision du conseil — correction ajoutée en commentaire, texte d’origine conservé.`)
      const avec = (patchs.get(cible.id)?.contenu ?? cible.contenu ?? '')
        + `<hr><p><em>Correction proposée le 30 septembre 2026, non appliquée (entrée liée à une décision) : « ${c.ancien} » devient « ${c.nouveau} ».</em></p>`
      patchs.set(cible.id, { ...(patchs.get(cible.id) || {}), contenu: avec })
      dire('⚠ en commentaire'); continue
    }

    const remplace = String(courant).replace(motifDe(c.ancien), c.nouveau)
    patchs.set(cible.id, {
      ...(patchs.get(cible.id) || {}),
      [c.champ === 'titre' ? 'titre' : 'contenu']: remplace,
    })
    nFaites++
    dire('✅ à écrire')
  }
  W('')
  W(`**${nFaites} correction(s) à écrire** · ${nDeja} déjà appliquée(s) · ${refus.length} refusée(s).`)
  W('')

  if (refus.length) {
    W('## ⚠ Refusées — rien n’a été écrit pour celles-ci')
    W('')
    for (const r of refus) W(`- ${r}`)
    W('')
  }
  if (bloquees.length) {
    W('## ⚠ Liées à une décision du conseil')
    W('')
    for (const b of bloquees) W(`- ${b}`)
    W('')
  } else {
    W('_Aucune entrée visée ne cite une décision du conseil._')
    W('')
  }

  // ------------------------------------------------------- écriture
  if (GO && patchs.size) {
    for (const [id, champs] of patchs) {
      const { error } = await supabase.from('sujet_entrees')
        .update({ ...champs, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw new Error(`Entrée ${id} : ${error.message}`)
    }
    W(`✅ ${patchs.size} entrée(s) écrite(s).`)
    W('')
  } else if (!patchs.size) {
    W('Rien à écrire.')
    W('')
  }

  // --------------------------------- recherche globale, LECTURE SEULE
  // ⚠ Relue APRÈS écriture : le rapport doit dire ce qui reste, pas ce qui
  // restait avant. Sinon il signale des occurrences qu'on vient de corriger.
  const apres = GO
    ? (await supabase.from('sujet_entrees').select('id, sujet_id, date_evenement, titre, contenu, resultat')).data
    : entrees
  const sujetsApres = GO
    ? (await supabase.from('sujets').select('id, titre, resume, contenu')).data
    : sujets
  const { data: decisions } = await supabase.from('decisions').select('numero, titre, description')
  const { data: parametres } = await supabase.from('parametres').select('cle, valeur')
  const { data: archives } = await supabase.from('pv_archives').select('date_ag, commentaire')

  const trouvailles = []
  const chercher = (chaine, ou, quoi, texte) => {
    if (texte && String(texte).includes(chaine)) trouvailles.push({ chaine, ou, quoi })
  }
  for (const chaine of d.chaines_a_rechercher_partout) {
    for (const s of sujetsApres || []) {
      chercher(chaine, `sujet « ${s.titre} »`, 'résumé', s.resume)
      chercher(chaine, `sujet « ${s.titre} »`, 'synthèse', s.contenu)
    }
    for (const e of apres || []) {
      const t = (sujetsApres || []).find((x) => x.id === e.sujet_id)?.titre || '?'
      chercher(chaine, `entrée ${e.date_evenement} (${t})`, 'titre', e.titre)
      chercher(chaine, `entrée ${e.date_evenement} (${t})`, 'texte', e.contenu)
      chercher(chaine, `entrée ${e.date_evenement} (${t})`, 'résultat', e.resultat)
    }
    for (const x of decisions || []) {
      chercher(chaine, `décision ${x.numero}`, 'titre', x.titre)
      chercher(chaine, `décision ${x.numero}`, 'description', x.description)
    }
    for (const x of parametres || []) chercher(chaine, `paramètre ${x.cle}`, 'valeur', x.valeur)
    for (const x of archives || []) chercher(chaine, `archive ${x.date_ag}`, 'commentaire', x.commentaire)
  }

  W(`## Recherche globale — ${trouvailles.length} occurrence(s) restante(s)`)
  W('')
  W('Lecture seule : rien n’est corrigé ici. `sujets.historique` est exclu — il garde les')
  W('versions antérieures, qui doivent contenir les anciens numéros.')
  W('')
  W('| Chaîne cherchée | Où | Champ |')
  W('|---|---|---|')
  for (const c of d.chaines_a_rechercher_partout) {
    const l = trouvailles.filter((t) => t.chaine === c)
    if (!l.length) { W(`| \`${c}\` | — | *aucune* |`); continue }
    for (const t of l) W(`| \`${c}\` | ${t.ou} | ${t.quoi} |`)
  }
  W('')

  // ⚠ L'historique est compté à part : y trouver les vieux numéros est la preuve
  // que l'historique fait son travail, pas un défaut.
  const dansHistorique = (sujets || []).reduce((n, s) => n
    + d.chaines_a_rechercher_partout.filter((c) => JSON.stringify(s.historique || []).includes(c)).length, 0)
  W(`_Pour mémoire : ${dansHistorique} occurrence(s) dans \`sujets.historique\` — attendues, non touchées._`)
  W('')

  const totalFin = (apres || []).length
  W(`Entrées : **${total0} avant → ${totalFin} après** — ${total0 === totalFin ? 'inchangé ✅' : '**⚠ ÉCART**'}`)
  W('')

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `numeros_arretes_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (refus.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
