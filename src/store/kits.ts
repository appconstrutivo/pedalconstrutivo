import type { Kit } from '../types'
import { deleteKit as sbDeleteKit, upsertKits as sbUpsertKits } from '../supabase/pcApi'

let kitsCache: Kit[] = []

export function loadKits(): Kit[] {
  return kitsCache
}

export function saveKits(lista: Kit[]): void {
  kitsCache = lista
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

