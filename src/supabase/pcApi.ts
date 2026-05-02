import { DATA_MODE } from '../config/dataMode'
import type {
  Cliente,
  Fornecedor,
  Kit,
  ItemLancamentoVenda,
  Produto,
  RegistroMovimentacao,
  TipoProduto,
  DadosPagamentoVenda,
} from '../types'
import { supabase } from '../lib/supabaseClient'

type PcTable =
  | 'pc_tipos_produto'
  | 'pc_fornecedores'
  | 'pc_clientes'
  | 'pc_produtos'
  | 'pc_kits'
  | 'pc_kit_itens'
  | 'pc_movimentacoes'
  | 'pc_movimentacao_itens'
  | 'pc_orcamentos_rascunho'
  | 'pc_orcamentos_rascunho_itens'
  | 'pc_turnos_caixa'
  | 'pc_cotacao_itens'
  | 'pc_cotacao_fornecedores_visiveis'

function enabled(): boolean {
  return DATA_MODE === 'supabase' && supabase !== null
}

function isoOrNow(iso: string | undefined): string {
  return typeof iso === 'string' && iso ? iso : new Date().toISOString()
}

export async function upsertTiposProduto(rows: TipoProduto[]): Promise<void> {
  if (!enabled() || rows.length === 0) return
  await supabase!
    .from('pc_tipos_produto' satisfies PcTable)
    .upsert(rows.map((t) => ({ id: t.id, nome: t.nome })), { onConflict: 'id' })
}

export async function deleteTipoProduto(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_tipos_produto' satisfies PcTable).delete().eq('id', id)
}

export async function upsertFornecedores(rows: Fornecedor[]): Promise<void> {
  if (!enabled() || rows.length === 0) return
  await supabase!
    .from('pc_fornecedores' satisfies PcTable)
    .upsert(
      rows.map((f) => ({
        id: f.id,
        nome: f.nome,
        cpf_cnpj: f.cpfCnpj ?? '',
        rg_inscricao_estadual: f.rgInscricaoEstadual ?? '',
        telefone: f.telefone ?? '',
        fax: f.fax ?? '',
        cep: f.cep ?? '',
        endereco: f.endereco ?? '',
        bairro: f.bairro ?? '',
        municipio: f.municipio ?? '',
        uf: f.uf ?? '',
        contato: f.contato ?? '',
        email: f.email ?? '',
        informacoes_adicionais: f.informacoesAdicionais ?? '',
        ativo: f.ativo !== false,
        criado_em: isoOrNow(f.criadoEm),
        atualizado_em: isoOrNow(f.atualizadoEm),
      })),
      { onConflict: 'id' },
    )
}

export async function deleteFornecedor(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_fornecedores' satisfies PcTable).delete().eq('id', id)
}

export async function upsertClientes(rows: Cliente[]): Promise<void> {
  if (!enabled() || rows.length === 0) return
  await supabase!
    .from('pc_clientes' satisfies PcTable)
    .upsert(
      rows.map((c) => ({
        id: c.id,
        codigo: c.codigo,
        tipo_pessoa: c.tipoPessoa,
        situacao_financeira_ok: c.situacaoFinanceiraOk !== false,
        nome: c.nome,
        cpf_cnpj: c.cpfCnpj ?? '',
        rg_inscricao_estadual: c.rgInscricaoEstadual ?? '',
        telefone: c.telefone ?? '',
        celular: c.celular ?? '',
        cep: c.cep ?? '',
        endereco: c.endereco ?? '',
        bairro: c.bairro ?? '',
        municipio: c.municipio ?? '',
        uf: c.uf ?? '',
        email: c.email ?? '',
        aniversario_dia: c.aniversarioDia ?? 0,
        aniversario_mes: c.aniversarioMes ?? 0,
        aniversario_ano: c.aniversarioAno ?? 0,
        informacoes_adicionais: c.informacoesAdicionais ?? '',
        observacoes: c.observacoes ?? '',
        faixa_salarial: c.faixaSalarial ?? '',
        desconto_automatico_pct: c.descontoAutomaticoPct ?? 0,
        valor_maximo_compras: c.valorMaximoCompras ?? -1,
        criado_em: isoOrNow(c.criadoEm),
        atualizado_em: isoOrNow(c.atualizadoEm),
        saldo_compras: c.saldoCompras ?? 0,
        pontos_acumulados: c.pontosAcumulados ?? 0,
        recebe_email_publicidade: c.recebeEmailPublicidade !== false,
        ativo: c.ativo !== false,
      })),
      { onConflict: 'id' },
    )
}

export async function deleteCliente(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_clientes' satisfies PcTable).delete().eq('id', id)
}

export async function upsertProdutos(rows: Produto[]): Promise<void> {
  if (!enabled() || rows.length === 0) return
  await supabase!
    .from('pc_produtos' satisfies PcTable)
    .upsert(
      rows.map((p) => ({
        id: p.id,
        tipo_lancamento: p.tipoLancamento,
        codigo_interno: p.codigoInterno,
        codigo_fornecedor: p.codigoFornecedor ?? '',
        fornecedor_id: p.fornecedorId || null,
        fornecedor_nome: p.fornecedorNome ?? '',
        descricao: p.descricao,
        valor_custo: p.valorCusto,
        valor_varejo: p.valorVarejo,
        valor_atacado: p.valorAtacado,
        tipo_produto_id: p.tipoProdutoId || null,
        codigo_barras: p.codigoBarras ?? '',
        aceita_fracionar: p.aceitaFracionar === true,
        unidade_medida: p.unidadeMedida ?? 'UN',
        pontuacao: p.pontuacao ?? 0,
        informacoes_adicionais: p.informacoesAdicionais ?? '',
        moeda: p.moeda ?? 'R$',
        cotacao: p.cotacao ?? 1,
        estoque_minimo: p.estoqueMinimo ?? 0,
        estoque_atual: p.estoqueAtual ?? 0,
        ativo: p.ativo !== false,
        observacoes: p.observacoes ?? '',
        imagem_url_publica: p.imagemUrlPublica?.trim() ? p.imagemUrlPublica.trim() : '',
        descricao_detalhada: p.descricaoDetalhada ?? '',
        criado_em: isoOrNow(p.criadoEm),
      })),
      { onConflict: 'id' },
    )
}

export async function deleteProduto(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_produtos' satisfies PcTable).delete().eq('id', id)
}

export async function upsertKits(rows: Kit[]): Promise<void> {
  if (!enabled() || rows.length === 0) return

  await supabase!
    .from('pc_kits' satisfies PcTable)
    .upsert(
      rows.map((k) => ({
        id: k.id,
        produto_kit_id: k.produtoKitId,
        nome: k.nome,
        estoque_comprometido: k.estoqueComprometido === true,
        criado_em: isoOrNow(k.criadoEm),
      })),
      { onConflict: 'id' },
    )

  // Itens: mantém simples (delete+insert por kit) para consistência.
  for (const k of rows) {
    await supabase!.from('pc_kit_itens' satisfies PcTable).delete().eq('kit_id', k.id)
    if (k.itens.length) {
      await supabase!.from('pc_kit_itens' satisfies PcTable).insert(
        k.itens.map((i) => ({
          kit_id: k.id,
          produto_id: i.produtoId,
          quantidade: i.quantidade,
        })),
      )
    }
  }
}

export async function deleteKit(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_kits' satisfies PcTable).delete().eq('id', id)
}

export async function upsertMovimentacao(reg: RegistroMovimentacao): Promise<void> {
  if (!enabled()) return

  const base = {
    id: reg.id,
    kind: reg.kind,
    emitido_em: reg.emitidoEmIso,
    numero_documento: reg.numeroDocumento,
    cliente_id: reg.clienteId ?? null,
    cliente_nome: reg.clienteNome ?? null,
    vendedor_nome: reg.vendedorNome ?? 'Administrador',
    observacoes: reg.observacoes ?? null,
    cancelamento: (reg.kind === 'venda' ? reg.cancelamento ?? null : null) as unknown,
  }

  if (reg.kind === 'orcamento') {
    await supabase!.from('pc_movimentacoes' satisfies PcTable).upsert(
      {
        ...base,
        total: reg.total,
        pagamento: null,
      },
      { onConflict: 'id' },
    )
  } else {
    await supabase!.from('pc_movimentacoes' satisfies PcTable).upsert(
      {
        ...base,
        total: null,
        pagamento: reg.pagamento as unknown as DadosPagamentoVenda,
      },
      { onConflict: 'id' },
    )
  }

  await supabase!.from('pc_movimentacao_itens' satisfies PcTable).delete().eq('movimentacao_id', reg.id)
  if (reg.itens.length) {
    await supabase!.from('pc_movimentacao_itens' satisfies PcTable).insert(
      reg.itens.map((i) => ({
        movimentacao_id: reg.id,
        produto_id: i.produtoId,
        descricao: i.descricao,
        codigo_barras: i.codigoBarras ?? '',
        quantidade: i.quantidade,
        preco_unitario: i.precoUnitario,
        subtotal: i.subtotal,
        valor_custo_unitario: i.valorCustoUnitario ?? 0,
        tipo_produto_id: i.tipoProdutoId || null,
      })),
    )
  }
}

export async function upsertOrcamentoRascunho(reg: {
  id: string
  criadoEmIso: string
  atualizadoEmIso: string
  clienteId: string | null
  clienteNome: string | null
  observacoes: string
  itens: ItemLancamentoVenda[]
}): Promise<void> {
  if (!enabled()) return

  await supabase!.from('pc_orcamentos_rascunho' satisfies PcTable).upsert(
    {
      id: reg.id,
      criado_em: reg.criadoEmIso,
      atualizado_em: reg.atualizadoEmIso,
      cliente_id: reg.clienteId ?? null,
      cliente_nome: reg.clienteNome ?? null,
      observacoes: reg.observacoes ?? '',
    },
    { onConflict: 'id' },
  )

  await supabase!
    .from('pc_orcamentos_rascunho_itens' satisfies PcTable)
    .delete()
    .eq('rascunho_id', reg.id)

  if (reg.itens.length) {
    await supabase!.from('pc_orcamentos_rascunho_itens' satisfies PcTable).insert(
      reg.itens.map((i) => ({
        rascunho_id: reg.id,
        linha_id: i.id,
        produto_id: i.produtoId,
        descricao: i.descricao,
        codigo_barras: i.codigoBarras ?? '',
        quantidade: i.quantidade,
        preco_unitario: i.precoUnitario,
        subtotal: i.subtotal,
      })),
    )
  }
}

export async function deleteOrcamentoRascunho(id: string): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_orcamentos_rascunho' satisfies PcTable).delete().eq('id', id)
}

export async function upsertTurnoCaixa(row: {
  dataReferencia: string
  abertoEmIso: string
  saldoAbertura: number
  fechadoEmIso?: string | null
  dinheiro?: number
  pix?: number
  cartao?: number
  boleto?: number
  totalVendas?: number
  proximoCaixa?: number
  operador?: string
}): Promise<void> {
  if (!enabled()) return
  await supabase!.from('pc_turnos_caixa' satisfies PcTable).upsert(
    {
      data_referencia: row.dataReferencia,
      aberto_em: row.abertoEmIso,
      fechado_em: row.fechadoEmIso ?? null,
      saldo_abertura: row.saldoAbertura ?? 0,
      dinheiro: row.dinheiro ?? 0,
      pix: row.pix ?? 0,
      cartao: row.cartao ?? 0,
      boleto: row.boleto ?? 0,
      total_vendas: row.totalVendas ?? 0,
      proximo_caixa: row.proximoCaixa ?? 0,
      operador: row.operador ?? 'Administrador',
    },
    { onConflict: 'data_referencia' },
  )
}

export async function replaceCotacaoItens(rows: { id: string; descricao: string; quantidade: number; precos: unknown }[]): Promise<void> {
  if (!enabled()) return
  // Estratégia simples: delete all + insert (1 “cotação ativa” por enquanto).
  await supabase!.from('pc_cotacao_itens' satisfies PcTable).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (rows.length) {
    await supabase!.from('pc_cotacao_itens' satisfies PcTable).insert(
      rows.map((r) => ({
        id: r.id,
        descricao: r.descricao,
        quantidade: r.quantidade,
        precos: r.precos,
      })),
    )
  }
}

export async function replaceCotacaoFornecedoresVisiveis(ids: string[]): Promise<void> {
  if (!enabled()) return
  await supabase!
    .from('pc_cotacao_fornecedores_visiveis' satisfies PcTable)
    .delete()
    .neq('fornecedor_id', '00000000-0000-0000-0000-000000000000')

  if (ids.length) {
    await supabase!.from('pc_cotacao_fornecedores_visiveis' satisfies PcTable).insert(
      ids.map((id) => ({ fornecedor_id: id })),
    )
  }
}

