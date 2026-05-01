import type { RegistroEntradaPedidoPlanilha } from '../types'

/** Somente memória da sessão — persistência no Supabase depende de tabela dedicada (ainda não há). */
let entradasPedidoPlanilhaCache: RegistroEntradaPedidoPlanilha[] = []

export function loadRegistrosEntradaPedido(): RegistroEntradaPedidoPlanilha[] {
  return entradasPedidoPlanilhaCache
}

function save(lista: RegistroEntradaPedidoPlanilha[]): void {
  entradasPedidoPlanilhaCache = lista
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
