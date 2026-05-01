import * as XLSX from 'xlsx'
import { parseValorMonetarioBr, round2 } from './moeda'

export type LinhaPlanilhaPedido = {
  skuFornecedor: string
  descricao: string
  custoUnitario: number
  quantidade: number
  totalLinha: number
}

export type ResultadoLeituraPedido = {
  linhas: LinhaPlanilhaPedido[]
  erros: string[]
}

function normHeader(c: unknown): string {
  return String(c ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

/** Localiza linha de cabeçalho com SKU + Nome (planilhas de orçamento/pedido MB e similares). */
function encontrarIndicesCabecalho(row: unknown[]): {
  sku: number
  nome: number
  preco: number
  qtd: number
  total: number
} | null {
  const cells = row.map(normHeader)
  const idxSku = cells.findIndex((c) => c === 'sku')
  const idxNome = cells.findIndex((c) => c === 'nome' || c.includes('descricao'))
  const idxPreco = cells.findIndex(
    (c) => c.includes('preco') && (c.includes('venda') || c.includes('unit')),
  )
  const idxQtd = cells.findIndex((c) => c === 'quantidade' || c === 'qtd')
  const idxTotal = cells.findIndex((c) => c === 'total')
  if (idxSku < 0 || idxNome < 0 || idxPreco < 0 || idxQtd < 0 || idxTotal < 0) return null
  return { sku: idxSku, nome: idxNome, preco: idxPreco, qtd: idxQtd, total: idxTotal }
}

function limparDescricao(s: string): string {
  return s.replace(/\r\n/g, '\n').replace(/\n+/g, ' ').trim()
}

function skuParaTexto(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v) === v ? v : v)
  return String(v).trim()
}

/**
 * Lê arquivo .xlsx de pedido/orçamento (colunas SKU, Nome, Preço de Venda, Quantidade, Total).
 */
export function lerPlanilhaPedidoFornecedor(arquivo: ArrayBuffer): ResultadoLeituraPedido {
  const erros: string[] = []
  const linhas: LinhaPlanilhaPedido[] = []
  let wb: ReturnType<typeof XLSX.read>
  try {
    wb = XLSX.read(arquivo, { type: 'array' })
  } catch {
    return { linhas: [], erros: ['Não foi possível ler o arquivo. Verifique se é um Excel (.xlsx) válido.'] }
  }
  const nomeAba = wb.SheetNames[0]
  if (!nomeAba) return { linhas: [], erros: ['A planilha não contém abas.'] }
  const sh = wb.Sheets[nomeAba]
  const mat = XLSX.utils.sheet_to_json(sh, { header: 1, defval: '' }) as unknown[][]

  let headerIdx = -1
  let col: ReturnType<typeof encontrarIndicesCabecalho> = null
  for (let i = 0; i < Math.min(mat.length, 40); i++) {
    const row = mat[i]
    if (!Array.isArray(row)) continue
    const found = encontrarIndicesCabecalho(row)
    if (found) {
      headerIdx = i
      col = found
      break
    }
  }
  if (!col || headerIdx < 0) {
    return {
      linhas: [],
      erros: [
        'Não encontrei a linha de cabeçalho esperada (colunas SKU, Nome, Preço de Venda, Quantidade, Total).',
      ],
    }
  }

  for (let r = headerIdx + 1; r < mat.length; r++) {
    const row = mat[r]
    if (!Array.isArray(row)) continue
    const skuRaw = row[col.sku]
    const nomeRaw = row[col.nome]
    const sku = skuParaTexto(skuRaw)
    const descricao = limparDescricao(String(nomeRaw ?? ''))
    if (!sku && !descricao) continue
    if (!sku) {
      erros.push(`Linha ${r + 1}: SKU em branco (descrição: ${descricao.slice(0, 40)}…).`)
      continue
    }
    if (!descricao) {
      erros.push(`Linha ${r + 1}: descrição em branco (SKU ${sku}).`)
      continue
    }

    const custo = parseValorMonetarioBr(row[col.preco] as string | number)
    const qtdRaw = row[col.qtd]
    const qtd =
      typeof qtdRaw === 'number' && Number.isFinite(qtdRaw)
        ? qtdRaw
        : parseFloat(String(qtdRaw).replace(',', '.'))
    const total = parseValorMonetarioBr(row[col.total] as string | number)

    if (!Number.isFinite(custo) || custo < 0) {
      erros.push(`Linha ${r + 1} (SKU ${sku}): preço unitário inválido.`)
      continue
    }
    if (!Number.isFinite(qtd) || qtd <= 0) {
      erros.push(`Linha ${r + 1} (SKU ${sku}): quantidade inválida.`)
      continue
    }

    const q = round2(qtd)
    const totalOk = Number.isFinite(total) ? total : round2(custo * q)
    linhas.push({
      skuFornecedor: sku,
      descricao,
      custoUnitario: custo,
      quantidade: q,
      totalLinha: totalOk,
    })
  }

  return { linhas, erros }
}
