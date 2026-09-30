// L'AG 2008 N'A PAS DÉCIDÉ DE FERMER LE LOTISSEMENT — CORRECTION DE LA MÉMOIRE.
//
// Pascal (2026-09-30) : « le point 9 de l'AG 2008 n'a pas décidé de fermer le
// lotissement mais au contraire de garder la situation actuelle. Il faut
// corriger partout ».
//
// =============================================================================
// L'ERREUR, ET D'OÙ ELLE VIENT
// =============================================================================
// Le registre consolidé avait repris l'intitulé de l'ORDRE DU JOUR — « Point sur
// le dossier relatif à l'éventuelle fermeture du lotissement ou toute autre
// solution visant à la sécurisation de la résidence » — abrégé en « Fermeture du
// lotissement / sécurisation de la résidence ».
//
// ⚠ Accolé à « Adoptée à l'unanimité », cet intitulé fait lire L'INVERSE du
// vote. Le procès-verbal dit : « l'assemblée générale décide unanimement LE
// MAINTIEN DE LA SITUATION ACTUELLE », faute de garantie que le ramassage des
// ordures ménagères continuerait d'entrer dans le lotissement en cas de
// fermeture.
//
// ⚠ LE DÉTAIL ÉTAIT JUSTE DEPUIS LE DÉBUT. C'est le TITRE qui mentait — et dans
// un tableau comme dans une chronologie, c'est le titre qu'on lit. Un intitulé
// doit nommer la DÉCISION, jamais la question posée. Une erreur de titre est plus
// dangereuse qu'une erreur de contenu : elle se propage sans être relue.
//
// =============================================================================
// « PARTOUT », C'EST TROIS ENDROITS
// =============================================================================
//  1. `pv_archives` — l'intitulé de la résolution. ⚠ Corrigé AILLEURS, dans
//     `corriger_resolutions_archives.mjs`, et c'est délibéré : l'import des
//     résumés RÉÉCRIT les résolutions depuis le registre, donc toute correction
//     posée hors de ce script serait effacée au prochain passage de la chaîne.
//  2. L'ENTRÉE DE CHRONOLOGIE du sujet « Portails et fermeture du lotissement »,
//     dont le titre était recopié de l'intitulé fautif.
//  3. LA SYNTHÈSE de ce même sujet, qui écrivait « Le principe d'une fermeture
//     est adopté en 2008 » — la phrase la plus fausse de tout le sujet, puisque
//     c'est celle qu'on lit en premier.
//
// ⚠ Rien ne réécrit la mémoire : ces deux corrections-ci n'ont pas besoin de
// survivre à une chaîne, elles sont définitives.
//
// ⚠ CHAQUE ÉCRITURE PORTE SA VALEUR ATTENDUE AVANT : si le texte a changé
// entre-temps, la correction est refusée plutôt qu'appliquée à l'aveugle.
//
// Usage :
//   node scripts/corriger_memoire_fermeture_2008.mjs        essai à blanc
//   node scripts/corriger_memoire_fermeture_2008.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

const SUJET = 'Portails et fermeture du lotissement'
const DATE = '2008-06-28'

const ANCIEN_TITRE = 'Fermeture du lotissement / sécurisation de la résidence'
const NOUVEAU_TITRE = 'L’assemblée refuse de fermer le lotissement et maintient la situation actuelle'

const NOUVEAU_CONTENU = [
  '<p>Résolution n° 9, <strong>adoptée à l’unanimité</strong> — mais ce qui est adopté, c’est <strong>le maintien de la situation actuelle</strong>, et non la fermeture.</p>',
  '<p>Le syndic et le conseil syndical avaient instruit le dossier pendant l’année écoulée : réunions avec l’entreprise ayant chiffré l’automatisation des portails, et avec une société de surveillance.</p>',
  '<p>⚠ <strong>Motif du refus</strong> : aucune garantie qu’en cas de fermeture, les services de ramassage des ordures ménagères continueraient à entrer dans le lotissement.</p>',
  '<p>Le procès-verbal précise que <strong>le portail peut être fermé manuellement lors des passages</strong>.</p>',
  '<p><em>Source : procès-verbal de l’assemblée générale ordinaire 2008, résolution n° 9.</em></p>',
  '<p><em>⚠ Corrigé le 30 septembre 2026 : l’intitulé repris du registre — « Fermeture du lotissement / sécurisation de la résidence », qui était en réalité la question portée à l’ordre du jour — laissait croire, accolé à « adoptée à l’unanimité », que la fermeture avait été votée.</em></p>',
].join('')

// ⚠ On remplace la PHRASE, pas la synthèse entière : réécrire tout le paragraphe
// ferait perdre le reste, et un remplacement ciblé échoue franchement si le texte
// a bougé — ce qui est le comportement voulu.
const PHRASE_FAUSSE = 'Le principe d’une fermeture est adopté en 2008.'
const PHRASE_JUSTE = 'En 2008, après instruction du dossier par le conseil syndical, l’assemblée décide unanimement <strong>le maintien de la situation actuelle</strong> — faute de garantie sur le ramassage des ordures ménagères ; le portail reste fermable à la main.'

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

async function main() {
  W(`# AG 2008 : maintien de la situation actuelle — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const { data: sujet, error: eS } = await supabase.from('sujets')
    .select('id, titre, contenu').eq('titre', SUJET).maybeSingle()
  if (eS) throw new Error(`Lecture du sujet : ${eS.message}`)
  if (!sujet) throw new Error(`Sujet « ${SUJET} » introuvable.`)

  const refus = []

  // ------------------------------------------------- 1. l'entrée de 2008
  const { data: entrees } = await supabase.from('sujet_entrees')
    .select('id, titre, contenu').eq('sujet_id', sujet.id).eq('date_evenement', DATE)

  const cible = (entrees || []).find((e) => e.titre === ANCIEN_TITRE)
  const dejaFaite = (entrees || []).find((e) => e.titre === NOUVEAU_TITRE)

  W('## Entrée de chronologie du 28 juin 2008')
  W('')
  if (dejaFaite) {
    W('Déjà corrigée.')
  } else if (!cible) {
    refus.push(`Aucune entrée du ${DATE} intitulée « ${ANCIEN_TITRE} » : ${(entrees || []).length} entrée(s) à cette date. Rien n’a été touché.`)
  } else {
    W(`| Champ | Avant | Après |`)
    W(`|---|---|---|`)
    W(`| titre | ${ANCIEN_TITRE} | ${NOUVEAU_TITRE} |`)
    W(`| contenu | *(l’ancien texte parlait d’une fermeture décidée)* | *(le maintien de la situation actuelle, avec son motif)* |`)
    if (GO) {
      const { error } = await supabase.from('sujet_entrees')
        .update({ titre: NOUVEAU_TITRE, contenu: NOUVEAU_CONTENU, updated_at: new Date().toISOString() })
        .eq('id', cible.id)
      if (error) throw new Error(`Écriture de l’entrée : ${error.message}`)
      W('')
      W('✅ Entrée corrigée.')
    }
  }
  W('')

  // ---------------------------------------------------- 2. la synthèse
  W('## Synthèse du sujet')
  W('')
  if (sujet.contenu?.includes(PHRASE_JUSTE)) {
    W('Déjà corrigée.')
  } else if (!sujet.contenu?.includes(PHRASE_FAUSSE)) {
    refus.push(`La phrase « ${PHRASE_FAUSSE} » ne figure plus dans la synthèse : elle a été réécrite entre-temps. Rien n’a été touché.`)
  } else {
    W(`- **Avant** : ${PHRASE_FAUSSE}`)
    W(`- **Après** : ${PHRASE_JUSTE.replace(/<[^>]+>/g, '')}`)
    if (GO) {
      const { error } = await supabase.from('sujets')
        .update({ contenu: sujet.contenu.replace(PHRASE_FAUSSE, PHRASE_JUSTE), updated_at: new Date().toISOString() })
        .eq('id', sujet.id)
      if (error) throw new Error(`Écriture de la synthèse : ${error.message}`)
      W('')
      W('✅ Synthèse corrigée.')
    }
  }
  W('')

  if (refus.length) {
    W('## ⚠ Refusé')
    W('')
    for (const r of refus) W(`- ${r}`)
    W('')
  }

  W('> L’intitulé dans `pv_archives` est corrigé par `corriger_resolutions_archives.mjs` — là où il survit au ré-import des résumés.')
  W('')

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `correction_fermeture_2008_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (refus.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
