import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getEnv(key: string): string | null {
  // Vite expõe envs em import.meta.env
  const v = (import.meta as unknown as { env?: Record<string, unknown> }).env?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export const SUPABASE_URL = getEnv('VITE_SUPABASE_URL')
export const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY')

export const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

