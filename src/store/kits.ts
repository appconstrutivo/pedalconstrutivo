import type { Kit } from '../types'
import { deleteKit as sbDeleteKit, upsertKits as sbUpsertKits } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo-kits'

function normalizarKit(row: unknown): Kit | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Partial<Kit>
  if (typeof r.id !== 'string') return null
  if (typeof r.produtoKitId !== 'string') return null
  if (typeof r.nome !== 'string') return null
  if (!Array.isArray(r.itens)) return null
  const criadoEm = typeof r.criadoEm === 'string' ? r.criadoEm : new Date().toISOString()
  const estoqueComprometido = r.estoqueComprometido === true
  const itens = r.itens
    .filter((i): i is { produtoId: string; quantidade: number } => {
      if (!i || typeof i !== 'object') return false
      const o = i as { produtoId?: unknown; quantidade?: unknown }
      return typeof o.produtoId === 'string' && typeof o.quantidade === 'number' && o.quantidade > 0
    })
    .map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade }))

  return {
    id: r.id,
    produtoKitId: r.produtoKitId,
    nome: r.nome,
    itens,
    estoqueComprometido,
    criadoEm,
  }
}

export function loadKits(): Kit[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizarKit).filter((k): k is Kit => k !== null)
  } catch {
    return []
  }
}

export function saveKits(lista: Kit[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'kits' } }))
}

export function addKit(draft: Omit<Kit, 'id' | 'criadoEm'>): Kit {
  const k: Kit = { ...draft, id: crypto.randomUUID(), criadoEm: new Date().toISOString() }
  saveKits([...loadKits(), k])
  void sbUpsertKits([k])
  return k
}

export function findKitByProdutoKitId(produtoKitId: string): Kit | null {
  return loadKits().find((k) => k.produtoKitId === produtoKitId) ?? null
}

export function upsertKitByProdutoKitId(
  produtoKitId: string,
  draft: Omit<Kit, 'id' | 'produtoKitId' | 'criadoEm'>,
): Kit {
  const lista = loadKits()
  const idx = lista.findIndex((k) => k.produtoKitId === produtoKitId)
  if (idx >= 0) {
    const ant = lista[idx]
    const next = [...lista]
    next[idx] = {
      ...ant,
      ...draft,
      produtoKitId: ant.produtoKitId,
      id: ant.id,
      criadoEm: ant.criadoEm,
    }
    saveKits(next)
    void sbUpsertKits([next[idx]])
    return next[idx]
  }
  const novo: Kit = {
    id: crypto.randomUUID(),
    produtoKitId,
    nome: draft.nome,
    itens: draft.itens,
    estoqueComprometido: draft.estoqueComprometido === true,
    criadoEm: new Date().toISOString(),
  }
  saveKits([...lista, novo])
  void sbUpsertKits([novo])
  return novo
}

export function removeKit(id: string): void {
  saveKits(loadKits().filter((k) => k.id !== id))
  void sbDeleteKit(id)
}

