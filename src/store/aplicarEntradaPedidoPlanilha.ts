import type {
  ConflitoCustoEntradaPlanilha,
  DecisaoCustoMenorComEstoque,
  ItemEntradaPedidoPlanilha,
  Produto,
} from '../types'
import type { LinhaPlanilhaPedido } from '../utils/importPedidoExcel'
import { round2 } from '../utils/moeda'
import { appendRegistroEntradaPedido } from './entradaPedidoPlanilha'
import { criarProdutoVazio, gerarProximoCodigoInterno, loadProdutos, saveProdutos } from './produtos'

function normSku(s: string): string {
  return s.trim().toLowerCase()
}

/** Varejo e atacado = custo × (1 + %/100). */
function precosVendaPorLucroSobreCusto(custo: number, pctLucroSobreCusto: number): {
  valorVarejo: number
  valorAtacado: number
} {
  const pct = Number.isFinite(pctLucroSobreCusto) && pctLucroSobreCusto >= 0 ? pctLucroSobreCusto : 0
  const v = round2(custo * (1 + pct / 100))
  return { valorVarejo: v, valorAtacado: v }
}

export type MetaEntradaPedidoPlanilha = {
  fornecedorId: string
  fornecedorNome: string
  pctLucroSobreCusto: number
}

/**
 * Define o custo gravado ao atualizar um item existente.
 * Custo maior ou igual na planilha: sempre atualiza.
 * Custo menor com estoque zerado: atualiza.
 * Custo menor com estoque > 0: depende da decisão do usuário (mapa por índice da linha).
 */
function resolverValorCustoNaAtualizacao(
  ant: Produto,
  custoPlanilha: number,
  linhaIndex: number,
  decisoesPorLinha: Map<number, DecisaoCustoMenorComEstoque>,
): { valorCusto: number; custoCadastroMantido: boolean } {
  const novo = round2(custoPlanilha)
  const atual = round2(ant.valorCusto)
  const estAntes = ant.estoqueAtual

  if (novo >= atual) {
    return { valorCusto: novo, custoCadastroMantido: false }
  }
  if (estAntes <= 0) {
    return { valorCusto: novo, custoCadastroMantido: false }
  }
  const d = decisoesPorLinha.get(linhaIndex) ?? 'manter_custo_anterior'
  if (d === 'usar_novo_custo') {
    return { valorCusto: novo, custoCadastroMantido: false }
  }
  return { valorCusto: atual, custoCadastroMantido: true }
}

/** Simula a importação na ordem do arquivo e lista conflitos (custo menor com estoque ainda existente). */
export function analisarEntradaPedidoPlanilha(linhas: LinhaPlanilhaPedido[]): ConflitoCustoEntradaPlanilha[] {
  let lista = loadProdutos().map((p) => ({ ...p }))
  const conflitos: ConflitoCustoEntradaPlanilha[] = []
  const novosPorSku = new Map<string, number>()

  for (let linhaIndex = 0; linhaIndex < linhas.length; linhaIndex++) {
    const linha = linhas[linhaIndex]
    const skuKey = normSku(linha.skuFornecedor)
    const idx = lista.findIndex((p) => normSku(p.codigoFornecedor) === skuKey)

    if (idx >= 0) {
      const ant = lista[idx]
      const novo = round2(linha.custoUnitario)
      const atual = round2(ant.valorCusto)
      const estAntes = ant.estoqueAtual

      if (novo < atual && estAntes > 0) {
        conflitos.push({
          linhaIndex,
          produtoId: ant.id,
          skuFornecedor: linha.skuFornecedor,
          descricaoProduto: ant.descricao,
          estoqueAntes: estAntes,
          custoAtual: atual,
          custoNovo: novo,
          quantidadeEntrada: round2(linha.quantidade),
        })
      }

      const custoSim =
        novo >= atual ? novo : estAntes <= 0 ? novo : atual
      const estNovo = round2(ant.estoqueAtual + linha.quantidade)
      lista = lista.map((p, i) =>
        i === idx ? { ...p, valorCusto: custoSim, estoqueAtual: estNovo } : p,
      )
      continue
    }

    const ocorr = novosPorSku.get(skuKey) ?? 0
    novosPorSku.set(skuKey, ocorr + 1)
    const descFinal = ocorr === 0 ? linha.descricao : `${linha.descricao} dupli`
    const codigoInterno = gerarProximoCodigoInterno(lista)
    const base = criarProdutoVazio()
    const custo = round2(linha.custoUnitario)
    const novoP: Produto = {
      ...base,
      codigoInterno,
      codigoFornecedor: linha.skuFornecedor.trim(),
      descricao: descFinal,
      tipoLancamento: 'controle_estoque',
      valorCusto: custo,
      valorVarejo: custo,
      valorAtacado: custo,
      estoqueAtual: round2(linha.quantidade),
      ativo: true,
      id: crypto.randomUUID(),
      criadoEm: new Date().toISOString(),
    }
    lista = [...lista, novoP]
  }

  return conflitos
}

/**
 * Cadastra produtos novos (código interno P-…), atualiza custo e soma estoque nos existentes.
 * SKU repetido no arquivo: se ainda não existe no cadastro, o 2º item ganha sufixo " dupli" na descrição.
 *
 * `decisoesPorLinha`: apenas índices onde houve conflito (custo menor + estoque); demais linhas ignoradas.
 * `meta`: fornecedor (referência da compra) e % de lucro sobre o custo para recalcular varejo e atacado.
 */
export function aplicarEntradaPedidoPlanilha(
  linhas: LinhaPlanilhaPedido[],
  nomeArquivo: string,
  decisoesPorLinha: Map<number, DecisaoCustoMenorComEstoque> = new Map(),
  meta: MetaEntradaPedidoPlanilha,
): {
  criados: number
  atualizados: number
  itens: ItemEntradaPedidoPlanilha[]
} {
  const pct = meta.pctLucroSobreCusto
  let lista = loadProdutos()
  const itens: ItemEntradaPedidoPlanilha[] = []
  let criados = 0
  let atualizados = 0
  const novosPorSku = new Map<string, number>()

  for (let linhaIndex = 0; linhaIndex < linhas.length; linhaIndex++) {
    const linha = linhas[linhaIndex]
    const skuKey = normSku(linha.skuFornecedor)
    const idx = lista.findIndex((p) => normSku(p.codigoFornecedor) === skuKey)

    if (idx >= 0) {
      const ant = lista[idx]
      const estNovo = round2(ant.estoqueAtual + linha.quantidade)
      const { valorCusto, custoCadastroMantido } = resolverValorCustoNaAtualizacao(
        ant,
        linha.custoUnitario,
        linhaIndex,
        decisoesPorLinha,
      )
      const { valorVarejo, valorAtacado } = precosVendaPorLucroSobreCusto(valorCusto, pct)
      lista = lista.map((p, i) =>
        i === idx
          ? {
              ...p,
              fornecedorId: meta.fornecedorId,
              fornecedorNome: meta.fornecedorNome,
              valorCusto,
              valorVarejo,
              valorAtacado,
              estoqueAtual: estNovo,
            }
          : p,
      )
      atualizados += 1
      itens.push({
        produtoId: ant.id,
        skuFornecedor: linha.skuFornecedor,
        descricao: ant.descricao,
        quantidade: linha.quantidade,
        custoUnitario: round2(linha.custoUnitario),
        acao: 'atualizado',
        custoCadastroMantido: custoCadastroMantido || undefined,
      })
      continue
    }

    const ocorr = novosPorSku.get(skuKey) ?? 0
    novosPorSku.set(skuKey, ocorr + 1)
    const descFinal = ocorr === 0 ? linha.descricao : `${linha.descricao} dupli`

    const codigoInterno = gerarProximoCodigoInterno(lista)
    const base = criarProdutoVazio()
    const custo = round2(linha.custoUnitario)
    const { valorVarejo, valorAtacado } = precosVendaPorLucroSobreCusto(custo, pct)
    const novo: Produto = {
      ...base,
      codigoInterno,
      codigoFornecedor: linha.skuFornecedor.trim(),
      fornecedorId: meta.fornecedorId,
      fornecedorNome: meta.fornecedorNome,
      descricao: descFinal,
      tipoLancamento: 'controle_estoque',
      valorCusto: custo,
      valorVarejo,
      valorAtacado,
      estoqueAtual: round2(linha.quantidade),
      ativo: true,
      id: crypto.randomUUID(),
      criadoEm: new Date().toISOString(),
    }
    lista = [...lista, novo]
    criados += 1
    itens.push({
      produtoId: novo.id,
      skuFornecedor: linha.skuFornecedor,
      descricao: descFinal,
      quantidade: linha.quantidade,
      custoUnitario: custo,
      acao: 'criado',
    })
  }

  saveProdutos(lista)

  appendRegistroEntradaPedido({
    emitidoEmIso: new Date().toISOString(),
    nomeArquivo,
    fornecedorId: meta.fornecedorId,
    fornecedorNome: meta.fornecedorNome,
    lucroSobreCustoPct: round2(meta.pctLucroSobreCusto),
    itens,
  })

  return { criados, atualizados, itens }
}
