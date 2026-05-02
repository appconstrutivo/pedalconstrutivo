export interface Fornecedor {
  id: string
  nome: string
  cpfCnpj: string
  rgInscricaoEstadual: string
  telefone: string
  fax: string
  cep: string
  endereco: string
  bairro: string
  municipio: string
  uf: string
  contato: string
  email: string
  /** Máx. 255 caracteres sugeridos. */
  informacoesAdicionais: string
  ativo: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface PrecoFornecedor {
  fornecedorId: string
  preco: number
}

/** Preço como digitado pelo usuário (permite vírgula). */
export interface PrecoFornecedorInput {
  fornecedorId: string
  preco: string
}

export interface ItemCotacao {
  id: string
  descricao: string
  precos: PrecoFornecedor[]
}

/** Item da cotação no formulário (preços em string para aceitar vírgula). */
export interface ItemCotacaoForm {
  id: string
  descricao: string
  /** Quantidade do item (multiplica o preço unitário do fornecedor escolhido no pedido). Mínimo efetivo: 1. */
  quantidade: number
  precos: PrecoFornecedorInput[]
}

export interface ItemPedidoMontado {
  descricao: string
  fornecedorId: string
  fornecedorNome: string
  /** Preço unitário do fornecedor escolhido (menor entre os considerados). */
  precoUnitario: number
  quantidade: number
  /** Subtotal da linha: quantidade × preço unitário. */
  preco: number
}

export interface PedidoMontado {
  itens: ItemPedidoMontado[]
  total: number
}

/** Como o produto entra no estoque / controle (cadastro). */
export type TipoLancamentoProduto = 'sem_controle_estoque' | 'controle_estoque' | 'servico'

/** Tipo ou categoria cadastrada em “Cadastro de tipo dos produtos”. */
export interface TipoProduto {
  id: string
  nome: string
}

export interface Produto {
  id: string
  tipoLancamento: TipoLancamentoProduto
  /** Código interno da loja (ex.: P-000001), gerado pelo sistema. */
  codigoInterno: string
  /** SKU / código do produto no fornecedor (pedidos, conferência). */
  codigoFornecedor: string
  /** Fornecedor principal/referência do cadastro (selecionável). */
  fornecedorId: string
  /** Snapshot do nome do fornecedor (para histórico/offline). */
  fornecedorNome: string
  descricao: string
  valorCusto: number
  valorVarejo: number
  valorAtacado: number
  /** Referência ao cadastro de tipos; vazio = nenhum selecionado. */
  tipoProdutoId: string
  codigoBarras: string
  aceitaFracionar: boolean
  unidadeMedida: string
  pontuacao: number
  informacoesAdicionais: string
  moeda: string
  cotacao: number
  estoqueMinimo: number
  estoqueAtual: number
  ativo: boolean
  observacoes: string
  /** URL pública da foto (ex.: CDN/fornecedor); não usa armazenamento do Supabase Storage. */
  imagemUrlPublica: string
  /** Texto longo para vitrine, catálogo ou observações ao cliente (além da descrição resumida). */
  descricaoDetalhada: string
  criadoEm: string
}

export type TipoPessoaCliente = 'pf' | 'pj'

/** Cadastro de cliente (gestão + modal). */
export interface Cliente {
  id: string
  /** Código sequencial exibido (ex.: 000001). */
  codigo: string
  tipoPessoa: TipoPessoaCliente
  /** Indicador simples na grade (referência coluna $). */
  situacaoFinanceiraOk: boolean

  nome: string
  cpfCnpj: string
  rgInscricaoEstadual: string
  telefone: string
  celular: string
  cep: string
  endereco: string
  bairro: string
  municipio: string
  uf: string
  email: string
  aniversarioDia: number
  aniversarioMes: number
  aniversarioAno: number

  informacoesAdicionais: string
  observacoes: string

  faixaSalarial: string
  descontoAutomaticoPct: number
  /** -1 = sem limite máximo (referência). */
  valorMaximoCompras: number

  criadoEm: string
  atualizadoEm: string

  saldoCompras: number
  pontosAcumulados: number

  recebeEmailPublicidade: boolean
  ativo: boolean
}

/** Registro de abertura de turno de caixa (dia corrente, armazenamento local). */
export interface AberturaTurnoCaixa {
  /** Data local YYYY-MM-DD referente ao dia de trabalho. */
  dataReferencia: string
  /** Data/hora ISO em que o turno foi aberto. */
  abertoEmIso: string
  saldoAbertura: number
}

/** Fechamento de turno (persistido como último resumo e para impressão). */
export interface FechamentoTurnoCaixa {
  dataReferencia: string
  abertoEmIso: string
  fechadoEmIso: string
  saldoAbertura: number
  dinheiro: number
  pix: number
  cartao: number
  boleto: number
  /** Soma dinheiro + pix + cartão + boleto. */
  totalVendas: number
  /** Valor deixado para o próximo caixa (sugerido na abertura do dia seguinte). */
  proximoCaixa: number
  operador: string
}

/** Venda / orçamento no PDV. */
export type ModoLancamentoVenda = 'venda' | 'orcamento'

/** Modo de busca do cliente na abertura da venda. */
export type ModoBuscaClienteVenda = 'cpfCnpj' | 'codigo' | 'telefone' | 'nome'

export interface ItemLancamentoVenda {
  id: string
  produtoId: string
  descricao: string
  codigoBarras: string
  quantidade: number
  precoUnitario: number
  /** Desconto percentual sobre o valor bruto da linha (qtd × unitário), intervalo 0–100. */
  descontoPercentual: number
  subtotal: number
}

/**
 * Estado inicial opcional ao abrir o PDV (rascunho salvo ou conversão de orçamento do histórico).
 * Permite retomar itens/observações e efetivar como venda depois.
 */
export type PdvBootstrap = {
  modo: ModoLancamentoVenda
  cliente: Cliente | null
  /** Quando não há `cliente` no cadastro mas há nome gravado no rascunho/histórico. */
  clienteNomeFallback?: string | null
  itens: ItemLancamentoVenda[]
  observacoes: string
  /** ID do rascunho local — removido ao concluir venda ou ao emitir orçamento (recibo). */
  rascunhoId?: string
}

/** Item persistido no histórico de movimentação (snapshot no fechamento). */
export interface ItemMovimentacaoHistorico {
  produtoId: string
  descricao: string
  codigoBarras: string
  quantidade: number
  precoUnitario: number
  /** Desconto percentual aplicado na linha no PDV (opcional em registros antigos). */
  descontoPercentual?: number
  subtotal: number
  valorCustoUnitario: number
  tipoProdutoId: string
}

/** Venda finalizada registrada para relatórios. */
export interface RegistroVendaHistorico {
  kind: 'venda'
  id: string
  emitidoEmIso: string
  numeroDocumento: string
  clienteId: string | null
  clienteNome: string | null
  vendedorNome: string
  /** Observações livres do lançamento (PDV). */
  observacoes?: string
  itens: ItemMovimentacaoHistorico[]
  pagamento: DadosPagamentoVenda
  cancelamento?: {
    canceladoEmIso: string
    canceladoPor: string
    justificativa: string
  }
}

/** Orçamento concluído (movimentação em aberto / orçamentos). */
export interface RegistroOrcamentoHistorico {
  kind: 'orcamento'
  id: string
  emitidoEmIso: string
  numeroDocumento: string
  clienteId: string | null
  clienteNome: string | null
  vendedorNome: string
  /** Observações lançadas no PDV no momento do orçamento. */
  observacoes?: string
  itens: ItemMovimentacaoHistorico[]
  total: number
}

export type RegistroMovimentacao = RegistroVendaHistorico | RegistroOrcamentoHistorico

/** Entrada de estoque a partir de planilha de pedido (fornecedor). */
export interface ItemEntradaPedidoPlanilha {
  produtoId: string
  skuFornecedor: string
  descricao: string
  quantidade: number
  custoUnitario: number
  acao: 'criado' | 'atualizado'
  /** Na atualização: se o custo do cadastro não foi alterado (ex.: entrou custo menor com estoque e usuário manteve o anterior). */
  custoCadastroMantido?: boolean
}

/** Quando o custo da planilha é menor que o cadastrado e ainda há estoque. */
export type DecisaoCustoMenorComEstoque = 'manter_custo_anterior' | 'usar_novo_custo'

export interface ConflitoCustoEntradaPlanilha {
  linhaIndex: number
  produtoId: string
  skuFornecedor: string
  descricaoProduto: string
  estoqueAntes: number
  custoAtual: number
  custoNovo: number
  quantidadeEntrada: number
}

/** Item do kit: produto e quantidade consumida por kit montado. */
export interface KitItem {
  produtoId: string
  quantidade: number
}

/** Kit: conglomerado de produtos, vira 1 item com estoque próprio. */
export interface Kit {
  id: string
  /** Produto que representa o kit no cadastro (estoque próprio). */
  produtoKitId: string
  nome: string
  itens: KitItem[]
  /**
   * Indica se os itens deste kit já tiveram baixa aplicada no estoque no momento da edição da composição.
   * Usado para evitar dupla baixa em kits antigos.
   */
  estoqueComprometido?: boolean
  criadoEm: string
}

export interface RegistroEntradaPedidoPlanilha {
  id: string
  emitidoEmIso: string
  nomeArquivo: string
  /** Fornecedor ao qual a planilha se refere (entradas novas preenchem sempre). */
  fornecedorId?: string
  fornecedorNome?: string
  /** Percentual de lucro sobre o custo aplicado a varejo e atacado na importação. */
  lucroSobreCustoPct?: number
  itens: ItemEntradaPedidoPlanilha[]
}

/** Valores finais após confirmação no PDV. */
export interface DadosPagamentoVenda {
  subtotalBruto: number
  tipoDesconto: 'percentual' | 'valor'
  /** Percentual (0–100) ou valor fixo em R$, conforme tipoDesconto. */
  descontoInformado: number
  valorDescontoCalculado: number
  /** Acréscimo (ex.: gorjeta) somado ao total final. */
  acrescimo: number
  totalAPagar: number
  dinheiro: number
  pix: number
  cartao: number
  boleto: number
  totalPago: number
  troco: number
}
