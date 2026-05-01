import type { RegistroMovimentacao, RegistroOrcamentoHistorico, RegistroVendaHistorico } from '../types'
import { round2 } from './moeda'

export type ModoRelatorio = 'finalizadas' | 'aberto' | 'lucratividade'
export type DetalheRelatorio = 'venda' | 'item'
export type PresetIntervalo = 'semana' | 'mes' | 'ano' | 'outro'

export type ListagemItensPor = 'valor_vendido' | 'quantidade' | 'valor_custo' | 'margem'

export interface ParametrosRelatorioVendas {
  modo: ModoRelatorio
  detalhe: DetalheRelatorio
  dataInicio: string
  dataFim: string
  openListaVendasSalvas: boolean
  openListaOrcamentos: boolean
  filtroCliente: { ativo: boolean; clienteId: string }
  filtroVendedor: { ativo: boolean; vendedorNome: string }
  filtroProduto: { ativo: boolean; produtoId: string }
  filtroTipo: { ativo: boolean; tipoId: string }
  agruparPorDia: boolean
  agruparPorCliente: boolean
  agruparPorProduto: boolean
  agruparPorFormaPagamento: boolean
  listarItensPor: ListagemItensPor
}

export interface LinhaRelatorioVendas {
  chaveAgrupamento: string
  data: string
  documento: string
  cliente: string
  vendedor: string
  descricao: string
  quantidade: number
  unitario: number
  total: number
  custoTotal: number
  lucro: number
  formasPagamento: string
}

function isoDia(iso: string): string {
  return iso.slice(0, 10)
}

function entreDatas(iso: string, ini: string, fim: string): boolean {
  const d = isoDia(iso)
  return d >= ini && d <= fim
}

function resumoPagamento(v: RegistroVendaHistorico): string {
  const p = v.pagamento
  const partes: string[] = []
  if (p.dinheiro > 0) partes.push(`Din ${p.dinheiro.toFixed(2)}`)
  if (p.pix > 0) partes.push(`Pix ${p.pix.toFixed(2)}`)
  if (p.cartao > 0) partes.push(`Cartão ${p.cartao.toFixed(2)}`)
  if (p.boleto > 0) partes.push(`Boleto ${p.boleto.toFixed(2)}`)
  return partes.join(' · ') || '—'
}

function passaFiltros(
  r: RegistroMovimentacao,
  p: ParametrosRelatorioVendas,
): boolean {
  if (!entreDatas(r.emitidoEmIso, p.dataInicio, p.dataFim)) return false
  if (p.filtroCliente.ativo && p.filtroCliente.clienteId) {
    if (r.clienteId !== p.filtroCliente.clienteId) return false
  }
  if (p.filtroVendedor.ativo && p.filtroVendedor.vendedorNome) {
    if (r.vendedorNome !== p.filtroVendedor.vendedorNome) return false
  }
  if (r.kind === 'venda') {
    if (p.filtroProduto.ativo && p.filtroProduto.produtoId) {
      if (!r.itens.some((i) => i.produtoId === p.filtroProduto.produtoId)) return false
    }
    if (p.filtroTipo.ativo && p.filtroTipo.tipoId) {
      if (!r.itens.some((i) => i.tipoProdutoId === p.filtroTipo.tipoId)) return false
    }
  } else {
    if (p.filtroProduto.ativo && p.filtroProduto.produtoId) {
      if (!r.itens.some((i) => i.produtoId === p.filtroProduto.produtoId)) return false
    }
    if (p.filtroTipo.ativo && p.filtroTipo.tipoId) {
      if (!r.itens.some((i) => i.tipoProdutoId === p.filtroTipo.tipoId)) return false
    }
  }
  return true
}

/** Filtra registros conforme modo (finalizadas / aberto / lucratividade). */
export function filtrarRegistros(
  todos: RegistroMovimentacao[],
  p: ParametrosRelatorioVendas,
): RegistroMovimentacao[] {
  return todos.filter((r) => {
    if (!passaFiltros(r, p)) return false
    if (p.modo === 'finalizadas' || p.modo === 'lucratividade') {
      return r.kind === 'venda' && !r.cancelamento?.canceladoEmIso
    }
    if (p.modo === 'aberto') {
      if (r.kind === 'orcamento') return p.openListaOrcamentos
      return false
    }
    return false
  })
}

/** Expande registros em linhas detalhadas (por venda ou por item). */
export function montarLinhasRelatorio(
  registros: RegistroMovimentacao[],
  p: ParametrosRelatorioVendas,
): LinhaRelatorioVendas[] {
  const linhas: LinhaRelatorioVendas[] = []

  for (const r of registros) {
    const data = isoDia(r.emitidoEmIso)
    const cliente = r.clienteNome ?? '—'
    const doc = r.numeroDocumento

    if (r.kind === 'venda') {
      if (p.detalhe === 'venda') {
        const total = r.pagamento.totalAPagar
        const custoItens = r.itens.reduce(
          (s, i) => s + i.valorCustoUnitario * i.quantidade,
          0,
        )
        const custoTotal = round2(custoItens)
        const lucro = round2(total - custoTotal)
        linhas.push({
          chaveAgrupamento: montarChaveAgrupamento(r, data, cliente, p),
          data,
          documento: doc,
          cliente,
          vendedor: r.vendedorNome,
          descricao: p.modo === 'lucratividade' ? 'Total da venda' : 'Venda (consolidado)',
          quantidade: 1,
          unitario: total,
          total,
          custoTotal,
          lucro,
          formasPagamento: resumoPagamento(r),
        })
      } else {
        for (const it of r.itens) {
          const totalLinha = it.subtotal
          const custoLinha = round2(it.valorCustoUnitario * it.quantidade)
          const lucroLinha = round2(totalLinha - custoLinha)
          linhas.push({
            chaveAgrupamento: montarChaveItem(it.descricao, it.produtoId, data, cliente, p, r),
            data,
            documento: doc,
            cliente,
            vendedor: r.vendedorNome,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unitario: it.precoUnitario,
            total: totalLinha,
            custoTotal: custoLinha,
            lucro: p.modo === 'lucratividade' ? lucroLinha : lucroLinha,
            formasPagamento: resumoPagamento(r),
          })
        }
      }
    } else {
      const o = r as RegistroOrcamentoHistorico
      if (p.detalhe === 'venda') {
        linhas.push({
          chaveAgrupamento: montarChaveAgrupamento(o, data, cliente, p),
          data,
          documento: doc,
          cliente,
          vendedor: o.vendedorNome,
          descricao: 'Orçamento (consolidado)',
          quantidade: 1,
          unitario: o.total,
          total: o.total,
          custoTotal: 0,
          lucro: 0,
          formasPagamento: '—',
        })
      } else {
        for (const it of o.itens) {
          linhas.push({
            chaveAgrupamento: montarChaveItem(it.descricao, it.produtoId, data, cliente, p, o),
            data,
            documento: doc,
            cliente,
            vendedor: o.vendedorNome,
            descricao: it.descricao,
            quantidade: it.quantidade,
            unitario: it.precoUnitario,
            total: it.subtotal,
            custoTotal: round2(it.valorCustoUnitario * it.quantidade),
            lucro: 0,
            formasPagamento: '—',
          })
        }
      }
    }
  }

  ordenarLinhas(linhas, p)
  return linhas
}

function montarChaveAgrupamento(
  r: RegistroVendaHistorico | RegistroOrcamentoHistorico,
  data: string,
  cliente: string,
  p: ParametrosRelatorioVendas,
): string {
  const parts: string[] = []
  if (p.agruparPorDia) parts.push(data)
  if (p.agruparPorCliente) parts.push(cliente)
  if (p.agruparPorFormaPagamento && r.kind === 'venda') parts.push(resumoPagamento(r))
  return parts.length ? parts.join('|') : 'todos'
}

function montarChaveItem(
  desc: string,
  produtoId: string,
  data: string,
  cliente: string,
  p: ParametrosRelatorioVendas,
  r: RegistroMovimentacao,
): string {
  const parts: string[] = []
  if (p.agruparPorDia) parts.push(data)
  if (p.agruparPorCliente) parts.push(cliente)
  if (p.agruparPorProduto) parts.push(produtoId || desc)
  if (p.agruparPorFormaPagamento && r.kind === 'venda') parts.push(resumoPagamento(r as RegistroVendaHistorico))
  return parts.length ? parts.join('|') : 'todos'
}

function ordenarLinhas(linhas: LinhaRelatorioVendas[], p: ParametrosRelatorioVendas): void {
  linhas.sort((a, b) => {
    const dir = a.data.localeCompare(b.data)
    if (dir !== 0) return dir
    switch (p.listarItensPor) {
      case 'quantidade':
        return b.quantidade - a.quantidade
      case 'valor_custo':
        return b.custoTotal - a.custoTotal
      case 'margem':
        return b.lucro - a.lucro
      case 'valor_vendido':
      default:
        return b.total - a.total
    }
  })
}

export function totaisRelatorio(linhas: LinhaRelatorioVendas[]): {
  totalVendas: number
  totalCusto: number
  totalLucro: number
} {
  return {
    totalVendas: round2(linhas.reduce((s, l) => s + l.total, 0)),
    totalCusto: round2(linhas.reduce((s, l) => s + l.custoTotal, 0)),
    totalLucro: round2(linhas.reduce((s, l) => s + l.lucro, 0)),
  }
}

/** Ajusta intervalo de datas conforme preset (datas em YYYY-MM-DD). */
export function datasPorPreset(preset: PresetIntervalo): { inicio: string; fim: string } {
  const hoje = new Date()
  const y = hoje.getFullYear()
  const m = hoje.getMonth()
  const d = hoje.getDate()

  const fmt = (dt: Date) => dt.toISOString().slice(0, 10)

  if (preset === 'mes') {
    const ini = new Date(y, m, 1)
    const fim = new Date(y, m + 1, 0)
    return { inicio: fmt(ini), fim: fmt(fim) }
  }
  if (preset === 'ano') {
    const ini = new Date(y, 0, 1)
    const fim = new Date(y, 11, 31)
    return { inicio: fmt(ini), fim: fmt(fim) }
  }
  if (preset === 'semana') {
    const cur = new Date(y, m, d)
    const dow = cur.getDay()
    const diff = dow === 0 ? 6 : dow - 1
    const ini = new Date(cur)
    ini.setDate(cur.getDate() - diff)
    return { inicio: fmt(ini), fim: fmt(hoje) }
  }
  const ini = new Date(y, m, 1)
  const fim = new Date(y, m + 1, 0)
  return { inicio: fmt(ini), fim: fmt(fim) }
}
