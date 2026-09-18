// Export LISIBLE de toute la base dans un seul fichier Markdown.
//
// POURQUOI CE SCRIPT EXISTE (demande de Pascal, 2026-09-18) : « Claude m'aide à
// assurer que toutes les informations concernant le lotissement sont bien dans
// l'app. Mais cette méthode par SQL rend ceci impraticable. Il faut une fonction
// qui exporte toutes les données de la base de manière ordonnée dans un fichier
// MD en spécifiant le nom des pièces attachées. »
//
// La cible n'est donc PAS un humain qui lit un rapport, ni une sauvegarde : c'est
// un ASSISTANT qui doit pouvoir relire l'état complet du registre d'un bloc, pour
// répondre à « qu'est-ce qui manque ? ». Trois conséquences de forme :
//
//   1. LES IDENTIFIANTS SONT RÉSOLUS. Un export brut est une mer d'UUID
//      (`created_by: 8f3c…`) sur laquelle on ne peut rien conclure. Ici chaque
//      référence est rendue par son nom — le membre, le projet, l'AG, la parcelle.
//      C'est le seul vrai travail du script, et ce qui le distingue de backup.mjs.
//   2. LES CHAMPS VIDES SONT OMIS. Un « null » par ligne × 40 colonnes noie le
//      signal. Ce qui manque se lit dans la section « points d'attention », qui le
//      dit en toutes lettres plutôt que de le laisser deviner.
//   3. L'ORDRE SUIT LE MÉTIER, pas l'alphabet : AG → résolutions → projets →
//      décisions, c'est-à-dire la chaîne par laquelle l'argent circule.
//
// ⚠ CE FICHIER CONTIENT DES DONNÉES PERSONNELLES — 50 propriétaires, leurs noms,
// adresses privées, e-mails et téléphones (migration 035). C'est exactement le
// « fichier exporté » contre lequel met en garde la mention RGPD du registre. Le
// dossier `export/` est git-ignoré ; il doit rester sur une machine de confiance
// et n'être transmis à personne. Ne pas le coller dans un ticket, un courriel ni
// une conversation partagée.
//
// ⚠ IL NE REMPLACE PAS `backup.mjs`. Celui-ci écrit du JSON fidèle, réimportable
// par `restore.mjs`. Celui-là écrit un texte pour être LU : il omet, il résume, il
// interprète. Ne jamais restaurer depuis ce Markdown.
//
// Usage (jamais committer la clé — service_role contourne la RLS) :
//   SUPABASE_URL="https://<ref>.supabase.co" \
//   SUPABASE_SERVICE_ROLE_KEY="<clé service_role>" \
//   node scripts/export_md.mjs
//
// Options :
//   --tout        n'écrête aucun journal technique (audit_log complet)
//   --sans-perso  omet le registre des propriétaires (fichier partageable)
//
// Sortie : export/registre-<horodatage>.md (dossier git-ignoré).

import { createClient } from '@supabase/supabase-js'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import process from 'node:process'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('❌ Manque SUPABASE_URL et/ou SUPABASE_SERVICE_ROLE_KEY dans l’environnement.')
  console.error('   La clé est dans : Supabase → Settings → API → service_role (secret).')
  process.exit(1)
}

const TOUT = process.argv.includes('--tout')
const SANS_PERSO = process.argv.includes('--sans-perso')
const PAGE = 1000
// Au-delà, un journal technique noie le fichier sans rien apprendre. On écrête,
// et on ÉCRIT qu'on a écrêté — un silence ferait croire le journal complet.
const PLAFOND_JOURNAL = 200

const supabase = createClient(url, key, { auth: { persistSession: false } })

// ---------------------------------------------------------------- lecture
// Découverte par l'OpenAPI de PostgREST, même raison que dans backup.mjs : une
// liste codée en dur dérive à la première migration, et on ne s'en aperçoit pas.
async function listerTables() {
  const r = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } })
  if (!r.ok) throw new Error(`découverte des tables : HTTP ${r.status}`)
  const spec = await r.json()
  const tables = Object.keys(spec.definitions || {}).sort()
  if (!tables.length) throw new Error('aucune table dans la description OpenAPI')
  return tables
}

async function lire(table) {
  const rows = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1)
    if (error) throw new Error(`table ${table} : ${error.message}`)
    rows.push(...data)
    if (data.length < PAGE) break
  }
  return rows
}

// Fichiers réellement présents dans le bucket. Sert à confronter ce que les
// lignes DISENT contenir et ce qui existe — un chemin mort ne se voit pas
// autrement, et c'est précisément ce qu'on cherche à vérifier ici.
async function listerFichiers(prefix = '') {
  const files = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from('documents').list(prefix, { limit: PAGE, offset })
    if (error) return files // Storage indisponible : on continue sans, en le signalant plus bas.
    for (const e of data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name
      if (e.id === null || e.metadata === null) files.push(...(await listerFichiers(p)))
      else files.push(p)
    }
    if (data.length < PAGE) break
  }
  return files
}

// ---------------------------------------------------------------- formatage
const eur = (v) =>
  v === null || v === undefined || v === '' ? null : `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const m2 = (v) => (v === null || v === undefined || v === '' ? null : `${Number(v).toLocaleString('fr-FR')} m²`)
const date = (v) => (v ? String(v).slice(0, 10).split('-').reverse().join('/') : null)
const vide = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && !v.length)

// Une ligne « **clé** : valeur », omise si la valeur est vide.
function champ(cle, valeur) {
  return vide(valeur) ? null : `- **${cle}** : ${valeur}`
}

// Bloc de champs, les vides retirés.
function champs(paires) {
  return paires.filter(Boolean).join('\n')
}

// ⚠ LES PIÈCES JOINTES SONT LE CŒUR DE LA DEMANDE : « en spécifiant le nom des
// pièces attachées ». On rend le NOM (ce que l'utilisateur reconnaît), la taille,
// et le CHEMIN (ce qui permet de retrouver le fichier dans le Storage) — plus,
// quand la liste des fichiers est disponible, un marqueur si le chemin est MORT.
function piecesJointes(docs, fichiersConnus) {
  if (!Array.isArray(docs) || !docs.length) return null
  const lignes = docs.map((d) => {
    const taille = d.size ? ` — ${Math.round(d.size / 1024)} Ko` : ''
    const categorie = d.categorie ? ` [${d.categorie}]` : ''
    // Le base64 hérité n'a pas de chemin : il vit dans la ligne elle-même.
    if (!d.path) return `  - 📎 ${d.name || 'sans nom'}${categorie}${taille} (pièce héritée, stockée dans la ligne)`
    const mort = fichiersConnus && fichiersConnus.size && !fichiersConnus.has(d.path)
      ? ' ⚠ FICHIER INTROUVABLE dans le Storage'
      : ''
    return `  - 📎 ${d.name || 'sans nom'}${categorie}${taille} — \`${d.path}\`${mort}`
  })
  return `- **Pièces jointes** (${docs.length}) :\n${lignes.join('\n')}`
}

// ---------------------------------------------------------------- export
async function main() {
  const tables = await listerTables()
  const db = {}
  for (const t of tables) db[t] = await lire(t)

  const fichiers = new Set(await listerFichiers())

  // Index par id, pour résoudre les références en NOMS.
  const idx = (table) => Object.fromEntries((db[table] || []).map((r) => [r.id, r]))
  const membres = idx('membres_cs')
  const projets = idx('projets')
  const ags = idx('assemblees_generales')
  const resolutions = idx('resolutions_ag')

  const nomMembre = (id) => (membres[id] ? `${membres[id].prenom} ${membres[id].nom}` : id ? `(membre inconnu ${id})` : null)
  const nomProjet = (id) => (projets[id] ? projets[id].nom : id ? `(projet inconnu ${id})` : null)
  const nomAG = (id) => (ags[id] ? ags[id].numero : id ? `(AG inconnue ${id})` : null)
  const nomResolution = (id) => {
    const r = resolutions[id]
    if (!r) return id ? `(résolution inconnue ${id})` : null
    const num = r.sous_numero ? `${r.numero}-${r.sous_numero}` : r.numero
    return `n° ${num} « ${r.titre} » (${nomAG(r.ag_id)})`
  }

  const parCle = (rows, cle, valeur) => (rows || []).filter((r) => r[cle] === valeur)
  const out = []
  const W = (s) => out.push(s)

  // ------------------------------------------------------------- en-tête
  W(`# Registre CS — ASL Lotissement de Rives · export complet`)
  W('')
  W(`> Export du **${new Date().toLocaleString('fr-FR')}** — ${tables.length} tables, ${Object.values(db).reduce((s, r) => s + r.length, 0)} lignes.`)
  W('>')
  W('> ⚠ **Ce fichier contient des données personnelles** (propriétaires : noms, adresses,')
  W('> e-mails, téléphones). Il ne doit être ni partagé, ni committé, ni transmis.')
  W('>')
  W('> ⚠ **Ce n’est pas une sauvegarde** : les champs vides sont omis et les identifiants')
  W('> résolus en noms. Pour restaurer, utiliser `scripts/backup.mjs` / `restore.mjs`.')
  W('')

  // ------------------------------------------------------------- paramètres
  if (db.parametres?.length) {
    W('## Paramètres de l’application')
    W('')
    for (const p of db.parametres) W(`- **${p.cle}** : ${p.valeur}`)
    W('')
  }

  // ------------------------------------------------------------- membres
  W('## Conseil syndical')
  W('')
  const actifs = (db.membres_cs || []).filter((m) => m.actif)
  const anciens = (db.membres_cs || []).filter((m) => !m.actif)
  for (const [titre, liste] of [['Membres en exercice', actifs], ['Anciens membres', anciens]]) {
    W(`### ${titre} (${liste.length})`)
    W('')
    if (!liste.length) W('_Aucun._')
    for (const m of liste.sort((a, b) => a.nom.localeCompare(b.nom))) {
      W(`#### ${m.prenom} ${m.nom} — ${m.role}`)
      W(champs([
        champ('E-mail', m.email),
        champ('Élu le', date(m.date_election)),
        champ('AG d’élection', m.ag_election),
        champ('Fin de fonction', date(m.date_fin)),
        champ('Mention RGPD acceptée le', date(m.registre_rgpd_accepte_le)),
      ]))
      const mandats = parCle(db.mandats_cs, 'membre_id', m.id)
        .sort((a, b) => (a.date_debut < b.date_debut ? 1 : -1))
      if (mandats.length) {
        W(`- **Mandats** (${mandats.length}) :`)
        for (const x of mandats) {
          const duree = x.duree_annees ? `, élu pour ${x.duree_annees} an${x.duree_annees > 1 ? 's' : ''}` : ''
          const ref = x.ag_id ? nomAG(x.ag_id) : x.ag_libelle
          W(`  - ${x.role} · ${date(x.date_debut)} → ${date(x.date_fin) || 'sans terme'} · ${x.origine}${duree}${ref ? ` · ${ref}` : ''}${x.observations ? ` · ${x.observations}` : ''}`)
        }
      }
      W('')
    }
  }

  // ------------------------------------------------------------- AG
  W('## Assemblées générales')
  W('')
  const agsTriees = (db.assemblees_generales || []).sort((a, b) => (a.date_ag < b.date_ag ? 1 : -1))
  for (const ag of agsTriees) {
    W(`### ${ag.numero} — ${ag.type} du ${date(ag.date_ag)}`)
    const participation = ag.m2_presents && ag.m2_total
      ? `${m2(ag.m2_presents)} sur ${m2(ag.m2_total)} — ${((ag.m2_presents / ag.m2_total) * 100).toFixed(1).replace('.', ',')} %`
      : m2(ag.m2_presents)
    W(champs([
      champ('Statut', ag.statut),
      champ('Lieu', ag.lieu),
      champ('Heure', [ag.heure_planifiee, ag.heure_fin].filter(Boolean).join(' → ')),
      champ('Président de séance', ag.president_seance),
      champ('Quorum', ag.quorum_statut),
      champ('Participation', participation),
      champ('Lien PV externe', ag.pv_url),
      piecesJointes(ag.documents, fichiers),
    ]))
    const comptes = parCle(db.comptes_ag, 'ag_id', ag.id)
    for (const c of comptes) {
      W(champ('Comptes de l’exercice', `trésorier ${c.approuve_tresorier_le ? `approuvé le ${date(c.approuve_tresorier_le)}` : 'non approuvé'}, président ${c.approuve_president_le ? `approuvé le ${date(c.approuve_president_le)}` : 'non approuvé'}`))
    }
    const res = parCle(db.resolutions_ag, 'ag_id', ag.id)
      .sort((a, b) => a.numero - b.numero || (a.sous_numero || 0) - (b.sous_numero || 0))
    W('')
    W(`#### Résolutions (${res.length})`)
    W('')
    if (!res.length) W('_Aucune résolution._')
    for (const r of res) {
      const num = r.sous_numero ? `${r.numero}-${r.sous_numero}` : r.numero
      W(`##### Résolution n° ${num} — ${r.titre}`)
      const votes = [r.m2_pour, r.m2_contre, r.m2_abstention].some((v) => !vide(v))
        ? `pour ${m2(r.m2_pour || 0)}, contre ${m2(r.m2_contre || 0)}, abstention ${m2(r.m2_abstention || 0)}`
        : null
      W(champs([
        champ('Statut', r.statut),
        champ('Majorité requise', r.majorite_requise),
        champ('Description', r.description),
        champ('Budget alloué', eur(r.budget_alloue)),
        champ('Intitulé du budget', r.budget_intitule),
        champ('Projet financé', nomProjet(r.projet_id)),
        champ('Détail du vote', votes),
        champ('Observations', r.observations),
        piecesJointes(r.documents, fichiers),
      ]))
      W('')
    }
    W('')
  }

  // ------------------------------------------------------------- projets
  W('## Projets')
  W('')
  for (const p of (db.projets || []).sort((a, b) => a.nom.localeCompare(b.nom))) {
    W(`### ${p.nom}`)
    const financement = (db.resolutions_ag || [])
      .filter((r) => r.projet_id === p.id)
      .map((r) => `${nomAG(r.ag_id)} n° ${r.sous_numero ? `${r.numero}-${r.sous_numero}` : r.numero} (${eur(r.budget_alloue)}, ${r.statut})`)
    W(champs([
      champ('Description', p.description),
      champ('Chef de projet', nomMembre(p.chef_projet_id)),
      champ('Adjoint', nomMembre(p.adjoint_projet_id)),
      champ('Ouverture', date(p.date_ouverture)),
      champ('Clôture', date(p.date_cloture)),
      champ('Financé par', financement.join(' + ')),
      piecesJointes(p.documents, fichiers),
    ]))
    const journal = parCle(db.journal_projet, 'projet_id', p.id)
      .sort((a, b) => (a.date_action < b.date_action ? 1 : -1))
    if (journal.length) {
      W('')
      W(`#### Journal de bord (${journal.length})`)
      for (const j of journal) {
        W(`- **${date(j.date_action)}** — ${j.texte} _(${nomMembre(j.auteur_id)})_`)
        const pj = piecesJointes(j.documents, fichiers)
        if (pj) W(pj.split('\n').slice(1).join('\n'))
      }
    }
    const qa = parCle(db.questions_reponses_projet, 'projet_id', p.id)
    if (qa.length) {
      W('')
      W(`#### Échanges (${qa.length})`)
      for (const q of qa.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        W(`- [${q.type}] ${q.texte} _(${nomMembre(q.auteur_id)}, ${date(q.created_at)})_`)
      }
    }
    W('')
  }

  // ------------------------------------------------------------- décisions
  W('## Décisions du conseil syndical')
  W('')
  const decisions = (db.decisions || []).sort((a, b) => String(b.date_publication).localeCompare(String(a.date_publication)))
  for (const d of decisions) {
    W(`### ${d.numero || '(brouillon, sans numéro)'} — ${d.titre}`)
    const votes = parCle(db.votes, 'decision_id', d.id)
    const detailVotes = votes.length
      ? votes.map((v) => `${nomMembre(v.membre_id)} : ${v.vote}`).join(' · ')
      : null
    W(champs([
      champ('Phase', d.phase),
      champ('Statut', d.statut),
      champ('Enregistrée', d.enregistree ? `oui, le ${date(d.date_enregistrement)}` : 'non'),
      champ('Publication', date(d.date_publication)),
      champ('Date limite de réponse', d.enregistree ? null : date(d.date_limite_reponse)),
      champ('Description', d.description),
      champ('Montant engagé', eur(d.montant_engage)),
      champ('TVA', d.tva_taux ? `${d.tva_taux} %${d.tva_incluse ? ' (incluse)' : ''}` : null),
      champ('Projet', nomProjet(d.projet_id)),
      champ('Résolution', nomResolution(d.resolution_id)),
      champ('Action sur le projet', d.projet_action),
      champ('Auteur', nomMembre(d.created_by)),
      champ('Quorum atteint', d.quorum_atteint === null ? null : d.quorum_atteint ? 'oui' : 'non'),
      champ('Visibilité', d.visibilite),
      champ('Motif d’annulation', d.motif_annulation),
      champ('Votes', detailVotes),
      piecesJointes(d.documents, fichiers),
    ]))
    const qa = parCle(db.questions_reponses, 'decision_id', d.id)
    if (qa.length) {
      W(`- **Questions / réponses** (${qa.length}) :`)
      for (const q of qa.sort((a, b) => a.created_at.localeCompare(b.created_at))) {
        W(`  - [${q.type}] ${q.texte} _(${nomMembre(q.auteur_id)}, ${date(q.created_at)})_`)
      }
    }
    W('')
  }

  // ------------------------------------------------------------- mémoire
  if (db.sujets?.length) {
    W('## Mémoire de l’ASL')
    W('')
    for (const s of db.sujets.sort((a, b) => a.titre.localeCompare(b.titre))) {
      W(`### ${s.titre}${s.categorie ? ` _(${s.categorie})_` : ''}`)
      W(champs([
        champ('Synthèse', s.contenu),
        piecesJointes(s.documents, fichiers),
      ]))
      const entrees = parCle(db.sujet_entrees, 'sujet_id', s.id)
        .sort((a, b) => (a.date_evenement < b.date_evenement ? 1 : -1))
      if (entrees.length) {
        W('')
        W(`#### Chronologie (${entrees.length})`)
        for (const e of entrees) {
          W(`- **${date(e.date_evenement)}** — ${e.texte} _(${nomMembre(e.auteur_id)})_`)
          const pj = piecesJointes(e.documents, fichiers)
          if (pj) W(pj.split('\n').slice(1).join('\n'))
        }
      }
      W('')
    }
  }

  // ------------------------------------------------------------- propriétaires
  if (!SANS_PERSO && db.lots?.length) {
    W('## Registre des propriétaires ⚠ DONNÉES PERSONNELLES')
    W('')
    const totalSuperficie = db.lots.reduce((s, l) => s + (Number(l.superficie) || 0), 0)
    const totalLots = db.lots.reduce((s, l) => s + (Number(l.nombre_lots) || 0), 0)
    W(`> ${db.lots.length} parcelles, ${totalLots.toLocaleString('fr-FR')} lots, ${m2(totalSuperficie)} de superficie renseignée.`)
    W('')
    for (const l of db.lots.sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }))) {
      W(`### Parcelle ${l.numero}`)
      const part = totalSuperficie && l.superficie
        ? `${((l.superficie / totalSuperficie) * 100).toFixed(2).replace('.', ',')} % des superficies renseignées`
        : null
      W(champs([
        champ('Référence syndic', l.numero_syndic),
        champ('Adresse dans le lotissement', l.adresse),
        champ('Superficie', m2(l.superficie)),
        champ('Tantième', part),
        champ('Nombre de lots', l.nombre_lots),
        champ('Observations', l.observations),
      ]))
      const props = parCle(db.proprietaires, 'lot_id', l.id)
        .sort((a, b) => (a.date_acquisition || '').localeCompare(b.date_acquisition || ''))
      for (const p of props) {
        const actuel = !p.date_cession
        W(`- **${actuel ? 'Propriétaire actuel' : 'Ancien propriétaire'}** : ${p.nom}${p.nom_2 ? ` et ${p.nom_2}` : ''}`)
        W(champs([
          champ('  Période', `${date(p.date_acquisition) || '?'} → ${date(p.date_cession) || 'en cours'}`),
          champ('  Indivision déclarée', p.est_indivision ? 'oui' : null),
          champ('  E-mail', [p.email, p.email_2].filter(Boolean).join(', ')),
          champ('  Téléphone', [p.telephone, p.telephone_2].filter(Boolean).join(', ')),
          champ('  Adresse', p.adresse),
          champ('  Dirigeant', [p.dirigeant_nom && `${p.dirigeant_nom} (${p.dirigeant_fonction || 'fonction non précisée'})`, p.dirigeant_nom_2 && `${p.dirigeant_nom_2} (${p.dirigeant_fonction_2 || 'fonction non précisée'})`].filter(Boolean).join(' · ')),
          champ('  Adresse du dirigeant', p.adresse_dirigeant),
          champ('  Mandataire', p.mandataire_nom && `${p.mandataire_nom}${p.mandataire_email ? ` — ${p.mandataire_email}` : ''}${p.mandataire_telephone ? ` — ${p.mandataire_telephone}` : ''}`),
          champ('  Destinataires officiels', Array.isArray(p.contacts_officiels) ? p.contacts_officiels.join(', ') : null),
          champ('  Observations', p.observations),
        ]))
      }
      W('')
    }
  } else if (SANS_PERSO) {
    W('## Registre des propriétaires')
    W('')
    W('_Omis (`--sans-perso`)._')
    W('')
  }

  // ------------------------------------------------------------- attention
  // ⚠ LA SECTION QUI SERT LE BUT DU SCRIPT. Tout le reste décrit ce qui EST ;
  // celle-ci nomme ce qui MANQUE, ce qui est la question posée.
  W('## Points d’attention — ce qui semble manquer')
  W('')
  const alertes = []
  for (const l of db.lots || []) {
    if (vide(l.superficie)) alertes.push(`Parcelle **${l.numero}** : superficie absente — elle porte le poids de vote et la répartition des charges.`)
    if (!parCle(db.proprietaires, 'lot_id', l.id).some((p) => !p.date_cession)) alertes.push(`Parcelle **${l.numero}** : aucun propriétaire actuel.`)
  }
  for (const p of db.proprietaires || []) {
    if (!p.date_cession && vide(p.email) && vide(p.adresse) && vide(p.mandataire_email)) {
      alertes.push(`Propriétaire **${p.nom}** : ni e-mail, ni adresse, ni mandataire — injoignable pour une convocation.`)
    }
  }
  for (const ag of db.assemblees_generales || []) {
    const docs = Array.isArray(ag.documents) ? ag.documents : []
    if (ag.statut === 'cloturee' && !docs.some((d) => d.categorie === 'pv')) {
      alertes.push(`AG **${ag.numero}** : clôturée sans procès-verbal joint.`)
    }
    if (!docs.some((d) => d.categorie === 'convocation')) {
      alertes.push(`AG **${ag.numero}** : aucune convocation jointe — c'est elle qui prouve la régularité de l'appel.`)
    }
    if (vide(ag.m2_presents) && ag.statut === 'cloturee') alertes.push(`AG **${ag.numero}** : m² présents non renseignés, taux de participation incalculable.`)
  }
  for (const r of db.resolutions_ag || []) {
    if (r.statut === 'adoptee' && !vide(r.budget_alloue) && !r.projet_id) {
      alertes.push(`Résolution n° ${r.numero} de ${nomAG(r.ag_id)} : enveloppe de ${eur(r.budget_alloue)} adoptée mais non affectée à un projet.`)
    }
  }
  for (const m of (db.membres_cs || []).filter((x) => x.actif)) {
    if (!parCle(db.mandats_cs, 'membre_id', m.id).length) alertes.push(`Membre **${m.prenom} ${m.nom}** : aucun mandat enregistré.`)
  }
  // Fichiers du Storage que plus aucune ligne ne cite : orphelins assumés, mais
  // il faut pouvoir les voir pour juger.
  const cites = new Set()
  for (const t of tables) for (const row of db[t]) {
    if (Array.isArray(row.documents)) for (const d of row.documents) if (d.path) cites.add(d.path)
  }
  const orphelins = [...fichiers].filter((f) => !cites.has(f))
  if (orphelins.length) alertes.push(`${orphelins.length} fichier(s) dans le Storage ne sont cités par aucune ligne : ${orphelins.slice(0, 10).join(', ')}${orphelins.length > 10 ? '…' : ''}`)

  if (!alertes.length) W('_Rien à signaler : aucun manque détecté par les contrôles ci-dessus._')
  else for (const a of alertes) W(`- ${a}`)
  W('')
  W('> ⚠ Ces contrôles sont une aide, pas une garantie : ils ne vérifient que ce qu’on a')
  W('> pensé à leur demander. Une information absente d’une colonne qu’ils n’examinent')
  W('> pas ne sera pas signalée.')
  W('')

  // ------------------------------------------------------------- reste
  // ⚠ TOUTE TABLE NON RENDUE CI-DESSUS EST DUMPÉE ICI, brute. C'est le filet :
  // une table ajoutée par une migration future apparaîtra, même mal présentée,
  // au lieu de disparaître en silence de l'export — le mode de ruine dont
  // backup.mjs a déjà souffert.
  const rendues = new Set([
    'parametres', 'membres_cs', 'mandats_cs', 'assemblees_generales', 'comptes_ag',
    'resolutions_ag', 'projets', 'journal_projet', 'questions_reponses_projet',
    'decisions', 'votes', 'questions_reponses', 'sujets', 'sujet_entrees',
    'lots', 'proprietaires',
  ])
  const restantes = tables.filter((t) => !rendues.has(t) && db[t].length)
  if (restantes.length) {
    W('## Autres tables (journaux techniques et tables non mises en forme)')
    W('')
    for (const t of restantes) {
      const rows = db[t]
      const ecrete = !TOUT && rows.length > PLAFOND_JOURNAL
      W(`### ${t} — ${rows.length} ligne(s)${ecrete ? ` · **${PLAFOND_JOURNAL} dernières affichées**, relancer avec \`--tout\` pour l’intégralité` : ''}`)
      W('')
      W('```json')
      W(JSON.stringify(ecrete ? rows.slice(-PLAFOND_JOURNAL) : rows, null, 2))
      W('```')
      W('')
    }
  }

  const stamp = new Date().toISOString().slice(0, 19).replaceAll(':', '-')
  await mkdir('export', { recursive: true })
  const chemin = join('export', `registre-${stamp}${SANS_PERSO ? '-sans-perso' : ''}.md`)
  await writeFile(chemin, out.join('\n'))

  console.log(`✅ ${chemin}`)
  console.log(`   ${tables.length} tables, ${Object.values(db).reduce((s, r) => s + r.length, 0)} lignes, ${fichiers.size} fichier(s) dans le Storage.`)
  console.log(`   ${alertes.length} point(s) d’attention.`)
  if (!SANS_PERSO) console.log('   ⚠ Contient des données personnelles — ne pas partager, ne pas committer.')
}

main().catch((e) => {
  console.error(`❌ ${e.message}`)
  process.exit(1)
})
