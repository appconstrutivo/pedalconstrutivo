import { type ReactNode } from 'react'

type Tab = 'fornecedores' | 'cotacao'

interface LayoutProps {
  tab: Tab
  onTab: (t: Tab) => void
  onIrParaInicio?: () => void
  children: ReactNode
}

export function Layout({ tab, onTab, onIrParaInicio, children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-[var(--border)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
                Pedal Construtivo
              </h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">Gestão da loja</p>
            </div>
            {onIrParaInicio && (
              <button
                type="button"
                onClick={onIrParaInicio}
                className="text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] underline-offset-4 hover:underline shrink-0"
              >
                ← Início
              </button>
            )}
          </div>
          <nav className="flex gap-1 mt-4 rounded-lg bg-[var(--surface)] p-1" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'fornecedores'}
              onClick={() => onTab('fornecedores')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'fornecedores'
                  ? 'bg-white text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Fornecedores
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'cotacao'}
              onClick={() => onTab('cotacao')}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                tab === 'cotacao'
                  ? 'bg-white text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-muted)] hover:text-[var(--text)]'
              }`}
            >
              Cotação
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>
    </div>
  )
}
