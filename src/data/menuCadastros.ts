/**
 * Estrutura do menu Cadastros (referência funcional).
 * `implementado: true` apenas onde já existe tela no Pedal Construtivo.
 */
export type AcaoCadastro =
  | 'produtos'
  | 'tipos_produto'
  | 'clientes'
  | 'fornecedores'
  | 'em_breve'

export type ItemMenuCadastro = {
  id: string
  label: string
  acao: AcaoCadastro
}

export type ItemMenuCadastroComSub = {
  id: string
  label: string
  submenu: ItemMenuCadastro[]
}

export type ItemMenuCadastroOuSub = ItemMenuCadastro | ItemMenuCadastroComSub

export type GrupoMenuCadastro = {
  id: string
  itens: ItemMenuCadastroOuSub[]
}

export const gruposMenuCadastros: GrupoMenuCadastro[] = [
  {
    id: 'g1',
    itens: [
      { id: 'cad-produtos', label: 'Cadastro de produtos', acao: 'produtos' },
      { id: 'cad-clientes', label: 'Cadastro de clientes', acao: 'clientes' },
      { id: 'cad-fornecedores', label: 'Cadastro de fornecedores', acao: 'fornecedores' },
      { id: 'cad-tipo-prod', label: 'Cadastro de tipo dos produtos', acao: 'tipos_produto' },
      { id: 'cad-moedas', label: 'Cadastro de moedas', acao: 'em_breve' },
    ],
  },
  {
    id: 'g2',
    itens: [
      { id: 'cad-cep', label: 'Cadastro de CEP — Importação de CEP', acao: 'em_breve' },
      {
        id: 'cad-fiscal',
        label: 'Cadastros fiscais',
        submenu: [
          { id: 'fiscal-nf', label: 'Configurações fiscais (NF)', acao: 'em_breve' },
          { id: 'fiscal-cfop', label: 'CFOP / CST', acao: 'em_breve' },
        ],
      },
    ],
  },
  {
    id: 'g3',
    itens: [{ id: 'cad-lanc-est', label: 'Lançamentos e acertos no estoque', acao: 'em_breve' }],
  },
  {
    id: 'g4',
    itens: [
      { id: 'cad-orc', label: 'Cadastro de planejamento orçamentário', acao: 'em_breve' },
      { id: 'cad-contas', label: 'Cadastro de contas para controle financeiro', acao: 'em_breve' },
      { id: 'cad-modos', label: 'Cadastro de modos de lançamento', acao: 'em_breve' },
      { id: 'cad-cartoes', label: 'Cadastro de cartões de crédito / débito aceitos na venda', acao: 'em_breve' },
    ],
  },
  {
    id: 'g5',
    itens: [
      { id: 'cad-usu-vend', label: 'Cadastro de usuários e vendedores', acao: 'em_breve' },
      { id: 'cad-perfil', label: 'Cadastro de perfil de acesso ao sistema', acao: 'em_breve' },
      { id: 'cad-empresa', label: 'Cadastro de informações da empresa', acao: 'em_breve' },
    ],
  },
]
