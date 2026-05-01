import { useEffect, useRef, useState } from 'react'
import {
  gruposMenuCadastros,
  type ItemMenuCadastro,
  type ItemMenuCadastroComSub,
  type ItemMenuCadastroOuSub,
} from '../data/menuCadastros'

type Props = {
  onCadastroProdutos: () => void
  onCadastroTiposProduto: () => void
  onCadastroClientes: () => void
  onCadastroFornecedores: () => void
  className?: string
}

function isSubmenuItem(item: ItemMenuCadastroOuSub): item is ItemMenuCadastroComSub {
  return 'submenu' in item && Array.isArray(item.submenu)
}

export function CadastroDropdown({
  onCadastroProdutos,
  onCadastroTiposProduto,
  onCadastroClientes,
  onCadastroFornecedores,
  className = '',
}: Props) {
  const [aberto, setAberto] = useState(false)
  const [subAbertoId, setSubAbertoId] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!aberto) return
    function handle(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setAberto(false)
        setSubAbertoId(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [aberto])

  function handleItemClick(item: ItemMenuCadastroOuSub) {
    if (isSubmenuItem(item)) {
      setSubAbertoId((id) => (id === item.id ? null : item.id))
      return
    }
    const row = item as ItemMenuCadastro
    if (row.acao === 'produtos') {
      onCadastroProdutos()
      setAberto(false)
      setSubAbertoId(null)
      return
    }
    if (row.acao === 'tipos_produto') {
      onCadastroTiposProduto()
      setAberto(false)
      setSubAbertoId(null)
      return
    }
    if (row.acao === 'clientes') {
      onCadastroClientes()
      setAberto(false)
      setSubAbertoId(null)
      return
    }
    if (row.acao === 'fornecedores') {
      onCadastroFornecedores()
      setAberto(false)
      setSubAbertoId(null)
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
        Cadastros
        <span className="ml-0.5 opacity-70" aria-hidden>
          ▾
        </span>
      </button>

      {aberto && (
        <div
          className="absolute left-0 top-full z-[100] mt-1 w-[min(100vw-2rem,22rem)] max-h-[min(70vh,24rem)] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface-card)] py-2 shadow-2xl ring-1 ring-black/5"
          role="menu"
        >
          {gruposMenuCadastros.map((grupo, gi) => (
            <div key={grupo.id}>
              {gi > 0 && <div className="my-2 border-t border-[var(--border)]" role="separator" />}
              <ul className="px-1">
                {grupo.itens.map((item) => {
                  if (isSubmenuItem(item)) {
                    const exp = subAbertoId === item.id
                    return (
                      <li key={item.id} className="mb-0.5">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => handleItemClick(item)}
                          className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs sm:text-sm text-[var(--text)] hover:bg-[var(--surface)]"
                        >
                          <span>{item.label}</span>
                          <span className="text-[var(--text-muted)]" aria-hidden>
                            {exp ? '▾' : '▸'}
                          </span>
                        </button>
                        {exp && (
                          <ul className="ml-2 border-l border-[var(--border)] pl-2 mt-1 space-y-0.5">
                            {item.submenu.map((sub) => (
                              <li key={sub.id}>
                                <button
                                  type="button"
                                  disabled
                                  title="Em breve"
                                  className="w-full rounded-lg px-3 py-1.5 text-left text-xs text-[var(--text-muted)] cursor-not-allowed opacity-80"
                                >
                                  {sub.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  }

                  const simple = item as ItemMenuCadastro
                  const pode =
                    simple.acao === 'produtos' ||
                    simple.acao === 'tipos_produto' ||
                    simple.acao === 'clientes' ||
                    simple.acao === 'fornecedores'
                  const titulo =
                    simple.acao === 'produtos'
                      ? 'Abrir cadastro de produtos'
                      : simple.acao === 'tipos_produto'
                        ? 'Abrir cadastro de tipo dos produtos'
                        : simple.acao === 'clientes'
                          ? 'Abrir cadastro de clientes'
                          : simple.acao === 'fornecedores'
                            ? 'Abrir cadastro de fornecedores'
                            : 'Em breve'
                  return (
                    <li key={simple.id} className="mb-0.5">
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!pode}
                        title={titulo}
                        onClick={() => handleItemClick(simple)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-xs sm:text-sm ${
                          pode
                            ? 'text-[var(--accent)] font-medium hover:bg-teal-50'
                            : 'text-[var(--text-muted)] cursor-not-allowed opacity-90'
                        }`}
                      >
                        {simple.label}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
