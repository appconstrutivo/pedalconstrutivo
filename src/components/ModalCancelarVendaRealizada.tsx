import { useEffect, useMemo, useState } from 'react'
import type { RegistroVendaHistorico } from '../types'
import { obterRegistroMovimentacaoPorDocumento, cancelarVendaPorDocumento } from '../store/historicoMovimentacao'
import { estornarEstoquePorCancelamento } from '../store/produtos'
import { obterAberturaTurnoHoje, removerVendaDoTurnoAtual } from '../store/turnoCaixa'
import { formatarBrl } from '../utils/moeda'

type Props = {
  aberto: boolean
  onFechar: () => void
}

function normalizarDocumento(s: string): string {
  return (s ?? '').trim()
}

export function ModalCancelarVendaRealizada({ aberto, onFechar }: Props) {
  const [etapa, setEtapa] = useState<'documento' | 'resumo'>('documento')
  const [numero, setNumero] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [venda, setVenda] = useState<RegistroVendaHistorico | null>(null)
  const [justificativa, setJustificativa] = useState('')

  useEffect(() => {
    if (!aberto) return
    setEtapa('documento')
    setNumero('')
    setErro(null)
    setVenda(null)
    setJustificativa('')
  }, [aberto])

  const podeBuscar = useMemo(() => normalizarDocumento(numero).length > 0, [numero])
  const podeConfirmar = useMemo(() => justificativa.trim().length >= 3, [justificativa])

  function buscar() {
    const n = normalizarDocumento(numero)
    if (!n) return
    const r = obterRegistroMovimentacaoPorDocumento(n)
    if (!r || r.kind !== 'venda') {
      setErro('Documento não encontrado ou não é uma venda finalizada no histórico local.')
      return
    }
    const vv = r as RegistroVendaHistorico
    if (vv.cancelamento?.canceladoEmIso) {
      setErro('Esta venda já consta como cancelada.')
      return
    }
    setVenda(vv)
    setErro(null)
    setEtapa('resumo')
  }

  function confirmarCancelamento() {
    if (!venda) return
    const just = justificativa.trim()
    if (just.length < 3) return

    // 1) Marca cancelamento no histórico local
    const cancelada = cancelarVendaPorDocumento(venda.numeroDocumento, just, 'Administrador')
    if (!cancelada) {
      window.alert('Não foi possível cancelar. Verifique o documento e a justificativa.')
      return
    }

    // 2) Estorna estoque (devolve quantidades vendidas)
    estornarEstoquePorCancelamento(cancelada.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })))

    // 3) Ajusta acumulado do turno atual, se a venda pertence ao dia do turno aberto hoje
    const ab = obterAberturaTurnoHoje()
    const diaVenda = (cancelada.emitidoEmIso || '').slice(0, 10)
    if (ab && diaVenda === ab.dataReferencia) {
      removerVendaDoTurnoAtual(cancelada.pagamento)
    }

    window.alert(`Venda ${cancelada.numeroDocumento} cancelada com sucesso.`)
    onFechar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[155] flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-cancelar-venda"
        className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-2xl"
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-cancelar-venda" className="text-base font-semibold text-[var(--text)]">
              Cancelar venda realizada
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Cancelamento administrativo (dados locais). Informe o Nº do documento para localizar a venda.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]"
          >
            Fechar
          </button>
        </div>

        {etapa === 'documento' ? (
          <div className="p-5 space-y-3">
            <label htmlFor="doc-cancelar" className="block text-sm font-medium text-[var(--text)]">
              Nº do documento
            </label>
            <input
              id="doc-cancelar"
              value={numero}
              onChange={(e) => {
                setNumero(e.target.value)
                setErro(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  buscar()
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  onFechar()
                }
              }}
              inputMode="numeric"
              autoComplete="off"
              placeholder="Ex.: 20260426230338"
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-mono"
            />
            {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onFechar}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={buscar}
                disabled={!podeBuscar}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {venda && (
              <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Venda localizada</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      Documento <span className="font-mono text-[var(--text)]">{venda.numeroDocumento}</span> ·{' '}
                      {new Date(venda.emitidoEmIso).toLocaleString('pt-BR')}
                    </p>
                    <p className="mt-1 text-sm">
                      <span className="text-[var(--text-muted)]">Cliente:</span>{' '}
                      <span className="font-medium text-[var(--text)]">{venda.clienteNome ?? '—'}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[var(--text-muted)]">Total</p>
                    <p className="text-xl font-bold tabular-nums text-[var(--accent)]">{formatarBrl(venda.pagamento.totalAPagar)}</p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  {venda.pagamento.dinheiro > 0 && (
                    <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs text-[var(--text-muted)]">Dinheiro</p>
                      <p className="font-semibold tabular-nums">{formatarBrl(venda.pagamento.dinheiro)}</p>
                    </div>
                  )}
                  {venda.pagamento.pix > 0 && (
                    <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs text-[var(--text-muted)]">Pix</p>
                      <p className="font-semibold tabular-nums">{formatarBrl(venda.pagamento.pix)}</p>
                    </div>
                  )}
                  {venda.pagamento.cartao > 0 && (
                    <div className="rounded-xl bg-[var(--surface)] px-3 py-2">
                      <p className="text-xs text-[var(--text-muted)]">Cartão</p>
                      <p className="font-semibold tabular-nums">{formatarBrl(venda.pagamento.cartao)}</p>
                    </div>
                  )}
                </div>

                <div className="mt-4">
                  <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-2">Itens</p>
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-[var(--border)]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-[var(--surface)] text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                          <th className="px-2 py-2">Descrição</th>
                          <th className="px-2 py-2 text-right">Qtd</th>
                          <th className="px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {venda.itens.map((it, idx) => (
                          <tr key={`${it.produtoId}-${idx}`} className="border-b border-[var(--border)] last:border-b-0">
                            <td className="px-2 py-2 text-[var(--text)]">{it.descricao}</td>
                            <td className="px-2 py-2 text-right tabular-nums">{it.quantidade}</td>
                            <td className="px-2 py-2 text-right tabular-nums font-medium">{formatarBrl(it.subtotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="just-cancel" className="block text-sm font-medium text-[var(--text)] mb-1.5">
                Justificativa do cancelamento
              </label>
              <textarea
                id="just-cancel"
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={4}
                placeholder="Descreva o motivo do cancelamento…"
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
              />
              <p className="mt-1 text-xs text-[var(--text-muted)]">Mínimo: 3 caracteres.</p>
            </div>

            <div className="flex flex-wrap justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setEtapa('documento')
                  setErro(null)
                  setVenda(null)
                  setJustificativa('')
                }}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Voltar
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onFechar}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
                >
                  Fechar
                </button>
                <button
                  type="button"
                  onClick={confirmarCancelamento}
                  disabled={!podeConfirmar}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Confirmar cancelamento
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

