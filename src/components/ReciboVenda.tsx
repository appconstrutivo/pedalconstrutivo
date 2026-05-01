import { useEffect } from 'react'
import type { Cliente, DadosPagamentoVenda, ItemLancamentoVenda, ModoLancamentoVenda } from '../types'
import { formatarBrl } from '../utils/moeda'

type Props = {
  modo: ModoLancamentoVenda
  numero: string
  emissao: Date
  cliente: Cliente | null
  /** Nome de cliente “snapshot” (histórico), quando não há cadastro disponível. */
  clienteNomeFallback?: string | null
  itens: ItemLancamentoVenda[]
  dadosPagamento: DadosPagamentoVenda | null
  observacoes?: string
  imprimirAoAbrir: boolean
  onFechar: () => void
}

export function ReciboVenda({
  modo,
  numero,
  emissao,
  cliente,
  clienteNomeFallback,
  itens,
  dadosPagamento,
  observacoes,
  imprimirAoAbrir,
  onFechar,
}: Props) {
  useEffect(() => {
    if (!imprimirAoAbrir) return
    const t = window.setTimeout(() => window.print(), 400)
    return () => window.clearTimeout(t)
  }, [imprimirAoAbrir])

  const subtotalItens = itens.reduce((s, i) => s + i.subtotal, 0)

  return (
    <div className="fixed inset-0 z-[130] overflow-y-auto bg-black/50 print:bg-white print:static print:inset-auto">
      <div className="no-print sticky top-0 z-10 flex flex-wrap justify-end gap-2 border-b border-[var(--border)] bg-[var(--surface-card)] px-4 py-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
        >
          Imprimir
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
        >
          Fechar
        </button>
      </div>

      <div className="recibo-print-root mx-auto max-w-md px-4 py-8 print:max-w-none print:py-4 print:px-2">
        <article
          id="recibo-print"
          className="rounded-none border-2 border-dashed border-slate-300 bg-white px-6 py-8 shadow-lg print:shadow-none print:border-slate-400"
        >
          <header className="text-center border-b border-dashed border-slate-200 pb-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-slate-500">Pedal Construtivo</p>
            <h1 className="mt-2 font-serif text-2xl font-bold text-slate-900 tracking-tight">Recibo</h1>
            <p className="mt-1 text-xs font-medium text-teal-700">
              {modo === 'orcamento' ? 'Orçamento' : 'Cupom de venda'}
            </p>
            <p className="mt-3 text-xs text-slate-600">
              <span className="font-semibold text-slate-800">Nº</span> {numero}
            </p>
            <p className="text-xs text-slate-600">
              {emissao.toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </header>

          <section className="mt-5 space-y-1 text-xs text-slate-700">
            <p>
              <span className="text-slate-500">Cliente:</span>{' '}
              <span className="font-medium">{cliente?.nome ?? clienteNomeFallback ?? '—'}</span>
            </p>
            <p>
              <span className="text-slate-500">Operador:</span> <span className="font-medium">Administrador</span>
            </p>
            <p>
              <span className="text-slate-500">Terminal:</span> 01 · <span className="text-slate-500">Turno:</span> 1
            </p>
          </section>
          {observacoes?.trim() ? (
            <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Observações</p>
              <p className="whitespace-pre-wrap">{observacoes.trim()}</p>
            </section>
          ) : null}

          <section className="mt-6">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Itens</p>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-1.5 pr-2 font-medium">Descrição</th>
                  <th className="py-1.5 px-1 text-right font-medium w-10">Qtd</th>
                  <th className="py-1.5 px-1 text-right font-medium">Unit.</th>
                  <th className="py-1.5 px-1 text-right font-medium whitespace-nowrap">Desc.%</th>
                  <th className="py-1.5 pl-1 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.id} className="border-b border-slate-100">
                    <td className="py-2 pr-2 align-top text-slate-800">{it.descricao}</td>
                    <td className="py-2 px-1 text-right tabular-nums text-slate-700">{it.quantidade}</td>
                    <td className="py-2 px-1 text-right tabular-nums text-slate-600">{formatarBrl(it.precoUnitario)}</td>
                    <td className="py-2 px-1 text-right tabular-nums text-slate-600">
                      {(it.descontoPercentual ?? 0) > 0
                        ? `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(it.descontoPercentual ?? 0)}%`
                        : '—'}
                    </td>
                    <td className="py-2 pl-1 text-right tabular-nums font-medium text-slate-900">
                      {formatarBrl(it.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="mt-5 space-y-2 text-sm border-t border-dashed border-slate-200 pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium text-slate-900">{formatarBrl(subtotalItens)}</span>
            </div>
            {modo === 'venda' && dadosPagamento && dadosPagamento.valorDescontoCalculado > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>
                  Desconto
                  {dadosPagamento.tipoDesconto === 'percentual'
                    ? ` (${dadosPagamento.descontoInformado}%)`
                    : ''}
                </span>
                <span className="tabular-nums text-red-700">− {formatarBrl(dadosPagamento.valorDescontoCalculado)}</span>
              </div>
            )}
            {modo === 'venda' && dadosPagamento && dadosPagamento.acrescimo > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>Acréscimo</span>
                <span className="tabular-nums text-emerald-800">+ {formatarBrl(dadosPagamento.acrescimo)}</span>
              </div>
            )}
            {modo === 'venda' && dadosPagamento && (
              <>
                <div className="flex justify-between text-base font-bold text-teal-800 pt-1">
                  <span>Total</span>
                  <span className="tabular-nums">{formatarBrl(dadosPagamento.totalAPagar)}</span>
                </div>
                <div className="mt-3 space-y-1 text-xs text-slate-700 border-t border-slate-100 pt-3">
                  <p className="font-semibold text-slate-600 uppercase text-[10px] tracking-wide">Pagamento</p>
                  {dadosPagamento.dinheiro > 0 && (
                    <div className="flex justify-between">
                      <span>Dinheiro</span>
                      <span className="tabular-nums">{formatarBrl(dadosPagamento.dinheiro)}</span>
                    </div>
                  )}
                  {dadosPagamento.pix > 0 && (
                    <div className="flex justify-between">
                      <span>Pix</span>
                      <span className="tabular-nums">{formatarBrl(dadosPagamento.pix)}</span>
                    </div>
                  )}
                  {dadosPagamento.cartao > 0 && (
                    <div className="flex justify-between">
                      <span>Cartão</span>
                      <span className="tabular-nums">{formatarBrl(dadosPagamento.cartao)}</span>
                    </div>
                  )}
                  {dadosPagamento.boleto > 0 && (
                    <div className="flex justify-between">
                      <span>Boleto</span>
                      <span className="tabular-nums">{formatarBrl(dadosPagamento.boleto)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 font-medium">
                    <span>Total pago</span>
                    <span className="tabular-nums">{formatarBrl(dadosPagamento.totalPago)}</span>
                  </div>
                  <div className="flex justify-between text-red-800">
                    <span>Troco</span>
                    <span className="tabular-nums font-semibold">{formatarBrl(dadosPagamento.troco)}</span>
                  </div>
                </div>
              </>
            )}
            {modo === 'orcamento' && (
              <>
                <div className="flex justify-between text-base font-bold text-teal-800 pt-1">
                  <span>Total estimado</span>
                  <span className="tabular-nums">{formatarBrl(subtotalItens)}</span>
                </div>
                <p className="text-xs text-slate-500 pt-2">
                  Documento para consulta. Valores e condições podem ser alterados até a efetivação da venda.
                </p>
              </>
            )}
          </section>

          <footer className="mt-8 pt-4 border-t border-dashed border-slate-200 text-center text-[10px] text-slate-500 leading-relaxed">
            <p>Obrigado pela preferência.</p>
            <p className="mt-1">Registro local · Pedal Construtivo</p>
          </footer>
        </article>
      </div>
    </div>
  )
}
