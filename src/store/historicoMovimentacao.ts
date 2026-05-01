import type {
  ItemLancamentoVenda,
  ItemMovimentacaoHistorico,
  RegistroMovimentacao,
  RegistroOrcamentoHistorico,
  RegistroVendaHistorico,
} from '../types'
import { upsertMovimentacao as sbUpsertMovimentacao } from '../supabase/pcApi'

/** Cache em memória — preenchido pela hidratação do Supabase. */
let movimentacaoCache: RegistroMovimentacao[] = []

export function replaceRegistrosMovimentacaoCache(lista: RegistroMovimentacao[]): void {
  movimentacaoCache = lista
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'historico-movimentacao' } }))
}

function validarDataYYYYMMDD(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s)
}

function trocarDataNoIso(iso: string, novaDataYYYYMMDD: string): string {
  if (!validarDataYYYYMMDD(novaDataYYYYMMDD)) return iso
  if (typeof iso !== 'string' || iso.length < 10) return iso
  return `${novaDataYYYYMMDD}${iso.slice(10)}`
}

export function loadRegistrosMovimentacao(): RegistroMovimentacao[] {
  return movimentacaoCache
}

/** Busca um registro (venda/orçamento) pelo Nº do documento. */
export function obterRegistroMovimentacaoPorDocumento(numeroDocumento: string): RegistroMovimentacao | null {
  const numero = (numeroDocumento ?? '').trim()
  if (!numero) return null
  const lista = loadRegistrosMovimentacao()
  return lista.find((r) => r.numeroDocumento === numero) ?? null
}

/** Busca uma venda finalizada pelo Nº do documento. */
export function obterRegistroVendaPorDocumento(numeroDocumento: string): RegistroVendaHistorico | null {
  const r = obterRegistroMovimentacaoPorDocumento(numeroDocumento)
  if (!r || r.kind !== 'venda') return null
  if (r.cancelamento?.canceladoEmIso) return null
  return r
}

function save(lista: RegistroMovimentacao[]): void {
  movimentacaoCache = lista
  window.dispatchEvent(new CustomEvent('pc:data-changed', { detail: { scope: 'historico-movimentacao' } }))
}

export function cancelarVendaPorDocumento(
  numeroDocumento: string,
  justificativa: string,
  canceladoPor: string,
): RegistroVendaHistorico | null {
  const numero = (numeroDocumento ?? '').trim()
  const just = (justificativa ?? '').trim()
  const por = (canceladoPor ?? '').trim() || 'Administrador'
  if (!numero || just.length < 3) return null

  const lista = loadRegistrosMovimentacao()
  const idx = lista.findIndex((r) => r.kind === 'venda' && r.numeroDocumento === numero)
  if (idx < 0) return null
  const atual = lista[idx] as RegistroVendaHistorico
  if (atual.cancelamento?.canceladoEmIso) return null

  const atualizado: RegistroVendaHistorico = {
    ...atual,
    cancelamento: { canceladoEmIso: new Date().toISOString(), canceladoPor: por, justificativa: just },
  }

  const novaLista = [...lista]
  novaLista[idx] = atualizado
  save(novaLista)
  void sbUpsertMovimentacao(atualizado)
  return atualizado
}

/**
 * Ajusta a data de emissão (apenas dia) pelo número do documento.
 * Mantém a parte de horário/fuso do ISO original.
 *
 * Retorna o registro atualizado (ou null se não encontrado / inválido).
 */
export function atualizarDataEmissaoPorDocumento(
  numeroDocumento: string,
  novaDataYYYYMMDD: string,
): RegistroMovimentacao | null {
  if (!numeroDocumento || !validarDataYYYYMMDD(novaDataYYYYMMDD)) return null

  const lista = loadRegistrosMovimentacao()
  const idx = lista.findIndex((r) => r.numeroDocumento === numeroDocumento)
  if (idx < 0) return null

  const atual = lista[idx]
  const novoIso = trocarDataNoIso(atual.emitidoEmIso, novaDataYYYYMMDD)
  if (novoIso === atual.emitidoEmIso) return null

  const atualizado: RegistroMovimentacao = { ...atual, emitidoEmIso: novoIso }
  const novaLista = [...lista]
  novaLista[idx] = atualizado
  save(novaLista)
  void sbUpsertMovimentacao(atualizado)
  return atualizado
}

export function appendRegistroVenda(
  draft: Omit<RegistroVendaHistorico, 'id' | 'kind'>,
): RegistroVendaHistorico {
  const lista = loadRegistrosMovimentacao()
  const reg: RegistroVendaHistorico = {
    kind: 'venda',
    id: crypto.randomUUID(),
    ...draft,
  }
  save([...lista, reg])
  void sbUpsertMovimentacao(reg)
  return reg
}

export function appendRegistroOrcamento(
  draft: Omit<RegistroOrcamentoHistorico, 'id' | 'kind'>,
): RegistroOrcamentoHistorico {
  const lista = loadRegistrosMovimentacao()
  const reg: RegistroOrcamentoHistorico = {
    kind: 'orcamento',
    id: crypto.randomUUID(),
    ...draft,
  }
  save([...lista, reg])
  void sbUpsertMovimentacao(reg)
  return reg
}

/** Converte snapshot do histórico em linhas editáveis do PDV (novos ids de linha). */
export function itensHistoricoParaPdv(itens: ItemMovimentacaoHistorico[]): ItemLancamentoVenda[] {
  return itens.map((i) => ({
    id: crypto.randomUUID(),
    produtoId: i.produtoId,
    descricao: i.descricao,
    codigoBarras: i.codigoBarras,
    quantidade: i.quantidade,
    precoUnitario: i.precoUnitario,
    descontoPercentual: i.descontoPercentual ?? 0,
    subtotal: i.subtotal,
  }))
}

/** Monta itens do histórico a partir da lista do PDV e do cadastro de produtos (custo/tipo). */
export function itensParaHistorico(
  itens: ItemLancamentoVenda[],
  getProduto: (produtoId: string) => { valorCusto: number; tipoProdutoId: string } | undefined,
): RegistroVendaHistorico['itens'] {
  return itens.map((i) => {
    const p = getProduto(i.produtoId)
    return {
      produtoId: i.produtoId,
      descricao: i.descricao,
      codigoBarras: i.codigoBarras,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitario,
      descontoPercentual: i.descontoPercentual ?? 0,
      subtotal: i.subtotal,
      valorCustoUnitario: p?.valorCusto ?? 0,
      tipoProdutoId: p?.tipoProdutoId ?? '',
    }
  })
}
