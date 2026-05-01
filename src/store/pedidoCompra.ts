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

/** Estado só na sessão — não há tabela Supabase para pedidos de compra (planejar migração futura). */
let pedidoCompraStateCache: PedidoCompraState | null = null

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

function estadoInicialPedidosCompra(): PedidoCompraState {
  const base = gerarPedidoPadrao([])
  return { ativoId: base.id, pedidos: [base] }
}

export function loadPedidosCompraState(): PedidoCompraState {
  if (!pedidoCompraStateCache) pedidoCompraStateCache = estadoInicialPedidosCompra()
  const s = pedidoCompraStateCache
  if (!s.pedidos.length) {
    pedidoCompraStateCache = estadoInicialPedidosCompra()
    return pedidoCompraStateCache
  }
  let ativoId = s.ativoId
  if (!ativoId || !s.pedidos.some((p) => p.id === ativoId)) ativoId = s.pedidos[0].id
  if (ativoId !== s.ativoId) pedidoCompraStateCache = { ...s, ativoId }
  return pedidoCompraStateCache
}

function saveState(state: PedidoCompraState): void {
  pedidoCompraStateCache = state
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

