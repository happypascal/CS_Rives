// localStorage-backed demo backend. Same async repository interface as
// supabaseDb.js. Model v2 (révisé 2026-07-14) :
//   - décisions CS : 3 dates (publication / limite réponse / enregistrement),
//     vote self-only pour/contre/abstention, enregistrement par le président
//     (verrou après), budget alloué (attribut), rattachement AG, pièces jointes.
//   - résolutions AG : résultat seul (majorité + statut) + budget alloué.
//   - signature : par LOT de décisions sélectionnées.

import { PROJET_ACTION_STATUT } from './projetLogic'
import { compareProjets } from './projetLogic'
import { compareResolutions, numeroResolution } from './agLogic'
import { engagementTTC, phaseOf, avantSoumission, contenuAGeler, nextNumero, PHASE_LABELS } from './decisionLogic'
import { todayISO, addBusinessDaysISO, formatDateTime } from './format'

// v14 : numéro attribué à la soumission (migration 034) — les brouillons de
// démo n'ont plus de numéro. Le numéro de version force le reseed.
// (v13 : sous-numéros de résolutions, 032. v12 : PJ sur l'AG, 031. v11 : 029.)
const STORAGE_KEY = 'cs_rives_mockdb_v15'
const SESSION_KEY = 'cs_rives_session'

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))

const nowISO = () => new Date().toISOString()
const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms))
// Data URL UTF-8 (évite btoa qui échoue sur les caractères non-Latin1 : —, €, …).
const textDataUrl = (s) => 'data:text/plain;charset=utf-8,' + encodeURIComponent(s)

// Empreinte SHA-256 hexadécimale d'une chaîne UTF-8. Doit donner EXACTEMENT le
// même résultat que `encode(sha256(convert_to(t,'UTF8')),'hex')` côté Postgres
// (trigger `decisions_cycle_guard`, migration 026) : c'est la même valeur
// probante, quel que soit le backend.
async function sha256Hex(texte) {
  const octets = new TextEncoder().encode(texte)
  const digest = await crypto.subtle.digest('SHA-256', octets)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ---------------------------------------------------------------- seed
function seed() {
  const mPresident = uid()
  const mVice = uid()
  const m3 = uid()
  const m4 = uid()
  const m5 = uid()
  const mTres = uid()

  // 5 membres actifs (art. 14 : 3 à 5) : président + trésorier + 3 membres. C'est
  // le minimum pour tester la règle d'engagement (point 3) — il faut 3 membres
  // ordinaires pour former une majorité SANS le bureau. Marc Petit reste un ancien
  // membre (inactif), pour l'exemple d'un mandat terminé.
  const membres_cs = [
    { id: mPresident, nom: 'Favre', prenom: 'Pascal', email: 'pfavre25@gmail.com', role: 'president', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: mTres, nom: 'Roux', prenom: 'Bernard', email: 'bernard.roux@example.fr', role: 'tresorier', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: mVice, nom: 'Martin', prenom: 'Claire', email: 'claire.martin@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m3, nom: 'Dubois', prenom: 'Henri', email: 'henri.dubois@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m4, nom: 'Leroy', prenom: 'Sophie', email: 'sophie.leroy@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m5, nom: 'Petit', prenom: 'Marc', email: 'marc.petit@example.fr', role: 'membre', date_election: '2024-06-15', date_fin: '2025-06-19', ag_election: 'AGO 15 juin 2024', actif: false, created_at: '2024-06-15T18:00:00Z' },
  ]

  const accounts = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({ id: m.id, email: m.email, password: 'demo', role: m.role === 'president' ? 'admin' : 'membre', membre_id: m.id }))

  const agAGO = uid()
  const agAGO2026 = uid()
  const agAGE = uid()
  const assemblees_generales = [
    { id: agAGO, numero: 'AGO-2025-01', type: 'AGO', date_ag: '2025-06-19', lieu: 'Salle des fêtes de Nernier', president_seance: 'Pascal Favre', ordre_du_jour: '1. Approbation des statuts ASL\n2. Élection du Conseil Syndical\n3. Budget travaux voirie 2025', statut: 'cloturee', pv_url: null, documents: [], created_at: '2025-06-19T18:00:00Z', updated_at: '2025-06-20T09:00:00Z' },
    // AG tenue : c'est elle qui vote la rallonge du projet voirie ouvert en 2025.
    { id: agAGO2026, numero: 'AGO-2026-01', type: 'AGO', date_ag: '2026-03-20', lieu: 'Salle des fêtes de Nernier', president_seance: 'Pascal Favre', ordre_du_jour: '1. Comptes 2025\n2. Complément de budget voirie', statut: 'cloturee', pv_url: null, documents: [], created_at: '2026-03-20T18:00:00Z', updated_at: '2026-03-21T09:00:00Z' },
    // AG à venir : président de séance non désigné, résolutions encore à voter.
    { id: agAGE, numero: 'AGE-2026-01', type: 'AGE', date_ag: '2026-09-12', lieu: 'Mairie de Nernier', president_seance: null, ordre_du_jour: '1. Travaux réfection réseau eaux pluviales\n2. Appel de fonds exceptionnel', statut: 'convoquee', pv_url: null, documents: [], created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
  ]

  // p1 est déclaré AVANT resolutions_ag : ce sont les résolutions qui pointent le
  // projet (resolutions_ag.projet_id), plus l'inverse.
  const p1 = uid()

  const rApprobStatuts = uid()
  const rElection = uid()
  const rBudgetVoirie = uid()
  const rProvision = uid()
  const rVoirieComplement = uid()
  const rEauxPluviales = uid()
  const resolutions_ag = [
    { id: rApprobStatuts, ag_id: agAGO, numero: 1, titre: 'Approbation des statuts de l’ASL', description: "L'assemblée approuve les statuts de l'ASL du Lotissement de Rives.", majorite_requise: 'double_qualifiee', statut: 'adoptee', budget_alloue: 4200, budget_intitule: 'Honoraires Me Garnier — statuts ASL', observations: 'Double majorité qualifiée atteinte (détail au PV).', projet_id: null, created_at: '2025-06-19T18:30:00Z' },
    { id: rElection, ag_id: agAGO, numero: 2, titre: 'Élection des membres du Conseil Syndical', description: 'Élection de Pascal Favre (président), Claire Martin, Henri Dubois, Sophie Leroy.', majorite_requise: 'simple', statut: 'adoptee', budget_alloue: null, budget_intitule: '', observations: '', projet_id: null, created_at: '2025-06-19T19:00:00Z' },
    { id: rBudgetVoirie, ag_id: agAGO, numero: 3, titre: 'Budget travaux de voirie 2025', description: 'Réfection de la voirie principale, répartie à la superficie.', majorite_requise: 'absolue', statut: 'adoptee', budget_alloue: 85000, budget_intitule: 'Réfection voirie principale', observations: '', projet_id: p1, created_at: '2025-06-19T19:30:00Z' },
    { id: rProvision, ag_id: agAGO, numero: 4, titre: 'Provision entretien & espaces verts 2025', description: 'Enveloppe annuelle pour l’entretien courant et les espaces verts communs.', majorite_requise: 'simple', statut: 'adoptee', budget_alloue: 12000, budget_intitule: 'Provision entretien espaces verts', observations: 'Le CS engage les dépenses dans la limite de cette enveloppe.', projet_id: null, created_at: '2025-06-19T19:45:00Z' },
    // Le cas qui justifie le modèle : une 2e AG rallonge l'enveloppe d'un projet
    // déjà ouvert. Le budget du projet passe de 85 000 à 105 000 sans que personne
    // ne saisisse "105 000" — il se dérive des deux résolutions.
    { id: rVoirieComplement, ag_id: agAGO2026, numero: 1, titre: 'Complément de budget — voirie principale', description: 'Rallonge votée après la découverte d’un affaissement sur le tronçon nord.', majorite_requise: 'absolue', statut: 'adoptee', budget_alloue: 20000, budget_intitule: 'Complément réfection voirie', observations: 'Complète la résolution n°3 de l’AGO 2025.', projet_id: p1, created_at: '2026-03-20T18:30:00Z' },
    // AGE à venir : inscrite à l'ordre du jour, pas encore votée. Son budget est une
    // proposition — il n'est pas alloué et n'est pas engageable tant que l'AG n'a pas eu lieu.
    { id: rEauxPluviales, ag_id: agAGE, numero: 1, titre: 'Travaux de réfection du réseau d’eaux pluviales', description: 'Reprise du collecteur principal et des regards, suite au diagnostic de mars 2026.', majorite_requise: 'double_qualifiee', statut: 'a_voter', budget_alloue: 47000, budget_intitule: 'Réfection réseau eaux pluviales', observations: '', projet_id: null, created_at: '2026-07-01T10:15:00Z' },
  ]

  // Sous-numérotation (migration 032) : les résolutions de démo sont toutes
  // simples, donc rang 0. Posé en boucle plutôt qu'à la main sur chaque ligne —
  // en oublier une donnerait un `undefined` que le tri classerait au hasard.
  for (const r of resolutions_ag) r.sous_numero = 0

  const d1 = uid()
  const d2 = uid()
  const d3 = uid()
  const d4 = uid()
  const d5 = uid()
  const d6 = uid()

  // Projet financé par DEUX résolutions : 85 000 (AGO 2025) + 20 000 (AGO 2026).
  // Ni budget, ni ag_id, ni statut ici : les trois se dérivent — les deux premiers
  // des résolutions qui le pointent, le statut des engagements et des décisions.
  const projets = [
    {
      id: p1,
      nom: 'Réfection de la voirie principale',
      description: 'Exécution des travaux de voirie votés en AGO 2025, complétés en AGO 2026.',
      chef_projet_id: m3,
      // Adjoint (migration 028) : facultatif, autre membre du CS, mêmes droits.
      adjoint_projet_id: mVice,
      documents: [{ id: uid(), name: 'Cahier_des_charges_voirie.txt', type: 'text/plain', size: 40, dataUrl: textDataUrl('Cahier des charges — réfection voirie principale'), uploaded_at: '2025-07-02T09:00:00Z' }],
      date_ouverture: '2025-07-01',
      date_cloture: null,
      created_at: '2025-07-01T09:00:00Z',
      updated_at: '2025-09-05T10:00:00Z',
    },
  ]
  const decisions = [
    {
      id: d1, numero: '2026-001',
      date_publication: '2026-02-03', date_limite_reponse: '2026-02-12', date_enregistrement: '2026-02-10',
      titre: 'Choix du prestataire d’entretien des espaces verts',
      description: '<p>Le Conseil Syndical retient la société <strong>VertPro SARL</strong> pour l’entretien des espaces verts communs.</p><ul><li>Contrat d’un an renouvelable</li><li>Passage bimensuel</li></ul>',
      statut: 'adoptee', enregistree: true, quorum_atteint: true,
      montant_engage: 5800, ag_id: agAGO, resolution_id: rProvision,
      documents: [{ id: uid(), name: 'Offre_VertPro.txt', type: 'text/plain', size: 34, dataUrl: textDataUrl('Offre VertPro SARL — 5 800 € TTC/an'), uploaded_at: '2026-02-03T10:05:00Z' }],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-02-03T10:00:00Z', updated_at: '2026-02-10T11:00:00Z',
    },
    {
      id: d2, numero: '2026-002',
      date_publication: '2026-05-05', date_limite_reponse: '2026-05-14', date_enregistrement: '2026-05-14',
      titre: 'Installation d’un portail automatique à l’entrée du lotissement',
      description: '<p>Décision d’installer un <strong>portail automatique</strong> à l’entrée principale. Devis PortAlp : 12 400 € TTC.</p>',
      statut: 'rejetee', enregistree: true, quorum_atteint: true,
      montant_engage: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-05-05T10:00:00Z', updated_at: '2026-05-14T12:00:00Z',
    },
    {
      id: d3, numero: '2026-003',
      date_publication: '2026-07-08', date_limite_reponse: '2026-07-17', date_enregistrement: null,
      titre: 'Réparation de l’éclairage public — allée des Tilleuls',
      description: '<p>Remplacement de 4 lampadaires défectueux allée des Tilleuls. Devis en cours d’analyse.</p>',
      statut: 'en_cours', enregistree: false, quorum_atteint: null,
      montant_engage: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-07-08T09:00:00Z', updated_at: '2026-07-08T09:00:00Z',
    },
    {
      id: d4, numero: '2026-004',
      date_publication: '2026-06-20', date_limite_reponse: '2026-06-30', date_enregistrement: null,
      titre: 'Remplacement de la borne de recharge véhicules électriques',
      description: '<p>Proposition de remplacer la borne de recharge défectueuse du parking visiteurs. Deux devis reçus (voir pièces jointes à venir).</p>',
      statut: 'en_cours', enregistree: false, quorum_atteint: null,
      montant_engage: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mVice, created_at: '2026-06-20T09:00:00Z', updated_at: '2026-06-20T09:00:00Z',
    },
    {
      id: d5, numero: '2026-005',
      date_publication: '2026-06-01', date_limite_reponse: '2026-06-10', date_enregistrement: '2026-06-12',
      titre: 'Réfection du portail piéton (serrure et charnières)',
      description: '<p>Réparation du portail piéton de l’entrée : remplacement de la serrure et des charnières.</p>',
      statut: 'adoptee', enregistree: true, quorum_atteint: true,
      montant_engage: null, projet_id: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-06-01T09:00:00Z', updated_at: '2026-06-12T10:00:00Z',
    },
    {
      id: d6, numero: '2026-006',
      date_publication: '2026-03-02', date_limite_reponse: '2026-03-11', date_enregistrement: '2026-03-15',
      titre: 'Attribution du marché de réfection voirie — entreprise RoutesPlus',
      description: '<p>Attribution du marché de réfection de la voirie principale à <strong>RoutesPlus SAS</strong> pour 62 000 € TTC, dans le cadre du projet voirie.</p>',
      statut: 'adoptee', enregistree: true, quorum_atteint: true,
      montant_engage: 62000, projet_id: p1, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: m3, created_at: '2026-03-02T09:00:00Z', updated_at: '2026-03-15T10:00:00Z',
    },
  ]

  // Colonnes du cycle de vie (migration 026). Les décisions de démo existantes
  // sont, comme celles déjà en base côté prod, DÉJÀ soumises au vote — d'où
  // `phase: 'ouverte_au_vote'`. `contenu_gele` reste null : elles précèdent le
  // gel, et le mock doit reproduire ce cas (une décision non gelée reste
  // modifiable par son owner jusqu'à l'enregistrement).
  for (const d of decisions) {
    d.phase = 'ouverte_au_vote'
    d.version = 1
    d.visibilite = 'cs_seul'
    d.delai_vote_jours = 7
    d.date_soumission_prevue = null
    d.soumise_le = null
    d.contenu_gele = null
    d.hash_contenu = null
    d.motif_annulation = null
  }

  // Les deux cas que la migration 026 ouvre : un brouillon en cours de rédaction,
  // et une décision PLANIFIÉE dont le vote s'ouvrira tout seul.
  //
  // ⚠ Texte de DÉMONSTRATION. Le cas d'usage réel (spec §10) est la « Règle de
  // représentation et de contacts extérieurs », à soumettre au CS après l'AG du
  // 15 septembre 2026 — mais son texte appartient au conseil, pas à la démo :
  // les six articles ci-dessous sont une trame, à remplacer par la rédaction
  // réelle avant de créer la décision en production.
  const d7 = uid()
  const d8 = uid()
  decisions.push(
    {
      id: d7, numero: null,
      date_publication: '2026-08-25', date_limite_reponse: null, date_enregistrement: null,
      titre: 'Convention d’entretien du bassin de rétention',
      description: '<p>Brouillon en cours de rédaction : cadre d’entretien annuel du bassin de rétention (périodicité, prestataire, contrôle).</p>',
      statut: 'en_cours', enregistree: false, quorum_atteint: null,
      montant_engage: null, projet_id: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mVice, created_at: '2026-08-25T09:00:00Z', updated_at: '2026-08-25T09:00:00Z',
      phase: 'brouillon', version: 2, visibilite: 'cs_seul', delai_vote_jours: 7,
      date_soumission_prevue: null, soumise_le: null, contenu_gele: null, hash_contenu: null,
      motif_annulation: null,
    },
    {
      id: d8, numero: null,
      // Ces deux dates seront REPOSÉES au jour de l'ouverture réelle : c'est tout
      // l'objet de la planification (le vote doit revenir au conseil désigné par
      // l'AG du 15 septembre, pas à l'ancien).
      date_publication: '2026-08-25', date_limite_reponse: null, date_enregistrement: null,
      titre: 'Règle de représentation et de contacts extérieurs',
      description:
        '<p><strong>Article 1 — Objet.</strong> La présente règle fixe qui représente le Conseil Syndical à l’extérieur et dans quelles limites.</p>' +
        '<p><strong>Article 2 — Représentation.</strong> Le président représente l’ASL auprès des tiers. Il peut donner mandat écrit et ponctuel à un autre membre.</p>' +
        '<p><strong>Article 3 — Contacts avec le syndic.</strong> Les échanges avec Foncia passent par le président ou le membre mandaté ; les autres membres sont tenus informés.</p>' +
        '<p><strong>Article 4 — Devis et prestataires.</strong> Tout contact engageant une dépense fait l’objet d’une décision du CS avant signature.</p>' +
        '<p><strong>Article 5 — Communication aux colotis.</strong> Toute communication au nom du CS est validée en séance ou par décision inscrite au registre.</p>' +
        '<p><strong>Article 6 — Entrée en vigueur.</strong> La règle s’applique dès l’enregistrement de la présente décision et jusqu’à décision contraire du CS.</p>',
      statut: 'en_cours', enregistree: false, quorum_atteint: null,
      montant_engage: null, projet_id: null, ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-08-25T10:00:00Z', updated_at: '2026-08-25T10:00:00Z',
      phase: 'planifiee', version: 1, visibilite: 'cs_seul', delai_vote_jours: 7,
      date_soumission_prevue: '2026-09-16T08:00:00Z', soumise_le: null, contenu_gele: null, hash_contenu: null,
      motif_annulation: null,
    },
  )

  const decisions_historique = [
    { id: uid(), decision_id: d7, version: 2, titre: 'Convention d’entretien du bassin de rétention', contenu: '<p>Brouillon en cours de rédaction : cadre d’entretien annuel du bassin de rétention (périodicité, prestataire, contrôle).</p>', modifie_par: mVice, modifie_le: '2026-08-25T09:00:00Z' },
  ]

  const activeSnapshot = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({ id: m.id, nom: m.nom, prenom: m.prenom, role: m.role, ag_election: m.ag_election, date_election: m.date_election }))
  decisions[0].composition_snapshot = activeSnapshot
  decisions[1].composition_snapshot = activeSnapshot
  decisions[4].composition_snapshot = activeSnapshot // d5 (adoptée, enregistrée)
  decisions[5].composition_snapshot = activeSnapshot // d6 (adoptée, enregistrée)

  // Partage au CS : d4 volontairement laissée non notifiée (badge « à notifier »).
  decisions[0].date_notification = '2026-07-02T08:30:00Z'
  decisions[1].date_notification = '2026-05-05T11:00:00Z'
  decisions[2].date_notification = '2026-07-08T09:15:00Z'
  decisions[4].date_notification = '2026-06-01T09:30:00Z'
  decisions[5].date_notification = '2026-03-02T09:20:00Z'

  const votes = [
    // d1 — adoptée
    { id: uid(), decision_id: d1, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-02-04T10:30:00Z' },
    { id: uid(), decision_id: d1, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-02-05T10:31:00Z' },
    { id: uid(), decision_id: d1, membre_id: m3, vote: 'pour', commentaire: 'Prestataire sérieux.', date_vote: '2026-02-05T10:32:00Z' },
    { id: uid(), decision_id: d1, membre_id: m4, vote: 'abstention', commentaire: '', date_vote: '2026-02-06T10:33:00Z' },
    // d2 — rejetée (2 pour / 2 contre)
    { id: uid(), decision_id: d2, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-05-06T10:30:00Z' },
    { id: uid(), decision_id: d2, membre_id: mVice, vote: 'contre', commentaire: 'Coût trop élevé.', date_vote: '2026-05-07T10:31:00Z' },
    { id: uid(), decision_id: d2, membre_id: m3, vote: 'pour', commentaire: '', date_vote: '2026-05-07T10:32:00Z' },
    { id: uid(), decision_id: d2, membre_id: m4, vote: 'contre', commentaire: '', date_vote: '2026-05-08T10:33:00Z' },
    // d3 — en cours (partiel)
    { id: uid(), decision_id: d3, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-07-09T09:00:00Z' },
    { id: uid(), decision_id: d3, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-07-09T09:05:00Z' },
    // d4 — en cours, date limite dépassée ; Pascal (président) n'a pas voté -> "à voter" + en retard
    { id: uid(), decision_id: d4, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-06-21T09:00:00Z' },
    { id: uid(), decision_id: d4, membre_id: m3, vote: 'contre', commentaire: 'Attendre un 3e devis.', date_vote: '2026-06-22T09:05:00Z' },
    // d5 — adoptée, enregistrée, NON signée -> sélectionnable pour la signature groupée
    { id: uid(), decision_id: d5, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-06-02T09:00:00Z' },
    { id: uid(), decision_id: d5, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-06-02T09:05:00Z' },
    { id: uid(), decision_id: d5, membre_id: m3, vote: 'abstention', commentaire: '', date_vote: '2026-06-03T09:05:00Z' },
    { id: uid(), decision_id: d5, membre_id: m4, vote: 'pour', commentaire: '', date_vote: '2026-06-03T10:05:00Z' },
    // d6 — adoptée, rattachée au projet voirie (engage 62 000 €)
    { id: uid(), decision_id: d6, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-03-03T09:00:00Z' },
    { id: uid(), decision_id: d6, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-03-03T09:05:00Z' },
    { id: uid(), decision_id: d6, membre_id: m3, vote: 'pour', commentaire: '', date_vote: '2026-03-03T09:06:00Z' },
    { id: uid(), decision_id: d6, membre_id: m4, vote: 'pour', commentaire: '', date_vote: '2026-03-04T10:05:00Z' },
  ]

  const q1 = uid()
  const questions_reponses = [
    { id: q1, decision_id: d1, auteur_id: m4, type: 'question', parent_id: null, texte: 'Le contrat inclut-il le ramassage des feuilles en automne ?', created_at: '2026-02-04T14:00:00Z' },
    { id: uid(), decision_id: d1, auteur_id: mPresident, type: 'reponse', parent_id: q1, texte: 'Oui, deux passages spécifiques en octobre et novembre.', created_at: '2026-02-04T16:00:00Z' },
  ]

  // Aucun lot de signature au départ : 2026-001 et 2026-005 (adoptées, enregistrées)
  // sont sélectionnables pour tester la signature groupée.
  const signature_batches = []

  const decision_status_history = [
    { id: uid(), decision_id: d1, ancien_statut: 'en_cours', nouveau_statut: 'adoptee', changed_by: mPresident, changed_at: '2026-02-10T11:00:00Z' },
    { id: uid(), decision_id: d2, ancien_statut: 'en_cours', nouveau_statut: 'rejetee', changed_by: mPresident, changed_at: '2026-05-14T12:00:00Z' },
  ]

  const audit_log = [
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'create', acteur: mPresident, details: 'Création décision 2026-001', created_at: '2026-02-03T10:00:00Z' },
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'record', acteur: mPresident, details: 'Enregistrement — adoptée', created_at: '2026-02-10T11:00:00Z' },
  ]

  // Approbations de comptes d'AGO (trésorier + président). Vide au départ.
  const comptes_ag = []

  // Journal des ouvertures automatiques : vide au départ, alimenté seulement
  // quand une décision planifiée est réellement ouverte (jamais à vide).
  const cron_runs = []

  // Registre des propriétaires : vide au départ. Il sera alimenté depuis les
  // fichiers du syndic — inventer des noms et des adresses de personnes dans un
  // jeu de démonstration serait exactement ce que la mention RGPD interdit.
  const lots = []
  const proprietaires = []

  // Fil d'échanges du projet voirie : montre le cas d'usage — deux membres qui
  // se répondent par écrit entre deux réunions.
  // Journal de bord du projet voirie. La 2e ligne montre le cas qui justifie la
  // date modifiable : action du 12/05, saisie le 20 (created_at plus tardif).
  const journal_projet = [
    { id: uid(), projet_id: p1, date_action: '2026-04-08', texte: 'Réunion de lancement avec RoutesPlus sur site. Tracé validé, base vie côté parking visiteurs.', auteur_id: m3, created_at: '2026-04-08T18:00:00Z', updated_at: '2026-04-08T18:00:00Z' },
    { id: uid(), projet_id: p1, date_action: '2026-05-12', texte: 'Visite de chantier : décaissement du tronçon nord terminé, deux regards à reprendre (hors devis initial).', auteur_id: m3, created_at: '2026-05-20T09:30:00Z', updated_at: '2026-05-20T09:30:00Z' },
    { id: uid(), projet_id: p1, date_action: '2026-06-03', texte: 'Relance de RoutesPlus sur le planning de reprise des regards. Sans réponse à ce jour.', auteur_id: mVice, created_at: '2026-06-03T11:00:00Z', updated_at: '2026-06-03T11:00:00Z' },
  ]

  const qProjet = uid()
  const questions_reponses_projet = [
    { id: qProjet, projet_id: p1, auteur_id: mVice, type: 'question', parent_id: null, texte: 'RoutesPlus a-t-il confirmé la date de démarrage du tronçon nord ?', created_at: '2026-04-02T09:00:00Z' },
    { id: uid(), projet_id: p1, auteur_id: m3, type: 'reponse', parent_id: qProjet, texte: 'Oui, semaine 18, sous réserve météo. Je relance dix jours avant.', created_at: '2026-04-02T14:20:00Z' },
    { id: uid(), projet_id: p1, auteur_id: m3, type: 'commentaire', parent_id: null, texte: 'Reconnaissance faite sur place le 5 avril : deux regards à reprendre en plus du devis initial.', created_at: '2026-04-05T17:00:00Z' },
  ]

  return { accounts, membres_cs, assemblees_generales, resolutions_ag, projets, decisions, votes, questions_reponses, signature_batches, decision_status_history, decisions_historique, cron_runs, questions_reponses_projet, journal_projet, lots, proprietaires, comptes_ag, audit_log }
}

// ---------------------------------------------------------------- store
function load() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      /* reseed */
    }
  }
  const data = seed()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  return data
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function resetMockDb() {
  const data = seed()
  save(data)
  return data
}

function audit(data, entite, entite_id, action, details) {
  data.audit_log.push({ id: uid(), entite, entite_id, action, acteur: getSessionUserId(), details: details || '', created_at: nowISO() })
}

function getSessionUser() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.user ?? null
  } catch {
    return null
  }
}

function getSessionUserId() {
  return getSessionUser()?.membre_id ?? null
}

// Miroir des policies restrictives `decisions_avant_soumission_privee` /
// `decisions_brouillon_update_auteur` / `decisions_brouillon_delete_auteur`
// (migration 026) : un brouillon — ou une décision planifiée, qui est un
// brouillon daté — n'existe QUE pour son auteur.
//
// ⚠ Pas d'exception pour le président (arbitrage Pascal 2026-08-25) : demander
// une décision au conseil n'est pas un pouvoir présidentiel. Il ne voit, ne
// modifie, ne soumet ni ne supprime le brouillon d'un autre. Sa prérogative
// propre est l'ACTE — enregistrer une délibération votée — et la signature.
//
// Une décision ANNULÉE, elle, est visible de tous : annuler est l'acte délibéré
// de laisser une trace au registre.
//
// Reproduit ici pour que la démo montre le même registre que la prod. Cela ne
// PROUVE rien sur la RLS (le mock n'a pas de policies) — seul le staging le peut.
function aLaMain(d, user) {
  if (!avantSoumission(d)) return true
  return Boolean(user) && d.created_by === user.membre_id
}

// ---------------------------------------------------------------- session/auth
export const mockAuth = {
  async signIn(email, password) {
    await delay()
    const data = load()
    const acc = data.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!acc || acc.password !== password) throw new Error('Identifiants invalides.')
    const membre = data.membres_cs.find((m) => m.id === acc.membre_id)
    // `role` = rôle d'AUTH (admin/membre, pilote isAdmin). `membre_role` = rôle
    // du bureau tel quel (president/tresorier/secretaire/membre), pour
    // isSecretaire / isTresorier. Les deux sont distincts à dessein.
    const user = { id: acc.id, email: acc.email, role: acc.role, membre_role: membre?.role ?? null, membre_id: acc.membre_id, nom: membre?.nom, prenom: membre?.prenom, registre_rgpd_accepte_le: membre?.registre_rgpd_accepte_le ?? null }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user }))
    return user
  },
  async signOut() {
    await delay(20)
    localStorage.removeItem(SESSION_KEY)
  },
  getSession() {
    try {
      const user = JSON.parse(localStorage.getItem(SESSION_KEY))?.user ?? null
      if (!user) return null
      // Self-heal : si le membre de la session n'existe plus (reseed / nouvelle
      // version de la base démo), on invalide la session pour forcer un re-login.
      const data = load()
      if (!data.accounts.some((a) => a.membre_id === user.membre_id)) {
        localStorage.removeItem(SESSION_KEY)
        return null
      }
      // Rafraîchit membre_role depuis la base : un changement de rôle (ou une
      // session stockée avant l'ajout du champ) se reflète au rechargement.
      const membre = data.membres_cs.find((m) => m.id === user.membre_id)
      // Relu à chaque chargement : l'acceptation RGPD posée dans une autre
      // session doit être vue, sinon la mention se redemanderait sans fin.
      return { ...user, membre_role: membre?.role ?? null, registre_rgpd_accepte_le: membre?.registre_rgpd_accepte_le ?? null }
    } catch {
      return null
    }
  },
  async resetPassword(email) {
    await delay()
    return { ok: true, email }
  },
}

// ---------------------------------------------------------------- repository
const clone = (v) => JSON.parse(JSON.stringify(v))
const byDateDesc = (k) => (a, b) => (a[k] < b[k] ? 1 : a[k] > b[k] ? -1 : 0)

// Une résolution n'OUVRE un budget que si l'AG l'a ADOPTÉE et l'a dotée. Une
// résolution `a_voter` n'est qu'une proposition à l'ordre du jour ; `rejetee` /
// `retiree` n'allouent rien.
//
// Prédicat unique et exporté À DESSEIN : la règle est lue par computeAGBudgets
// (enveloppe côté AG) ET par computeProjectBudgets (budget dérivé côté projet).
// Dupliquée, elle divergerait — et une résolution d'augmentation encore `a_voter`
// gonflerait le budget d'un projet sans que l'AG l'ait votée.
export const ouvreUnBudget = (r) =>
  r.statut === 'adoptee' && r.budget_alloue != null && r.budget_alloue !== ''

// Une décision PÈSE-t-elle sur un budget ? (migration 026)
//
// Une décision ANNULÉE n'engage rien, jamais : elle a été retirée avant même
// d'être soumise. Un BROUILLON ou une décision PLANIFIÉE non plus — le conseil
// n'en a pas encore été saisi, ce n'est pas même une proposition en cours de
// vote. Sans ce filtre, un brouillon chiffré à 20 000 € apparaîtrait en
// « engagé en cours » sur l'enveloppe et ferait croire l'argent réservé.
//
// Prédicat unique, lu par computeAGBudgets ET computeProjectBudgets : dupliqué,
// il divergerait (c'est exactement le piège qu'`ouvreUnBudget` évite côté AG).
export const peseSurLeBudget = (d) => !avantSoumission(d) && phaseOf(d) !== 'annulee'

// Budgets AG (enveloppe votée par résolution). Le "restant" tient compte à la
// fois des engagements DIRECTS (décisions sans projet) et de l'enveloppe
// transférée au projet que la résolution finance.
export function computeAGBudgets(data) {
  const agById = Object.fromEntries(data.assemblees_generales.map((a) => [a.id, a]))
  const projetById = Object.fromEntries((data.projets || []).map((p) => [p.id, p]))
  const budgets = data.resolutions_ag.filter(ouvreUnBudget)
  return budgets.map((r) => {
    const ag = agById[r.ag_id]
    const alloue = Number(r.budget_alloue)
    // Engagements directs (décisions rattachées à la résolution, sans projet).
    const direct = data.decisions.filter((d) => d.resolution_id === r.id && !d.projet_id && d.montant_engage != null && peseSurLeBudget(d))
    const engageDirect = direct.filter((d) => d.enregistree && d.statut === 'adoptee').reduce((s, d) => s + engagementTTC(d), 0)
    const directEnCours = direct.filter((d) => !d.enregistree).reduce((s, d) => s + engagementTTC(d), 0)
    // L'enveloppe est indivisible : si la résolution finance un projet, elle y
    // passe EN ENTIER (le projet ne prend pas "une partie" d'une résolution).
    // D'où un restant nul côté AG — l'argent n'a pas disparu, il se suit
    // désormais sur le projet, où les décisions viennent l'engager.
    const projet = r.projet_id ? projetById[r.projet_id] : null
    const projetsAlloue = projet ? alloue : 0
    const engage = engageDirect + projetsAlloue
    return {
      resolution_id: r.id,
      ag_id: r.ag_id,
      ag_numero: ag?.numero || 'AG',
      ag_date: ag?.date_ag || null,
      resolution_numero: numeroResolution(r),
      intitule: r.budget_intitule || r.titre,
      alloue,
      engage,
      engage_direct: engageDirect,
      projets_alloue: projetsAlloue,
      engage_en_cours: directEnCours,
      restant: alloue - engage,
      projet_id: r.projet_id || null,
      engagements: direct.map((d) => ({ id: d.id, numero: d.numero, titre: d.titre, montant: engagementTTC(d), statut: d.statut, enregistree: d.enregistree })),
      projets: projet ? [{ id: projet.id, nom: projet.nom, budget_alloue: alloue }] : [],
    }
  })
}

// Budgets par PROJET : alloué (somme des résolutions qui le financent) / engagé
// (décisions adoptées rattachées) / restant. + méta chef et résolutions sources.
export function computeProjectBudgets(data) {
  const agById = Object.fromEntries(data.assemblees_generales.map((a) => [a.id, a]))
  const memById = Object.fromEntries(data.membres_cs.map((m) => [m.id, m]))
  return (data.projets || []).map((p) => {
    const liees = data.decisions.filter((d) => d.projet_id === p.id && d.montant_engage != null && peseSurLeBudget(d))
    const engage = liees.filter((d) => d.enregistree && d.statut === 'adoptee').reduce((s, d) => s + engagementTTC(d), 0)
    const engageEnCours = liees.filter((d) => !d.enregistree).reduce((s, d) => s + engagementTTC(d), 0)

    // Le budget du projet est DÉRIVÉ, jamais stocké : somme des enveloppes votées
    // qui le financent. Une 2e résolution votée l'an prochain l'augmente d'elle-même.
    // `sources` = toutes les résolutions rattachées, y compris celles qui n'ouvrent
    // pas (encore) de budget : l'écran doit pouvoir montrer une augmentation
    // soumise au vote sans la compter dans l'alloué.
    const sources = data.resolutions_ag.filter((r) => r.projet_id === p.id)
    const alloue = sources.filter(ouvreUnBudget).reduce((s, r) => s + Number(r.budget_alloue), 0)
    const chef = memById[p.chef_projet_id]
    const adjoint = memById[p.adjoint_projet_id]

    // ---- Statut : DÉRIVÉ, jamais saisi ----
    // Deux couches.
    //
    // 1. Le statut naturel, qui est un fait : « ouvert » = ouvert mais rien
    //    d'engagé ; dès qu'une décision y engage réellement de l'argent, le projet
    //    est « en cours ». Personne n'a à le ressaisir.
    // 2. Suspendre ou terminer est une DÉLIBÉRATION du CS, pas une case à cocher
    //    (arbitrage Pascal 2026-07-16) : seule une décision ENREGISTRÉE et ADOPTÉE
    //    portant un `projet_action` peut l'imposer — donc après quorum et vote.
    //
    // La DERNIÈRE décision enregistrée l'emporte : c'est ce qui rend « reprendre »
    // naturel et « terminé » réversible (choix explicite de Pascal). Rouvrir un
    // projet est alors, lui aussi, une délibération tracée au registre.
    // Statut NATUREL — celui qui vaut tant qu'aucune délibération n'en décide
    // autrement. Deux cas seulement depuis le resserrage du 2026-08-26 :
    //  - date d'ouverture À VENIR → « en préparation ». Corrige un vrai faux :
    //    un projet calé après l'AG (ouverture au 16/09) était annoncé « Ouvert »
    //    dès sa création alors qu'il n'a pas commencé. Dérivé de la date et
    //    jamais stocké, comme « AG a eu lieu » (effectiveAGStatut) : le jour dit,
    //    le projet bascule seul, sans que personne ait à y penser.
    //  - sinon → « en cours ».
    // ⚠ `ouvert` a disparu : il distinguait « ouvert mais rien d'engagé » de
    // « en cours », nuance vidée de son sens depuis que `en_preparation` existe.
    // C'est pourquoi `engage` n'entre plus dans le calcul du statut.
    const ouvertureAVenir = Boolean(p.date_ouverture) && p.date_ouverture > todayISO()
    const statutNaturel = ouvertureAVenir ? 'en_preparation' : 'en_cours'
    const actions = data.decisions
      .filter((d) => d.projet_id === p.id && d.enregistree && d.statut === 'adoptee' && d.projet_action)
      // date_enregistrement est une DATE (pas un timestamp) : deux décisions
      // enregistrées le même jour s'y égalisent. created_at les départage.
      .sort((a, b) => {
        const da = a.date_enregistrement || '', db = b.date_enregistrement || ''
        if (da !== db) return da < db ? -1 : 1
        return (a.created_at || '') < (b.created_at || '') ? -1 : 1
      })
    const derniereAction = actions[actions.length - 1]?.projet_action || null
    // 'reprendre' ne pose aucun statut : il rend la main au statut naturel.
    const statut = PROJET_ACTION_STATUT[derniereAction] || statutNaturel

    return {
      ...p,
      statut,
      alloue,
      engage,
      engage_en_cours: engageEnCours,
      restant: alloue - engage,
      chef_nom: chef ? `${chef.prenom} ${chef.nom}` : null,
      adjoint_nom: adjoint ? `${adjoint.prenom} ${adjoint.nom}` : null,
      // Trace lisible : d'où vient le statut, et par quelle délibération.
      statut_decision: derniereAction
        ? { action: derniereAction, decision_id: actions[actions.length - 1].id, numero: actions[actions.length - 1].numero, date: actions[actions.length - 1].date_enregistrement }
        : null,
      // AG d'origine : autant que de résolutions sources. Dédoublonné et trié par
      // date — un projet pluriannuel affiche « AGO-2025-01, AGE-2026-01 ».
      ags: [...new Map(sources.map((r) => [r.ag_id, agById[r.ag_id]]).filter(([, a]) => a))
        .values()].sort((a, b) => (a.date_ag < b.date_ag ? -1 : 1)),
      resolutions: sources
        .map((r) => ({
          id: r.id,
          numero: numeroResolution(r),
          titre: r.titre,
          statut: r.statut,
          budget_alloue: r.budget_alloue == null || r.budget_alloue === '' ? null : Number(r.budget_alloue),
          compte_dans_alloue: ouvreUnBudget(r),
          ag_id: r.ag_id,
          ag_numero: agById[r.ag_id]?.numero || null,
          ag_date: agById[r.ag_id]?.date_ag || null,
        }))
        .sort((a, b) => (a.ag_date < b.ag_date ? -1 : a.ag_date > b.ag_date ? 1 : a.numero - b.numero)),
      engagements: liees.map((d) => ({ id: d.id, numero: d.numero, titre: d.titre, montant: Number(d.montant_engage || 0), statut: d.statut, enregistree: d.enregistree })),
    }
  })
}

// Miroir du trigger `decisions_cycle_guard` (migration 026). Le mock est plus
// permissif que Supabase par nature (`Object.assign` avale tout) — ici il ne peut
// pas se le permettre : le gel du texte et son empreinte sont la valeur probante
// de la délibération. Toute règle changée ici doit l'être dans le trigger SQL.
//
// ⚠ Ce que le mock ne prouve toujours PAS : les policies (un membre peut-il
// vraiment voter sur un brouillon ?) et l'atomicité. Cela se vérifie en staging.
async function appliquerCycle(data, d, patch) {
  const avant = {
    phase: phaseOf(d),
    titre: d.titre,
    description: d.description,
    contenu_gele: d.contenu_gele ?? null,
    version: d.version || 1,
  }
  const apres = patch.phase ?? avant.phase
  const titre = patch.titre ?? d.titre
  const description = patch.description ?? d.description

  // 1. Transitions autorisées (spec §3). Une délibération soumise ne se
  //    dé-soumet pas ; une décision annulée reste au registre avec son motif.
  const TRANSITIONS = {
    brouillon: ['planifiee', 'ouverte_au_vote', 'annulee'],
    planifiee: ['brouillon', 'ouverte_au_vote', 'annulee'],
    ouverte_au_vote: [],
    annulee: [],
  }
  if (apres !== avant.phase && !TRANSITIONS[avant.phase].includes(apres)) {
    // Repli sur la valeur brute : une phase inconnue (faute de frappe, valeur
    // d'un autre axe comme 'adoptee') doit s'afficher telle quelle, pas
    // « undefined » — c'est justement le cas où le message doit aider.
    const nom = (p) => PHASE_LABELS[p] || p
    throw new Error(`Transition interdite : une décision « ${nom(avant.phase)} » ne peut pas passer en « ${nom(apres)} ».`)
  }

  // 2. Annulation : motif obligatoire.
  if (apres === 'annulee' && !String(patch.motif_annulation ?? d.motif_annulation ?? '').trim()) {
    throw new Error('Annulation impossible sans motif : le registre doit dire pourquoi la décision a été retirée.')
  }

  // 3. Gel du texte : une fois le vote ouvert, on ne réécrit plus ce sur quoi
  //    les membres votent. La garde porte sur `contenu_gele`, pas sur la phase —
  //    les décisions antérieures au gel gardent leur comportement d'avant.
  if (avant.contenu_gele != null && (titre !== avant.titre || description !== avant.description)) {
    throw new Error(`Texte gelé depuis le ${formatDateTime(d.soumise_le)} : la délibération soumise au vote n’est plus modifiable.`)
  }

  Object.assign(d, patch, { updated_at: nowISO() })

  // 4. Historique + version, tant que la décision est un brouillon (planifiée
  //    incluse : c'est un brouillon daté).
  const texteChange = titre !== avant.titre || description !== avant.description
  if ((avant.phase === 'brouillon' || avant.phase === 'planifiee') && texteChange) {
    d.version = avant.version + 1
    data.decisions_historique.push({
      id: uid(), decision_id: d.id, version: d.version,
      titre, contenu: description || '', modifie_par: getSessionUserId(), modifie_le: nowISO(),
    })
  }

  // 5. Ouverture du vote : gel, empreinte, et RECALAGE DES DATES.
  //    `date_publication` détermine la composition du CS appelée à voter et le
  //    dénominateur du quorum : une décision rédigée en août et ouverte le
  //    16 septembre doit revenir au conseil désigné le 15, pas à l'ancien.
  if (phaseOf(d) === 'ouverte_au_vote' && d.contenu_gele == null) {
    d.soumise_le = d.soumise_le || nowISO()
    d.contenu_gele = contenuAGeler(d)
    d.hash_contenu = await sha256Hex(d.contenu_gele)
    if (avant.phase === 'brouillon' || avant.phase === 'planifiee') {
      d.date_publication = todayISO()
      d.date_limite_reponse = addBusinessDaysISO(d.date_publication, d.delai_vote_jours || 7)
    }
    // NUMÉRO attribué ICI et nulle part ailleurs (migration 034), miroir du
    // trigger : un brouillon n'en a pas, donc l'abandonner ne laisse aucun trou
    // au registre. L'année est celle de l'ouverture.
    if (!d.numero) {
      d.numero = nextNumero(Number(d.date_publication.slice(0, 4)), data.decisions)
    }
  }
  return d
}

export const mockRepo = {
  // ---- Membres ----
  async listMembres() {
    await delay()
    return clone(load().membres_cs).sort((a, b) => a.nom.localeCompare(b.nom))
  },
  async createMembre(input) {
    await delay()
    const data = load()
    const m = { id: uid(), actif: true, created_at: nowISO(), ...input }
    data.membres_cs.push(m)
    if (input.email) data.accounts.push({ id: m.id, email: input.email, password: 'demo', role: input.role === 'president' ? 'admin' : 'membre', membre_id: m.id })
    audit(data, 'membres_cs', m.id, 'create', `Ajout membre ${m.prenom} ${m.nom}`)
    save(data)
    return clone(m)
  },
  async updateMembre(id, patch) {
    await delay()
    const data = load()
    const m = data.membres_cs.find((x) => x.id === id)
    if (!m) throw new Error('Membre introuvable')
    Object.assign(m, patch)
    audit(data, 'membres_cs', id, 'update', `Modification membre ${m.prenom} ${m.nom}`)
    save(data)
    return clone(m)
  },
  async deactivateMembre(id, date_fin) {
    return this.updateMembre(id, { actif: false, date_fin: date_fin || nowISO().slice(0, 10) })
  },

  // ---- AG ----
  async listAG() {
    await delay()
    return clone(load().assemblees_generales).sort(byDateDesc('date_ag'))
  },
  async getAG(id) {
    await delay()
    const data = load()
    const ag = data.assemblees_generales.find((a) => a.id === id)
    if (!ag) return null
    return {
      ...clone(ag),
      resolutions: clone(data.resolutions_ag.filter((r) => r.ag_id === id).sort(compareResolutions)),
      comptes: clone((data.comptes_ag || []).filter((c) => c.ag_id === id)),
    }
  },
  async createAG(input) {
    await delay()
    const data = load()
    const ag = { id: uid(), statut: 'preparation', documents: [], created_at: nowISO(), updated_at: nowISO(), ...input }
    data.assemblees_generales.push(ag)
    audit(data, 'assemblees_generales', ag.id, 'create', `Création AG ${ag.numero}`)
    save(data)
    return clone(ag)
  },
  async updateAG(id, patch) {
    await delay()
    const data = load()
    const ag = data.assemblees_generales.find((a) => a.id === id)
    if (!ag) throw new Error('AG introuvable')
    Object.assign(ag, patch, { updated_at: nowISO() })
    audit(data, 'assemblees_generales', id, 'update', `Modification AG ${ag.numero}`)
    save(data)
    return clone(ag)
  },
  async deleteAG(id) {
    await delay()
    const data = load()
    // Verrou : une AG dont une résolution/rattachement porte une décision ne peut être supprimée.
    if (data.decisions.some((d) => d.ag_id === id)) {
      throw new Error('AG non supprimable : au moins une décision y est rattachée.')
    }
    data.assemblees_generales = data.assemblees_generales.filter((a) => a.id !== id)
    data.resolutions_ag = data.resolutions_ag.filter((r) => r.ag_id !== id)
    data.comptes_ag = (data.comptes_ag || []).filter((c) => c.ag_id !== id)
    audit(data, 'assemblees_generales', id, 'delete', 'Suppression AG')
    save(data)
    return { ok: true }
  },

  // ---- Comptes AGO : co-validation trésorier + président (point 4) ----
  // Le sens du rôle (qui a le droit) est porté par la RLS en prod ; le mock,
  // plus permissif, ne le vérifie pas — c'est l'UI qui gate les boutons.
  async approveComptes(agId, role, membreId) {
    await delay()
    const data = load()
    data.comptes_ag ||= []
    if (!data.comptes_ag.some((c) => c.ag_id === agId && c.role === role)) {
      data.comptes_ag.push({ id: uid(), ag_id: agId, role, approuve_par: membreId, approuve_le: nowISO() })
      audit(data, 'assemblees_generales', agId, 'comptes', `Comptes approuvés (${role})`)
      save(data)
    }
    return { ok: true }
  },
  async unapproveComptes(agId, role) {
    await delay()
    const data = load()
    data.comptes_ag = (data.comptes_ag || []).filter((c) => !(c.ag_id === agId && c.role === role))
    save(data)
    return { ok: true }
  },

  // ---- Résolutions (résultat seul + budget alloué) ----
  async createResolution(input) {
    await delay()
    const data = load()
    const r = { id: uid(), created_at: nowISO(), observations: '', budget_alloue: null, budget_intitule: '', sous_numero: 0, ...input }
    data.resolutions_ag.push(r)
    audit(data, 'resolutions_ag', r.id, 'create', `Résolution ${numeroResolution(r)} — ${r.titre}`)
    save(data)
    return clone(r)
  },
  async updateResolution(id, patch) {
    await delay()
    const data = load()
    const r = data.resolutions_ag.find((x) => x.id === id)
    if (!r) throw new Error('Résolution introuvable')
    if (data.decisions.some((d) => d.resolution_id === id) || r.projet_id) {
      throw new Error('Résolution verrouillée : une décision ou un projet y est rattaché.')
    }
    Object.assign(r, patch)
    audit(data, 'resolutions_ag', id, 'update', `Modification résolution ${r.titre}`)
    save(data)
    return clone(r)
  },
  async deleteResolution(id) {
    await delay()
    const data = load()
    if (data.decisions.some((d) => d.resolution_id === id)) {
      throw new Error('Résolution non supprimable : une décision y est rattachée.')
    }
    if (data.resolutions_ag.find((x) => x.id === id)?.projet_id) {
      throw new Error('Résolution non supprimable : elle finance un projet.')
    }
    data.resolutions_ag = data.resolutions_ag.filter((x) => x.id !== id)
    save(data)
    return { ok: true }
  },

  // ---- Budgets AG (alloué / engagé / restant) ----
  // Un budget = une résolution AG dotée d'un budget_alloue. Les décisions CS
  // ENGAGENT un montant sur ce budget (montant_engage + resolution_id).
  async listAGBudgets() {
    await delay()
    return computeAGBudgets(load())
  },

  // ---- Projets ----
  async listProjets() {
    await delay()
    return computeProjectBudgets(load()).sort(compareProjets)
  },
  async getProjet(id) {
    await delay()
    const data = load()
    const p = data.projets.find((x) => x.id === id)
    if (!p) return null
    const computed = computeProjectBudgets(data).find((x) => x.id === id)
    const decisions = data.decisions.filter((d) => d.projet_id === id)
    return {
      ...clone(computed),
      decisions: clone(decisions),
      qa: clone((data.questions_reponses_projet || [])
        .filter((q) => q.projet_id === id)
        .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))),
      // Journal de bord : trié sur la date de l'ACTION, décroissante — le plus
      // récent en tête. Surtout PAS sur `created_at` : une visite du 12 notée le
      // 20 doit se ranger au 12, sinon le journal ment sur la chronologie.
      journal: clone((data.journal_projet || [])
        .filter((j) => j.projet_id === id)
        .sort((a, b) => (a.date_action > b.date_action ? -1 : a.date_action < b.date_action ? 1 : 0))),
    }
  },
  // `resolution_ids` est un champ VIRTUEL : le rattachement vit sur la résolution
  // (resolutions_ag.projet_id), pas sur le projet. Il est retiré du row projet.
  async createProjet({ resolution_ids = [], ...input }) {
    await delay()
    const data = load()
    // La permission s'ancre sur chef_projet_id (le chef modifie), posé par le
    // formulaire — pas de created_by. Cf. migration 013.
    // Pas de `statut` : il est intégralement dérivé et la colonne n'existe plus
    // (migration 011). En poser un ici était un champ fantôme, écrasé au calcul
    // — et il portait « ouvert », statut supprimé depuis.
    const p = { id: uid(), documents: [], date_cloture: null, created_at: nowISO(), updated_at: nowISO(), ...input }
    data.projets.push(p)
    data.resolutions_ag.forEach((r) => { if (resolution_ids.includes(r.id)) r.projet_id = p.id })
    audit(data, 'projets', p.id, 'create', `Ouverture projet ${p.nom}`)
    save(data)
    return clone(p)
  },
  async updateProjet(id, patch) {
    await delay()
    const data = load()
    const p = data.projets.find((x) => x.id === id)
    if (!p) throw new Error('Projet introuvable')
    // Rattachements exclus : ils passent par setResolutionProjet, jamais par un
    // patch de projet (le mock avalerait la clé, Supabase la rejetterait).
    const { resolution_ids, ...cols } = patch // eslint-disable-line no-unused-vars
    Object.assign(p, cols, { updated_at: nowISO() })
    audit(data, 'projets', id, 'update', `Modification projet ${p.nom}`)
    save(data)
    return clone(p)
  },
  async deleteProjet(id) {
    await delay()
    const data = load()
    // Un projet sur lequel de l'argent est engagé n'est plus supprimable.
    //
    // La garde porte sur les décisions ENREGISTRÉES, ce qui couvre exactement la
    // règle : l'argent engagé vient forcément d'une décision enregistrée et
    // adoptée. Et elle ferme au passage une atteinte au verrou d'enregistrement —
    // supprimer le projet remettait `projet_id` à null sur ces décisions, donc
    // MODIFIAIT une délibération figée au registre légal.
    if (data.decisions.some((d) => d.projet_id === id && d.enregistree)) {
      throw new Error('Projet non supprimable : une décision enregistrée y est rattachée.')
    }
    // Détachement, jamais destruction : les décisions non enregistrées ET les
    // résolutions du projet lui survivent (miroir du `on delete set null` Supabase).
    data.decisions.forEach((d) => { if (d.projet_id === id) d.projet_id = null })
    data.resolutions_ag.forEach((r) => { if (r.projet_id === id) r.projet_id = null })
    data.projets = data.projets.filter((x) => x.id !== id)
    audit(data, 'projets', id, 'delete', 'Suppression projet')
    save(data)
    return { ok: true }
  },
  // Rattache une résolution à un projet, ou l'en détache (projetId = null).
  // Une résolution ne pointant qu'un projet, rattacher ailleurs remplace : pas
  // de doublon possible, la règle est portée par la forme de la donnée.
  async setResolutionProjet(resolutionId, projetId) {
    await delay()
    const data = load()
    const r = data.resolutions_ag.find((x) => x.id === resolutionId)
    if (!r) throw new Error('Résolution introuvable')
    if (projetId && !ouvreUnBudget(r)) {
      throw new Error('Seule une résolution adoptée et dotée d’un budget peut financer un projet.')
    }
    r.projet_id = projetId || null
    const p = projetId ? data.projets.find((x) => x.id === projetId) : null
    audit(data, 'resolutions_ag', resolutionId, 'update', projetId ? `Résolution ${numeroResolution(r)} rattachée au projet ${p?.nom || ''}` : `Résolution ${numeroResolution(r)} détachée de son projet`)
    save(data)
    return clone(r)
  },

  // ---- Décisions CS ----
  // `documents` est retiré ICI AUSSI, pour rester à parité avec Supabase, qui ne
  // le sélectionne pas (les pièces jointes pèsent trop pour une liste). Sans ça
  // le mock serait plus riche que la prod et masquerait un écran de liste qui
  // lirait `documents` : il marcherait en démo, pas en production.
  async listDecisions() {
    await delay()
    const user = getSessionUser()
    return clone(load().decisions)
      .filter((d) => aLaMain(d, user)) // brouillons d'autrui : invisibles (migration 026)
      .map(({ documents, ...d }) => d) // eslint-disable-line no-unused-vars
      // Publication décroissante, puis NUMÉRO décroissant. Le second critère
      // n'est pas cosmétique : plusieurs décisions publiées le même jour
      // s'ordonnaient au hasard, et les deux backends pouvaient diverger.
      .sort((a, b) => {
        if (a.date_publication !== b.date_publication) return a.date_publication < b.date_publication ? 1 : -1
        return (b.numero || '').localeCompare(a.numero || '')
      })
  },
  async getDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    // Introuvable pour qui n'a pas le droit de la voir : exactement ce que
    // renverrait PostgREST sous la policy restrictive.
    if (!d || !aLaMain(d, getSessionUser())) return null
    const batch = data.signature_batches.find((b) => b.decision_ids.includes(id)) || null
    return {
      ...clone(d),
      votes: clone(data.votes.filter((v) => v.decision_id === id)),
      qa: clone(data.questions_reponses.filter((q) => q.decision_id === id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))),
      signature_batch: clone(batch),
      status_history: clone(data.decision_status_history.filter((h) => h.decision_id === id)),
      // Versions successives du brouillon (migration 026) : « le texte soumis au
      // vote est bien celui qui a été préparé, et par qui ».
      historique: clone((data.decisions_historique || []).filter((h) => h.decision_id === id).sort((a, b) => a.version - b.version)),
    }
  },
  async createDecision(input) {
    await delay()
    const data = load()
    const d = {
      id: uid(), statut: 'en_cours', enregistree: false, quorum_atteint: null, composition_snapshot: null,
      montant_engage: null, projet_id: null, ag_id: null, resolution_id: null, documents: [], date_enregistrement: null,
      // Cycle de vie (migration 026). Défaut 'ouverte_au_vote' : une décision
      // créée sans préciser la phase est soumise au vote sur-le-champ, comme
      // avant. Le formulaire, lui, envoie toujours la phase explicitement.
      phase: 'ouverte_au_vote', version: 1, visibilite: 'cs_seul', delai_vote_jours: 7,
      date_soumission_prevue: null, soumise_le: null, contenu_gele: null, hash_contenu: null,
      motif_annulation: null,
      created_by: getSessionUserId(), created_at: nowISO(), updated_at: nowISO(), ...input,
    }
    // Créée directement ouverte (« Soumettre maintenant ») : le texte est gelé
    // et le NUMÉRO attribué tout de suite. Les dates, elles, restent celles
    // saisies au formulaire — seule une décision qui ÉTAIT un brouillon voit sa
    // publication recalée.
    if (phaseOf(d) === 'ouverte_au_vote') {
      d.soumise_le = nowISO()
      d.contenu_gele = contenuAGeler(d)
      d.hash_contenu = await sha256Hex(d.contenu_gele)
      if (!d.numero) d.numero = nextNumero(Number(String(d.date_publication).slice(0, 4)), data.decisions)
    } else {
      d.numero = null
    }
    data.decisions.push(d)
    audit(data, 'decisions', d.id, 'create', `Création décision ${d.numero} (${PHASE_LABELS[phaseOf(d)]})`)
    save(data)
    return clone(d)
  },
  async updateDecision(id, patch) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    if (d.enregistree) throw new Error('Décision enregistrée : non modifiable.')
    // Miroir de `decisions_brouillon_update_auteur` : le brouillon d'un autre
    // membre ne se modifie pas — ni son texte, ni sa soumission au vote. Le
    // président non plus : soumettre au conseil la décision d'un autre, à sa
    // place, n'est pas dans ses prérogatives.
    if (!aLaMain(d, getSessionUser())) throw new Error('Décision introuvable')
    await appliquerCycle(data, d, patch)
    audit(data, 'decisions', id, 'update', `Modification décision ${d.numero}`)
    save(data)
    return clone(d)
  },

  // ---- Cycle de vie : brouillon → planifiée → ouverte au vote (migration 026) ----
  //
  // Quatre méthodes nommées plutôt qu'un `updateDecision({ phase })` générique :
  // au point d'appel, « soumettre au vote » et « annuler » ne sont pas des
  // modifications de champ, ce sont des actes — et chacun a ses conditions.
  async planifierDecision(id, { date_soumission_prevue, delai_vote_jours }) {
    return this.updateDecision(id, {
      phase: 'planifiee',
      date_soumission_prevue,
      delai_vote_jours: delai_vote_jours ?? 7,
    })
  },
  async soumettreDecision(id) {
    return this.updateDecision(id, { phase: 'ouverte_au_vote' })
  },
  async remettreEnBrouillon(id) {
    return this.updateDecision(id, { phase: 'brouillon' })
  },
  async annulerDecision(id, motif) {
    return this.updateDecision(id, { phase: 'annulee', motif_annulation: motif })
  },

  // Ouvre les décisions planifiées dont l'échéance est passée. Idempotent : une
  // décision déjà ouverte n'est jamais retraitée (`phase === 'planifiee'`).
  //
  // Côté Supabase c'est pg_cron qui déclenche ; ici il n'y a pas de planificateur
  // du tout, donc SEUL le filet applicatif existe — le mode démo ne prouve rien
  // sur le cron réel, il montre juste le comportement.
  async ouvrirDecisionsDues() {
    const data = load()
    const maintenant = nowISO()
    const dues = data.decisions.filter(
      (d) => phaseOf(d) === 'planifiee' && d.date_soumission_prevue && d.date_soumission_prevue <= maintenant,
    )
    if (dues.length === 0) return { traitees: 0 }
    for (const d of dues) await appliquerCycle(data, d, { phase: 'ouverte_au_vote' })
    data.cron_runs.push({
      id: uid(), tache: 'ouvrir_decisions_planifiees', source: 'app',
      traitees: dues.length, detail: dues.map((d) => d.numero).join(', '), execute_le: nowISO(),
    })
    audit(data, 'decisions', null, 'ouverture', `Ouverture automatique : ${dues.map((d) => d.numero).join(', ')}`)
    save(data)
    return { traitees: dues.length }
  },

  // RATTACHEMENT d'une décision ENREGISTRÉE à un projet (migration 033).
  // L'acte fige la DÉLIBÉRATION, pas le classement : un projet ouvert après le
  // vote doit pouvoir récupérer ses décisions. Ne touche QUE `projet_id` —
  // `resolution_id` et `ag_id` restent, on ne détruit rien sur une ligne figée.
  async rattacherDecisionProjet(id, projetId) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    const avant = d.projet_id ? data.projets.find((p) => p.id === d.projet_id)?.nom : null
    d.projet_id = projetId || null
    d.updated_at = nowISO()
    const apres = projetId ? data.projets.find((p) => p.id === projetId)?.nom : null
    audit(data, 'decisions', id, 'rattachement', `Décision ${d.numero} — rattachement ${avant || 'aucun projet'} vers ${apres || 'aucun projet'}`)
    save(data)
    return clone(d)
  },

  // Visibilité PRÉVUE : décision de PUBLICATION, extérieure à la délibération —
  // donc modifiable même sur une décision ENREGISTRÉE, contrairement à son
  // texte. Le verrou de l'art. 15 protège la délibération, pas la décision de
  // savoir qui peut la consulter. Côté Supabase la trace est posée par un
  // trigger (migration 027) ; ici, par `audit()`.
  async changerVisibilite(id, visibilite) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    const avant = d.visibilite || 'cs_seul'
    d.visibilite = visibilite
    // Même libellé que le trigger `decisions_audit_visibilite` (migration 027) :
    // une trace qui diffère selon le backend n'est pas une trace, c'est deux
    // versions de l'histoire.
    audit(data, 'decisions', id, 'visibilite', `Décision ${d.numero} — visibilité ${avant} vers ${visibilite}`)
    save(data)
    return clone(d)
  },

  async deleteDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (d?.enregistree) throw new Error('Décision enregistrée : non supprimable.')
    // Miroir des policies (migration 026), deux régimes qui ne se recouvrent pas :
    //  - décision PAS ENCORE SOUMISE → son AUTEUR seul, président compris (il n'a
    //    aucun droit sur le brouillon d'un autre : `decisions_brouillon_delete_auteur`) ;
    //  - décision soumise, non enregistrée → le PRÉSIDENT seul (`write_admin`),
    //    avec le garde-fou « au plus 1 vote » ci-dessous.
    const user = getSessionUser()
    if (d && avantSoumission(d)) {
      if (d.created_by !== user?.membre_id) throw new Error('Décision introuvable')
    } else if (d && user?.role !== 'admin') {
      throw new Error('Suppression réservée au président une fois la décision soumise au vote.')
    }
    // Au plus UN vote : garde-fou de saisie, pas une règle statutaire (cf. DecisionDetail).
    if (data.votes.filter((v) => v.decision_id === id).length > 1) throw new Error('Décision déjà votée par plusieurs membres : non supprimable.')
    data.decisions = data.decisions.filter((x) => x.id !== id)
    data.votes = data.votes.filter((v) => v.decision_id !== id)
    data.questions_reponses = data.questions_reponses.filter((q) => q.decision_id !== id)
    // Miroir du `on delete cascade` : l'historique des versions part avec elle.
    data.decisions_historique = (data.decisions_historique || []).filter((h) => h.decision_id !== id)
    save(data)
    return { ok: true }
  },
  // Enregistrement par le président (contrôle quorum côté appelant).
  // Horodate le partage au CS. Volontairement hors updateDecision : ce n'est
  // pas une modification de contenu, et une relance doit rester possible.
  async markDecisionNotified(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    d.date_notification = nowISO()
    audit(data, 'decisions', id, 'notify', `Partage au CS — ${d.numero}`)
    save(data)
    return clone(d)
  },
  async recordDecision(id, { statut, quorum_atteint, composition_snapshot, date_enregistrement }) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    const ancien = d.statut
    Object.assign(d, {
      statut, quorum_atteint, composition_snapshot,
      enregistree: true,
      date_enregistrement: date_enregistrement || nowISO().slice(0, 10),
      updated_at: nowISO(),
    })
    data.decision_status_history.push({ id: uid(), decision_id: id, ancien_statut: ancien, nouveau_statut: statut, changed_by: getSessionUserId(), changed_at: nowISO() })
    audit(data, 'decisions', id, 'record', `Enregistrement — ${statut}`)
    save(data)
    return clone(d)
  },

  // ---- Documents (pièces jointes) ----
  //
  // Parité d'INTERFACE avec Supabase, pas de stockage : la démo n'a pas de
  // bucket, elle garde le base64 dans localStorage. `scope`/`entityId` ne servent
  // donc à rien ici — ils existent pour que la signature soit la même des deux
  // côtés, et le plafond de 2 Mo de MAX_DOC_BYTES est la conséquence directe de
  // ce stockage (quota navigateur), pas une règle du produit.
  //
  // ⚠ Le mode démo ne peut donc PAS vérifier le chemin du bucket ni les policies
  // de la migration 012. Ce qui marche ici ne prouve rien sur la prod.
  async uploadDocument(scope, entityId, file, onProgress) { // eslint-disable-line no-unused-vars
    await delay()
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(file)
    })
    // Rien à mesurer : le fichier ne quitte pas le navigateur. On annonce 100 %
    // pour que l'appelant n'ait pas à distinguer les deux backends.
    onProgress?.(1)
    return { id: uid(), name: file.name, type: file.type, size: file.size, dataUrl, uploaded_at: nowISO() }
  },
  async getDocumentUrl(doc) {
    return doc.dataUrl
  },

  // ---- Votes (self-only côté UI) ----
  async upsertVote(decision_id, membre_id, vote, commentaire) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === decision_id)
    if (d?.enregistree) throw new Error('Vote clos : décision enregistrée.')
    // Miroir des policies restrictives `votes_open_only_*` (migration 026) : on
    // ne vote pas sur un brouillon, une décision planifiée ou annulée.
    if (d && phaseOf(d) !== 'ouverte_au_vote') {
      throw new Error(`Vote impossible : la décision est « ${PHASE_LABELS[phaseOf(d)]} », elle n’a pas été soumise au vote.`)
    }
    let v = data.votes.find((x) => x.decision_id === decision_id && x.membre_id === membre_id)
    if (v) {
      v.vote = vote
      if (commentaire !== undefined) v.commentaire = commentaire
      v.date_vote = nowISO()
    } else {
      v = { id: uid(), decision_id, membre_id, vote, commentaire: commentaire || '', date_vote: nowISO() }
      data.votes.push(v)
    }
    save(data)
    return clone(v)
  },
  async listMyVotes(membre_id) {
    await delay(20)
    return clone(load().votes.filter((v) => v.membre_id === membre_id))
  },
  // Tous les votes. `vote` sert au détail pour/contre/abstention de la liste du
  // registre ; le groupement de la page Signatures n'utilise que
  // decision_id/membre_id. On ne remonte pas le commentaire.
  async listVotes() {
    await delay(20)
    return clone(load().votes).map((v) => ({ decision_id: v.decision_id, membre_id: v.membre_id, vote: v.vote }))
  },
  async deleteVote(decision_id, membre_id) {
    await delay()
    const data = load()
    data.votes = data.votes.filter((x) => !(x.decision_id === decision_id && x.membre_id === membre_id))
    save(data)
    return { ok: true }
  },

  // ---- Q&A ----
  // Toutes les Q/R, pour compter les questions sans réponse sur la liste du
  // registre. Minimal : seuls id/decision_id/type/parent_id servent au comptage.
  async listQA() {
    await delay(20)
    return clone(load().questions_reponses).map((q) => ({ id: q.id, decision_id: q.decision_id, type: q.type, parent_id: q.parent_id, auteur_id: q.auteur_id }))
  },
  async addQA({ decision_id, auteur_id, type, parent_id, texte }) {
    await delay()
    const data = load()
    const q = { id: uid(), decision_id, auteur_id, type, parent_id: parent_id || null, texte, created_at: nowISO() }
    data.questions_reponses.push(q)
    save(data)
    return clone(q)
  },

  // ---- Fil d'échanges des projets (migration 028) ----
  // Même forme que `addQA` côté décisions. Pas de garde de verrouillage : un
  // projet ne se fige jamais, contrairement à une décision enregistrée.
  async addQAProjet({ projet_id, auteur_id, type, parent_id, texte }) {
    await delay()
    const data = load()
    data.questions_reponses_projet ||= []
    const q = { id: uid(), projet_id, auteur_id, type, parent_id: parent_id || null, texte, created_at: nowISO() }
    data.questions_reponses_projet.push(q)
    save(data)
    return clone(q)
  },

  // ---- Journal de bord des projets (migration 029) ----
  //
  // ⚠ Rien à voir avec `audit()` : celui-ci est automatique et immuable, le
  // journal est saisi à la main et corrigeable. Deux journaux, deux usages.
  async addJournalProjet({ projet_id, date_action, texte, auteur_id }) {
    await delay()
    const data = load()
    data.journal_projet ||= []
    const j = { id: uid(), projet_id, date_action, texte, auteur_id, created_at: nowISO(), updated_at: nowISO() }
    data.journal_projet.push(j)
    save(data)
    return clone(j)
  },
  // `created_at` n'est JAMAIS touché : c'est la date de saisie, elle fait foi
  // sur le moment où la ligne a été écrite. Seuls la date de l'action et le
  // texte se corrigent.
  async updateJournalProjet(id, { date_action, texte }) {
    await delay()
    const data = load()
    const j = (data.journal_projet || []).find((x) => x.id === id)
    if (!j) throw new Error('Entrée de journal introuvable')
    const user = getSessionUser()
    if (j.auteur_id !== user?.membre_id && user?.role !== 'admin') {
      throw new Error('Seul l’auteur de cette entrée peut la corriger.')
    }
    if (date_action !== undefined) j.date_action = date_action
    if (texte !== undefined) j.texte = texte
    j.updated_at = nowISO()
    save(data)
    return clone(j)
  },
  async deleteJournalProjet(id) {
    await delay()
    const data = load()
    const j = (data.journal_projet || []).find((x) => x.id === id)
    const user = getSessionUser()
    if (j && j.auteur_id !== user?.membre_id && user?.role !== 'admin') {
      throw new Error('Seul l’auteur de cette entrée peut la supprimer.')
    }
    data.journal_projet = (data.journal_projet || []).filter((x) => x.id !== id)
    save(data)
    return { ok: true }
  },

  // ---- Signature par lot ----
  async listSignatureBatches() {
    await delay()
    return clone(load().signature_batches).sort(byDateDesc('created_at'))
  },
  async createSignatureBatch({ titre, decision_ids, yousign_request_id, statut, signataires }) {
    await delay()
    const data = load()
    const batch = { id: uid(), titre, decision_ids, yousign_request_id, statut: statut || 'en_attente', pdf_url: null, signataires: signataires || [], created_at: nowISO(), signed_at: null }
    data.signature_batches.push(batch)
    audit(data, 'signature_batches', batch.id, 'create', `Lot de signature : ${decision_ids.length} décision(s)`)
    save(data)
    return clone(batch)
  },
  async markBatchSigned(batchId, pdf_url) {
    await delay()
    const data = load()
    const b = data.signature_batches.find((x) => x.id === batchId)
    if (!b) throw new Error('Lot introuvable')
    b.statut = 'signe'
    b.pdf_url = pdf_url || 'mock://signed.pdf'
    b.signed_at = nowISO()
    save(data)
    return clone(b)
  },


  // ---- Registre des propriétaires (migration 035) ----
  //
  // ⚠ DONNÉES PERSONNELLES, président et secrétaire UNIQUEMENT. Le mock
  // reproduit la garde pour que la démo montre le même refus que la prod — mais
  // il ne PROUVE rien : seules les policies `lots_bureau` / `proprietaires_bureau`
  // ferment réellement l'accès. Vérification sur staging, jamais ici.
  _gardeBureau() {
    const user = getSessionUser()
    const bureau = user?.role === 'admin' || user?.membre_role === 'secretaire'
    if (!bureau) throw new Error('Registre des propriétaires : réservé au président et au secrétaire.')
    return user
  },

  // La liste est construite PAR LOT : un lot, son propriétaire actuel (période
  // sans date de cession), et le nombre d'anciens. C'est la vue dont le bureau a
  // besoin — « qui possède quoi aujourd'hui » — l'historique vivant sur la fiche.
  async listLots() {
    await delay()
    this._gardeBureau()
    const data = load()
    // TANTIÈME dérivé, jamais stocké : part du lot dans la somme des superficies
    // connues. C'est l'assiette des voix en AG et des charges — la stocker
    // divergerait dès qu'un lot serait ajouté ou corrigé, et les parts
    // continueraient d'avoir l'air justes.
    // ⚠ Le dénominateur est le total des superficies RENSEIGNÉES : tant que le
    // registre est incomplet, les parts sont provisoires. L'écran le dit.
    const total = (data.lots || []).reduce((s2, l) => s2 + (Number(l.superficie) || 0), 0)
    return clone(data.lots || []).map((l) => {
      const periodes = (data.proprietaires || []).filter((p) => p.lot_id === l.id)
      const actuel = periodes.find((p) => !p.date_cession) || null
      return {
        ...l,
        proprietaire: actuel ? clone(actuel) : null,
        anciens: periodes.filter((p) => p.date_cession).length,
        superficie_totale: total,
        part: total > 0 && l.superficie ? (Number(l.superficie) / total) * 100 : null,
      }
    })
  },

  async getLot(id) {
    await delay()
    this._gardeBureau()
    const data = load()
    const l = (data.lots || []).find((x) => x.id === id)
    if (!l) return null
    const periodes = (data.proprietaires || []).filter((p) => p.lot_id === id)
    return {
      ...clone(l),
      proprietaire: clone(periodes.find((p) => !p.date_cession) || null),
      // Historique du plus récent au plus ancien : on remonte le temps.
      historique: clone(periodes.filter((p) => p.date_cession).sort((a, b) => (a.date_cession < b.date_cession ? 1 : -1))),
    }
  },

  async createLot(input) {
    await delay()
    this._gardeBureau()
    const data = load()
    data.lots ||= []
    if (data.lots.some((l) => l.numero === input.numero)) {
      throw new Error(`Le lot ${input.numero} existe déjà.`)
    }
    // `nombre_lots` à 1 par défaut, comme en base : une parcelle vaut un lot
    // sauf exception, et une valeur absente fausserait le total du registre.
    const l = { id: uid(), observations: null, nombre_lots: 1, numero_syndic: null, created_at: nowISO(), updated_at: nowISO(), ...input }
    data.lots.push(l)
    audit(data, 'lots', l.id, 'create', `Lot ${l.numero} créé`)
    save(data)
    return clone(l)
  },

  async updateLot(id, patch) {
    await delay()
    this._gardeBureau()
    const data = load()
    const l = (data.lots || []).find((x) => x.id === id)
    if (!l) throw new Error('Lot introuvable')
    Object.assign(l, patch, { updated_at: nowISO() })
    audit(data, 'lots', id, 'update', `Lot ${l.numero} modifié`)
    save(data)
    return clone(l)
  },

  async deleteLot(id) {
    await delay()
    this._gardeBureau()
    const data = load()
    const l = (data.lots || []).find((x) => x.id === id)
    data.lots = (data.lots || []).filter((x) => x.id !== id)
    // Miroir du `on delete cascade` : l'historique part avec le lot.
    data.proprietaires = (data.proprietaires || []).filter((p) => p.lot_id !== id)
    audit(data, 'lots', id, 'delete', `Lot ${l?.numero || id} supprimé`)
    save(data)
    return { ok: true }
  },

  // Propriétaire ACTUEL : créé s'il n'y en a pas, modifié sinon. Ne touche
  // jamais l'historique — pour changer de propriétaire, c'est `enregistrerMutation`.
  async saveProprietaire(lotId, patch) {
    await delay()
    this._gardeBureau()
    const data = load()
    data.proprietaires ||= []
    const actuel = data.proprietaires.find((p) => p.lot_id === lotId && !p.date_cession)
    if (actuel) {
      Object.assign(actuel, patch, { updated_at: nowISO() })
      audit(data, 'proprietaires', actuel.id, 'update', `Propriétaire du lot modifié`)
      save(data)
      return clone(actuel)
    }
    const p = {
      id: uid(), lot_id: lotId, est_societe: false, gerant_nom: null, gerant_fonction: null,
      adresse_communication: null, adresse_gerant: null, email: null, telephone: null,
      gerant_email: null, gerant_telephone: null,
      gerant_nom_2: null, gerant_fonction_2: null, gerant_email_2: null, gerant_telephone_2: null,
      mandataire_nom: null, mandataire_email: null, mandataire_telephone: null,
      nom_2: null, email_2: null, telephone_2: null, est_indivision: false,
      date_acquisition: null, date_cession: null, observations: null,
      created_at: nowISO(), updated_at: nowISO(), ...patch,
    }
    data.proprietaires.push(p)
    audit(data, 'proprietaires', p.id, 'create', `Propriétaire ${p.nom} enregistré`)
    save(data)
    return clone(p)
  },

  // MUTATION : clôt la période en cours et en ouvre une nouvelle. Les deux dates
  // portent la mutation — il n'y a pas de table `mutations` à tenir en plus.
  // L'ordre importe : clore AVANT de créer, sinon l'index partiel « un seul
  // propriétaire actuel par lot » refuserait la nouvelle ligne.
  async enregistrerMutation(lotId, { date_mutation, ...nouveau }) {
    await delay()
    this._gardeBureau()
    if (!date_mutation) throw new Error('La date de mutation est obligatoire.')
    const data = load()
    data.proprietaires ||= []
    const actuel = data.proprietaires.find((p) => p.lot_id === lotId && !p.date_cession)
    if (actuel) {
      if (actuel.date_acquisition && date_mutation < actuel.date_acquisition) {
        throw new Error('La mutation ne peut pas précéder l’acquisition du propriétaire actuel.')
      }
      actuel.date_cession = date_mutation
      actuel.updated_at = nowISO()
    }
    const p = {
      id: uid(), lot_id: lotId, est_societe: false, gerant_nom: null, gerant_fonction: null,
      adresse_communication: null, adresse_gerant: null, email: null, telephone: null,
      gerant_email: null, gerant_telephone: null,
      gerant_nom_2: null, gerant_fonction_2: null, gerant_email_2: null, gerant_telephone_2: null,
      mandataire_nom: null, mandataire_email: null, mandataire_telephone: null,
      nom_2: null, email_2: null, telephone_2: null, est_indivision: false,
      date_cession: null, observations: null, created_at: nowISO(), updated_at: nowISO(),
      ...nouveau, date_acquisition: date_mutation,
    }
    data.proprietaires.push(p)
    audit(data, 'proprietaires', p.id, 'mutation', `Mutation au ${date_mutation} : ${actuel?.nom || 'aucun'} vers ${p.nom}`)
    save(data)
    return clone(p)
  },

  // Acceptation de la mention RGPD : une fois, horodatée, tracée.
  async accepterRgpdRegistre(membreId) {
    await delay()
    const data = load()
    const m = data.membres_cs.find((x) => x.id === membreId)
    if (!m) throw new Error('Membre introuvable')
    if (!m.registre_rgpd_accepte_le) {
      m.registre_rgpd_accepte_le = nowISO()
      audit(data, 'membres_cs', membreId, 'rgpd', `Mention RGPD du registre des propriétaires acceptée par ${m.prenom} ${m.nom}`)
      save(data)
    }
    return clone(m)
  },

  // ---- Audit ----
  async listAudit(limit = 100) {
    await delay()
    return clone(load().audit_log).sort(byDateDesc('created_at')).slice(0, limit)
  },
}
