// localStorage-backed demo backend. Implements the same async repository
// interface as supabaseDb.js so api.js can switch transparently.
// Seed data covers every v2 entity: membres, AG, résolutions, budgets,
// décisions CS, votes, Q&A, signatures, audit + status history.

const STORAGE_KEY = 'cs_rives_mockdb_v2'
const SESSION_KEY = 'cs_rives_session'

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))

const nowISO = () => new Date().toISOString()
const delay = (ms = 60) => new Promise((r) => setTimeout(r, ms))

// ---------------------------------------------------------------- seed
function seed() {
  const mPresident = uid()
  const mVice = uid()
  const m3 = uid()
  const m4 = uid()
  const m5 = uid()

  const membres_cs = [
    {
      id: mPresident,
      nom: 'Favre',
      prenom: 'Pascal',
      email: 'pfavre25@gmail.com',
      role: 'president',
      date_election: '2025-06-19',
      date_fin: null,
      ag_election: 'AGO 19 juin 2025',
      actif: true,
      created_at: '2025-06-19T18:00:00Z',
    },
    {
      id: mVice,
      nom: 'Martin',
      prenom: 'Claire',
      email: 'claire.martin@example.fr',
      role: 'membre',
      date_election: '2025-06-19',
      date_fin: null,
      ag_election: 'AGO 19 juin 2025',
      actif: true,
      created_at: '2025-06-19T18:00:00Z',
    },
    {
      id: m3,
      nom: 'Dubois',
      prenom: 'Henri',
      email: 'henri.dubois@example.fr',
      role: 'membre',
      date_election: '2025-06-19',
      date_fin: null,
      ag_election: 'AGO 19 juin 2025',
      actif: true,
      created_at: '2025-06-19T18:00:00Z',
    },
    {
      id: m4,
      nom: 'Leroy',
      prenom: 'Sophie',
      email: 'sophie.leroy@example.fr',
      role: 'membre',
      date_election: '2025-06-19',
      date_fin: null,
      ag_election: 'AGO 19 juin 2025',
      actif: true,
      created_at: '2025-06-19T18:00:00Z',
    },
    {
      id: m5,
      nom: 'Petit',
      prenom: 'Marc',
      email: 'marc.petit@example.fr',
      role: 'membre',
      date_election: '2024-06-15',
      date_fin: '2025-06-19',
      ag_election: 'AGO 15 juin 2024',
      actif: false,
      created_at: '2024-06-15T18:00:00Z',
    },
  ]

  // Auth accounts (mock). Password identical for the demo: "demo".
  const accounts = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({
      id: m.id,
      email: m.email,
      password: 'demo',
      role: m.role === 'president' ? 'admin' : 'membre',
      membre_id: m.id,
    }))

  const agAGO = uid()
  const agAGE = uid()
  const assemblees_generales = [
    {
      id: agAGO,
      numero: 'AGO-2025-01',
      type: 'AGO',
      date_ag: '2025-06-19',
      lieu: 'Salle des fêtes de Nernier',
      president_seance: 'Pascal Favre',
      ordre_du_jour:
        "1. Approbation des statuts ASL\n2. Élection du Conseil Syndical\n3. Budget travaux voirie 2025\n4. Honoraires notaire",
      quorum_atteint: true,
      nombre_presents: 32,
      nombre_representes: 9,
      nombre_total: 50,
      superficie_representee: 41250.0,
      statut: 'cloturee',
      pv_url: null,
      created_at: '2025-06-19T18:00:00Z',
      updated_at: '2025-06-20T09:00:00Z',
    },
    {
      id: agAGE,
      numero: 'AGE-2026-01',
      type: 'AGE',
      date_ag: '2026-09-12',
      lieu: 'Mairie de Nernier',
      president_seance: 'Pascal Favre',
      ordre_du_jour: '1. Travaux réfection réseau eaux pluviales\n2. Appel de fonds exceptionnel',
      quorum_atteint: null,
      nombre_presents: 0,
      nombre_representes: 0,
      nombre_total: 50,
      superficie_representee: 0,
      statut: 'en_cours',
      pv_url: null,
      created_at: '2026-07-01T10:00:00Z',
      updated_at: '2026-07-01T10:00:00Z',
    },
  ]

  const rApprobStatuts = uid()
  const rElection = uid()
  const rBudgetVoirie = uid()
  const resolutions_ag = [
    {
      id: rApprobStatuts,
      ag_id: agAGO,
      numero: 1,
      titre: 'Approbation des statuts de l’ASL',
      description:
        "L'assemblée générale approuve les statuts de l'Association Syndicale Libre du Lotissement de Rives tels que présentés en annexe.",
      votes_pour: 40,
      votes_contre: 1,
      votes_abstention: 0,
      votes_absents: 9,
      superficie_pour: 40100.0,
      statut: 'adoptee',
      majorite_requise: 'double_qualifiee',
      observations: 'Double majorité qualifiée atteinte.',
      created_at: '2025-06-19T18:30:00Z',
    },
    {
      id: rElection,
      ag_id: agAGO,
      numero: 2,
      titre: 'Élection des membres du Conseil Syndical',
      description:
        'Sont élus au Conseil Syndical : Pascal Favre (président), Claire Martin, Henri Dubois, Sophie Leroy.',
      votes_pour: 39,
      votes_contre: 0,
      votes_abstention: 2,
      votes_absents: 9,
      superficie_pour: 39800.0,
      statut: 'adoptee',
      majorite_requise: 'simple',
      observations: '',
      created_at: '2025-06-19T19:00:00Z',
    },
    {
      id: rBudgetVoirie,
      ag_id: agAGO,
      numero: 3,
      titre: 'Budget travaux de voirie 2025',
      description:
        'Vote d’un budget de 85 000 € pour la réfection de la voirie principale, réparti à la superficie.',
      votes_pour: 35,
      votes_contre: 4,
      votes_abstention: 2,
      votes_absents: 9,
      superficie_pour: 35600.0,
      statut: 'adoptee',
      majorite_requise: 'simple',
      observations: '',
      created_at: '2025-06-19T19:30:00Z',
    },
  ]

  const budgets_ag = [
    {
      id: uid(),
      ag_id: agAGO,
      resolution_id: rBudgetVoirie,
      intitule: 'Réfection voirie principale',
      montant_vote: 85000.0,
      cle_repartition: 'superficie',
      statut: 'appele',
      date_appel_prevu: '2025-09-01',
      montant_appele: 85000.0,
      montant_encaisse: 61200.0,
      observations: 'Appel émis par Foncia le 01/09/2025.',
      created_at: '2025-06-19T19:35:00Z',
      updated_at: '2025-09-05T10:00:00Z',
    },
    {
      id: uid(),
      ag_id: agAGO,
      resolution_id: rApprobStatuts,
      intitule: 'Honoraires Me Garnier — rédaction statuts ASL',
      montant_vote: 4200.0,
      cle_repartition: 'egal',
      statut: 'solde',
      date_appel_prevu: '2025-07-15',
      montant_appele: 4200.0,
      montant_encaisse: 4200.0,
      observations: '',
      created_at: '2025-06-19T19:36:00Z',
      updated_at: '2025-08-01T10:00:00Z',
    },
    {
      id: uid(),
      ag_id: agAGO,
      resolution_id: null,
      intitule: 'Provision entretien espaces verts 2025',
      montant_vote: 6000.0,
      cle_repartition: 'superficie',
      statut: 'vote',
      date_appel_prevu: '2026-01-15',
      montant_appele: 0,
      montant_encaisse: 0,
      observations: 'Appel prévu janvier 2026.',
      created_at: '2025-06-19T19:37:00Z',
      updated_at: '2025-06-19T19:37:00Z',
    },
  ]

  // ---- Décisions CS (hors AG) ----
  const d1 = uid()
  const d2 = uid()
  const d3 = uid()
  const decisions = [
    {
      id: d1,
      numero: '2026-001',
      date_decision: '2026-02-10',
      titre: 'Choix du prestataire d’entretien des espaces verts',
      description:
        '<p>Le Conseil Syndical retient la société <strong>VertPro SARL</strong> pour l’entretien des espaces verts communs, pour un montant annuel de 5 800 € TTC.</p><ul><li>Contrat d’un an renouvelable</li><li>Passage bimensuel</li></ul>',
      ag_id: null,
      resolution_id: null,
      statut: 'adoptee',
      created_by: mPresident,
      created_at: '2026-02-10T10:00:00Z',
      updated_at: '2026-02-10T11:00:00Z',
      quorum_atteint: true,
      composition_snapshot: null, // filled below
      cloture: true,
    },
    {
      id: d2,
      numero: '2026-002',
      date_decision: '2026-05-14',
      titre: 'Installation d’un portail automatique à l’entrée du lotissement',
      description:
        '<p>Décision d’installer un <strong>portail automatique</strong> à l’entrée principale afin de sécuriser l’accès. Devis retenu : 12 400 € TTC (entreprise PortAlp).</p>',
      ag_id: null,
      resolution_id: null,
      statut: 'rejetee',
      created_by: mPresident,
      created_at: '2026-05-14T10:00:00Z',
      updated_at: '2026-05-14T12:00:00Z',
      quorum_atteint: true,
      composition_snapshot: null,
      cloture: true,
    },
    {
      id: d3,
      numero: '2026-003',
      date_decision: '2026-07-08',
      titre: 'Réparation de l’éclairage public — allée des Tilleuls',
      description:
        '<p>Remplacement de 4 lampadaires défectueux allée des Tilleuls. Devis en cours d’analyse.</p>',
      ag_id: null,
      resolution_id: null,
      statut: 'en_cours',
      created_by: mPresident,
      created_at: '2026-07-08T09:00:00Z',
      updated_at: '2026-07-08T09:00:00Z',
      quorum_atteint: null,
      composition_snapshot: null,
      cloture: false,
    },
  ]

  const activeMembersSnapshot = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({
      id: m.id,
      nom: m.nom,
      prenom: m.prenom,
      role: m.role,
      ag_election: m.ag_election,
      date_election: m.date_election,
    }))
  decisions[0].composition_snapshot = activeMembersSnapshot
  decisions[1].composition_snapshot = activeMembersSnapshot

  const votes = [
    // d1 — adoptée (4 pour)
    { id: uid(), decision_id: d1, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-02-10T10:30:00Z' },
    { id: uid(), decision_id: d1, membre_id: mVice, vote: 'pour', commentaire: '', date_vote: '2026-02-10T10:31:00Z' },
    { id: uid(), decision_id: d1, membre_id: m3, vote: 'pour', commentaire: 'Prestataire sérieux.', date_vote: '2026-02-10T10:32:00Z' },
    { id: uid(), decision_id: d1, membre_id: m4, vote: 'abstention', commentaire: '', date_vote: '2026-02-10T10:33:00Z' },
    // d2 — rejetée (2 pour / 2 contre → pas de majorité)
    { id: uid(), decision_id: d2, membre_id: mPresident, vote: 'pour', commentaire: '', date_vote: '2026-05-14T10:30:00Z' },
    { id: uid(), decision_id: d2, membre_id: mVice, vote: 'contre', commentaire: 'Coût trop élevé.', date_vote: '2026-05-14T10:31:00Z' },
    { id: uid(), decision_id: d2, membre_id: m3, vote: 'pour', commentaire: '', date_vote: '2026-05-14T10:32:00Z' },
    { id: uid(), decision_id: d2, membre_id: m4, vote: 'contre', commentaire: '', date_vote: '2026-05-14T10:33:00Z' },
  ]

  const questions_reponses = [
    {
      id: uid(),
      decision_id: d1,
      auteur_id: m4,
      type: 'question',
      parent_id: null,
      texte: 'Le contrat inclut-il le ramassage des feuilles en automne ?',
      created_at: '2026-02-09T14:00:00Z',
    },
  ]
  const qId = questions_reponses[0].id
  questions_reponses.push({
    id: uid(),
    decision_id: d1,
    auteur_id: mPresident,
    type: 'reponse',
    parent_id: qId,
    texte: 'Oui, deux passages spécifiques sont prévus en octobre et novembre.',
    created_at: '2026-02-09T16:00:00Z',
  })

  const registre_signatures = [
    {
      id: uid(),
      decision_id: d1,
      yousign_request_id: 'mock-req-0001',
      statut: 'signe',
      pdf_url: 'mock://signed/2026-001.pdf',
      signataires: [mPresident, mVice, m3, m4],
      created_at: '2026-02-11T09:00:00Z',
      signed_at: '2026-02-13T15:00:00Z',
    },
  ]

  const decision_status_history = [
    { id: uid(), decision_id: d1, ancien_statut: 'en_cours', nouveau_statut: 'adoptee', changed_by: mPresident, changed_at: '2026-02-10T11:00:00Z' },
    { id: uid(), decision_id: d2, ancien_statut: 'en_cours', nouveau_statut: 'rejetee', changed_by: mPresident, changed_at: '2026-05-14T12:00:00Z' },
  ]

  const audit_log = [
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'create', acteur: mPresident, details: 'Création décision 2026-001', created_at: '2026-02-10T10:00:00Z' },
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'close', acteur: mPresident, details: 'Clôture du vote — adoptée', created_at: '2026-02-10T11:00:00Z' },
  ]

  return {
    accounts,
    membres_cs,
    assemblees_generales,
    resolutions_ag,
    budgets_ag,
    decisions,
    votes,
    questions_reponses,
    registre_signatures,
    decision_status_history,
    audit_log,
  }
}

// ---------------------------------------------------------------- store
function load() {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      /* fall through to reseed */
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
  const acteur = getSessionUserId()
  data.audit_log.push({
    id: uid(),
    entite,
    entite_id,
    action,
    acteur,
    details: details || '',
    created_at: nowISO(),
  })
}

// ---------------------------------------------------------------- session
function getSessionUserId() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.user?.membre_id ?? null
  } catch {
    return null
  }
}

export const mockAuth = {
  async signIn(email, password) {
    await delay()
    const data = load()
    const acc = data.accounts.find(
      (a) => a.email.toLowerCase() === email.trim().toLowerCase(),
    )
    if (!acc || acc.password !== password) {
      throw new Error('Identifiants invalides.')
    }
    const membre = data.membres_cs.find((m) => m.id === acc.membre_id)
    const user = {
      id: acc.id,
      email: acc.email,
      role: acc.role,
      membre_id: acc.membre_id,
      nom: membre?.nom,
      prenom: membre?.prenom,
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ user }))
    return user
  },
  async signOut() {
    await delay(20)
    localStorage.removeItem(SESSION_KEY)
  },
  getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY))?.user ?? null
    } catch {
      return null
    }
  },
  async resetPassword(email) {
    await delay()
    // Mock: no email is actually sent.
    return { ok: true, email }
  },
}

// ---------------------------------------------------------------- repository
const clone = (v) => JSON.parse(JSON.stringify(v))
const byDateDesc = (k) => (a, b) => (a[k] < b[k] ? 1 : a[k] > b[k] ? -1 : 0)

export const mockRepo = {
  // ---- Membres ----
  async listMembres() {
    await delay()
    return clone(load().membres_cs).sort((a, b) =>
      a.nom.localeCompare(b.nom),
    )
  },
  async createMembre(input) {
    await delay()
    const data = load()
    const m = { id: uid(), actif: true, created_at: nowISO(), ...input }
    data.membres_cs.push(m)
    // also create a mock account so the person can log in
    if (input.email) {
      data.accounts.push({
        id: m.id,
        email: input.email,
        password: 'demo',
        role: input.role === 'president' ? 'admin' : 'membre',
        membre_id: m.id,
      })
    }
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
      resolutions: clone(
        data.resolutions_ag.filter((r) => r.ag_id === id).sort((a, b) => a.numero - b.numero),
      ),
      budgets: clone(data.budgets_ag.filter((b) => b.ag_id === id)),
    }
  },
  async createAG(input) {
    await delay()
    const data = load()
    const ag = {
      id: uid(),
      statut: 'en_cours',
      quorum_atteint: null,
      created_at: nowISO(),
      updated_at: nowISO(),
      ...input,
    }
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
    data.assemblees_generales = data.assemblees_generales.filter((a) => a.id !== id)
    data.resolutions_ag = data.resolutions_ag.filter((r) => r.ag_id !== id)
    data.budgets_ag = data.budgets_ag.filter((b) => b.ag_id !== id)
    audit(data, 'assemblees_generales', id, 'delete', 'Suppression AG')
    save(data)
    return { ok: true }
  },

  // ---- Résolutions ----
  async createResolution(input) {
    await delay()
    const data = load()
    const r = { id: uid(), created_at: nowISO(), observations: '', ...input }
    data.resolutions_ag.push(r)
    audit(data, 'resolutions_ag', r.id, 'create', `Résolution ${r.numero} — ${r.titre}`)
    save(data)
    return clone(r)
  },
  async updateResolution(id, patch) {
    await delay()
    const data = load()
    const r = data.resolutions_ag.find((x) => x.id === id)
    if (!r) throw new Error('Résolution introuvable')
    Object.assign(r, patch)
    audit(data, 'resolutions_ag', id, 'update', `Modification résolution ${r.titre}`)
    save(data)
    return clone(r)
  },
  async deleteResolution(id) {
    await delay()
    const data = load()
    data.resolutions_ag = data.resolutions_ag.filter((x) => x.id !== id)
    save(data)
    return { ok: true }
  },

  // ---- Budgets ----
  async listBudgets() {
    await delay()
    const data = load()
    const agById = Object.fromEntries(data.assemblees_generales.map((a) => [a.id, a]))
    return clone(data.budgets_ag).map((b) => ({
      ...b,
      ag_numero: agById[b.ag_id]?.numero ?? '—',
      ag_date: agById[b.ag_id]?.date_ag ?? null,
    }))
  },
  async createBudget(input) {
    await delay()
    const data = load()
    const b = {
      id: uid(),
      statut: 'vote',
      montant_appele: 0,
      montant_encaisse: 0,
      created_at: nowISO(),
      updated_at: nowISO(),
      ...input,
    }
    data.budgets_ag.push(b)
    audit(data, 'budgets_ag', b.id, 'create', `Budget ${b.intitule}`)
    save(data)
    return clone(b)
  },
  async updateBudget(id, patch) {
    await delay()
    const data = load()
    const b = data.budgets_ag.find((x) => x.id === id)
    if (!b) throw new Error('Budget introuvable')
    Object.assign(b, patch, { updated_at: nowISO() })
    audit(data, 'budgets_ag', id, 'update', `Modification budget ${b.intitule}`)
    save(data)
    return clone(b)
  },
  async deleteBudget(id) {
    await delay()
    const data = load()
    data.budgets_ag = data.budgets_ag.filter((x) => x.id !== id)
    save(data)
    return { ok: true }
  },

  // ---- Décisions CS ----
  async listDecisions() {
    await delay()
    return clone(load().decisions).sort(byDateDesc('date_decision'))
  },
  async getDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) return null
    return {
      ...clone(d),
      votes: clone(data.votes.filter((v) => v.decision_id === id)),
      qa: clone(
        data.questions_reponses
          .filter((q) => q.decision_id === id)
          .sort((a, b) => (a.created_at < b.created_at ? -1 : 1)),
      ),
      signature: clone(data.registre_signatures.find((s) => s.decision_id === id) ?? null),
      status_history: clone(
        data.decision_status_history.filter((h) => h.decision_id === id),
      ),
    }
  },
  async createDecision(input) {
    await delay()
    const data = load()
    const d = {
      id: uid(),
      statut: 'en_cours',
      cloture: false,
      quorum_atteint: null,
      composition_snapshot: null,
      ag_id: null,
      resolution_id: null,
      created_by: getSessionUserId(),
      created_at: nowISO(),
      updated_at: nowISO(),
      ...input,
    }
    data.decisions.push(d)
    audit(data, 'decisions', d.id, 'create', `Création décision ${d.numero}`)
    save(data)
    return clone(d)
  },
  async updateDecision(id, patch) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    Object.assign(d, patch, { updated_at: nowISO() })
    audit(data, 'decisions', id, 'update', `Modification décision ${d.numero}`)
    save(data)
    return clone(d)
  },
  async deleteDecision(id) {
    await delay()
    const data = load()
    data.decisions = data.decisions.filter((x) => x.id !== id)
    data.votes = data.votes.filter((v) => v.decision_id !== id)
    data.questions_reponses = data.questions_reponses.filter((q) => q.decision_id !== id)
    save(data)
    return { ok: true }
  },
  // Close the vote: snapshot composition, set quorum + statut, log history.
  async closeDecision(id, { statut, quorum_atteint, composition_snapshot }) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    const ancien = d.statut
    d.statut = statut
    d.quorum_atteint = quorum_atteint
    d.composition_snapshot = composition_snapshot
    d.cloture = true
    d.updated_at = nowISO()
    data.decision_status_history.push({
      id: uid(),
      decision_id: id,
      ancien_statut: ancien,
      nouveau_statut: statut,
      changed_by: getSessionUserId(),
      changed_at: nowISO(),
    })
    audit(data, 'decisions', id, 'close', `Clôture du vote — ${statut}`)
    save(data)
    return clone(d)
  },
  async reopenDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) throw new Error('Décision introuvable')
    d.cloture = false
    d.statut = 'en_cours'
    d.quorum_atteint = null
    d.updated_at = nowISO()
    audit(data, 'decisions', id, 'reopen', 'Réouverture du vote')
    save(data)
    return clone(d)
  },

  // ---- Votes ----
  async upsertVote(decision_id, membre_id, vote, commentaire) {
    await delay()
    const data = load()
    let v = data.votes.find((x) => x.decision_id === decision_id && x.membre_id === membre_id)
    if (v) {
      v.vote = vote
      v.commentaire = commentaire ?? v.commentaire ?? ''
      v.date_vote = nowISO()
    } else {
      v = { id: uid(), decision_id, membre_id, vote, commentaire: commentaire || '', date_vote: nowISO() }
      data.votes.push(v)
    }
    save(data)
    return clone(v)
  },

  // ---- Q&A ----
  async addQA({ decision_id, auteur_id, type, parent_id, texte }) {
    await delay()
    const data = load()
    const q = { id: uid(), decision_id, auteur_id, type, parent_id: parent_id || null, texte, created_at: nowISO() }
    data.questions_reponses.push(q)
    save(data)
    return clone(q)
  },

  // ---- Signatures ----
  async getSignature(decision_id) {
    await delay()
    return clone(load().registre_signatures.find((s) => s.decision_id === decision_id) ?? null)
  },
  async saveSignatureRequest(rec) {
    await delay()
    const data = load()
    const existing = data.registre_signatures.find((s) => s.decision_id === rec.decision_id)
    if (existing) {
      Object.assign(existing, rec)
      save(data)
      return clone(existing)
    }
    const s = { id: uid(), created_at: nowISO(), ...rec }
    data.registre_signatures.push(s)
    audit(data, 'registre_signatures', s.id, 'create', 'Demande de signature')
    save(data)
    return clone(s)
  },

  // ---- Audit ----
  async listAudit(limit = 100) {
    await delay()
    return clone(load().audit_log).sort(byDateDesc('created_at')).slice(0, limit)
  },
}
