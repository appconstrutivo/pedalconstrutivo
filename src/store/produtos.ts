import type { Produto, TipoLancamentoProduto } from '../types'
import { loadTiposProduto } from './tiposProduto'
import { deleteProduto as sbDeleteProduto, upsertProdutos as sbUpsertProdutos } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo-produtos'

type ProdutoArmazenado = Partial<Produto> & {
  id?: string
  categoria?: string
}

function normalizarLinha(row: unknown): Produto | null {
  if (!row || typeof row !== 'object') return null
  const r = row as ProdutoArmazenado
  if (typeof r.id !== 'string' || typeof r.criadoEm !== 'string') return null

  const tipos = loadTiposProduto()
  let tipoProdutoId = typeof r.tipoProdutoId === 'string' ? r.tipoProdutoId : ''
  if (!tipoProdutoId && typeof r.categoria === 'string' && r.categoria.trim()) {
    const nome = r.categoria.trim()
    tipoProdutoId = tipos.find((t) => t.nome === nome)?.id ?? ''
  }

  const tl = r.tipoLancamento
  const tipoLancamento: TipoLancamentoProduto =
    tl === 'sem_controle_estoque' || tl === 'controle_estoque' || tl === 'servico' ? tl : 'controle_estoque'

  const codigoInterno = typeof r.codigoInterno === 'string' ? r.codigoInterno.trim() : ''
  const codigoFornecedor = typeof r.codigoFornecedor === 'string' ? r.codigoFornecedor.trim() : ''
  const fornecedorId = typeof r.fornecedorId === 'string' ? r.fornecedorId : ''
  const fornecedorNome = typeof r.fornecedorNome === 'string' ? r.fornecedorNome : ''

  return {
    id: r.id,
    tipoLancamento,
    codigoInterno,
    codigoFornecedor,
    fornecedorId,
    fornecedorNome,
    descricao: typeof r.descricao === 'string' ? r.descricao : '',
    valorCusto: typeof r.valorCusto === 'number' ? r.valorCusto : 0.01,
    valorVarejo: typeof r.valorVarejo === 'number' ? r.valorVarejo : 0.01,
    valorAtacado: typeof r.valorAtacado === 'number' ? r.valorAtacado : 0.01,
    tipoProdutoId,
    codigoBarras: typeof r.codigoBarras === 'string' ? r.codigoBarras : '',
    aceitaFracionar: Boolean(r.aceitaFracionar),
    unidadeMedida: typeof r.unidadeMedida === 'string' ? r.unidadeMedida : 'UN',
    pontuacao: typeof r.pontuacao === 'number' ? r.pontuacao : 0,
    informacoesAdicionais: typeof r.informacoesAdicionais === 'string' ? r.informacoesAdicionais : '',
    moeda: typeof r.moeda === 'string' ? r.moeda : 'R$',
    cotacao: typeof r.cotacao === 'number' ? r.cotacao : 1,
    estoqueMinimo: typeof r.estoqueMinimo === 'number' ? r.estoqueMinimo : 0,
    estoqueAtual: typeof r.estoqueAtual === 'number' ? r.estoqueAtual : 0,
    ativo: r.ativo !== false,
    observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
    criadoEm: r.criadoEm,
  }
}

/** Maior sequência numérica já usada em códigos P-NNNNNN. */
function maiorSequenciaCodigoInterno(lista: Produto[]): number {
  let max = 0
  for (const p of lista) {
    const m = /^P-(\d+)$/i.exec((p.codigoInterno || '').trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max
}

/** Atribui `P-000001` a produtos antigos sem código interno (uma vez). */
function migrarCodigosInternoSeNecessario(lista: Produto[]): Produto[] {
  const precisa = lista.some((p) => !p.codigoInterno?.trim())
  if (!precisa) return lista
  let seq = maiorSequenciaCodigoInterno(lista)
  return lista.map((p) => {
    if (p.codigoInterno?.trim()) return p
    seq += 1
    return { ...p, codigoInterno: `P-${String(seq).padStart(6, '0')}` }
  })
}

export function gerarProximoCodigoInterno(lista: Produto[]): string {
  const n = maiorSequenciaCodigoInterno(lista) + 1
  return `P-${String(n).padStart(6, '0')}`
}

export function loadProdutos(): Produto[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    let list = parsed.map(normalizarLinha).filter((p): p is Produto => p !== null)
    const migrado = migrarCodigosInternoSeNecessario(list)
    if (migrado !== list) {
      saveProdutos(migrado)
      list = migrado
    }
    return list
  } catch {
    return []
  }
}

export function saveProdutos(produtos: Produto[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(produtos))
  // Notifica a UI na mesma aba (storage event não dispara localmente).
  window.dispatchEvent(new CustomEvent('pc:produtos-changed'))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'produtos' } }))
}

function novoId(): string {
  return crypto.randomUUID()
}

export function criarProdutoVazio(): Omit<Produto, 'id' | 'criadoEm'> {
  return {
    tipoLancamento: 'controle_estoque',
    codigoInterno: '',
    codigoFornecedor: '',
    fornecedorId: '',
    fornecedorNome: '',
    descricao: '',
    valorCusto: 0.01,
    valorVarejo: 0.01,
    valorAtacado: 0.01,
    tipoProdutoId: '',
    codigoBarras: '',
    aceitaFracionar: false,
    unidadeMedida: 'UN',
    pontuacao: 0,
    informacoesAdicionais: '',
    moeda: 'R$',
    cotacao: 1,
    estoqueMinimo: 0,
    estoqueAtual: 0,
    ativo: true,
    observacoes: '',
  }
}

export function addProduto(draft: Omit<Produto, 'id' | 'criadoEm'>): Produto {
  const lista = loadProdutos()
  const codigoInterno =
    draft.codigoInterno.trim() !== '' ? draft.codigoInterno.trim() : gerarProximoCodigoInterno(lista)
  const p: Produto = {
    ...draft,
    codigoInterno,
    id: novoId(),
    criadoEm: new Date().toISOString(),
  }
  saveProdutos([...lista, p])
  void sbUpsertProdutos([p])
  return p
}

export function updateProduto(id: string, draft: Omit<Produto, 'id' | 'criadoEm'>): void {
  const lista = loadProdutos()
  const idx = lista.findIndex((x) => x.id === id)
  if (idx < 0) return
  const antigo = lista[idx]
  const next = [...lista]
  next[idx] = { ...draft, id: antigo.id, criadoEm: antigo.criadoEm }
  saveProdutos(next)
  void sbUpsertProdutos([next[idx]])
}

export function removeProduto(id: string): void {
  saveProdutos(loadProdutos().filter((p) => p.id !== id))
  void sbDeleteProduto(id)
}

export function removeProdutos(ids: string[]): void {
  if (ids.length === 0) return
  const set = new Set(ids)
  saveProdutos(loadProdutos().filter((p) => !set.has(p.id)))
  for (const id of ids) void sbDeleteProduto(id)
}

export function gerarCodigoBarrasPlaceholder(): string {
  const base = String(Date.now()).slice(-12).padStart(12, '0')
  return `789${base}`.slice(0, 13)
}

/** Reatribui produtos que usavam `tipoRemovidoId` para `novoTipoId` e persiste. */
export function reatribuirTipoEmProdutos(tipoRemovidoId: string, novoTipoId: string): void {
  const lista = loadProdutos()
  saveProdutos(
    lista.map((p) => (p.tipoProdutoId === tipoRemovidoId ? { ...p, tipoProdutoId: novoTipoId } : p)),
  )
}

export function contarProdutosPorTipo(tipoId: string): number {
  return loadProdutos().filter((p) => p.tipoProdutoId === tipoId).length
}

/** Baixa estoque agregando quantidades por produto (após venda concluída). */
export function baixarEstoquePorVenda(linhas: { produtoId: string; quantidade: number }[]): void {
  const map = new Map<string, number>()
  for (const l of linhas) {
    map.set(l.produtoId, (map.get(l.produtoId) ?? 0) + l.quantidade)
  }
  const lista = loadProdutos()
  const next = lista.map((p) => {
    const q = map.get(p.id)
    if (!q) return p
    return { ...p, estoqueAtual: Math.max(0, p.estoqueAtual - q) }
  })
  saveProdutos(next)
}

/** Estorna estoque agregando quantidades por produto (ex.: cancelamento administrativo). */
export function estornarEstoquePorCancelamento(linhas: { produtoId: string; quantidade: number }[]): void {
  const map = new Map<string, number>()
  for (const l of linhas) {
    map.set(l.produtoId, (map.get(l.produtoId) ?? 0) + l.quantidade)
  }
  const lista = loadProdutos()
  const next = lista.map((p) => {
    const q = map.get(p.id)
    if (!q) return p
    return { ...p, estoqueAtual: Math.max(0, (p.estoqueAtual ?? 0) + q) }
  })
  saveProdutos(next)
}
