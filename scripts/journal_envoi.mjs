// LECTURE DU JOURNAL D'ENVOI — analyse PURE, sans aucun effet de bord.
//
// ⚠ Séparé de `importer_envois.mjs` pour une raison précise : ce module peut
// être exécuté SANS base de données. L'import, lui, ouvre une connexion
// Supabase dès son chargement — il n'était donc pas vérifiable tant que la
// migration 056 n'était pas passée, c'est-à-dire exactement au moment où on a
// besoin de savoir si l'analyse est juste.
//
// Aucune fonction d'ici n'écrit, ne lit un fichier, ni ne connaît Supabase.
// Elles prennent du texte et rendent des objets.
//
// `soucis` est un tableau passé par l'appelant : les anomalies non bloquantes
// (envoi interrompu, comptes qui ne collent pas) y sont ajoutées, parce qu'elles
// doivent finir dans le rapport et non dans une exception.

// ============================================================================
// LECTURE DU JOURNAL
//
// ⚠ LES FINS DE LIGNE SONT DES RETOURS CHARIOT SEULS (`\r`). AppleScript écrit
// `return`, pas `linefeed` : vérifié dans `Envoyer_message_colotis.applescript`
// (`write (texte & return)`), et confirmé sur le journal du 25/09 — 59 `\r`,
// zéro `\n`. Un découpage sur `\n` rend UNE seule ligne, et le parseur croit
// n'avoir rien trouvé au lieu d'échouer franchement.
// ============================================================================
export const lignesDe = (texte) => texte.replace(/\r\n?/g, '\n').split('\n')

// ---------------------------------------------------------------- les dates
//
// ⚠ `current date as text` d'AppleScript SUIT LA LOCALE DU MAC. Sur celui de
// Pascal c'est l'anglais (« Friday, 25 September 2026 at 14:49:00 ») mais un
// réglage changé produirait du français. On accepte les deux et, surtout, on
// REFUSE ce qu'on ne sait pas lire plutôt que de retomber sur `new Date()` —
// une campagne datée du jour de l'import serait une date fausse dans un registre.
const MOIS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
  janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12, decembre: 12,
}

// Décalage de Paris CE JOUR-LÀ, pour ne pas figer +01:00 sur une campagne d'été.
// On le demande à l'Intl plutôt que de coder les règles d'heure d'été.
function offsetParis(y, mo, d, h, mi, s) {
  const provisoire = Date.UTC(y, mo - 1, d, h, mi, s)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Paris', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const p = Object.fromEntries(fmt.formatToParts(new Date(provisoire)).map((x) => [x.type, x.value]))
  const vuAParis = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second)
  return vuAParis - provisoire // millisecondes d'avance de Paris sur UTC
}

export function parserDate(brut) {
  const t = brut.replace(/[\u00A0\u202F]/g, ' ').trim()
  // « Friday, 25 September 2026 at 14:49:00 » / « vendredi 25 septembre 2026 à 14:49:00 »
  const m = t.match(/(\d{1,2})\s+([^\s\d]+)\s+(\d{4})\s+(?:at|à)\s+(\d{1,2}):(\d{2}):(\d{2})/i)
  if (!m) return null
  const mois = MOIS[m[2].toLowerCase()]
  if (!mois) return null
  const [jour, annee, h, mi, s] = [+m[1], +m[3], +m[4], +m[5], +m[6]]
  const offset = offsetParis(annee, mois, jour, h, mi, s)
  return new Date(Date.UTC(annee, mois - 1, jour, h, mi, s) - offset).toISOString()
}

/**
 * Le journal, transformé en campagne.
 *
 * ⚠ Le libellé d'échec n'est pas deviné : il vient du script d'envoi lui-même,
 *     `"[" & n & "/" & total & "] ERREUR  " & mailD & " : " & err`
 * Tout ce qui n'est pas `OK` est traité comme un échec, et le message est
 * conservé TEL QUEL — un message d'erreur reformulé ne sert plus à rien.
 */
export function parserJournal(texte, soucis = []) {
  const lignes = lignesDe(texte).map((l) => l.trimEnd()).filter((l) => l !== '')
  if (!lignes.length) throw new Error('Le journal est vide.')

  const entete = lignes[0].match(/^===\s*(.+?)\s+—\s*modeTest\s*=\s*(\S+)\s*===$/)
  if (!entete) throw new Error(`Première ligne du journal illisible : ${lignes[0]}`)
  const dateEnvoi = parserDate(entete[1])
  if (!dateEnvoi) throw new Error(`Date du journal illisible : « ${entete[1]} ». Aucune date n'est inventée — corrigez le journal ou signalez le format.`)
  const modeTest = entete[2].toLowerCase() === 'true'

  const ligneObjet = lignes.find((l) => l.startsWith('Objet : '))
  if (!ligneObjet) throw new Error('Le journal ne porte aucune ligne « Objet : ».')
  const objet = ligneObjet.slice('Objet : '.length).trim()

  const ligneNb = lignes.find((l) => l.startsWith('Destinataires : '))
  const nbAnnonce = ligneNb ? Number(ligneNb.slice('Destinataires : '.length).trim()) : null

  const destinataires = []
  for (const l of lignes) {
    const m = l.match(/^\[(\d+)\/(\d+)\]\s+(\S+)\s+(.*)$/)
    if (!m) continue
    const [, rang, , verdict, reste] = m
    if (verdict === 'OK') {
      destinataires.push({ rang: +rang, email: reste.trim(), statut: 'envoye', message_erreur: null })
    } else {
      // « <adresse> : <message> » — l'adresse d'abord, le message est libre et
      // peut lui-même contenir des deux-points.
      const sep = reste.indexOf(' : ')
      const email = (sep > -1 ? reste.slice(0, sep) : reste).trim()
      const message = sep > -1 ? reste.slice(sep + 3).trim() : null
      destinataires.push({ rang: +rang, email, statut: 'erreur', message_erreur: message })
    }
  }

  const bilan = lignes.find((l) => /^===\s*Terminé/.test(l))
  const mb = bilan && bilan.match(/envoyés\s+(\d+),\s*erreurs\s+(\d+)/)
  // ⚠ Pas de bilan = envoi interrompu (Mail planté, session fermée). On importe
  // quand même ce qui est parti — c'est un fait — mais on le SIGNALE.
  if (!bilan) soucis.push('Le journal ne porte pas de ligne de bilan : l’envoi a probablement été interrompu. Les destinataires listés ont bien été traités.')

  return {
    dateEnvoi, modeTest, objet, nbAnnonce, destinataires,
    nbEnvoyes: mb ? +mb[1] : destinataires.filter((d) => d.statut === 'envoye').length,
    nbErreurs: mb ? +mb[2] : destinataires.filter((d) => d.statut === 'erreur').length,
  }
}

// ------------------------------------------------- couper un corps bilingue
//
// Les messages partent en UN seul envoi contenant les deux langues, séparées
// par un filet. ⚠ LE FILET N'EST PAS LE MÊME PARTOUT : le script d'envoi écrit
// soixante tirets `-`, le message du 18 août — écrit à la main dans Mail —
// sépare par quatre cadratins `————`. Coder le filet du script aurait rangé
// tout le message du 18 août en français, anglais compris.
//
// On coupe donc sur la PREMIÈRE ligne composée uniquement de traits (au moins
// trois), quel que soit le trait employé. Sans filet, tout reste en français :
// mieux vaut un corps anglais vide qu'un découpage inventé au milieu d'une
// phrase.
const LIGNE_FILET = /^[\s]*[-—–_=]{3,}[\s]*$/

export function couperBilingue(texte) {
  const lignes = String(texte || '').replace(/\r\n?/g, '\n').split('\n')
  const i = lignes.findIndex((l) => LIGNE_FILET.test(l))
  if (i === -1) return { fr: String(texte || ''), en: null }
  return {
    fr: lignes.slice(0, i).join('\n').trimEnd(),
    en: lignes.slice(i + 1).join('\n').trim() || null,
  }
}

// ---------------------------------------------------------------- le TSV
// nom <TAB> adresse <TAB> langue. Le script d'envoi n'utilise que les deux
// premiers champs ; la langue ne sert qu'ici, à dire qui a reçu quoi.
export function parserTsv(texte) {
  const out = new Map()
  for (const ligne of lignesDe(texte)) {
    if (!ligne.trim()) continue
    const [nom, email, langue] = ligne.split('\t')
    if (!email) continue
    out.set(email.trim().toLowerCase(), {
      nom: (nom || '').trim() || null,
      langue: (langue || '').trim().toUpperCase() || null,
    })
  }
  return out
}
