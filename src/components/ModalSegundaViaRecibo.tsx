import { useEffect, useMemo, useState } from 'react'
import type { ItemLancamentoVenda } from '../types'
import { obterRegistroVendaPorDocumento } from '../store/historicoMovimentacao'

type Props = {
  aberto: boolean
  onFechar: () => void
  onAbrirRecibo: (p: { numeroDocumento: string; emitidoEmIso: string; clienteNome: string | null; itens: ItemLancamentoVenda[] }) => void
}

export function ModalSegundaViaRecibo({ aberto, onFechar, onAbrirRecibo }: Props) {
  const [numero, setNumero] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (!aberto) return
    setNumero('')
    setErro(null)
  }, [aberto])

  const podeConfirmar = useMemo(() => numero.trim().length > 0, [numero])

  function confirmar() {
    const n = numero.trim()
    if (!n) return

    const venda = obterRegistroVendaPorDocumento(n)
    if (!venda) {
      setErro('Documento não encontrado no histórico local. Verifique o número e tente novamente.')
      return
    }

    const itens: ItemLancamentoVenda[] = venda.itens.map((it, idx) => ({
      id: `${it.produtoId}-${idx}`,
      produtoId: it.produtoId,
      descricao: it.descricao,
      codigoBarras: it.codigoBarras,
      quantidade: it.quantidade,
      precoUnitario: it.precoUnitario,
      subtotal: it.subtotal,
    }))

    onAbrirRecibo({
      numeroDocumento: venda.numeroDocumento,
      emitidoEmIso: venda.emitidoEmIso,
      clienteNome: venda.clienteNome ?? null,
      itens,
    })
    onFechar()
  }

  if (!aberto) return null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/45 backdrop-blur-[1px] p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-2via"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="titulo-2via" className="text-base font-semibold text-[var(--text)]">
              2ª via do recibo
            </h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              Informe o Nº do documento (o mesmo exibido no Relatório GERAL de movimentação em vendas).
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

        <div className="mt-5 space-y-2">
          <label htmlFor="doc-2via" className="block text-sm font-medium text-[var(--text)]">
            Nº do documento
          </label>
          <input
            id="doc-2via"
            value={numero}
            onChange={(e) => {
              setNumero(e.target.value)
              setErro(null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                confirmar()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                onFechar()
              }
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="Ex.: 20260426-000123"
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-mono"
          />
          {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erro}</p>}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={!podeConfirmar}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Gerar recibo
          </button>
        </div>
      </div>
    </div>
  )
}

