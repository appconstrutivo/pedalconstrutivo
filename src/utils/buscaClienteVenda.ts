import type { Cliente, ModoBuscaClienteVenda } from '../types'
import { loadClientes } from '../store/clientes'

const digits = (s: string) => s.replace(/\D/g, '')

function clienteCorrespondeTermo(c: Cliente, termo: string, modo: ModoBuscaClienteVenda): boolean {
  const t = termo.trim()
  if (!t) return true
  const n = t.toLowerCase()
  switch (modo) {
    case 'nome':
      return c.nome.toLowerCase().includes(n)
    case 'cpfCnpj':
      return (
        c.cpfCnpj.toLowerCase().includes(n) ||
        (digits(c.cpfCnpj).length > 0 && digits(c.cpfCnpj).includes(digits(t)))
      )
    case 'codigo':
      return c.codigo.toLowerCase().includes(n)
    case 'telefone':
      return (
        digits(c.telefone + c.celular).includes(digits(t)) ||
        c.telefone.toLowerCase().includes(n) ||
        c.celular.toLowerCase().includes(n)
      )
    default:
      return false
  }
}

/** Clientes ativos que correspondem ao termo (lista para combobox no PDV). */
export function filtrarClientesVenda(
  termo: string,
  modo: ModoBuscaClienteVenda,
  limite = 80,
): Cliente[] {
  const lista = loadClientes().filter((c) => c.ativo !== false)
  const filtrados = lista.filter((c) => clienteCorrespondeTermo(c, termo, modo))
  return filtrados.slice(0, limite)
}

/** Primeiro cliente ativo que corresponde ao termo e ao modo (ou null). */
export function encontrarClienteVenda(termo: string, modo: ModoBuscaClienteVenda): Cliente | null {
  const t = termo.trim()
  if (!t) return null
  return filtrarClientesVenda(termo, modo, 1)[0] ?? null
}
