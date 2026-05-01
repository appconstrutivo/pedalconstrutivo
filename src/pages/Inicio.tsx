import type { ReactNode } from 'react'
import { useState } from 'react'
import { DATA_MODE } from '../config/dataMode'
import { CadastroDropdown } from '../components/CadastroDropdown'
import { LancamentosDropdown } from '../components/LancamentosDropdown'
import { RelatoriosDropdown } from '../components/RelatoriosDropdown'
import { ModalRelatorioMovimentacaoVendas } from '../components/ModalRelatorioMovimentacaoVendas'
import { ModalSegundaViaRecibo } from '../components/ModalSegundaViaRecibo'
import { ModalCancelarVendaRealizada } from '../components/ModalCancelarVendaRealizada'
import { ReciboVenda } from '../components/ReciboVenda'
import type { ItemLancamentoVenda } from '../types'
import { forceSyncLocalToSupabase } from '../supabase/seedFromLocal'

type InicioProps = {
  onOpenPrototype: () => void
  onOpenProdutos: () => void
  onOpenEstoque: () => void
  onOpenTiposProduto: () => void
  onOpenClientes: () => void
  onOpenFornecedores: () => void
  onOpenVender: () => void
  onOpenCaixa: () => void
}

/** Demais entradas do menu superior (fora do dropdown Cadastros). */
const menuSuperiorRestante: { id: string; label: string }[] = [
  { id: 'graficos', label: 'Gráficos' },
  { id: 'utilitarios', label: 'Utilitários' },
  { id: 'usuarios', label: 'Usuários' },
  { id: 'sair', label: 'Sair' },
]

/** Botões da faixa principal (ações do dia a dia) — layout em linha, ícone + texto. */
const toolbarActions: {
  id: string
  label: string
  icon: ReactNode
  kind: 'prototype' | 'produtos' | 'estoque' | 'clientes' | 'vender' | 'caixa' | 'soon'
}[] = [
  {
    id: 'produtos',
    label: 'Produtos',
    kind: 'produtos',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 7V5a2 2 0 012-2h12a2 2 0 012 2v2M4 7h16M4 7l.5 12a2 2 0 002 1.9h11a2 2 0 002-1.9L20 7M9 11h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'clientes',
    label: 'Clientes',
    kind: 'clientes',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'estoque',
    label: 'Estoque',
    kind: 'estoque',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" strokeLinejoin="round" />
        <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'vender',
    label: 'Vender',
    kind: 'vender',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'caixa',
    label: 'Caixa',
    kind: 'caixa',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 7h16v10H4V7z" strokeLinejoin="round" />
        <path d="M4 10h16M8 14h.01M12 14h.01" strokeLinecap="round" />
        <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'financeiro',
    label: 'Financeiro',
    kind: 'soon',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v10M9.5 9.5c0-1 1-2 2.5-2s2.5 1 2.5 2-1 2-2.5 2-2.5 1-2.5 2 1 2 2.5 2 2.5-1 2.5-2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'debitos',
    label: 'Débitos',
    kind: 'soon',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" strokeLinejoin="round" />
        <path d="M14 2v6h6M8 13h8M8 17h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'etiquetas',
    label: 'Etiquetas',
    kind: 'soon',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 2H2v10l10 10 10-10V2H12z" strokeLinejoin="round" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'pesquisar',
    label: 'Pesquisar',
    kind: 'soon',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: 'prototipo',
    label: 'Protótipo',
    kind: 'prototype',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: 'backup',
    label: 'Backup',
    kind: 'soon',
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M7 18a4.5 4.5 0 014.5-4.5c1.6 0 3 .8 3.8 2M21 12.5V10a7 7 0 10-14 0v2.5" strokeLinecap="round" />
        <path d="M12 13v9M8 17l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
]

export function Inicio({
  onOpenPrototype,
  onOpenProdutos,
  onOpenEstoque,
  onOpenTiposProduto,
  onOpenClientes,
  onOpenFornecedores,
  onOpenVender,
  onOpenCaixa,
}: InicioProps) {
  const [relatorioVendasAberto, setRelatorioVendasAberto] = useState(false)
  const [modalSegundaVia, setModalSegundaVia] = useState(false)
  const [modalCancelarVenda, setModalCancelarVenda] = useState(false)
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'ok' | 'error'>('idle')
  const [recibo2via, setRecibo2via] = useState<{
    numeroDocumento: string
    emitidoEmIso: string
    clienteNome: string | null
    itens: ItemLancamentoVenda[]
  } | null>(null)

  const hoje = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Pedal Construtivo</p>
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text)] tracking-tight mt-0.5">Painel principal</h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] text-right sm:text-left">
            <span className="font-medium text-[var(--text)]">Operador</span>
            <span className="hidden sm:inline"> · </span>
            <br className="sm:hidden" />
            {hoje.charAt(0).toUpperCase() + hoje.slice(1)}
          </p>
        </div>
        <nav
          className="border-t border-[var(--border)]/70 bg-[var(--surface)]/50"
          aria-label="Cadastros, lançamentos e relatórios"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-2">
            <p className="text-[10px] sm:text-[11px] text-[var(--text-muted)]/90 mb-1.5">
              Registros e rotinas
            </p>
            {/*
              O dropdown de Cadastros não pode ficar dentro de um ancestor com overflow-x: auto:
              isso recorta position:absolute e parece “menu por baixo” do Acesso rápido.
              Scroll horizontal só nos demais itens.
            */}
            <div className="flex flex-wrap sm:flex-nowrap items-start sm:items-center gap-y-1 -mx-1 px-1 pb-0.5">
              <div className="shrink-0 relative z-[60] pr-1 flex flex-wrap items-center gap-x-1 gap-y-1">
                <CadastroDropdown
                  onCadastroProdutos={onOpenProdutos}
                  onCadastroTiposProduto={onOpenTiposProduto}
                  onCadastroClientes={onOpenClientes}
                  onCadastroFornecedores={onOpenFornecedores}
                />
                <span className="text-[var(--border)] select-none px-0.5" aria-hidden>
                  ·
                </span>
                <LancamentosDropdown
                  onSegundaViaReciboVenda={() => setModalSegundaVia(true)}
                  onCancelarVendaRealizada={() => setModalCancelarVenda(true)}
                />
                <span className="text-[var(--border)] select-none px-0.5" aria-hidden>
                  ·
                </span>
                <RelatoriosDropdown onRelatorioGeralVendas={() => setRelatorioVendasAberto(true)} />
              </div>
              <div className="min-w-0 flex-1 overflow-x-auto overflow-y-visible pb-0.5">
                <ul className="flex flex-nowrap sm:flex-wrap items-center gap-x-0 min-w-min sm:min-w-0 text-[11px] sm:text-xs text-[var(--text-muted)]">
                  {menuSuperiorRestante.map((item) => (
                    <li key={item.id} className="flex items-center shrink-0">
                      <span className="mx-1.5 sm:mx-2 text-[var(--border)] select-none" aria-hidden>
                        ·
                      </span>
                      <button
                        type="button"
                        disabled
                        title="Em breve — telas em construção"
                        className="whitespace-nowrap rounded px-1 py-0.5 text-left text-[var(--text-muted)] cursor-not-allowed opacity-90 hover:opacity-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1"
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </nav>
      </header>

      <ModalRelatorioMovimentacaoVendas
        aberto={relatorioVendasAberto}
        onFechar={() => setRelatorioVendasAberto(false)}
      />

      <ModalSegundaViaRecibo
        aberto={modalSegundaVia}
        onFechar={() => setModalSegundaVia(false)}
        onAbrirRecibo={(p) => setRecibo2via(p)}
      />

      <ModalCancelarVendaRealizada
        aberto={modalCancelarVenda}
        onFechar={() => setModalCancelarVenda(false)}
      />

      {recibo2via && (
        <ReciboVenda
          modo="venda"
          numero={recibo2via.numeroDocumento}
          emissao={new Date(recibo2via.emitidoEmIso)}
          cliente={null}
          clienteNomeFallback={recibo2via.clienteNome}
          itens={recibo2via.itens}
          dadosPagamento={null}
          imprimirAoAbrir
          onFechar={() => setRecibo2via(null)}
        />
      )}

      <div className="flex-1 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 20% -10%, rgba(13, 148, 136, 0.18), transparent 50%),
              radial-gradient(ellipse 60% 40% at 100% 20%, rgba(100, 116, 139, 0.12), transparent 45%),
              linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)
            `,
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          <section aria-label="Ações principais" className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)]/95 shadow-sm backdrop-blur px-3 py-4 sm:px-5 sm:py-5">
            <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wide mb-3 px-1">Acesso rápido</p>
            <div className="overflow-x-auto overflow-y-visible pb-1 -mx-1 px-1">
              <div className="flex flex-nowrap gap-2 sm:gap-3 min-w-min justify-start sm:justify-center">
                {toolbarActions.map((item) => {
                  const isProto = item.kind === 'prototype'
                  const isProdutos = item.kind === 'produtos'
                  const isEstoque = item.kind === 'estoque'
                  const isClientes = item.kind === 'clientes'
                  const isVender = item.kind === 'vender'
                  const isCaixa = item.kind === 'caixa'
                  const clicavel = isProto || isProdutos || isEstoque || isClientes || isVender || isCaixa
                  const base =
                    'flex flex-col items-center justify-start gap-2 w-[4.75rem] sm:w-[5.5rem] shrink-0 rounded-xl border px-2 py-3 text-center transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2'
                  const enabled =
                    clicavel
                      ? 'border-[var(--accent)] bg-teal-50/90 text-[var(--accent)] shadow-md hover:bg-teal-100/90 hover:border-[var(--accent-hover)] hover:shadow-lg'
                      : 'border-[var(--border)] bg-[var(--surface)]/80 text-[var(--text-muted)] opacity-65 cursor-not-allowed'

                  const title = isProto
                    ? 'Abre fornecedores e cotação (layout atual)'
                    : isProdutos
                      ? 'Gestão de cadastro de produtos'
                      : isEstoque
                        ? 'Controle de estoque e montagem de kits'
                      : isClientes
                        ? 'Gestão de cadastro de clientes'
                        : isVender
                          ? 'Abrir vendas (PDV)'
                          : isCaixa
                            ? 'Fechamento de caixa e resumo de turno'
                            : 'Em breve'

                  return (
                    <button
                      key={item.id}
                      type="button"
                      disabled={!clicavel}
                      title={title}
                      onClick={
                        isProto
                          ? onOpenPrototype
                          : isProdutos
                            ? onOpenProdutos
                            : isEstoque
                              ? onOpenEstoque
                            : isClientes
                              ? onOpenClientes
                              : isVender
                                ? onOpenVender
                                : isCaixa
                                  ? onOpenCaixa
                                  : undefined
                      }
                      className={`${base} ${enabled}`}
                    >
                      <span className={`flex items-center justify-center ${clicavel ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{item.icon}</span>
                      <span className={`text-[11px] sm:text-xs font-semibold leading-tight ${clicavel ? 'text-[var(--text)]' : 'text-[var(--text-muted)]'}`}>
                        {item.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </section>

          <section className="mt-8 sm:mt-10 rounded-3xl border border-[var(--border)] bg-[var(--surface-card)]/95 backdrop-blur px-6 sm:px-10 py-10 sm:py-14 text-center shadow-sm">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--accent)] text-white font-bold text-xl mb-6 shadow-lg shadow-teal-900/15">
              PC
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Pedal Construtivo</h2>
            <p className="mt-2 text-[var(--text-muted)] max-w-lg mx-auto text-sm sm:text-base">
              Gestão para o varejo da construção — interface renovada, dados locais e prontos para evoluir com sincronização em nuvem.
            </p>
          </section>
        </div>
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface-card)]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px] sm:text-xs text-[var(--text-muted)]">
          <span>
            Versão <span className="font-mono text-[var(--text)]">0.0.0</span>
            {' · '}
            Dados: <span className="font-medium text-[var(--text)]">{DATA_MODE === 'local' ? 'local' : 'Supabase'}</span>
          </span>
          <span className="flex items-center gap-2 sm:justify-end">
            {DATA_MODE === 'supabase' && (
              <>
                <button
                  type="button"
                  disabled={syncStatus === 'syncing'}
                  onClick={() => {
                    void (async () => {
                      try {
                        setSyncStatus('syncing')
                        await forceSyncLocalToSupabase()
                        setSyncStatus('ok')
                        window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'sync' } }))
                        setTimeout(() => setSyncStatus('idle'), 2500)
                      } catch {
                        setSyncStatus('error')
                        setTimeout(() => setSyncStatus('idle'), 3500)
                      }
                    })()
                  }}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-[var(--text)] hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                  title="Envia todo o banco offline (desta porta) para o Supabase"
                >
                  {syncStatus === 'syncing'
                    ? 'Sincronizando…'
                    : syncStatus === 'ok'
                      ? 'Sincronizado'
                      : syncStatus === 'error'
                        ? 'Falhou'
                        : 'Sincronizar offline → Supabase'}
                </button>
              </>
            )}
            <span className="font-mono sm:text-right">
              Modo offline · camada remota: {DATA_MODE === 'supabase' ? 'ativa (Supabase)' : 'desativada'}
            </span>
          </span>
        </div>
      </footer>
    </div>
  )
}
