import { useEffect, useMemo, useState } from 'react'
import type { Fornecedor, Produto, TipoLancamentoProduto, TipoProduto } from '../types'
import { criarProdutoVazio, gerarCodigoBarrasPlaceholder } from '../store/produtos'
import { loadFornecedores } from '../store/fornecedores'
import { loadTiposProduto } from '../store/tiposProduto'
import { formatarBrl, percentualLucro } from '../utils/moeda'

const TIPO_OPTIONS: { value: TipoLancamentoProduto; label: string }[] = [
  { value: 'sem_controle_estoque', label: 'Não desejo controlar estoque deste produto' },
  { value: 'controle_estoque', label: 'Desejo controlar estoque deste produto' },
  { value: 'servico', label: 'Este é um serviço' },
]

type Props = {
  aberto: boolean
  modo: 'novo' | 'editar'
  produtoInicial: Produto | null
  onFechar: () => void
  onSalvar: (dados: Omit<Produto, 'id' | 'criadoEm'>) => void
}

function draftFromProduto(p: Produto): Omit<Produto, 'id' | 'criadoEm'> {
  const { id: _id, criadoEm: _c, ...rest } = p
  return {
    ...rest,
    imagemUrlPublica: rest.imagemUrlPublica ?? '',
    descricaoDetalhada: rest.descricaoDetalhada ?? '',
  }
}

type AbaProdutoForm = 'geral' | 'imagem_descricao'

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

function arredondarMoeda(n: number): number {
  return Math.round(n * 100) / 100
}

export function ProdutoFormModal({ aberto, modo, produtoInicial, onFechar, onSalvar }: Props) {
  const [draft, setDraft] = useState<Omit<Produto, 'id' | 'criadoEm'>>(() => criarProdutoVazio())
  const [tiposCadastrados, setTiposCadastrados] = useState<TipoProduto[]>([])
  const [fornecedoresCadastrados, setFornecedoresCadastrados] = useState<Fornecedor[]>([])
  const [sugestaoAberta, setSugestaoAberta] = useState(false)
  const [pctLucroVarejo, setPctLucroVarejo] = useState(0)
  const [pctLucroAtacado, setPctLucroAtacado] = useState(0)
  const [sugestaoErro, setSugestaoErro] = useState<string | null>(null)
  const [aba, setAba] = useState<AbaProdutoForm>('geral')
  const [previewErro, setPreviewErro] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setAba('geral')
    setPreviewErro(false)
    setTiposCadastrados(loadTiposProduto())
    setFornecedoresCadastrados(loadFornecedores().filter((f) => f.ativo !== false))
    if (modo === 'editar' && produtoInicial) {
      setDraft(draftFromProduto(produtoInicial))
    } else {
      setDraft(criarProdutoVazio())
    }
  }, [aberto, modo, produtoInicial])

  useEffect(() => {
    if (!aberto) setSugestaoAberta(false)
  }, [aberto])

  const lucroVarejo = useMemo(
    () => percentualLucro(draft.valorCusto, draft.valorVarejo),
    [draft.valorCusto, draft.valorVarejo],
  )
  const lucroAtacado = useMemo(
    () => percentualLucro(draft.valorCusto, draft.valorAtacado),
    [draft.valorCusto, draft.valorAtacado],
  )

  const urlPreviewOk = useMemo(
    () => urlImagemPublicaValida(draft.imagemUrlPublica),
    [draft.imagemUrlPublica],
  )

  if (!aberto) return null

  function salvar() {
    const d = draft.descricao.trim()
    if (!d) return
    onSalvar({ ...draft, descricao: d })
  }

  function abrirSugestaoPreco() {
    setPctLucroVarejo(arredondarMoeda(lucroVarejo))
    setPctLucroAtacado(arredondarMoeda(lucroAtacado))
    setSugestaoErro(null)
    setSugestaoAberta(true)
  }

  function aplicarSugestaoPreco() {
    const custo = draft.valorCusto
    if (!Number.isFinite(custo) || custo <= 0) {
      setSugestaoErro('Informe um valor de custo maior que zero para calcular a sugestão.')
      return
    }
    const pv = Number.isFinite(pctLucroVarejo) ? pctLucroVarejo : 0
    const pa = Number.isFinite(pctLucroAtacado) ? pctLucroAtacado : 0
    const v = custo * (1 + pv / 100)
    const a = custo * (1 + pa / 100)
    setDraft((d) => ({
      ...d,
      valorVarejo: arredondarMoeda(v),
      valorAtacado: arredondarMoeda(a),
    }))
    setSugestaoAberta(false)
    setSugestaoErro(null)
  }

  return (
    <>
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="produto-form-titulo"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-2xl w-full max-h-[min(92vh,920px)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="produto-form-titulo" className="text-lg font-bold text-[var(--text)]">
              {modo === 'novo' ? 'Produto — cadastro' : 'Produto — editar'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Informações básicas do cadastro</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div
          className="px-5 pt-2 pb-0 border-b border-[var(--border)] shrink-0 flex gap-1"
          role="tablist"
          aria-label="Seções do cadastro"
        >
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'geral'}
            id="tab-produto-geral"
            onClick={() => setAba('geral')}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              aba === 'geral'
                ? 'bg-[var(--surface)] text-[var(--text)] border border-b-0 border-[var(--border)] -mb-px'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Geral
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={aba === 'imagem_descricao'}
            id="tab-produto-imagem"
            onClick={() => setAba('imagem_descricao')}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              aba === 'imagem_descricao'
                ? 'bg-[var(--surface)] text-[var(--text)] border border-b-0 border-[var(--border)] -mb-px'
                : 'text-[var(--text-muted)] hover:text-[var(--text)]'
            }`}
          >
            Imagem e descrição
          </button>
        </div>

        <div
          className="overflow-y-auto px-5 py-4 space-y-6 flex-1 min-h-0"
          role="tabpanel"
          aria-labelledby={aba === 'geral' ? 'tab-produto-geral' : 'tab-produto-imagem'}
          hidden={aba !== 'geral'}
        >
          <div>
            <label htmlFor="tipo-lancamento" className="block text-sm font-medium text-[var(--text)] mb-1.5">
              Indique qual é o tipo de lançamento
            </label>
            <select
              id="tipo-lancamento"
              value={draft.tipoLancamento}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tipoLancamento: e.target.value as TipoLancamentoProduto }))
              }
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 p-4 space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1">
              Informações obrigatórias
            </legend>
            <div>
              <label htmlFor="descricao" className="block text-sm font-medium text-[var(--text)] mb-1">
                Descrição do produto
              </label>
              <input
                id="descricao"
                type="text"
                value={draft.descricao}
                onChange={(e) => setDraft((d) => ({ ...d, descricao: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                autoComplete="off"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="cod-interno" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Código interno (loja)
                </label>
                <input
                  id="cod-interno"
                  type="text"
                  readOnly
                  value={
                    draft.codigoInterno.trim()
                      ? draft.codigoInterno
                      : 'Gerado ao salvar (ex.: P-000001)'
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--text-muted)]"
                />
              </div>
              <div>
                <label htmlFor="cod-fornecedor" className="block text-sm font-medium text-[var(--text)] mb-1">
                  Código do fornecedor (SKU)
                </label>
                <input
                  id="cod-fornecedor"
                  type="text"
                  value={draft.codigoFornecedor}
                  onChange={(e) => setDraft((d) => ({ ...d, codigoFornecedor: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  placeholder="Opcional — para pedidos ao fornecedor"
                  autoComplete="off"
                />
              </div>
            </div>
            <div>
              <label htmlFor="fornecedor-prod" className="block text-sm font-medium text-[var(--text)] mb-1">
                Fornecedor do produto
              </label>
              <select
                id="fornecedor-prod"
                value={draft.fornecedorId}
                onChange={(e) => {
                  const id = e.target.value
                  const nome = fornecedoresCadastrados.find((f) => f.id === id)?.nome ?? ''
                  setDraft((d) => ({ ...d, fornecedorId: id, fornecedorNome: nome }))
                }}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {fornecedoresCadastrados.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                  </option>
                ))}
              </select>
              {fornecedoresCadastrados.length === 0 ? (
                <p className="mt-1.5 text-xs text-amber-800">
                  Cadastre fornecedores em <strong className="text-[var(--text)]">Cadastros → Fornecedores</strong>.
                </p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="vr-custo" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Valor de custo
                </label>
                <input
                  id="vr-custo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.valorCusto}
                  onChange={(e) => setDraft((d) => ({ ...d, valorCusto: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="vr-varejo" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Valor de varejo
                </label>
                <input
                  id="vr-varejo"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.valorVarejo}
                  onChange={(e) => setDraft((d) => ({ ...d, valorVarejo: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="vr-atacado" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Valor de atacado
                </label>
                <input
                  id="vr-atacado"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.valorAtacado}
                  onChange={(e) => setDraft((d) => ({ ...d, valorAtacado: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label htmlFor="tipo-produto" className="block text-sm font-medium text-[var(--text)] mb-1">
                Tipo ou categoria do produto
              </label>
              <select
                id="tipo-produto"
                value={draft.tipoProdutoId}
                onChange={(e) => setDraft((d) => ({ ...d, tipoProdutoId: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {tiposCadastrados.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
              {tiposCadastrados.length === 0 && (
                <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                  Cadastre tipos em <strong className="text-[var(--text)]">Cadastros → Cadastro de tipo dos produtos</strong>.
                </p>
              )}
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/40 p-4 space-y-4">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] px-1">
              Informações complementares
            </legend>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1">
                <label htmlFor="cod-barras" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Código ou código de barra
                </label>
                <input
                  id="cod-barras"
                  type="text"
                  value={draft.codigoBarras}
                  onChange={(e) => setDraft((d) => ({ ...d, codigoBarras: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, codigoBarras: gerarCodigoBarrasPlaceholder() }))}
                  className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
                >
                  Gerar um código de barras
                </button>
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium text-[var(--text)] mb-2">Aceita fracionar?</span>
              <div className="flex gap-4">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="fracionar"
                    checked={draft.aceitaFracionar}
                    onChange={() => setDraft((d) => ({ ...d, aceitaFracionar: true }))}
                  />
                  Sim
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="fracionar"
                    checked={!draft.aceitaFracionar}
                    onChange={() => setDraft((d) => ({ ...d, aceitaFracionar: false }))}
                  />
                  Não
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="unid" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Unid. medida
                </label>
                <input
                  id="unid"
                  type="text"
                  value={draft.unidadeMedida}
                  onChange={(e) => setDraft((d) => ({ ...d, unidadeMedida: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm uppercase"
                  maxLength={6}
                />
              </div>
              <div>
                <label htmlFor="pontos" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Pontuação
                </label>
                <input
                  id="pontos"
                  type="number"
                  min={0}
                  step={1}
                  value={draft.pontuacao}
                  onChange={(e) => setDraft((d) => ({ ...d, pontuacao: Number(e.target.value) }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div className="sm:col-span-1">
                <label htmlFor="info-ad" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Informações adicionais
                </label>
                <input
                  id="info-ad"
                  type="text"
                  value={draft.informacoesAdicionais}
                  onChange={(e) => setDraft((d) => ({ ...d, informacoesAdicionais: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={abrirSugestaoPreco}
                className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm font-medium text-[var(--accent)] hover:bg-teal-50"
              >
                Sugestão de preço?
              </button>
              <span className="text-xs text-[var(--text-muted)]">
                Lucro varejo:{' '}
                <strong className="text-[var(--text)] tabular-nums">{lucroVarejo.toFixed(2)}%</strong>
                {' · '}
                Lucro atacado:{' '}
                <strong className="text-[var(--text)] tabular-nums">{lucroAtacado.toFixed(2)}%</strong>
              </span>
            </div>

            <div className="rounded-lg border border-dashed border-[var(--border)] p-3 space-y-3">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">Opções do estoque</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="est-min" className="block text-xs font-medium text-[var(--text)] mb-1">
                    Quantidade mínima em estoque para aviso
                  </label>
                  <input
                    id="est-min"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.estoqueMinimo}
                    onChange={(e) => setDraft((d) => ({ ...d, estoqueMinimo: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="est-atual" className="block text-xs font-medium text-[var(--text)] mb-1">
                    Estoque atual da mercadoria
                  </label>
                  <input
                    id="est-atual"
                    type="number"
                    min={0}
                    step={1}
                    value={draft.estoqueAtual}
                    onChange={(e) => setDraft((d) => ({ ...d, estoqueAtual: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="obs" className="block text-xs font-medium text-[var(--text)] mb-1">
                Observações
              </label>
              <textarea
                id="obs"
                rows={2}
                value={draft.observacoes}
                onChange={(e) => setDraft((d) => ({ ...d, observacoes: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </fieldset>
        </div>

        <div
          className="overflow-y-auto px-5 py-4 space-y-5 flex-1 min-h-0"
          role="tabpanel"
          aria-labelledby="tab-produto-imagem"
          hidden={aba !== 'imagem_descricao'}
        >
          <p className="text-xs text-[var(--text-muted)]">
            Use um link público (https) da imagem — não há upload para o Storage do Supabase. Alguns sites bloqueiam
            exibir a foto fora do próprio domínio; nesse caso a prévia pode falhar mesmo com URL válida.
          </p>
          <div>
            <label htmlFor="imagem-url-publica" className="block text-sm font-medium text-[var(--text)] mb-1.5">
              URL pública da imagem
            </label>
            <input
              id="imagem-url-publica"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={draft.imagemUrlPublica}
              onChange={(e) => {
                setPreviewErro(false)
                setDraft((d) => ({ ...d, imagemUrlPublica: e.target.value }))
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
              autoComplete="off"
            />
            {draft.imagemUrlPublica.trim() && !urlPreviewOk ? (
              <p className="mt-1.5 text-xs text-amber-800">Informe uma URL completa começando com http:// ou https://</p>
            ) : null}
          </div>
          <div>
            <span className="block text-sm font-medium text-[var(--text)] mb-1.5">Pré-visualização</span>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/60 flex items-center justify-center min-h-[180px] p-4">
              {urlPreviewOk && !previewErro ? (
                <img
                  src={draft.imagemUrlPublica.trim()}
                  alt={`Ilustração de ${draft.descricao.trim() || 'produto'}`}
                  className="max-h-[240px] max-w-full object-contain rounded-lg"
                  onError={() => setPreviewErro(true)}
                  onLoad={() => setPreviewErro(false)}
                />
              ) : draft.imagemUrlPublica.trim() && urlPreviewOk && previewErro ? (
                <p className="text-sm text-[var(--text-muted)] text-center">
                  Não foi possível carregar a imagem (bloqueio do site ou arquivo indisponível).
                </p>
              ) : (
                <p className="text-sm text-[var(--text-muted)] text-center">
                  Cole uma URL válida para ver a imagem aqui.
                </p>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="descricao-detalhada" className="block text-sm font-medium text-[var(--text)] mb-1.5">
              Descrição do produto
            </label>
            <textarea
              id="descricao-detalhada"
              rows={6}
              value={draft.descricaoDetalhada}
              onChange={(e) => setDraft((d) => ({ ...d, descricaoDetalhada: e.target.value }))}
              placeholder="Detalhes técnicos, aplicabilidade, garantia, etc."
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm resize-y min-h-[120px]"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-3 shrink-0 bg-[var(--surface)]/50 rounded-b-2xl">
          <div className="flex items-center gap-4">
            <span className="text-sm text-[var(--text)]">Ativo?</span>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ativo"
                checked={draft.ativo}
                onChange={() => setDraft((d) => ({ ...d, ativo: true }))}
              />
              Sim
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="ativo"
                checked={!draft.ativo}
                onChange={() => setDraft((d) => ({ ...d, ativo: false }))}
              />
              Não
            </label>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={salvar}
              disabled={!draft.descricao.trim()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>

    {sugestaoAberta && (
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/55"
        role="presentation"
        onClick={() => setSugestaoAberta(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sugestao-preco-titulo"
          className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id="sugestao-preco-titulo" className="text-base font-bold text-[var(--text)]">
            Sugestão de preço
          </h3>
          <p className="text-sm text-[var(--text-muted)]">
            Informe o percentual de lucro desejado <strong className="text-[var(--text)]">sobre o custo</strong> para
            varejo e atacado. Os valores de venda serão recalculados ao confirmar.
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Valor de custo atual: <strong className="text-[var(--text)] tabular-nums">{formatarBrl(draft.valorCusto)}</strong>
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="pct-varejo" className="block text-xs font-medium text-[var(--text)] mb-1">
                Lucro sobre custo — varejo (%)
              </label>
              <input
                id="pct-varejo"
                type="number"
                step="0.01"
                value={pctLucroVarejo}
                onChange={(e) => setPctLucroVarejo(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="pct-atacado" className="block text-xs font-medium text-[var(--text)] mb-1">
                Lucro sobre custo — atacado (%)
              </label>
              <input
                id="pct-atacado"
                type="number"
                step="0.01"
                value={pctLucroAtacado}
                onChange={(e) => setPctLucroAtacado(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          {sugestaoErro && <p className="text-sm text-red-600">{sugestaoErro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setSugestaoAberta(false)}
              className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicarSugestaoPreco}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
            >
              Aplicar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
