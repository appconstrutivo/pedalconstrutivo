import type { RegistroMovimentacao } from '../types'
import {
  extrairMovimentacoesProfundo,
  lerMovimentacoesDaChaveStorage,
  lerSnapshotMovimentacoesDoNavegador,
} from '../utils/localMovimentacaoBackup'
import { hydrateHistoricoFromSupabase } from './hydrate'
import { upsertMovimentacao } from './pcApi'

/**
 * Envia movimentações ao Supabase apenas com `upsert` (não apaga cabeçalhos nem outras linhas da base).
 * Recarrega o histórico em memória a partir do Supabase ao final.
 */
export async function enviarMovimentacoesParaSupabaseSemExcluir(
  registros: RegistroMovimentacao[],
): Promise<{ enviados: number; erros: string[] }> {
  const erros: string[] = []
  let enviados = 0
  for (const reg of registros) {
    try {
      await upsertMovimentacao(reg)
      enviados += 1
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      erros.push(`${reg.numeroDocumento || reg.id}: ${msg}`)
    }
  }
  try {
    await hydrateHistoricoFromSupabase()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    erros.push(`Falha ao recarregar histórico após envio: ${msg}`)
  }
  return { enviados, erros }
}

/** Usa o snapshot automático em `localStorage` (chave `pc_snapshot_movimentacoes_v1`). */
export async function forceSyncLocalToSupabase(): Promise<{ enviados: number; erros: string[] }> {
  const regs = lerSnapshotMovimentacoesDoNavegador()
  if (regs.length === 0) {
    return {
      enviados: 0,
      erros: [
        'Nenhum dado no snapshot local. Se esta máquina nunca rodou a versão atual do sistema após uma venda, o backup automático pode estar vazio — use a varredura de chaves ou um JSON exportado.',
      ],
    }
  }
  return enviarMovimentacoesParaSupabaseSemExcluir(regs)
}

export async function enviarJsonMovimentacoesParaSupabase(jsonBruto: string): Promise<{ enviados: number; erros: string[] }> {
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBruto) as unknown
  } catch {
    return { enviados: 0, erros: ['JSON inválido.'] }
  }
  const regs = extrairMovimentacoesProfundo(parsed)
  if (regs.length === 0) {
    return { enviados: 0, erros: ['Nenhuma venda/orçamento reconhecível no texto.'] }
  }
  return enviarMovimentacoesParaSupabaseSemExcluir(regs)
}

export async function enviarChaveStorageParaSupabase(
  origem: 'localStorage' | 'sessionStorage',
  chave: string,
): Promise<{ enviados: number; erros: string[] }> {
  const regs = lerMovimentacoesDaChaveStorage(origem, chave)
  if (regs.length === 0) {
    return { enviados: 0, erros: ['Nenhum registro extraído desta chave.'] }
  }
  return enviarMovimentacoesParaSupabaseSemExcluir(regs)
}

/** Reservado — sem semente automática a partir de outro formato. */
export async function ensureSupabaseSeededFromLocal(): Promise<void> {}
