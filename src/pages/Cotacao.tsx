import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import type { Fornecedor } from '../types'
import type { ItemCotacaoForm, PrecoFornecedorInput } from '../types'
import {
  loadItensCotacao,
  saveItensCotacao,
  loadFornecedoresVisiveisCotacao,
  saveFornecedoresVisiveisCotacao,
} from '../store/cotacao'
import { montarPedido, normalizarDescricaoParaMatch } from '../utils/cotacao'
import { lerItensDoExcel } from '../utils/importarExcel'
import { lerItensDoPdf } from '../utils/importarPdf'
import { formatarMoeda } from '../utils/cotacao'
import { gerarPdfPedidosPorFornecedor } from '../utils/gerarPdfPedidos'

interface CotacaoProps {
  fornecedores: Fornecedor[]
}

function createItem(descricao: string, fornecedores: Fornecedor[], quantidade = 1): ItemCotacaoForm {
  const q = quantidade > 0 ? quantidade : 1
  return {
    id: crypto.randomUUID(),
    descricao: descricao.trim(),
    quantidade: q,
    precos: fornecedores.map((f) => ({ fornecedorId: f.id, preco: '' })),
  }
}

function resolverQuantidadeImportada(
  imp: { quantidade?: number },
  existente: number | undefined
): number {
  if (imp.quantidade != null && imp.quantidade > 0) return imp.quantidade
  if (existente != null && existente > 0) return existente
  return 1
}

function getPrecoStr(item: ItemCotacaoForm, fornecedorId: string): string {
  const p = item.precos.find((x) => x.fornecedorId === fornecedorId)
  return p?.preco ?? ''
}

function setPrecoStr(
  item: ItemCotacaoForm,
  fornecedorId: string,
  valor: string
): PrecoFornecedorInput[] {
  const exists = item.precos.some((x) => x.fornecedorId === fornecedorId)
  if (exists) {
    return item.precos.map((p) =>
      p.fornecedorId === fornecedorId ? { ...p, preco: valor } : p
    )
  }
  return [...item.precos, { fornecedorId, preco: valor }]
}

/** Garante uma entrada de preço por fornecedor cadastrado (quando um novo fornecedor é adicionado). */
function garantirPrecosPorFornecedor(item: ItemCotacaoForm, fornecedores: Fornecedor[]): ItemCotacaoForm {
  const ids = new Set(item.precos.map((p) => p.fornecedorId))
  const novos = fornecedores.filter((f) => !ids.has(f.id)).map((f) => ({ fornecedorId: f.id, preco: '' }))
  if (novos.length === 0) return item
  return { ...item, precos: [...item.precos, ...novos] }
}

export function Cotacao({ fornecedores }: CotacaoProps) {
  const [itens, setItens] = useState<ItemCotacaoForm[]>(loadItensCotacao)
  const [novaDescricao, setNovaDescricao] = useState('')
  const [resultado, setResultado] = useState<ReturnType<typeof montarPedido> | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  /** Fornecedor ao qual a coluna "Preço de Venda" da planilha será atribuída na importação. */
  const [fornecedorImportId, setFornecedorImportId] = useState<string>('')
  const [fornecedoresVisiveisIds, setFornecedoresVisiveisIds] = useState<string[]>(loadFornecedoresVisiveisCotacao)
  const inputExcelRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveItensCotacao(itens)
  }, [itens])

  useEffect(() => {
    saveFornecedoresVisiveisCotacao(fornecedoresVisiveisIds)
  }, [fornecedoresVisiveisIds])

  useEffect(() => {
    if (fornecedores.length === 0) return
    setFornecedorImportId((id) => {
      if (id && fornecedores.some((f) => f.id === id)) return id
      return fornecedores[0].id
    })
  }, [fornecedores])

  useLayoutEffect(() => {
    if (fornecedores.length === 0) return
    setFornecedoresVisiveisIds((prev) => {
      const valid = prev.filter((id) => fornecedores.some((f) => f.id === id))
      const missing = fornecedores.filter((f) => !valid.includes(f.id)).map((f) => f.id)
      const next = [...valid, ...missing]
      return next.length > 0 ? next : fornecedores.map((f) => f.id)
    })
  }, [fornecedores])

  useEffect(() => {
    if (fornecedores.length === 0) return
    setItens((prev) => prev.map((i) => garantirPrecosPorFornecedor(i, fornecedores)))
  }, [fornecedores])

  /** Fornecedores exibidos na tabela e considerados em "Montar pedido" (mínimo 1 quando há cadastro). */
  const idsFornecedoresCotacao = useMemo(() => {
    const validIds = fornecedoresVisiveisIds.filter((id) => fornecedores.some((f) => f.id === id))
    if (validIds.length > 0) return validIds
    return fornecedores.map((f) => f.id)
  }, [fornecedores, fornecedoresVisiveisIds])

  const fornecedoresNaTabela = useMemo(
    () => fornecedores.filter((f) => idsFornecedoresCotacao.includes(f.id)),
    [fornecedores, idsFornecedoresCotacao]
  )

  const adicionarItem = useCallback(() => {
    const desc = novaDescricao.trim()
    if (!desc || fornecedores.length === 0) return
    setItens((prev) => [...prev, createItem(desc, fornecedores)])
    setNovaDescricao('')
    setResultado(null)
  }, [novaDescricao, fornecedores])

  const atualizarPreco = useCallback(
    (itemId: string, fornecedorId: string, valor: string) => {
      setItens((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? { ...i, precos: setPrecoStr(i, fornecedorId, valor) }
            : i
        )
      )
      setResultado(null)
    },
    []
  )

  const atualizarQuantidade = useCallback((itemId: string, valor: string) => {
    const normalized = valor.trim().replace(',', '.')
    const num = parseFloat(normalized)
    const q = Number.isFinite(num) && num > 0 ? num : 1
    setItens((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, quantidade: q } : i))
    )
    setResultado(null)
  }, [])

  const removerItem = useCallback((id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id))
    setResultado(null)
  }, [])

  const montar = useCallback(() => {
    setResultado(montarPedido(itens, fornecedoresNaTabela))
  }, [itens, fornecedoresNaTabela])

  const toggleFornecedorVisivel = useCallback(
    (id: string) => {
      setFornecedoresVisiveisIds((prev) => {
        const validPrev = prev.filter((x) => fornecedores.some((f) => f.id === x))
        const base =
          validPrev.length > 0 ? validPrev : fornecedores.map((f) => f.id)
        if (base.includes(id)) {
          if (base.length <= 1) return base
          return base.filter((x) => x !== id)
        }
        return [...base, id]
      })
      setResultado(null)
    },
    [fornecedores]
  )

  const limpar = useCallback(() => {
    setItens([])
    setResultado(null)
    setNovaDescricao('')
  }, [])

  const importarExcel = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setImportError(null)
      const file = e.target.files?.[0]
      if (!file) return
      e.target.value = ''
      if (!fornecedorImportId || !fornecedores.some((f) => f.id === fornecedorImportId)) {
        setImportError('Selecione o fornecedor correspondente à planilha antes de importar.')
        return
      }
      try {
        const isPdf = file.name.toLowerCase().endsWith('.pdf')
        const importados = isPdf ? await lerItensDoPdf(file) : await lerItensDoExcel(file)
        if (importados.length === 0) {
          setImportError(
            isPdf
              ? 'Nenhum item lido do PDF. Use arquivo com texto selecionável (não apenas imagem) e lista no formato SKU + descrição + preço + quantidade, ou prefira importar o Excel.'
              : 'Nenhum item encontrado. Verifique se a planilha tem uma coluna "Nome" (ou "Preço de Venda").'
          )
          return
        }
        setItens((prev) => {
          const chave = (d: string) => normalizarDescricaoParaMatch(d)
          const indexByKey = new Map<string, number>()
          prev.forEach((it, i) => {
            const k = chave(it.descricao)
            if (!indexByKey.has(k)) indexByKey.set(k, i)
          })
          const result = [...prev]
          for (const imp of importados) {
            const key = chave(imp.descricao)
            const precoStr =
              imp.precoVenda != null && Number.isFinite(imp.precoVenda)
                ? imp.precoVenda <= 0
                  ? '0,00'
                  : imp.precoVenda.toFixed(2).replace('.', ',')
                : ''
            const idx = indexByKey.get(key)
            if (idx !== undefined) {
              const existente = result[idx]
              const qtd = resolverQuantidadeImportada(imp, existente.quantidade)
              result[idx] = {
                ...existente,
                quantidade: qtd,
                precos: precoStr
                  ? setPrecoStr(existente, fornecedorImportId, precoStr)
                  : existente.precos,
              }
            } else {
              const qtd = resolverQuantidadeImportada(imp, undefined)
              const item = createItem(imp.descricao, fornecedores, qtd)
              if (precoStr) item.precos = setPrecoStr(item, fornecedorImportId, precoStr)
              indexByKey.set(key, result.length)
              result.push(item)
            }
          }
          return result
        })
        setResultado(null)
      } catch {
        setImportError('Erro ao ler o arquivo. Use Excel (.xlsx, .xls) ou PDF com texto (não escaneado como imagem pura).')
      }
    },
    [fornecedores, fornecedorImportId]
  )

  const abrirSeletorExcel = useCallback(() => {
    setImportError(null)
    if (!fornecedorImportId || !fornecedores.some((f) => f.id === fornecedorImportId)) {
      setImportError('Selecione o fornecedor correspondente à planilha antes de importar.')
      return
    }
    inputExcelRef.current?.click()
  }, [fornecedorImportId, fornecedores])

  if (fornecedores.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[var(--text)]">Montar cotação</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          Cadastre pelo menos um fornecedor na aba <strong>Fornecedores</strong> antes de montar a cotação.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Montar cotação</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Informe os itens, a quantidade e o preço unitário em cada fornecedor. O total da linha é quantidade × preço; o sistema monta o pedido pelo menor custo por item.
        </p>
      </div>

      <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 sm:p-5 shadow-sm space-y-4">
        <div className="space-y-3">
          <span className="text-sm font-medium text-[var(--text)]">Lista grande (Excel ou PDF)</span>
          <p className="text-sm text-[var(--text-muted)]">
            Escolha o fornecedor dos preços e importe um <strong>Excel</strong> (colunas Nome, Preço de Venda, Quantidade) ou um <strong>PDF</strong> com texto selecionável no formato de lista (SKU, descrição, preço R$, quantidade e total). PDF escaneado só como imagem não funciona. A quantidade entra no total (quantidade × preço). Outro fornecedor com o <strong>mesmo nome</strong> de item atualiza a mesma linha.
          </p>
          <div className="flex flex-col gap-2 max-w-md">
            <label htmlFor="fornecedor-import-excel" className="text-sm font-medium text-[var(--text)]">
              Fornecedor da planilha
            </label>
            <select
              id="fornecedor-import-excel"
              value={fornecedorImportId}
              onChange={(e) => setFornecedorImportId(e.target.value)}
              className="rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] bg-[var(--surface-card)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            ref={inputExcelRef}
            type="file"
            accept=".xlsx,.xls,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/pdf"
            onChange={importarExcel}
            className="hidden"
            aria-label="Selecionar arquivo Excel ou PDF"
          />
          <button
            type="button"
            onClick={abrirSeletorExcel}
            className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)] transition-colors shrink-0 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Importar Excel ou PDF
          </button>
          </div>
        </div>
        {importError && (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2" role="alert">
            {importError}
          </p>
        )}
        <div className="border-t border-[var(--border)] pt-4">
          <label htmlFor="desc-item" className="block text-sm font-medium text-[var(--text)] mb-2">
            Ou adicione item por item
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              id="desc-item"
              type="text"
              value={novaDescricao}
              onChange={(e) => setNovaDescricao(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && adicionarItem()}
              placeholder="Ex: Câmara de ar, Pedal, Guidão"
              className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
            />
            <button
              type="button"
              onClick={adicionarItem}
              className="rounded-lg bg-[var(--accent)] text-white px-4 py-2.5 font-medium hover:bg-[var(--accent-hover)] transition-colors shrink-0"
            >
              Adicionar item
            </button>
          </div>
        </div>
      </div>

      {itens.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="font-medium text-[var(--text)]">Itens da cotação</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={montar}
                className="rounded-lg bg-[var(--accent)] text-white px-4 py-2.5 text-sm font-medium hover:bg-[var(--accent-hover)] transition-colors"
              >
                Montar pedido (menor preço)
              </button>
              <button
                type="button"
                onClick={limpar}
                className="rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]"
              >
                Limpar tudo
              </button>
            </div>
          </div>

          <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)] bg-[var(--surface)]">
            <p className="text-sm font-medium text-[var(--text)] mb-1">Fornecedores nesta cotação</p>
            <p className="text-xs text-[var(--text-muted)] mb-3">
              Marque quais colunas aparecem na tabela. O botão &quot;Montar pedido (menor preço)&quot; usa apenas os fornecedores selecionados. Itens sem preço de um fornecedor podem ficar em branco ou 0,00.
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {fornecedores.map((f) => (
                <label
                  key={f.id}
                  className="inline-flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={idsFornecedoresCotacao.includes(f.id)}
                    onChange={() => toggleFornecedorVisivel(f.id)}
                    className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                  />
                  {f.nome}
                </label>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="bg-[var(--surface)] border-b border-[var(--border)]">
                  <th className="text-left py-3 px-4 font-medium text-[var(--text)]">Item</th>
                  <th className="text-left py-3 px-3 font-medium text-[var(--text)] w-24">Qtd.</th>
                  {fornecedoresNaTabela.map((f) => (
                    <th key={f.id} className="text-left py-3 px-4 font-medium text-[var(--text)]">
                      {f.nome} (R$)
                    </th>
                  ))}
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-3 px-4 font-medium text-[var(--text)]">{item.descricao}</td>
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={item.quantidade > 0 ? String(item.quantidade).replace('.', ',') : '1'}
                        onChange={(e) => atualizarQuantidade(item.id, e.target.value)}
                        title="Quantidade (multiplica o preço unitário no pedido)"
                        className="w-full max-w-[72px] rounded border border-[var(--border)] px-2 py-1.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                      />
                    </td>
                    {fornecedoresNaTabela.map((f) => (
                      <td key={f.id} className="py-2 px-4">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={getPrecoStr(item, f.id)}
                          onChange={(e) => atualizarPreco(item.id, f.id, e.target.value)}
                          placeholder="0,00"
                          className="w-full max-w-[100px] rounded border border-[var(--border)] px-2 py-1.5 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                        />
                      </td>
                    ))}
                    <td className="py-2 px-2">
                      <button
                        type="button"
                        onClick={() => removerItem(item.id)}
                        className="text-red-600 hover:underline text-sm"
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado && resultado.itens.length > 0 && (
        <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
          <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)] bg-emerald-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-emerald-800">Pedido pelo menor preço</h3>
              <p className="text-sm text-emerald-700 mt-0.5">
                Compre cada item no fornecedor indicado para obter o menor custo total.
              </p>
            </div>
            <button
              type="button"
              onClick={() => gerarPdfPedidosPorFornecedor(resultado)}
              className="rounded-lg bg-emerald-700 text-white px-4 py-2.5 text-sm font-medium hover:bg-emerald-800 transition-colors shrink-0 flex items-center justify-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Baixar PDF por fornecedor
            </button>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {resultado.itens.map((row, idx) => (
              <li
                key={`${row.descricao}-${row.fornecedorId}-${idx}`}
                className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4"
              >
                <span className="font-medium text-[var(--text)]">{row.descricao}</span>
                <span className="text-[var(--text-muted)] text-sm">
                  → {row.fornecedorNome}
                </span>
                <span className="text-[var(--text-muted)] text-sm">
                  {row.quantidade} × {formatarMoeda(row.precoUnitario)}
                </span>
                <span className="font-medium text-[var(--accent)] sm:ml-auto">
                  {formatarMoeda(row.preco)}
                </span>
              </li>
            ))}
          </ul>
          <div className="px-4 sm:px-5 py-4 border-t-2 border-[var(--border)] bg-[var(--surface)]">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-[var(--text)]">Total do pedido</span>
              <span className="text-xl font-bold text-[var(--accent)]">
                {formatarMoeda(resultado.total)}
              </span>
            </div>
          </div>
        </div>
      )}

      {resultado && resultado.itens.length === 0 && itens.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800 text-sm">
          Nenhum item com preço válido. Informe pelo menos um preço &gt; 0 em cada item.
        </div>
      )}
    </div>
  )
}
