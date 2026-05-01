import type { Cliente, ModoBuscaClienteVenda } from '../types'
import { loadClientes } from '../store/clientes'

const digits = (s: string) => s.replace(/\D/g, '')

/** Primeiro cliente ativo que corresponde ao termo e ao modo (ou null). */
export function encontrarClienteVenda(termo: string, modo: ModoBuscaClienteVenda): Cliente | null {
  const t = termo.trim()
  if (!t) return null

  const lista = loadClientes().filter((c) => c.ativo !== false)
  const n = t.toLowerCase()

  const candidatos = lista.filter((c) => {
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
  })

  return candidatos[0] ?? null
}
