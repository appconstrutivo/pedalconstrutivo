import { round2 } from '../utils/moeda'

export type PedidoCompraItem =
  | {
      id: string
      kind: 'produto'
      produtoId: string
      quantidade: number
      observacao?: string
      criadoEmIso: string
    }
  | {
      id: string
      kind: 'avulso'
      descricao: string
      quantidade: number
      observacao?: string
      criadoEmIso: string
    }

export interface PedidoCompraDraft {
  atualizadoEmIso: string
  itens: PedidoCompraItem[]
}

export interface PedidoCompra {
  id: string
  nome: string
  criadoEmIso: string
  atualizadoEmIso: string
  itens: PedidoCompraItem[]
}

export interface PedidoCompraState {
  ativoId: string
  pedidos: PedidoCompra[]
}

const STORAGE_KEY_STATE = 'pedal-construtivo.pedidos-compra.v2'
// legado (v1): um único rascunho
const STORAGE_KEY_LEGACY = 'pedal-construtivo.pedido-compra'

function normalizarItem(raw: unknown): PedidoCompraItem | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as any
  const kind = r.kind
  const id = typeof r.id === 'string' ? r.id : null
  if (!id) return null

  const quantidade = round2(Math.max(0, Number(r.quantidade) || 0))
  const observacao = typeof r.observacao === 'string' ? r.observacao : undefined
  const criadoEmIso = typeof r.criadoEmIso === 'string' ? r.criadoEmIso : new Date().toISOString()

  if (kind === 'produto') {
    const produtoId = typeof r.produtoId === 'string' ? r.produtoId : ''
    if (!produtoId) return null
    return { id, kind: 'produto', produtoId, quantidade, observacao, criadoEmIso }
  }

  if (kind === 'avulso') {
    const descricao = typeof r.descricao === 'string' ? r.descricao.trim() : ''
    if (!descricao) return null
    return { id, kind: 'avulso', descricao, quantidade, observacao, criadoEmIso }
  }

  return null
}

function normalizarPedido(raw: unknown): PedidoCompra | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as any
  const id = typeof r.id === 'string' ? r.id : ''
  const nome = typeof r.nome === 'string' ? r.nome.trim() : ''
  if (!id || !nome) return null
  const criadoEmIso = typeof r.criadoEmIso === 'string' ? r.criadoEmIso : new Date().toISOString()
  const atualizadoEmIso = typeof r.atualizadoEmIso === 'string' ? r.atualizadoEmIso : new Date().toISOString()
  const itensRaw: unknown[] = Array.isArray(r.itens) ? r.itens : []
  const itens = itensRaw.map(normalizarItem).filter((x): x is PedidoCompraItem => x !== null)
  return { id, nome, criadoEmIso, atualizadoEmIso, itens }
}

function gerarPedidoPadrao(itens: PedidoCompraItem[] = []): PedidoCompra {
  const agora = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    nome: 'Pedido 1',
    criadoEmIso: agora,
    atualizadoEmIso: agora,
    itens,
  }
}

function carregarLegacyComoPedido(): PedidoCompra | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LEGACY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PedidoCompraDraft
    const itensRaw: unknown[] = Array.isArray((parsed as any)?.itens) ? (parsed as any).itens : []
    const itens = itensRaw.map(normalizarItem).filter((x): x is PedidoCompraItem => x !== null)
    const atualizadoEmIso =
      typeof (parsed as any)?.atualizadoEmIso === 'string' ? (parsed as any).atualizadoEmIso : new Date().toISOString()
    const p = gerarPedidoPadrao(itens)
    p.atualizadoEmIso = atualizadoEmIso
    return p
  } catch {
    return null
  }
}

export function loadPedidosCompraState(): PedidoCompraState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STATE)
    if (!raw) {
      const legacy = carregarLegacyComoPedido()
      const base = legacy ?? gerarPedidoPadrao([])
      const state: PedidoCompraState = { ativoId: base.id, pedidos: [base] }
      localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state))
      // não remove legado para não surpreender em downgrade; só deixa de usar.
      return state
    }
    const parsed = JSON.parse(raw) as PedidoCompraState
    const pedidosRaw: unknown[] = Array.isArray((parsed as any)?.pedidos) ? (parsed as any).pedidos : []
    const pedidos = pedidosRaw.map(normalizarPedido).filter((x): x is PedidoCompra => x !== null)
    let ativoId = typeof (parsed as any)?.ativoId === 'string' ? (parsed as any).ativoId : ''
    if (!pedidos.length) {
      const base = gerarPedidoPadrao([])
      return { ativoId: base.id, pedidos: [base] }
    }
    if (!ativoId || !pedidos.some((p) => p.id === ativoId)) ativoId = pedidos[0].id
    return { ativoId, pedidos }
  } catch {
    const base = gerarPedidoPadrao([])
    return { ativoId: base.id, pedidos: [base] }
  }
}

function saveState(state: PedidoCompraState): void {
  localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent('pc:pedido-compra-changed'))
}

export function obterPedidoAtivo(state: PedidoCompraState): PedidoCompra {
  return state.pedidos.find((p) => p.id === state.ativoId) ?? state.pedidos[0]
}

export function setPedidoCompraAtivo(pedidoId: string): void {
  const s = loadPedidosCompraState()
  if (!s.pedidos.some((p) => p.id === pedidoId)) return
  saveState({ ...s, ativoId: pedidoId })
}

export function criarNovoPedidoCompra(nome?: string): PedidoCompra {
  const s = loadPedidosCompraState()
  const n = (nome ?? '').trim()
  const proximoNumero = s.pedidos.length + 1
  const pedido: PedidoCompra = {
    id: crypto.randomUUID(),
    nome: n || `Pedido ${proximoNumero}`,
    criadoEmIso: new Date().toISOString(),
    atualizadoEmIso: new Date().toISOString(),
    itens: [],
  }
  saveState({ ativoId: pedido.id, pedidos: [pedido, ...s.pedidos] })
  return pedido
}

export function renomearPedidoCompra(pedidoId: string, nome: string): void {
  const n = (nome ?? '').trim()
  if (!n) return
  const s = loadPedidosCompraState()
  const pedidos = s.pedidos.map((p) => (p.id === pedidoId ? { ...p, nome: n } : p))
  saveState({ ...s, pedidos })
}

export function excluirPedidoCompra(pedidoId: string): void {
  const s = loadPedidosCompraState()
  const pedidos = s.pedidos.filter((p) => p.id !== pedidoId)
  if (!pedidos.length) {
    const base = gerarPedidoPadrao([])
    saveState({ ativoId: base.id, pedidos: [base] })
    return
  }
  const ativoId = s.ativoId === pedidoId ? pedidos[0].id : s.ativoId
  saveState({ ativoId, pedidos })
}

export function saveItensNoPedidoAtivo(itens: PedidoCompraItem[]): void {
  const s = loadPedidosCompraState()
  const agora = new Date().toISOString()
  const pedidos = s.pedidos.map((p) => (p.id === s.ativoId ? { ...p, itens, atualizadoEmIso: agora } : p))
  saveState({ ...s, pedidos })
}

export function limparPedidoCompraAtivo(): void {
  const s = loadPedidosCompraState()
  const pedidos = s.pedidos.map((p) => (p.id === s.ativoId ? { ...p, itens: [], atualizadoEmIso: new Date().toISOString() } : p))
  saveState({ ...s, pedidos })
}

