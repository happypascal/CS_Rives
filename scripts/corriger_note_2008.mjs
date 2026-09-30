// LA NOTE DE TRAÇABILITÉ DE L'ENTRÉE PORTAILS DU 28 JUIN 2008.
//
// Texte dicté par Pascal (2026-09-30), recopié mot pour mot.
//
// ⚠ POURQUOI UNE NOTE DE TRAÇABILITÉ SE RÉÉCRIT AUSSI. Celle qui était en place
// datait du 30 septembre au matin : elle expliquait que l'INTITULÉ repris du
// registre — « Fermeture du lotissement / sécurisation de la résidence » —
// laissait croire à un vote. La révision de la mémoire a depuis remplacé le
// titre ET le texte de l'entrée : la note décrivait donc une correction que plus
// rien ne portait, et renvoyait à un intitulé que l'entrée n'a plus. Une note
// périmée est pire qu'une note absente — elle a l'autorité d'une trace.
//
// ⚠ LE NOUVEAU TEXTE CITE « adoptée à l'unanimité », ET C'EST VOULU : il NOMME
// l'erreur pour l'expliquer, au lieu de la commettre. Même raison que les deux
// « résolution n° 10-2 » laissées en place — une mémoire doit pouvoir dire ce
// qui était faux sans qu'on la soupçonne de le répéter.
//
// ⚠ VALEUR ATTENDUE AVANT : si la note a changé entre-temps, la correction est
// refusée plutôt qu'appliquée à l'aveugle. Idempotent.
//
// Usage :
//   node scripts/corriger_note_2008.mjs        essai à blanc
//   node scripts/corriger_note_2008.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

const SUJET = 'Portails et fermeture du lotissement'
const DATE = '2008-06-28'

const ANCIENNE = '<p><em>⚠ Corrigé le 30 septembre 2026 : l’intitulé repris du registre — « Fermeture du lotissement / sécurisation de la résidence », qui était en réalité la question portée à l’ordre du jour — laissait croire, accolé à « adoptée à l’unanimité », que la fermeture avait été votée.</em></p>'

const NOUVELLE = '<p><em>⚠ Corrigé le 30 septembre 2026 : cette entrée présentait la décision comme « adoptée à l’unanimité ». Le procès-verbal (p. 5) ne contient aucun vote : il relate que l’assemblée « décide unanimement le maintien de la situation actuelle ». La fermeture n’a pas été votée.</em></p>'

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

const { data: sujet } = await supabase.from('sujets').select('id').eq('titre', SUJET).maybeSingle()
if (!sujet) { console.error(`❌ Sujet « ${SUJET} » introuvable.`); process.exit(1) }

const { data: entrees, error } = await supabase.from('sujet_entrees')
  .select('id, titre, contenu, regroupee_sous').eq('sujet_id', sujet.id).eq('date_evenement', DATE)
if (error) { console.error(`❌ ${error.message}`); process.exit(1) }

// ⚠ On ne vise QUE l'entrée affichée : une regroupée porterait la même date.
const cible = (entrees || []).find((e) => !e.regroupee_sous && String(e.contenu).includes(ANCIENNE))
const dejaFaite = (entrees || []).find((e) => String(e.contenu).includes(NOUVELLE))

console.log(`# Note de traçabilité — Portails, ${DATE} — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
console.log('')
if (dejaFaite) {
  console.log('Déjà corrigée — rien à faire.')
  process.exit(0)
}
if (!cible) {
  console.error('❌ La note attendue ne figure pas dans l’entrée : elle a changé entre-temps. Rien n’a été touché.')
  process.exit(1)
}

console.log(`Entrée : « ${cible.titre} »`)
console.log('')
console.log('- Avant :', ANCIENNE.replace(/<[^>]*>/g, ''))
console.log('')
console.log('- Après :', NOUVELLE.replace(/<[^>]*>/g, ''))
console.log('')

if (!GO) {
  console.log('> ⚠ Aucune écriture. Relancer avec `--go`.')
  process.exit(0)
}

// ⚠ Le reste du texte n'est pas touché : on remplace le paragraphe, pas l'entrée.
const { error: e } = await supabase.from('sujet_entrees')
  .update({ contenu: cible.contenu.replace(ANCIENNE, NOUVELLE), updated_at: new Date().toISOString() })
  .eq('id', cible.id)
if (e) { console.error(`❌ ${e.message}`); process.exit(1) }
console.log('✅ Note remplacée. Le reste de l’entrée est inchangé.')
