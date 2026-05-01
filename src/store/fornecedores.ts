import type { Fornecedor } from '../types'
import { deleteFornecedor as sbDeleteFornecedor, upsertFornecedores as sbUpsertFornecedores } from '../supabase/pcApi'

let fornecedoresCache: Fornecedor[] = []

export function loadFornecedores(): Fornecedor[] {
  return fornecedoresCache
}

export function saveFornecedores(fornecedores: Fornecedor[]): void {
  fornecedoresCache = fornecedores
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
