// Unified data-access facade. Selects the mock or Supabase backend at load
// time based on config. All pages import from here and never touch a backend
// directly, so switching to real Supabase is transparent.
import { BACKEND } from './config'
import { mockRepo, mockAuth } from './mockDb'
import { supabaseRepo, supabaseAuth } from './supabaseDb'

export const repo = BACKEND === 'supabase' ? supabaseRepo : mockRepo
export const authApi = BACKEND === 'supabase' ? supabaseAuth : mockAuth
export { BACKEND }
