import type { ItemCotacaoForm } from '../types'
import { replaceCotacaoFornecedoresVisiveis as sbReplaceCotacaoFornecedoresVisiveis, replaceCotacaoItens as sbReplaceCotacaoItens } from '../supabase/pcApi'

let itensCotacaoCache: ItemCotacaoForm[] = []
let fornecedoresVisiveisCotacaoCache: string[] = []

export function replaceCotacaoCache(itens: ItemCotacaoForm[], fornecedoresVisiveis: string[]): void {
  itensCotacaoCache = itens
  fornecedoresVisiveisCotacaoCache = fornecedoresVisiveis
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'cotacao' } }))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'cotacao-fornecedores-visiveis' } }))
}

export function loadItensCotacao(): ItemCotacaoForm[] {
  return itensCotacaoCache.map((item) => {
    const q =
      typeof item.quantidade === 'number' && Number.isFinite(item.quantidade) && item.quantidade > 0
        ? item.quantidade
        : 1
    return { ...item, quantidade: q }
  })
}

export function saveItensCotacao(itens: ItemCotacaoForm[]): void {
  itensCotacaoCache = itens
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
  return [...fornecedoresVisiveisCotacaoCache]
}

export function saveFornecedoresVisiveisCotacao(ids: string[]): void {
  fornecedoresVisiveisCotacaoCache = [...ids]
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'cotacao-fornecedores-visiveis' } }))
  void sbReplaceCotacaoFornecedoresVisiveis(ids)
}
