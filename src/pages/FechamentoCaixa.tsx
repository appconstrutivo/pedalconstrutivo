import { useMemo, useState } from 'react'
import { ResumoTurnoImpressao } from '../components/ResumoTurnoImpressao'
import type { FechamentoTurnoCaixa } from '../types'
import {
  obterAberturaTurnoHoje,
  obterAcumuladoTurno,
  registrarFechamentoTurno,
} from '../store/turnoCaixa'
import { formatarBrl, round2 } from '../utils/moeda'

type Props = {
  onVoltar: () => void
}

function montarPreviewFechamento(
  ab: NonNullable<ReturnType<typeof obterAberturaTurnoHoje>>,
  acum: NonNullable<ReturnType<typeof obterAcumuladoTurno>>,
  proximoCaixa: number,
  fechadoEmIso: string,
): FechamentoTurnoCaixa {
  const totalVendas = round2(acum.dinheiro + acum.pix + acum.cartao + acum.boleto)
  return {
    dataReferencia: ab.dataReferencia,
    abertoEmIso: ab.abertoEmIso,
    fechadoEmIso,
    saldoAbertura: ab.saldoAbertura,
    dinheiro: acum.dinheiro,
    pix: acum.pix,
    cartao: acum.cartao,
    boleto: acum.boleto,
    totalVendas,
    proximoCaixa: round2(Math.max(0, proximoCaixa)),
    operador: 'Administrador',
  }
}

export function FechamentoCaixa({ onVoltar }: Props) {
  const [proximoStr, setProximoStr] = useState('0')
  const [resultado, setResultado] = useState<FechamentoTurnoCaixa | null>(null)
  const [mostrarImpressao, setMostrarImpressao] = useState(false)
  const [dadosImpressao, setDadosImpressao] = useState<FechamentoTurnoCaixa | null>(null)

  const ab = obterAberturaTurnoHoje()
  const acum = obterAcumuladoTurno()

  const fechamentoPreview = useMemo(() => {
    if (!ab || !acum) return null
    const prox = Number(String(proximoStr).replace(',', '.'))
    const proximo = Number.isFinite(prox) ? round2(Math.max(0, prox)) : 0
    return montarPreviewFechamento(ab, acum, proximo, new Date().toISOString())
  }, [ab, acum, proximoStr])

  function abrirImpressao(dados: FechamentoTurnoCaixa) {
    setDadosImpressao(dados)
    setMostrarImpressao(true)
    requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
  }

  function handleFecharImpressaoOverlay() {
    setMostrarImpressao(false)
    setDadosImpressao(null)
  }

  function handleImprimir() {
    if (resultado) {
      abrirImpressao(resultado)
      return
    }
    if (fechamentoPreview) abrirImpressao(fechamentoPreview)
  }

  function handleRealizarFechamento() {
    const prox = Number(String(proximoStr).replace(',', '.'))
    if (!Number.isFinite(prox) || prox < 0) {
      window.alert('Informe um valor válido para o próximo caixa (maior ou igual a zero).')
      return
    }
    const reg = registrarFechamentoTurno(prox)
    if (!reg) {
      window.alert('Não foi possível fechar o turno. Verifique se ainda há turno aberto.')
      return
    }
    setResultado(reg)
  }

  if (resultado) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface-card)] px-4 sm:px-8 py-5">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Caixa</p>
              <h1 className="text-xl font-bold text-[var(--text)]">Turno encerrado</h1>
            </div>
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
            >
              Voltar ao painel
            </button>
          </div>
        </header>
        <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
          <p className="text-sm text-[var(--text-muted)]">
            O fechamento foi registrado. O valor informado em <strong>próximo caixa</strong> será sugerido como saldo ao
            abrir o turno no próximo dia.
          </p>
          <button
            type="button"
            onClick={() => abrirImpressao(resultado)}
            className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Imprimir resumo
          </button>
        </main>

        {mostrarImpressao && dadosImpressao && (
          <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/50 print:bg-transparent print:static">
            <div className="no-print sticky top-0 flex justify-end gap-2 p-3 bg-[var(--surface-card)] border-b border-[var(--border)]">
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Imprimir
              </button>
              <button
                type="button"
                onClick={handleFecharImpressaoOverlay}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
              >
                Fechar
              </button>
            </div>
            <div className="p-6 flex justify-center print:p-2">
              <ResumoTurnoImpressao dados={dadosImpressao} />
            </div>
          </div>
        )}
      </div>
    )
  }

  if (!ab || !acum) {
    return (
      <div className="min-h-screen flex flex-col bg-[var(--surface)]">
        <header className="border-b border-[var(--border)] bg-[var(--surface-card)] px-4 sm:px-8 py-5">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Caixa</p>
              <h1 className="text-xl font-bold text-[var(--text)]">Fechamento de caixa</h1>
            </div>
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
            >
              Voltar
            </button>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center">
            <p className="text-sm text-amber-900">
              Não há turno de caixa aberto para hoje. Abra o turno ao iniciar uma venda ou orçamento no PDV.
            </p>
            <button
              type="button"
              onClick={onVoltar}
              className="mt-6 rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Voltar ao painel
            </button>
          </div>
        </main>
      </div>
    )
  }

  const aberto = new Date(ab.abertoEmIso)
  const dataAb = aberto.toLocaleDateString('pt-BR')
  const horaAb = aberto.toLocaleTimeString('pt-BR')
  const agora = new Date()
  const dataFc = agora.toLocaleDateString('pt-BR')
  const horaFc = agora.toLocaleTimeString('pt-BR')

  const totalVendas = round2(acum.dinheiro + acum.pix + acum.cartao + acum.boleto)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] px-4 sm:px-8 py-5">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Caixa</p>
            <h1 className="text-xl font-bold text-[var(--text)]">Fechamento de caixa</h1>
          </div>
          <button
            type="button"
            onClick={onVoltar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-sm overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[var(--border)] bg-[var(--surface)]/60">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-[var(--text-muted)] text-xs">Data da abertura</span>
                <p className="font-semibold text-emerald-700 tabular-nums">{dataAb}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs">Hora da abertura</span>
                <p className="font-semibold text-emerald-700 tabular-nums">{horaAb}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs">Data do fechamento (agora)</span>
                <p className="font-semibold text-red-700 tabular-nums">{dataFc}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)] text-xs">Hora do fechamento (agora)</span>
                <p className="font-semibold text-red-700 tabular-nums">{horaFc}</p>
              </div>
            </div>
            <p className="mt-3 text-sm text-[var(--text)]">
              <span className="text-[var(--text-muted)]">Fechamento efetuado por:</span>{' '}
              <strong>Administrador</strong>
            </p>
            <p className="mt-1 text-sm">
              <span className="text-[var(--text-muted)]">Turno aberto com:</span>{' '}
              <strong className="text-[var(--accent)] tabular-nums">{formatarBrl(ab.saldoAbertura)}</strong>
            </p>
          </div>

          <div className="px-4 sm:px-6 py-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--text)] border-b border-[var(--border)] pb-2">
              Valores em vendas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 flex justify-between">
                <span className="text-[var(--text-muted)]">Dinheiro</span>
                <span className="font-medium tabular-nums">{formatarBrl(acum.dinheiro)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 flex justify-between">
                <span className="text-[var(--text-muted)]">Pix</span>
                <span className="font-medium tabular-nums">{formatarBrl(acum.pix)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 flex justify-between">
                <span className="text-[var(--text-muted)]">Cartão</span>
                <span className="font-medium tabular-nums">{formatarBrl(acum.cartao)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 flex justify-between">
                <span className="text-[var(--text-muted)]">Boleto</span>
                <span className="font-medium tabular-nums">{formatarBrl(acum.boleto)}</span>
              </div>
            </div>

            <div className="rounded-xl bg-teal-50 border border-teal-100 px-4 py-4 text-center">
              <span className="text-xs font-medium text-teal-800 uppercase">Soma vendas</span>
              <p className="text-2xl font-bold text-teal-900 tabular-nums mt-1">{formatarBrl(totalVendas)}</p>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4 pt-2">
              <div className="flex-1">
                <label htmlFor="proximo-caixa" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Valor próximo caixa
                </label>
                <p className="text-xs text-[var(--text-muted)] mb-2">
                  Será sugerido como saldo ao abrir o turno no próximo dia.
                </p>
                <input
                  id="proximo-caixa"
                  type="number"
                  min={0}
                  step={0.01}
                  value={proximoStr}
                  onChange={(e) => setProximoStr(e.target.value)}
                  className="w-full max-w-xs rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[var(--border)]">
              <div>
                <p className="text-xs text-[var(--text-muted)]">Total em vendas (geral)</p>
                <p className="text-lg font-bold text-[var(--text)] tabular-nums">{formatarBrl(totalVendas)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--text-muted)]">Soma total do turno</p>
                <p className="text-2xl font-bold text-[var(--accent)] tabular-nums">{formatarBrl(totalVendas)}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 justify-end px-4 sm:px-6 py-4 border-t border-[var(--border)] bg-[var(--surface)]/50">
            <button
              type="button"
              onClick={handleImprimir}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm font-medium inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9V4h12v5M6 14H4a2 2 0 01-2-2v-1a2 2 0 012-2h16a2 2 0 012 2v1a2 2 0 01-2 2h-2M6 14v5a2 2 0 002 2h8a2 2 0 002-2v-5M6 14h12" />
              </svg>
              Imprimir resumo
            </button>
            <button
              type="button"
              onClick={handleRealizarFechamento}
              className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-white hover:bg-[var(--accent-hover)] inline-flex items-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Realizar fechamento
            </button>
          </div>
        </div>
      </main>

      {mostrarImpressao && dadosImpressao && (
        <div className="fixed inset-0 z-[200] overflow-y-auto bg-black/50 print:bg-transparent print:static">
          <div className="no-print sticky top-0 flex justify-end gap-2 p-3 bg-[var(--surface-card)] border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
            >
              Imprimir
            </button>
            <button
              type="button"
              onClick={handleFecharImpressaoOverlay}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
            >
              Fechar
            </button>
          </div>
          <div className="p-6 flex justify-center print:p-2">
            <ResumoTurnoImpressao dados={dadosImpressao} />
          </div>
        </div>
      )}
    </div>
  )
}
