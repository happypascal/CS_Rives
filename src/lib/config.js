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

export const ORG = {
  name: 'Association Syndicale Libre',
  lotissement: 'Lotissement de Rives',
  commune: 'Nernier (74140)',
  fullName: 'ASL — Lotissement de Rives, Nernier (74140)',
}
