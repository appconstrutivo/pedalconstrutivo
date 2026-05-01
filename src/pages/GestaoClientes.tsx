import { useCallback, useMemo, useState } from 'react'
import type { Cliente } from '../types'
import { ClienteFormModal } from '../components/ClienteFormModal'
import { addCliente, loadClientes, removeCliente, updateCliente } from '../store/clientes'

type Props = {
  onVoltar: () => void
}

type ModoBuscaCliente =
  | 'nome'
  | 'cpfCnpj'
  | 'telefone'
  | 'informacoes'
  | 'codigo'
  | 'email'
  | 'mesAniversario'
  | 'observacoes'
  | 'cidade'
  | 'uf'
  | 'bairro'
  | 'cep'

const ROTULO_BUSCA: Record<ModoBuscaCliente, string> = {
  nome: 'Nome',
  cpfCnpj: 'CPF/CNPJ',
  telefone: 'Telefone',
  informacoes: 'Informações',
  codigo: 'Código',
  email: 'E-mail',
  mesAniversario: 'Mês aniver.',
  observacoes: 'Observações',
  cidade: 'Cidade',
  uf: 'UF',
  bairro: 'Bairro',
  cep: 'CEP',
}

const MODOS_BUSCA: ModoBuscaCliente[] = [
  'nome',
  'cpfCnpj',
  'telefone',
  'informacoes',
  'codigo',
  'email',
  'mesAniversario',
  'observacoes',
  'cidade',
  'uf',
  'bairro',
  'cep',
]

function matchCliente(c: Cliente, modo: ModoBuscaCliente, t: string): boolean {
  const n = t.toLowerCase()
  const digits = (s: string) => s.replace(/\D/g, '')
  switch (modo) {
    case 'nome':
      return c.nome.toLowerCase().includes(n)
    case 'cpfCnpj':
      return (
        c.cpfCnpj.toLowerCase().includes(n) ||
        (t.length > 0 && digits(c.cpfCnpj).includes(digits(t)))
      )
    case 'telefone':
      return (
        c.telefone.toLowerCase().includes(n) ||
        c.celular.toLowerCase().includes(n) ||
        digits(c.telefone + c.celular).includes(digits(t))
      )
    case 'informacoes':
      return c.informacoesAdicionais.toLowerCase().includes(n)
    case 'codigo':
      return c.codigo.toLowerCase().includes(n)
    case 'email':
      return c.email.toLowerCase().includes(n)
    case 'mesAniversario':
      if (!t) return true
      const m = parseInt(t, 10)
      return Number.isFinite(m) ? c.aniversarioMes === m : String(c.aniversarioMes).includes(t)
    case 'observacoes':
      return c.observacoes.toLowerCase().includes(n)
    case 'cidade':
      return c.municipio.toLowerCase().includes(n)
    case 'uf':
      return c.uf.toLowerCase() === n || c.uf.toLowerCase().includes(n)
    case 'bairro':
      return c.bairro.toLowerCase().includes(n)
    case 'cep':
      return c.cep.replace(/\D/g, '').includes(digits(t)) || c.cep.toLowerCase().includes(n)
    default:
      return true
  }
}

export function GestaoClientes({ onVoltar }: Props) {
  const [lista, setLista] = useState<Cliente[]>(() => loadClientes())
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)
  const [termo, setTermo] = useState('')
  const [modoBusca, setModoBusca] = useState<ModoBuscaCliente>('nome')
  const [modalAberto, setModalAberto] = useState(false)
  const [modalModo, setModalModo] = useState<'novo' | 'editar'>('novo')

  const refresh = useCallback(() => setLista(loadClientes()), [])

  const selecionado = useMemo(
    () => (selecionadoId ? lista.find((c) => c.id === selecionadoId) ?? null : null),
    [lista, selecionadoId],
  )

  const filtrados = useMemo(() => {
    const t = termo.trim()
    return lista.filter((c) => {
      if (!t) return true
      return matchCliente(c, modoBusca, t)
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
    removeCliente(selecionadoId)
    setSelecionadoId(null)
    refresh()
  }

  function aoSalvarModal(dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>) {
    if (modalModo === 'novo') {
      addCliente(dados)
    } else if (selecionado) {
      updateCliente(selecionado.id, dados)
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
            <h1 className="text-xl font-bold text-[var(--text)]">Clientes</h1>
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
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-[var(--surface)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="px-2 py-2 w-10 text-center">T</th>
                  <th className="px-2 py-2 w-10 text-center">$</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2 min-w-[180px]">Nome</th>
                  <th className="px-3 py-2">Telefone</th>
                  <th className="px-3 py-2 min-w-[160px]">E-mail</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-[var(--text-muted)]">
                      Nenhum cliente nesta lista. Use Novo para cadastrar.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((c) => {
                    const sel = c.id === selecionadoId
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setSelecionadoId(c.id)}
                        className={`border-b border-[var(--border)] cursor-pointer ${
                          sel ? 'bg-teal-50/80' : 'hover:bg-[var(--surface)]'
                        }`}
                      >
                        <td className="px-2 py-2 text-center text-xs font-semibold text-[var(--text-muted)]">
                          {c.tipoPessoa === 'pj' ? 'PJ' : 'PF'}
                        </td>
                        <td className="px-2 py-2 text-center text-xs">
                          {c.situacaoFinanceiraOk ? (
                            <span className="text-emerald-600" title="Em dia">
                              ✓
                            </span>
                          ) : (
                            <span className="text-amber-600" title="Atenção">
                              !
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{c.codigo}</td>
                        <td className="px-3 py-2 font-medium text-[var(--text)]">{c.nome}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)]">{c.telefone || c.celular || '—'}</td>
                        <td className="px-3 py-2 text-[var(--text-muted)] truncate max-w-[220px]">{c.email || '—'}</td>
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
            <label htmlFor="busca-cli" className="block text-xs font-medium text-[var(--text-muted)] mb-1">
              Pesquisa cadastro já existente por [ {subtituloBusca} ]
            </label>
            <input
              id="busca-cli"
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
                    name="modo-busca-cli"
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
            Histórico de compras do cliente
          </button>
        </div>
      </main>

      <ClienteFormModal
        aberto={modalAberto}
        modo={modalModo}
        clienteInicial={modalModo === 'editar' ? selecionado : null}
        onFechar={() => setModalAberto(false)}
        onSalvar={aoSalvarModal}
      />
    </div>
  )
}
