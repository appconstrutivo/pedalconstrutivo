/**
 * Migração local → Supabase foi descontinuada: o app usa apenas o Supabase como persistência.
 * Mantemos exports vazios para não quebrar imports antigos.
 */
export async function forceSyncLocalToSupabase(): Promise<void> {}

export async function ensureSupabaseSeededFromLocal(): Promise<void> {}
