import { useEffect, useRef, useState } from 'react'
import { itensMenuLancamentos, type ItemMenuLancamento } from '../data/menuLancamentos'

type Props = {
  onSegundaViaReciboVenda: () => void
  onCancelarVendaRealizada: () => void
  className?: string
}

function isSeparator(item: ItemMenuLancamento): item is { id: string; label: string; separator: true } {
  return 'separator' in item && item.separator === true
}

export function LancamentosDropdown({ onSegundaViaReciboVenda, onCancelarVendaRealizada, className = '' }: Props) {
  const [aberto, setAberto] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function handle(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [aberto])

  function handleClick(item: ItemMenuLancamento) {
    if (isSeparator(item)) return
    if (item.acao === 'segunda_via_recibo_venda') {
      onSegundaViaReciboVenda()
      setAberto(false)
    }
    if (item.acao === 'cancelar_venda_realizada') {
      onCancelarVendaRealizada()
      setAberto(false)
    }
  }

  return (
    <div ref={rootRef} className={`relative isolate inline-block text-left ${className}`}>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] sm:text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface)] focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)]"
      >
        Lançamentos
        <span className="ml-0.5 opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {aberto && (
        <div
          className="absolute left-0 top-full z-[100] mt-1 w-[min(100vw-2rem,26rem)] max-h-[min(70vh,26rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-card)] py-2 shadow-2xl ring-1 ring-black/5"
          role="menu"
        >
          <ul className="px-1">
            {itensMenuLancamentos.map((item) => {
              if (isSeparator(item)) {
                return <li key={item.id} className="my-2 border-t border-[var(--border)]" role="separator" />
              }
              const pode = item.acao === 'segunda_via_recibo_venda' || item.acao === 'cancelar_venda_realizada'
              const title =
                item.acao === 'segunda_via_recibo_venda'
                  ? 'Gerar/imprimir 2ª via do recibo'
                  : item.acao === 'cancelar_venda_realizada'
                    ? 'Cancelar uma venda já realizada'
                    : 'Em breve'
              return (
                <li key={item.id} className="mb-0.5">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!pode}
                    title={title}
                    onClick={() => handleClick(item)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-xs sm:text-sm ${
                      pode
                        ? 'text-[var(--accent)] font-medium hover:bg-teal-50'
                        : 'text-[var(--text-muted)] cursor-not-allowed opacity-90'
                    }`}
                  >
                    {item.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

