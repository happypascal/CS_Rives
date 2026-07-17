// Central configuration. The app runs in two modes:
//  - "supabase" when VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY are provided
//  - "mock"     otherwise (localStorage-backed demo backend with seed data)
//
// This lets the app be developed, demoed and verified end-to-end without any
// cloud provisioning, while staying production-ready the moment env vars land.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || ''
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || ''

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

export const BACKEND = isSupabaseConfigured ? 'supabase' : 'mock'

// Signature provider: 'mock' (default) or 'yousign'. Real Yousign wiring is the
// last step per the frozen project decisions; the abstract layer lives in
// src/lib/signatureProvider.js so swapping is a one-line change.
export const SIGNATURE_PROVIDER =
  import.meta.env.VITE_SIGNATURE_PROVIDER?.trim() || 'mock'

// MODE TEST — le président peut poser le vote des AUTRES membres.
//
// ⚠ Viole délibérément deux règles du produit : le vote self-only, et l'art. 15
// (« signé par tous les membres présents à la délibération » — présent = a voté).
// Une décision votée ainsi puis ENREGISTRÉE ferait entrer au registre légal une
// présence qui n'a pas eu lieu. Ce n'est acceptable que sur des données de test,
// à effacer, tant que les comptes des autres membres n'existent pas.
//
// FERMÉ par défaut (refermé le 2026-07-16, la recette du vote étant faite). Le
// défaut a été ouvert le temps de tester quorum / adoption / enregistrement sans
// comptes membres ; il ne doit plus l'être — l'app serait non conforme à son
// propre modèle (self-only, art. 15).
//
// Pour rouvrir ponctuellement une recette : `VITE_TEST_VOTES=true` dans Vercel,
// et le refermer juste après. Ne jamais ENREGISTRER une décision votée ainsi :
// le registre attesterait une présence qui n'a pas eu lieu, et c'est définitif.
export const TEST_VOTES = import.meta.env.VITE_TEST_VOTES?.trim() === 'true'

// Plafond par fichier — deux valeurs, deux raisons SANS RAPPORT entre elles.
//
// En prod : 25 Mo, aligné sur `file_size_limit` du bucket (migration 012). Les
// deux doivent bouger ensemble, sinon l'un rejette ce que l'autre accepte.
//
// En démo : 2 Mo, et ce n'est pas un choix — le mock garde les pièces jointes en
// base64 dans localStorage, dont le quota navigateur est de 5 à 10 Mo pour TOUTE
// la base. Le mode démo ne verra donc jamais le Storage : c'est une limite du
// bac à sable, pas du produit.
export const MAX_DOC_BYTES = BACKEND === 'supabase' ? 25 * 1024 * 1024 : 2 * 1024 * 1024

export const ORG = {
  name: 'Association Syndicale Libre',
  lotissement: 'Lotissement de Rives',
  commune: 'Nernier (74140)',
  fullName: 'ASL — Lotissement de Rives, Nernier (74140)',
}
