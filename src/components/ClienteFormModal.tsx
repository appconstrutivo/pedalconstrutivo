import { useEffect, useState } from 'react'
import type { Cliente, TipoPessoaCliente } from '../types'
import { criarClienteVazio } from '../store/clientes'
import { UFS_BR } from '../data/ufsBr'
import { formatarBrl } from '../utils/moeda'

type Props = {
  aberto: boolean
  modo: 'novo' | 'editar'
  clienteInicial: Cliente | null
  onFechar: () => void
  onSalvar: (dados: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>) => void
}

function draftFromCliente(c: Cliente): Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'> {
  const { id: _id, criadoEm: _c, atualizadoEm: _a, ...rest } = c
  return rest
}

function fmtData(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('pt-BR')
  } catch {
    return '—'
  }
}

export function ClienteFormModal({ aberto, modo, clienteInicial, onFechar, onSalvar }: Props) {
  const [draft, setDraft] = useState<Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>>(() => criarClienteVazio())

  useEffect(() => {
    if (!aberto) return
    if (modo === 'editar' && clienteInicial) {
      setDraft(draftFromCliente(clienteInicial))
    } else {
      setDraft(criarClienteVazio())
    }
  }, [aberto, modo, clienteInicial])

  if (!aberto) return null

  function salvar() {
    if (!draft.nome.trim()) return
    onSalvar({ ...draft, nome: draft.nome.trim() })
  }

  const datasRodape =
    modo === 'editar' && clienteInicial
      ? { criado: fmtData(clienteInicial.criadoEm), alt: fmtData(clienteInicial.atualizadoEm) }
      : { criado: '—', alt: '—' }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cliente-form-titulo"
    >
      <div className="bg-[var(--surface-card)] border border-[var(--border)] rounded-2xl shadow-2xl max-w-4xl w-full max-h-[min(94vh,900px)] flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="cliente-form-titulo" className="text-lg font-bold text-[var(--text)]">
              {modo === 'novo' ? 'Cliente — cadastro' : 'Cliente — edição'}
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Informações básicas de cadastro</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 flex-1 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label htmlFor="cod-auto" className="block text-xs font-medium text-[var(--text)] mb-1">
                Código (automático)
              </label>
              <input
                id="cod-auto"
                readOnly
                value={draft.codigo || '— gerado ao salvar —'}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-muted)]"
              />
            </div>
            <div className="sm:col-span-9">
              <label htmlFor="nome-cliente" className="block text-sm font-medium text-[var(--text)] mb-1">
                Nome do cliente
              </label>
              <input
                id="nome-cliente"
                type="text"
                value={draft.nome}
                onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label htmlFor="cpf" className="block text-xs font-medium text-[var(--text)] mb-1">
                CPF / CNPJ
              </label>
              <input
                id="cpf"
                type="text"
                value={draft.cpfCnpj}
                onChange={(e) => setDraft((d) => ({ ...d, cpfCnpj: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-1 flex justify-center pb-1">
              <button
                type="button"
                title="Validação automática em breve"
                disabled
                className="rounded-lg border border-[var(--border)] bg-slate-50 p-2 text-[var(--text-muted)] cursor-not-allowed"
              >
                ✓
              </button>
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="rg" className="block text-xs font-medium text-[var(--text)] mb-1">
                Identidade / Inscr. estadual
              </label>
              <input
                id="rg"
                type="text"
                value={draft.rgInscricaoEstadual}
                onChange={(e) => setDraft((d) => ({ ...d, rgInscricaoEstadual: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="tel" className="block text-xs font-medium text-[var(--text)] mb-1">
                Telefone
              </label>
              <input
                id="tel"
                type="text"
                value={draft.telefone}
                onChange={(e) => setDraft((d) => ({ ...d, telefone: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-3">
              <label htmlFor="cel" className="block text-xs font-medium text-[var(--text)] mb-1">
                Celular
              </label>
              <input
                id="cel"
                type="text"
                value={draft.celular}
                onChange={(e) => setDraft((d) => ({ ...d, celular: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-2">
              <label htmlFor="cep" className="block text-xs font-medium text-[var(--text)] mb-1">
                Código postal (CEP)
              </label>
              <input
                id="cep"
                type="text"
                value={draft.cep}
                onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-amber-50/80 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-1 flex justify-center pb-1">
              <button
                type="button"
                title="Consulta CEP em breve"
                disabled
                className="rounded-lg border border-[var(--border)] bg-slate-50 p-2 text-[var(--text-muted)] cursor-not-allowed"
              >
                🌐
              </button>
            </div>
            <div className="sm:col-span-5">
              <label htmlFor="end" className="block text-xs font-medium text-[var(--text)] mb-1">
                Endereço
              </label>
              <input
                id="end"
                type="text"
                value={draft.endereco}
                onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="bairro" className="block text-xs font-medium text-[var(--text)] mb-1">
                Bairro / distrito
              </label>
              <input
                id="bairro"
                type="text"
                value={draft.bairro}
                onChange={(e) => setDraft((d) => ({ ...d, bairro: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-8">
              <label htmlFor="mun" className="block text-xs font-medium text-[var(--text)] mb-1">
                Município
              </label>
              <input
                id="mun"
                type="text"
                value={draft.municipio}
                onChange={(e) => setDraft((d) => ({ ...d, municipio: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <label htmlFor="uf" className="block text-xs font-medium text-[var(--text)] mb-1">
                UF
              </label>
              <select
                id="uf"
                value={draft.uf}
                onChange={(e) => setDraft((d) => ({ ...d, uf: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
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

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-6">
              <label htmlFor="email" className="block text-xs font-medium text-[var(--text)] mb-1">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={draft.email}
                onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-6">
              <span className="block text-xs font-medium text-[var(--text)] mb-1">Data do aniversário</span>
              <div className="flex gap-2 items-center">
                <input
                  type="number"
                  min={0}
                  max={31}
                  placeholder="Dia"
                  value={draft.aniversarioDia || ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, aniversarioDia: Number(e.target.value) || 0 }))
                  }
                  className="w-16 rounded-xl border border-[var(--border)] bg-white px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  max={12}
                  placeholder="Mês"
                  value={draft.aniversarioMes || ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, aniversarioMes: Number(e.target.value) || 0 }))
                  }
                  className="w-16 rounded-xl border border-[var(--border)] bg-white px-2 py-2 text-sm"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Ano"
                  value={draft.aniversarioAno || ''}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, aniversarioAno: Number(e.target.value) || 0 }))
                  }
                  className="w-24 rounded-xl border border-[var(--border)] bg-white px-2 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="info-ad" className="block text-xs font-medium text-[var(--text)] mb-1">
              Informações adicionais (até 255 caracteres)
            </label>
            <textarea
              id="info-ad"
              rows={3}
              maxLength={255}
              value={draft.informacoesAdicionais}
              onChange={(e) => setDraft((d) => ({ ...d, informacoesAdicionais: e.target.value }))}
              className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
            />
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

          <fieldset className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/50 p-4 space-y-3">
            <legend className="text-xs font-semibold text-[var(--text-muted)] px-1">Tipo e financeiro</legend>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="block text-xs font-medium text-[var(--text)] mb-1">Tipo de pessoa</span>
                <div className="flex gap-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipo-pessoa"
                      checked={draft.tipoPessoa === 'pf'}
                      onChange={() => setDraft((d) => ({ ...d, tipoPessoa: 'pf' as TipoPessoaCliente }))}
                    />
                    PF
                  </label>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      name="tipo-pessoa"
                      checked={draft.tipoPessoa === 'pj'}
                      onChange={() => setDraft((d) => ({ ...d, tipoPessoa: 'pj' as TipoPessoaCliente }))}
                    />
                    PJ
                  </label>
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-sm sm:col-span-2 pt-5 sm:pt-6">
                <input
                  type="checkbox"
                  checked={draft.situacaoFinanceiraOk}
                  onChange={(e) => setDraft((d) => ({ ...d, situacaoFinanceiraOk: e.target.checked }))}
                />
                Situação financeira em dia (coluna $ na lista)
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label htmlFor="faixa" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Faixa salarial
                </label>
                <input
                  id="faixa"
                  type="text"
                  value={draft.faixaSalarial}
                  onChange={(e) => setDraft((d) => ({ ...d, faixaSalarial: e.target.value }))}
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="desc-pct" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Desconto automático (%)
                </label>
                <input
                  id="desc-pct"
                  type="number"
                  step="0.01"
                  value={draft.descontoAutomaticoPct}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, descontoAutomaticoPct: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="vl-max" className="block text-xs font-medium text-[var(--text)] mb-1">
                  Valor máximo para compras (R$)
                </label>
                <input
                  id="vl-max"
                  type="number"
                  step="0.01"
                  value={draft.valorMaximoCompras}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, valorMaximoCompras: Number(e.target.value) }))
                  }
                  className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm"
                />
                <p className="text-[11px] text-red-600 mt-1">−1 desativa o valor máximo</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p>
                <span className="text-[var(--text-muted)]">Data do cadastro:</span>{' '}
                <span className="font-medium tabular-nums">{datasRodape.criado}</span>
              </p>
              <p>
                <span className="text-[var(--text-muted)]">Última alteração:</span>{' '}
                <span className="font-medium tabular-nums">{datasRodape.alt}</span>
              </p>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Saldo para compras</label>
              <div className="rounded-xl border border-[var(--border)] bg-sky-50 px-3 py-2 text-sm font-medium tabular-nums">
                {formatarBrl(draft.saldoCompras)}
              </div>
            </div>
            <div>
              <label className="block text-xs text-[var(--text-muted)] mb-1">Pontos acumulados</label>
              <div className="rounded-xl border border-[var(--border)] bg-white px-3 py-2 text-sm tabular-nums">
                {draft.pontosAcumulados}
              </div>
            </div>
            <button
              type="button"
              disabled
              title="Em breve"
              className="rounded-xl border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--text-muted)] cursor-not-allowed"
            >
              Imprimir ficha
            </button>
            <div>
              <span className="block text-xs font-medium text-[var(--text)] mb-1">Recebe e-mail com publicidade?</span>
              <div className="flex gap-3">
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pub"
                    checked={draft.recebeEmailPublicidade}
                    onChange={() => setDraft((d) => ({ ...d, recebeEmailPublicidade: true }))}
                  />
                  Sim
                </label>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="pub"
                    checked={!draft.recebeEmailPublicidade}
                    onChange={() => setDraft((d) => ({ ...d, recebeEmailPublicidade: false }))}
                  />
                  Não
                </label>
              </div>
            </div>
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
              disabled={!draft.nome.trim()}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
