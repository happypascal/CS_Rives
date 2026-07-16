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
// ⚠⚠ DÉFAUT VOLONTAIREMENT **OUVERT** — décision de Pascal du 2026-07-16, le
// temps de la recette : les comptes des autres membres n'existent pas encore, donc
// le quorum (> 50 % des membres actifs) est hors d'atteinte et RIEN n'est testable
// (ni adoption, ni enregistrement, ni verrou de suppression).
//
// À REFERMER DÈS LES COMPTES MEMBRES CRÉÉS. Deux façons :
//   - immédiate, sans toucher au code : poser `VITE_TEST_VOTES=false` dans Vercel ;
//   - définitive : remettre la comparaison à `=== 'true'` ci-dessous.
// Tant que ce défaut est ouvert, l'app N'EST PAS conforme à son propre modèle.
export const TEST_VOTES = import.meta.env.VITE_TEST_VOTES?.trim() !== 'false'

export const ORG = {
  name: 'Association Syndicale Libre',
  lotissement: 'Lotissement de Rives',
  commune: 'Nernier (74140)',
  fullName: 'ASL — Lotissement de Rives, Nernier (74140)',
}
