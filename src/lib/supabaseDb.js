// Supabase implementation of the repository interface (mirror of mockRepo).
// Only exercised when VITE_SUPABASE_URL/ANON_KEY are configured.
// Table shapes follow supabase/schema.sql.
import { supabase } from './supabase'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'
import { computeAGBudgets, computeProjectBudgets } from './mockDb'
import { compareProjets } from './projetLogic'

function must(result) {
  if (result.error) throw new Error(result.error.message)
  return result.data
}

// Email canonique : minuscules + trim. La casse a déjà cassé la RLS en prod
// (incident 2026-07-19, migration 018) — un membre saisi « Marc@… » ne matchait
// plus l'email Auth « marc@… », et toute écriture liée à l'identité était rejetée
// en silence. On normalise ici en écho du trigger `membres_cs_normalize_email` :
// la base ne fait pas confiance au client, le client n'envoie pas de crasse. On
// ne touche `email` que s'il est présent — un patch { actif } ne doit rien réécrire.
function withCanonicalEmail(obj) {
  if (!obj || typeof obj.email !== 'string') return obj
  return { ...obj, email: obj.email.trim().toLowerCase() }
}

// Bucket privé des pièces jointes (migration 012). Privé = aucune adresse
// permanente n'existe ; tout accès passe par une URL signée à durée courte.
const DOCUMENTS_BUCKET = 'documents'

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
  // Appariement membre ⇄ Auth par email. Insensible à la casse (migration 018) :
  // Auth renvoie déjà l'email en minuscules et `membres_cs.email` est normalisé à
  // l'écriture, donc un `.eq` sur la forme canonique matche exactement. Sans cette
  // normalisation, un « Marc@… » hérité en base échapperait à la résolution — le
  // membre serait connecté mais `membre_id` resterait null (identité fantôme).
  const canonicalEmail = (authUser.email || '').trim().toLowerCase()
  const { data: membre } = await supabase.from('membres_cs').select('*').eq('email', canonicalEmail).maybeSingle()
  return {
    id: authUser.id,
    email: authUser.email,
    // `role` = rôle d'AUTH (admin/membre, pilote isAdmin). `membre_role` = rôle
    // du bureau tel quel, pour isSecretaire / isTresorier.
    role: membre?.role === 'president' ? 'admin' : 'membre',
    membre_role: membre?.role ?? null,
    membre_id: membre?.id ?? null,
    nom: membre?.nom,
    prenom: membre?.prenom,
    // Drapeau "a défini son mot de passe" (posé après le 1er changement).
    password_changed: authUser.user_metadata?.password_changed === true,
    // Acceptation de la mention RGPD du registre des propriétaires (035).
    registre_rgpd_accepte_le: membre?.registre_rgpd_accepte_le ?? null,
  }
}

export const supabaseRepo = {
  // ---- Membres ----
  async listMembres() {
    return must(await supabase.from('membres_cs').select('*').order('nom'))
  },
  async createMembre(input) {
    return must(await supabase.from('membres_cs').insert(withCanonicalEmail(input)).select())[0]
  },
  async updateMembre(id, patch) {
    return must(await supabase.from('membres_cs').update(withCanonicalEmail(patch)).eq('id', id).select())[0]
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
    // Tri sur le COUPLE (migration 032) : 10 avant 10-1 avant 10-2, puis 11.
    const resolutions = must(await supabase.from('resolutions_ag').select('*').eq('ag_id', id).order('numero').order('sous_numero'))
    const comptes = must(await supabase.from('comptes_ag').select('*').eq('ag_id', id))
    return { ...ag, resolutions, comptes }
  },
  // Co-validation des comptes d'une AGO (point 4). approuve_par = current membre
  // (imposé aussi par la RLS with check). Le rôle du bureau autorisé est vérifié
  // par la RLS ; l'app ne montre les boutons qu'au bon rôle.
  async approveComptes(agId, role, membreId) {
    must(await supabase.from('comptes_ag').insert({ ag_id: agId, role, approuve_par: membreId }))
    return { ok: true }
  },
  async unapproveComptes(agId, role) {
    must(await supabase.from('comptes_ag').delete().eq('ag_id', agId).eq('role', role))
    return { ok: true }
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
    // `phase` alimente `peseSurLeBudget` : sans elle, un BROUILLON chiffré à
    // 20 000 € remonterait en « engagé en cours » sur l'enveloppe — en prod
    // seulement (le mock a toujours l'objet complet). Cf. l'avertissement de
    // `_projectData` juste en dessous : toute colonne lue par les fonctions de
    // calcul doit figurer dans ces select.
    const decisions = must(await supabase.from('decisions').select('id,numero,titre,statut,enregistree,resolution_id,projet_id,montant_engage,tva_taux,tva_incluse,phase'))
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
    const decisions = must(await supabase.from('decisions').select('id,numero,titre,statut,enregistree,projet_id,montant_engage,tva_taux,tva_incluse,projet_action,date_enregistrement,created_at,phase'))
    const membres_cs = must(await supabase.from('membres_cs').select('id,nom,prenom'))
    const assemblees_generales = must(await supabase.from('assemblees_generales').select('id,numero,date_ag'))
    const resolutions_ag = must(await supabase.from('resolutions_ag').select('id,ag_id,numero,titre,statut,budget_alloue,projet_id'))
    return { projets, decisions, membres_cs, assemblees_generales, resolutions_ag }
  },
  // Même comparateur que le mock (`compareProjets`) : les deux backends ne
  // triaient pas pareil — le mock sur `created_at`, celui-ci pas du tout. Une
  // divergence invisible en démo, corrigée en un seul point.
  async listProjets() {
    return computeProjectBudgets(await this._projectData()).sort(compareProjets)
  },
  async getProjet(id) {
    const computed = (await this.listProjets()).find((x) => x.id === id)
    if (!computed) return null
    const decisions = must(await supabase.from('decisions').select('*').eq('projet_id', id))
    // Fil d'échanges (migration 028). Secondaire : un échec de lecture ne doit
    // pas empêcher d'ouvrir la fiche du projet.
    const { data: qa } = await supabase.from('questions_reponses_projet')
      .select('*').eq('projet_id', id).order('created_at')
    // Journal de bord (migration 029) : trié sur la date de l'ACTION, pas sur
    // celle de la saisie — une visite du 12 notée le 20 se range au 12.
    const { data: journal } = await supabase.from('journal_projet')
      .select('*').eq('projet_id', id).order('date_action', { ascending: false })
    return { ...computed, decisions, qa: qa || [], journal: journal || [] }
  },

  // Fil d'échanges des projets. Pas de garde de verrouillage, contrairement aux
  // décisions : un projet ne se fige jamais.
  async addQAProjet(input) {
    return must(await supabase.from('questions_reponses_projet').insert(input).select())[0]
  },

  // ---- Journal de bord des projets (migration 029) ----
  // ⚠ Rien à voir avec `audit_log` : celui-là est automatique et immuable, le
  // journal est saisi à la main et corrigeable par son auteur.
  async addJournalProjet(input) {
    return must(await supabase.from('journal_projet').insert(input).select())[0]
  },
  // `created_at` n'est jamais touché : c'est la date de SAISIE. Seuls la date de
  // l'action et le texte se corrigent. La RLS borne à l'auteur (et au président).
  async updateJournalProjet(id, patch) {
    return must(await supabase.from('journal_projet')
      .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select())[0]
  },
  async deleteJournalProjet(id) {
    must(await supabase.from('journal_projet').delete().eq('id', id))
    return { ok: true }
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

  // ---- Décisions ----
  // Toutes les colonnes SAUF `documents`.
  //
  // Les pièces jointes sont stockées en base64 dans ce jsonb (pas encore de
  // Supabase Storage) : un `select('*')` faisait donc télécharger TOUTES les
  // pièces jointes de TOUTES les décisions à chaque ouverture du registre. Le
  // base64 gonflant de 33 %, vingt décisions avec un devis de 2 Mo = ~54 Mo par
  // chargement de page. Aucun écran de liste ne lit `documents` — seules les
  // fiches, qui passent par getDecision.
  //
  // Énumération explicite parce que PostgREST n'a pas de « tout sauf ». Une
  // colonne ajoutée à `decisions` doit être ajoutée ICI, sinon elle sera
  // silencieusement absente des listes en prod (le mock, lui, la renverra).
  async listDecisions() {
    return must(await supabase.from('decisions')
      .select('id,numero,titre,description,date_publication,date_limite_reponse,date_enregistrement,date_notification,statut,enregistree,quorum_atteint,composition_snapshot,montant_engage,tva_taux,tva_incluse,projet_id,ag_id,resolution_id,projet_action,phase,date_soumission_prevue,soumise_le,version,visibilite,delai_vote_jours,motif_annulation,hash_contenu,created_by,created_at,updated_at')
      // Publication décroissante, puis NUMÉRO décroissant — même ordre que le
      // mock. Sans le second critère, les décisions d'un même jour sortaient
      // dans un ordre non garanti, et les deux backends divergeaient.
      .order('date_publication', { ascending: false })
      .order('numero', { ascending: false, nullsFirst: true }))
  },
  async getDecision(id) {
    const d = must(await supabase.from('decisions').select('*').eq('id', id).maybeSingle())
    if (!d) return null
    const votes = must(await supabase.from('votes').select('*').eq('decision_id', id))
    const qa = must(await supabase.from('questions_reponses').select('*').eq('decision_id', id).order('created_at'))
    const status_history = must(await supabase.from('decision_status_history').select('*').eq('decision_id', id).order('changed_at'))
    // Versions successives du brouillon (migration 026). Secondaire : un échec de
    // lecture ne doit pas empêcher d'ouvrir la fiche d'une décision.
    const { data: historique } = await supabase.from('decisions_historique').select('*').eq('decision_id', id).order('version')
    const { data: batches } = await supabase.from('signature_batches').select('*').contains('decision_ids', [id])
    return { ...d, votes, qa, status_history, historique: historique || [], signature_batch: batches?.[0] || null }
  },
  async createDecision(input) {
    return must(await supabase.from('decisions').insert(input).select())[0]
  },
  async updateDecision(id, patch) {
    return must(await supabase.from('decisions').update(patch).eq('id', id).select())[0]
  },

  // ---- Cycle de vie : brouillon → planifiée → ouverte au vote (migration 026) ----
  //
  // De simples UPDATE, et c'est voulu : tout le cycle (transitions autorisées,
  // gel du texte, empreinte SHA-256, recalage des dates, historique de version)
  // est appliqué par le trigger `decisions_cycle_guard`, côté base. Un chemin
  // applicatif parallèle finirait par diverger — et c'est la valeur probante de
  // la délibération qui est en jeu. La RLS fait le reste : `decisions_owner_update`
  // pour l'auteur, `write_admin` pour le président.
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

  // Filet applicatif de l'ouverture automatique. pg_cron déclenche la même
  // fonction toutes les heures ; cet appel-ci sert à ce qu'un pg_cron non activé
  // ne fasse pas qu'une décision planifiée ne s'ouvre JAMAIS, en silence.
  // `security definer` côté base : la décision à ouvrir n'appartient pas
  // forcément au membre connecté. Idempotent.
  async ouvrirDecisionsDues() {
    const { data, error } = await supabase.rpc('ouvrir_decisions_planifiees', { p_source: 'app' })
    if (error) throw new Error(error.message)
    return { traitees: data ?? 0 }
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
  // Visibilité PRÉVUE : décision de PUBLICATION, extérieure à la délibération
  // elle-même. Elle passe donc volontairement à côté du verrou d'enregistrement
  // (comme `markDecisionNotified`) et reste modifiable sur une décision déjà
  // actée — le verrou de l'art. 15 protège le TEXTE de la délibération, pas la
  // décision de savoir qui peut la consulter. Réservée au président par la RLS
  // (`write_admin` ; `decisions_owner_update` exige `enregistree = false`, donc
  // le rédacteur passe par le formulaire tant que la décision n'est pas actée).
  //
  // La TRACE est posée en base par le trigger `trg_decisions_audit_visibilite`
  // (migration 027), pas ici : il attrape aussi le chemin du formulaire, et
  // `audit_log` n'est écrivable que par le président — un insert côté client
  // aurait perdu la trace en silence pour un rédacteur ordinaire.
  // RATTACHEMENT d'une décision ENREGISTRÉE à un projet (migration 033).
  //
  // Passe volontairement à côté du verrou d'enregistrement, comme
  // `markDecisionNotified` et `changerVisibilite` : l'acte fige la
  // DÉLIBÉRATION (texte, votes, composition, montant), pas le classement. Un
  // projet ouvert après le vote doit pouvoir récupérer ses décisions.
  //
  // ⚠ Ne touche QUE `projet_id`. `resolution_id` et `ag_id` sont laissés tels
  // quels — contrairement au formulaire de création qui les efface : sur une
  // délibération figée on ne détruit rien, et la résolution sous laquelle la
  // décision a été votée fait partie de son histoire. Sans effet sur les
  // budgets : `computeAGBudgets` ne compte en engagement direct que les
  // décisions SANS projet, donc pas de double compte.
  //
  // La trace est posée en base par `trg_decisions_audit_rattachement`.
  async rattacherDecisionProjet(id, projetId) {
    return must(await supabase.from('decisions')
      .update({ projet_id: projetId || null }).eq('id', id).select())[0]
  },
  async changerVisibilite(id, visibilite) {
    return must(await supabase.from('decisions').update({ visibilite }).eq('id', id).select())[0]
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

  // ---- Documents (pièces jointes) ----
  //
  // Le fichier va dans le bucket privé ; la ligne ne garde que {path,name,type,
  // size}. Le chemin PORTE l'id de l'entité — c'est lui que relisent les policies
  // de la migration 012 pour refuser de toucher au fichier d'une décision
  // enregistrée. Ne pas changer la convention sans les relire.
  //
  // L'entité n'existe pas forcément encore : à la création, le formulaire tire
  // l'id côté client et téléverse avant l'insert. D'où `entityId` en paramètre
  // plutôt qu'une relecture en base.
  //
  // XHR plutôt que `supabase.storage.upload()`, pour UNE raison : `fetch` — que
  // storage-js utilise — n'expose pas la progression de l'envoi. Or l'upload est
  // lent : mesuré à ~30 s pour 2 Mo sur la 5G de Pascal (≈0,5 Mbit/s soutenu, là
  // où fast.com annonce 1,8 en pointe), soit plusieurs MINUTES pour un devis de
  // 10 Mo. Sans pourcentage, on croit que c'est planté et on recharge la page.
  //
  // La requête reproduit exactement celle de storage-js : même endpoint, même
  // FormData, même en-têtes, JWT de la session en cours. La RLS s'applique donc
  // à l'identique — c'est bien le membre connecté qui écrit, pas la clé anon.
  async uploadDocument(scope, entityId, file, onProgress) {
    const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'bin'
    const path = `${scope}/${entityId}/${crypto.randomUUID()}.${ext}`
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée — reconnectez-vous avant d’envoyer un fichier.')

    await new Promise((resolve, reject) => {
      const form = new FormData()
      form.append('cacheControl', '3600')
      form.append('', file)
      const xhr = new XMLHttpRequest()
      xhr.open('POST', `${SUPABASE_URL}/storage/v1/object/${DOCUMENTS_BUCKET}/${path}`)
      xhr.setRequestHeader('authorization', `Bearer ${session.access_token}`)
      xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY)
      xhr.setRequestHeader('x-upsert', 'false')
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total)
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) return resolve()
        // Le Storage répond en JSON ({message}) sur un refus RLS ou un dépassement
        // de file_size_limit. Un proxy en travers peut répondre autre chose.
        let msg = `Envoi refusé (HTTP ${xhr.status})`
        try { msg = JSON.parse(xhr.responseText)?.message || msg } catch { /* réponse non JSON */ }
        reject(new Error(msg))
      }
      xhr.onerror = () => reject(new Error('Connexion interrompue pendant l’envoi.'))
      xhr.send(form)
    })
    return {
      id: crypto.randomUUID(),
      path,
      name: file.name,
      type: file.type,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    }
  },
  // URL signée fabriquée AU CLIC, valable 5 minutes. On ne stocke jamais d'URL :
  // le bucket est privé, donc aucune adresse permanente n'existe, et un registre
  // légal se relit dix ans plus tard.
  //
  // `download` fait répondre le Storage en Content-Disposition: attachment — le
  // fichier se télécharge sous son vrai nom au lieu de s'ouvrir dans l'onglet.
  //
  // Pas de repli sur `doc.dataUrl` : les dernières pièces jointes en base64
  // (données de test) ont été effacées le 2026-07-17, la base n'en contient plus
  // aucune. Le repli était devenu du code mort suggérant une cohabitation qui
  // n'existe plus. Le mock, lui, sert toujours du base64 — mais par sa propre
  // implémentation, pas par celle-ci.
  async getDocumentUrl(doc) {
    const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET)
      .createSignedUrl(doc.path, 300, { download: doc.name })
    if (error) throw new Error(error.message)
    return data.signedUrl
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
  // Tous les votes, pour grouper les décisions par ensemble de votants (écran de
  // signature). Seuls decision_id et membre_id servent — le sens du vote ne
  // compte pas : un Contre est présent, donc signataire (art. 15).
  async listVotes() {
    // `vote` sert au détail pour/contre/abstention de la liste du registre ; le
    // groupement de la page Signatures n'utilise, lui, que decision_id/membre_id.
    return must(await supabase.from('votes').select('decision_id,membre_id,vote'))
  },
  async deleteVote(decision_id, membre_id) {
    must(await supabase.from('votes').delete().eq('decision_id', decision_id).eq('membre_id', membre_id))
    return { ok: true }
  },

  // ---- Q&A ----
  // Toutes les Q/R, pour compter les questions sans réponse sur la liste du
  // registre. Minimal : seuls id/decision_id/type/parent_id servent au comptage.
  async listQA() {
    return must(await supabase.from('questions_reponses').select('id,decision_id,type,parent_id,auteur_id'))
  },
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


  // ---- Registre des propriétaires (migration 035) ----
  //
  // ⚠ DONNÉES PERSONNELLES. Aucune garde applicative ici : ce sont les policies
  // `lots_bureau` / `proprietaires_bureau` qui ferment l'accès au président et
  // au secrétaire, en lecture comme en écriture. Ces tables ne figurent PAS dans
  // la boucle `read_auth` — un membre ordinaire ne voit rien, pas même le
  // nombre de lots. Une garde côté client ne serait qu'un décor.
  async listLots() {
    const lots = must(await supabase.from('lots').select('*').order('numero'))
    const periodes = must(await supabase.from('proprietaires').select('*'))
    // TANTIÈME dérivé, jamais stocké — même calcul que le mock. Dénominateur =
    // total des superficies RENSEIGNÉES : tant que le registre est incomplet,
    // les parts sont provisoires, et l'écran le dit.
    const total = lots.reduce((s, l) => s + (Number(l.superficie) || 0), 0)
    return lots.map((l) => {
      const p = periodes.filter((x) => x.lot_id === l.id)
      return {
        ...l,
        proprietaire: p.find((x) => !x.date_cession) || null,
        anciens: p.filter((x) => x.date_cession).length,
        superficie_totale: total,
        part: total > 0 && l.superficie ? (Number(l.superficie) / total) * 100 : null,
      }
    })
  },
  async getLot(id) {
    const l = must(await supabase.from('lots').select('*').eq('id', id).maybeSingle())
    if (!l) return null
    const periodes = must(await supabase.from('proprietaires').select('*').eq('lot_id', id))
    return {
      ...l,
      proprietaire: periodes.find((x) => !x.date_cession) || null,
      historique: periodes.filter((x) => x.date_cession).sort((a, b) => (a.date_cession < b.date_cession ? 1 : -1)),
    }
  },
  async createLot(input) {
    return must(await supabase.from('lots').insert(input).select())[0]
  },
  async updateLot(id, patch) {
    return must(await supabase.from('lots').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).select())[0]
  },
  async deleteLot(id) {
    // L'historique part avec le lot : `on delete cascade` côté base.
    must(await supabase.from('lots').delete().eq('id', id))
    return { ok: true }
  },
  async saveProprietaire(lotId, patch) {
    const actuels = must(await supabase.from('proprietaires').select('id').eq('lot_id', lotId).is('date_cession', null))
    if (actuels.length) {
      return must(await supabase.from('proprietaires')
        .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', actuels[0].id).select())[0]
    }
    return must(await supabase.from('proprietaires').insert({ ...patch, lot_id: lotId }).select())[0]
  },
  // ⚠ NON ATOMIQUE : clôture de la période en cours, puis insertion de la
  // nouvelle. L'ordre est imposé par l'index partiel « un seul propriétaire
  // actuel par lot » — insérer d'abord serait refusé. Si le second appel échoue,
  // le lot se retrouve SANS propriétaire actuel : c'est visible à l'écran (la
  // fiche l'affiche comme vacant), donc rattrapable, là où l'inverse laisserait
  // deux propriétaires en cours sans que personne ne le voie.
  async enregistrerMutation(lotId, { date_mutation, ...nouveau }) {
    const actuels = must(await supabase.from('proprietaires').select('id').eq('lot_id', lotId).is('date_cession', null))
    if (actuels.length) {
      must(await supabase.from('proprietaires')
        .update({ date_cession: date_mutation, updated_at: new Date().toISOString() })
        .eq('id', actuels[0].id).select())
    }
    return must(await supabase.from('proprietaires')
      .insert({ ...nouveau, lot_id: lotId, date_acquisition: date_mutation }).select())[0]
  },
  // Acceptation de la mention RGPD. Tracée en base par `trg_membres_audit_rgpd`.
  async accepterRgpdRegistre(membreId) {
    return must(await supabase.from('membres_cs')
      .update({ registre_rgpd_accepte_le: new Date().toISOString() })
      .eq('id', membreId).select())[0]
  },

  // ---- Audit ----
  async listAudit(limit = 100) {
    return must(await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(limit))
  },
}
