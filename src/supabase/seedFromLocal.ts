import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import { loadClientes } from '../store/clientes'
import { loadFornecedores } from '../store/fornecedores'
import { loadRegistrosMovimentacao } from '../store/historicoMovimentacao'
import { loadKits } from '../store/kits'
import { loadOrcamentosRascunho } from '../store/orcamentosRascunho'
import { loadProdutos } from '../store/produtos'
import { loadItensCotacao, loadFornecedoresVisiveisCotacao } from '../store/cotacao'
import { loadTiposProduto } from '../store/tiposProduto'
import { loadHistoricoTurnosCaixa, obterAberturaTurnoHoje, obterUltimoFechamentoPersistido } from '../store/turnoCaixa'
import {
  replaceCotacaoFornecedoresVisiveis,
  replaceCotacaoItens,
  upsertClientes,
  upsertFornecedores,
  upsertKits,
  upsertMovimentacao,
  upsertOrcamentoRascunho,
  upsertProdutos,
  upsertTiposProduto,
  upsertTurnoCaixa,
} from './pcApi'

const MIGRATION_FLAG = 'pc:supabase-seeded-from-local:v1'

function enabled(): boolean {
  return DATA_MODE === 'supabase' && supabase !== null
}

async function supabaseHasAnyData(): Promise<boolean> {
  const sb = supabase!
  const [a, b, c, d] = await Promise.all([
    sb.from('pc_produtos').select('id').limit(1),
    sb.from('pc_clientes').select('id').limit(1),
    sb.from('pc_fornecedores').select('id').limit(1),
    sb.from('pc_movimentacoes').select('id').limit(1),
  ])
  if (a.error) throw a.error
  if (b.error) throw b.error
  if (c.error) throw c.error
  if (d.error) throw d.error
  return (a.data?.length ?? 0) + (b.data?.length ?? 0) + (c.data?.length ?? 0) + (d.data?.length ?? 0) > 0
}

function localHasAnyData(): boolean {
  return (
    loadProdutos().length > 0 ||
    loadClientes().length > 0 ||
    loadFornecedores().length > 0 ||
    loadTiposProduto().length > 0 ||
    loadKits().length > 0 ||
    loadRegistrosMovimentacao().length > 0 ||
    loadOrcamentosRascunho().length > 0 ||
    loadItensCotacao().length > 0 ||
    loadFornecedoresVisiveisCotacao().length > 0 ||
    loadHistoricoTurnosCaixa().length > 0 ||
    obterUltimoFechamentoPersistido() !== null ||
    obterAberturaTurnoHoje() !== null
  )
}

async function pushLocalToSupabase(): Promise<void> {
  // Ordem respeita dependências (FKs).
  const tipos = loadTiposProduto()
  const fornecedores = loadFornecedores()
  const clientes = loadClientes()
  const produtos = loadProdutos()
  const kits = loadKits()

  await upsertTiposProduto(tipos)
  await upsertFornecedores(fornecedores)
  await upsertClientes(clientes)
  await upsertProdutos(produtos)
  await upsertKits(kits)

  // Histórico (pode ser grande; mantém sequencial para não estourar rate/conn).
  for (const reg of loadRegistrosMovimentacao()) {
    await upsertMovimentacao(reg)
  }

  for (const r of loadOrcamentosRascunho()) {
    await upsertOrcamentoRascunho(r)
  }

  const itensCotacao = loadItensCotacao()
  if (itensCotacao.length) {
    await replaceCotacaoItens(
      itensCotacao.map((i) => ({
        id: i.id,
        descricao: i.descricao,
        quantidade: i.quantidade,
        precos: i.precos,
      })),
    )
  }
  const visiveis = loadFornecedoresVisiveisCotacao()
  if (visiveis.length) await replaceCotacaoFornecedoresVisiveis(visiveis)

  // Turno de caixa: envia histórico completo (offline) quando existir.
  const hist = loadHistoricoTurnosCaixa()
  if (hist.length) {
    for (const t of hist) {
      await upsertTurnoCaixa({
        dataReferencia: t.dataReferencia,
        abertoEmIso: t.abertoEmIso,
        saldoAbertura: t.saldoAbertura,
        fechadoEmIso: t.fechadoEmIso,
        dinheiro: t.dinheiro,
        pix: t.pix,
        cartao: t.cartao,
        boleto: t.boleto,
        totalVendas: t.totalVendas,
        proximoCaixa: t.proximoCaixa,
        operador: t.operador,
      })
    }
  }

  // Compatibilidade: projetos antigos ainda só têm abertura do dia + último fechamento.
  const ab = obterAberturaTurnoHoje()
  if (ab) {
    await upsertTurnoCaixa({
      dataReferencia: ab.dataReferencia,
      abertoEmIso: ab.abertoEmIso,
      saldoAbertura: ab.saldoAbertura,
      operador: 'Administrador',
    })
  }
  const ult = obterUltimoFechamentoPersistido()
  if (ult) {
    await upsertTurnoCaixa({
      dataReferencia: ult.dataReferencia,
      abertoEmIso: ult.abertoEmIso,
      saldoAbertura: ult.saldoAbertura,
      fechadoEmIso: ult.fechadoEmIso,
      dinheiro: ult.dinheiro,
      pix: ult.pix,
      cartao: ult.cartao,
      boleto: ult.boleto,
      totalVendas: ult.totalVendas,
      proximoCaixa: ult.proximoCaixa,
      operador: ult.operador,
    })
  }
}

/** Força sincronização do banco offline (desta porta) → Supabase. */
export async function forceSyncLocalToSupabase(): Promise<void> {
  if (!enabled()) return
  if (!localHasAnyData()) return
  await pushLocalToSupabase()
}

/**
 * Faz seed (1x) no Supabase com o conteúdo já existente no armazenamento offline.
 * - Só roda se o Supabase estiver vazio.
 * - Só roda se houver dados locais.
 * - Marca um flag local para não repetir.
 */
export async function ensureSupabaseSeededFromLocal(): Promise<void> {
  if (!enabled()) return

  if (localStorage.getItem(MIGRATION_FLAG) === '1') return
  if (!localHasAnyData()) {
    localStorage.setItem(MIGRATION_FLAG, '1')
    return
  }

  const hasAny = await supabaseHasAnyData()
  if (hasAny) {
    localStorage.setItem(MIGRATION_FLAG, '1')
    return
  }

  await pushLocalToSupabase()

  localStorage.setItem(MIGRATION_FLAG, '1')
}

