// CORRECTIONS DES RÉSOLUTIONS ARCHIVÉES, après confrontation aux résumés par année.
//
// ⚠ CE QUI A TROUVÉ CES ERREURS. La base a été remplie depuis le registre
// consolidé (`lire_registre_ag.py`). La vérifier avec ce même registre n'aurait
// rien prouvé. Les 25 `Resume_AG_<date>.docx` sont une SECONDE rédaction des
// mêmes procès-verbaux ; les 151 résolutions qu'ils reprennent ont été
// confrontées ligne à ligne à la base. Quatre contradictions sur 151 — et les
// quatre sont du côté de la base.
//
// ---------------------------------------------------------------------------
// 1. TROIS EFFECTIFS RANGÉS DANS UNE COLONNE DE VOIX (AG du 26 juin 2004)
// ---------------------------------------------------------------------------
// Le registre écrit, dans la colonne « Pour » :
//     « 40 copropriétaires totalisent 4100 / 5100 tantièmes »
// `nombre()` retient le PREMIER nombre de la cellule — règle juste partout
// ailleurs (« 3 200 sur 3 400 tantièmes ») et fausse ici : elle a stocké 40, un
// nombre de PERSONNES, dans une colonne qui compte des VOIX, l'unité de 2004
// étant « votes en voix, sur 5 100 ». Deux ordres de grandeur d'écart, et une
// résolution adoptée à l'unanimité qui affichait 40 voix sur 5 100.
//
// ⚠ Le fonds entier a été balayé à la recherche de cette forme : ces trois
// lignes sont les SEULES. Partout ailleurs le premier nombre est bien la voix.
// Vérifié, pas supposé — et `lire_registre_ag.py` est corrigé pour ne plus la
// produire si l'import est rejoué.
//
// ---------------------------------------------------------------------------
// 2. UNE LACUNE PRÉSENTÉE COMME UN RÉSULTAT (AG du 2 juillet 1988)
// ---------------------------------------------------------------------------
// La page du PV qui relatait le vote sur le maintien des règles d'urbanisme du
// lotissement (loi du 6 janvier 1986) est ABSENTE du PDF. Le détail de la ligne
// le dit en toutes lettres — « Résultat inconnu : NE PAS considérer comme adopté
// ni rejeté sans la page manquante » — mais la colonne « résultat » portait
// « Information », qui affirme que le point n'appelait pas de vote.
//
// C'est la faute que tout ce registre s'interdit : un null dit « le PV ne le dit
// pas », un zéro dit « personne n'a voté ainsi ». Ici un libellé disait
// « rien à voter » là où la source dit « on ne sait pas ». Le résumé par année
// l'écrit correctement : « Inconnu (page manquante) ».
//
// ---------------------------------------------------------------------------
// CE QUI N'EST PAS CORRIGÉ, ET POURQUOI
// ---------------------------------------------------------------------------
// ⚠ « Adoptée (unanimité) » côté base contre « Adoptée » côté résumé n'est pas
// une contradiction : la base en dit plus. On ne rabote pas une source parce
// qu'une autre est plus brève.
//
// ⚠ La base porte 237 résolutions là où les résumés en reprennent 151. Aucune ne
// manque à la base : les résumés écartent délibérément l'élection du bureau, les
// comptes, le quitus, les budgets courants et la désignation du syndic. Le fonds
// garde le tout — un registre d'archives ne choisit pas ce qui mérite mémoire.
//
// ⚠ IDEMPOTENT : rien n'est écrit qui ne change vraiment.
//
// Usage :
//   node scripts/corriger_resolutions_archives.mjs        essai à blanc
//   node scripts/corriger_resolutions_archives.mjs --go   écrit

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// ⚠ Chaque correction est désignée par (date de séance, numéro de résolution) et
// porte la VALEUR ATTENDUE AVANT : si la base a changé entre-temps, la
// correction est refusée plutôt qu'appliquée à l'aveugle. Un script de
// correction qui écrase sans vérifier est un script de destruction.
const CORRECTIONS = [
  {
    date_ag: '2004-06-26', numero: '5', champ: 'pour', avant: 40, apres: 4100,
    raison: 'Effectif (40 copropriétaires) stocké au lieu des voix (4 100).',
  },
  {
    date_ag: '2004-06-26', numero: '8.1', champ: 'pour', avant: 41, apres: 4200,
    raison: 'Effectif (41 copropriétaires) stocké au lieu des voix (4 200).',
  },
  {
    date_ag: '2004-06-26', numero: '8.2', champ: 'pour', avant: 41, apres: 4200,
    raison: 'Effectif (41 copropriétaires) stocké au lieu des voix (4 200).',
  },
  {
    date_ag: '1988-07-02', numero: 'V (IV de la convocation)', champ: 'resultat',
    avant: 'Information', apres: 'Inconnu (page manquante)',
    raison: 'La page du PV manque ; le détail le dit déjà. « Information » affirmait un fait inconnu.',
  },
]

async function lireEnvFichier() {
  try {
    const texte = await readFile(join(RACINE, '.env.export'), 'utf8')
    const out = {}
    for (const ligne of texte.split('\n')) {
      // ⚠ Échappés, jamais écrits en clair : une espace insécable ou un
      // séparateur de ligne recopiés tels quels dans une classe de caractères
      // sont invisibles à la relecture — et une relecture qui ne voit pas ce
      // qu'elle lit ne vérifie rien.
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
  W(`# Corrections des résolutions archivées — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W('Issues de la confrontation aux 25 résumés par année (151 résolutions relues).')
  W('')
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const dates = [...new Set(CORRECTIONS.map((c) => c.date_ag))]
  const { data: archives, error } = await supabase
    .from('pv_archives').select('id, date_ag, intitule, resolutions').in('date_ag', dates)
  if (error) throw new Error(`Lecture du fonds : ${error.message}`)

  const aEcrire = new Map()
  const refus = []
  W('| Séance | N° | Champ | Avant | Après | Raison |')
  W('|---|---|---|---|---|---|')

  for (const c of CORRECTIONS) {
    const a = archives.find((x) => x.date_ag === c.date_ag)
    if (!a) { refus.push(`${c.date_ag} — assemblée introuvable au fonds.`); continue }

    const courantes = aEcrire.get(a.id) || structuredClone(a.resolutions || [])
    const r = courantes.find((x) => String(x.numero).trim() === c.numero)
    if (!r) { refus.push(`${c.date_ag} n°${c.numero} — résolution introuvable.`); continue }

    if (r[c.champ] === c.apres) { W(`| ${c.date_ag} | ${c.numero} | ${c.champ} | — | déjà corrigé | ${c.raison} |`); continue }
    if (r[c.champ] !== c.avant) {
      refus.push(`${c.date_ag} n°${c.numero} — ${c.champ} vaut ${JSON.stringify(r[c.champ])}, attendu ${JSON.stringify(c.avant)}. Correction NON appliquée.`)
      continue
    }

    r[c.champ] = c.apres
    aEcrire.set(a.id, courantes)
    W(`| ${c.date_ag} | ${c.numero} | ${c.champ} | ${JSON.stringify(c.avant)} | ${JSON.stringify(c.apres)} | ${c.raison} |`)
  }
  W('')

  if (refus.length) {
    W('## ⚠ Corrections refusées')
    W('')
    for (const m of refus) W(`- ${m}`)
    W('')
  }

  if (!aEcrire.size) {
    W('Rien à écrire.')
  } else if (GO) {
    for (const [id, resolutions] of aEcrire) {
      const { error: e } = await supabase.from('pv_archives')
        .update({ resolutions, updated_at: new Date().toISOString() }).eq('id', id)
      if (e) throw new Error(`Écriture de ${id} : ${e.message}`)
    }
    W(`✅ ${aEcrire.size} assemblée(s) corrigée(s).`)
    W('')
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `resolutions_corrections_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (refus.length) process.exitCode = 1
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
