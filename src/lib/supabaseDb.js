// Supabase implementation of the repository interface (mirror of mockRepo).
// Only exercised when VITE_SUPABASE_URL/ANON_KEY are configured.
// Table shapes follow supabase/schema.sql.
import { supabase } from './supabase'
import { computeAGBudgets, computeProjectBudgets } from './mockDb'

function must(result) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

export const supabaseAuth = {
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message)
    return await resolveUser(data.user)
  },
  async signOut() {
    await supabase.auth.signOut()
  },
  getSession() {
    return null
  },
  async resetPassword(email) {
    const redirectTo = `${window.location.origin}/reset-password`
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    if (error) throw new Error(error.message)
    return { ok: true, email }
  },
}

export async function resolveUser(authUser) {
  if (!authUser) return null
  const { data: membre } = await supabase.from('membres_cs').select('*').eq('email', authUser.email).maybeSingle()
  return {
    id: authUser.id,
    email: authUser.email,
    role: membre?.role === 'president' ? 'admin' : 'membre',
    membre_id: membre?.id ?? null,
    nom: membre?.nom,
    prenom: membre?.prenom,
    // Drapeau "a défini son mot de passe" (posé après le 1er changement).
    password_changed: authUser.user_metadata?.password_changed === true,
  }
}

export const supabaseRepo = {
  // ---- Membres ----
  async listMembres() {
    return must(await supabase.from('membres_cs').select('*').order('nom'))
  },
  async createMembre(input) {
    return must(await supabase.from('membres_cs').insert(input).select())[0]
  },
  async updateMembre(id, patch) {
    return must(await supabase.from('membres_cs').update(patch).eq('id', id).select())[0]
  },
  async deactivateMembre(id, date_fin) {
    return this.updateMembre(id, { actif: false, date_fin: date_fin || new Date().toISOString().slice(0, 10) })
  },

  // ---- AG ----
  async listAG() {
    return must(await supabase.from('assemblees_generales').select('*').order('date_ag', { ascending: false }))
  },
  async getAG(id) {
    const ag = must(await supabase.from('assemblees_generales').select('*').eq('id', id).maybeSingle())
    if (!ag) return null
    const resolutions = must(await supabase.from('resolutions_ag').select('*').eq('ag_id', id).order('numero'))
    return { ...ag, resolutions }
  },
  async createAG(input) {
    return must(await supabase.from('assemblees_generales').insert(input).select())[0]
  },
  async updateAG(id, patch) {
    return must(await supabase.from('assemblees_generales').update(patch).eq('id', id).select())[0]
  },
  async deleteAG(id) {
    const { count } = await supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('ag_id', id)
    if (count > 0) throw new Error('AG non supprimable : au moins une décision y est rattachée.')
    must(await supabase.from('assemblees_generales').delete().eq('id', id))
    return { ok: true }
  },

  // ---- Résolutions ----
  async createResolution(input) {
    return must(await supabase.from('resolutions_ag').insert(input).select())[0]
  },
  // Le rattachement vit désormais sur la résolution : le verrou se lit sur
  // `resolutions_ag.projet_id`, plus par un compte de projets.
  async updateResolution(id, patch) {
    const { count: dc } = await supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('resolution_id', id)
    const r = must(await supabase.from('resolutions_ag').select('projet_id').eq('id', id).maybeSingle())
    if (dc > 0 || r?.projet_id) throw new Error('Résolution verrouillée : une décision ou un projet y est rattaché.')
    return must(await supabase.from('resolutions_ag').update(patch).eq('id', id).select())[0]
  },
  async deleteResolution(id) {
    const { count: dc } = await supabase.from('decisions').select('id', { count: 'exact', head: true }).eq('resolution_id', id)
    const r = must(await supabase.from('resolutions_ag').select('projet_id').eq('id', id).maybeSingle())
    if (dc > 0) throw new Error('Résolution non supprimable : une décision y est rattachée.')
    if (r?.projet_id) throw new Error('Résolution non supprimable : elle finance un projet.')
    must(await supabase.from('resolutions_ag').delete().eq('id', id))
    return { ok: true }
  },

  // ---- Budgets AG (alloué / engagé / restant) ----
  async listAGBudgets() {
    const assemblees_generales = must(await supabase.from('assemblees_generales').select('id,numero,date_ag'))
    const resolutions_ag = must(await supabase.from('resolutions_ag').select('*'))
    const decisions = must(await supabase.from('decisions').select('id,numero,titre,statut,enregistree,resolution_id,projet_id,montant_engage'))
    const projets = must(await supabase.from('projets').select('id,nom'))
    return computeAGBudgets({ assemblees_generales, resolutions_ag, decisions, projets })
  },

  // ---- Projets ----
  // ⚠ Les colonnes listées ici ALIMENTENT computeProjectBudgets : le budget d'un
  // projet est dérivé de `resolutions_ag` (projet_id + statut + budget_alloue).
  // Un select trop étroit ne lève AUCUNE erreur — il rend juste des budgets à 0,
  // en prod seulement (le mock, lui, a toujours les objets complets). Toute
  // colonne lue par les fonctions de calcul doit figurer ci-dessous.
  async _projectData() {
    const projets = must(await supabase.from('projets').select('*'))
    // `projet_action`, `date_enregistrement` et `created_at` alimentent la dérivation
    // du STATUT (dernière décision enregistrée qui suspend / reprend / termine).
    const decisions = must(await supabase.from('decisions').select('id,numero,titre,statut,enregistree,projet_id,montant_engage,projet_action,date_enregistrement,created_at'))
    const membres_cs = must(await supabase.from('membres_cs').select('id,nom,prenom'))
    const assemblees_generales = must(await supabase.from('assemblees_generales').select('id,numero,date_ag'))
    const resolutions_ag = must(await supabase.from('resolutions_ag').select('id,ag_id,numero,titre,statut,budget_alloue,projet_id'))
    return { projets, decisions, membres_cs, assemblees_generales, resolutions_ag }
  },
  async listProjets() {
    return computeProjectBudgets(await this._projectData())
  },
  async getProjet(id) {
    const computed = (await this.listProjets()).find((x) => x.id === id)
    if (!computed) return null
    const decisions = must(await supabase.from('decisions').select('*').eq('projet_id', id))
    return { ...computed, decisions }
  },
  // `resolution_ids` est un champ VIRTUEL (le rattachement vit sur la résolution),
  // à retirer du payload : PostgREST rejette toute colonne inconnue.
  //
  // ⚠ Non atomique : insert projets + update resolutions_ag. Si le 2e échoue, on
  // se retrouverait avec un projet sans résolution, donc à budget 0 — on le
  // supprime alors pour ne pas laisser d'orphelin. Une RPC serait plus propre ;
  // pas d'Edge Function ni de RPC dans ce projet à ce jour (cf. CLAUDE.md).
  async createProjet({ resolution_ids = [], ...input }) {
    const p = must(await supabase.from('projets').insert(input).select())[0]
    if (resolution_ids.length) {
      const { error } = await supabase.from('resolutions_ag').update({ projet_id: p.id }).in('id', resolution_ids)
      if (error) {
        await supabase.from('projets').delete().eq('id', p.id)
        throw new Error(`Projet non créé (rattachement des résolutions impossible) : ${error.message}`)
      }
    }
    return p
  },
  async updateProjet(id, patch) {
    const { resolution_ids, ...cols } = patch // eslint-disable-line no-unused-vars
    return must(await supabase.from('projets').update(cols).eq('id', id).select())[0]
  },
  // Les résolutions sont détachées par la FK (`on delete set null`, migration 009),
  // pas ici : c'est la base qui garantit qu'aucune ne reste orpheline.
  //
  // La garde « décision enregistrée » est doublée en base par le trigger
  // `projets_delete_guard` (migration 010) : le contrôle ci-dessous ne sert qu'à
  // rendre l'erreur lisible avant l'aller-retour.
  async deleteProjet(id) {
    const { count } = await supabase.from('decisions').select('id', { count: 'exact', head: true })
      .eq('projet_id', id).eq('enregistree', true)
    if (count > 0) throw new Error('Projet non supprimable : une décision enregistrée y est rattachée.')
    must(await supabase.from('projets').delete().eq('id', id))
    return { ok: true }
  },
  async setResolutionProjet(resolutionId, projetId) {
    return must(await supabase.from('resolutions_ag').update({ projet_id: projetId || null }).eq('id', resolutionId).select())[0]
  },
  async addProjetDocument(projetId, doc) {
    const p = must(await supabase.from('projets').select('documents').eq('id', projetId).maybeSingle())
    const record = { id: crypto.randomUUID(), uploaded_at: new Date().toISOString(), ...doc }
    const documents = [...(p?.documents || []), record]
    must(await supabase.from('projets').update({ documents }).eq('id', projetId))
    return record
  },
  async removeProjetDocument(projetId, docId) {
    const p = must(await supabase.from('projets').select('documents').eq('id', projetId).maybeSingle())
    const documents = (p?.documents || []).filter((x) => x.id !== docId)
    must(await supabase.from('projets').update({ documents }).eq('id', projetId))
    return { ok: true }
  },

  // ---- Décisions ----
  async listDecisions() {
    return must(await supabase.from('decisions').select('*').order('date_publication', { ascending: false }))
  },
  async getDecision(id) {
    const d = must(await supabase.from('decisions').select('*').eq('id', id).maybeSingle())
    if (!d) return null
    const votes = must(await supabase.from('votes').select('*').eq('decision_id', id))
    const qa = must(await supabase.from('questions_reponses').select('*').eq('decision_id', id).order('created_at'))
    const status_history = must(await supabase.from('decision_status_history').select('*').eq('decision_id', id).order('changed_at'))
    const { data: batches } = await supabase.from('signature_batches').select('*').contains('decision_ids', [id])
    return { ...d, votes, qa, status_history, signature_batch: batches?.[0] || null }
  },
  async createDecision(input) {
    return must(await supabase.from('decisions').insert(input).select())[0]
  },
  async updateDecision(id, patch) {
    return must(await supabase.from('decisions').update(patch).eq('id', id).select())[0]
  },
  // Deux gardes distinctes, à ne pas confondre :
  //  - `enregistree` = verrou légal. Doublé en base par la policy restrictive
  //    `decisions_no_delete_enregistree` (migration 008) : le contrôle ci-dessous
  //    ne sert qu'à rendre l'erreur lisible.
  //  - « au plus 1 vote » = garde-fou de saisie, applicatif seulement.
  async deleteDecision(id) {
    const d = must(await supabase.from('decisions').select('enregistree').eq('id', id).maybeSingle())
    if (d?.enregistree) throw new Error('Décision enregistrée : non supprimable.')
    const { count } = await supabase.from('votes').select('id', { count: 'exact', head: true }).eq('decision_id', id)
    if (count > 1) throw new Error('Décision déjà votée par plusieurs membres : non supprimable.')
    must(await supabase.from('decisions').delete().eq('id', id))
    return { ok: true }
  },
  // Horodate le partage au CS. Volontairement hors updateDecision : ce n'est
  // pas une modification de contenu, et une relance doit rester possible.
  async markDecisionNotified(id) {
    return must(
      await supabase.from('decisions')
        .update({ date_notification: new Date().toISOString() })
        .eq('id', id).select(),
    )[0]
  },
  async recordDecision(id, { statut, quorum_atteint, composition_snapshot, date_enregistrement }) {
    const current = must(await supabase.from('decisions').select('statut').eq('id', id).maybeSingle())
    const row = must(
      await supabase.from('decisions').update({
        statut, quorum_atteint, composition_snapshot, enregistree: true,
        date_enregistrement: date_enregistrement || new Date().toISOString().slice(0, 10),
      }).eq('id', id).select(),
    )[0]
    await supabase.from('decision_status_history').insert({ decision_id: id, ancien_statut: current?.statut ?? null, nouveau_statut: statut })
    return row
  },

  // ---- Documents ----
  async addDocument(decisionId, doc) {
    const d = must(await supabase.from('decisions').select('documents').eq('id', decisionId).maybeSingle())
    const record = { id: crypto.randomUUID(), uploaded_at: new Date().toISOString(), ...doc }
    const documents = [...(d?.documents || []), record]
    must(await supabase.from('decisions').update({ documents }).eq('id', decisionId))
    return record
  },
  async removeDocument(decisionId, docId) {
    const d = must(await supabase.from('decisions').select('documents').eq('id', decisionId).maybeSingle())
    const documents = (d?.documents || []).filter((x) => x.id !== docId)
    must(await supabase.from('decisions').update({ documents }).eq('id', decisionId))
    return { ok: true }
  },

  // ---- Votes ----
  async upsertVote(decision_id, membre_id, vote, commentaire) {
    return must(
      await supabase.from('votes').upsert(
        { decision_id, membre_id, vote, commentaire: commentaire ?? '', date_vote: new Date().toISOString() },
        { onConflict: 'decision_id,membre_id' },
      ).select(),
    )[0]
  },
  async listMyVotes(membre_id) {
    return must(await supabase.from('votes').select('decision_id,vote').eq('membre_id', membre_id))
  },
  async deleteVote(decision_id, membre_id) {
    must(await supabase.from('votes').delete().eq('decision_id', decision_id).eq('membre_id', membre_id))
    return { ok: true }
  },

  // ---- Q&A ----
  async addQA(input) {
    return must(await supabase.from('questions_reponses').insert(input).select())[0]
  },

  // ---- Signature par lot ----
  async listSignatureBatches() {
    return must(await supabase.from('signature_batches').select('*').order('created_at', { ascending: false }))
  },
  async createSignatureBatch(input) {
    return must(await supabase.from('signature_batches').insert({ ...input, statut: input.statut || 'en_attente' }).select())[0]
  },
  async markBatchSigned(batchId, pdf_url) {
    return must(await supabase.from('signature_batches').update({ statut: 'signe', pdf_url: pdf_url || null, signed_at: new Date().toISOString() }).eq('id', batchId).select())[0]
  },

  // ---- Audit ----
  async listAudit(limit = 100) {
    return must(await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit))
  },
}
