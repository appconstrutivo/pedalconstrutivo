import { useEffect, useMemo, useState } from 'react'
import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import { loadClientes } from '../store/clientes'
import { loadProdutos } from '../store/produtos'
import { loadTiposProduto } from '../store/tiposProduto'
import { atualizarDataEmissaoPorDocumento, loadRegistrosMovimentacao } from '../store/historicoMovimentacao'
import { fetchRegistrosMovimentacaoFromSupabase } from '../supabase/historico'
import { formatarBrl } from '../utils/moeda'
import {
  datasPorPreset,
  filtrarRegistros,
  montarLinhasRelatorio,
  totaisRelatorio,
  type ListagemItensPor,
  type ModoRelatorio,
  type ParametrosRelatorioVendas,
  type PresetIntervalo,
} from '../utils/relatorioVendas'
import { obterAberturaTurnoHoje, removerVendaDoTurnoAtual } from '../store/turnoCaixa'

type Props = {
  aberto: boolean
  onFechar: () => void
}

const VENDEDORES = ['Administrador']

export function ModalRelatorioMovimentacaoVendas({ aberto, onFechar }: Props) {
  const [etapa, setEtapa] = useState<'filtros' | 'resultado'>('filtros')
  const [modo, setModo] = useState<ModoRelatorio>('finalizadas')
  const [detalhe, setDetalhe] = useState<'venda' | 'item'>('venda')
  const [openOrcamentos, setOpenOrcamentos] = useState(true)
  const [preset, setPreset] = useState<PresetIntervalo>('mes')
  const [dataInicio, setDataInicio] = useState(() => datasPorPreset('mes').inicio)
  const [dataFim, setDataFim] = useState(() => datasPorPreset('mes').fim)

  const [filtroCliente, setFiltroCliente] = useState(false)
  const [clienteId, setClienteId] = useState('')
  const [filtroVendedor, setFiltroVendedor] = useState(false)
  const [vendedorNome, setVendedorNome] = useState('Administrador')
  const [filtroProduto, setFiltroProduto] = useState(false)
  const [produtoId, setProdutoId] = useState('')
  const [filtroTipo, setFiltroTipo] = useState(false)
  const [tipoId, setTipoId] = useState('')

  const [agrDia, setAgrDia] = useState(true)
  const [agrCliente, setAgrCliente] = useState(false)
  const [agrProduto, setAgrProduto] = useState(false)
  const [agrPagamento, setAgrPagamento] = useState(false)
  const [listarPor, setListarPor] = useState<ListagemItensPor>('valor_vendido')

  const [paramsResultado, setParamsResultado] = useState<ParametrosRelatorioVendas | null>(null)
  const [regsSupabase, setRegsSupabase] = useState<ReturnType<typeof loadRegistrosMovimentacao>>([])
  const [carregandoSupabase, setCarregandoSupabase] = useState(false)
  const [erroSupabase, setErroSupabase] = useState<string | null>(null)

  const clientes = useMemo(() => loadClientes().filter((c) => c.ativo !== false), [aberto])
  const produtos = useMemo(() => loadProdutos().filter((p) => p.ativo !== false), [aberto])
  const tipos = useMemo(() => loadTiposProduto(), [aberto])

  useEffect(() => {
    if (!aberto) {
      setEtapa('filtros')
      setParamsResultado(null)
      return
    }
    const { inicio, fim } = datasPorPreset(preset)
    if (preset !== 'outro') {
      setDataInicio(inicio)
      setDataFim(fim)
    }
  }, [aberto, preset])

  useEffect(() => {
    if (modo !== 'aberto') return
    setOpenOrcamentos(true)
  }, [modo])

  function montarParametros(): ParametrosRelatorioVendas {
    return {
      modo,
      detalhe,
      dataInicio,
      dataFim,
      openListaVendasSalvas: false,
      openListaOrcamentos: openOrcamentos,
      filtroCliente: { ativo: filtroCliente, clienteId },
      filtroVendedor: { ativo: filtroVendedor, vendedorNome },
      filtroProduto: { ativo: filtroProduto, produtoId },
      filtroTipo: { ativo: filtroTipo, tipoId },
      agruparPorDia: agrDia,
      agruparPorCliente: agrCliente,
      agruparPorProduto: agrProduto,
      agruparPorFormaPagamento: agrPagamento,
      listarItensPor: listarPor,
    }
  }

  async function gerar() {
    const p = montarParametros()
    setParamsResultado(p)
    setEtapa('resultado')

    const usarSupabase = DATA_MODE === 'supabase' && supabase !== null
    if (!usarSupabase) {
      setRegsSupabase([])
      setErroSupabase(null)
      return
    }

    try {
      setCarregandoSupabase(true)
      setErroSupabase(null)
      const regs = await fetchRegistrosMovimentacaoFromSupabase({ dataInicioYYYYMMDD: p.dataInicio, dataFimYYYYMMDD: p.dataFim })
      setRegsSupabase(regs)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setErroSupabase(msg || 'Falha ao consultar o Supabase.')
      setRegsSupabase([])
    } finally {
      setCarregandoSupabase(false)
    }
  }

  const linhas = useMemo(() => {
    if (!paramsResultado) return []
    const usarSupabase = DATA_MODE === 'supabase' && supabase !== null
    const base = usarSupabase ? regsSupabase : loadRegistrosMovimentacao()
    const regs = filtrarRegistros(base, paramsResultado)
    return montarLinhasRelatorio(regs, paramsResultado)
  }, [paramsResultado, regsSupabase])

  const totais = useMemo(() => totaisRelatorio(linhas), [linhas])

  function ajustarDataDocumento() {
    const numero = window.prompt('Informe o Nº do documento (cupom/venda) para ajustar a data.')?.trim()
    if (!numero) return
    const novaData = window
      .prompt('Informe a nova data (formato YYYY-MM-DD). Ex.: 2026-04-25')?.trim()
    if (!novaData) return

    const antes = loadRegistrosMovimentacao().find((r) => r.numeroDocumento === numero) ?? null
    const atualizado = atualizarDataEmissaoPorDocumento(numero, novaData)
    if (!atualizado) {
      window.alert('Não foi possível ajustar. Verifique o Nº do documento e a data (YYYY-MM-DD).')
      return
    }

    // Se foi uma VENDA e ela estava no dia do turno aberto de hoje, remove do acumulado do turno atual
    // para não distorcer o fechamento de caixa.
    if (antes?.kind === 'venda') {
      const ab = obterAberturaTurnoHoje()
      const diaAntes = (antes.emitidoEmIso || '').slice(0, 10)
      const diaDepois = (atualizado.emitidoEmIso || '').slice(0, 10)
      if (ab && diaAntes === ab.dataReferencia && diaDepois !== ab.dataReferencia) {
        removerVendaDoTurnoAtual(antes.pagamento)
      }
    }

    // força recomputo do relatório
    setParamsResultado((p) => (p ? { ...p } : p))
    window.alert(`Documento ${numero} ajustado para ${novaData}.`)
  }

  if (!aberto) return null

  return (
    <div
      className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-6 bg-slate-900/45 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-rel-vendas"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-5xl w-full max-h-[min(96vh,920px)] flex flex-col">
        <div className="px-4 sm:px-6 py-3 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="titulo-rel-vendas" className="text-base sm:text-lg font-bold text-[var(--text)]">
              Relatório GERAL de movimentação em VENDAS
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Filtros e visualização — {DATA_MODE === 'supabase' && supabase !== null ? 'dados do Supabase' : 'dados locais (do dispositivo)'}
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

        {etapa === 'filtros' ? (
          <div className="overflow-y-auto px-4 sm:px-6 py-4 space-y-5 flex-1 min-h-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <fieldset className="rounded-xl border border-[var(--border)] p-3">
                  <legend className="text-xs font-semibold text-[var(--text)] px-1">Modo do relatório</legend>
                  <div className="space-y-2 text-sm mt-2">
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modo-rel"
                        checked={modo === 'finalizadas'}
                        onChange={() => setModo('finalizadas')}
                      />
                      Movimentações finalizadas (vendas, etc.)
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modo-rel"
                        checked={modo === 'aberto'}
                        onChange={() => setModo('aberto')}
                      />
                      Movimentações em aberto (orçamentos)
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="modo-rel"
                        checked={modo === 'lucratividade'}
                        onChange={() => setModo('lucratividade')}
                      />
                      Lucratividade (lucro sobre vendas finalizadas)
                    </label>
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-[var(--border)] p-3">
                  <legend className="text-xs font-semibold text-[var(--text)] px-1">Detalhamento</legend>
                  <div className="space-y-2 text-sm mt-2">
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="det-rel"
                        checked={detalhe === 'venda'}
                        onChange={() => setDetalhe('venda')}
                      />
                      Por venda realizada
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="det-rel"
                        checked={detalhe === 'item'}
                        onChange={() => setDetalhe('item')}
                      />
                      Por item vendido
                    </label>
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-[var(--border)] p-3 opacity-100">
                  <legend className="text-xs font-semibold text-[var(--text-muted)] px-1">
                    Movimentações em aberto, opções
                  </legend>
                  <div className={`space-y-2 text-sm mt-2 ${modo !== 'aberto' ? 'opacity-45 pointer-events-none' : ''}`}>
                    <label className="flex gap-2 cursor-pointer">
                      <input type="checkbox" checked={false} disabled readOnly />
                      Listar vendas salvas e não finalizadas{' '}
                      <span className="text-[var(--text-muted)]">(em breve)</span>
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={openOrcamentos}
                        onChange={(e) => setOpenOrcamentos(e.target.checked)}
                      />
                      Listar orçamentos em aberto
                    </label>
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-[var(--border)] p-3">
                  <legend className="text-xs font-semibold text-[var(--text)] px-1">Opções de intervalo</legend>
                  <div className="flex flex-wrap gap-3 text-sm mt-2">
                    {(
                      [
                        ['semana', 'Semana'],
                        ['mes', 'Mês'],
                        ['ano', 'Ano'],
                        ['outro', 'Outro'],
                      ] as const
                    ).map(([val, lab]) => (
                      <label key={val} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="preset-rel"
                          checked={preset === val}
                          onChange={() => setPreset(val)}
                        />
                        {lab}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <div className="rounded-xl border border-[var(--border)] p-3 space-y-2">
                  <p className="text-xs font-semibold text-[var(--text)]">Intervalo da consulta</p>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <label htmlFor="rel-ini" className="block text-xs text-[var(--text-muted)] mb-1">
                        Iniciando em
                      </label>
                      <input
                        id="rel-ini"
                        type="date"
                        value={dataInicio}
                        onChange={(e) => {
                          setPreset('outro')
                          setDataInicio(e.target.value)
                        }}
                        className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="rel-fim" className="block text-xs text-[var(--text-muted)] mb-1">
                        Terminando em
                      </label>
                      <input
                        id="rel-fim"
                        type="date"
                        value={dataFim}
                        onChange={(e) => {
                          setPreset('outro')
                          setDataFim(e.target.value)
                        }}
                        className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <fieldset className="rounded-xl border border-[var(--border)] p-3">
                  <legend className="text-xs font-semibold text-[var(--text)] px-1">Opções de filtro</legend>
                  <div className="space-y-3 mt-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={filtroCliente}
                          onChange={(e) => setFiltroCliente(e.target.checked)}
                        />
                        Por cliente
                      </label>
                      <select
                        value={clienteId}
                        onChange={(e) => setClienteId(e.target.value)}
                        disabled={!filtroCliente}
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="">Selecione…</option>
                        {clientes.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={filtroVendedor}
                          onChange={(e) => setFiltroVendedor(e.target.checked)}
                        />
                        Por vendedor
                      </label>
                      <select
                        value={vendedorNome}
                        onChange={(e) => setVendedorNome(e.target.value)}
                        disabled={!filtroVendedor}
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        {VENDEDORES.map((v) => (
                          <option key={v} value={v}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={filtroProduto}
                          onChange={(e) => setFiltroProduto(e.target.checked)}
                        />
                        Por produto
                      </label>
                      <select
                        value={produtoId}
                        onChange={(e) => setProdutoId(e.target.value)}
                        disabled={!filtroProduto}
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="">Selecione…</option>
                        {produtos.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.descricao}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 opacity-60">
                      <span className="text-sm text-[var(--text-muted)]">Por fornecedor</span>
                      <select disabled className="flex-1 rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm cursor-not-allowed">
                        <option>Em breve</option>
                      </select>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-2 shrink-0">
                        <input
                          type="checkbox"
                          checked={filtroTipo}
                          onChange={(e) => setFiltroTipo(e.target.checked)}
                        />
                        Por tipo/categoria
                      </label>
                      <select
                        value={tipoId}
                        onChange={(e) => setTipoId(e.target.value)}
                        disabled={!filtroTipo}
                        className="flex-1 min-w-[140px] rounded-lg border border-[var(--border)] px-2 py-1.5 text-sm disabled:opacity-50"
                      >
                        <option value="">Selecione…</option>
                        {tipos.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </fieldset>

                <fieldset className="rounded-xl border border-[var(--border)] p-3">
                  <legend className="text-xs font-semibold text-[var(--text)] px-1">
                    Opções de agrupamento e visualização
                  </legend>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1 mb-2">
                    Formas de pagamento: apenas as usadas no PDV (dinheiro, pix, cartão, boleto). Terminal não se
                    aplica.
                  </p>
                  <div className="space-y-2 text-sm">
                    <label className="flex gap-2 cursor-pointer">
                      <input type="checkbox" checked={agrDia} onChange={(e) => setAgrDia(e.target.checked)} />
                      Agrupar por dia
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input type="checkbox" checked={agrCliente} onChange={(e) => setAgrCliente(e.target.checked)} />
                      Agrupar por cliente
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input type="checkbox" checked={agrProduto} onChange={(e) => setAgrProduto(e.target.checked)} />
                      Agrupar por produto
                    </label>
                    <label className="flex gap-2 cursor-pointer">
                      <input type="checkbox" checked={agrPagamento} onChange={(e) => setAgrPagamento(e.target.checked)} />
                      Agrupar por forma de pagamento
                    </label>
                  </div>
                </fieldset>

                <div>
                  <label htmlFor="rel-listar" className="block text-xs font-medium text-[var(--text)] mb-1">
                    Os itens serão listados por
                  </label>
                  <select
                    id="rel-listar"
                    value={listarPor}
                    onChange={(e) => setListarPor(e.target.value as ListagemItensPor)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="valor_vendido">Valor que foi vendido</option>
                    <option value="quantidade">Quantidade</option>
                    <option value="valor_custo">Valor de custo</option>
                    <option value="margem">Margem (lucro)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 min-h-0 flex flex-col gap-4">
            <div className="no-print flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEtapa('filtros')}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
              >
                Voltar aos filtros
              </button>
              <button
                type="button"
                onClick={ajustarDataDocumento}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
                title="Ajuste administrativo (corrige dia do documento no histórico local)"
              >
                Ajustar data de documento
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Imprimir
              </button>
            </div>

            {carregandoSupabase && DATA_MODE === 'supabase' && supabase !== null && (
              <div className="rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--text-muted)]">
                Carregando movimentações do Supabase…
              </div>
            )}
            {erroSupabase && DATA_MODE === 'supabase' && supabase !== null && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Falha ao consultar o Supabase: {erroSupabase}
              </div>
            )}

            <div id="relatorio-vendas-print" className="rounded-xl border border-[var(--border)] bg-white overflow-x-auto">
              <div className="p-4 border-b border-[var(--border)] print:border-slate-300">
                <p className="text-sm font-bold text-[var(--text)]">Relatório de movimentação em vendas</p>
                <p className="text-xs text-[var(--text-muted)]">
                  Período: {dataInicio} a {dataFim}
                </p>
              </div>
              <table className="w-full text-xs sm:text-sm min-w-[800px]">
                <thead>
                  <tr className="bg-[var(--surface)] text-left text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="px-2 py-2">Data</th>
                    <th className="px-2 py-2">Documento</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Descrição</th>
                    <th className="px-2 py-2 text-right">Qtd</th>
                    <th className="px-2 py-2 text-right">Unit.</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-right">Custo</th>
                    <th className="px-2 py-2 text-right">Lucro</th>
                    <th className="px-2 py-2">Pagamentos</th>
                  </tr>
                </thead>
                <tbody>
                  {linhas.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        Nenhum registro para os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    linhas.map((l, idx) => (
                      <tr key={`${l.documento}-${idx}`} className="border-b border-[var(--border)]">
                        <td className="px-2 py-1.5 tabular-nums">{l.data.split('-').reverse().join('/')}</td>
                        <td className="px-2 py-1.5 font-mono text-[10px]">{l.documento}</td>
                        <td className="px-2 py-1.5">{l.cliente}</td>
                        <td className="px-2 py-1.5 max-w-[200px] truncate">{l.descricao}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">{formatarBrl(l.unitario)}</td>
                        <td className="px-2 py-1.5 text-right font-medium tabular-nums">{formatarBrl(l.total)}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">
                          {formatarBrl(l.custoTotal)}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-emerald-800">{formatarBrl(l.lucro)}</td>
                        <td className="px-2 py-1.5 text-[10px] text-[var(--text-muted)] max-w-[140px]">
                          {l.formasPagamento}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {linhas.length > 0 && (
                  <tfoot>
                    <tr className="bg-teal-50/80 font-semibold border-t-2 border-[var(--accent)]">
                      <td colSpan={6} className="px-2 py-2 text-right">
                        Totais
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatarBrl(totais.totalVendas)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatarBrl(totais.totalCusto)}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{formatarBrl(totais.totalLucro)}</td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}

        {etapa === 'filtros' && (
          <div className="px-4 sm:px-6 py-3 border-t border-[var(--border)] flex justify-end gap-2 shrink-0 bg-[var(--surface)]/50">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={gerar}
              className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-bold text-white hover:bg-[var(--accent-hover)]"
            >
              Gerar relatório
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
