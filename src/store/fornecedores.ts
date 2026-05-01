import type { Fornecedor } from '../types'
import { deleteFornecedor as sbDeleteFornecedor, upsertFornecedores as sbUpsertFornecedores } from '../supabase/pcApi'

const STORAGE_KEY = 'pedal-construtivo-fornecedores'

function normalizarFornecedor(row: unknown): Fornecedor | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  if (typeof r.id !== 'string') return null
  const nome = typeof r.nome === 'string' ? r.nome : ''
  const agora = new Date().toISOString()
  return {
    id: r.id,
    nome,
    cpfCnpj: typeof r.cpfCnpj === 'string' ? r.cpfCnpj : '',
    rgInscricaoEstadual: typeof r.rgInscricaoEstadual === 'string' ? r.rgInscricaoEstadual : '',
    telefone: typeof r.telefone === 'string' ? r.telefone : '',
    fax: typeof r.fax === 'string' ? r.fax : '',
    cep: typeof r.cep === 'string' ? r.cep : '',
    endereco: typeof r.endereco === 'string' ? r.endereco : '',
    bairro: typeof r.bairro === 'string' ? r.bairro : '',
    municipio: typeof r.municipio === 'string' ? r.municipio : '',
    uf: typeof r.uf === 'string' ? r.uf : '',
    contato: typeof r.contato === 'string' ? r.contato : '',
    email: typeof r.email === 'string' ? r.email : '',
    informacoesAdicionais: typeof r.informacoesAdicionais === 'string' ? r.informacoesAdicionais : '',
    ativo: r.ativo !== false,
    criadoEm: typeof r.criadoEm === 'string' ? r.criadoEm : agora,
    atualizadoEm: typeof r.atualizadoEm === 'string' ? r.atualizadoEm : agora,
  }
}

export function loadFornecedores(): Fornecedor[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizarFornecedor).filter((f): f is Fornecedor => f !== null)
  } catch {
    return []
  }
}

export function saveFornecedores(fornecedores: Fornecedor[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(fornecedores))
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'fornecedores' } }))
}

export function criarFornecedorVazio(): Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'> {
  return {
    nome: '',
    cpfCnpj: '',
    rgInscricaoEstadual: '',
    telefone: '',
    fax: '',
    cep: '',
    endereco: '',
    bairro: '',
    municipio: '',
    uf: '',
    contato: '',
    email: '',
    informacoesAdicionais: '',
    ativo: true,
  }
}

export function addFornecedor(draft: Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'>): Fornecedor {
  const lista = loadFornecedores()
  const agora = new Date().toISOString()
  const f: Fornecedor = {
    ...draft,
    id: crypto.randomUUID(),
    criadoEm: agora,
    atualizadoEm: agora,
  }
  saveFornecedores([...lista, f])
  void sbUpsertFornecedores([f])
  return f
}

export function updateFornecedor(id: string, draft: Omit<Fornecedor, 'id' | 'criadoEm' | 'atualizadoEm'>): void {
  const lista = loadFornecedores()
  const idx = lista.findIndex((x) => x.id === id)
  if (idx < 0) return
  const antigo = lista[idx]
  const next = [...lista]
  next[idx] = {
    ...draft,
    id: antigo.id,
    criadoEm: antigo.criadoEm,
    atualizadoEm: new Date().toISOString(),
  }
  saveFornecedores(next)
  void sbUpsertFornecedores([next[idx]])
}

export function removeFornecedor(id: string): void {
  saveFornecedores(loadFornecedores().filter((f) => f.id !== id))
  void sbDeleteFornecedor(id)
}
