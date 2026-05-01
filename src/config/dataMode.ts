/**
 * Origem dos dados da aplicação.
 * Hoje: apenas armazenamento local (localStorage / futuro IndexedDB).
 * Próximo passo: trocar para `supabase` quando a camada de API estiver pronta.
 */
export type DataMode = 'local' | 'supabase'

export const DATA_MODE: DataMode = 'supabase'
