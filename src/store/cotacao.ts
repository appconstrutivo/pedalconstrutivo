import type { ItemCotacaoForm } from '../types'
import { replaceCotacaoFornecedoresVisiveis as sbReplaceCotacaoFornecedoresVisiveis, replaceCotacaoItens as sbReplaceCotacaoItens } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo-cotacao-itens'
const STORAGE_FORNECEDORES_VISIVEIS = 'pedal-construtivo-cotacao-fornecedores-visiveis'

/**
 * Carrega os itens da cotação salvos no dispositivo (localStorage).
 * Uso offline atual; futuramente pode ser substituído por leitura do Supabase.
 */
export function loadItensCotacao(): ItemCotacaoForm[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ItemCotacaoForm[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((raw) => {
      const item = raw as ItemCotacaoForm
      const q =
        typeof item.quantidade === 'number' &&
        Number.isFinite(item.quantidade) &&
        item.quantidade > 0
          ? item.quantidade
          : 1
      return { ...item, quantidade: q }
    })
  } catch {
    return []
  }
}

/**
 * Salva os itens da cotação no dispositivo (localStorage).
 * Uso offline atual; futuramente pode ser substituído por sync com Supabase.
 */
export function saveItensCotacao(itens: ItemCotacaoForm[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'cotacao' } }))

  void sbReplaceCotacaoItens(
    itens.map((i) => ({
      id: i.id,
      descricao: i.descricao,
      quantidade: i.quantidade,
      precos: i.precos,
    })),
  )
}

/** IDs dos fornecedores cujas colunas aparecem na tabela da cotação. */
export function loadFornecedoresVisiveisCotacao(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_FORNECEDORES_VISIVEIS)
    if (!raw) return []
    const parsed = JSON.parse(raw) as string[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveFornecedoresVisiveisCotacao(ids: string[]): void {
  localStorage.setItem(STORAGE_FORNECEDORES_VISIVEIS, JSON.stringify(ids))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'cotacao-fornecedores-visiveis' } }))
  void sbReplaceCotacaoFornecedoresVisiveis(ids)
}
