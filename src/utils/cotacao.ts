import type { Fornecedor } from '../types'
import type { ItemCotacaoForm, ItemPedidoMontado, PedidoMontado } from '../types'

/** Normaliza descrição para comparar itens entre planilhas (importação / mesclagem). */
export function normalizarDescricaoParaMatch(descricao: string): string {
  return descricao.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** Converte string digitada (ex: "8,49" ou "9.51") em número. */
function parsePreco(str: string): number {
  const normalized = str.trim().replace(',', '.')
  const num = Number(normalized)
  return Number.isFinite(num) ? num : 0
}

/**
 * Considera apenas os fornecedores passados em `fornecedores` ao escolher o menor preço
 * (útil quando a tabela exibe só um subconjunto de fornecedores).
 */
export function montarPedido(itens: ItemCotacaoForm[], fornecedores: Fornecedor[]): PedidoMontado {
  const mapaFornecedores = new Map(fornecedores.map((f) => [f.id, f]))
  const itensMontados: ItemPedidoMontado[] = []
  let total = 0

  for (const item of itens) {
    const precoValido = item.precos.filter((p) => {
      const valor = parsePreco(p.preco)
      return valor > 0 && mapaFornecedores.has(p.fornecedorId)
    })
    if (precoValido.length === 0) continue
    const menor = precoValido.reduce((a, b) =>
      parsePreco(a.preco) <= parsePreco(b.preco) ? a : b
    )
    const valorUnitario = parsePreco(menor.preco)
    const fornecedor = mapaFornecedores.get(menor.fornecedorId)
    if (!fornecedor) continue
    const qtd =
      typeof item.quantidade === 'number' && Number.isFinite(item.quantidade) && item.quantidade > 0
        ? item.quantidade
        : 1
    const subtotal = valorUnitario * qtd
    itensMontados.push({
      descricao: item.descricao,
      fornecedorId: fornecedor.id,
      fornecedorNome: fornecedor.nome,
      precoUnitario: valorUnitario,
      quantidade: qtd,
      preco: subtotal,
    })
    total += subtotal
  }

  return { itens: itensMontados, total }
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}
