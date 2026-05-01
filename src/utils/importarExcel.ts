import * as XLSX from 'xlsx'

export interface ItemImportado {
  descricao: string
  precoVenda?: number
  quantidade?: number
}

const NOME_HEADERS = ['nome', 'name', 'descrição', 'descricao', 'item', 'produto']
const PRECO_HEADERS = ['preço de venda', 'preco de venda', 'preço', 'preco', 'preco venda', 'valor', 'price']
const QTD_HEADERS = ['quantidade', 'qtd', 'qtde', 'qty', 'quantity', 'qde']

function normalizarCabecalho(val: unknown): string {
  if (val == null) return ''
  const s = String(val).trim().toLowerCase()
  return s.replace(/\s+/g, ' ')
}

function parsePrecoCelula(val: unknown): number | undefined {
  if (val == null) return undefined
  if (typeof val === 'number' && Number.isFinite(val)) return val
  const s = String(val).trim().replace(/\s/g, '').replace(/r\$\s*/i, '').replace(',', '.')
  const num = parseFloat(s)
  return Number.isFinite(num) ? num : undefined
}

function parseQuantidadeCelula(val: unknown): number | undefined {
  if (val == null) return undefined
  if (typeof val === 'number' && Number.isFinite(val) && val >= 0) return val
  const s = String(val).trim().replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(s)
  return Number.isFinite(num) && num >= 0 ? num : undefined
}

/**
 * Encontra a linha de cabeçalho e índices das colunas Nome, Preço de venda e (opcional) Quantidade.
 */
function encontrarCabecalhos(
  rows: unknown[][]
): { rowIndex: number; colNome: number; colPreco: number | null; colQuantidade: number | null } | null {
  const maxRows = Math.min(rows.length, 25)
  for (let r = 0; r < maxRows; r++) {
    const row = rows[r] ?? []
    let colNome = -1
    let colPreco: number | null = null
    let colQuantidade: number | null = null
    for (let c = 0; c < row.length; c++) {
      const cell = normalizarCabecalho(row[c])
      if (NOME_HEADERS.some((h) => cell === h || cell.includes(h))) colNome = c
      if (PRECO_HEADERS.some((h) => cell === h || cell.includes(h))) colPreco = c
      if (QTD_HEADERS.some((h) => cell === h || cell.includes(h))) colQuantidade = c
    }
    if (colNome >= 0) return { rowIndex: r, colNome, colPreco, colQuantidade }
  }
  return null
}

/**
 * Lê um arquivo Excel e extrai itens das colunas "Nome", opcionalmente "Preço de Venda" e "Quantidade".
 * Suporta planilhas com cabeçalho em qualquer uma das primeiras linhas.
 */
export async function lerItensDoExcel(file: File): Promise<ItemImportado[]> {
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  if (!firstSheetName) return []
  const sheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][]
  if (!rows.length) return []

  const info = encontrarCabecalhos(rows)
  if (!info) return []

  const { rowIndex, colNome, colPreco, colQuantidade } = info
  const itens: ItemImportado[] = []
  for (let r = rowIndex + 1; r < rows.length; r++) {
    const row = rows[r] ?? []
    const descricao = String(row[colNome] ?? '').trim()
    if (!descricao) continue
    const precoVenda = colPreco != null ? parsePrecoCelula(row[colPreco]) : undefined
    const quantidade = colQuantidade != null ? parseQuantidadeCelula(row[colQuantidade]) : undefined
    itens.push({ descricao, precoVenda, quantidade })
  }
  return itens
}
