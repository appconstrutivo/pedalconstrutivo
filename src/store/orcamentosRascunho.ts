import type { ItemLancamentoVenda } from '../types'
import { deleteOrcamentoRascunho as sbDeleteOrcamentoRascunho, upsertOrcamentoRascunho as sbUpsertOrcamentoRascunho } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo.orcamentos-rascunho'

export type OrcamentoRascunho = {
  id: string
  criadoEmIso: string
  atualizadoEmIso: string
  clienteId: string | null
  clienteNome: string | null
  observacoes: string
  itens: ItemLancamentoVenda[]
}

function normalizarItem(row: unknown): ItemLancamentoVenda | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.produtoId !== 'string' || typeof r.descricao !== 'string') return null
  return {
    id: typeof r.id === 'string' ? r.id : crypto.randomUUID(),
    produtoId: r.produtoId,
    descricao: r.descricao,
    codigoBarras: typeof r.codigoBarras === 'string' ? r.codigoBarras : '',
    quantidade: typeof r.quantidade === 'number' ? r.quantidade : 0,
    precoUnitario: typeof r.precoUnitario === 'number' ? r.precoUnitario : 0,
    subtotal: typeof r.subtotal === 'number' ? r.subtotal : 0,
  }
}

function normalizarRascunho(row: unknown): OrcamentoRascunho | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  const itensRaw = r.itens
  const itens = Array.isArray(itensRaw)
    ? itensRaw.map(normalizarItem).filter((x): x is ItemLancamentoVenda => x !== null)
    : []
  const agora = new Date().toISOString()
  return {
    id: r.id,
    criadoEmIso: typeof r.criadoEmIso === 'string' ? r.criadoEmIso : agora,
    atualizadoEmIso: typeof r.atualizadoEmIso === 'string' ? r.atualizadoEmIso : agora,
    clienteId: typeof r.clienteId === 'string' ? r.clienteId : null,
    clienteNome: typeof r.clienteNome === 'string' ? r.clienteNome : null,
    observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
    itens,
  }
}

export function loadOrcamentosRascunho(): OrcamentoRascunho[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizarRascunho).filter((x): x is OrcamentoRascunho => x !== null)
  } catch {
    return []
  }
}

function saveTodos(lista: OrcamentoRascunho[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
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
