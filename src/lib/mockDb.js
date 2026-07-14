// localStorage-backed demo backend. Same async repository interface as
// supabaseDb.js. Model v2 (révisé 2026-07-14) :
//   - décisions CS : 3 dates (publication / limite réponse / enregistrement),
//     vote self-only pour/contre/abstention, enregistrement par le président
//     (verrou après), budget alloué (attribut), rattachement AG, pièces jointes.
//   - résolutions AG : résultat seul (majorité + statut) + budget alloué.
//   - signature : par LOT de décisions sélectionnées.

const STORAGE_KEY = 'cs_rives_mockdb_v3'
const SESSION_KEY = 'cs_rives_session'

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ??
    'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36))

const nowISO = () => new Date().toISOString()
const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms))
const b64 = (s) => (globalThis.btoa ? globalThis.btoa(s) : '')

// ---------------------------------------------------------------- seed
function seed() {
  const mPresident = uid()
  const mVice = uid()
  const m3 = uid()
  const m4 = uid()
  const m5 = uid()

  const membres_cs = [
    { id: mPresident, nom: 'Favre', prenom: 'Pascal', email: 'pfavre25@gmail.com', role: 'president', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: mVice, nom: 'Martin', prenom: 'Claire', email: 'claire.martin@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m3, nom: 'Dubois', prenom: 'Henri', email: 'henri.dubois@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m4, nom: 'Leroy', prenom: 'Sophie', email: 'sophie.leroy@example.fr', role: 'membre', date_election: '2025-06-19', date_fin: null, ag_election: 'AGO 19 juin 2025', actif: true, created_at: '2025-06-19T18:00:00Z' },
    { id: m5, nom: 'Petit', prenom: 'Marc', email: 'marc.petit@example.fr', role: 'membre', date_election: '2024-06-15', date_fin: '2025-06-19', ag_election: 'AGO 15 juin 2024', actif: false, created_at: '2024-06-15T18:00:00Z' },
  ]

  const accounts = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({ id: m.id, email: m.email, password: 'demo', role: m.role === 'president' ? 'admin' : 'membre', membre_id: m.id }))

  const agAGO = uid()
  const agAGE = uid()
  const assemblees_generales = [
    { id: agAGO, numero: 'AGO-2025-01', type: 'AGO', date_ag: '2025-06-19', lieu: 'Salle des fêtes de Nernier', president_seance: 'Pascal Favre', ordre_du_jour: '1. Approbation des statuts ASL\n2. Élection du Conseil Syndical\n3. Budget travaux voirie 2025', statut: 'cloturee', pv_url: null, created_at: '2025-06-19T18:00:00Z', updated_at: '2025-06-20T09:00:00Z' },
    { id: agAGE, numero: 'AGE-2026-01', type: 'AGE', date_ag: '2026-09-12', lieu: 'Mairie de Nernier', president_seance: 'Pascal Favre', ordre_du_jour: '1. Travaux réfection réseau eaux pluviales\n2. Appel de fonds exceptionnel', statut: 'en_cours', pv_url: null, created_at: '2026-07-01T10:00:00Z', updated_at: '2026-07-01T10:00:00Z' },
  ]

  const rApprobStatuts = uid()
  const rElection = uid()
  const rBudgetVoirie = uid()
  const resolutions_ag = [
    { id: rApprobStatuts, ag_id: agAGO, numero: 1, titre: 'Approbation des statuts de l’ASL', description: "L'assemblée approuve les statuts de l'ASL du Lotissement de Rives.", majorite_requise: 'double_qualifiee', statut: 'adoptee', budget_alloue: 4200, budget_intitule: 'Honoraires Me Garnier — statuts ASL', observations: 'Double majorité qualifiée atteinte (détail au PV).', created_at: '2025-06-19T18:30:00Z' },
    { id: rElection, ag_id: agAGO, numero: 2, titre: 'Élection des membres du Conseil Syndical', description: 'Élection de Pascal Favre (président), Claire Martin, Henri Dubois, Sophie Leroy.', majorite_requise: 'simple', statut: 'adoptee', budget_alloue: null, budget_intitule: '', observations: '', created_at: '2025-06-19T19:00:00Z' },
    { id: rBudgetVoirie, ag_id: agAGO, numero: 3, titre: 'Budget travaux de voirie 2025', description: 'Réfection de la voirie principale, répartie à la superficie.', majorite_requise: 'absolue', statut: 'adoptee', budget_alloue: 85000, budget_intitule: 'Réfection voirie principale', observations: '', created_at: '2025-06-19T19:30:00Z' },
  ]

  const d1 = uid()
  const d2 = uid()
  const d3 = uid()
  const decisions = [
    {
      id: d1, numero: '2026-001',
      date_publication: '2026-02-03', date_limite_reponse: '2026-02-12', date_enregistrement: '2026-02-10',
      titre: 'Choix du prestataire d’entretien des espaces verts',
      description: '<p>Le Conseil Syndical retient la société <strong>VertPro SARL</strong> pour l’entretien des espaces verts communs.</p><ul><li>Contrat d’un an renouvelable</li><li>Passage bimensuel</li></ul>',
      statut: 'adoptee', enregistree: true, quorum_atteint: true,
      budget_alloue: 5800, budget_intitule: 'Entretien espaces verts (annuel)',
      ag_id: null, resolution_id: null,
      documents: [{ id: uid(), name: 'Offre_VertPro.txt', type: 'text/plain', size: 32, dataUrl: 'data:text/plain;base64,' + b64('Offre VertPro SARL — 5 800 € TTC/an'), uploaded_at: '2026-02-03T10:05:00Z' }],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-02-03T10:00:00Z', updated_at: '2026-02-10T11:00:00Z',
    },
    {
      id: d2, numero: '2026-002',
      date_publication: '2026-05-05', date_limite_reponse: '2026-05-14', date_enregistrement: '2026-05-14',
      titre: 'Installation d’un portail automatique à l’entrée du lotissement',
      description: '<p>Décision d’installer un <strong>portail automatique</strong> à l’entrée principale. Devis PortAlp : 12 400 € TTC.</p>',
      statut: 'rejetee', enregistree: true, quorum_atteint: true,
      budget_alloue: 12400, budget_intitule: 'Portail automatique',
      ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-05-05T10:00:00Z', updated_at: '2026-05-14T12:00:00Z',
    },
    {
      id: d3, numero: '2026-003',
      date_publication: '2026-07-08', date_limite_reponse: '2026-07-17', date_enregistrement: null,
      titre: 'Réparation de l’éclairage public — allée des Tilleuls',
      description: '<p>Remplacement de 4 lampadaires défectueux allée des Tilleuls. Devis en cours d’analyse.</p>',
      statut: 'en_cours', enregistree: false, quorum_atteint: null,
      budget_alloue: null, budget_intitule: '',
      ag_id: null, resolution_id: null, documents: [],
      composition_snapshot: null, created_by: mPresident, created_at: '2026-07-08T09:00:00Z', updated_at: '2026-07-08T09:00:00Z',
    },
  ]

  const activeSnapshot = membres_cs
    .filter((m) => m.actif)
    .map((m) => ({ id: m.id, nom: m.nom, prenom: m.prenom, role: m.role, ag_election: m.ag_election, date_election: m.date_election }))
  decisions[0].composition_snapshot = activeSnapshot
  decisions[1].composition_snapshot = activeSnapshot

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
  ]

  const q1 = uid()
  const questions_reponses = [
    { id: q1, decision_id: d1, auteur_id: m4, type: 'question', parent_id: null, texte: 'Le contrat inclut-il le ramassage des feuilles en automne ?', created_at: '2026-02-04T14:00:00Z' },
    { id: uid(), decision_id: d1, auteur_id: mPresident, type: 'reponse', parent_id: q1, texte: 'Oui, deux passages spécifiques en octobre et novembre.', created_at: '2026-02-04T16:00:00Z' },
  ]

  // Signature par lot : un lot signé couvrant d1.
  const signature_batches = [
    { id: uid(), titre: 'Décisions février 2026', decision_ids: [d1], yousign_request_id: 'mock-batch-0001', statut: 'signe', pdf_url: 'mock://signed/lot-fev-2026.pdf', signataires: ['pfavre25@gmail.com', 'claire.martin@example.fr', 'henri.dubois@example.fr'], created_at: '2026-02-11T09:00:00Z', signed_at: '2026-02-13T15:00:00Z' },
  ]

  const decision_status_history = [
    { id: uid(), decision_id: d1, ancien_statut: 'en_cours', nouveau_statut: 'adoptee', changed_by: mPresident, changed_at: '2026-02-10T11:00:00Z' },
    { id: uid(), decision_id: d2, ancien_statut: 'en_cours', nouveau_statut: 'rejetee', changed_by: mPresident, changed_at: '2026-05-14T12:00:00Z' },
  ]

  const audit_log = [
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'create', acteur: mPresident, details: 'Création décision 2026-001', created_at: '2026-02-03T10:00:00Z' },
    { id: uid(), entite: 'decisions', entite_id: d1, action: 'record', acteur: mPresident, details: 'Enregistrement — adoptée', created_at: '2026-02-10T11:00:00Z' },
  ]

  return { accounts, membres_cs, assemblees_generales, resolutions_ag, decisions, votes, questions_reponses, signature_batches, decision_status_history, audit_log }
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

function getSessionUserId() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))?.user?.membre_id ?? null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------- session/auth
export const mockAuth = {
  async signIn(email, password) {
    await delay()
    const data = load()
    const acc = data.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!acc || acc.password !== password) throw new Error('Identifiants invalides.')
    const membre = data.membres_cs.find((m) => m.id === acc.membre_id)
    const user = { id: acc.id, email: acc.email, role: acc.role, membre_id: acc.membre_id, nom: membre?.nom, prenom: membre?.prenom }
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
      return user
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
    return { ...clone(ag), resolutions: clone(data.resolutions_ag.filter((r) => r.ag_id === id).sort((a, b) => a.numero - b.numero)) }
  },
  async createAG(input) {
    await delay()
    const data = load()
    const ag = { id: uid(), statut: 'en_cours', created_at: nowISO(), updated_at: nowISO(), ...input }
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
    audit(data, 'assemblees_generales', id, 'delete', 'Suppression AG')
    save(data)
    return { ok: true }
  },

  // ---- Résolutions (résultat seul + budget alloué) ----
  async createResolution(input) {
    await delay()
    const data = load()
    const r = { id: uid(), created_at: nowISO(), observations: '', budget_alloue: null, budget_intitule: '', ...input }
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

  // ---- Budgets alloués (vue consolidée : dérivée des décisions + résolutions) ----
  async listBudgets() {
    await delay()
    const data = load()
    const agById = Object.fromEntries(data.assemblees_generales.map((a) => [a.id, a]))
    const rows = []
    for (const r of data.resolutions_ag) {
      if (r.budget_alloue != null && r.budget_alloue !== '') {
        const ag = agById[r.ag_id]
        rows.push({ id: r.id, source: 'AG', reference: `${ag?.numero || 'AG'} · Rés. ${r.numero}`, date: ag?.date_ag || null, intitule: r.budget_intitule || r.titre, montant_alloue: Number(r.budget_alloue) })
      }
    }
    for (const d of data.decisions) {
      if (d.budget_alloue != null && d.budget_alloue !== '') {
        rows.push({ id: d.id, source: 'CS', reference: d.numero, date: d.date_enregistrement || d.date_publication, intitule: d.budget_intitule || d.titre, montant_alloue: Number(d.budget_alloue), statut: d.statut })
      }
    }
    return rows
  },

  // ---- Décisions CS ----
  async listDecisions() {
    await delay()
    return clone(load().decisions).sort(byDateDesc('date_publication'))
  },
  async getDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (!d) return null
    const batch = data.signature_batches.find((b) => b.decision_ids.includes(id)) || null
    return {
      ...clone(d),
      votes: clone(data.votes.filter((v) => v.decision_id === id)),
      qa: clone(data.questions_reponses.filter((q) => q.decision_id === id).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))),
      signature_batch: clone(batch),
      status_history: clone(data.decision_status_history.filter((h) => h.decision_id === id)),
    }
  },
  async createDecision(input) {
    await delay()
    const data = load()
    const d = {
      id: uid(), statut: 'en_cours', enregistree: false, quorum_atteint: null, composition_snapshot: null,
      budget_alloue: null, budget_intitule: '', ag_id: null, resolution_id: null, documents: [], date_enregistrement: null,
      created_by: getSessionUserId(), created_at: nowISO(), updated_at: nowISO(), ...input,
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
    if (d.enregistree) throw new Error('Décision enregistrée : non modifiable.')
    Object.assign(d, patch, { updated_at: nowISO() })
    audit(data, 'decisions', id, 'update', `Modification décision ${d.numero}`)
    save(data)
    return clone(d)
  },
  async deleteDecision(id) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === id)
    if (d?.enregistree) throw new Error('Décision enregistrée : non supprimable.')
    data.decisions = data.decisions.filter((x) => x.id !== id)
    data.votes = data.votes.filter((v) => v.decision_id !== id)
    data.questions_reponses = data.questions_reponses.filter((q) => q.decision_id !== id)
    save(data)
    return { ok: true }
  },
  // Enregistrement par le président (contrôle quorum côté appelant).
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
  async addDocument(decisionId, doc) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === decisionId)
    if (!d) throw new Error('Décision introuvable')
    const record = { id: uid(), uploaded_at: nowISO(), ...doc }
    d.documents = [...(d.documents || []), record]
    d.updated_at = nowISO()
    audit(data, 'decisions', decisionId, 'attach', `Pièce jointe : ${doc.name}`)
    save(data)
    return clone(record)
  },
  async removeDocument(decisionId, docId) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === decisionId)
    if (!d) throw new Error('Décision introuvable')
    d.documents = (d.documents || []).filter((x) => x.id !== docId)
    save(data)
    return { ok: true }
  },

  // ---- Votes (self-only côté UI) ----
  async upsertVote(decision_id, membre_id, vote, commentaire) {
    await delay()
    const data = load()
    const d = data.decisions.find((x) => x.id === decision_id)
    if (d?.enregistree) throw new Error('Vote clos : décision enregistrée.')
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
  async deleteVote(decision_id, membre_id) {
    await delay()
    const data = load()
    data.votes = data.votes.filter((x) => !(x.decision_id === decision_id && x.membre_id === membre_id))
    save(data)
    return { ok: true }
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

  // ---- Audit ----
  async listAudit(limit = 100) {
    await delay()
    return clone(load().audit_log).sort(byDateDesc('created_at')).slice(0, limit)
  },
}
