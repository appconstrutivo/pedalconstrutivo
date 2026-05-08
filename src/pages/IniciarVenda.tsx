import { useMemo, useState } from 'react'
import {
  ModalPerguntaAberturaTurno,
  ModalSaldoAberturaTurno,
  ResumoTurnoAbertoInline,
} from '../components/AberturaTurnoModals'
import { ModalSegundaViaRecibo } from '../components/ModalSegundaViaRecibo'
import { ReciboVenda } from '../components/ReciboVenda'
import type {
  Cliente,
  ItemLancamentoVenda,
  ModoBuscaClienteVenda,
  ModoLancamentoVenda,
  PdvBootstrap,
  RegistroVendaHistorico,
} from '../types'
import {
  obterAberturaTurnoHoje,
  obterSaldoProximoCaixaSugerido,
  registrarAberturaTurno,
  turnoJaAbertoNoDiaCorrente,
} from '../store/turnoCaixa'
import { encontrarClienteVenda } from '../utils/buscaClienteVenda'
import { loadClientes } from '../store/clientes'
import { loadRegistrosMovimentacao, itensHistoricoParaPdv } from '../store/historicoMovimentacao'
import {
  loadOrcamentosRascunho,
  removeOrcamentoRascunho,
  type OrcamentoRascunho,
} from '../store/orcamentosRascunho'
import { formatarBrl } from '../utils/moeda'
import { diaLocalDeIso } from '../utils/datasLocal'

type Props = {
  modo: ModoLancamentoVenda
  onModo: (m: ModoLancamentoVenda) => void
  onContinuar: (cliente: Cliente | null) => void
  /** Retomar rascunho ou converter orçamento do histórico em PDV (venda ou orçamento). */
  onAbrirPdvComBootstrap: (b: PdvBootstrap) => void
  onVoltar: () => void
}

function resolverClienteParaBootstrap(
  clienteId: string | null,
  clienteNome: string | null,
): { cliente: Cliente | null; fallback: string | null } {
  if (clienteId) {
    const c = loadClientes().find((x) => x.id === clienteId && x.ativo !== false)
    if (c) return { cliente: c, fallback: null }
  }
  const nome = clienteNome?.trim()
  return { cliente: null, fallback: nome || null }
}

export function IniciarVenda({ modo, onModo, onContinuar, onAbrirPdvComBootstrap, onVoltar }: Props) {
  const [termo, setTermo] = useState('')
  const [modoBusca, setModoBusca] = useState<ModoBuscaClienteVenda>('nome')
  const [clientePendente, setClientePendente] = useState<Cliente | null>(null)
  const [modalPerguntaTurno, setModalPerguntaTurno] = useState(false)
  const [modalSaldoTurno, setModalSaldoTurno] = useState(false)
  const [avisoTurno, setAvisoTurno] = useState<string | null>(null)
  const [modalSegundaVia, setModalSegundaVia] = useState(false)
  const [listaOrcamentosVersao, setListaOrcamentosVersao] = useState(0)
  const [recibo2via, setRecibo2via] = useState<{
    numeroDocumento: string
    emitidoEmIso: string
    clienteNome: string | null
    itens: ItemLancamentoVenda[]
    pagamento?: RegistroVendaHistorico['pagamento'] | null
  } | null>(null)

  const turnoHoje = obterAberturaTurnoHoje()

  const rascunhos = useMemo(() => {
    return loadOrcamentosRascunho()
      .filter((x) => x.itens.length > 0)
      .sort((a, b) => (a.atualizadoEmIso < b.atualizadoEmIso ? 1 : -1))
  }, [listaOrcamentosVersao])

  const vendasTurnoHoje = useMemo(() => {
    const dataRef = turnoHoje?.dataReferencia
    if (!dataRef) return []
    return loadRegistrosMovimentacao()
      .filter((r): r is RegistroVendaHistorico => r.kind === 'venda')
      .filter((v) => !v.cancelamento?.canceladoEmIso)
      .filter((v) => diaLocalDeIso(v.emitidoEmIso || '') === dataRef)
      .sort((a, b) => (a.emitidoEmIso < b.emitidoEmIso ? 1 : -1))
      .slice(0, 50)
  }, [listaOrcamentosVersao, turnoHoje?.dataReferencia])

  function montarBootstrapDesdeRascunho(r: OrcamentoRascunho, modoAlvo: ModoLancamentoVenda): PdvBootstrap {
    const { cliente, fallback } = resolverClienteParaBootstrap(r.clienteId, r.clienteNome)
    return {
      modo: modoAlvo,
      cliente,
      clienteNomeFallback: fallback,
      itens: r.itens.map((i) => ({ ...i })),
      observacoes: r.observacoes,
      rascunhoId: r.id,
    }
  }

  function iniciar() {
    setAvisoTurno(null)
    const c = encontrarClienteVenda(termo, modoBusca)
    if (!turnoJaAbertoNoDiaCorrente()) {
      setClientePendente(c)
      setModalPerguntaTurno(true)
      return
    }
    onContinuar(c)
  }

  function aoSimAberturaTurno() {
    setModalPerguntaTurno(false)
    setModalSaldoTurno(true)
  }

  function aoNaoAberturaTurno() {
    setModalPerguntaTurno(false)
    setClientePendente(null)
    setAvisoTurno('É necessário abrir o turno para iniciar vendas ou orçamentos no caixa.')
  }

  function aoConfirmarSaldo(saldo: number) {
    registrarAberturaTurno(saldo)
    setModalSaldoTurno(false)
    const c = clientePendente
    setClientePendente(null)
    if (c !== null) onContinuar(c)
  }

  function aoCancelarSaldo() {
    setModalSaldoTurno(false)
    setClientePendente(null)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] shrink-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">PDV</p>
            <h1 className="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">Caixa livre</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)] max-w-xl">
              Busca de cliente, modo de lançamento e retomada de orçamentos — uso em largura total para operação no balcão.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setModalSegundaVia(true)}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
              title="Gerar/imprimir segunda via do recibo por Nº do documento"
            >
              2ª via do recibo
            </button>
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Voltar ao painel
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-stretch flex-1 min-h-0 xl:min-h-[calc(100vh-200px)]">
          {/* Coluna de contexto / novo lançamento */}
          <section className="xl:col-span-4 flex flex-col gap-4 min-w-0 shrink-0 xl:shrink">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-sm p-5 sm:p-6 space-y-5 flex flex-col">
              {turnoHoje && (
                <ResumoTurnoAbertoInline saldo={turnoHoje.saldoAbertura} abertoEmIso={turnoHoje.abertoEmIso} />
              )}
              {avisoTurno && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {avisoTurno}
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-1">
                  <label htmlFor="modo-lanc" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                    Modo de lançamento
                  </label>
                  <select
                    id="modo-lanc"
                    value={modo}
                    onChange={(e) => onModo(e.target.value as ModoLancamentoVenda)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm font-medium text-[var(--text)]"
                  >
                    <option value="venda">Venda</option>
                    <option value="orcamento">Orçamento</option>
                  </select>
                </div>
                <div className="sm:col-span-1">
                  <label htmlFor="operador" className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1.5">
                    Operador
                  </label>
                  <select
                    id="operador"
                    disabled
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm text-[var(--text-muted)] cursor-not-allowed"
                  >
                    <option>Administrador</option>
                  </select>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1 leading-snug">
                    Seleção e cadastro de operadores em versão futura.
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-5 space-y-3">
                <p className="text-xs text-[var(--text-muted)]">
                  Busca por CPF/CNPJ, código, telefone ou nome — Enter ou botão para iniciar.
                </p>
                <div>
                  <label htmlFor="busca-cli-venda" className="block text-sm font-medium text-[var(--text)] mb-1.5">
                    Buscar cliente
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="busca-cli-venda"
                      type="search"
                      value={termo}
                      onChange={(e) => setTermo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          iniciar()
                        }
                      }}
                      className="flex-1 rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm min-w-0"
                      placeholder="Digite e confirme…"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={iniciar}
                      className="shrink-0 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-[var(--accent)] hover:bg-teal-50"
                      title="Buscar e iniciar"
                      aria-label="Buscar e iniciar"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="7" />
                        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">Filtrar busca por</legend>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-2 text-sm">
                    {(
                      [
                        ['nome', 'Nome'],
                        ['cpfCnpj', 'CPF/CNPJ'],
                        ['codigo', 'Código'],
                        ['telefone', 'Telefone'],
                      ] as const
                    ).map(([val, lab]) => (
                      <label key={val} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="modo-busca-venda"
                          checked={modoBusca === val}
                          onChange={() => setModoBusca(val)}
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>

              <button
                type="button"
                onClick={iniciar}
                className="w-full rounded-xl bg-[var(--accent)] py-3.5 text-sm font-bold text-white hover:bg-[var(--accent-hover)] shadow-sm mt-auto"
              >
                Iniciar lançamento
              </button>
            </div>
          </section>

          {/* Painéis de orçamentos — altura limitada + scroll */}
          <div className="xl:col-span-8 flex flex-col gap-6 min-h-0 xl:min-h-0 xl:h-full">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-sm flex flex-col flex-1 min-h-[200px] max-h-[min(52vh,420px)] xl:max-h-none xl:min-h-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wide">
                    Orçamentos salvos neste computador
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Rascunhos não finalizados; converta em venda quando o cliente aceitar.
                  </p>
                </div>
                <span className="tabular-nums rounded-full bg-teal-100 text-teal-900 text-xs font-bold px-2.5 py-0.5 border border-teal-200/80">
                  {rascunhos.length}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {rascunhos.length === 0 ? (
                  <p className="p-4 text-sm text-[var(--text-muted)]">Nenhum orçamento salvo.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                      <thead className="sticky top-0 z-[1] bg-[var(--surface)] border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Cliente</th>
                          <th className="px-4 py-2.5 font-medium text-right w-28">Valor</th>
                          <th className="px-4 py-2.5 font-medium w-36">Atualizado</th>
                          <th className="px-4 py-2.5 font-medium text-right w-[280px]">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rascunhos.map((r) => {
                          const total = r.itens.reduce((s, i) => s + i.subtotal, 0)
                          const rotulo =
                            r.clienteNome?.trim() ||
                            (r.clienteId ? `Cliente #${r.clienteId.slice(0, 8)}…` : 'Cliente não informado')
                          return (
                            <tr key={r.id} className="border-b border-[var(--border)]/70 hover:bg-teal-50/40 align-middle">
                              <td className="px-4 py-3 font-medium text-[var(--text)]">{rotulo}</td>
                              <td className="px-4 py-3 text-right tabular-nums text-[var(--text)]">{formatarBrl(total)}</td>
                              <td className="px-4 py-3 text-[var(--text-muted)] text-xs tabular-nums whitespace-nowrap">
                                {new Date(r.atualizadoEmIso).toLocaleString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <div className="flex flex-wrap justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => onAbrirPdvComBootstrap(montarBootstrapDesdeRascunho(r, 'orcamento'))}
                                    className="rounded-lg border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)] whitespace-nowrap"
                                  >
                                    Continuar orçamento
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onAbrirPdvComBootstrap(montarBootstrapDesdeRascunho(r, 'venda'))}
                                    className="rounded-lg bg-[var(--accent)] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
                                  >
                                    Converter em venda
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (!window.confirm('Excluir este rascunho salvo?')) return
                                      removeOrcamentoRascunho(r.id)
                                      setListaOrcamentosVersao((v) => v + 1)
                                    }}
                                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-800 whitespace-nowrap"
                                  >
                                    Excluir
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-sm flex flex-col flex-1 min-h-[180px] max-h-[min(44vh,380px)] xl:max-h-none xl:min-h-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/80 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div>
                  <h2 className="text-sm font-bold text-[var(--text)] uppercase tracking-wide">
                    Vendas finalizadas no turno (hoje)
                  </h2>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Histórico do dia (caixa aberto) — apenas consulta/segunda via.
                  </p>
                </div>
                <span className="tabular-nums rounded-full bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-0.5 border border-slate-200">
                  {vendasTurnoHoje.length}
                </span>
              </div>
              <div className="flex-1 min-h-0 overflow-auto">
                {!turnoHoje ? (
                  <p className="p-4 text-sm text-[var(--text-muted)]">
                    Abra o turno para visualizar o histórico de vendas do dia.
                  </p>
                ) : vendasTurnoHoje.length === 0 ? (
                  <p className="p-4 text-sm text-[var(--text-muted)]">
                    Nenhuma venda finalizada registrada no turno de hoje.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead className="sticky top-0 z-[1] bg-[var(--surface)] border-b border-[var(--border)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                        <tr>
                          <th className="px-4 py-2.5 font-medium">Documento</th>
                          <th className="px-4 py-2.5 font-medium">Cliente</th>
                          <th className="px-4 py-2.5 font-medium text-right w-28">Total</th>
                          <th className="px-4 py-2.5 font-medium text-right w-40">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {vendasTurnoHoje.map((reg) => (
                          <tr key={reg.id} className="border-b border-[var(--border)]/70 hover:bg-slate-50/80 align-middle">
                            <td className="px-4 py-3 font-mono text-xs font-semibold text-[var(--text)] whitespace-nowrap">
                              Nº {reg.numeroDocumento}
                            </td>
                            <td className="px-4 py-3 text-[var(--text)]">{reg.clienteNome?.trim() || '—'}</td>
                            <td className="px-4 py-3 text-right tabular-nums font-medium">
                              {formatarBrl(reg.pagamento.totalAPagar)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="flex flex-wrap justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRecibo2via({
                                      numeroDocumento: reg.numeroDocumento,
                                      emitidoEmIso: reg.emitidoEmIso,
                                      clienteNome: reg.clienteNome,
                                      itens: itensHistoricoParaPdv(reg.itens),
                                      pagamento: reg.pagamento,
                                    })
                                  }}
                                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--accent-hover)] whitespace-nowrap"
                                >
                                  Ver recibo
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      <ModalPerguntaAberturaTurno
        aberto={modalPerguntaTurno}
        onSim={aoSimAberturaTurno}
        onNao={aoNaoAberturaTurno}
      />
      <ModalSaldoAberturaTurno
        aberto={modalSaldoTurno}
        valorInicialSugerido={obterSaldoProximoCaixaSugerido()}
        onConfirmar={aoConfirmarSaldo}
        onCancelar={aoCancelarSaldo}
      />

      <ModalSegundaViaRecibo
        aberto={modalSegundaVia}
        onFechar={() => setModalSegundaVia(false)}
        onAbrirRecibo={(p) => setRecibo2via(p)}
      />

      {recibo2via && (
        <ReciboVenda
          modo="venda"
          numero={recibo2via.numeroDocumento}
          emissao={new Date(recibo2via.emitidoEmIso)}
          cliente={null}
          clienteNomeFallback={recibo2via.clienteNome}
          itens={recibo2via.itens}
          dadosPagamento={recibo2via.pagamento ?? null}
          imprimirAoAbrir
          onFechar={() => setRecibo2via(null)}
        />
      )}
    </div>
  )
}
