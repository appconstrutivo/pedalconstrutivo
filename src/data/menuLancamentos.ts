export type AcaoLancamento =
  | 'segunda_via_recibo_venda'
  | 'cancelar_venda_realizada'
  | 'em_breve'

export type ItemMenuLancamento =
  | { id: string; label: string; acao: AcaoLancamento }
  | { id: string; label: string; separator: true }

/**
 * Menu “Lançamentos” (referência do sistema legado).
 * Neste momento, apenas “Imprimir 2ª via - recibo de venda” fica ativo.
 */
export const itensMenuLancamentos: ItemMenuLancamento[] = [
  { id: 'lanc-pedidos-venda', label: 'Lançamentos de pedidos de venda', acao: 'em_breve' },
  {
    id: 'lanc-financeiro',
    label: 'Lançamentos de contas a pagar e a receber, gráficos e relatórios financeiros',
    acao: 'em_breve',
  },
  { id: 'lanc-diversos', label: 'Lançamentos diversos no caixa do dia', acao: 'em_breve' },
  { id: 'sep1', label: '', separator: true },
  { id: 'lanc-2via', label: 'Imprimir 2ª via - recibo de venda', acao: 'segunda_via_recibo_venda' },
  { id: 'lanc-cancelar-venda', label: 'Cancelar venda realizada', acao: 'cancelar_venda_realizada' },
  { id: 'sep2', label: '', separator: true },
  { id: 'lanc-mov-caixa', label: 'Movimentação do caixa', acao: 'em_breve' },
]

