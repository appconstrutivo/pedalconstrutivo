import { useState, useCallback } from 'react'
import type { Fornecedor } from '../types'
import {
  loadFornecedores,
  addFornecedor,
  updateFornecedor,
  removeFornecedor,
  criarFornecedorVazio,
} from '../store/fornecedores'

const initialFornecedores = loadFornecedores()

export function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>(initialFornecedores)
  const [nome, setNome] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  const handleAdd = useCallback(() => {
    const trimmed = nome.trim()
    if (!trimmed) return
    addFornecedor({ ...criarFornecedorVazio(), nome: trimmed })
    setFornecedores(loadFornecedores())
    setNome('')
  }, [nome])

  const startEdit = useCallback((f: Fornecedor) => {
    setEditId(f.id)
    setEditNome(f.nome)
  }, [])

  const saveEdit = useCallback(() => {
    if (editId == null || !editNome.trim()) return
    const f = fornecedores.find((x) => x.id === editId)
    if (!f) return
    const { id: _i, criadoEm: _c, atualizadoEm: _a, ...rest } = f
    updateFornecedor(editId, { ...rest, nome: editNome.trim() })
    setFornecedores(loadFornecedores())
    setEditId(null)
    setEditNome('')
  }, [editId, editNome, fornecedores])

  const cancelEdit = useCallback(() => {
    setEditId(null)
    setEditNome('')
  }, [])

  const handleRemove = useCallback(
    (id: string) => {
      if (window.confirm('Remover este fornecedor? Itens de cotações que usam ele não serão excluídos.')) {
        removeFornecedor(id)
        setFornecedores(loadFornecedores())
        if (editId === id) cancelEdit()
      }
    },
    [editId, cancelEdit],
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Cadastro de fornecedores</h2>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Cadastre os fornecedores que você usa nas cotações.
        </p>
      </div>

      <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] p-4 sm:p-5 shadow-sm">
        <label htmlFor="nome-fornecedor" className="block text-sm font-medium text-[var(--text)] mb-2">
          Novo fornecedor
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="nome-fornecedor"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="Nome do fornecedor"
            className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2.5 text-[var(--text)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent"
          />
          <button
            type="button"
            onClick={handleAdd}
            className="rounded-lg bg-[var(--accent)] text-white px-4 py-2.5 font-medium hover:bg-[var(--accent-hover)] transition-colors shrink-0"
          >
            Adicionar
          </button>
        </div>
      </div>

      <div className="bg-[var(--surface-card)] rounded-xl border border-[var(--border)] overflow-hidden shadow-sm">
        <div className="px-4 sm:px-5 py-3 border-b border-[var(--border)]">
          <h3 className="font-medium text-[var(--text)]">Fornecedores cadastrados</h3>
          {fornecedores.length === 0 && (
            <p className="text-sm text-[var(--text-muted)] mt-1">Nenhum fornecedor ainda.</p>
          )}
        </div>
        <ul className="divide-y divide-[var(--border)]">
          {fornecedores.map((f) => (
            <li key={f.id} className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
              {editId === f.id ? (
                <>
                  <input
                    type="text"
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveEdit()
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="flex-1 rounded-lg border border-[var(--border)] px-3 py-2 text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={saveEdit}
                      className="rounded-lg bg-[var(--accent)] text-white px-3 py-2 text-sm font-medium hover:bg-[var(--accent-hover)]"
                    >
                      Salvar
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="flex-1 font-medium text-[var(--text)]">{f.nome}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(f)}
                      className="text-sm text-[var(--accent)] hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(f.id)}
                      className="text-sm text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
