import type { AberturaTurnoCaixa, DadosPagamentoVenda, FechamentoTurnoCaixa } from '../types'
import { round2 } from '../utils/moeda'
import { upsertTurnoCaixa as sbUpsertTurnoCaixa } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo.turno-caixa-dia'
const ACUM_KEY = 'pedal-construtivo.turno-vendas-acumulado'
const PROXIMO_CAIXA_KEY = 'pedal-construtivo.proximo-caixa-sugerido'
const ULTIMO_FECHAMENTO_KEY = 'pedal-construtivo.ultimo-fechamento-turno'
const HISTORICO_TURNOS_KEY = 'pedal-construtivo.turnos-caixa-historico'

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

export function loadHistoricoTurnosCaixa(): TurnoCaixaHistoricoRow[] {
  try {
    const raw = localStorage.getItem(HISTORICO_TURNOS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((x): x is TurnoCaixaHistoricoRow => {
        if (!x || typeof x !== 'object') return false
        const r = x as Record<string, unknown>
        return typeof r.dataReferencia === 'string' && typeof r.abertoEmIso === 'string'
      })
      .map((r) => {
        const o = r as unknown as TurnoCaixaHistoricoRow
        return {
          dataReferencia: o.dataReferencia,
          abertoEmIso: o.abertoEmIso,
          fechadoEmIso: typeof o.fechadoEmIso === 'string' ? o.fechadoEmIso : null,
          saldoAbertura: round2(Number(o.saldoAbertura) || 0),
          dinheiro: round2(Number(o.dinheiro) || 0),
          pix: round2(Number(o.pix) || 0),
          cartao: round2(Number(o.cartao) || 0),
          boleto: round2(Number(o.boleto) || 0),
          totalVendas: round2(Number(o.totalVendas) || 0),
          proximoCaixa: round2(Number(o.proximoCaixa) || 0),
          operador: typeof o.operador === 'string' && o.operador ? o.operador : 'Administrador',
        }
      })
  } catch {
    return []
  }
}

function saveHistoricoTurnosCaixa(rows: TurnoCaixaHistoricoRow[]): void {
  localStorage.setItem(HISTORICO_TURNOS_KEY, JSON.stringify(rows))
}

function upsertHistoricoTurno(row: TurnoCaixaHistoricoRow): void {
  const lista = loadHistoricoTurnosCaixa()
  const idx = lista.findIndex((x) => x.dataReferencia === row.dataReferencia)
  const next = [...lista]
  if (idx >= 0) next[idx] = row
  else next.push(row)
  // Mantém ordenado por data para facilitar depuração.
  next.sort((a, b) => a.dataReferencia.localeCompare(b.dataReferencia))
  saveHistoricoTurnosCaixa(next)
}

function loadAcumulado(): AcumuladoVendasTurno | null {
  try {
    const raw = localStorage.getItem(ACUM_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as AcumuladoVendasTurno
    if (!j.dataReferencia) return null
    return {
      dataReferencia: j.dataReferencia,
      dinheiro: round2(Number(j.dinheiro) || 0),
      pix: round2(Number(j.pix) || 0),
      cartao: round2(Number(j.cartao) || 0),
      boleto: round2(Number(j.boleto) || 0),
    }
  } catch {
    return null
  }
}

function saveAcumulado(a: AcumuladoVendasTurno): void {
  localStorage.setItem(ACUM_KEY, JSON.stringify(a))
}

function limparAcumulado(): void {
  localStorage.removeItem(ACUM_KEY)
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
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const j = JSON.parse(raw) as AberturaTurnoCaixa
    if (!j.dataReferencia || j.dataReferencia !== dataLocalHoje()) return null
    if (typeof j.saldoAbertura !== 'number' || !j.abertoEmIso) return null
    return j
  } catch {
    return null
  }
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
}

/** Persiste abertura com data/hora atual e saldo informado. */
export function registrarAberturaTurno(saldoAbertura: number): AberturaTurnoCaixa {
  const reg: AberturaTurnoCaixa = {
    dataReferencia: dataLocalHoje(),
    abertoEmIso: new Date().toISOString(),
    saldoAbertura: Math.max(0, saldoAbertura),
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reg))
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
  try {
    const raw = localStorage.getItem(PROXIMO_CAIXA_KEY)
    if (raw === null || raw === '') return null
    const n = Number(raw.replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return null
    return round2(n)
  } catch {
    return null
  }
}

function salvarProximoCaixaParaProximaAbertura(valor: number): void {
  localStorage.setItem(PROXIMO_CAIXA_KEY, String(round2(Math.max(0, valor))))
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

  localStorage.setItem(ULTIMO_FECHAMENTO_KEY, JSON.stringify(reg))
  salvarProximoCaixaParaProximaAbertura(prox)
  localStorage.removeItem(STORAGE_KEY)
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
  try {
    const raw = localStorage.getItem(ULTIMO_FECHAMENTO_KEY)
    if (!raw) return null
    return JSON.parse(raw) as FechamentoTurnoCaixa
  } catch {
    return null
  }
}
