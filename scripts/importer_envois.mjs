// IMPORT DE L'HISTORIQUE DES ENVOIS AUX COLOTIS (migration 056, lot A).
//
// Les messages collectifs partent par un AppleScript depuis Mail. Son journal
// est RÉÉCRIT À CHAQUE CAMPAGNE : sans import, il ne reste rien de ce qui a été
// envoyé, à qui, ni quand. Ce script lit le dossier d'envoi et inscrit la
// dernière campagne dans le registre.
//
// ⚠ IL NE PEUT RECONSTITUER QUE LA DERNIÈRE CAMPAGNE. C'est une limite du
// journal, pas du script : à lancer APRÈS CHAQUE ENVOI. Les campagnes
// antérieures ne survivent que dans `_OLD/`, et s'importeraient à la main.
//
// Mêmes garde-fous que les autres scripts du dépôt :
//   - essai à blanc par défaut, `--go` pour écrire ;
//   - idempotent : une campagne déjà importée est constatée, pas redoublée ;
//   - rapport écrit sur disque autant qu'en console.
//
// ⚠ PAS DE SAUVEGARDE EXIGÉE, contrairement à `corriger_memoire.mjs`, et c'est
// délibéré : celui-là RÉÉCRIT des lignes existantes, celui-ci n'INSÈRE que dans
// deux tables neuves. Exiger une sauvegarde là où le pire dégât se répare par un
// `delete` habituerait à passer outre le jour où elle protège vraiment.
//
// Usage :
//   node scripts/importer_envois.mjs                      essai à blanc
//   node scripts/importer_envois.mjs --go                 écrit
//   node scripts/importer_envois.mjs --dossier "<chemin>" --go
//   node scripts/importer_envois.mjs --inclure-essais     importe aussi modeTest
//   node scripts/importer_envois.mjs --archiver --go      copie les textes dans _OLD/

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, access, copyFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { emailsOfficiels } from '../src/lib/proprietaireLogic.js'
// ⚠ L'analyse du journal vit à part, SANS Supabase : c'est ce qui permet de la
// vérifier sur un vrai journal avant que la migration ne soit passée.
import { parserJournal, parserTsv } from './journal_envoi.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..')

const DOSSIER_DEFAUT =
  '/Users/pfa/Documents/_0_Privé/Maison/Nernier/_1_lotissement/4_ASL/7-contacts/'

const arg = (nom) => {
  const i = process.argv.indexOf(nom)
  return i > -1 ? process.argv[i + 1] : null
}
const GO = process.argv.includes('--go')
const INCLURE_ESSAIS = process.argv.includes('--inclure-essais')
const ARCHIVER = process.argv.includes('--archiver')
const DOSSIER = (arg('--dossier') || DOSSIER_DEFAUT).replace(/\/?$/, '/')

// ---------------------------------------------------------------- environnement
// ⚠ Les caractères invisibles (U+2028, BOM, espace insécable) se glissent dans
// un fichier écrit à la main et font échouer la lecture SANS message clair. Même
// nettoyage que dans les autres scripts.
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

const rapport = []
const W = (s) => { rapport.push(s); console.log(s) }
const soucis = []

// --------------------------------------------------- le compte expéditeur
// Best-effort : `compteExpediteur` vide veut dire « compte par défaut de Mail »,
// donc INCONNU. On préfère un champ nul à un nom inventé.
function lireExpediteur(applescript) {
  const m = applescript.match(/set\s+compteExpediteur\s+to\s+"([^"]*)"/)
  const v = m ? m[1].trim() : ''
  return v || null
}

async function existe(chemin) {
  try { await access(chemin); return true } catch { return false }
}

// ============================================================================
async function main() {
  W(`# Import des envois aux colotis — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  W(`> Dossier : \`${DOSSIER}\``)
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  // ------------------------------------------------------- 1. les fichiers
  const FICHIERS = {
    objet: 'Message_objet.txt',
    fr: 'Message_FR.txt',
    en: 'Message_EN.txt',
    tsv: 'Colotis_envoi.tsv',
    log: 'Envoi_colotis.log',
  }
  const manquants = []
  for (const f of Object.values(FICHIERS)) {
    if (!(await existe(join(DOSSIER, f)))) manquants.push(f)
  }
  if (manquants.length) {
    throw new Error(`Fichier(s) introuvable(s) dans ${DOSSIER} : ${manquants.join(', ')}`)
  }

  const lire = (f) => readFile(join(DOSSIER, f), 'utf8')
  const objetFichier = (await lire(FICHIERS.objet)).replace(/[\r\n]+$/, '').trim()
  const corpsFr = await lire(FICHIERS.fr)
  const corpsEn = await lire(FICHIERS.en)
  const tsv = parserTsv(await lire(FICHIERS.tsv))
  const journal = parserJournal(await lire(FICHIERS.log), soucis)

  // ⚠ Le chemin de l'AppleScript n'est pas dans la liste des fichiers exigés :
  // il n'apporte qu'un champ facultatif, et son absence ne doit pas bloquer un
  // import par ailleurs complet.
  const cheminScript = join(DOSSIER, 'Envoyer_message_colotis.applescript')
  const expediteur = (await existe(cheminScript)) ? lireExpediteur(await readFile(cheminScript, 'utf8')) : null

  // -------------------------------------------- 2. le texte est-il CELUI-LÀ ?
  //
  // ⚠ LE REFUS EST LE CŒUR DU SCRIPT. Les trois textes sont écrasés à la
  // préparation de la campagne suivante. Si l'objet du journal ne correspond
  // plus au fichier, les textes ont changé DEPUIS l'envoi : enregistrer
  // `Message_FR.txt` reviendrait à inscrire au registre un texte qui n'est pas
  // celui qui est parti. Mieux vaut pas d'historique qu'un faux historique.
  if (journal.objet !== objetFichier) {
    W('## Import refusé')
    W('')
    W('L’objet du journal ne correspond plus à `Message_objet.txt` : les textes ont changé depuis l’envoi.')
    W('')
    W(`- Journal  : « ${journal.objet} »`)
    W(`- Fichier  : « ${objetFichier} »`)
    W('')
    W('Le corps du message n’est donc plus celui qui est parti. Rien n’a été importé —')
    W('les textes de cette campagne se retrouvent peut-être dans `_OLD/`.')
    await ecrireRapport()
    process.exit(2)
  }

  // ------------------------------------------------------ 3. mode essai
  if (journal.modeTest && !INCLURE_ESSAIS) {
    W('## Campagne d’essai ignorée')
    W('')
    W(`Le journal porte \`modeTest = true\` (${journal.destinataires.length} destinataire(s)).`)
    W('Relancer avec `--inclure-essais` pour l’importer quand même, marquée comme essai.')
    await ecrireRapport()
    return
  }

  // ------------------------------------------------------- 4. idempotence
  const { data: deja, error: eSel } = await supabase
    .from('communications')
    .select('id, date_envoi, objet, nb_destinataires')
    .eq('date_envoi', journal.dateEnvoi)
    .eq('objet', journal.objet)
    .maybeSingle()
  if (eSel) throw new Error(`Lecture des campagnes : ${eSel.message}`)
  if (deja) {
    W('## Déjà importée')
    W('')
    W(`Campagne du ${journal.dateEnvoi} — « ${journal.objet} » : ${deja.nb_destinataires} destinataire(s).`)
    W('Rien n’a été écrit.')
    await ecrireRapport()
    return
  }

  // -------------------------------- 5. rapprochement avec le registre
  //
  // ⚠ On rapproche des CONTACTS OFFICIELS (migration 044), pas de la colonne
  // `email` : c'est à eux qu'on écrit. Une adresse absente est signalée et
  // laissée nulle — on ne crée jamais un propriétaire à cette occasion.
  const { data: proprios, error: eProp } = await supabase
    .from('proprietaires')
    .select('*')
    .is('date_cession', null)
  if (eProp) throw new Error(`Lecture du registre des propriétaires : ${eProp.message}`)

  const parEmailOfficiel = new Map()
  const parEmailConnu = new Map()
  for (const p of proprios || []) {
    for (const e of emailsOfficiels(p)) {
      if (e) parEmailOfficiel.set(e.trim().toLowerCase(), p)
    }
    // Toutes les adresses de la fiche, cochées ou non : sert à distinguer
    // « inconnue au registre » de « présente mais pas contact officiel ».
    for (const champ of ['email', 'email_2', 'dirigeant_email', 'dirigeant_email_2', 'mandataire_email']) {
      const v = (p[champ] || '').trim().toLowerCase()
      if (v) parEmailConnu.set(v, p)
    }
  }

  const lignes = []
  const nonRapproches = []
  const horsTsv = []
  for (const d of journal.destinataires) {
    const cle = d.email.trim().toLowerCase()
    const info = tsv.get(cle)
    if (!info) horsTsv.push(d.email)
    const officiel = parEmailOfficiel.get(cle) || null
    const connu = officiel || parEmailConnu.get(cle) || null
    if (!officiel) {
      nonRapproches.push({
        email: d.email,
        nom: info?.nom || null,
        // Deux cas très différents, et les confondre empêcherait d'agir :
        // « pas au registre » demande une vérification, « pas cochée » se
        // corrige d'un clic sur la fiche.
        raison: connu
          ? 'présente au registre, mais pas cochée comme contact officiel'
          : 'inconnue du registre des propriétaires',
      })
    }
    lignes.push({
      nom: info?.nom || null,
      email: d.email.trim(),
      langue: info?.langue || null,
      statut: d.statut,
      message_erreur: d.message_erreur,
      proprietaire_id: officiel?.id || null,
      rang: d.rang,
    })
  }

  // ------------------------------------------------------------ 6. cohérence
  if (journal.nbAnnonce != null && journal.nbAnnonce !== journal.destinataires.length) {
    soucis.push(`Le journal annonce ${journal.nbAnnonce} destinataires mais en détaille ${journal.destinataires.length}.`)
  }
  if (horsTsv.length) {
    soucis.push(`${horsTsv.length} adresse(s) du journal absente(s) de \`${FICHIERS.tsv}\` — nom et langue inconnus : ${horsTsv.join(', ')}`)
  }

  // ------------------------------------------------------------- 7. écriture
  W('## Campagne')
  W('')
  W('| | |')
  W('|---|---|')
  W(`| Date d’envoi | ${journal.dateEnvoi} |`)
  W(`| Objet | ${journal.objet} |`)
  W(`| Mode essai | ${journal.modeTest ? 'OUI' : 'non'} |`)
  W(`| Destinataires | ${lignes.length} |`)
  W(`| Envoyés | ${journal.nbEnvoyes} |`)
  W(`| Erreurs | ${journal.nbErreurs} |`)
  W(`| Expéditeur | ${expediteur || '— compte par défaut de Mail —'} |`)
  W(`| Rapprochés au registre | ${lignes.filter((l) => l.proprietaire_id).length} / ${lignes.length} |`)
  W('')

  if (GO) {
    const { data: campagne, error: eIns } = await supabase
      .from('communications')
      .insert({
        date_envoi: journal.dateEnvoi,
        objet: journal.objet,
        corps_fr: corpsFr,
        corps_en: corpsEn,
        canal: 'applescript_mail',
        mode_test: journal.modeTest,
        expediteur,
        nb_destinataires: lignes.length,
        nb_envoyes: journal.nbEnvoyes,
        nb_erreurs: journal.nbErreurs,
        source_fichier: join(DOSSIER, FICHIERS.log),
      })
      .select()
      .single()
    if (eIns) throw new Error(`Insertion de la campagne : ${eIns.message}`)

    const { error: eDest } = await supabase
      .from('communication_destinataires')
      .insert(lignes.map((l) => ({ ...l, communication_id: campagne.id })))
    if (eDest) {
      // ⚠ Une campagne sans destinataires serait pire qu'aucune campagne : elle
      // dirait « envoyé à personne ». On la retire.
      await supabase.from('communications').delete().eq('id', campagne.id)
      throw new Error(`Insertion des destinataires : ${eDest.message} (la campagne a été retirée)`)
    }
    W(`✅ Campagne inscrite (\`${campagne.id}\`) avec ${lignes.length} destinataire(s).`)
    W('')
  }

  // ------------------------------------------------- 8. archivage des textes
  //
  // ⚠ L'APPLESCRIPT N'EST PAS MODIFIÉ (cf. A.5 de la spécification) : c'est
  // l'outil d'envoi en service, et une retouche non testée s'y paierait sur une
  // vraie campagne. L'archivage est fait ICI, à l'import, et reste facultatif —
  // un script d'import qui écrit spontanément dans un dossier hors du dépôt
  // serait une surprise.
  if (ARCHIVER) {
    const jour = journal.dateEnvoi.slice(0, 10)
    const dossierOld = join(DOSSIER, '_OLD')
    const copies = []
    for (const [cle, nom] of [['objet', FICHIERS.objet], ['fr', FICHIERS.fr], ['en', FICHIERS.en]]) {
      void cle
      const cible = join(dossierOld, nom.replace(/\.txt$/, `_${jour}.txt`))
      if (await existe(cible)) { copies.push(`${nom} → déjà archivé`); continue }
      if (GO) await copyFile(join(DOSSIER, nom), cible)
      copies.push(`${nom} → ${cible}`)
    }
    W('## Archivage des textes')
    W('')
    for (const c of copies) W(`- ${c}`)
    W('')
  }

  // ------------------------------------------------------------- 9. rapport
  if (nonRapproches.length) {
    W('## Adresses non rapprochées du registre')
    W('')
    W('Une adresse sans correspondance est soit un contact périmé, soit un destinataire qui n’est pas coloti.')
    W('Aucun propriétaire n’a été créé.')
    W('')
    for (const n of nonRapproches) W(`- \`${n.email}\`${n.nom ? ` (${n.nom})` : ''} — ${n.raison}`)
    W('')
  }

  const erreurs = lignes.filter((l) => l.statut === 'erreur')
  if (erreurs.length) {
    W('## Échecs d’envoi')
    W('')
    for (const e of erreurs) W(`- \`${e.email}\` — ${e.message_erreur || 'sans message'}`)
    W('')
  }

  if (soucis.length) {
    W('## À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }

  await ecrireRapport()
}

async function ecrireRapport() {
  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir(join(RACINE, 'export'), { recursive: true })
  const chemin = join(RACINE, 'export', `envois_colotis_${stamp}${GO ? '' : '-essai'}.md`)
  await writeFile(chemin, rapport.join('\n'))
  console.log(`\n📄 Rapport : ${chemin}`)
  if (!GO) console.log('   Rien n’a été écrit. Relancer avec --go pour appliquer.')
}

main().catch(async (e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
