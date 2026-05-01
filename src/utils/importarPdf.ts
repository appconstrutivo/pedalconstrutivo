import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { ItemImportado } from './importarExcel'

import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type TextItem = { str: string; x: number; y: number }

function parsePrecoBr(s: string): number {
  const u = s.trim()
  if (u === '-' || u === '–' || u === '—') return 0
  const t = u.replace(/\s/g, '').replace(/r\$\s*/i, '').replace(',', '.')
  const n = parseFloat(t)
  return Number.isFinite(n) ? n : 0
}

/**
 * Agrupa fragmentos de texto do PDF em linhas (mesma baseline ~y) e ordena da esquerda para a direita.
 */
function textItemsParaLinhas(items: TextItem[], yThreshold = 6): string[] {
  if (items.length === 0) return []
  const grupos: { y: number; items: TextItem[] }[] = []
  for (const it of items) {
    const g = grupos.find((gr) => Math.abs(gr.y - it.y) < yThreshold)
    if (g) {
      g.items.push(it)
      g.y = (g.y * (g.items.length - 1) + it.y) / g.items.length
    } else {
      grupos.push({ y: it.y, items: [it] })
    }
  }
  grupos.sort((a, b) => b.y - a.y)
  return grupos.map((g) => {
    g.items.sort((a, b) => a.x - b.x)
    return g.items.map((i) => i.str).join(' ')
  })
}

async function extrairLinhasDoPdf(data: ArrayBuffer): Promise<string[]> {
  const pdf = await getDocument({ data }).promise
  const todasLinhas: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    const items: TextItem[] = []
    for (const raw of content.items) {
      const it = raw as { str?: string; transform?: number[] }
      if (!it.str?.trim() || !it.transform) continue
      items.push({
        str: it.str,
        x: it.transform[4],
        y: it.transform[5],
      })
    }
    todasLinhas.push(...textItemsParaLinhas(items))
  }
  return todasLinhas
}

/**
 * Interpreta um bloco de texto de uma linha de produto.
 *
 * Dois layouts comuns:
 * - **LM / Ferramentas:** SKU + nome + `R$` preço unit. + quantidade + `R$` total
 * - **Giro / Sorobike (planilha):** SKU + nome + quantidade + `R$` preço + `R$` total
 */
export function parseLinhaProdutoPdf(texto: string): ItemImportado | null {
  const t = texto.replace(/\s+/g, ' ').trim()
  if (!/^\d{6}\b/.test(t)) return null

  let m: RegExpMatchArray | null

  // LM / Ferramentas: … nome … R$ preço unit. QTD R$ total (preço antes da quantidade)
  m = t.match(/^(\d{6})\s+(.+?)\s+R\$\s*([\d.,]+|-)\s+(\d+)\s+R\$\s*([\d.,]+|-)\s*$/i)
  if (m) {
    const preco = parsePrecoBr(m[3])
    const qtd = parseInt(m[4], 10)
    return {
      descricao: `${m[1]} ${m[2].trim()}`.trim(),
      precoVenda: preco > 0 ? preco : 0,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : undefined,
    }
  }

  // Giro / Sorobike (planilha): … nome … QTD R$ preço R$ total (quantidade antes do primeiro R$)
  m = t.match(/^(\d{6})\s+(.+)\s+(\d+)\s+R\$\s*([\d.,]+|-)\s+R\$\s*([\d.,]+|-)\s*$/i)
  if (m) {
    const preco = parsePrecoBr(m[4])
    const qtd = parseInt(m[3], 10)
    return {
      descricao: `${m[1]} ${m[2].trim()}`.trim(),
      precoVenda: preco > 0 ? preco : 0,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : undefined,
    }
  }

  // Giro: linha termina só com quantidade e preço ausente (ex.: "10 R$ -")
  m = t.match(/^(\d{6})\s+(.+?)\s+(\d+)\s+R\$\s*-\s*$/i)
  if (m) {
    const qtd = parseInt(m[3], 10)
    return {
      descricao: `${m[1]} ${m[2].trim()}`.trim(),
      precoVenda: 0,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : undefined,
    }
  }

  // LM legado: preço zero explícito "0" antes da quantidade
  m = t.match(/^(\d{6})\s+(.+?)\s+0\s+(\d+)\s+R\$\s*([\d.,-]*)\s*$/i)
  if (m) {
    const qtd = parseInt(m[3], 10)
    return {
      descricao: `${m[1]} ${m[2].trim()}`.trim(),
      precoVenda: 0,
      quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : undefined,
    }
  }

  return null
}

function linhaEhCabecalhoOuLixo(linha: string): boolean {
  const s = linha.toLowerCase().trim()
  if (!s) return true
  if (/^--\s*\d+\s+of\s+\d+/.test(s)) return true
  if (s.includes('sku') && s.includes('nome')) return true
  if (s === 'venda' || s === 'preço de') return true
  if (s.includes('preço de') && s.includes('venda')) return true
  if (s.includes('quantidade') && s.includes('total')) return true
  if (s === 'quantidade' || s === 'total') return true
  return false
}

/**
 * Junta linhas quebradas no meio da descrição e extrai itens (mesma lógica conceitual do Excel).
 */
function linhasParaItens(linhas: string[]): ItemImportado[] {
  const itens: ItemImportado[] = []
  let buffer = ''

  for (const linha of linhas) {
    const L = linha.trim()
    if (!L || linhaEhCabecalhoOuLixo(L)) continue

    if (/^\d{6}\b/.test(L)) {
      if (buffer) {
        const parsed = parseLinhaProdutoPdf(buffer)
        if (parsed) itens.push(parsed)
        buffer = ''
      }
      buffer = L
    } else if (buffer) {
      buffer = `${buffer} ${L}`
    }
  }
  if (buffer) {
    const parsed = parseLinhaProdutoPdf(buffer)
    if (parsed) itens.push(parsed)
  }

  return itens
}

/**
 * Lê um PDF no formato de lista (SKU + descrição + preço de venda + quantidade + total) e retorna itens importáveis.
 * O layout pode variar; PDFs só com imagem (scan) não são suportados.
 */
export async function lerItensDoPdf(file: File): Promise<ItemImportado[]> {
  const data = await file.arrayBuffer()
  const linhas = await extrairLinhasDoPdf(data)
  return linhasParaItens(linhas)
}
