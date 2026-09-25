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
//   node scripts/importer_envois.mjs --campagnes "<_campagnes>" --go   reprise

import { createClient } from '@supabase/supabase-js'
import { readFile, writeFile, mkdir, access, copyFile, readdir } from 'node:fs/promises'
import { join, dirname, basename } from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import { emailsOfficiels } from '../src/lib/proprietaireLogic.js'
// ⚠ L'analyse du journal vit à part, SANS Supabase : c'est ce qui permet de la
// vérifier sur un vrai journal avant que la migration ne soit passée.
import { parserJournal, parserTsv, couperBilingue } from './journal_envoi.mjs'

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
// ⚠ MODE REPRISE. `_campagnes/` rassemble les campagnes ANTÉRIEURES, une par
// sous-dossier, retrouvées dans le dossier du lotissement — le journal d'envoi
// étant écrasé à chaque campagne, elles n'en sont pas reconstituables. Celles
// qui n'ont pas de journal entrent en `fiabilite = reconstitue`, avec des
// destinataires en `suppose_envoye` : ils FIGURAIENT SUR LA LISTE, aucun envoi
// vers eux n'a été constaté.
const CAMPAGNES = arg('--campagnes')

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
// PARTIES COMMUNES AUX DEUX MODES
// ============================================================================

/**
 * Le registre des propriétaires, indexé par adresse.
 *
 * ⚠ On rapproche des CONTACTS OFFICIELS (migration 044), pas de la colonne
 * `email` : c'est à eux qu'on écrit. Chargé UNE fois et partagé par les deux
 * modes — en mode reprise, quatre campagnes le rechargeraient sinon quatre fois.
 */
async function chargerRegistre() {
  const { data: proprios, error } = await supabase
    .from('proprietaires').select('*').is('date_cession', null)
  if (error) throw new Error(`Lecture du registre des propriétaires : ${error.message}`)

  const officiels = new Map()
  const connus = new Map()
  for (const p of proprios || []) {
    for (const e of emailsOfficiels(p)) {
      if (e) officiels.set(e.trim().toLowerCase(), p)
    }
    // Toutes les adresses de la fiche, cochées ou non : sert à distinguer
    // « inconnue au registre » de « présente mais pas contact officiel ».
    for (const champ of ['email', 'email_2', 'dirigeant_email', 'dirigeant_email_2', 'mandataire_email']) {
      const v = (p[champ] || '').trim().toLowerCase()
      if (v) connus.set(v, p)
    }
  }
  return { officiels, connus }
}

/**
 * Les lignes de destinataires, rapprochées du registre.
 *
 * @param entrees  [{ email, nom?, langue?, statut, message_erreur?, rang }]
 * @param tsv      Map adresse → { nom, langue } (peut être vide)
 */
function construireLignes(entrees, tsv, registre) {
  const lignes = []
  const nonRapproches = []
  const horsListe = []
  for (const d of entrees) {
    const cle = d.email.trim().toLowerCase()
    const info = tsv.get(cle)
    if (!info && tsv.size) horsListe.push(d.email)
    const officiel = registre.officiels.get(cle) || null
    const connu = officiel || registre.connus.get(cle) || null
    if (!officiel) {
      nonRapproches.push({
        email: d.email,
        nom: d.nom || info?.nom || null,
        // Deux cas très différents, et les confondre empêcherait d'agir :
        // « pas au registre » demande une vérification, « pas cochée » se
        // corrige d'un clic sur la fiche.
        raison: connu
          ? 'présente au registre, mais pas cochée comme contact officiel'
          : 'inconnue du registre des propriétaires',
      })
    }
    lignes.push({
      // ⚠ Le nom du MESSAGE prime sur celui de la liste : pour un `.eml`, c'est
      // le nom sous lequel la personne a réellement été adressée.
      nom: d.nom || info?.nom || null,
      email: d.email.trim(),
      langue: d.langue || info?.langue || null,
      statut: d.statut,
      message_erreur: d.message_erreur || null,
      proprietaire_id: officiel?.id || null,
      rang: d.rang ?? null,
    })
  }
  return { lignes, nonRapproches, horsListe }
}

async function dejaInscrite(dateEnvoi, objet) {
  const { data, error } = await supabase
    .from('communications')
    .select('id, date_envoi, objet, nb_destinataires, fiabilite')
    .eq('date_envoi', dateEnvoi).eq('objet', objet).maybeSingle()
  if (error) throw new Error(`Lecture des campagnes : ${error.message}`)
  return data
}

async function inscrire(campagne, lignes) {
  const { data, error } = await supabase.from('communications').insert(campagne).select().single()
  if (error) throw new Error(`Insertion de la campagne : ${error.message}`)
  const { error: eDest } = await supabase
    .from('communication_destinataires')
    .insert(lignes.map((l) => ({ ...l, communication_id: data.id })))
  if (eDest) {
    // ⚠ Une campagne sans destinataires serait pire qu'aucune campagne : elle
    // dirait « envoyé à personne ». On la retire.
    await supabase.from('communications').delete().eq('id', data.id)
    throw new Error(`Insertion des destinataires : ${eDest.message} (la campagne a été retirée)`)
  }
  return data
}

function tableauCampagne(c, lignes, extra = {}) {
  W('| | |')
  W('|---|---|')
  W(`| Date d’envoi | ${c.date_envoi} |`)
  W(`| Objet | ${c.objet} |`)
  W(`| Fiabilité | ${c.fiabilite === 'journal' ? 'journal d’envoi' : 'RECONSTITUÉE'} |`)
  W(`| Canal | ${c.canal} |`)
  W(`| Mode essai | ${c.mode_test ? 'OUI' : 'non'} |`)
  W(`| Destinataires | ${lignes.length} |`)
  for (const [k, v] of Object.entries(extra)) W(`| ${k} | ${v} |`)
  W(`| Rapprochés au registre | ${lignes.filter((l) => l.proprietaire_id).length} / ${lignes.length} |`)
  W('')
}

// ============================================================================
// MODE COURANT — le dossier d'envoi, journal faisant foi
// ============================================================================
const FICHIERS = {
  objet: 'Message_objet.txt',
  fr: 'Message_FR.txt',
  en: 'Message_EN.txt',
  tsv: 'Colotis_envoi.tsv',
  log: 'Envoi_colotis.log',
}

async function importerDossierCourant(registre) {
  W(`> Dossier : \`${DOSSIER}\``)
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

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

  // ⚠ LE REFUS EST LE CŒUR DU MODE COURANT. Les trois textes sont écrasés à la
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
    W('les textes de cette campagne se retrouvent peut-être dans `_campagnes/` ou `_OLD/`.')
    await ecrireRapport()
    process.exit(2)
  }

  if (journal.modeTest && !INCLURE_ESSAIS) {
    W('## Campagne d’essai ignorée')
    W('')
    W(`Le journal porte \`modeTest = true\` (${journal.destinataires.length} destinataire(s)).`)
    W('Relancer avec `--inclure-essais` pour l’importer quand même, marquée comme essai.')
    await ecrireRapport()
    return
  }

  const deja = await dejaInscrite(journal.dateEnvoi, journal.objet)
  if (deja) {
    W('## Déjà importée')
    W('')
    W(`Campagne du ${journal.dateEnvoi} — « ${journal.objet} » : ${deja.nb_destinataires} destinataire(s).`)
    W('Rien n’a été écrit.')
    await ecrireRapport()
    return
  }

  const { lignes, nonRapproches, horsListe } = construireLignes(journal.destinataires, tsv, registre)

  if (journal.nbAnnonce != null && journal.nbAnnonce !== journal.destinataires.length) {
    soucis.push(`Le journal annonce ${journal.nbAnnonce} destinataires mais en détaille ${journal.destinataires.length}.`)
  }
  if (horsListe.length) {
    soucis.push(`${horsListe.length} adresse(s) du journal absente(s) de \`${FICHIERS.tsv}\` — nom et langue inconnus : ${horsListe.join(', ')}`)
  }

  const campagne = {
    date_envoi: journal.dateEnvoi,
    objet: journal.objet,
    corps_fr: corpsFr,
    corps_en: corpsEn,
    canal: 'applescript_mail',
    fiabilite: 'journal',
    mode_test: journal.modeTest,
    expediteur,
    nb_destinataires: lignes.length,
    nb_envoyes: journal.nbEnvoyes,
    nb_erreurs: journal.nbErreurs,
    source_fichier: join(DOSSIER, FICHIERS.log),
  }

  W('## Campagne')
  W('')
  tableauCampagne(campagne, lignes, {
    'Envoyés': journal.nbEnvoyes,
    'Erreurs': journal.nbErreurs,
    'Expéditeur': expediteur || '— compte par défaut de Mail —',
  })

  if (GO) {
    const c = await inscrire(campagne, lignes)
    W(`✅ Campagne inscrite (\`${c.id}\`) avec ${lignes.length} destinataire(s).`)
    W('')
  }

  // ⚠ L'APPLESCRIPT N'EST PAS MODIFIÉ (cf. A.5 de la spécification) : c'est
  // l'outil d'envoi en service, et une retouche non testée s'y paierait sur une
  // vraie campagne. L'archivage est fait ICI, à l'import, et reste facultatif —
  // un script d'import qui écrit spontanément dans un dossier hors du dépôt
  // serait une surprise.
  if (ARCHIVER) {
    const jour = journal.dateEnvoi.slice(0, 10)
    const dossierOld = join(DOSSIER, '_OLD')
    const copies = []
    for (const nom of [FICHIERS.objet, FICHIERS.fr, FICHIERS.en]) {
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

  rapportDestinataires(nonRapproches, lignes)
  await ecrireRapport()
}

// ============================================================================
// MODE REPRISE — `_campagnes/`, une campagne par sous-dossier
//
// ⚠ POURQUOI CE MODE EXISTE : le journal d'envoi est ÉCRASÉ à chaque campagne.
// Les trois campagnes antérieures au 25 septembre ne sont donc pas
// reconstituables depuis lui — elles ont été retrouvées dans le dossier du
// lotissement et rassemblées à la main.
//
// ⚠ ET POURQUOI IL NE MENT PAS : une campagne sans journal entre avec
// `fiabilite = reconstitue` et des destinataires en `suppose_envoye`. La
// personne FIGURAIT SUR LA LISTE ; aucun envoi vers elle n'a été constaté. La
// différence compte le jour où quelqu'un affirme n'avoir rien reçu.
// ============================================================================

/** Le lecteur de `.eml` — délégué à Python, cf. `scripts/lire_eml.py`. */
function lireEml(chemin) {
  return new Promise((resolve, reject) => {
    const proc = spawn('/usr/bin/python3', [join(RACINE, 'scripts', 'lire_eml.py'), chemin],
      { stdio: ['ignore', 'pipe', 'pipe'] })
    let sortie = ''
    let erreur = ''
    proc.stdout.on('data', (d) => { sortie += d })
    proc.stderr.on('data', (d) => { erreur += d })
    proc.on('error', (e) => reject(new Error(`lecture du .eml impossible : ${e.message}`)))
    proc.on('close', () => {
      try {
        const o = JSON.parse(sortie)
        if (o.erreur) reject(new Error(o.erreur))
        else resolve(o)
      } catch {
        reject(new Error(`sortie illisible de lire_eml.py : ${erreur.split('\n')[0] || 'vide'}`))
      }
    })
  })
}

async function importerCampagne(dossier, registre) {
  const nom = basename(dossier)
  W(`### ${nom}`)
  W('')

  const cheminManifeste = join(dossier, 'manifeste.json')
  if (!(await existe(cheminManifeste))) {
    soucis.push(`\`${nom}\` : pas de \`manifeste.json\`, dossier ignoré.`)
    W('Pas de manifeste — ignoré.')
    W('')
    return
  }
  const manifeste = JSON.parse(await readFile(cheminManifeste, 'utf8'))

  const aLog = await existe(join(dossier, FICHIERS.log))
  const aEml = await existe(join(dossier, 'message.eml'))

  let campagne
  let entrees
  let tsv = new Map()

  if (aLog) {
    // ------------------------------------------------ le journal fait foi
    const journal = parserJournal(await readFile(join(dossier, FICHIERS.log), 'utf8'), soucis)
    const objetFichier = (await readFile(join(dossier, FICHIERS.objet), 'utf8')).replace(/[\r\n]+$/, '').trim()
    if (journal.objet !== objetFichier) {
      soucis.push(`\`${nom}\` : l’objet du journal ne correspond pas à \`Message_objet.txt\` — dossier ignoré.`)
      W('Objet du journal et des textes divergents — ignoré.')
      W('')
      return
    }
    tsv = parserTsv(await readFile(join(dossier, FICHIERS.tsv), 'utf8'))
    entrees = journal.destinataires
    campagne = {
      date_envoi: journal.dateEnvoi,
      objet: journal.objet,
      corps_fr: await readFile(join(dossier, FICHIERS.fr), 'utf8'),
      corps_en: await readFile(join(dossier, FICHIERS.en), 'utf8'),
      canal: manifeste.canal || 'applescript_mail',
      fiabilite: 'journal',
      mode_test: Boolean(manifeste.mode_test),
      nb_envoyes: journal.nbEnvoyes,
      nb_erreurs: journal.nbErreurs,
      source_fichier: join(dossier, FICHIERS.log),
    }
  } else if (aEml) {
    // ------------------------------------------------ le message conservé
    const eml = await lireEml(join(dossier, 'message.eml'))
    // ⚠ La DATE du message prime sur celle du manifeste : elle est dans
    // l'en-tête, posée par le logiciel d'envoi. Le manifeste ne sert de
    // secours que si l'en-tête est illisible.
    const date = eml.date || manifeste.date_envoi
    const { fr, en } = couperBilingue(eml.corps)
    entrees = eml.destinataires.map((d, i) => ({
      email: d.email, nom: d.nom, langue: null,
      statut: 'suppose_envoye', rang: i + 1,
    }))
    // ⚠ Les comptes par en-tête sont reportés : c'est eux qui ont montré que le
    // `To` n'était pas vide, et donc que s'en tenir au `Bcc` aurait effacé
    // quatorze destinataires réels.
    W(`En-têtes du message : ${Object.entries(eml.comptes).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(', ')} → ${entrees.length} adresse(s) unique(s).`)
    W('')
    campagne = {
      date_envoi: new Date(date).toISOString(),
      objet: eml.objet || manifeste.objet,
      corps_fr: fr,
      corps_en: en,
      canal: manifeste.canal || 'mail_bcc',
      fiabilite: 'reconstitue',
      mode_test: Boolean(manifeste.mode_test),
      expediteur: eml.expediteur || null,
      nb_envoyes: 0,
      nb_erreurs: 0,
      source_fichier: join(dossier, 'message.eml'),
    }
  } else {
    // ------------------------------- les textes et la liste, sans journal
    const manquants = []
    for (const f of [FICHIERS.objet, FICHIERS.fr, FICHIERS.en, FICHIERS.tsv]) {
      if (!(await existe(join(dossier, f)))) manquants.push(f)
    }
    if (manquants.length) {
      soucis.push(`\`${nom}\` : ni journal, ni message, et il manque ${manquants.join(', ')} — dossier ignoré.`)
      W(`Incomplet (${manquants.join(', ')}) — ignoré.`)
      W('')
      return
    }
    const objetFichier = (await readFile(join(dossier, FICHIERS.objet), 'utf8')).replace(/[\r\n]+$/, '').trim()
    // ⚠ Divergence SIGNALÉE, pas arbitrée en silence : c'est le fichier qui
    // fait foi (c'est lui qui est parti), le manifeste n'est qu'une note.
    if (manifeste.objet && manifeste.objet !== objetFichier) {
      soucis.push(`\`${nom}\` : l’objet du manifeste diffère de \`Message_objet.txt\`. C’est le fichier qui a été retenu.`)
    }
    tsv = parserTsv(await readFile(join(dossier, FICHIERS.tsv), 'utf8'))
    entrees = [...tsv.entries()].map(([email, info], i) => ({
      email, nom: info.nom, langue: info.langue,
      statut: 'suppose_envoye', rang: i + 1,
    }))
    campagne = {
      date_envoi: new Date(manifeste.date_envoi).toISOString(),
      objet: objetFichier,
      corps_fr: await readFile(join(dossier, FICHIERS.fr), 'utf8'),
      corps_en: await readFile(join(dossier, FICHIERS.en), 'utf8'),
      canal: manifeste.canal || 'applescript_mail',
      fiabilite: 'reconstitue',
      mode_test: Boolean(manifeste.mode_test),
      nb_envoyes: 0,
      nb_erreurs: 0,
      source_fichier: join(dossier, FICHIERS.tsv),
    }
  }

  if (campagne.mode_test && !INCLURE_ESSAIS) {
    W('Campagne d’essai — ignorée (`--inclure-essais` pour la prendre).')
    W('')
    return
  }

  // ⚠ Le champ `certitude` du manifeste finit dans le COMMENTAIRE de la
  // campagne : c'est le seul endroit du registre où se lit comment cette date
  // et cette liste ont été établies. Sans lui, « reconstituée » ne dirait pas
  // à partir de quoi.
  if (manifeste.certitude) campagne.commentaire = manifeste.certitude

  const deja = await dejaInscrite(campagne.date_envoi, campagne.objet)
  if (deja) {
    W(`Déjà inscrite (${deja.nb_destinataires} destinataire(s), fiabilité « ${deja.fiabilite} »). Rien n’a été écrit.`)
    W('')
    return
  }

  const { lignes, nonRapproches } = construireLignes(entrees, tsv, registre)
  campagne.nb_destinataires = lignes.length

  tableauCampagne(campagne, lignes, aLog
    ? { 'Envoyés': campagne.nb_envoyes, 'Erreurs': campagne.nb_erreurs }
    : { 'Envois constatés': 'aucun — statut « supposé envoyé »' })

  if (nonRapproches.length) {
    W(`⚠ ${nonRapproches.length} adresse(s) non rapprochée(s) du registre :`)
    for (const n of nonRapproches) W(`  - \`${n.email}\`${n.nom ? ` (${n.nom})` : ''} — ${n.raison}`)
    W('')
  }

  if (GO) {
    const c = await inscrire(campagne, lignes)
    W(`✅ Inscrite (\`${c.id}\`) avec ${lignes.length} destinataire(s).`)
    W('')
  }
}

async function importerCampagnes(racine, registre) {
  W(`> Dossier des campagnes : \`${racine}\``)
  if (!GO) W('> ⚠ **Aucune écriture.** Relancer avec `--go` pour appliquer.')
  W('')

  const entrees = await readdir(racine, { withFileTypes: true })
  // Tri par nom : les dossiers sont datés, l'ordre du rapport est donc
  // chronologique.
  const dossiers = entrees.filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => e.name).sort()
  if (!dossiers.length) {
    W('Aucun sous-dossier de campagne.')
    await ecrireRapport()
    return
  }
  W(`${dossiers.length} campagne(s) à reprendre.`)
  W('')
  W('## Campagnes')
  W('')
  for (const d of dossiers) {
    await importerCampagne(join(racine, d), registre)
  }
  if (soucis.length) {
    W('## À vérifier')
    W('')
    for (const s of soucis) W(`- ${s}`)
    W('')
  }
  await ecrireRapport()
}

// Le détail des destinataires, en fin de rapport du mode courant.
function rapportDestinataires(nonRapproches, lignes) {
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
}

// ============================================================================
async function main() {
  W(`# Import des envois aux colotis — ${GO ? 'ÉCRITURE' : 'ESSAI À BLANC'}`)
  W('')
  const registre = await chargerRegistre()
  if (CAMPAGNES) await importerCampagnes(CAMPAGNES, registre)
  else await importerDossierCourant(registre)
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
