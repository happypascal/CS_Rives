#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────────────
// RETRAIT DU DRAPEAU « adresse à confirmer » POSÉ À TORT PAR LA REPRISE
//
// Pascal, 22 octobre 2026, devant l'écran : « il n'y a pas d'adresse à
// confirmer ».
//
// La reprise du matin posait `adresse_a_verifier` sur TOUT second détenteur,
// au motif que son adresse venait de la fiche du lot et non de lui. Le fait est
// exact, mais la conclusion était fausse : ces personnes sont, dans leur
// quasi-totalité, des conjoints qui habitent la MÊME maison dans le
// lotissement. Cette adresse EST leur demeure au sens de l'article 28, et un
// recommandé les y atteint. Quinze injonctions sans objet sur un écran où
// chaque ligne doit appeler une action — et le bruit tue la liste.
//
// ⚠ LA COLONNE RESTE, et le contrôle qui en faisait un manque a été retiré.
// Elle constate un fait — cette adresse n'a pas été déclarée par cette
// personne — et la fiche l'affiche discrètement. Ce fait ne devient un manque
// que si l'intéressé vit ailleurs, ce que le registre ne sait pas. On constate,
// on ne reproche pas.
//
// ⚠ ON NE TOUCHE QUE CE QUE LA REPRISE A POSÉ : les lignes dont les
// observations portent encore sa note. Une marque posée à la main depuis,
// sur quelqu'un qui vit réellement ailleurs, doit survivre — sinon ce script
// effacerait un constat juste en corrigeant un constat faux.
//
// Usage :
//   node scripts/corriger_adresses_a_verifier_2026-10-22.mjs        essai à blanc
//   node scripts/corriger_adresses_a_verifier_2026-10-22.mjs --go   écrit
// ──────────────────────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')
const GO = process.argv.includes('--go')

// La note que la reprise a écrite dans `observations`. C'est elle qui identifie
// ses propres lignes, à défaut de quoi on ne saurait pas distinguer un drapeau
// automatique d'un drapeau posé par le bureau.
const NOTE_REPRISE = 'Reprise automatique du 22 octobre 2026'

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

const { data: titulaires, error } = await supabase.from('titulaires').select('*')
if (error) { console.error(`❌ Lecture de \`titulaires\` : ${error.message}`); process.exit(1) }
const { data: periodes } = await supabase.from('proprietaires').select('id,lot_id')
const { data: lots } = await supabase.from('lots').select('id,numero')
const numeroDe = (t) => {
  const p = (periodes || []).find((x) => x.id === t.proprietaire_id)
  return (lots || []).find((l) => l.id === p?.lot_id)?.numero || '?'
}

const marques = titulaires.filter((t) => t.adresse_a_verifier)
const aEffacer = marques.filter((t) => (t.observations || '').includes(NOTE_REPRISE))
const aGarder = marques.filter((t) => !(t.observations || '').includes(NOTE_REPRISE))

const lignes = []
const W = (s = '') => lignes.push(s)
const horodatage = new Date().toISOString()
W(`# Adresses « à confirmer » — ${GO ? 'ÉCRITURE' : 'essai à blanc'}`)
W('')
W(`_${horodatage}_`)
W('')
W('> ⚠ **DONNÉES PERSONNELLES** — `export/` est git-ignoré.')
W('')
W(`${marques.length} titulaire(s) portent le drapeau · **${aEffacer.length} posés par la reprise** `
  + `· ${aGarder.length} posés à la main (conservés).`)
W('')
W('| Parcelle | Titulaire | Rôle | Sort |')
W('|---|---|---|---|')
for (const t of marques) {
  const nom = [t.civilite, t.prenom, t.nom].filter(Boolean).join(' ')
  const sort = aEffacer.includes(t) ? 'drapeau retiré' : '**conservé** (posé à la main)'
  W(`| ${numeroDe(t)} | ${nom} | ${t.role} | ${sort} |`)
}
W('')

let faits = 0
if (GO && aEffacer.length) {
  const jour = horodatage.replace(/[:.]/g, '-').slice(0, 19)
  const dir = join(RACINE, 'backup', `adresses-a-verifier-${jour}`)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'titulaires.json'), JSON.stringify(titulaires, null, 2), 'utf8')
  W(`Sauvegarde : \`backup/adresses-a-verifier-${jour}\``)
  W('')
  for (const t of aEffacer) {
    // ⚠ On retire AUSSI la phrase de la reprise qui annonçait la confirmation,
    // sinon les observations continueraient de réclamer ce que l'écran ne
    // demande plus. Le reste de la note est conservé.
    const obs = (t.observations || '')
      .replace(' Adresse postale reprise de la fiche du lot, à faire confirmer par l’intéressé (art. 28).', '')
      .trim() || null
    const { error: e } = await supabase.from('titulaires')
      .update({ adresse_a_verifier: false, observations: obs }).eq('id', t.id)
    if (e) { W(`> ⚠ ${numeroDe(t)} — ${t.nom} : ${e.message}`); continue }
    faits += 1
  }
  W(`**${faits} drapeau(x) retiré(s).**`)
  W('')
}

W('---')
W('')
W(GO
  ? `**${faits} retirés · ${aGarder.length} conservés.**`
  : `**Essai à blanc : ${aEffacer.length} à retirer · ${aGarder.length} conservés. Rien n’a été écrit.**`)
W('')

await mkdir(join(RACINE, 'export'), { recursive: true })
const nom = `adresses_a_verifier_${horodatage.replace(/[:.]/g, '-').slice(0, 19)}${GO ? '' : '-essai'}.md`
await writeFile(join(RACINE, 'export', nom), lignes.join('\n'), 'utf8')
console.log(`Rapport : export/${nom}`)
console.log(GO ? `${faits} retirés · ${aGarder.length} conservés.`
  : `${aEffacer.length} à retirer · ${aGarder.length} conservés (essai à blanc).`)
