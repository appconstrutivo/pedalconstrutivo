import { useCallback, useMemo, useState } from 'react'
import type { TipoProduto } from '../types'
import {
  addTipoProduto,
  loadTiposProduto,
  removeTipoProduto,
  updateTipoProduto,
} from '../store/tiposProduto'
import { contarProdutosPorTipo, reatribuirTipoEmProdutos } from '../store/produtos'

type Props = {
  onVoltar: () => void
}

export function GestaoTiposProduto({ onVoltar }: Props) {
  const [lista, setLista] = useState<TipoProduto[]>(() => loadTiposProduto())
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const [dialogo, setDialogo] = useState<
    null | { tipo: 'simples'; alvo: TipoProduto } | { tipo: 'migrar'; alvo: TipoProduto; qtd: number }
  >(null)
  const [substitutoId, setSubstitutoId] = useState('')

  const refresh = useCallback(() => setLista(loadTiposProduto()), [])

  const selecionado = useMemo(
    () => (selecionadoId ? lista.find((t) => t.id === selecionadoId) ?? null : null),
    [lista, selecionadoId],
  )

  function novo() {
    setSelecionadoId(null)
    setNome('')
    setErro(null)
  }

  function selecionar(t: TipoProduto) {
    setSelecionadoId(t.id)
    setNome(t.nome)
    setErro(null)
  }

  function salvar() {
    setErro(null)
    const n = nome.trim()
    if (!n) {
      setErro('Informe o nome do tipo ou categoria.')
      return
    }
    if (selecionadoId) {
      const ok = updateTipoProduto(selecionadoId, n)
      if (!ok) {
        setErro('Não foi possível salvar. Verifique se já existe outro tipo com o mesmo nome.')
        return
      }
    } else {
      const criado = addTipoProduto(n)
      if (!criado) {
        setErro('Já existe um tipo com esse nome.')
        return
      }
      setSelecionadoId(criado.id)
    }
    refresh()
  }

  function iniciarApagar() {
    if (!selecionado) return
    setErro(null)
    const qtd = contarProdutosPorTipo(selecionado.id)
    const outros = lista.filter((t) => t.id !== selecionado.id)
    if (qtd > 0 && outros.length === 0) {
      setErro(
        'Existem produtos usando este tipo. Cadastre outro tipo/categoria antes de excluir, para poder reatribuir os produtos.',
      )
      return
    }
    if (qtd === 0) {
      setDialogo({ tipo: 'simples', alvo: selecionado })
      return
    }
    setSubstitutoId(outros[0]?.id ?? '')
    setDialogo({ tipo: 'migrar', alvo: selecionado, qtd })
  }

  function confirmarExclusaoSimples() {
    if (!dialogo || dialogo.tipo !== 'simples') return
    removeTipoProduto(dialogo.alvo.id)
    setDialogo(null)
    novo()
    refresh()
  }

  function confirmarExclusaoComMigracao() {
    if (!dialogo || dialogo.tipo !== 'migrar') return
    const dest = substitutoId.trim()
    if (!dest || dest === dialogo.alvo.id) {
      setErro('Selecione outro tipo para direcionar os produtos e lançamentos.')
      return
    }
    reatribuirTipoEmProdutos(dialogo.alvo.id, dest)
    removeTipoProduto(dialogo.alvo.id)
    setDialogo(null)
    novo()
    refresh()
  }

  const opcoesSubstituto = lista.filter((t) => dialogo?.tipo === 'migrar' && t.id !== dialogo.alvo.id)

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Cadastros</p>
            <h1 className="text-xl font-bold text-[var(--text)]">Tipo ou categoria do produto</h1>
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

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <label htmlFor="nome-tipo" className="block text-sm font-medium text-[var(--text)] mb-2">
            Nome do tipo ou categoria
          </label>
          <input
            id="nome-tipo"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm"
            placeholder="Ex.: Pneumáticos, Ferragens…"
            autoComplete="off"
          />
          {erro && <p className="mt-2 text-sm text-red-600">{erro}</p>}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] min-h-[200px] max-h-[min(50vh,360px)] overflow-y-auto shadow-sm">
          {lista.length === 0 ? (
            <p className="p-6 text-sm text-[var(--text-muted)] text-center">
              Nenhum tipo cadastrado. Informe um nome e clique em Salvar.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {lista.map((t) => {
                const ativo = t.id === selecionadoId
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => selecionar(t)}
                      className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                        ativo ? 'bg-teal-50 text-[var(--accent)] font-medium' : 'hover:bg-[var(--surface)] text-[var(--text)]'
                      }`}
                    >
                      {t.nome}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={novo}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--surface)]"
          >
            Novo
          </button>
          <button
            type="button"
            onClick={iniciarApagar}
            disabled={!selecionado}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apagar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Salvar
          </button>
        </div>
      </main>

      {dialogo?.tipo === 'simples' && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/45"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dlg-simples-titulo"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h2 id="dlg-simples-titulo" className="text-lg font-bold text-[var(--text)]">
              Exclusão de cadastro
            </h2>
            <p className="text-sm text-[var(--text-muted)]">
              Tem certeza que deseja excluir o tipo <strong className="text-[var(--text)]">{dialogo.alvo.nome}</strong>?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialogo(null)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmarExclusaoSimples}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {dialogo?.tipo === 'migrar' && (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/45"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="dlg-mig-titulo"
        >
          <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 id="dlg-mig-titulo" className="text-lg font-bold text-[var(--text)]">
              Exclusão de cadastro
            </h2>
            <p className="text-sm font-semibold text-[var(--text)]">Leia com atenção</p>
            <p className="text-sm text-[var(--text-muted)]">
              Ao excluir este tipo, será necessário indicar <strong className="text-[var(--text)]">outro tipo ou categoria</strong>{' '}
              para direcionar os produtos e manter consistência nos lançamentos e relatórios.
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              Existem <strong className="text-[var(--text)]">{dialogo.qtd}</strong> produto(s) usando «
              {dialogo.alvo.nome}».
            </p>
            <div>
              <label htmlFor="substituto" className="block text-xs font-medium text-[var(--text)] mb-1">
                Direcionar produtos para
              </label>
              <select
                id="substituto"
                value={substitutoId}
                onChange={(e) => setSubstitutoId(e.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Selecione…</option>
                {opcoesSubstituto.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-sm text-[var(--text-muted)]">Confirma a exclusão e a reatribuição?</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDialogo(null)}
                className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
              >
                Não
              </button>
              <button
                type="button"
                onClick={confirmarExclusaoComMigracao}
                className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
