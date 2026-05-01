import type { ItemLancamentoVenda } from '../types'
import { deleteOrcamentoRascunho as sbDeleteOrcamentoRascunho, upsertOrcamentoRascunho as sbUpsertOrcamentoRascunho } from '../supabase/pcApi'
export type OrcamentoRascunho = {
  id: string
  criadoEmIso: string
  atualizadoEmIso: string
  clienteId: string | null
  clienteNome: string | null
  observacoes: string
  itens: ItemLancamentoVenda[]
}

let orcamentosRascunhoCache: OrcamentoRascunho[] = []

export function replaceOrcamentosRascunhoCache(lista: OrcamentoRascunho[]): void {
  orcamentosRascunhoCache = lista
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'orcamentos-rascunho' } }))
}

export function loadOrcamentosRascunho(): OrcamentoRascunho[] {
  return orcamentosRascunhoCache
}

function saveTodos(lista: OrcamentoRascunho[]): void {
  orcamentosRascunhoCache = lista
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'orcamentos-rascunho' } }))
}

export function upsertOrcamentoRascunho(draft: {
  id?: string
  clienteId: string | null
  clienteNome: string | null
  observacoes: string
  itens: ItemLancamentoVenda[]
}): OrcamentoRascunho {
  const lista = loadOrcamentosRascunho()
  const agora = new Date().toISOString()
  const id = draft.id && lista.some((x) => x.id === draft.id) ? draft.id : crypto.randomUUID()
  const antigo = lista.find((x) => x.id === id)
  const reg: OrcamentoRascunho = {
    id,
    criadoEmIso: antigo?.criadoEmIso ?? agora,
    atualizadoEmIso: agora,
    clienteId: draft.clienteId,
    clienteNome: draft.clienteNome,
    observacoes: draft.observacoes,
    itens: draft.itens.map((i) => ({ ...i })),
  }
  const next = [...lista.filter((x) => x.id !== id), reg]
  saveTodos(next)
  void sbUpsertOrcamentoRascunho(reg)
  return reg
}

export function removeOrcamentoRascunho(id: string): void {
  saveTodos(loadOrcamentosRascunho().filter((x) => x.id !== id))
  void sbDeleteOrcamentoRascunho(id)
}
