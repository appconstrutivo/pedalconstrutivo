import { useEffect, useMemo, useRef, useState } from 'react'
import type { Kit, Produto } from '../types'
import { ProdutoFormModal } from '../components/ProdutoFormModal'
import { KitComposicaoModal } from '../components/KitComposicaoModal'
import { loadProdutos, saveProdutos, gerarProximoCodigoInterno, updateProduto } from '../store/produtos'
import { formatarBrl, round2 } from '../utils/moeda'
import { findKitByProdutoKitId, loadKits, upsertKitByProdutoKitId } from '../store/kits'
import {
  criarNovoPedidoCompra,
  excluirPedidoCompra,
  limparPedidoCompraAtivo,
  loadPedidosCompraState,
  obterPedidoAtivo,
  renomearPedidoCompra,
  saveItensNoPedidoAtivo,
  setPedidoCompraAtivo,
  type PedidoCompraItem,
} from '../store/pedidoCompra'

type Props = {
  onVoltar: () => void
}

type KitLinhaDraft = { produtoId: string; quantidadePorKit: number }

function normalizarKitItens(itens: KitLinhaDraft[]): KitLinhaDraft[] {
  const m = new Map<string, number>()
  for (const i of itens) {
    const pid = (i.produtoId || '').trim()
    if (!pid) continue
    const q = round2(Number(i.quantidadePorKit || 0))
    if (q <= 0) continue
    m.set(pid, round2((m.get(pid) ?? 0) + q))
  }
  return Array.from(m.entries()).map(([produtoId, quantidadePorKit]) => ({ produtoId, quantidadePorKit }))
}

function calcularCustoKit(itens: KitLinhaDraft[], produtos: Produto[]): number {
  let total = 0
  for (const i of itens) {
    const p = produtos.find((x) => x.id === i.produtoId)
    if (!p) continue
    total += (p.valorCusto || 0) * (i.quantidadePorKit || 0)
  }
  return round2(total)
}

function disponibilidadeOk(
  itens: KitLinhaDraft[],
  produtos: Produto[],
  qtdKits: number,
): { ok: boolean; faltas: { produtoId: string; descricao: string; precisa: number; tem: number }[] } {
  const faltas: { produtoId: string; descricao: string; precisa: number; tem: number }[] = []
  for (const i of itens) {
    const p = produtos.find((x) => x.id === i.produtoId)
    if (!p) continue
    const precisa = round2((i.quantidadePorKit || 0) * qtdKits)
    const tem = round2(p.estoqueAtual || 0)
    if (precisa > tem) {
      faltas.push({ produtoId: p.id, descricao: p.descricao, precisa, tem })
    }
  }
  return { ok: faltas.length === 0, faltas }
}

export function Estoque({ onVoltar }: Props) {
  const [tab, setTab] = useState<'visao' | 'kit' | 'pedido'>('visao')
  const [produtos, setProdutos] = useState<Produto[]>(() => loadProdutos())
  const [kits, setKits] = useState<Kit[]>(() => loadKits())
  const [produtoEditar, setProdutoEditar] = useState<Produto | null>(null)
  const [produtoModalAberto, setProdutoModalAberto] = useState(false)
  const [kitCompAberto, setKitCompAberto] = useState(false)
  const [kitAtual, setKitAtual] = useState<Kit | null>(null)
  const [busca, setBusca] = useState('')

  // Pedido de compra (lista local, não altera cadastro/estoque)
  const [pedidoState, setPedidoState] = useState(() => loadPedidosCompraState())
  const [pedidoBuscaProduto, setPedidoBuscaProduto] = useState('')
  const [pedidoProdutoId, setPedidoProdutoId] = useState('')
  const [pedidoQtd, setPedidoQtd] = useState(1)
  const [pedidoObs, setPedidoObs] = useState('')
  const [pedidoAvulsoDesc, setPedidoAvulsoDesc] = useState('')
  const [pedidoAvulsoQtd, setPedidoAvulsoQtd] = useState(1)
  const [pedidoAvulsoObs, setPedidoAvulsoObs] = useState('')
  const [erroPedido, setErroPedido] = useState<string | null>(null)

  // Kit builder
  const [kitNome, setKitNome] = useState('')
  const [qtdKits, setQtdKits] = useState(1)
  const [kitItens, setKitItens] = useState<KitLinhaDraft[]>([])
  const [produtoAddId, setProdutoAddId] = useState('')
  const [qtdAdd, setQtdAdd] = useState(1)
  const [erroKit, setErroKit] = useState<string | null>(null)
  const [kitBusca, setKitBusca] = useState('')
  const [kitSelecionadoId, setKitSelecionadoId] = useState<string>('')
  const [kitCriarComoNovo, setKitCriarComoNovo] = useState(false)
  const [produtoBuscaKit, setProdutoBuscaKit] = useState('')
  const [produtoDropdownAberto, setProdutoDropdownAberto] = useState(false)
  const [produtoActiveIdx, setProdutoActiveIdx] = useState(0)
  const produtoBlurTimeoutRef = useRef<number | null>(null)

  const produtosControleEstoque = useMemo(
    () => produtos.filter((p) => p.tipoLancamento === 'controle_estoque' && p.ativo !== false),
    [produtos],
  )

  const produtosControleEstoqueFiltrados = useMemo(() => {
    const q = busca.trim()
    if (!q) return produtosControleEstoque
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    return produtosControleEstoque.filter((p) => {
      const hay = norm(
        [
          p.codigoInterno,
          p.descricao,
          p.codigoFornecedor,
          p.codigoBarras,
          String(p.estoqueAtual ?? ''),
        ].join(' '),
      )
      return hay.includes(nq)
    })
  }, [busca, produtosControleEstoque])

  const custoKit = useMemo(() => calcularCustoKit(kitItens, produtos), [kitItens, produtos])

  const produtosParaKit = useMemo(() => {
    const q = produtoBuscaKit.trim()
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    return produtosControleEstoque
      .filter((p) => (p.estoqueAtual ?? 0) > 0)
      .filter((p) => {
        if (!nq) return true
        const hay = norm([p.descricao, p.codigoInterno, p.codigoFornecedor, p.codigoBarras].join(' '))
        return hay.includes(nq)
      })
  }, [produtoBuscaKit, produtosControleEstoque])

  function refresh() {
    setProdutos(loadProdutos())
  }

  function refreshKits() {
    setKits(loadKits())
  }

  useEffect(() => {
    function onChanged() {
      refresh()
    }
    window.addEventListener('pc:produtos-changed', onChanged as EventListener)
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener('pc:produtos-changed', onChanged as EventListener)
      window.removeEventListener('storage', onChanged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onDataChanged(e: Event) {
      const ce = e as CustomEvent<{ scope?: string }>
      if (ce?.detail?.scope === 'kits') refreshKits()
    }
    window.addEventListener('pc:data-changed', onDataChanged as EventListener)
    window.addEventListener('storage', onDataChanged)
    return () => {
      window.removeEventListener('pc:data-changed', onDataChanged as EventListener)
      window.removeEventListener('storage', onDataChanged)
    }
  }, [])

  useEffect(() => {
    function onPedidoChanged() {
      setPedidoState(loadPedidosCompraState())
    }
    window.addEventListener('pc:pedido-compra-changed', onPedidoChanged as EventListener)
    window.addEventListener('storage', onPedidoChanged)
    return () => {
      window.removeEventListener('pc:pedido-compra-changed', onPedidoChanged as EventListener)
      window.removeEventListener('storage', onPedidoChanged)
    }
  }, [])

  const pedidoAtivo = useMemo(() => obterPedidoAtivo(pedidoState), [pedidoState])
  const pedidoItens = pedidoAtivo.itens

  const produtosParaPedido = useMemo(() => {
    const q = pedidoBuscaProduto.trim()
    const base = produtosControleEstoque
    if (!q) return base
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    return base.filter((p) => {
      const hay = norm([p.codigoInterno, p.descricao, p.codigoFornecedor, p.codigoBarras].join(' '))
      return hay.includes(nq)
    })
  }, [pedidoBuscaProduto, produtosControleEstoque])

  function adicionarProdutoAoPedido() {
    setErroPedido(null)
    if (!pedidoProdutoId) {
      setErroPedido('Selecione um produto cadastrado.')
      return
    }
    const qtd = Math.max(1, round2(pedidoQtd || 1))
    const obs = pedidoObs.trim()

    const itens = [...pedidoItens]
    const idx = itens.findIndex((i) => i.kind === 'produto' && i.produtoId === pedidoProdutoId)
    if (idx >= 0) {
      const atual = itens[idx] as Extract<PedidoCompraItem, { kind: 'produto' }>
      itens[idx] = { ...atual, quantidade: round2(atual.quantidade + qtd), observacao: obs || atual.observacao }
    } else {
      itens.unshift({
        id: crypto.randomUUID(),
        kind: 'produto',
        produtoId: pedidoProdutoId,
        quantidade: qtd,
        observacao: obs || undefined,
        criadoEmIso: new Date().toISOString(),
      })
    }
    saveItensNoPedidoAtivo(itens)
    setPedidoState(loadPedidosCompraState())
    setPedidoProdutoId('')
    setPedidoBuscaProduto('')
    setPedidoQtd(1)
    setPedidoObs('')
  }

  function adicionarAvulsoAoPedido() {
    setErroPedido(null)
    const desc = pedidoAvulsoDesc.trim()
    if (!desc) {
      setErroPedido('Informe a descrição do item avulso.')
      return
    }
    const qtd = Math.max(1, round2(pedidoAvulsoQtd || 1))
    const obs = pedidoAvulsoObs.trim()
    const itens = [
      {
        id: crypto.randomUUID(),
        kind: 'avulso' as const,
        descricao: desc,
        quantidade: qtd,
        observacao: obs || undefined,
        criadoEmIso: new Date().toISOString(),
      },
      ...pedidoItens,
    ]
    saveItensNoPedidoAtivo(itens)
    setPedidoState(loadPedidosCompraState())
    setPedidoAvulsoDesc('')
    setPedidoAvulsoQtd(1)
    setPedidoAvulsoObs('')
  }

  function atualizarQtdPedido(itemId: string, qtd: number) {
    const q = Math.max(0, round2(qtd))
    const itens = pedidoItens
      .map((i) => (i.id === itemId ? ({ ...i, quantidade: q } as PedidoCompraItem) : i))
      .filter((i) => i.quantidade > 0)
    saveItensNoPedidoAtivo(itens)
    setPedidoState(loadPedidosCompraState())
  }

  function removerItemPedido(itemId: string) {
    const itens = pedidoItens.filter((i) => i.id !== itemId)
    saveItensNoPedidoAtivo(itens)
    setPedidoState(loadPedidosCompraState())
  }

  function limparListaPedido() {
    if (!pedidoItens.length) return
    if (!window.confirm(`Limpar a lista do pedido “${pedidoAtivo.nome}”?`)) return
    limparPedidoCompraAtivo()
    setPedidoState(loadPedidosCompraState())
  }

  function criarPedido() {
    const nome = window.prompt('Nome do novo pedido (opcional):')?.trim()
    criarNovoPedidoCompra(nome || undefined)
    setPedidoState(loadPedidosCompraState())
  }

  function renomearPedidoAtual() {
    const nome = window.prompt('Renomear pedido:', pedidoAtivo.nome)?.trim()
    if (!nome) return
    renomearPedidoCompra(pedidoAtivo.id, nome)
    setPedidoState(loadPedidosCompraState())
  }

  function excluirPedidoAtual() {
    if (!window.confirm(`Excluir o pedido “${pedidoAtivo.nome}”? Esta ação não pode ser desfeita.`)) return
    excluirPedidoCompra(pedidoAtivo.id)
    setPedidoState(loadPedidosCompraState())
  }

  function ajustarEstoque(produtoId: string, novoValor: number) {
    const next = produtos.map((p) => (p.id === produtoId ? { ...p, estoqueAtual: Math.max(0, round2(novoValor)) } : p))
    setProdutos(next)
    saveProdutos(next)
  }

  /** Ajuste relativo (delta). Retorna false se ficar negativo. */
  function ajustarEstoqueDelta(produtoId: string, delta: number): boolean {
    const atual = produtos.find((p) => p.id === produtoId)?.estoqueAtual ?? 0
    const nextVal = round2(atual + delta)
    if (nextVal < 0) return false
    const next = produtos.map((p) => (p.id === produtoId ? { ...p, estoqueAtual: nextVal } : p))
    setProdutos(next)
    saveProdutos(next)
    return true
  }

  function abrirEditarProduto(p: Produto) {
    setProdutoEditar(p)
    setProdutoModalAberto(true)
  }

  function abrirEditarComposicaoKit(p: Produto) {
    setProdutoEditar(p)
    setKitAtual(findKitByProdutoKitId(p.id))
    setKitCompAberto(true)
  }

  function consumoTotalPorProduto(itens: KitLinhaDraft[], qtd: number): Map<string, number> {
    const m = new Map<string, number>()
    const qk = Math.max(1, Math.trunc(qtd || 1))
    for (const i of itens) {
      const total = round2((i.quantidadePorKit || 0) * qk)
      m.set(i.produtoId, round2((m.get(i.produtoId) ?? 0) + total))
    }
    return m
  }

  function adicionarItemKit() {
    setErroKit(null)
    const pid = produtoAddId
    if (!pid) return
    const qtd = Math.max(1, round2(qtdAdd))
    const consumoAtual = consumoTotalPorProduto(kitItens, qtdKits)
    const p = produtos.find((x) => x.id === pid)
    const estoque = round2(p?.estoqueAtual ?? 0)
    const precisaAtual = round2(consumoAtual.get(pid) ?? 0)
    const precisaNovo = round2((precisaAtual + qtd * Math.max(1, Math.trunc(qtdKits || 1))) as number)
    if (estoque <= 0) {
      setErroKit('Este produto não tem estoque disponível para entrar na composição do kit.')
      return
    }
    if (precisaNovo > estoque) {
      setErroKit('Estoque insuficiente para incluir este item considerando a quantidade de kits informada.')
      return
    }
    setKitItens((prev) => {
      const idx = prev.findIndex((x) => x.produtoId === pid)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidadePorKit: round2(next[idx].quantidadePorKit + qtd) }
        return normalizarKitItens(next)
      }
      return normalizarKitItens([...prev, { produtoId: pid, quantidadePorKit: qtd }])
    })
    setProdutoAddId('')
    setQtdAdd(1)
    setProdutoBuscaKit('')
    setProdutoDropdownAberto(false)
    setProdutoActiveIdx(0)
  }

  function selecionarProdutoParaKit(pid: string) {
    setProdutoAddId(pid)
    const p = produtosControleEstoque.find((x) => x.id === pid)
    setProdutoBuscaKit(p ? p.descricao : '')
    setProdutoDropdownAberto(false)
  }

  function atualizarQtdItemKit(produtoId: string, qtdPorKit: number) {
    const q = Math.max(0, round2(qtdPorKit))
    if (q <= 0) {
      removerItemKit(produtoId)
      return
    }
    const p = produtos.find((x) => x.id === produtoId)
    const estoque = round2(p?.estoqueAtual ?? 0)
    if (estoque <= 0) {
      setErroKit('Este produto não tem estoque disponível para permanecer na composição do kit.')
      return
    }
    const qtdTotalKits = Math.max(1, Math.trunc(qtdKits || 1))
    const consumoAtual = consumoTotalPorProduto(kitItens, qtdTotalKits)
    const consumoSemEste = round2((consumoAtual.get(produtoId) ?? 0) - round2((kitItens.find((i) => i.produtoId === produtoId)?.quantidadePorKit ?? 0) * qtdTotalKits))
    const consumoNovo = round2(consumoSemEste + round2(q * qtdTotalKits))
    if (consumoNovo > estoque) {
      setErroKit('Estoque insuficiente para aumentar a quantidade deste item com a quantidade de kits informada.')
      return
    }
    setErroKit(null)
    setKitItens((prev) =>
      normalizarKitItens(prev.map((i) => (i.produtoId === produtoId ? { ...i, quantidadePorKit: q } : i))),
    )
  }

  function removerItemKit(produtoId: string) {
    setKitItens((prev) => normalizarKitItens(prev.filter((x) => x.produtoId !== produtoId)))
  }

  const kitsCadastrados = useMemo(() => {
    const q = kitBusca.trim()
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    const kitProdutos = produtosControleEstoque
      .filter((p) => p.observacoes?.includes('KIT'))
      .map((p) => ({
        produto: p,
        kit: kits.find((k) => k.produtoKitId === p.id) ?? null,
      }))
      .filter((x) => x.kit !== null) as { produto: Produto; kit: Kit }[]

    if (!nq) return kitProdutos
    return kitProdutos.filter(({ produto, kit }) => {
      const hay = norm([produto.descricao, produto.codigoInterno, kit.nome].join(' '))
      return hay.includes(nq)
    })
  }, [kitBusca, kits, produtosControleEstoque])

  function carregarKitExistente(produtoKitId: string) {
    const k = kits.find((x) => x.produtoKitId === produtoKitId) ?? null
    const p = produtos.find((x) => x.id === produtoKitId) ?? null
    if (!k || !p) return
    setKitSelecionadoId(produtoKitId)
    setKitNome(p.descricao.trim() || k.nome.trim())
    setKitItens(
      normalizarKitItens(k.itens.map((i) => ({ produtoId: i.produtoId, quantidadePorKit: round2(i.quantidade) }))),
    )
    setKitCriarComoNovo(false)
    setErroKit(null)
  }

  function excluirQuantidadeDeKits(produtoKitId: string) {
    const kitDef = kits.find((k) => k.produtoKitId === produtoKitId) ?? null
    const kitProduto = produtos.find((p) => p.id === produtoKitId) ?? null
    if (!kitDef || !kitProduto) {
      window.alert('Não foi possível localizar a definição deste kit para devolver os itens ao estoque.')
      return
    }
    const estoqueKit = Math.max(0, round2(kitProduto.estoqueAtual ?? 0))
    if (estoqueKit <= 0) {
      window.alert('Este kit não possui estoque para excluir.')
      return
    }
    const resp = window.prompt(`Quantidade de kits a excluir (máx. ${estoqueKit}):`, '1')
    const qtd = Math.max(0, Math.trunc(Number(resp) || 0))
    if (!qtd) return
    if (qtd > estoqueKit) {
      window.alert('Quantidade inválida: maior que o estoque do kit.')
      return
    }
    if (!window.confirm(`Excluir ${qtd} un. do kit “${kitProduto.descricao}” e devolver os componentes ao estoque?`)) return

    const devolucao = new Map<string, number>()
    for (const i of kitDef.itens) {
      devolucao.set(i.produtoId, round2((devolucao.get(i.produtoId) ?? 0) + round2(i.quantidade * qtd)))
    }

    const lista = loadProdutos()
    const next = lista.map((p) => {
      if (p.id === produtoKitId) return { ...p, estoqueAtual: Math.max(0, round2((p.estoqueAtual || 0) - qtd)) }
      const inc = devolucao.get(p.id)
      if (!inc) return p
      return { ...p, estoqueAtual: Math.max(0, round2((p.estoqueAtual || 0) + inc)) }
    })
    saveProdutos(next)
    refresh()
  }

  function montarKit() {
    setErroKit(null)
    const nome = kitNome.trim()
    if (!nome) {
      setErroKit('Informe o nome/descrição do kit.')
      return
    }
    const qtd = Math.max(1, Math.trunc(qtdKits || 1))
    const itensNorm = normalizarKitItens(kitItens)
    if (itensNorm.length === 0) {
      setErroKit('Adicione ao menos 1 produto ao kit.')
      return
    }
    const valida = disponibilidadeOk(itensNorm, produtos, qtd)
    if (!valida.ok) {
      setErroKit('Estoque insuficiente para montar este kit com a quantidade informada.')
      return
    }

    // Debita estoque dos componentes e cria/atualiza o produto do kit
    const lista = loadProdutos()
    const custo = calcularCustoKit(itensNorm, lista)
    const codigoInterno = gerarProximoCodigoInterno(lista)

    const selecionado = kitSelecionadoId ? lista.find((p) => p.id === kitSelecionadoId) ?? null : null

    // Regra de reuso:
    // - Se há kit selecionado e NÃO está “criar como novo”, atualiza esse produto-kit (inclui renomear descrição).
    // - Senão, se NÃO está “criar como novo”, tenta reusar por descrição exata (fallback).
    // - Se está “criar como novo”, sempre cria um novo produto-kit.
    const existente =
      selecionado && !kitCriarComoNovo
        ? selecionado
        : !kitCriarComoNovo
          ? lista.find((p) => p.tipoLancamento === 'controle_estoque' && p.descricao.trim() === nome) ?? null
          : null

    const kitProdutoId = existente?.id ?? crypto.randomUUID()
    const kitCodigo = existente?.codigoInterno?.trim() ? existente.codigoInterno : codigoInterno
    const kitProduto: Produto = existente
      ? {
          ...existente,
          descricao: nome,
          valorCusto: custo,
          valorVarejo: existente.valorVarejo,
          valorAtacado: existente.valorAtacado,
          estoqueAtual: round2((existente.estoqueAtual || 0) + qtd),
        }
      : {
          // defaults mínimos compatíveis com cadastro
          id: kitProdutoId,
          tipoLancamento: 'controle_estoque',
          codigoInterno: kitCodigo,
          codigoFornecedor: '',
          fornecedorId: '',
          fornecedorNome: '',
          descricao: nome,
          valorCusto: custo,
          valorVarejo: custo,
          valorAtacado: custo,
          tipoProdutoId: '',
          codigoBarras: '',
          aceitaFracionar: false,
          unidadeMedida: 'UN',
          pontuacao: 0,
          informacoesAdicionais: '',
          moeda: 'R$',
          cotacao: 1,
          estoqueMinimo: 0,
          estoqueAtual: qtd,
          ativo: true,
          observacoes: 'KIT',
          imagemUrlPublica: '',
          descricaoDetalhada: '',
          criadoEm: new Date().toISOString(),
        }

    // aplica débitos
    const debitados = new Map<string, number>()
    for (const i of itensNorm) {
      debitados.set(i.produtoId, round2((debitados.get(i.produtoId) ?? 0) + i.quantidadePorKit * qtd))
    }

    const next = lista
      .filter((p) => p.id !== kitProdutoId)
      .map((p) => {
        const deb = debitados.get(p.id)
        if (!deb) return p
        return { ...p, estoqueAtual: Math.max(0, round2((p.estoqueAtual || 0) - deb)) }
      })

    const final = [...next, kitProduto]
    saveProdutos(final)

    // persiste definição do kit
    upsertKitByProdutoKitId(kitProdutoId, {
      nome,
      itens: itensNorm.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidadePorKit })),
      estoqueComprometido: true,
    })

    setKitNome('')
    setQtdKits(1)
    setKitItens([])
    setKitBusca('')
    setKitSelecionadoId('')
    setKitCriarComoNovo(false)
    refresh()
    refreshKits()
    setTab('visao')
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Operação</p>
            <h1 className="text-xl font-bold text-[var(--text)]">Estoque</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('visao')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
                tab === 'visao'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text)] border-[var(--border)]'
              }`}
            >
              Visão
            </button>
            <button
              type="button"
              onClick={() => setTab('kit')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
                tab === 'kit'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text)] border-[var(--border)]'
              }`}
            >
              Montar kit
            </button>
            <button
              type="button"
              onClick={() => setTab('pedido')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold border ${
                tab === 'pedido'
                  ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                  : 'bg-white text-[var(--text)] border-[var(--border)]'
              }`}
              title="Criar lista de compra (não altera o estoque/cadastro)"
            >
              Pedido
              {pedidoAtivo.itens.length > 0 ? (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-white/20 px-2 py-0.5 text-xs tabular-nums">
                  {pedidoAtivo.itens.length}
                </span>
              ) : null}
            </button>
            <button
              type="button"
              onClick={onVoltar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Fechar
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6">
        {tab === 'visao' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/40 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                  Buscar produto
                </label>
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Digite para filtrar por código, descrição, SKU, código de barras…"
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                Exibindo <strong className="text-[var(--text)]">{produtosControleEstoqueFiltrados.length}</strong> de{' '}
                <strong className="text-[var(--text)]">{produtosControleEstoque.length}</strong>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[820px]">
                <thead>
                  <tr className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                    <th className="px-3 py-2">Código</th>
                    <th className="px-3 py-2 min-w-[240px]">Produto</th>
                    <th className="px-3 py-2 text-right">Custo</th>
                    <th className="px-3 py-2 text-right">Estoque</th>
                    <th className="px-3 py-2 text-right">Ajuste</th>
                    <th className="px-3 py-2 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {produtosControleEstoque.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                        Nenhum produto com controle de estoque.
                      </td>
                    </tr>
                  ) : produtosControleEstoqueFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                        Nenhum produto encontrado para <span className="font-mono text-[var(--text)]">{busca.trim()}</span>.
                      </td>
                    </tr>
                  ) : (
                    produtosControleEstoqueFiltrados.map((p) => (
                      <tr key={p.id} className="border-b border-[var(--border)]/70">
                        <td className="px-3 py-2 text-xs">
                          <div className="font-mono text-[var(--text)]">{p.codigoInterno || '—'}</div>
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">{p.descricao}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarBrl(p.valorCusto)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.estoqueAtual}</td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            defaultValue={p.estoqueAtual}
                            onBlur={(e) => ajustarEstoque(p.id, Number(e.target.value))}
                            className="w-28 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums text-right"
                            title="Ajuste rápido: digite e saia do campo"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => abrirEditarProduto(p)}
                              className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
                            >
                              Editar
                            </button>
                            {p.observacoes?.includes('KIT') ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => abrirEditarComposicaoKit(p)}
                                  className="rounded-xl border border-[var(--accent)] bg-teal-50/80 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100/80"
                                >
                                  Composição
                                </button>
                                <button
                                  type="button"
                                  onClick={() => excluirQuantidadeDeKits(p.id)}
                                  className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100/80"
                                  title="Exclui uma quantidade do kit e devolve os componentes ao estoque"
                                >
                                  Excluir kits
                                </button>
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : tab === 'kit' ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 shadow-sm space-y-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Reutilizar kit existente (carregar composição)
                  </label>
                  <input
                    type="search"
                    value={kitBusca}
                    onChange={(e) => setKitBusca(e.target.value)}
                    placeholder="Buscar kit por nome/código…"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Selecionar
                  </label>
                  <select
                    value={kitSelecionadoId}
                    onChange={(e) => {
                      const id = e.target.value
                      setKitSelecionadoId(id)
                      if (id) carregarKitExistente(id)
                      else setKitCriarComoNovo(false)
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  >
                    <option value="">—</option>
                    {kitsCadastrados.slice(0, 200).map(({ produto, kit }) => (
                      <option key={produto.id} value={produto.id}>
                        {produto.descricao} · {produto.codigoInterno || '—'} · Estq. {produto.estoqueAtual} · {kit.itens.length} itens
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Mostrando {Math.min(200, kitsCadastrados.length)} de {kitsCadastrados.length}.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Nome/descrição do kit</label>
                <input
                  type="text"
                  value={kitNome}
                  onChange={(e) => setKitNome(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  placeholder="Ex.: Kit freio + cabos"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKitCriarComoNovo((v) => !v)}
                    className={`rounded-xl px-3 py-2 text-xs font-semibold border ${
                      kitCriarComoNovo
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface)]'
                    }`}
                    title={
                      kitCriarComoNovo
                        ? 'Criar um NOVO produto-kit com esta composição'
                        : 'Atualizar o kit selecionado (se houver) ou reaproveitar por nome exato'
                    }
                  >
                    {kitCriarComoNovo ? 'Criando como novo kit' : 'Criar como novo kit'}
                  </button>
                  {kitSelecionadoId && !kitCriarComoNovo ? (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Modo atual: <strong className="text-[var(--text)]">atualizar kit selecionado</strong> (renomeia a descrição se você alterar o
                      nome).
                    </span>
                  ) : kitSelecionadoId && kitCriarComoNovo ? (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Modo atual: <strong className="text-[var(--text)]">novo kit</strong> (o kit original não será alterado).
                    </span>
                  ) : (
                    <span className="text-[11px] text-[var(--text-muted)]">
                      Dica: selecione um kit para editar/renomear, ou ative “Criar como novo kit” para duplicar composição.
                    </span>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text)] mb-1.5">Quantidade de kits</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={qtdKits}
                  onChange={(e) => {
                    const v = Math.max(1, Math.trunc(Number(e.target.value) || 1))
                    setQtdKits(v)
                    setErroKit(null)
                  }}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Itens do kit</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-[var(--text)] mb-1">Produto</label>
                  <div className="relative">
                    <input
                      role="combobox"
                      aria-expanded={produtoDropdownAberto}
                      aria-controls="estoque-kit-produtos-list"
                      aria-autocomplete="list"
                      type="text"
                      value={produtoBuscaKit}
                      onChange={(e) => {
                        setProdutoBuscaKit(e.target.value)
                        setProdutoDropdownAberto(true)
                        setProdutoActiveIdx(0)
                        setProdutoAddId('')
                      }}
                      onFocus={() => setProdutoDropdownAberto(true)}
                      onBlur={() => {
                        if (produtoBlurTimeoutRef.current) window.clearTimeout(produtoBlurTimeoutRef.current)
                        produtoBlurTimeoutRef.current = window.setTimeout(() => setProdutoDropdownAberto(false), 120)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault()
                          setProdutoDropdownAberto(true)
                          setProdutoActiveIdx((i) => Math.min(i + 1, Math.max(0, produtosParaKit.length - 1)))
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
                          const p = produtosParaKit[produtoActiveIdx]
                          if (p) selecionarProdutoParaKit(p.id)
                          return
                        }
                        if (e.key === 'Escape') {
                          setProdutoDropdownAberto(false)
                        }
                      }}
                      placeholder="Digite para buscar e selecionar…"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />

                    {produtoDropdownAberto ? (
                      <div
                        id="estoque-kit-produtos-list"
                        role="listbox"
                        className="absolute z-20 mt-1 w-full overflow-auto max-h-64 rounded-xl border border-[var(--border)] bg-white shadow-lg"
                      >
                        {produtosParaKit.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-[var(--text-muted)]">
                            Nenhum produto encontrado (somente estoque &gt; 0).
                          </div>
                        ) : (
                          produtosParaKit.slice(0, 160).map((p, idx) => (
                            <button
                              key={p.id}
                              type="button"
                              role="option"
                              aria-selected={idx === produtoActiveIdx}
                              onMouseDown={(ev) => ev.preventDefault()}
                              onClick={() => selecionarProdutoParaKit(p.id)}
                              onMouseEnter={() => setProdutoActiveIdx(idx)}
                              className={`w-full text-left px-3 py-2 text-sm border-b border-[var(--border)]/60 last:border-b-0 ${
                                idx === produtoActiveIdx ? 'bg-[var(--surface)]' : 'bg-white'
                              }`}
                            >
                              <div className="font-medium text-[var(--text)]">{p.descricao}</div>
                              <div className="text-[11px] text-[var(--text-muted)] tabular-nums">
                                {p.codigoInterno ? `Cód. ${p.codigoInterno} · ` : ''}
                                Estq. {p.estoqueAtual ?? 0}
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-1">
                    Busque por descrição, código interno, SKU ou código de barras. Apenas produtos com estoque &gt; 0 são listados.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text)] mb-1">Qtd por kit</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={qtdAdd}
                    onChange={(e) => setQtdAdd(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={adicionarItemKit}
                  disabled={!produtoAddId}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Adicionar ao kit
                </button>
              </div>

              {kitItens.length > 0 ? (
                <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-white">
                  <table className="w-full text-sm">
                    <thead className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                      <tr>
                        <th className="px-3 py-2">Produto</th>
                        <th className="px-3 py-2 text-right">Qtd/kit</th>
                        <th className="px-3 py-2 text-right">Consumo (total)</th>
                        <th className="px-3 py-2 w-20"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {kitItens.map((i) => {
                        const p = produtos.find((x) => x.id === i.produtoId)
                        if (!p) return null
                        const consumo = round2(i.quantidadePorKit * Math.max(1, qtdKits))
                        return (
                          <tr key={i.produtoId} className="border-b border-[var(--border)]/70">
                            <td className="px-3 py-2 text-[var(--text)]">
                              {p.descricao}{' '}
                              <span className="text-xs text-[var(--text-muted)]">· Estq. {p.estoqueAtual}</span>
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={i.quantidadePorKit}
                                onChange={(e) => atualizarQtdItemKit(i.produtoId, Number(e.target.value))}
                                className="w-24 rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-sm tabular-nums text-right"
                                title="Ajuste a quantidade por kit (0 remove o item)"
                              />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{consumo}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => removerItemKit(i.produtoId)}
                                className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-[var(--text-muted)]">Nenhum item adicionado ao kit ainda.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-[var(--text-muted)]">Custo do kit (1 un.): </span>
                <strong className="text-[var(--text)] tabular-nums">{formatarBrl(custoKit)}</strong>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setKitNome('')
                    setQtdKits(1)
                    setKitItens([])
                    setErroKit(null)
                    setKitBusca('')
                    setKitSelecionadoId('')
                    setKitCriarComoNovo(false)
                    setProdutoAddId('')
                    setProdutoBuscaKit('')
                    setProdutoDropdownAberto(false)
                    setProdutoActiveIdx(0)
                  }}
                  className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={montarKit}
                  disabled={!disponibilidadeOk(kitItens, produtos, Math.max(1, qtdKits)).ok}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                >
                  Confirmar montagem (debitar estoque)
                </button>
              </div>
            </div>

            {erroKit ? <p className="text-sm text-red-600">{erroKit}</p> : null}

            {kitItens.length > 0 ? (
              (() => {
                const val = disponibilidadeOk(kitItens, produtos, Math.max(1, qtdKits))
                if (val.ok) return null
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3 py-2 text-xs text-amber-950 space-y-1">
                    <p className="font-semibold">Faltas de estoque</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {val.faltas.map((f) => (
                        <li key={f.produtoId}>
                          {f.descricao}: precisa {f.precisa}, tem {f.tem}
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })()
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Pedido de compra</p>
                  <h2 className="mt-1 text-lg font-bold text-[var(--text)]">Lista de produtos a comprar</h2>
                  <p className="mt-1 text-sm text-[var(--text-muted)]">
                    Esta lista é <strong className="text-[var(--text)]">independente</strong> do estoque e do cadastro de produtos.
                    Você pode incluir itens avulsos sem cadastrar.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={criarPedido}
                    className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                    title="Criar um novo pedido e continuar nele"
                  >
                    Novo pedido
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
                    title="Imprimir lista (uso interno)"
                  >
                    Imprimir
                  </button>
                  <button
                    type="button"
                    onClick={limparListaPedido}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800"
                    title="Limpar lista"
                  >
                    Limpar lista
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-3 items-end">
                <div className="lg:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] mb-1">
                    Pedido atual
                  </label>
                  <select
                    value={pedidoAtivo.id}
                    onChange={(e) => {
                      setPedidoCompraAtivo(e.target.value)
                      setPedidoState(loadPedidosCompraState())
                    }}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
                  >
                    {pedidoState.pedidos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome} · {p.itens.length} itens · {new Date(p.atualizadoEmIso).toLocaleString('pt-BR')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={renomearPedidoAtual}
                    className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--surface)]"
                  >
                    Renomear
                  </button>
                  <button
                    type="button"
                    onClick={excluirPedidoAtual}
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <section className="lg:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-5 shadow-sm space-y-4">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adicionar produto cadastrado</p>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--text)]">Buscar</label>
                    <input
                      type="search"
                      value={pedidoBuscaProduto}
                      onChange={(e) => setPedidoBuscaProduto(e.target.value)}
                      placeholder="Filtrar por código, descrição, SKU, barras…"
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--text)]">Produto</label>
                    <select
                      value={pedidoProdutoId}
                      onChange={(e) => setPedidoProdutoId(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Selecione…</option>
                      {produtosParaPedido.slice(0, 250).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.descricao} · {p.codigoInterno || '—'} · Estq. {p.estoqueAtual}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      Mostrando {Math.min(250, produtosParaPedido.length)} de {produtosParaPedido.length}.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Quantidade</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={pedidoQtd}
                        onChange={(e) => setPedidoQtd(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Observação (opcional)</label>
                      <input
                        type="text"
                        value={pedidoObs}
                        onChange={(e) => setPedidoObs(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                        placeholder="Ex.: fornecedor preferencial, urgência…"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={adicionarProdutoAoPedido}
                      className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
                    >
                      Adicionar à lista
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adicionar item avulso (sem cadastro)</p>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-[var(--text)]">Descrição</label>
                    <input
                      type="text"
                      value={pedidoAvulsoDesc}
                      onChange={(e) => setPedidoAvulsoDesc(e.target.value)}
                      className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                      placeholder="Ex.: Parafuso 6mm inox, caixa com 100"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Quantidade</label>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={pedidoAvulsoQtd}
                        onChange={(e) => setPedidoAvulsoQtd(Math.max(1, Math.trunc(Number(e.target.value) || 1)))}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-[var(--text)] mb-1">Observação (opcional)</label>
                      <input
                        type="text"
                        value={pedidoAvulsoObs}
                        onChange={(e) => setPedidoAvulsoObs(e.target.value)}
                        className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                        placeholder="Ex.: especificação, marca, referência…"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={adicionarAvulsoAoPedido}
                      className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--accent)] hover:bg-teal-50"
                    >
                      Adicionar avulso
                    </button>
                  </div>
                </div>

                {erroPedido ? (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{erroPedido}</p>
                ) : null}
              </section>

              <section className="lg:col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--surface)]/40 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    Itens na lista <span className="text-[var(--text-muted)]">({pedidoItens.length})</span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    Atualizado em{' '}
                    <span className="font-mono text-[var(--text)]">
                      {new Date(pedidoAtivo.atualizadoEmIso).toLocaleString('pt-BR')}
                    </span>
                  </p>
                </div>

                <div id="pedido-compra-print" className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[860px]">
                    <thead>
                      <tr className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                        <th className="px-3 py-2 w-28">Origem</th>
                        <th className="px-3 py-2 min-w-[260px]">Descrição</th>
                        <th className="px-3 py-2 text-right">Estoque</th>
                        <th className="px-3 py-2 text-right">Mínimo</th>
                        <th className="px-3 py-2 text-right">Qtd pedir</th>
                        <th className="px-3 py-2">Obs.</th>
                        <th className="px-3 py-2 text-right w-24 no-print">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidoItens.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">
                            Nenhum item ainda. Use o painel à esquerda para adicionar produtos.
                          </td>
                        </tr>
                      ) : (
                        pedidoItens.map((it) => {
                          const p = it.kind === 'produto' ? produtos.find((x) => x.id === it.produtoId) ?? null : null
                          const origem = it.kind === 'produto' ? 'Cadastro' : 'Avulso'
                          const descricao = it.kind === 'produto' ? (p?.descricao ?? 'Produto removido do cadastro') : it.descricao
                          const estoqueAtual = it.kind === 'produto' ? (p?.estoqueAtual ?? 0) : null
                          const estoqueMin = it.kind === 'produto' ? (p?.estoqueMinimo ?? 0) : null
                          const codigo = it.kind === 'produto' ? (p?.codigoInterno || '—') : '—'

                          return (
                            <tr key={it.id} className="border-b border-[var(--border)]/70">
                              <td className="px-3 py-3 text-xs">
                                <div className="font-medium text-[var(--text)]">{origem}</div>
                                <div className="font-mono text-[10px] text-[var(--text-muted)]">{codigo}</div>
                              </td>
                              <td className="px-3 py-3 text-[var(--text)]">
                                <div className="font-medium">{descricao}</div>
                                {it.kind === 'produto' && p?.codigoFornecedor ? (
                                  <div className="text-[11px] text-[var(--text-muted)]">SKU: {p.codigoFornecedor}</div>
                                ) : null}
                              </td>
                              <td className="px-3 py-3 text-right tabular-nums">{estoqueAtual === null ? '—' : estoqueAtual}</td>
                              <td className="px-3 py-3 text-right tabular-nums">{estoqueMin === null ? '—' : estoqueMin}</td>
                              <td className="px-3 py-3 text-right">
                                <input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={it.quantidade}
                                  onChange={(e) => atualizarQtdPedido(it.id, Number(e.target.value))}
                                  className="w-28 rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums text-right"
                                  title="Ajuste a quantidade (0 remove o item)"
                                />
                              </td>
                              <td className="px-3 py-3 text-xs text-[var(--text-muted)]">{it.observacao || '—'}</td>
                              <td className="px-3 py-3 text-right no-print">
                                <button
                                  type="button"
                                  onClick={() => removerItemPedido(it.id)}
                                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-xs font-semibold hover:bg-[var(--surface)]"
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
            </div>
          </div>
        )}
      </main>

      <ProdutoFormModal
        aberto={produtoModalAberto}
        modo="editar"
        produtoInicial={produtoEditar}
        onFechar={() => setProdutoModalAberto(false)}
        onSalvar={(dados) => {
          if (!produtoEditar) return
          updateProduto(produtoEditar.id, dados)
          setProdutoModalAberto(false)
          refresh()
        }}
      />

      <KitComposicaoModal
        aberto={kitCompAberto}
        produtoKit={produtoEditar}
        kitAtual={kitAtual}
        produtosDisponiveis={produtosControleEstoque}
        produtosResolucao={produtos}
        onAjustarEstoque={ajustarEstoqueDelta}
        onFechar={() => setKitCompAberto(false)}
        onSalvar={(draft) => {
          if (!produtoEditar) return
          const custo = calcularCustoKit(
            draft.itens.map((i) => ({ produtoId: i.produtoId, quantidadePorKit: i.quantidade })),
            loadProdutos(),
          )
          const produtoNext = loadProdutos().find((p) => p.id === produtoEditar.id)
          if (produtoNext) {
            const { id: _id, criadoEm: _c, ...rest } = produtoNext
            updateProduto(produtoNext.id, {
              ...rest,
              valorCusto: custo,
              observacoes: produtoNext.observacoes?.includes('KIT')
                ? produtoNext.observacoes
                : `${produtoNext.observacoes || ''} KIT`.trim(),
            })
          }
          upsertKitByProdutoKitId(produtoEditar.id, {
            nome: produtoEditar.descricao.trim(),
            itens: draft.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })),
            estoqueComprometido: true,
          })
          setKitCompAberto(false)
          refresh()
        }}
      />
    </div>
  )
}

