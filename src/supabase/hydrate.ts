import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import type { Cliente, Fornecedor, Kit, Produto, TipoProduto } from '../types'
import { saveClientes } from '../store/clientes'
import { saveFornecedores } from '../store/fornecedores'
import { saveKits } from '../store/kits'
import { saveProdutos } from '../store/produtos'
import { saveTiposProduto } from '../store/tiposProduto'

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

  // Se o Supabase está vazio, NÃO sobrescreve o cache local (offline acumulado).
  const isEmpty =
    (tiposRes.data?.length ?? 0) === 0 &&
    (fornRes.data?.length ?? 0) === 0 &&
    (cliRes.data?.length ?? 0) === 0 &&
    (prodRes.data?.length ?? 0) === 0 &&
    (kitsRes.data?.length ?? 0) === 0 &&
    (kitItensRes.data?.length ?? 0) === 0
  if (isEmpty) return

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

  // Por enquanto, mantém histórico local como fonte (evita conflito com dados existentes).
  // Quando começarmos a operar 100% no Supabase, podemos “baixar” o histórico completo daqui também.
}

