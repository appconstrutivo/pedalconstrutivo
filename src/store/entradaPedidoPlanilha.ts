import type { RegistroEntradaPedidoPlanilha } from '../types'

const STORAGE_KEY = 'pedal-construtivo-entradas-pedido-planilha'

export function loadRegistrosEntradaPedido(): RegistroEntradaPedidoPlanilha[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter((r): r is RegistroEntradaPedidoPlanilha => {
      if (!r || typeof r !== 'object') return false
      const o = r as RegistroEntradaPedidoPlanilha
      return typeof o.id === 'string' && typeof o.emitidoEmIso === 'string' && Array.isArray(o.itens)
    })
  } catch {
    return []
  }
}

function save(lista: RegistroEntradaPedidoPlanilha[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
}

export function appendRegistroEntradaPedido(
  draft: Omit<RegistroEntradaPedidoPlanilha, 'id'>,
): RegistroEntradaPedidoPlanilha {
  const reg: RegistroEntradaPedidoPlanilha = {
    ...draft,
    id: crypto.randomUUID(),
  }
  save([...loadRegistrosEntradaPedido(), reg])
  return reg
}
