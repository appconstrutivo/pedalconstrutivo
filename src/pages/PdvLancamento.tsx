import { useEffect, useMemo, useState } from 'react'
import { ModalPagamentoVenda } from '../components/ModalPagamentoVenda'
import { ReciboVenda } from '../components/ReciboVenda'
import type {
  Cliente,
  DadosPagamentoVenda,
  ItemLancamentoVenda,
  ModoLancamentoVenda,
  PdvBootstrap,
  Produto,
} from '../types'
import { baixarEstoquePorVenda, loadProdutos } from '../store/produtos'
import { appendRegistroOrcamento, appendRegistroVenda, itensParaHistorico } from '../store/historicoMovimentacao'
import { removeOrcamentoRascunho, upsertOrcamentoRascunho } from '../store/orcamentosRascunho'
import { acumularVendaNoTurnoAtual } from '../store/turnoCaixa'
import { formatarBrl, subtotalLinhaPdv } from '../utils/moeda'

function normalizarItensDoBootstrap(rows: ItemLancamentoVenda[]): ItemLancamentoVenda[] {
  return rows.map((i) => {
    const raw = i as ItemLancamentoVenda & { descontoPercentual?: number }
    const desconto =
      typeof raw.descontoPercentual === 'number' && Number.isFinite(raw.descontoPercentual)
        ? Math.min(100, Math.max(0, raw.descontoPercentual))
        : 0
    return {
      ...i,
      descontoPercentual: desconto,
      subtotal: subtotalLinhaPdv(i.quantidade, i.precoUnitario, desconto),
    }
  })
}

type Props = {
  modo: ModoLancamentoVenda
  cliente: Cliente | null
  clienteNomeFallback?: string | null
  pdvSeed: PdvBootstrap | null
  onVoltar: () => void
  onSair: () => void
}

type Precificacao = 'varejo' | 'atacado'

function precoPorModo(p: Produto, modo: Precificacao): number {
  return modo === 'varejo' ? p.valorVarejo : p.valorAtacado
}

function urlImagemPublicaValida(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function gerarNumeroDocumento(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

export function PdvLancamento({
  modo,
  cliente,
  clienteNomeFallback = null,
  pdvSeed,
  onVoltar,
  onSair,
}: Props) {
  const [listaVersao, setListaVersao] = useState(0)
  const produtos = useMemo(
    () => loadProdutos().filter((p) => p.ativo !== false),
    [listaVersao],
  )

  const [produtoId, setProdutoId] = useState('')
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtoDropdownAberto, setProdutoDropdownAberto] = useState(false)
  const [produtoActiveIdx, setProdutoActiveIdx] = useState(0)
  const [qtd, setQtd] = useState(1)
  const [precificacao, setPrecificacao] = useState<Precificacao>('varejo')
  const [itens, setItens] = useState<ItemLancamentoVenda[]>(() =>
    normalizarItensDoBootstrap(pdvSeed?.itens ?? []),
  )
  const [destaqueId, setDestaqueId] = useState<string | null>(null)
  const [observacoesVenda, setObservacoesVenda] = useState(() => pdvSeed?.observacoes ?? '')
  const [rascunhoAtualId, setRascunhoAtualId] = useState<string | null>(() => pdvSeed?.rascunhoId ?? null)

  const [pagamentoAberto, setPagamentoAberto] = useState(false)
  const [dialogImpressao, setDialogImpressao] = useState(false)
  const [reciboAberto, setReciboAberto] = useState(false)
  const [imprimirAoAbrirRecibo, setImprimirAoAbrirRecibo] = useState(false)
  const [dadosPagamento, setDadosPagamento] = useState<DadosPagamentoVenda | null>(null)
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [dataEmissaoRecibo, setDataEmissaoRecibo] = useState(() => new Date())

  const produtoSelecionado = useMemo(
    () => (produtoId ? produtos.find((p) => p.id === produtoId) ?? null : null),
    [produtos, produtoId],
  )

  const produtosFiltrados = useMemo(() => {
    const q = produtoBusca.trim()
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    return produtos.filter((p) => {
      if (!nq) return true
      const hay = norm([p.descricao, p.codigoInterno, p.codigoFornecedor, p.codigoBarras].join(' '))
      return hay.includes(nq)
    })
  }, [produtoBusca, produtos])

  /** Item em foco na lista (dropdown aberto) ou produto já escolhido (dropdown fechado). */
  const produtoPreview = useMemo(() => {
    if (produtoDropdownAberto && produtosFiltrados.length > 0) {
      return produtosFiltrados[produtoActiveIdx] ?? null
    }
    return produtoSelecionado
  }, [
    produtoDropdownAberto,
    produtosFiltrados,
    produtoActiveIdx,
    produtoSelecionado,
  ])

  const [previewImgErro, setPreviewImgErro] = useState(false)
  const previewUrl = (produtoPreview?.imagemUrlPublica ?? '').trim()
  const previewUrlOk = urlImagemPublicaValida(previewUrl)

  useEffect(() => {
    setPreviewImgErro(false)
  }, [previewUrl, produtoPreview?.id])

  const destaque = useMemo(() => {
    if (!destaqueId) return itens[itens.length - 1] ?? null
    return itens.find((i) => i.id === destaqueId) ?? null
  }, [itens, destaqueId])

  const produtoDestaque = useMemo(() => {
    if (!destaque) return null
    return produtos.find((p) => p.id === destaque.produtoId) ?? null
  }, [destaque, produtos])

  const total = useMemo(() => itens.reduce((s, i) => s + i.subtotal, 0), [itens])

  const dataStr = useMemo(() => new Date().toLocaleDateString('pt-BR'), [])
  const controleId = useMemo(() => String(Date.now()), [])

  const nomeClienteExibicao = useMemo(
    () => cliente?.nome?.trim() || clienteNomeFallback?.trim() || '',
    [cliente, clienteNomeFallback],
  )

  function adicionar() {
    if (!produtoSelecionado || qtd < 1) return
    const pu = precoPorModo(produtoSelecionado, precificacao)
    const linha: ItemLancamentoVenda = {
      id: crypto.randomUUID(),
      produtoId: produtoSelecionado.id,
      descricao: produtoSelecionado.descricao,
      codigoBarras: produtoSelecionado.codigoBarras,
      quantidade: qtd,
      precoUnitario: pu,
      descontoPercentual: 0,
      subtotal: subtotalLinhaPdv(qtd, pu, 0),
    }
    setItens((prev) => [...prev, linha])
    setDestaqueId(linha.id)
    setQtd(1)
  }

  function selecionarProduto(pid: string) {
    setProdutoId(pid)
    const p = produtos.find((x) => x.id === pid)
    setProdutoBusca(p ? p.descricao : '')
    setProdutoDropdownAberto(false)
  }

  function remover(id: string) {
    setItens((prev) => prev.filter((i) => i.id !== id))
    setDestaqueId((d) => (d === id ? null : d))
  }

  function atualizarDescontoItem(id: string, valorTexto: string) {
    const normalizado = valorTexto.trim().replace(',', '.')
    const parsed = parseFloat(normalizado)
    const pct = Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : 0
    setItens((prev) =>
      prev.map((i) =>
        i.id === id
          ? {
              ...i,
              descontoPercentual: pct,
              subtotal: subtotalLinhaPdv(i.quantidade, i.precoUnitario, pct),
            }
          : i,
      ),
    )
  }

  function salvarRascunhoOrcamento() {
    if (modo !== 'orcamento') return
    if (itens.length === 0) {
      window.alert('Inclua ao menos um item para salvar o orçamento.')
      return
    }
    const nomeCliente = cliente?.nome?.trim() || clienteNomeFallback?.trim() || null
    const saved = upsertOrcamentoRascunho({
      id: rascunhoAtualId ?? undefined,
      clienteId: cliente?.id ?? null,
      clienteNome: nomeCliente,
      observacoes: observacoesVenda,
      itens,
    })
    setRascunhoAtualId(saved.id)
    window.alert(
      'Orçamento salvo neste computador. Para retomar ou converter em venda, volte ao Caixa livre e abra “Orçamentos salvos neste computador”.',
    )
  }

  function iniciarConclusao() {
    if (itens.length === 0) {
      window.alert('Inclua ao menos um item para concluir.')
      return
    }
    setNumeroDocumento(gerarNumeroDocumento())
    if (modo === 'orcamento') {
      setDadosPagamento(null)
      setDialogImpressao(true)
      return
    }
    setPagamentoAberto(true)
  }

  function aoConfirmarPagamento(dados: DadosPagamentoVenda) {
    if (rascunhoAtualId) {
      removeOrcamentoRascunho(rascunhoAtualId)
      setRascunhoAtualId(null)
    }
    baixarEstoquePorVenda(itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })))
    acumularVendaNoTurnoAtual(dados)
    appendRegistroVenda({
      emitidoEmIso: new Date().toISOString(),
      numeroDocumento,
      clienteId: cliente?.id ?? null,
      clienteNome: cliente?.nome?.trim() || clienteNomeFallback?.trim() || null,
      vendedorNome: 'Administrador',
      observacoes: observacoesVenda.trim() ? observacoesVenda.trim() : undefined,
      itens: itensParaHistorico(itens, (pid) => {
        const p = produtos.find((x) => x.id === pid)
        if (!p) return undefined
        return { valorCusto: p.valorCusto, tipoProdutoId: p.tipoProdutoId }
      }),
      pagamento: dados,
    })
    setListaVersao((v) => v + 1)
    setDadosPagamento(dados)
    setPagamentoAberto(false)
    setDialogImpressao(true)
  }

  function aoEscolherImpressao(sim: boolean) {
    setDataEmissaoRecibo(new Date())
    setImprimirAoAbrirRecibo(sim)
    setDialogImpressao(false)
    setReciboAberto(true)
  }

  function fecharRecibo() {
    if (rascunhoAtualId) {
      removeOrcamentoRascunho(rascunhoAtualId)
      setRascunhoAtualId(null)
    }
    if (modo === 'orcamento' && itens.length > 0) {
      const total = Math.round(itens.reduce((s, i) => s + i.subtotal, 0) * 100) / 100
      appendRegistroOrcamento({
        emitidoEmIso: dataEmissaoRecibo.toISOString(),
        numeroDocumento,
        clienteId: cliente?.id ?? null,
        clienteNome: cliente?.nome ?? clienteNomeFallback ?? null,
        vendedorNome: 'Administrador',
        observacoes: observacoesVenda.trim() ? observacoesVenda.trim() : undefined,
        itens: itensParaHistorico(itens, (pid) => {
          const p = produtos.find((x) => x.id === pid)
          if (!p) return undefined
          return { valorCusto: p.valorCusto, tipoProdutoId: p.tipoProdutoId }
        }),
        total,
      })
    }
    setReciboAberto(false)
    setDadosPagamento(null)
    onSair()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">
              Lançamento de pedidos · {modo === 'orcamento' ? 'Orçamento' : 'Venda'}
            </p>
            <h1 className="text-xl font-bold text-[var(--text)]">PDV</h1>
          </div>
          <div className="text-right text-sm text-[var(--text-muted)]">
            <p>
              <span className="font-medium text-[var(--text)]">Operador:</span> Administrador
            </p>
            <p className="tabular-nums">{new Date().toLocaleTimeString('pt-BR')}</p>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-[var(--text)] mb-3">Informações da venda</h2>
          <p className="text-sm text-[var(--text)]">
            <span className="text-[var(--text-muted)]">Cliente:</span>{' '}
            {nomeClienteExibicao ? (
              <strong>{nomeClienteExibicao}</strong>
            ) : (
              <span className="text-amber-700">Não informado para esta venda.</span>
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--text-muted)]">
            <span>Data: {dataStr}</span>
            <span>Controle: {controleId}</span>
            <span>Terminal: 01</span>
            <span>Turno: 1</span>
          </div>
          <div className="mt-4">
            <label htmlFor="pdv-obs" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Observações
            </label>
            <textarea
              id="pdv-obs"
              rows={2}
              value={observacoesVenda}
              onChange={(e) => setObservacoesVenda(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              placeholder="Opcional"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5 shadow-sm space-y-5">
          <p className="text-sm font-medium text-[var(--text)]">Adicionar item</p>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-start">
            <div className="lg:col-span-7 space-y-4 min-w-0">
              <div>
                <label htmlFor="pdv-prod" className="block text-xs text-[var(--text-muted)] mb-1">
                  Selecione o produto cadastrado
                </label>
                <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                  <div className="flex-1 min-w-0">
                    <div className="relative">
                      <input
                        id="pdv-prod"
                        role="combobox"
                        aria-expanded={produtoDropdownAberto}
                        aria-controls="pdv-produtos-list"
                        aria-autocomplete="list"
                        type="text"
                        value={produtoBusca}
                        onChange={(e) => {
                          setProdutoBusca(e.target.value)
                          setProdutoDropdownAberto(true)
                          setProdutoActiveIdx(0)
                          setProdutoId('')
                        }}
                        onFocus={() => setProdutoDropdownAberto(true)}
                        onBlur={() => {
                          window.setTimeout(() => setProdutoDropdownAberto(false), 120)
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setProdutoDropdownAberto(true)
                            setProdutoActiveIdx((i) =>
                              Math.min(i + 1, Math.max(0, produtosFiltrados.length - 1)),
                            )
                            return
                          }
                          if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setProdutoDropdownAberto(true)
                            setProdutoActiveIdx((i) => Math.max(i - 1, 0))
                            return
                          }
                          if (e.key === 'Enter') {
                            if (!produtoDropdownAberto) return
                            e.preventDefault()
                            const p = produtosFiltrados[produtoActiveIdx]
                            if (p) selecionarProduto(p.id)
                            return
                          }
                          if (e.key === 'Escape') setProdutoDropdownAberto(false)
                        }}
                        placeholder="Digite para buscar e selecionar…"
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
                      />

                      {produtoDropdownAberto ? (
                        <div
                          id="pdv-produtos-list"
                          role="listbox"
                          className="absolute z-20 mt-1 w-full overflow-auto max-h-72 rounded-xl border border-[var(--border)] bg-white shadow-lg"
                        >
                          {produtosFiltrados.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
                              Nenhum produto encontrado.
                            </div>
                          ) : (
                            produtosFiltrados.slice(0, 150).map((p, idx) => {
                              const preco = formatarBrl(precoPorModo(p, precificacao))
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  role="option"
                                  aria-selected={idx === produtoActiveIdx}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => selecionarProduto(p.id)}
                                  onMouseEnter={() => setProdutoActiveIdx(idx)}
                                  className={`w-full text-left px-3 py-2 text-sm border-b border-[var(--border)]/60 last:border-b-0 ${
                                    idx === produtoActiveIdx ? 'bg-[var(--surface)]' : 'bg-white'
                                  }`}
                                >
                                  <div className="font-medium text-[var(--text)]">{p.descricao}</div>
                                  <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                    {p.codigoInterno || p.codigoBarras
                                      ? `${p.codigoInterno || p.codigoBarras} · `
                                      : ''}
                                    Estq. {p.estoqueAtual ?? 0} · {preco}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="w-full sm:w-28 shrink-0">
                    <label htmlFor="pdv-qtd" className="block text-xs text-[var(--text-muted)] mb-1">
                      Quantidade
                    </label>
                    <input
                      id="pdv-qtd"
                      type="number"
                      min={1}
                      step={1}
                      value={qtd}
                      onChange={(e) => setQtd(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={adicionar}
                    disabled={!produtoSelecionado}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 w-full sm:w-auto"
                  >
                    Adicionar à listagem
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-medium text-[var(--text)] mb-2">
                  O item será lançado com valor de
                </span>
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="preco-pdv"
                      checked={precificacao === 'varejo'}
                      onChange={() => setPrecificacao('varejo')}
                    />
                    Varejo
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="preco-pdv"
                      checked={precificacao === 'atacado'}
                      onChange={() => setPrecificacao('atacado')}
                    />
                    Atacado
                  </label>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]/35 overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-card)]">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    Foto do produto
                  </p>
                  {produtoPreview ? (
                    <p className="text-sm font-semibold text-[var(--text)] mt-1 leading-snug line-clamp-2">
                      {produtoPreview.descricao}
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--text-muted)] mt-1">Nenhum produto em foco</p>
                  )}
                  {produtoDropdownAberto && produtoPreview ? (
                    <p className="text-[11px] text-[var(--accent)] mt-1 font-medium">
                      Pré-visualizando item destacado na lista
                    </p>
                  ) : null}
                </div>
                <div className="aspect-[4/3] max-h-[min(42vh,280px)] min-h-[200px] bg-gradient-to-b from-white to-[var(--surface)]/80 flex items-center justify-center p-4">
                  {!produtoPreview ? (
                    <p className="text-sm text-center text-[var(--text-muted)] px-2">
                      Busque e passe o mouse ou use as setas na lista para ver a foto.
                    </p>
                  ) : !previewUrlOk ? (
                    <div className="text-center px-3">
                      <p className="text-sm text-[var(--text-muted)]">Sem URL de imagem cadastrada.</p>
                      <p className="text-xs text-[var(--text-muted)] mt-2">
                        Cadastre o link em Produto → guia &quot;Imagem e descrição&quot;.
                      </p>
                    </div>
                  ) : previewImgErro ? (
                    <p className="text-sm text-center text-amber-900/90 px-2">
                      Imagem indisponível ou bloqueada pelo site de origem.
                    </p>
                  ) : (
                    <img
                      src={previewUrl}
                      alt={produtoPreview.descricao}
                      className="max-h-full max-w-full object-contain rounded-xl shadow-sm ring-1 ring-black/5"
                      onError={() => setPreviewImgErro(true)}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {produtoDestaque && destaque && (
          <section className="rounded-2xl border border-[var(--accent)]/30 bg-teal-50/50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)] mb-2">Item em destaque</p>
            <p className="text-lg font-bold text-[var(--text)]">{destaque.descricao}</p>
            <div className="mt-3 flex flex-wrap gap-6 text-sm">
              <div>
                <span className="text-[var(--text-muted)]">Restam no estoque</span>
                <p className="font-semibold tabular-nums">{produtoDestaque.estoqueAtual}</p>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Cálculo</span>
                <p className="font-semibold text-[var(--accent)]">
                  {formatarBrl(destaque.precoUnitario)} × {destaque.quantidade}
                  {destaque.descontoPercentual > 0
                    ? ` · desc. ${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(destaque.descontoPercentual)}%`
                    : ''}{' '}
                  = {formatarBrl(destaque.subtotal)}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
          <div className="px-4 py-2 bg-[var(--accent)]/10 text-xs font-semibold uppercase text-[var(--text)]">
            Produtos na venda
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-xs text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="px-3 py-2">Descrição</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Qtd</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Unit.</th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">
                    Desc. <span className="font-normal normal-case text-[10px]">(%)</span>
                  </th>
                  <th className="px-3 py-2 text-right whitespace-nowrap">Subtotal</th>
                  <th className="px-3 py-2 whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody>
                {itens.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Nenhum item. Selecione um produto acima.
                    </td>
                  </tr>
                ) : (
                  itens.map((it) => {
                    const sel = it.id === destaque?.id
                    return (
                      <tr
                        key={it.id}
                        className={`border-b border-[var(--border)] cursor-pointer ${
                          sel ? 'bg-teal-50' : 'hover:bg-[var(--surface)]'
                        }`}
                        onClick={() => setDestaqueId(it.id)}
                      >
                        <td className="px-3 py-3 font-medium align-middle">{it.descricao}</td>
                        <td className="px-3 py-3 text-right tabular-nums align-middle">{it.quantidade}</td>
                        <td className="px-3 py-3 text-right tabular-nums align-middle">
                          {formatarBrl(it.precoUnitario)}
                        </td>
                        <td className="px-3 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end">
                            <input
                              type="number"
                              inputMode="decimal"
                              min={0}
                              max={100}
                              step={0.01}
                              title="Desconto percentual sobre o valor da linha (quantidade × unitário)"
                              aria-label={`Desconto percentual em ${it.descricao}`}
                              value={it.descontoPercentual}
                              onChange={(e) => atualizarDescontoItem(it.id, e.target.value)}
                              className="w-full max-w-[5.5rem] rounded-lg border border-[var(--border)] bg-white px-2 py-1.5 text-sm text-right tabular-nums"
                            />
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums align-middle">
                          {formatarBrl(it.subtotal)}
                        </td>
                        <td className="px-3 py-3 align-middle">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              remover(it.id)
                            }}
                            className="text-sm text-red-600 hover:underline"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 sm:p-5">
          <p className="text-sm text-[var(--text-muted)]">
            Itens: <strong className="text-[var(--text)]">{itens.length}</strong>
          </p>
          <p className="text-xl sm:text-2xl font-bold text-[var(--accent)]">
            Total do lançamento {formatarBrl(total)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={() => {
                if (itens.length && window.confirm('Cancelar este lançamento?')) onSair()
                else if (!itens.length) onSair()
              }}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-800"
            >
              Cancelar lançamento
            </button>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {modo === 'orcamento' ? (
              <button
                type="button"
                onClick={salvarRascunhoOrcamento}
                disabled={itens.length === 0}
                className="rounded-xl border border-[var(--accent)] bg-teal-50/80 px-5 py-3 text-sm font-semibold text-teal-900 hover:bg-teal-100/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Salvar orçamento
              </button>
            ) : null}
            <button
              type="button"
              onClick={iniciarConclusao}
              className="rounded-xl bg-[var(--accent)] px-6 py-3 text-sm font-bold text-white hover:bg-[var(--accent-hover)]"
            >
              Concluir lançamento
            </button>
          </div>
        </div>
      </main>

      <ModalPagamentoVenda
        aberto={pagamentoAberto}
        subtotalBruto={total}
        onFechar={() => setPagamentoAberto(false)}
        onConfirmar={aoConfirmarPagamento}
      />

      {dialogImpressao && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-6 shadow-xl"
          >
            <h3 className="text-base font-semibold text-[var(--text)]">Impressão do recibo</h3>
            <p className="mt-3 text-sm text-[var(--text)]">
              Deseja imprimir o recibo da {modo === 'orcamento' ? 'proposta' : 'venda'}{' '}
              <span className="font-mono font-medium">[{numeroDocumento}]</span>?
            </p>
            <p className="mt-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Atenção: verifique se a impressora está ligada e pronta antes de confirmar.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => aoEscolherImpressao(false)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => aoEscolherImpressao(true)}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {reciboAberto && (
        <ReciboVenda
          modo={modo}
          numero={numeroDocumento}
          emissao={dataEmissaoRecibo}
          cliente={cliente}
          clienteNomeFallback={cliente ? undefined : nomeClienteExibicao || undefined}
          itens={itens}
          dadosPagamento={dadosPagamento}
          observacoes={observacoesVenda}
          imprimirAoAbrir={imprimirAoAbrirRecibo}
          onFechar={fecharRecibo}
        />
      )}
    </div>
  )
}
