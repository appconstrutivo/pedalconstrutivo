/** Formata um `Date` no calendário local como YYYY-MM-DD (fuso do navegador). */
export function formatarDiaLocal(dt: Date): string {
  const y = dt.getFullYear()
  const mo = String(dt.getMonth() + 1).padStart(2, '0')
  const da = String(dt.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

/** YYYY-MM-DD local correspondente a um instante gravado em ISO (UTC). */
export function diaLocalDeIso(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return (iso || '').slice(0, 10)
  return formatarDiaLocal(d)
}

/** Limites UTC (timestamptz) para consultar o intervalo inclusive de dias locais [inicio, fim]. */
export function limitesUtcIntervaloDatasLocais(dataInicioYYYYMMDD: string, dataFimYYYYMMDD: string): {
  ini: string
  fim: string
} {
  const [yi, mi, di] = dataInicioYYYYMMDD.split('-').map((x) => Number(x))
  const [yf, mf, df] = dataFimYYYYMMDD.split('-').map((x) => Number(x))
  const ini = new Date(yi, mi - 1, di, 0, 0, 0, 0).toISOString()
  const fim = new Date(yf, mf - 1, df, 23, 59, 59, 999).toISOString()
  return { ini, fim }
}
