export type AcaoRelatorio =
  | 'geral_vendas'
  | 'em_breve'

export type ItemMenuRelatorio =
  | { id: string; label: string; acao: AcaoRelatorio }
  | { id: string; label: string; separator: true }

export const itensMenuRelatorios: ItemMenuRelatorio[] = [
  { id: 'rel-hist-cli', label: 'Histórico de compra do cliente', acao: 'em_breve' },
  { id: 'rel-geral-vendas', label: 'Relatório GERAL de movimentação em VENDAS', acao: 'geral_vendas' },
  {
    id: 'rel-comissao',
    label: 'Cálculo de comissão do vendedor, produtos vendidos',
    acao: 'em_breve',
  },
  {
    id: 'rel-consignacao',
    label: 'Produtos em consignação, envio para o fornecedor',
    acao: 'em_breve',
  },
  { id: 'sep1', label: '', separator: true },
  { id: 'rel-cheques', label: 'Cheques para depósito', acao: 'em_breve' },
  { id: 'rel-pag-pend', label: 'Pagamentos pendentes (da empresa)', acao: 'em_breve' },
  { id: 'rel-rec-pend', label: 'Recebimentos pendentes (débito de clientes)', acao: 'em_breve' },
  { id: 'rel-balanco', label: 'Balanço & balancete financeiro', acao: 'em_breve' },
  { id: 'sep2', label: '', separator: true },
  { id: 'rel-hist-acesso', label: 'Histórico acesso ao sistema', acao: 'em_breve' },
  { id: 'rel-info-geral', label: 'Informações gerais', acao: 'em_breve' },
]
