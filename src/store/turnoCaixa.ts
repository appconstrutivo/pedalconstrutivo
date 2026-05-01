import type { AberturaTurnoCaixa, DadosPagamentoVenda, FechamentoTurnoCaixa } from '../types'
import { round2 } from '../utils/moeda'
import { upsertTurnoCaixa as sbUpsertTurnoCaixa } from '../supabase/pcApi'

/** Linha `pc_turnos_caixa` — usada na hidratação. */
export type TurnoCaixaSbRow = {
  data_referencia: string
  aberto_em: string
  fechado_em: string | null
  saldo_abertura: number
  dinheiro: number
  pix: number
  cartao: number
  boleto: number
  total_vendas: number
  proximo_caixa: number
  operador: string | null
}

let historicoTurnosCache: TurnoCaixaHistoricoRow[] = []
let aberturaTurnoCache: AberturaTurnoCaixa | null = null
let acumuladoCache: AcumuladoVendasTurno | null = null
let ultimoFechamentoCache: FechamentoTurnoCaixa | null = null
let proximoCaixaSugeridoCache: number | null = null

/** Data local no formato YYYY-MM-DD (fuso do navegador). */
export function dataLocalHoje(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface AcumuladoVendasTurno {
  dataReferencia: string
  dinheiro: number
  pix: number
  cartao: number
  boleto: number
}

export type TurnoCaixaHistoricoRow = {
  dataReferencia: string
  abertoEmIso: string
  fechadoEmIso: string | null
  saldoAbertura: number
  dinheiro: number
  pix: number
  cartao: number
  boleto: number
  totalVendas: number
  proximoCaixa: number
  operador: string
}

function mapSbRowToHistorico(r: TurnoCaixaSbRow): TurnoCaixaHistoricoRow {
  return {
    dataReferencia: r.data_referencia,
    abertoEmIso: r.aberto_em,
    fechadoEmIso: r.fechado_em,
    saldoAbertura: round2(Number(r.saldo_abertura) || 0),
    dinheiro: round2(Number(r.dinheiro) || 0),
    pix: round2(Number(r.pix) || 0),
    cartao: round2(Number(r.cartao) || 0),
    boleto: round2(Number(r.boleto) || 0),
    totalVendas: round2(Number(r.total_vendas) || 0),
    proximoCaixa: round2(Number(r.proximo_caixa) || 0),
    operador: typeof r.operador === 'string' && r.operador ? r.operador : 'Administrador',
  }
}

function mapSbRowToFechamento(r: TurnoCaixaSbRow): FechamentoTurnoCaixa {
  const h = mapSbRowToHistorico(r)
  return {
    dataReferencia: h.dataReferencia,
    abertoEmIso: h.abertoEmIso,
    fechadoEmIso: h.fechadoEmIso ?? new Date().toISOString(),
    saldoAbertura: h.saldoAbertura,
    dinheiro: h.dinheiro,
    pix: h.pix,
    cartao: h.cartao,
    boleto: h.boleto,
    totalVendas: h.totalVendas,
    proximoCaixa: h.proximoCaixa,
    operador: h.operador,
  }
}

/** Reconstrói o estado do caixa a partir do Supabase. */
export function aplicarHidratacaoTurnosCaixa(rowsSb: TurnoCaixaSbRow[]): void {
  historicoTurnosCache = rowsSb.map(mapSbRowToHistorico).sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))

  const hoje = dataLocalHoje()
  const todayRow = rowsSb.find((r) => r.data_referencia === hoje)

  if (todayRow && !todayRow.fechado_em) {
    aberturaTurnoCache = {
      dataReferencia: hoje,
      abertoEmIso: todayRow.aberto_em,
      saldoAbertura: round2(Number(todayRow.saldo_abertura) || 0),
    }
    acumuladoCache = {
      dataReferencia: hoje,
      dinheiro: round2(Number(todayRow.dinheiro) || 0),
      pix: round2(Number(todayRow.pix) || 0),
      cartao: round2(Number(todayRow.cartao) || 0),
      boleto: round2(Number(todayRow.boleto) || 0),
    }
  } else {
    aberturaTurnoCache = null
    acumuladoCache = null
  }

  const fechadas = rowsSb
    .filter((r) => r.fechado_em)
    .sort((a, b) => String(b.fechado_em!).localeCompare(String(a.fechado_em!)))
  if (fechadas.length) {
    const r = fechadas[0]
    ultimoFechamentoCache = mapSbRowToFechamento(r)
    proximoCaixaSugeridoCache = round2(Number(r.proximo_caixa) || 0)
  } else {
    ultimoFechamentoCache = null
    proximoCaixaSugeridoCache = null
  }

  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'turno-caixa' } }))
}

export function loadHistoricoTurnosCaixa(): TurnoCaixaHistoricoRow[] {
  return [...historicoTurnosCache].sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
}

function saveHistoricoTurnosCaixa(rows: TurnoCaixaHistoricoRow[]): void {
  historicoTurnosCache = [...rows].sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
}

function upsertHistoricoTurno(row: TurnoCaixaHistoricoRow): void {
  const lista = loadHistoricoTurnosCaixa()
  const idx = lista.findIndex((x) => x.dataReferencia === row.dataReferencia)
  const next = [...lista]
  if (idx >= 0) next[idx] = row
  else next.push(row)
  next.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
  saveHistoricoTurnosCaixa(next)
}

function loadAcumulado(): AcumuladoVendasTurno | null {
  return acumuladoCache
}

function saveAcumulado(a: AcumuladoVendasTurno): void {
  acumuladoCache = { ...a }
}

function limparAcumulado(): void {
  acumuladoCache = null
}

/** Mantém `pc_turnos_caixa` alinhado ao acúmulo do turno aberto (várias estações / reload). */
function persistirTurnoAbertoRemoto(): void {
  const ab = obterAberturaTurnoHoje()
  if (!ab) return
  const acum =
    loadAcumulado() ??
    ({
      dataReferencia: ab.dataReferencia,
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      boleto: 0,
    } satisfies AcumuladoVendasTurno)
  const histRow = historicoTurnosCache.find((x) => x.dataReferencia === ab.dataReferencia)
  const totalVendas = round2(acum.dinheiro + acum.pix + acum.cartao + acum.boleto)
  void sbUpsertTurnoCaixa({
    dataReferencia: ab.dataReferencia,
    abertoEmIso: ab.abertoEmIso,
    saldoAbertura: ab.saldoAbertura,
    fechadoEmIso: histRow?.fechadoEmIso ?? null,
    dinheiro: acum.dinheiro,
    pix: acum.pix,
    cartao: acum.cartao,
    boleto: acum.boleto,
    totalVendas,
    proximoCaixa: histRow?.proximoCaixa ?? 0,
    operador: histRow?.operador ?? 'Administrador',
  })
}

/** Zera acúmulo para o dia (chamado na abertura de turno). */
export function resetAcumuladoVendasTurno(dataReferencia: string): void {
  saveAcumulado({
    dataReferencia,
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    boleto: 0,
  })
}

export function obterAberturaTurnoHoje(): AberturaTurnoCaixa | null {
  if (!aberturaTurnoCache || aberturaTurnoCache.dataReferencia !== dataLocalHoje()) return null
  if (typeof aberturaTurnoCache.saldoAbertura !== 'number' || !aberturaTurnoCache.abertoEmIso) return null
  return aberturaTurnoCache
}

export function turnoJaAbertoNoDiaCorrente(): boolean {
  return obterAberturaTurnoHoje() !== null
}

/** Acúmulo do turno atual (mesma data da abertura). */
export function obterAcumuladoTurno(): AcumuladoVendasTurno | null {
  const ab = obterAberturaTurnoHoje()
  if (!ab) return null
  const cur = loadAcumulado()
  if (!cur || cur.dataReferencia !== ab.dataReferencia) {
    resetAcumuladoVendasTurno(ab.dataReferencia)
    return loadAcumulado()
  }
  return cur
}

/** Soma vendas no turno aberto a partir do pagamento confirmado no PDV. */
export function acumularVendaNoTurnoAtual(d: DadosPagamentoVenda): void {
  const ab = obterAberturaTurnoHoje()
  if (!ab) return
  let cur = loadAcumulado()
  if (!cur || cur.dataReferencia !== ab.dataReferencia) {
    cur = {
      dataReferencia: ab.dataReferencia,
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      boleto: 0,
    }
  }
  cur.dinheiro = round2(cur.dinheiro + d.dinheiro)
  cur.pix = round2(cur.pix + d.pix)
  cur.cartao = round2(cur.cartao + d.cartao)
  cur.boleto = round2(cur.boleto + d.boleto)
  saveAcumulado(cur)
  persistirTurnoAbertoRemoto()
}

/**
 * Remove uma venda do acumulado do turno atual (ex.: ajuste/estorno administrativo).
 * Não permite valores negativos (faz clamp em 0).
 */
export function removerVendaDoTurnoAtual(d: Pick<DadosPagamentoVenda, 'dinheiro' | 'pix' | 'cartao' | 'boleto'>): void {
  const ab = obterAberturaTurnoHoje()
  if (!ab) return
  const cur = loadAcumulado()
  if (!cur || cur.dataReferencia !== ab.dataReferencia) return

  cur.dinheiro = round2(Math.max(0, cur.dinheiro - (Number(d.dinheiro) || 0)))
  cur.pix = round2(Math.max(0, cur.pix - (Number(d.pix) || 0)))
  cur.cartao = round2(Math.max(0, cur.cartao - (Number(d.cartao) || 0)))
  cur.boleto = round2(Math.max(0, cur.boleto - (Number(d.boleto) || 0)))
  saveAcumulado(cur)
  persistirTurnoAbertoRemoto()
}

/** Persiste abertura com data/hora atual e saldo informado. */
export function registrarAberturaTurno(saldoAbertura: number): AberturaTurnoCaixa {
  const reg: AberturaTurnoCaixa = {
    dataReferencia: dataLocalHoje(),
    abertoEmIso: new Date().toISOString(),
    saldoAbertura: Math.max(0, saldoAbertura),
  }
  aberturaTurnoCache = reg
  resetAcumuladoVendasTurno(reg.dataReferencia)

  upsertHistoricoTurno({
    dataReferencia: reg.dataReferencia,
    abertoEmIso: reg.abertoEmIso,
    fechadoEmIso: null,
    saldoAbertura: reg.saldoAbertura,
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    boleto: 0,
    totalVendas: 0,
    proximoCaixa: 0,
    operador: 'Administrador',
  })

  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'turno-caixa' } }))
  void sbUpsertTurnoCaixa({
    dataReferencia: reg.dataReferencia,
    abertoEmIso: reg.abertoEmIso,
    saldoAbertura: reg.saldoAbertura,
    operador: 'Administrador',
  })
  return reg
}

/** Valor sugerido na próxima abertura (definido no último fechamento). */
export function obterSaldoProximoCaixaSugerido(): number | null {
  if (proximoCaixaSugeridoCache === null) return null
  const n = proximoCaixaSugeridoCache
  if (!Number.isFinite(n) || n < 0) return null
  return round2(n)
}

function salvarProximoCaixaParaProximaAbertura(valor: number): void {
  proximoCaixaSugeridoCache = round2(Math.max(0, valor))
}

/** Registra fechamento, persiste próximo caixa, remove turno aberto e acúmulo. */
export function registrarFechamentoTurno(proximoCaixaDeclarado: number): FechamentoTurnoCaixa | null {
  const ab = obterAberturaTurnoHoje()
  if (!ab) return null
  const acum =
    obterAcumuladoTurno() ??
    ({
      dataReferencia: ab.dataReferencia,
      dinheiro: 0,
      pix: 0,
      cartao: 0,
      boleto: 0,
    } satisfies AcumuladoVendasTurno)

  const totalVendas = round2(acum.dinheiro + acum.pix + acum.cartao + acum.boleto)
  const prox = round2(Math.max(0, proximoCaixaDeclarado))

  const reg: FechamentoTurnoCaixa = {
    dataReferencia: ab.dataReferencia,
    abertoEmIso: ab.abertoEmIso,
    fechadoEmIso: new Date().toISOString(),
    saldoAbertura: ab.saldoAbertura,
    dinheiro: acum.dinheiro,
    pix: acum.pix,
    cartao: acum.cartao,
    boleto: acum.boleto,
    totalVendas,
    proximoCaixa: prox,
    operador: 'Administrador',
  }

  ultimoFechamentoCache = reg
  salvarProximoCaixaParaProximaAbertura(prox)
  aberturaTurnoCache = null
  limparAcumulado()

  upsertHistoricoTurno({
    dataReferencia: reg.dataReferencia,
    abertoEmIso: reg.abertoEmIso,
    fechadoEmIso: reg.fechadoEmIso,
    saldoAbertura: reg.saldoAbertura,
    dinheiro: reg.dinheiro,
    pix: reg.pix,
    cartao: reg.cartao,
    boleto: reg.boleto,
    totalVendas: reg.totalVendas,
    proximoCaixa: reg.proximoCaixa,
    operador: reg.operador,
  })

  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'turno-caixa' } }))
  void sbUpsertTurnoCaixa({
    dataReferencia: reg.dataReferencia,
    abertoEmIso: reg.abertoEmIso,
    saldoAbertura: reg.saldoAbertura,
    fechadoEmIso: reg.fechadoEmIso,
    dinheiro: reg.dinheiro,
    pix: reg.pix,
    cartao: reg.cartao,
    boleto: reg.boleto,
    totalVendas: reg.totalVendas,
    proximoCaixa: reg.proximoCaixa,
    operador: reg.operador,
  })
  return reg
}

export function obterUltimoFechamentoPersistido(): FechamentoTurnoCaixa | null {
  return ultimoFechamentoCache
}
