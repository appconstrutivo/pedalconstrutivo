import { useEffect, useState } from 'react'
import type { Fornecedor } from '../types'
import { criarFornecedorVazio } from '../store/fornecedores'
import { UFS_BR } from '../data/ufsBr'

type Props = {
  aberto: boolean
  modo: 'novo' | 'editar'
  fornecedorInicial: Fornecedor | null
  onFechar: () => void
  onSalvar: (dados: Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'>) => void
}

function draftFromFornecedor(f: Fornecedor): Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'> {
  const { id: _id, criadoEm: _c, atualizadoEm: _a, ...rest } = f
  return rest
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

const MAX_INFO = 255

export function FornecedorFormModal({ aberto, modo, fornecedorInicial, onFechar, onSalvar }: Props) {
  const [draft, setDraft] = useState<Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'>>(() =>
    criarFornecedorVazio(),
  )

  useEffect(() => {
    if (!aberto) return
    if (modo === 'editar' && fornecedorInicial) {
      setDraft(draftFromFornecedor(fornecedorInicial))
    } else {
      setDraft(criarFornecedorVazio())
    }
  }, [aberto, modo, fornecedorInicial])

  if (!aberto) return null

  function salvar() {
    if (!draft.nome.trim()) return
    const info = draft.informacoesAdicionais.slice(0, MAX_INFO)
    onSalvar({
      ...draft,
      nome: draft.nome.trim(),
      informacoesAdicionais: info,
    })
  }

  const datasRodape =
    modo === 'editar' && fornecedorInicial
      ? { criado: fmtData(fornecedorInicial.criadoEm), alt: fmtData(fornecedorInicial.atualizadoEm) }
      : { criado: '—', alt: '—' }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fornecedor-form-titulo"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[min(94vh,880px)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="fornecedor-form-titulo" className="text-lg font-bold text-[var(--text)]">
              {modo === 'novo' ? 'Fornecedor — cadastro' : 'Fornecedor — edição'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Dados do fornecedor</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1 min-h-0">
          <div>
            <label htmlFor="forn-nome" className="block text-sm font-medium text-[var(--text)] mb-1">
              Nome do fornecedor
            </label>
            <input
              id="forn-nome"
              type="text"
              value={draft.nome}
              onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="forn-doc" className="block text-xs font-medium text-[var(--text)] mb-1">
                CPF/CNPJ
              </label>
              <input
                id="forn-doc"
                type="text"
                value={draft.cpfCnpj}
                onChange={(e) => setDraft((d) => ({ ...d, cpfCnpj: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="forn-ie" className="block text-xs font-medium text-[var(--text)] mb-1">
                Identidade / Inscr. estadual
              </label>
              <input
                id="forn-ie"
                type="text"
                value={draft.rgInscricaoEstadual}
                onChange={(e) => setDraft((d) => ({ ...d, rgInscricaoEstadual: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="forn-tel" className="block text-xs font-medium text-[var(--text)] mb-1">
                Telefone
              </label>
              <input
                id="forn-tel"
                type="text"
                value={draft.telefone}
                onChange={(e) => setDraft((d) => ({ ...d, telefone: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="forn-fax" className="block text-xs font-medium text-[var(--text)] mb-1">
                Fax
              </label>
              <input
                id="forn-fax"
                type="text"
                value={draft.fax}
                onChange={(e) => setDraft((d) => ({ ...d, fax: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-4">
              <label htmlFor="forn-cep" className="block text-xs font-medium text-[var(--text)] mb-1">
                Código postal (CEP)
              </label>
              <input
                id="forn-cep"
                type="text"
                value={draft.cep}
                onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                placeholder="00000-000"
              />
            </div>
            <div className="sm:col-span-8">
              <label htmlFor="forn-end" className="block text-xs font-medium text-[var(--text)] mb-1">
                Endereço
              </label>
              <input
                id="forn-end"
                type="text"
                value={draft.endereco}
                onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="forn-bairro" className="block text-xs font-medium text-[var(--text)] mb-1">
                Bairro / distrito
              </label>
              <input
                id="forn-bairro"
                type="text"
                value={draft.bairro}
                onChange={(e) => setDraft((d) => ({ ...d, bairro: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="forn-mun" className="block text-xs font-medium text-[var(--text)] mb-1">
                Município
              </label>
              <input
                id="forn-mun"
                type="text"
                value={draft.municipio}
                onChange={(e) => setDraft((d) => ({ ...d, municipio: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="forn-uf" className="block text-xs font-medium text-[var(--text)] mb-1">
                UF
              </label>
              <select
                id="forn-uf"
                value={draft.uf}
                onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {UFS_BR.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="forn-contato" className="block text-xs font-medium text-[var(--text)] mb-1">
                Contato
              </label>
              <input
                id="forn-contato"
                type="text"
                value={draft.contato}
                onChange={(e) => setDraft((d) => ({ ...d, contato: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="forn-email" className="block text-xs font-medium text-[var(--text)] mb-1">
                E-mail
              </label>
              <input
                id="forn-email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label htmlFor="forn-info" className="block text-xs font-medium text-[var(--text)] mb-1">
              Informações adicionais (máx. {MAX_INFO} caracteres)
            </label>
            <textarea
              id="forn-info"
              rows={4}
              maxLength={MAX_INFO}
              value={draft.informacoesAdicionais}
              onChange={(e) => setDraft((d) => ({ ...d, informacoesAdicionais: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm resize-y min-h-[88px]"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
              {draft.informacoesAdicionais.length}/{MAX_INFO}
            </p>
          </div>

          <fieldset>
            <legend className="text-xs font-medium text-[var(--text-muted)] mb-2">Ativo?</legend>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="forn-ativo"
                  checked={draft.ativo}
                  onChange={() => setDraft((d) => ({ ...d, ativo: true }))}
                />
                Sim
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="forn-ativo"
                  checked={!draft.ativo}
                  onChange={() => setDraft((d) => ({ ...d, ativo: false }))}
                />
                Não
              </label>
            </div>
          </fieldset>

          {modo === 'editar' && (
            <p className="text-[10px] text-[var(--text-muted)]">
              Criado em {datasRodape.criado} · Última alteração {datasRodape.alt}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-[var(--border)] flex flex-wrap justify-end gap-2 shrink-0 bg-[var(--surface)]/50">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            disabled={!draft.nome.trim()}
            className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}
