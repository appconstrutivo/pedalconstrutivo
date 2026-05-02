import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import type { Cliente, Fornecedor, ItemCotacaoForm, ItemLancamentoVenda, Kit, Produto, TipoProduto } from '../types'
import type { OrcamentoRascunho } from '../store/orcamentosRascunho'
import { replaceOrcamentosRascunhoCache } from '../store/orcamentosRascunho'
import { replaceRegistrosMovimentacaoCache } from '../store/historicoMovimentacao'
import { saveClientes } from '../store/clientes'
import { replaceCotacaoCache } from '../store/cotacao'
import { saveFornecedores } from '../store/fornecedores'
import { saveKits } from '../store/kits'
import { saveProdutos } from '../store/produtos'
import { saveTiposProduto } from '../store/tiposProduto'
import { aplicarHidratacaoTurnosCaixa, type TurnoCaixaSbRow } from '../store/turnoCaixa'
import { fetchTodasMovimentacoesSupabase } from './historico'
import { subtotalLinhaPdv } from '../utils/moeda'

function enabled(): boolean {
  return DATA_MODE === 'supabase' && supabase !== null
}

export async function hydrateCadastrosFromSupabase(): Promise<void> {
  if (!enabled()) return

  const sb = supabase!

  const [tiposRes, fornRes, cliRes, prodRes, kitsRes, kitItensRes] = await Promise.all([
    sb.from('pc_tipos_produto').select('*'),
    sb.from('pc_fornecedores').select('*'),
    sb.from('pc_clientes').select('*'),
    sb.from('pc_produtos').select('*'),
    sb.from('pc_kits').select('*'),
    sb.from('pc_kit_itens').select('*'),
  ])

  if (tiposRes.error) throw tiposRes.error
  if (fornRes.error) throw fornRes.error
  if (cliRes.error) throw cliRes.error
  if (prodRes.error) throw prodRes.error
  if (kitsRes.error) throw kitsRes.error
  if (kitItensRes.error) throw kitItensRes.error

  const tipos: TipoProduto[] = (tiposRes.data ?? []).map((t) => ({ id: t.id, nome: t.nome }))
  saveTiposProduto(tipos)

  const fornecedores: Fornecedor[] = (fornRes.data ?? []).map((f) => ({
    id: f.id,
    nome: f.nome,
    cpfCnpj: f.cpf_cnpj ?? '',
    rgInscricaoEstadual: f.rg_inscricao_estadual ?? '',
    telefone: f.telefone ?? '',
    fax: f.fax ?? '',
    cep: f.cep ?? '',
    endereco: f.endereco ?? '',
    bairro: f.bairro ?? '',
    municipio: f.municipio ?? '',
    uf: f.uf ?? '',
    contato: f.contato ?? '',
    email: f.email ?? '',
    informacoesAdicionais: f.informacoes_adicionais ?? '',
    ativo: f.ativo !== false,
    criadoEm: f.criado_em ?? new Date().toISOString(),
    atualizadoEm: f.atualizado_em ?? new Date().toISOString(),
  }))
  saveFornecedores(fornecedores)

  const clientes: Cliente[] = (cliRes.data ?? []).map((c) => ({
    id: c.id,
    codigo: c.codigo,
    tipoPessoa: c.tipo_pessoa === 'pj' ? 'pj' : 'pf',
    situacaoFinanceiraOk: c.situacao_financeira_ok !== false,
    nome: c.nome ?? '',
    cpfCnpj: c.cpf_cnpj ?? '',
    rgInscricaoEstadual: c.rg_inscricao_estadual ?? '',
    telefone: c.telefone ?? '',
    celular: c.celular ?? '',
    cep: c.cep ?? '',
    endereco: c.endereco ?? '',
    bairro: c.bairro ?? '',
    municipio: c.municipio ?? '',
    uf: c.uf ?? '',
    email: c.email ?? '',
    aniversarioDia: Number(c.aniversario_dia) || 0,
    aniversarioMes: Number(c.aniversario_mes) || 0,
    aniversarioAno: Number(c.aniversario_ano) || 0,
    informacoesAdicionais: c.informacoes_adicionais ?? '',
    observacoes: c.observacoes ?? '',
    faixaSalarial: c.faixa_salarial ?? '',
    descontoAutomaticoPct: Number(c.desconto_automatico_pct) || 0,
    valorMaximoCompras: Number(c.valor_maximo_compras) || -1,
    criadoEm: c.criado_em ?? new Date().toISOString(),
    atualizadoEm: c.atualizado_em ?? new Date().toISOString(),
    saldoCompras: Number(c.saldo_compras) || 0,
    pontosAcumulados: Number(c.pontos_acumulados) || 0,
    recebeEmailPublicidade: c.recebe_email_publicidade !== false,
    ativo: c.ativo !== false,
  }))
  saveClientes(clientes)

  const produtos: Produto[] = (prodRes.data ?? []).map((p) => ({
    id: p.id,
    tipoLancamento: p.tipo_lancamento,
    codigoInterno: p.codigo_interno ?? '',
    codigoFornecedor: p.codigo_fornecedor ?? '',
    fornecedorId: p.fornecedor_id ?? '',
    fornecedorNome: p.fornecedor_nome ?? '',
    descricao: p.descricao ?? '',
    valorCusto: Number(p.valor_custo) || 0.01,
    valorVarejo: Number(p.valor_varejo) || 0.01,
    valorAtacado: Number(p.valor_atacado) || 0.01,
    tipoProdutoId: p.tipo_produto_id ?? '',
    codigoBarras: p.codigo_barras ?? '',
    aceitaFracionar: p.aceita_fracionar === true,
    unidadeMedida: p.unidade_medida ?? 'UN',
    pontuacao: Number(p.pontuacao) || 0,
    informacoesAdicionais: p.informacoes_adicionais ?? '',
    moeda: p.moeda ?? 'R$',
    cotacao: Number(p.cotacao) || 1,
    estoqueMinimo: Number(p.estoque_minimo) || 0,
    estoqueAtual: Number(p.estoque_atual) || 0,
    ativo: p.ativo !== false,
    observacoes: p.observacoes ?? '',
    imagemUrlPublica: p.imagem_url_publica ?? '',
    descricaoDetalhada: p.descricao_detalhada ?? '',
    criadoEm: p.criado_em ?? new Date().toISOString(),
  }))
  saveProdutos(produtos)

  const kitItens = kitItensRes.data ?? []
  const kits: Kit[] = (kitsRes.data ?? []).map((k) => ({
    id: k.id,
    produtoKitId: k.produto_kit_id,
    nome: k.nome,
    itens: kitItens
      .filter((i) => i.kit_id === k.id)
      .map((i) => ({ produtoId: i.produto_id, quantidade: Number(i.quantidade) || 0 }))
      .filter((i) => i.quantidade > 0),
    estoqueComprometido: k.estoque_comprometido === true,
    criadoEm: k.criado_em ?? new Date().toISOString(),
  }))
  saveKits(kits)
}

export async function hydrateHistoricoFromSupabase(): Promise<void> {
  if (!enabled()) return
  const regs = await fetchTodasMovimentacoesSupabase()
  replaceRegistrosMovimentacaoCache(regs)
}

function mapRascunhoItemSb(row: Record<string, unknown>): ItemLancamentoVenda | null {
  const produtoId = typeof row.produto_id === 'string' ? row.produto_id : ''
  const descricao = typeof row.descricao === 'string' ? row.descricao : ''
  if (!produtoId || !descricao) return null
  const qtd = typeof row.quantidade === 'number' ? row.quantidade : Number(row.quantidade) || 0
  const pu = typeof row.preco_unitario === 'number' ? row.preco_unitario : Number(row.preco_unitario) || 0
  const rawDesc = row.desconto_percentual
  const desconto =
    rawDesc !== undefined && rawDesc !== null && Number.isFinite(Number(rawDesc))
      ? Math.min(100, Math.max(0, Number(rawDesc)))
      : 0
  return {
    id: typeof row.linha_id === 'string' ? row.linha_id : crypto.randomUUID(),
    produtoId,
    descricao,
    codigoBarras: typeof row.codigo_barras === 'string' ? row.codigo_barras : '',
    quantidade: qtd,
    precoUnitario: pu,
    descontoPercentual: desconto,
    subtotal: subtotalLinhaPdv(qtd, pu, desconto),
  }
}

export async function hydrateOrcamentosRascunhoFromSupabase(): Promise<void> {
  if (!enabled()) return
  const sb = supabase!

  const cabRes = await sb.from('pc_orcamentos_rascunho').select('*').order('atualizado_em', { ascending: false })
  if (cabRes.error) throw cabRes.error
  const cabRows = cabRes.data ?? []
  if (!cabRows.length) {
    replaceOrcamentosRascunhoCache([])
    return
  }

  const ids = cabRows.map((r: { id: string }) => r.id)
  const itRes = await sb.from('pc_orcamentos_rascunho_itens').select('*').in('rascunho_id', ids)
  if (itRes.error) throw itRes.error

  const byRasc = new Map<string, Record<string, unknown>[]>()
  for (const row of (itRes.data ?? []) as Record<string, unknown>[]) {
    const rid = typeof row.rascunho_id === 'string' ? row.rascunho_id : ''
    if (!rid) continue
    const arr = byRasc.get(rid) ?? []
    arr.push(row)
    byRasc.set(rid, arr)
  }

  const lista: OrcamentoRascunho[] = cabRows.map((r: Record<string, unknown>) => {
    const id = typeof r.id === 'string' ? r.id : ''
    const agora = new Date().toISOString()
    const itensRaw = byRasc.get(id) ?? []
    const itens = itensRaw.map(mapRascunhoItemSb).filter((x): x is ItemLancamentoVenda => x !== null)
    return {
      id,
      criadoEmIso: typeof r.criado_em === 'string' ? r.criado_em : agora,
      atualizadoEmIso: typeof r.atualizado_em === 'string' ? r.atualizado_em : agora,
      clienteId: typeof r.cliente_id === 'string' ? r.cliente_id : null,
      clienteNome: typeof r.cliente_nome === 'string' ? r.cliente_nome : null,
      observacoes: typeof r.observacoes === 'string' ? r.observacoes : '',
      itens,
    }
  })

  replaceOrcamentosRascunhoCache(lista.filter((x) => Boolean(x.id)))
}

export async function hydrateTurnosFromSupabase(): Promise<void> {
  if (!enabled()) return
  const sb = supabase!
  const res = await sb.from('pc_turnos_caixa').select('*').order('data_referencia', { ascending: true })
  if (res.error) throw res.error
  aplicarHidratacaoTurnosCaixa((res.data ?? []) as TurnoCaixaSbRow[])
}

export async function hydrateCotacaoFromSupabase(): Promise<void> {
  if (!enabled()) return
  const sb = supabase!

  const [itRes, fvRes] = await Promise.all([
    sb.from('pc_cotacao_itens').select('*'),
    sb.from('pc_cotacao_fornecedores_visiveis').select('*'),
  ])
  if (itRes.error) throw itRes.error
  if (fvRes.error) throw fvRes.error

  const itens: ItemCotacaoForm[] = ((itRes.data ?? []) as Record<string, unknown>[]).map((row) => {
    const id = typeof row.id === 'string' ? row.id : crypto.randomUUID()
    const descricao = typeof row.descricao === 'string' ? row.descricao : ''
    const quantidade =
      typeof row.quantidade === 'number' && Number.isFinite(row.quantidade) && row.quantidade > 0
        ? row.quantidade
        : 1
    const precos: ItemCotacaoForm['precos'] = Array.isArray(row.precos)
      ? (row.precos as ItemCotacaoForm['precos'])
      : []
    return { id, descricao, quantidade, precos }
  })

  const fornecedoresVisiveis: string[] = ((fvRes.data ?? []) as { fornecedor_id?: string }[])
    .map((row) => row.fornecedor_id)
    .filter((id): id is string => typeof id === 'string' && id.length > 0)

  replaceCotacaoCache(itens, fornecedoresVisiveis)
}

/** Carrega caches em memória a partir do Supabase (fonte única de verdade). */
export async function hydrateAppFromSupabase(): Promise<void> {
  await hydrateCadastrosFromSupabase()
  await Promise.all([
    hydrateHistoricoFromSupabase(),
    hydrateOrcamentosRascunhoFromSupabase(),
    hydrateTurnosFromSupabase(),
    hydrateCotacaoFromSupabase(),
  ])
}
