import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getEnv(key: string): string | null {
  const v = (import.meta as unknown as { env?: Record<string, unknown> }).env?.[key]
  if (typeof v !== 'string') return null
  // Remove espaços e aspas acidentais (comum ao colar na Vercel).
  const t = v.trim().replace(/^['"`]+|['"`]+$/g, '').trim()
  return t || null
}

/**
 * Aceita `https://xxx.supabase.co` ou só `xxx.supabase.co`.
 * Se a URL for inválida, retorna null (evita tela branca: createClient lança).
 */
function normalizeSupabaseUrl(raw: string): string | null {
  const t = raw.trim()
  if (!t) return null
  let candidate = t
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate.replace(/^\/+/, '')}`
  }
  try {
    const u = new URL(candidate)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

const urlRaw = getEnv('VITE_SUPABASE_URL')
const keyRaw = getEnv('VITE_SUPABASE_ANON_KEY')

export const SUPABASE_URL = urlRaw ? normalizeSupabaseUrl(urlRaw) : null
export const SUPABASE_ANON_KEY = keyRaw

function tryCreateClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null
  try {
    return createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  } catch (e) {
    console.error('[Pedal Construtivo] Falha ao inicializar Supabase (URL/key inválidos?):', e)
    return null
  }
}

export const supabase: SupabaseClient | null = tryCreateClient()

