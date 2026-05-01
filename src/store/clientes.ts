import type { Cliente } from '../types'
import { deleteCliente as sbDeleteCliente, upsertClientes as sbUpsertClientes } from '../supabase/pcApi'

let clientesCache: Cliente[] = []

export function loadClientes(): Cliente[] {
  return clientesCache
}

export function saveClientes(lista: Cliente[]): void {
  clientesCache = lista
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
