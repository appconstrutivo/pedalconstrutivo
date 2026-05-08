import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import { limitesUtcIntervaloDatasLocais } from '../utils/datasLocal'
import type { RegistroMovimentacao, RegistroOrcamentoHistorico, RegistroVendaHistorico } from '../types'

type PcMovRow = {
  id: string
  kind: 'venda' | 'orcamento'
  emitido_em: string
  numero_documento: string
  cliente_id: string | null
  cliente_nome: string | null
  vendedor_nome: string | null
  observacoes: string | null
  cancelamento: unknown | null
  total: number | null
  pagamento: unknown | null
}

type PcMovItemRow = {
  movimentacao_id: string
  produto_id: string
  descricao: string
  codigo_barras: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  valor_custo_unitario: number
  tipo_produto_id: string | null
  desconto_percentual?: number | null
}

function enabled(): boolean {
  return DATA_MODE === 'supabase' && supabase !== null
}

function mapRegistro(m: PcMovRow, itens: PcMovItemRow[]): RegistroMovimentacao {
  const itensMapped = itens.map((i) => {
    const dpct = i.desconto_percentual
    const descontoPercentual =
      dpct !== undefined && dpct !== null && Number.isFinite(Number(dpct))
        ? Math.min(100, Math.max(0, Number(dpct)))
        : undefined
    const base = {
      produtoId: i.produto_id,
      descricao: i.descricao ?? '',
      codigoBarras: i.codigo_barras ?? '',
      quantidade: Number(i.quantidade) || 0,
      precoUnitario: Number(i.preco_unitario) || 0,
      subtotal: Number(i.subtotal) || 0,
      valorCustoUnitario: Number(i.valor_custo_unitario) || 0,
      tipoProdutoId: i.tipo_produto_id ?? '',
    }
    return descontoPercentual !== undefined ? { ...base, descontoPercentual } : base
  })

  const base = {
    id: m.id,
    emitidoEmIso: m.emitido_em,
    numeroDocumento: m.numero_documento ?? '',
    clienteId: m.cliente_id ?? null,
    clienteNome: m.cliente_nome ?? null,
    vendedorNome: m.vendedor_nome ?? 'Administrador',
    observacoes: m.observacoes ?? undefined,
    itens: itensMapped,
  }

  if (m.kind === 'orcamento') {
    const reg: RegistroOrcamentoHistorico = {
      kind: 'orcamento',
      ...base,
      total: Number(m.total) || 0,
    }
    return reg
  }

  const reg: RegistroVendaHistorico = {
    kind: 'venda',
    ...base,
    pagamento: (m.pagamento ?? {}) as RegistroVendaHistorico['pagamento'],
    cancelamento: (m.cancelamento ?? undefined) as RegistroVendaHistorico['cancelamento'],
  }
  return reg
}

export async function fetchRegistrosMovimentacaoFromSupabase(p: {
  dataInicioYYYYMMDD: string
  dataFimYYYYMMDD: string
}): Promise<RegistroMovimentacao[]> {
  if (!enabled()) return []

  const sb = supabase!

  // Intervalo inclusivo por dia no calendário local do operador (evita perder vendas perto da meia-noite).
  const { ini, fim } = limitesUtcIntervaloDatasLocais(p.dataInicioYYYYMMDD, p.dataFimYYYYMMDD)

  const movRes = await sb
    .from('pc_movimentacoes')
    .select('*')
    .gte('emitido_em', ini)
    .lte('emitido_em', fim)
    .order('emitido_em', { ascending: true })

  if (movRes.error) throw movRes.error
  const movs = (movRes.data ?? []) as PcMovRow[]
  if (movs.length === 0) return []

  const ids = movs.map((m) => m.id)
  const itensRes = await sb.from('pc_movimentacao_itens').select('*').in('movimentacao_id', ids)
  if (itensRes.error) throw itensRes.error

  const itensAll = (itensRes.data ?? []) as PcMovItemRow[]
  const byMov = new Map<string, PcMovItemRow[]>()
  for (const it of itensAll) {
    const arr = byMov.get(it.movimentacao_id) ?? []
    arr.push(it)
    byMov.set(it.movimentacao_id, arr)
  }

  return movs.map((m) => mapRegistro(m, byMov.get(m.id) ?? []))
}

export async function fetchVendaPorDocumentoFromSupabase(numeroDocumento: string): Promise<RegistroVendaHistorico | null> {
  if (!enabled()) return null
  const numero = (numeroDocumento ?? '').trim()
  if (!numero) return null

  const sb = supabase!
  const movRes = await sb
    .from('pc_movimentacoes')
    .select('*')
    .eq('numero_documento', numero)
    .eq('kind', 'venda')
    .limit(1)
    .maybeSingle()

  if (movRes.error) throw movRes.error
  const mov = (movRes.data ?? null) as PcMovRow | null
  if (!mov) return null

  const itensRes = await sb.from('pc_movimentacao_itens').select('*').eq('movimentacao_id', mov.id)
  if (itensRes.error) throw itensRes.error

  const reg = mapRegistro(mov, ((itensRes.data ?? []) as PcMovItemRow[]) ?? [])
  if (reg.kind !== 'venda') return null
  if (reg.cancelamento?.canceladoEmIso) return null
  return reg
}

const MOV_PAGE = 800

/** Lista todas as movimentações (vendas/orçamentos) paginando pelo Supabase. */
export async function fetchTodasMovimentacoesSupabase(): Promise<RegistroMovimentacao[]> {
  if (!enabled()) return []

  const sb = supabase!
  const movs: PcMovRow[] = []
  let offset = 0
  while (true) {
    const movRes = await sb
      .from('pc_movimentacoes')
      .select('*')
      .order('emitido_em', { ascending: false })
      .range(offset, offset + MOV_PAGE - 1)
    if (movRes.error) throw movRes.error
    const chunk = (movRes.data ?? []) as PcMovRow[]
    movs.push(...chunk)
    if (chunk.length < MOV_PAGE) break
    offset += MOV_PAGE
  }

  if (movs.length === 0) return []

  const byMov = new Map<string, PcMovItemRow[]>()
  const ids = movs.map((m) => m.id)
  for (let i = 0; i < ids.length; i += MOV_PAGE) {
    const slice = ids.slice(i, i + MOV_PAGE)
    const itensRes = await sb.from('pc_movimentacao_itens').select('*').in('movimentacao_id', slice)
    if (itensRes.error) throw itensRes.error
    for (const it of (itensRes.data ?? []) as PcMovItemRow[]) {
      const arr = byMov.get(it.movimentacao_id) ?? []
      arr.push(it)
      byMov.set(it.movimentacao_id, arr)
    }
  }

  return movs.map((m) => mapRegistro(m, byMov.get(m.id) ?? []))
}

