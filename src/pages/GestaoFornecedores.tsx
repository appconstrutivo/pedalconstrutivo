import { useCallback, useMemo, useState } from 'react'
import { FornecedorFormModal } from '../components/FornecedorFormModal'
import type { Fornecedor } from '../types'
import {
  addFornecedor,
  loadFornecedores,
  removeFornecedor,
  updateFornecedor,
} from '../store/fornecedores'

type Props = {
  onVoltar: () => void
}

type ModoBuscaFornecedor = 'nome' | 'cpfCnpj' | 'cidade' | 'contato' | 'telefone' | 'email'

const ROTULO_BUSCA: Record<ModoBuscaFornecedor, string> = {
  nome: 'Nome',
  cpfCnpj: 'CNPJ/CPF',
  cidade: 'Cidade',
  contato: 'Contato',
  telefone: 'Telefone',
  email: 'E-mail',
}

const MODOS_BUSCA: ModoBuscaFornecedor[] = ['nome', 'cpfCnpj', 'cidade', 'contato', 'telefone', 'email']

function matchFornecedor(f: Fornecedor, modo: ModoBuscaFornecedor, t: string): boolean {
  const n = t.toLowerCase()
  const digits = (s: string) => s.replace(/\D/g, '')
  switch (modo) {
    case 'nome':
      return f.nome.toLowerCase().includes(n)
    case 'cpfCnpj':
      return (
        f.cpfCnpj.toLowerCase().includes(n) ||
        (t.length > 0 && digits(f.cpfCnpj).includes(digits(t)))
      )
    case 'cidade':
      return f.municipio.toLowerCase().includes(n)
    case 'contato':
      return f.contato.toLowerCase().includes(n)
    case 'telefone':
      return f.telefone.toLowerCase().includes(n) || digits(f.telefone).includes(digits(t))
    case 'email':
      return f.email.toLowerCase().includes(n)
    default:
      return true
  }
}

export function GestaoFornecedores({ onVoltar }: Props) {
  const [lista, setLista] = useState<Fornecedor[]>(() => loadFornecedores())
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [termo, setTermo] = useState('')
  const [modoBusca, setModoBusca] = useState<ModoBuscaFornecedor>('nome')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalModo, setModalModo] = useState<'novo' | 'editar'>('novo')

  const refresh = useCallback(() => setLista(loadFornecedores()), [])

  const selecionado = useMemo(
    () => (selecionadoId ? lista.find((x) => x.id === selecionadoId) ?? null : null),
    [lista, selecionadoId],
  )

  const filtrados = useMemo(() => {
    const t = termo.trim()
    return lista.filter((f) => {
      if (!t) return true
      return matchFornecedor(f, modoBusca, t)
    })
  }, [lista, termo, modoBusca])

  function abrirNovo() {
    setModalModo('novo')
    setModalAberto(true)
  }

  function abrirEditar() {
    if (!selecionado) return
    setModalModo('editar')
    setModalAberto(true)
  }

  function apagarSelecionado() {
    if (!selecionadoId) return
    if (!window.confirm('Remover este fornecedor? Cotações existentes não são apagadas.')) return
    removeFornecedor(selecionadoId)
    setSelecionadoId(null)
    refresh()
  }

  function aoSalvarModal(dados: Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'>) {
    if (modalModo === 'novo') {
      addFornecedor(dados)
    } else if (selecionado) {
      updateFornecedor(selecionado.id, dados)
    }
    setModalAberto(false)
    refresh()
  }

  const subtituloBusca = ROTULO_BUSCA[modoBusca]

  return (
    <div className="min-h-screen flex flex-col bg-[var(--surface)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface-card)] sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)]">Cadastros</p>
            <h1 className="text-xl font-bold text-[var(--text)]">Fornecedores</h1>
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

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="px-2 py-2 w-10 text-center">T</th>
                  <th className="px-3 py-2 min-w-[160px]">Nome</th>
                  <th className="px-3 py-2">CNPJ/CPF</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2">Contato</th>
                  <th className="px-3 py-2">Cidade</th>
                  <th className="px-2 py-2 w-12">UF</th>
                  <th className="px-3 py-2 min-w-[180px]">E-mail</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Nenhum fornecedor nesta lista. Use Novo para cadastrar.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((f) => {
                    const sel = f.id === selecionadoId
                    return (
                      <tr
                        key={f.id}
                        onClick={() => setSelecionadoId(f.id)}
                        className={`border-b border-[var(--border)] cursor-pointer ${
                          sel ? 'bg-teal-50/80' : 'hover:bg-[var(--surface)]'
                        }`}
                      >
                        <td className="px-2 py-2 text-center text-xs">
                          {f.ativo ? (
                            <span className="text-emerald-600 font-semibold" title="Ativo">
                              ✓
                            </span>
                          ) : (
                            <span className="text-slate-400" title="Inativo">
                              —
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">{f.nome}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)] tabular-nums">{f.cpfCnpj || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{f.telefone || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{f.contato || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{f.municipio || '—'}</td>
                        <td className="px-2 py-2 text-[var(--text-muted)]">{f.uf || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[220px]">{f.email || '—'}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] p-4 space-y-4 shadow-sm">
          <div>
            <label htmlFor="busca-forn" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Pesquisa cadastro já existente por [ {subtituloBusca} ]
            </label>
            <input
              id="busca-forn"
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              placeholder="Digite para filtrar…"
            />
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">Modos de pesquisa disponíveis</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
              {MODOS_BUSCA.map((m) => (
                <label key={m} className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="modo-busca-forn"
                    checked={modoBusca === m}
                    onChange={() => setModoBusca(m)}
                  />
                  {ROTULO_BUSCA[m]}
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
            onClick={apagarSelecionado}
            disabled={!selecionado}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Apagar
          </button>
          <button
            type="button"
            onClick={abrirEditar}
            disabled={!selecionado}
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
        </div>

        <div className="flex flex-wrap gap-2">
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
          <button
            type="button"
            disabled
            title="Em breve"
            className="rounded-xl border border-[var(--border)] bg-slate-50 px-4 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed"
          >
            Pedido de compra de mercadoria
          </button>
        </div>
      </main>

      <FornecedorFormModal
        aberto={modalAberto}
        modo={modalModo}
        fornecedorInicial={modalModo === 'editar' ? selecionado : null}
        onFechar={() => setModalAberto(false)}
        onSalvar={aoSalvarModal}
      />
    </div>
  )
}
