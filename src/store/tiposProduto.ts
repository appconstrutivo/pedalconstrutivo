import type { TipoProduto } from '../types'
import { deleteTipoProduto as sbDeleteTipoProduto, upsertTiposProduto as sbUpsertTiposProduto } from '../supabase/pcApi'

let tiposProdutoCache: TipoProduto[] = []

export function loadTiposProduto(): TipoProduto[] {
  return tiposProdutoCache
}

export function saveTiposProduto(tipos: TipoProduto[]): void {
  tiposProdutoCache = tipos
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'tipos-produto' } }))
}

function novoId(): string {
  return crypto.randomUUID()
}

export function addTipoProduto(nome: string): TipoProduto | null {
  const n = nome.trim()
  if (!n) return null
  const lista = loadTiposProduto()
  if (lista.some((t) => t.nome.toLowerCase() === n.toLowerCase())) return null
  const t: TipoProduto = { id: novoId(), nome: n }
  saveTiposProduto([...lista, t])
  void sbUpsertTiposProduto([t])
  return t
}

export function updateTipoProduto(id: string, nome: string): TipoProduto | null {
  const n = nome.trim()
  if (!n) return null
  const lista = loadTiposProduto()
  const idx = lista.findIndex((x) => x.id === id)
  if (idx < 0) return null
  if (lista.some((t, i) => i !== idx && t.nome.toLowerCase() === n.toLowerCase())) return null
  const next = [...lista]
  next[idx] = { ...next[idx], nome: n }
  saveTiposProduto(next)
  void sbUpsertTiposProduto([next[idx]])
  return next[idx]
}

export function removeTipoProduto(id: string): void {
  saveTiposProduto(loadTiposProduto().filter((t) => t.id !== id))
  void sbDeleteTipoProduto(id)
}

export function getTipoProduto(id: string): TipoProduto | undefined {
  return loadTiposProduto().find((t) => t.id === id)
}
