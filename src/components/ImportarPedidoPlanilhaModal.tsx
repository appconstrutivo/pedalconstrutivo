import { useCallback, useMemo, useState } from 'react'
import type { ConflitoCustoEntradaPlanilha, DecisaoCustoMenorComEstoque } from '../types'
import type { LinhaPlanilhaPedido } from '../utils/importPedidoExcel'
import { lerPlanilhaPedidoFornecedor } from '../utils/importPedidoExcel'
import {
  analisarEntradaPedidoPlanilha,
  aplicarEntradaPedidoPlanilha,
  type MetaEntradaPedidoPlanilha,
} from '../store/aplicarEntradaPedidoPlanilha'
import { loadFornecedores } from '../store/fornecedores'
import { formatarBrl } from '../utils/moeda'

type Props = {
  aberto: boolean
  onFechar: () => void
  onConcluido: () => void
}

export function ImportarPedidoPlanilhaModal({ aberto, onFechar, onConcluido }: Props) {
  const [etapa, setEtapa] = useState<'preview' | 'custos'>('preview')
  const [nomeArquivo, setNomeArquivo] = useState('')
  const [linhas, setLinhas] = useState<LinhaPlanilhaPedido[]>([])
  const [avisosLeitura, setAvisosLeitura] = useState<string[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [processando, setProcessando] = useState(false)
  const [conflitosCusto, setConflitosCusto] = useState<ConflitoCustoEntradaPlanilha[]>([])
  const [decisoesCusto, setDecisoesCusto] = useState<Record<number, DecisaoCustoMenorComEstoque>>({})
  const [fornecedorId, setFornecedorId] = useState('')
  const [pctLucroSobreCusto, setPctLucroSobreCusto] = useState(30)

  const fornecedores = useMemo(() => {
    if (!aberto) return []
    return loadFornecedores().filter((f) => f.ativo !== false)
  }, [aberto])

  const reset = useCallback(() => {
    setEtapa('preview')
    setNomeArquivo('')
    setLinhas([])
    setAvisosLeitura([])
    setErro(null)
    setProcessando(false)
    setConflitosCusto([])
    setDecisoesCusto({})
    setFornecedorId('')
    setPctLucroSobreCusto(30)
  }, [])

  const aoFechar = useCallback(() => {
    reset()
    onFechar()
  }, [onFechar, reset])

  function construirMeta(): MetaEntradaPedidoPlanilha | null {
    const f = fornecedores.find((x) => x.id === fornecedorId)
    if (!f) return null
    const pct = Number(pctLucroSobreCusto)
    if (!Number.isFinite(pct) || pct < 0) return null
    return { fornecedorId: f.id, fornecedorNome: f.nome, pctLucroSobreCusto: pct }
  }

  async function aoEscolherArquivo(file: File | null) {
    setErro(null)
    setAvisosLeitura([])
    setLinhas([])
    setEtapa('preview')
    setConflitosCusto([])
    setDecisoesCusto({})
    if (!file) return
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setErro('Envie um arquivo Excel (.xlsx ou .xls).')
      return
    }
    try {
      const buf = await file.arrayBuffer()
      const { linhas: L, erros } = lerPlanilhaPedidoFornecedor(buf)
      setNomeArquivo(file.name)
      setLinhas(L)
      setAvisosLeitura(erros)
      if (L.length === 0) {
        setErro(
          erros.length
            ? 'Nenhuma linha válida. Veja os avisos abaixo.'
            : 'Nenhuma linha de produto encontrada na planilha.',
        )
      }
    } catch {
      setErro('Falha ao ler o arquivo.')
    }
  }

  function definirDecisaoTodos(escolha: DecisaoCustoMenorComEstoque) {
    const next: Record<number, DecisaoCustoMenorComEstoque> = {}
    for (const c of conflitosCusto) {
      next[c.linhaIndex] = escolha
    }
    setDecisoesCusto(next)
  }

  function avançarOuAplicarDireto() {
    if (linhas.length === 0 || !nomeArquivo) return
    const meta = construirMeta()
    if (!fornecedorId) {
      setErro('Selecione o fornecedor ao qual esta planilha se refere.')
      return
    }
    if (!meta) {
      setErro('Informe um percentual de lucro sobre o custo válido (≥ 0).')
      return
    }
    setErro(null)
    setProcessando(true)
    try {
      const conflitos = analisarEntradaPedidoPlanilha(linhas)
      if (conflitos.length === 0) {
        aplicarEntradaPedidoPlanilha(linhas, nomeArquivo, new Map(), meta)
        onConcluido()
        aoFechar()
        return
      }
      const init: Record<number, DecisaoCustoMenorComEstoque> = {}
      for (const c of conflitos) {
        init[c.linhaIndex] = 'manter_custo_anterior'
      }
      setDecisoesCusto(init)
      setConflitosCusto(conflitos)
      setEtapa('custos')
    } finally {
      setProcessando(false)
    }
  }

  function aplicarComDecisoes() {
    if (linhas.length === 0 || !nomeArquivo) return
    const meta = construirMeta()
    if (!meta) {
      setErro('Fornecedor ou percentual de lucro inválido. Volte e confira.')
      return
    }
    setProcessando(true)
    try {
      const map = new Map<number, DecisaoCustoMenorComEstoque>()
      for (const c of conflitosCusto) {
        map.set(c.linhaIndex, decisoesCusto[c.linhaIndex] ?? 'manter_custo_anterior')
      }
      aplicarEntradaPedidoPlanilha(linhas, nomeArquivo, map, meta)
      onConcluido()
      aoFechar()
    } finally {
      setProcessando(false)
    }
  }

  if (!aberto) return null

  const preview = linhas.slice(0, 80)

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-pedido-titulo"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[min(92vh,900px)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="import-pedido-titulo" className="text-lg font-bold text-[var(--text)]">
              {etapa === 'preview' ? 'Entrada por planilha de pedido' : 'Custo menor — decisão necessária'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {etapa === 'preview' ? (
                <>
                  Planilha com colunas <strong className="text-[var(--text)]">SKU</strong>,{' '}
                  <strong className="text-[var(--text)]">Nome</strong>,{' '}
                  <strong className="text-[var(--text)]">Preço de Venda</strong>,{' '}
                  <strong className="text-[var(--text)]">Quantidade</strong> e{' '}
                  <strong className="text-[var(--text)]">Total</strong>. O valor da coluna de preço será gravado como{' '}
                  <strong className="text-[var(--text)]">custo</strong>. Se o custo da planilha for{' '}
                  <strong className="text-[var(--text)]">maior</strong> que o cadastro, o sistema atualiza sem perguntar.
                  Se for <strong className="text-[var(--text)]">menor</strong> e ainda houver estoque, você escolhe se
                  mantém o custo anterior ou passa a usar o novo.
                </>
              ) : (
                <>
                  Para os itens abaixo, o custo na planilha é <strong className="text-[var(--text)]">inferior</strong> ao
                  cadastrado e ainda existe quantidade em estoque. Abrir mão do custo maior pode distorcer o valor das
                  unidades já existentes. O estoque da nova entrada será somado em qualquer caso. Com estoque zerado, o
                  custo menor é aplicado automaticamente (sem esta etapa).
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={aoFechar}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
          {etapa === 'preview' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="import-fornecedor" className="block text-sm font-medium text-[var(--text)] mb-1.5">
                    Fornecedor da planilha
                  </label>
                  <select
                    id="import-fornecedor"
                    value={fornecedorId}
                    onChange={(e) => setFornecedorId(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {fornecedores.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                      </option>
                    ))}
                  </select>
                  {fornecedores.length === 0 ? (
                    <p className="mt-1.5 text-xs text-amber-800">
                      Cadastre fornecedores em <strong className="text-[var(--text)]">Cadastros → Fornecedores</strong>{' '}
                      antes de importar.
                    </p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor="import-lucro" className="block text-sm font-medium text-[var(--text)] mb-1.5">
                    Lucro sobre o custo (%)
                  </label>
                  <input
                    id="import-lucro"
                    type="number"
                    min={0}
                    step="0.01"
                    value={pctLucroSobreCusto}
                    onChange={(e) => setPctLucroSobreCusto(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                    Aplicado ao <strong className="text-[var(--text)]">varejo</strong> e{' '}
                    <strong className="text-[var(--text)]">atacado</strong> com base no custo final de cada linha (custo ×
                    (1 + %/100)).
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-2">Arquivo Excel</label>
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => void aoEscolherArquivo(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-[var(--text)] file:mr-3 file:rounded-xl file:border file:border-[var(--border)] file:bg-white file:px-3 file:py-2 file:text-sm"
                />
                {nomeArquivo ? (
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Selecionado: <span className="font-mono text-[var(--text)]">{nomeArquivo}</span> · {linhas.length}{' '}
                    linha(s)
                  </p>
                ) : null}
              </div>

              {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

              {avisosLeitura.length > 0 ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 space-y-1 max-h-28 overflow-y-auto">
                  <p className="font-semibold">Avisos na leitura</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    {avisosLeitura.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {linhas.length > 0 ? (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden">
                  <p className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface)] border-b border-[var(--border)]">
                    Pré-visualização{' '}
                    {preview.length < linhas.length ? `(primeiras ${preview.length} de ${linhas.length})` : null}
                  </p>
                  <div className="overflow-x-auto max-h-[min(50vh,420px)]">
                    <table className="w-full text-xs min-w-[640px]">
                      <thead>
                        <tr className="text-left text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--surface)]/80">
                          <th className="px-2 py-2">SKU fornec.</th>
                          <th className="px-2 py-2">Descrição</th>
                          <th className="px-2 py-2 text-right">Custo un.</th>
                          <th className="px-2 py-2 text-right">Qtd</th>
                          <th className="px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((l, i) => (
                          <tr key={i} className="border-b border-[var(--border)]/70">
                            <td className="px-2 py-1.5 font-mono">{l.skuFornecedor}</td>
                            <td className="px-2 py-1.5 text-[var(--text)]">{l.descricao}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{formatarBrl(l.custoUnitario)}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{l.quantidade}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{formatarBrl(l.totalLinha)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => definirDecisaoTodos('manter_custo_anterior')}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  Em todos: manter custo do cadastro
                </button>
                <button
                  type="button"
                  onClick={() => definirDecisaoTodos('usar_novo_custo')}
                  className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  Em todos: usar custo da planilha
                </button>
              </div>

              <div className="rounded-xl border border-[var(--border)] overflow-hidden max-h-[min(55vh,480px)] overflow-y-auto">
                <table className="w-full text-xs min-w-[720px]">
                  <thead className="sticky top-0 bg-[var(--surface)] z-[1] border-b border-[var(--border)]">
                    <tr className="text-left text-[var(--text-muted)]">
                      <th className="px-2 py-2">Linha</th>
                      <th className="px-2 py-2">SKU</th>
                      <th className="px-2 py-2">Produto</th>
                      <th className="px-2 py-2 text-right">Estq. atual</th>
                      <th className="px-2 py-2 text-right">Custo cad.</th>
                      <th className="px-2 py-2 text-right">Custo plan.</th>
                      <th className="px-2 py-2">Decisão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflitosCusto.map((c) => {
                      const d = decisoesCusto[c.linhaIndex] ?? 'manter_custo_anterior'
                      return (
                        <tr key={c.linhaIndex} className="border-b border-[var(--border)]/70 align-top">
                          <td className="px-2 py-2 tabular-nums text-[var(--text-muted)]">{c.linhaIndex + 1}</td>
                          <td className="px-2 py-2 font-mono">{c.skuFornecedor}</td>
                          <td className="px-2 py-2 text-[var(--text)]">{c.descricaoProduto}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{c.estoqueAntes}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatarBrl(c.custoAtual)}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatarBrl(c.custoNovo)}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-col gap-1.5">
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`dec-${c.linhaIndex}`}
                                  checked={d === 'manter_custo_anterior'}
                                  onChange={() =>
                                    setDecisoesCusto((prev) => ({
                                      ...prev,
                                      [c.linhaIndex]: 'manter_custo_anterior',
                                    }))
                                  }
                                />
                                <span>Manter custo atual</span>
                              </label>
                              <label className="inline-flex items-center gap-2 cursor-pointer">
                                <input
                                  type="radio"
                                  name={`dec-${c.linhaIndex}`}
                                  checked={d === 'usar_novo_custo'}
                                  onChange={() =>
                                    setDecisoesCusto((prev) => ({
                                      ...prev,
                                      [c.linhaIndex]: 'usar_novo_custo',
                                    }))
                                  }
                                />
                                <span>Usar custo da planilha (menor)</span>
                              </label>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap justify-between gap-2 shrink-0 bg-[var(--surface)]/50 rounded-b-2xl">
          <div>
            {etapa === 'custos' ? (
              <button
                type="button"
                onClick={() => setEtapa('preview')}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
              >
                Voltar
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              Cancelar
            </button>
            {etapa === 'preview' ? (
              <button
                type="button"
                disabled={
                  linhas.length === 0 || processando || !fornecedorId || fornecedores.length === 0
                }
                onClick={avançarOuAplicarDireto}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? 'Analisando…' : 'Confirmar entrada no estoque'}
              </button>
            ) : (
              <button
                type="button"
                disabled={processando || conflitosCusto.length === 0}
                onClick={aplicarComDecisoes}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processando ? 'Gravando…' : 'Aplicar entrada com estas decisões'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
