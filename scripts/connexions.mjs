// QUI UTILISE L'APPLICATION, ET QUAND — lu directement chez Supabase.
//
// Pascal (2026-09-30) : « je veux un log des connexions à l'application ».
//
// ⚠ CE N'EST PAS UN JOURNAL, C'EST UN ÉTAT. Supabase ne conserve pas l'historique
// des connexions accessible depuis l'extérieur : il garde deux dates par compte,
// écrasées à chaque fois. On ne saura donc jamais par ici COMBIEN de fois
// quelqu'un est venu, ni quand exactement — seulement la dernière.
// Un vrai journal demanderait une table à nous, écrite à l'ouverture de session.
// Écarté le 2026-09-30 : `onAuthStateChange` se déclenche à chaque chargement de
// page et à chaque renouvellement de jeton (environ une fois par heure), si bien
// qu'un journal branché dessus sans dédoublonnage écrirait quarante lignes par
// jour pour une seule visite. Un journal qui ment est pire que pas de journal.
//
// =============================================================================
// LES DEUX DATES NE DISENT PAS LA MÊME CHOSE — c'est tout l'objet de ce script
// =============================================================================
// ⚠ `last_sign_in_at` = la dernière fois que le MOT DE PASSE a été saisi. La
// session reste ouverte dans le navigateur et Supabase la renouvelle en silence :
// on peut donc utiliser l'application tous les jours pendant des mois sans que
// cette date bouge.
//
// ⚠ C'EST L'ERREUR QUE J'AI COMMISE le 2026-09-30, et elle a failli coûter deux
// relances pour rien : cette date affirmait que deux membres n'étaient pas venus
// depuis le 19 juillet, alors que l'un s'était connecté la veille au soir.
//
// ⚠ `updated_at` suit le renouvellement du jeton, donc de près l'ouverture de
// l'application. C'est le bon indicateur — mais un INDICATEUR, pas une preuve :
// il bouge aussi sur un changement de mot de passe ou une écriture dans les
// métadonnées (la mention RGPD du registre, par exemple).
//
// =============================================================================
// ⚠ DONNÉES PERSONNELLES, ET CLÉ QUI CONTOURNE LA RLS
// =============================================================================
// Ce script lit `auth.users` par l'API d'administration : il lui faut la clé
// `service_role`, celle qui contourne toute la sécurité. Elle n'a rien à faire
// dans un navigateur — c'est pourquoi ceci est un SCRIPT et non un écran de
// l'application, et pourquoi le résultat ne doit pas être transmis.
//
// Usage :
//   node scripts/connexions.mjs
//   node scripts/connexions.mjs --md   rapport horodaté dans export/

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const MD = process.argv.includes('--md')

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

const quand = (d) => (d
  ? new Date(d).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
  : 'jamais')

/** « il y a 3 jours » — ce qu'on lit vraiment dans un tableau de suivi.
 *
 * ⚠ ON COMPTE DES JOURS DE CALENDRIER, PAS DES HEURES ÉCOULÉES. Premier jet :
 * une connexion d'hier 20h, vue à 18h le lendemain, faisait 22 heures — donc
 * « zéro jour », donc « aujourd'hui ». Le tableau affirmait qu'un membre était
 * venu aujourd'hui alors qu'il était venu la veille. Une date fausse d'un jour
 * dans un tableau de suivi, c'est exactement ce qu'on ne relit jamais.
 */
function depuis(d) {
  if (!d) return '—'
  const minuit = (x) => { const y = new Date(x); y.setHours(0, 0, 0, 0); return y.getTime() }
  const j = Math.round((minuit(Date.now()) - minuit(d)) / 86400000)
  if (j <= 0) return "aujourd'hui"
  if (j === 1) return 'hier'
  if (j < 31) return `il y a ${j} jours`
  const m = Math.floor(j / 30)
  return `il y a ${m} mois`
}

const { data, error } = await supabase.auth.admin.listUsers()
if (error) { console.error(`❌ ${error.message}`); process.exit(1) }

// ⚠ Le lien entre un compte Auth et un membre est l'E-MAIL, qui doit
// correspondre exactement (modèle d'identité du projet). Un compte sans membre
// est une anomalie à voir, pas une ligne à masquer.
const { data: membres } = await supabase.from('membres_cs').select('email, prenom, nom, role, actif')
const nommer = (u) => {
  const m = (membres || []).find((x) => x.email && x.email.toLowerCase() === String(u.email).toLowerCase())
  if (!m) return { nom: `${u.email} ⚠ sans membre`, role: '—', actif: null }
  return { nom: `${m.prenom} ${m.nom}`, role: m.role, actif: m.actif }
}

const lignes = data.users
  .map((u) => ({ ...nommer(u), email: u.email, sign: u.last_sign_in_at, vu: u.updated_at, cree: u.created_at }))
  .sort((a, b) => String(b.vu).localeCompare(String(a.vu)))

const out = []
const W = (s) => { out.push(s); console.log(s) }

W('# Utilisation de l’application')
W('')
W(`Au ${new Date().toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })} · ${lignes.length} compte(s).`)
W('')
W('| Membre | Rôle | Dernière activité | | Mot de passe saisi |')
W('|---|---|---|---|---|')
for (const l of lignes) {
  W(`| ${l.nom}${l.actif === false ? ' *(inactif)*' : ''} | ${l.role} | ${quand(l.vu)} | ${depuis(l.vu)} | ${quand(l.sign)} |`)
}
W('')
W('⚠ **« Dernière activité »** suit le renouvellement du jeton, donc de près l’ouverture de')
W('l’application. C’est un indicateur, pas une preuve : il bouge aussi sur un changement de')
W('mot de passe ou une écriture dans les métadonnées.')
W('')
W('⚠ **« Mot de passe saisi »** n’est PAS la dernière visite : la session reste ouverte dans le')
W('navigateur et se renouvelle en silence. On peut venir tous les jours sans que cette date bouge.')
W('')

// ⚠ Ce qui mérite d'être signalé, et rien de plus : une liste d'alertes qui
// s'allume pour tout le monde ne se lit plus (leçon des dossiers du fonds).
const jamais = lignes.filter((l) => !l.vu)
const dormants = lignes.filter((l) => l.vu && (Date.now() - new Date(l.vu).getTime()) > 60 * 86400000)
const orphelins = lignes.filter((l) => l.role === '—')
if (jamais.length || dormants.length || orphelins.length) {
  W('## À regarder')
  W('')
  for (const l of jamais) W(`- **${l.nom}** ne s’est **jamais** connecté (compte créé le ${quand(l.cree)}).`)
  for (const l of dormants) W(`- **${l.nom}** : aucune activité depuis ${depuis(l.vu)}.`)
  for (const l of orphelins) W(`- **${l.email}** : compte Auth sans membre correspondant dans \`membres_cs\`.`)
  W('')
} else {
  W('_Tous les comptes sont actifs et rattachés à un membre._')
  W('')
}
W('⚠ Données personnelles : ne pas transmettre ce tableau hors du conseil.')

if (MD) {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `connexions_${stamp}.md`)
  await writeFile(chemin, out.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
}
