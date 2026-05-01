import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Produto } from '../types'
import { ProdutoFormModal } from '../components/ProdutoFormModal'
import { ImportarPedidoPlanilhaModal } from '../components/ImportarPedidoPlanilhaModal'
import {
  addProduto,
  loadProdutos,
  removeProdutos,
  updateProduto,
} from '../store/produtos'
import { formatarBrl } from '../utils/moeda'

type Props = {
  onVoltar: () => void
}

type ModoBusca = 'descricao' | 'codigo' | 'informacoes' | 'observacoes'

function siglaTipo(p: Produto): string {
  switch (p.tipoLancamento) {
    case 'sem_controle_estoque':
      return 'N'
    case 'controle_estoque':
      return 'C'
    case 'servico':
      return 'S'
    default:
      return '—'
  }
}

function normBusca(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function GestaoProdutos({ onVoltar }: Props) {
  const [lista, setLista] = useState<Produto[]>(() => loadProdutos())
  const [idsSelecionados, setIdsSelecionados] = useState<string[]>([])
  const checkboxTodosRef = useRef<HTMLInputElement>(null)
  const [termo, setTermo] = useState('')
  const [modoBusca, setModoBusca] = useState<ModoBusca>('descricao')
  const [detalheLista, setDetalheLista] = useState('todos')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalModo, setModalModo] = useState<'novo' | 'editar'>('novo')
  const [importPedidoAberto, setImportPedidoAberto] = useState(false)

  const refresh = useCallback(() => setLista(loadProdutos()), [])

  const filtrados = useMemo(() => {
    const t = normBusca(termo.trim())
    return lista.filter((p) => {
      if (!t) return true
      switch (modoBusca) {
        case 'descricao':
          return normBusca(p.descricao).includes(t)
        case 'codigo':
          return (
            normBusca(p.codigoBarras).includes(t) ||
            normBusca(p.codigoInterno).includes(t) ||
            normBusca(p.codigoFornecedor).includes(t)
          )
        case 'informacoes':
          return normBusca(p.informacoesAdicionais).includes(t)
        case 'observacoes':
          return normBusca(p.observacoes).includes(t)
        default:
          return true
      }
    })
  }, [lista, termo, modoBusca])

  const selecionado = useMemo(() => {
    if (idsSelecionados.length !== 1) return null
    return lista.find((p) => p.id === idsSelecionados[0]) ?? null
  }, [lista, idsSelecionados])

  const idsFiltrados = useMemo(() => filtrados.map((p) => p.id), [filtrados])

  const todosFiltradosMarcados =
    idsFiltrados.length > 0 && idsFiltrados.every((id) => idsSelecionados.includes(id))
  const algunsFiltradosMarcados = idsFiltrados.some((id) => idsSelecionados.includes(id))

  useEffect(() => {
    const el = checkboxTodosRef.current
    if (el) el.indeterminate = algunsFiltradosMarcados && !todosFiltradosMarcados
  }, [algunsFiltradosMarcados, todosFiltradosMarcados])

  useEffect(() => {
    function onChanged() {
      refresh()
    }
    window.addEventListener('pc:produtos-changed', onChanged as EventListener)
    // Também cobre atualização por outra aba/janela.
    window.addEventListener('storage', onChanged)
    return () => {
      window.removeEventListener('pc:produtos-changed', onChanged as EventListener)
      window.removeEventListener('storage', onChanged)
    }
  }, [refresh])

  function abrirNovo() {
    setModalModo('novo')
    setModalAberto(true)
  }

  function abrirEditar() {
    if (!selecionado) return
    setModalModo('editar')
    setModalAberto(true)
  }

  function alternarSelecao(id: string) {
    setIdsSelecionados((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function alternarTodosFiltrados() {
    if (idsFiltrados.length === 0) return
    if (todosFiltradosMarcados) {
      setIdsSelecionados((prev) => prev.filter((id) => !idsFiltrados.includes(id)))
    } else {
      setIdsSelecionados((prev) => [...new Set([...prev, ...idsFiltrados])])
    }
  }

  function apagarSelecionados() {
    if (idsSelecionados.length === 0) return
    const n = idsSelecionados.length
    const msg =
      n === 1
        ? 'Excluir este produto? Esta ação não pode ser desfeita.'
        : `Excluir ${n} produtos? Esta ação não pode ser desfeita.`
    if (!confirm(msg)) return
    removeProdutos(idsSelecionados)
    setIdsSelecionados([])
    refresh()
  }

  function aoSalvarModal(dados: Omit<Produto, 'id' | 'criadoEm'>) {
    if (modalModo === 'novo') {
      addProduto(dados)
    } else if (selecionado) {
      updateProduto(selecionado.id, dados)
    }
    setModalAberto(false)
    refresh()
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] sticky top-0 z-10 shadow-sm">
        <div className="w-full px-4 sm:px-8 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Cadastros</p>
            <h1 className="text-xl font-bold text-[var(--text)]">Produtos</h1>
          </div>
          <button
            type="button"
            onClick={onVoltar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
          >
            Fechar
          </button>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-8 py-6 space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 space-y-4 shadow-sm">
          <div className="flex flex-col lg:flex-row gap-3 lg:items-end">
            <div className="flex-1">
              <label htmlFor="busca-prod" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Pesquisa no cadastro existente por descrição (ajuste o modo abaixo)
              </label>
              <input
                id="busca-prod"
                type="search"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="Digite para filtrar…"
              />
            </div>
            <div className="lg:w-64">
              <label htmlFor="filtro-detalhe" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
                Exibição da lista
              </label>
              <select
                id="filtro-detalhe"
                value={detalheLista}
                onChange={(e) => setDetalheLista(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="todos">Mostrar todos sem detalhamento</option>
              </select>
            </div>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">Modo de pesquisa</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ['descricao', 'Descrição'],
                  ['codigo', 'Código'],
                  ['informacoes', 'Informações adicionais'],
                  ['observacoes', 'Observações'],
                ] as const
              ).map(([val, lab]) => (
                <label key={val} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo-busca"
                    checked={modoBusca === val}
                    onChange={() => setModoBusca(val)}
                  />
                  {lab}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={abrirNovo}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Novo
          </button>
          <button
            type="button"
            onClick={() => setImportPedidoAberto(true)}
            className="rounded-xl border border-[var(--accent)] bg-teal-50/80 px-4 py-2 text-sm font-semibold text-teal-900 hover:bg-teal-100/80"
          >
            Entrada por planilha
          </button>
          <button
            type="button"
            onClick={apagarSelecionados}
            disabled={idsSelecionados.length === 0}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apagar{idsSelecionados.length > 0 ? ` (${idsSelecionados.length})` : ''}
          </button>
          <button
            type="button"
            onClick={abrirEditar}
            disabled={idsSelecionados.length !== 1}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Pesquisar
          </button>
          <button
            type="button"
            disabled
            title="Em breve"
            className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed"
          >
            Etiquetas
          </button>
          <button
            type="button"
            disabled
            title="Em breve"
            className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed"
          >
            Gerar relatório
          </button>
          <div className="w-full sm:w-auto sm:ml-auto flex flex-wrap gap-2 items-center">
            <select disabled className="rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed">
              <option>Somente tipo</option>
            </select>
            <select disabled className="rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed">
              <option>Somente fornecedor</option>
            </select>
            <button
              type="button"
              disabled
              title="Em breve"
              className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed"
            >
              Reajuste de preços
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="px-2 py-2 w-10 text-center">
                    <input
                      ref={checkboxTodosRef}
                      type="checkbox"
                      className="rounded border-[var(--border)]"
                      checked={todosFiltradosMarcados}
                      disabled={filtrados.length === 0}
                      onChange={alternarTodosFiltrados}
                      title="Marcar ou desmarcar todos os itens da lista filtrada"
                      aria-label="Marcar ou desmarcar todos os itens da lista filtrada"
                    />
                  </th>
                  <th className="px-3 py-2 w-10">T</th>
                  <th className="px-3 py-2 w-10">TL</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2 min-w-[200px]">Descrição do item</th>
                  <th className="px-3 py-2 text-right">Vr. custo</th>
                  <th className="px-3 py-2 text-right">Vr. varejo</th>
                  <th className="px-3 py-2 text-right">Vr. atacado</th>
                  <th className="px-3 py-2 text-right">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Nenhum produto nesta lista. Use Novo para incluir o primeiro cadastro.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((p) => {
                    const ativo = p.ativo
                    const marcado = idsSelecionados.includes(p.id)
                    return (
                      <tr
                        key={p.id}
                        onClick={() => alternarSelecao(p.id)}
                        className={`border-b border-[var(--border)] cursor-pointer ${
                          marcado ? 'bg-teal-50/80' : 'hover:bg-[var(--surface)]'
                        }`}
                      >
                        <td
                          className="px-2 py-2 text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            className="rounded border-[var(--border)]"
                            checked={marcado}
                            onChange={() => alternarSelecao(p.id)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={`Selecionar ${p.descricao}`}
                          />
                        </td>
                        <td className="px-3 py-2 text-center text-xs text-[var(--text-muted)]">{ativo ? '●' : '○'}</td>
                        <td className="px-3 py-2 text-center text-xs font-mono text-[var(--text-muted)]">{siglaTipo(p)}</td>
                        <td className="px-3 py-2 text-xs">
                          <div className="font-mono text-[var(--text)]">{p.codigoInterno || '—'}</div>
                          {p.codigoFornecedor ? (
                            <div className="text-[10px] text-[var(--text-muted)] mt-0.5">
                              Forn. {p.codigoFornecedor}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">{p.descricao}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarBrl(p.valorCusto)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarBrl(p.valorVarejo)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarBrl(p.valorAtacado)}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{p.estoqueAtual}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <ProdutoFormModal
        aberto={modalAberto}
        modo={modalModo}
        produtoInicial={modalModo === 'editar' ? selecionado : null}
        onFechar={() => setModalAberto(false)}
        onSalvar={aoSalvarModal}
      />

      <ImportarPedidoPlanilhaModal
        aberto={importPedidoAberto}
        onFechar={() => setImportPedidoAberto(false)}
        onConcluido={refresh}
      />
    </div>
  )
}
