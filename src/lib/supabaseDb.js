// Supabase implementation of the repository interface (mirror of mockRepo).
// Only exercised when VITE_SUPABASE_URL/ANON_KEY are configured.
// Table shapes follow supabase/schema.sql.
import { supabase } from './supabase'

function must(result) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export const supabaseAuth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw new Error(error.message)
    return await resolveUser(data.user)
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  getSession() {
    // Supabase session is async; the AuthContext handles it via onAuthStateChange.
    return null
  },
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim())
    if (error) throw new Error(error.message)
    return { ok: true, email }
  },
}

// Enrich the auth user with role + membre profile (joined via email).
export async function resolveUser(authUser) {
  if (!authUser) return null
  const { data: membre } = await supabase
    .from('membres_cs')
    .select('*')
    .eq('email', authUser.email)
    .maybeSingle()
  return {
    id: authUser.id,
    email: authUser.email,
    role: membre?.role === 'president' ? 'admin' : 'membre',
    membre_id: membre?.id ?? null,
    nom: membre?.nom,
    prenom: membre?.prenom,
  }
}

export const supabaseRepo = {
  // ---- Membres ----
  async listMembres() {
    return must(await supabase.from('membres_cs').select('*').order('nom'))
  },
  async createMembre(input) {
    const rows = must(await supabase.from('membres_cs').insert(input).select())
    return rows[0]
  },
  async updateMembre(id, patch) {
    const rows = must(await supabase.from('membres_cs').update(patch).eq('id', id).select())
    return rows[0]
  },
  async deactivateMembre(id, date_fin) {
    return this.updateMembre(id, {
      actif: false,
      date_fin: date_fin || new Date().toISOString().slice(0, 10),
    })
  },

  // ---- AG ----
  async listAG() {
    return must(await supabase.from('assemblees_generales').select('*').order('date_ag', { ascending: false }))
  },
  async getAG(id) {
    const ag = must(await supabase.from('assemblees_generales').select('*').eq('id', id).maybeSingle())
    if (!ag) return null
    const resolutions = must(
      await supabase.from('resolutions_ag').select('*').eq('ag_id', id).order('numero'),
    )
    const budgets = must(await supabase.from('budgets_ag').select('*').eq('ag_id', id))
    return { ...ag, resolutions, budgets }
  },
  async createAG(input) {
    const rows = must(await supabase.from('assemblees_generales').insert(input).select())
    return rows[0]
  },
  async updateAG(id, patch) {
    const rows = must(await supabase.from('assemblees_generales').update(patch).eq('id', id).select())
    return rows[0]
  },
  async deleteAG(id) {
    must(await supabase.from('assemblees_generales').delete().eq('id', id))
    return { ok: true }
  },

  // ---- Résolutions ----
  async createResolution(input) {
    const rows = must(await supabase.from('resolutions_ag').insert(input).select())
    return rows[0]
  },
  async updateResolution(id, patch) {
    const rows = must(await supabase.from('resolutions_ag').update(patch).eq('id', id).select())
    return rows[0]
  },
  async deleteResolution(id) {
    must(await supabase.from('resolutions_ag').delete().eq('id', id))
    return { ok: true }
  },

  // ---- Budgets ----
  async listBudgets() {
    const budgets = must(await supabase.from('budgets_ag').select('*'))
    const ags = must(await supabase.from('assemblees_generales').select('id,numero,date_ag'))
    const byId = Object.fromEntries(ags.map((a) => [a.id, a]))
    return budgets.map((b) => ({
      ...b,
      ag_numero: byId[b.ag_id]?.numero ?? '—',
      ag_date: byId[b.ag_id]?.date_ag ?? null,
    }))
  },
  async createBudget(input) {
    const rows = must(await supabase.from('budgets_ag').insert(input).select())
    return rows[0]
  },
  async updateBudget(id, patch) {
    const rows = must(await supabase.from('budgets_ag').update(patch).eq('id', id).select())
    return rows[0]
  },
  async deleteBudget(id) {
    must(await supabase.from('budgets_ag').delete().eq('id', id))
    return { ok: true }
  },

  // ---- Décisions ----
  async listDecisions() {
    return must(await supabase.from('decisions').select('*').order('date_decision', { ascending: false }))
  },
  async getDecision(id) {
    const d = must(await supabase.from('decisions').select('*').eq('id', id).maybeSingle())
    if (!d) return null
    const votes = must(await supabase.from('votes').select('*').eq('decision_id', id))
    const qa = must(
      await supabase.from('questions_reponses').select('*').eq('decision_id', id).order('created_at'),
    )
    const signature = must(
      await supabase.from('registre_signatures').select('*').eq('decision_id', id).maybeSingle(),
    )
    const status_history = must(
      await supabase.from('decision_status_history').select('*').eq('decision_id', id).order('changed_at'),
    )
    return { ...d, votes, qa, signature, status_history }
  },
  async createDecision(input) {
    const rows = must(await supabase.from('decisions').insert(input).select())
    return rows[0]
  },
  async updateDecision(id, patch) {
    const rows = must(await supabase.from('decisions').update(patch).eq('id', id).select())
    return rows[0]
  },
  async deleteDecision(id) {
    must(await supabase.from('decisions').delete().eq('id', id))
    return { ok: true }
  },
  async closeDecision(id, { statut, quorum_atteint, composition_snapshot }) {
    const current = must(await supabase.from('decisions').select('statut').eq('id', id).maybeSingle())
    const rows = must(
      await supabase
        .from('decisions')
        .update({ statut, quorum_atteint, composition_snapshot, cloture: true })
        .eq('id', id)
        .select(),
    )
    await supabase.from('decision_status_history').insert({
      decision_id: id,
      ancien_statut: current?.statut ?? null,
      nouveau_statut: statut,
    })
    return rows[0]
  },
  async reopenDecision(id) {
    const rows = must(
      await supabase
        .from('decisions')
        .update({ cloture: false, statut: 'en_cours', quorum_atteint: null })
        .eq('id', id)
        .select(),
    )
    return rows[0]
  },

  // ---- Votes ----
  async upsertVote(decision_id, membre_id, vote, commentaire) {
    const rows = must(
      await supabase
        .from('votes')
        .upsert(
          { decision_id, membre_id, vote, commentaire: commentaire || '', date_vote: new Date().toISOString() },
          { onConflict: 'decision_id,membre_id' },
        )
        .select(),
    )
    return rows[0]
  },

  // ---- Q&A ----
  async addQA(input) {
    const rows = must(await supabase.from('questions_reponses').insert(input).select())
    return rows[0]
  },

  // ---- Signatures ----
  async getSignature(decision_id) {
    return must(
      await supabase.from('registre_signatures').select('*').eq('decision_id', decision_id).maybeSingle(),
    )
  },
  async saveSignatureRequest(rec) {
    const rows = must(
      await supabase.from('registre_signatures').upsert(rec, { onConflict: 'decision_id' }).select(),
    )
    return rows[0]
  },

  // ---- Audit ----
  async listAudit(limit = 100) {
    return must(
      await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit),
    )
  },
}
