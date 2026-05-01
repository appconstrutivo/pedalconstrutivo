const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function formatarBrl(valor: number): string {
  return brl.format(Number.isFinite(valor) ? valor : 0)
}

/** Arredonda valor monetário para 2 casas (evita drift de float). */
export function round2(valor: number): number {
  const n = Number.isFinite(valor) ? valor : 0
  return Math.round(n * 100) / 100
}

export function percentualLucro(custo: number, venda: number): number {
  if (!Number.isFinite(custo) || !Number.isFinite(venda) || custo <= 0) return 0
  return ((venda - custo) / custo) * 100
}

/** Interpreta texto tipo "R$ 40,82", "40,82" ou número. */
export function parseValorMonetarioBr(val: string | number): number {
  if (typeof val === 'number' && Number.isFinite(val)) return round2(val)
  const s = String(val)
    .trim()
    .replace(/\u00a0/g, ' ')
    .replace(/R\$\s*/gi, '')
    .replace(/\s/g, '')
  const normalizado = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s
  const n = parseFloat(normalizado)
  return Number.isFinite(n) ? round2(n) : NaN
}
