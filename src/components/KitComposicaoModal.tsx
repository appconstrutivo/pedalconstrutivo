import { useEffect, useMemo, useRef, useState } from 'react'
import type { Kit, Produto } from '../types'
import { formatarBrl, round2 } from '../utils/moeda'

type LinhaDraft = { produtoId: string; quantidade: number }

type Props = {
  aberto: boolean
  produtoKit: Produto | null
  kitAtual: Kit | null
  produtosDisponiveis: Produto[]
  /**
   * Ajusta estoque do produto componente em tempo real (delta pode ser negativo).
   * Deve retornar false quando não for possível (ex.: estoque insuficiente).
   */
  onAjustarEstoque: (produtoId: string, delta: number) => boolean
  onFechar: () => void
  onSalvar: (draft: { itens: { produtoId: string; quantidade: number }[] }) => void
}

function custoKit(itens: LinhaDraft[], produtos: Produto[]): number {
  let total = 0
  for (const i of itens) {
    const p = produtos.find((x) => x.id === i.produtoId)
    if (!p) continue
    total += (p.valorCusto || 0) * (i.quantidade || 0)
  }
  return round2(total)
}

export function KitComposicaoModal({
  aberto,
  produtoKit,
  kitAtual,
  produtosDisponiveis,
  onAjustarEstoque,
  onFechar,
  onSalvar,
}: Props) {
  const [produtoAddId, setProdutoAddId] = useState('')
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtoDropdownAberto, setProdutoDropdownAberto] = useState(false)
  const [produtoActiveIdx, setProdutoActiveIdx] = useState(0)
  const [qtdAdd, setQtdAdd] = useState(1)
  const [erro, setErro] = useState<string | null>(null)

  const [itens, setItens] = useState<LinhaDraft[]>([])
  const ajustesAplicadosRef = useRef<Map<string, number>>(new Map())
  const initKeyRef = useRef<string | null>(null)
  const produtoBlurTimeoutRef = useRef<number | null>(null)

  // Re-hidrata quando abre em outro kit
  const kitIdKey = `${produtoKit?.id ?? ''}::${kitAtual?.id ?? ''}`
  useEffect(() => {
    if (!aberto) return
    // Evita duplicidade em dev (StrictMode) e re-renders.
    if (initKeyRef.current === kitIdKey) return
    initKeyRef.current = kitIdKey

    setErro(null)
    setProdutoAddId('')
    setProdutoBusca('')
    setProdutoDropdownAberto(false)
    setProdutoActiveIdx(0)
    setQtdAdd(1)
    ajustesAplicadosRef.current = new Map()

    const base = kitAtual ? kitAtual.itens.map((i) => ({ produtoId: i.produtoId, quantidade: i.quantidade })) : []
    setItens(base)

    // Para kits antigos que ainda não fizeram baixa na composição, baixa agora (e reverte no cancelamento).
    if (produtoKit && kitAtual && kitAtual.estoqueComprometido !== true && base.length > 0) {
      for (const i of base) {
        const ok = onAjustarEstoque(i.produtoId, -i.quantidade)
        if (ok) {
          ajustesAplicadosRef.current.set(
            i.produtoId,
            (ajustesAplicadosRef.current.get(i.produtoId) ?? 0) - i.quantidade,
          )
        }
      }
    }
  }, [aberto, kitIdKey, kitAtual, onAjustarEstoque, produtoKit])

  const custo = useMemo(() => custoKit(itens, produtosDisponiveis), [itens, produtosDisponiveis])
  const produtosFiltrados = useMemo(() => {
    const q = produtoBusca.trim()
    const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    const nq = norm(q)
    return produtosDisponiveis
      .filter((p) => p.id !== produtoKit?.id)
      .filter((p) => {
        if (!nq) return true
        const hay = norm([p.descricao, p.codigoInterno, p.codigoFornecedor, p.codigoBarras].join(' '))
        return hay.includes(nq)
      })
  }, [produtoBusca, produtoKit?.id, produtosDisponiveis])

  if (!aberto || !produtoKit) return null
  const produtoKitId = produtoKit.id

  function reverterAjustesAplicados() {
    for (const [pid, delta] of ajustesAplicadosRef.current.entries()) {
      if (delta !== 0) onAjustarEstoque(pid, -delta)
    }
    ajustesAplicadosRef.current = new Map()
    initKeyRef.current = null
  }

  function fecharComReversao() {
    reverterAjustesAplicados()
    onFechar()
  }

  function adicionar() {
    setErro(null)
    if (!produtoAddId) return
    if (produtoAddId === produtoKitId) {
      setErro('Não é permitido adicionar o próprio kit como item.')
      return
    }
    const q = Math.max(1, Math.trunc(Number(qtdAdd) || 1))
    const ok = onAjustarEstoque(produtoAddId, -q)
    if (!ok) {
      setErro('Estoque insuficiente para adicionar este item ao kit.')
      return
    }
    ajustesAplicadosRef.current.set(
      produtoAddId,
      (ajustesAplicadosRef.current.get(produtoAddId) ?? 0) - q,
    )
    setItens((prev) => {
      const idx = prev.findIndex((x) => x.produtoId === produtoAddId)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + q }
        return next
      }
      return [...prev, { produtoId: produtoAddId, quantidade: q }]
    })
    setProdutoAddId('')
    setProdutoBusca('')
    setProdutoDropdownAberto(false)
    setProdutoActiveIdx(0)
    setQtdAdd(1)
  }

  function selecionarProduto(pid: string) {
    setProdutoAddId(pid)
    const p = produtosDisponiveis.find((x) => x.id === pid)
    setProdutoBusca(p ? p.descricao : '')
    setProdutoDropdownAberto(false)
  }

  function remover(produtoId: string) {
    const item = itens.find((x) => x.produtoId === produtoId)
    if (item) {
      onAjustarEstoque(produtoId, item.quantidade)
      ajustesAplicadosRef.current.set(
        produtoId,
        (ajustesAplicadosRef.current.get(produtoId) ?? 0) + item.quantidade,
      )
    }
    setItens((prev) => prev.filter((x) => x.produtoId !== produtoId))
  }

  function salvar() {
    setErro(null)
    if (itens.length === 0) {
      setErro('O kit precisa ter ao menos 1 item.')
      return
    }
    onSalvar({ itens: itens.map((i) => ({ produtoId: i.produtoId, quantidade: round2(i.quantidade) })) })
    ajustesAplicadosRef.current = new Map()
    initKeyRef.current = null
  }

  return (
    <div
      className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-slate-900/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="kit-comp-titulo"
      onClick={fecharComReversao}
    >
      <div
        className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[min(92vh,900px)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="kit-comp-titulo" className="text-lg font-bold text-[var(--text)]">
              Kit — composição
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              Kit: <strong className="text-[var(--text)]">{produtoKit.descricao}</strong> · Custo calculado:{' '}
              <strong className="text-[var(--text)] tabular-nums">{formatarBrl(custo)}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={fecharComReversao}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Adicionar item</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-[var(--text)] mb-1">Produto</label>
                <div className="relative">
                  <input
                    role="combobox"
                    aria-expanded={produtoDropdownAberto}
                    aria-controls="kit-comp-produtos-list"
                    aria-autocomplete="list"
                    type="text"
                    value={produtoBusca}
                    onChange={(e) => {
                      setProdutoBusca(e.target.value)
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
                        setProdutoActiveIdx((i) => Math.min(i + 1, Math.max(0, produtosFiltrados.length - 1)))
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
                      if (e.key === 'Escape') {
                        setProdutoDropdownAberto(false)
                      }
                    }}
                    placeholder="Digite para buscar e selecionar…"
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />

                  {produtoDropdownAberto ? (
                    <div
                      id="kit-comp-produtos-list"
                      role="listbox"
                      className="absolute z-20 mt-1 w-full overflow-auto max-h-64 rounded-xl border border-[var(--border)] bg-white shadow-lg"
                    >
                      {produtosFiltrados.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-[var(--text-muted)]">Nenhum produto encontrado.</div>
                      ) : (
                        produtosFiltrados.slice(0, 120).map((p, idx) => (
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
                              {p.codigoInterno ? `Cód. ${p.codigoInterno} · ` : ''}
                              Estq. {p.estoqueAtual ?? 0}
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
                </div>
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
                onClick={adicionar}
                disabled={!produtoAddId}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Adicionar
              </button>
            </div>
          </div>

          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}

          <div className="rounded-xl border border-[var(--border)] overflow-hidden">
            <p className="px-3 py-2 text-xs font-semibold text-[var(--text-muted)] bg-[var(--surface)] border-b border-[var(--border)]">
              Itens atuais
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)] bg-[var(--surface)]/80">
                    <th className="px-3 py-2">Produto</th>
                    <th className="px-3 py-2 text-right">Qtd/kit</th>
                    <th className="px-3 py-2 text-right">Custo linha</th>
                    <th className="px-3 py-2 w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {itens.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                        Nenhum item no kit.
                      </td>
                    </tr>
                  ) : (
                    itens.map((i) => {
                      const p = produtosDisponiveis.find((x) => x.id === i.produtoId)
                      if (!p) return null
                      const linha = round2((p.valorCusto || 0) * i.quantidade)
                      return (
                        <tr key={i.produtoId} className="border-b border-[var(--border)]/70">
                          <td className="px-3 py-2 text-[var(--text)]">{p.descricao}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{i.quantidade}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{formatarBrl(linha)}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => remover(i.produtoId)}
                              className="rounded-lg border border-[var(--border)] bg-white px-2 py-1 text-xs"
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
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap justify-end gap-2 shrink-0 bg-[var(--surface)]/50 rounded-b-2xl">
          <button
            type="button"
            onClick={fecharComReversao}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Salvar composição
          </button>
        </div>
      </div>
    </div>
  )
}

