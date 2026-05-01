# IMPORTE · PEDIDO · ENTRADA POR PLANILHA

> Lembrete para implementação prioritária — persistência no **Supabase** do que hoje fica só na **memória da aba**.

Data de registro do débito técnico: conforme decisão de remover `localStorage` e usar apenas `DATA_MODE === 'supabase'` (`src/config/dataMode.ts`).

---

## Esclarecimento importante: entrada por planilha **funciona** hoje

**Não** é verdade que “não é possível dar entrada por planilha”.

Na sessão atual, ao concluir a importação (`ImportarPedidoPlanilhaModal` → `aplicarEntradaPedidoPlanilha` em `src/store/aplicarEntradaPedidoPlanilha.ts`):

- Os **produtos** são atualizados (custo, estoque, etc.).
- `saveProdutos` dispara **`upsertProdutos`** no Supabase — ou seja, **as alterações de cadastro/estoque persistem na nuvem**.

O que **não** está persistido no Supabase é apenas o **histórico formal da operação** (`RegistroEntradaPedidoPlanilha`), gravado hoje em cache RAM em `src/store/entradaPedidoPlanilha.ts` (`appendRegistroEntradaPedido`). Esse histórico:

- **some ao recarregar a página**;
- neste momento **não há** consumo desse histórico na UI de Estoque (grep só encontra uso interno no próprio store).

**Resumo:** operação de entrada **sim**; **rastreabilidade / lista de entradas por planilha entre sessões** — ainda não.

---

## Pedidos de compra (`src/store/pedidoCompra.ts`)

- Estado dos pedidos/rascunhos fica **somente em memória** até existir modelo + API no Supabase.
- Ao fechar o navegador ou recarregar, **perde-se** o que não foi “materializado” em outro fluxo (ex.: não há sync automático desses pedidos para o banco).

**Prioridade:** definir tabelas (ex.: cabeçalho + itens), RLS se necessário, e funções em `src/supabase/pcApi.ts` + hidratação em `src/supabase/hydrate.ts` (ou equivalente).

---

## Histórico de entradas por planilha (`src/store/entradaPedidoPlanilha.ts`)

- Lista em RAM; **sem tabela** dedicada no projeto.
- Para auditoria, relatórios e consistência multi-dispositivo, falta:

  1. SQL no Supabase (ex.: `pc_entradas_planilha` + `pc_entradas_planilha_itens`, ou nome alinhado ao padrão `pc_*`).
  2. `upsert` / `select` em `pcApi.ts`.
  3. Opcional: incluir na `hydrateAppFromSupabase()` para repovoar cache após login.

---

## Configuração atual

- **`DATA_MODE`**: apenas `'supabase'` (`src/config/dataMode.ts`).
- Build: `npm run build` deve permanecer verde após integrar novas tabelas.

---

## Próximo passo sugerido (checklist)

1. [ ] Modelar no Postgres as tabelas de **pedido de compra** e de **registro de entrada por planilha** (FKs para `pc_produtos`, `pc_fornecedores` se aplicável).
2. [ ] Políticas RLS / service role conforme política de segurança do projeto.
3. [ ] Estender `PcTable` e funções em `src/supabase/pcApi.ts`.
4. [ ] Hidratar caches na abertura do app (`hydrate.ts`).
5. [ ] Ajustar stores para ler/escrever só via Supabase (remover dependência de RAM para dados que devem sobreviver ao reload).
6. [ ] (Opcional) Expor na tela de Estoque o histórico de entradas por planilha lido do Supabase.

---

## Referências rápidas no código

| Área | Ficheiro principal |
|------|---------------------|
| Aplicar planilha | `src/store/aplicarEntradaPedidoPlanilha.ts` |
| Cache só RAM (histórico entrada) | `src/store/entradaPedidoPlanilha.ts` |
| Pedidos de compra só RAM | `src/store/pedidoCompra.ts` |
| API Supabase genérica | `src/supabase/pcApi.ts` |
| Hidratação inicial | `src/supabase/hydrate.ts` |

---

*Documento criado para não perder o follow-up de implementação.*
