import type {
  DadosPagamentoVenda,
  ItemMovimentacaoHistorico,
  RegistroMovimentacao,
  RegistroOrcamentoHistorico,
  RegistroVendaHistorico,
} from '../types'

/** Snapshot completo do histórico gravado no navegador (somente adição/atualização; não substitui o Supabase). */
export const SNAPSHOT_MOVIMENTACOES_KEY = 'pc_snapshot_movimentacoes_v1'

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function pagamentoPadrao(): DadosPagamentoVenda {
  return {
    subtotalBruto: 0,
    tipoDesconto: 'percentual',
    descontoInformado: 0,
    valorDescontoCalculado: 0,
    acrescimo: 0,
    totalAPagar: 0,
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    boleto: 0,
    totalPago: 0,
    troco: 0,
  }
}

/** Agenda gravação do snapshot no localStorage (debounce) para não bloquear o PDV. */
export function agendarSnapshotMovimentacoesNoNavegador(lista: RegistroMovimentacao[]): void {
  if (typeof localStorage === 'undefined') return
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    try {
      localStorage.setItem(SNAPSHOT_MOVIMENTACOES_KEY, JSON.stringify(lista))
    } catch (e) {
      console.warn('[Pedal Construtivo] Não foi possível gravar snapshot local de movimentações (quota ou bloqueio).', e)
    }
  }, 500)
}

export function lerSnapshotMovimentacoesDoNavegador(): RegistroMovimentacao[] {
  if (typeof localStorage === 'undefined') return []
  const raw = localStorage.getItem(SNAPSHOT_MOVIMENTACOES_KEY)
  if (!raw) return []
  try {
    const data = JSON.parse(raw) as unknown
    return extrairMovimentacoesProfundo(data)
  } catch {
    return []
  }
}

function itemHistoricoFolgado(x: unknown): ItemMovimentacaoHistorico | null {
  if (!x || typeof x !== 'object') return null
  const i = x as Record<string, unknown>
  if (typeof i.produtoId !== 'string' || typeof i.descricao !== 'string') return null
  const d = i.desconto_percentual ?? i.descontoPercentual
  const descontoPercentual =
    d !== undefined && d !== null && Number.isFinite(Number(d)) ? Math.min(100, Math.max(0, Number(d))) : undefined
  const base: ItemMovimentacaoHistorico = {
    produtoId: i.produtoId,
    descricao: i.descricao,
    codigoBarras: typeof i.codigoBarras === 'string' ? i.codigoBarras : '',
    quantidade: Number(i.quantidade) || 0,
    precoUnitario: Number(i.precoUnitario) || 0,
    subtotal: Number(i.subtotal) || 0,
    valorCustoUnitario: Number(i.valorCustoUnitario) || 0,
    tipoProdutoId: typeof i.tipoProdutoId === 'string' ? i.tipoProdutoId : '',
  }
  return descontoPercentual !== undefined ? { ...base, descontoPercentual } : base
}

function pagamentoFolgado(x: unknown): DadosPagamentoVenda {
  const p = pagamentoPadrao()
  if (!x || typeof x !== 'object') return p
  const o = x as Record<string, unknown>
  return {
    ...p,
    subtotalBruto: Number(o.subtotalBruto) || 0,
    tipoDesconto: o.tipoDesconto === 'valor' ? 'valor' : 'percentual',
    descontoInformado: Number(o.descontoInformado) || 0,
    valorDescontoCalculado: Number(o.valorDescontoCalculado) || 0,
    acrescimo: Number(o.acrescimo) || 0,
    totalAPagar: Number(o.totalAPagar) || 0,
    dinheiro: Number(o.dinheiro) || 0,
    pix: Number(o.pix) || 0,
    cartao: Number(o.cartao) || 0,
    boleto: Number(o.boleto) || 0,
    totalPago: Number(o.totalPago) || 0,
    troco: Number(o.troco) || 0,
  }
}

/** Tenta normalizar um objeto solto em `RegistroMovimentacao` (importação / chaves antigas). */
export function normalizarRegistroMovimentacaoFolgado(x: unknown): RegistroMovimentacao | null {
  if (!x || typeof x !== 'object') return null
  const o = x as Record<string, unknown>
  const kind = o.kind
  if (kind !== 'venda' && kind !== 'orcamento') return null
  if (typeof o.id !== 'string' || !o.id) return null
  if (typeof o.emitidoEmIso !== 'string' || !o.emitidoEmIso) return null
  const numeroDocumentoStr =
    typeof o.numeroDocumento === 'string'
      ? o.numeroDocumento
      : o.numeroDocumento !== undefined && o.numeroDocumento !== null
        ? String(o.numeroDocumento)
        : ''
  if (!numeroDocumentoStr) return null
  const itensRaw = Array.isArray(o.itens) ? o.itens : []
  const itens = itensRaw.map(itemHistoricoFolgado).filter((i): i is ItemMovimentacaoHistorico => i !== null)
  const vendedorNome = typeof o.vendedorNome === 'string' && o.vendedorNome ? o.vendedorNome : 'Administrador'
  const clienteId = typeof o.clienteId === 'string' ? o.clienteId : null
  const clienteNome = typeof o.clienteNome === 'string' ? o.clienteNome : null
  const observacoes = typeof o.observacoes === 'string' ? o.observacoes : undefined
  const base = {
    id: o.id,
    emitidoEmIso: o.emitidoEmIso,
    numeroDocumento: numeroDocumentoStr,
    clienteId,
    clienteNome,
    vendedorNome,
    observacoes,
    itens,
  }

  if (kind === 'orcamento') {
    const reg: RegistroOrcamentoHistorico = {
      kind: 'orcamento',
      ...base,
      total: Number(o.total) || 0,
    }
    return reg
  }

  const cancel =
    o.cancelamento && typeof o.cancelamento === 'object'
      ? (o.cancelamento as RegistroVendaHistorico['cancelamento'])
      : undefined

  const reg: RegistroVendaHistorico = {
    kind: 'venda',
    ...base,
    pagamento: pagamentoFolgado(o.pagamento),
    cancelamento: cancel,
  }
  return reg
}

/** Percorre arrays e chaves comuns (`movimentacoes`, `historico`, etc.) procurando registros. */
export function extrairMovimentacoesProfundo(data: unknown): RegistroMovimentacao[] {
  const saida: RegistroMovimentacao[] = []
  const vistos = new Set<string>()

  function pushReg(r: RegistroMovimentacao) {
    if (vistos.has(r.id)) return
    vistos.add(r.id)
    saida.push(r)
  }

  function walk(x: unknown): void {
    if (x === null || x === undefined) return
    const one = normalizarRegistroMovimentacaoFolgado(x)
    if (one) {
      pushReg(one)
      return
    }
    if (Array.isArray(x)) {
      for (const el of x) walk(el)
      return
    }
    if (typeof x === 'object') {
      for (const v of Object.values(x as Record<string, unknown>)) walk(v)
    }
  }

  walk(data)
  return saida
}

export type CandidatoStorageMovimentacao = {
  origem: 'localStorage' | 'sessionStorage'
  chave: string
  tamanhoUtf8: number
  registrosDetectados: number
}

function contarRegistrosNoTexto(raw: string): number {
  try {
    return extrairMovimentacoesProfundo(JSON.parse(raw) as unknown).length
  } catch {
    return 0
  }
}

/** Lista chaves do navegador cujo valor parece conter array de vendas/orçamentos. */
export function listarCandidatosMovimentacaoNoStorage(): CandidatoStorageMovimentacao[] {
  const out: CandidatoStorageMovimentacao[] = []
  const buffers: { origem: 'localStorage' | 'sessionStorage'; chave: string; val: string }[] = []

  if (typeof localStorage !== 'undefined') {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i)
      if (!chave) continue
      const val = localStorage.getItem(chave)
      if (val && val.length > 2) buffers.push({ origem: 'localStorage', chave, val })
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    for (let i = 0; i < sessionStorage.length; i++) {
      const chave = sessionStorage.key(i)
      if (!chave) continue
      const val = sessionStorage.getItem(chave)
      if (val && val.length > 2) buffers.push({ origem: 'sessionStorage', chave, val })
    }
  }

  for (const { origem, chave, val } of buffers) {
    const n = contarRegistrosNoTexto(val)
    if (n > 0) {
      out.push({ origem, chave, tamanhoUtf8: val.length, registrosDetectados: n })
    }
  }

  return out.sort((a, b) => b.registrosDetectados - a.registrosDetectados)
}

export function lerMovimentacoesDaChaveStorage(origem: 'localStorage' | 'sessionStorage', chave: string): RegistroMovimentacao[] {
  const store = origem === 'localStorage' ? localStorage : sessionStorage
  const raw = store.getItem(chave)
  if (!raw) return []
  try {
    return extrairMovimentacoesProfundo(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}
