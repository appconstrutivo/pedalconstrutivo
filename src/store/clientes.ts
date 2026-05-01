import type { Cliente, TipoPessoaCliente } from '../types'
import { deleteCliente as sbDeleteCliente, upsertClientes as sbUpsertClientes } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo-clientes'

export function loadClientes(): Cliente[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizarCliente).filter((c): c is Cliente => c !== null)
  } catch {
    return []
  }
}

function normalizarCliente(row: unknown): Cliente | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string' || typeof r.codigo !== 'string') return null
  const tp = r.tipoPessoa
  const tipoPessoa: TipoPessoaCliente = tp === 'pj' ? 'pj' : 'pf'

  return {
    id: r.id,
    codigo: r.codigo,
    tipoPessoa,
    situacaoFinanceiraOk: r.situacaoFinanceiraOk !== false,
    nome: typeof r.nome === 'string' ? r.nome : '',
    cpfCnpj: typeof r.cpfCnpj === 'string' ? r.cpfCnpj : '',
    rgInscricaoEstadual: typeof r.rgInscricaoEstadual === 'string' ? r.rgInscricaoEstadual : '',
    telefone: typeof r.telefone === 'string' ? r.telefone : '',
    celular: typeof r.celular === 'string' ? r.celular : '',
    cep: typeof r.cep === 'string' ? r.cep : '',
    endereco: typeof r.endereco === 'string' ? r.endereco : '',
    bairro: typeof r.bairro === 'string' ? r.bairro : '',
    municipio: typeof r.municipio === 'string' ? r.municipio : '',
    uf: typeof r.uf === 'string' ? r.uf : '',
    email: typeof r.email === 'string' ? r.email : '',
    aniversarioDia: typeof r.aniversarioDia === 'number' ? r.aniversarioDia : 0,
    aniversarioMes: typeof r.aniversarioMes === 'number' ? r.aniversarioMes : 0,
    aniversarioAno: typeof r.aniversarioAno === 'number' ? r.aniversarioAno : 0,
    informacoesAdicionais: typeof r.informacoesAdicionais === 'string' ? r.informacoesAdicionais : '',
    observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
    faixaSalarial: typeof r.faixaSalarial === 'string' ? r.faixaSalarial : '',
    descontoAutomaticoPct: typeof r.descontoAutomaticoPct === 'number' ? r.descontoAutomaticoPct : 0,
    valorMaximoCompras: typeof r.valorMaximoCompras === 'number' ? r.valorMaximoCompras : -1,
    criadoEm: typeof r.criadoEm === 'string' ? r.criadoEm : new Date().toISOString(),
    atualizadoEm: typeof r.atualizadoEm === 'string' ? r.atualizadoEm : new Date().toISOString(),
    saldoCompras: typeof r.saldoCompras === 'number' ? r.saldoCompras : 0,
    pontosAcumulados: typeof r.pontosAcumulados === 'number' ? r.pontosAcumulados : 0,
    recebeEmailPublicidade: r.recebeEmailPublicidade !== false,
    ativo: r.ativo !== false,
  }
}

export function saveClientes(lista: Cliente[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lista))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'clientes' } }))
}

export function nextCodigoCliente(): string {
  const lista = loadClientes()
  let max = 0
  for (const c of lista) {
    const n = parseInt(c.codigo, 10)
    if (Number.isFinite(n) && n > max) max = n
  }
  return String(max + 1).padStart(6, '0')
}

export function criarClienteVazio(): Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'> {
  return {
    codigo: '',
    tipoPessoa: 'pf',
    situacaoFinanceiraOk: true,
    nome: '',
    cpfCnpj: '',
    rgInscricaoEstadual: '',
    telefone: '',
    celular: '',
    cep: '',
    endereco: '',
    bairro: '',
    municipio: '',
    uf: '',
    email: '',
    aniversarioDia: 0,
    aniversarioMes: 0,
    aniversarioAno: 0,
    informacoesAdicionais: '',
    observacoes: '',
    faixaSalarial: '',
    descontoAutomaticoPct: 0,
    valorMaximoCompras: -1,
    saldoCompras: 0,
    pontosAcumulados: 0,
    recebeEmailPublicidade: true,
    ativo: true,
  }
}

export function addCliente(draft: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>): Cliente {
  const { codigo: _c, ...rest } = draft
  const lista = loadClientes()
  const agora = new Date().toISOString()
  const c: Cliente = {
    ...rest,
    id: crypto.randomUUID(),
    codigo: nextCodigoCliente(),
    criadoEm: agora,
    atualizadoEm: agora,
  }
  saveClientes([...lista, c])
  void sbUpsertClientes([c])
  return c
}

export function updateCliente(id: string, draft: Omit<Cliente, 'id' | 'criadoEm' | 'atualizadoEm'>): void {
  const lista = loadClientes()
  const idx = lista.findIndex((x) => x.id === id)
  if (idx < 0) return
  const antigo = lista[idx]
  const next = [...lista]
  next[idx] = {
    ...draft,
    id: antigo.id,
    codigo: antigo.codigo,
    criadoEm: antigo.criadoEm,
    atualizadoEm: new Date().toISOString(),
  }
  saveClientes(next)
  void sbUpsertClientes([next[idx]])
}

export function removeCliente(id: string): void {
  saveClientes(loadClientes().filter((c) => c.id !== id))
  void sbDeleteCliente(id)
}
