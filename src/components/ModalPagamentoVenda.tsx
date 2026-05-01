import { useEffect, useMemo, useState } from 'react'
import type { DadosPagamentoVenda } from '../types'
import { formatarBrl, round2 } from '../utils/moeda'

type Props = {
  aberto: boolean
  subtotalBruto: number
  onFechar: () => void
  onConfirmar: (dados: DadosPagamentoVenda) => void
}

export function ModalPagamentoVenda({ aberto, subtotalBruto, onFechar, onConfirmar }: Props) {
  const [tipoDesconto, setTipoDesconto] = useState<'percentual' | 'valor'>('percentual')
  const [descontoPercentual, setDescontoPercentual] = useState(0)
  const [descontoValor, setDescontoValor] = useState(0)
  const [acrescimo, setAcrescimo] = useState(0)
  const [dinheiro, setDinheiro] = useState(0)
  const [pix, setPix] = useState(0)
  const [cartao, setCartao] = useState(0)
  const [boleto, setBoleto] = useState(0)

  useEffect(() => {
    if (!aberto) return
    setTipoDesconto('percentual')
    setDescontoPercentual(0)
    setDescontoValor(0)
    setAcrescimo(0)
    setDinheiro(0)
    setPix(0)
    setCartao(0)
    setBoleto(0)
  }, [aberto])

  const valorDescontoCalculado = useMemo(() => {
    const base = round2(subtotalBruto)
    if (base <= 0) return 0
    if (tipoDesconto === 'percentual') {
      const pct = Math.min(100, Math.max(0, descontoPercentual))
      return round2((base * pct) / 100)
    }
    return round2(Math.min(base, Math.max(0, descontoValor)))
  }, [subtotalBruto, tipoDesconto, descontoPercentual, descontoValor])

  const totalAPagar = useMemo(
    () => {
      const base = round2(subtotalBruto)
      const acres = round2(Math.max(0, Number(acrescimo) || 0))
      return round2(Math.max(0, base - valorDescontoCalculado + acres))
    },
    [subtotalBruto, valorDescontoCalculado, acrescimo],
  )

  const totalPago = useMemo(
    () => round2(dinheiro + pix + cartao + boleto),
    [dinheiro, pix, cartao, boleto],
  )

  const troco = useMemo(() => round2(Math.max(0, totalPago - totalAPagar)), [totalPago, totalAPagar])

  const descontoInformado = tipoDesconto === 'percentual' ? descontoPercentual : descontoValor

  function handleConfirmar() {
    if (totalAPagar > 0 && totalPago + 0.001 < totalAPagar) {
      window.alert(
        `O total pago (${formatarBrl(totalPago)}) é menor que o valor a pagar (${formatarBrl(totalAPagar)}).`,
      )
      return
    }
    const dados: DadosPagamentoVenda = {
      subtotalBruto: round2(subtotalBruto),
      tipoDesconto,
      descontoInformado,
      valorDescontoCalculado,
      acrescimo: round2(Math.max(0, acrescimo)),
      totalAPagar,
      dinheiro: round2(dinheiro),
      pix: round2(pix),
      cartao: round2(cartao),
      boleto: round2(boleto),
      totalPago,
      troco,
    }
    onConfirmar(dados)
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-pagamento-titulo"
        className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-xl"
      >
        <div className="border-b border-[var(--border)] px-5 py-4">
          <h2 id="modal-pagamento-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--accent)]">
            Confirmando pagamento
          </h2>
          <p className="mt-2 rounded-xl bg-[var(--accent)]/15 px-4 py-3 text-center">
            <span className="text-xs font-medium text-[var(--text-muted)]">Total da venda</span>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-[var(--accent)]">
              {formatarBrl(totalAPagar)}
            </span>
            {(valorDescontoCalculado > 0 || acrescimo > 0) && (
              <span className="mt-1 block text-xs text-[var(--text-muted)]">
                Subtotal {formatarBrl(subtotalBruto)}
                {valorDescontoCalculado > 0 ? ` · Desconto ${formatarBrl(valorDescontoCalculado)}` : ''}
                {acrescimo > 0 ? ` · Acréscimo ${formatarBrl(acrescimo)}` : ''}
              </span>
            )}
          </p>
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Desconto</p>
            <div className="flex flex-wrap gap-3 mb-2">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="tipo-desc"
                  checked={tipoDesconto === 'percentual'}
                  onChange={() => setTipoDesconto('percentual')}
                />
                Percentual (%)
              </label>
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="tipo-desc"
                  checked={tipoDesconto === 'valor'}
                  onChange={() => setTipoDesconto('valor')}
                />
                Valor (R$)
              </label>
            </div>
            {tipoDesconto === 'percentual' ? (
              <input
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={descontoPercentual || ''}
                onChange={(e) => setDescontoPercentual(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="0"
              />
            ) : (
              <input
                type="number"
                min={0}
                step={0.01}
                value={descontoValor || ''}
                onChange={(e) => setDescontoValor(Number(e.target.value) || 0)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="0,00"
              />
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-2">Valores recebidos</p>
            <div className="mb-3">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)] text-xs">Acréscimo</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={acrescimo || ''}
                  onChange={(e) => setAcrescimo(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                  placeholder="0,00"
                />
              </label>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Somado ao total a pagar.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-[var(--text-muted)] text-xs">Dinheiro</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={dinheiro || ''}
                  onChange={(e) => setDinheiro(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)] text-xs">Pix</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={pix || ''}
                  onChange={(e) => setPix(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)] text-xs">Cartão</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={cartao || ''}
                  onChange={(e) => setCartao(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                />
              </label>
              <label className="block text-sm">
                <span className="text-[var(--text-muted)] text-xs">Boleto</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={boleto || ''}
                  onChange={(e) => setBoleto(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-2 text-center">
              <span className="text-xs font-medium text-emerald-800">Total pago</span>
              <p className="text-lg font-bold tabular-nums text-emerald-900">{formatarBrl(totalPago)}</p>
            </div>
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-center">
              <span className="text-xs font-medium text-red-800">Troco</span>
              <p className="text-lg font-bold tabular-nums text-red-900">{formatarBrl(troco)}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-end border-t border-[var(--border)] px-5 py-4 bg-[var(--surface)]/80">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Voltar à venda
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--accent-hover)]"
          >
            Concluir venda
          </button>
        </div>
      </div>
    </div>
  )
}
