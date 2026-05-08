import { useMemo, useState } from 'react'
import { DATA_MODE } from '../config/dataMode'
import { supabase } from '../lib/supabaseClient'
import {
  SNAPSHOT_MOVIMENTACOES_KEY,
  lerSnapshotMovimentacoesDoNavegador,
  listarCandidatosMovimentacaoNoStorage,
} from '../utils/localMovimentacaoBackup'
import {
  enviarChaveStorageParaSupabase,
  enviarJsonMovimentacoesParaSupabase,
  forceSyncLocalToSupabase,
} from '../supabase/seedFromLocal'

type Props = {
  aberto: boolean
  onFechar: () => void
}

export function ModalRecuperacaoDados({ aberto, onFechar }: Props) {
  const [jsonPendente, setJsonPendente] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [trabalhando, setTrabalhando] = useState(false)

  const podeSupabase = DATA_MODE === 'supabase' && supabase !== null

  const qtdSnapshot = useMemo(() => lerSnapshotMovimentacoesDoNavegador().length, [aberto, trabalhando])
  const candidatos = useMemo(() => (aberto ? listarCandidatosMovimentacaoNoStorage() : []), [aberto, trabalhando])

  if (!aberto) return null

  function acrescentarLog(linhas: string[]) {
    setLog((prev) => [...linhas, ...prev].slice(0, 40))
  }

  async function executar(
    rotulo: string,
    fn: () => Promise<{ enviados: number; erros: string[] }>,
  ): Promise<void> {
    setTrabalhando(true)
    try {
      const r = await fn()
      const linhas = [
        `[${rotulo}] Enviados: ${r.enviados}.`,
        ...r.erros.map((e) => `Aviso/erro: ${e}`),
      ]
      acrescentarLog(linhas)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      acrescentarLog([`Falha: ${msg}`])
    } finally {
      setTrabalhando(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pc-recuperacao-titulo"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-xl">
        <div className="px-4 py-3 border-b border-[var(--border)] flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2 id="pc-recuperacao-titulo" className="text-base font-bold text-[var(--text)]">
              Recuperação de vendas no Supabase
            </h2>
            <p className="text-xs text-[var(--text-muted)] mt-1 leading-snug">
              Apenas <strong className="font-semibold text-[var(--text)]">inclusão/atualização</strong> por{' '}
              <code className="text-[11px] bg-slate-100 px-1 rounded">upsert</code>. Nada é apagado no navegador nem
              nas tabelas.
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="shrink-0 rounded-lg px-2 py-1 text-sm text-[var(--text-muted)] hover:bg-slate-100 hover:text-[var(--text)]"
          >
            Fechar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-sm">
          {!podeSupabase && (
            <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-950 px-3 py-2 text-xs">
              Supabase não disponível nesta sessão. Configure as variáveis de ambiente e recarregue.
            </p>
          )}

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
            <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">Snapshot automático</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Chave <code className="bg-slate-100 px-1 rounded text-[11px]">{SNAPSHOT_MOVIMENTACOES_KEY}</code> —{' '}
              {qtdSnapshot} registro(s) detectado(s). Atualizado após carregar o app e a cada venda/orçamento
              gravado nesta aba.
            </p>
            <button
              type="button"
              disabled={!podeSupabase || trabalhando || qtdSnapshot === 0}
              onClick={() => void executar('Snapshot local', forceSyncLocalToSupabase)}
              className="mt-2 w-full rounded-lg bg-teal-600 text-white text-xs font-medium py-2 px-3 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-teal-700"
            >
              Enviar snapshot ao Supabase
            </button>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
            <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">Chaves no navegador</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Varredura de <code className="text-[11px]">localStorage</code> e{' '}
              <code className="text-[11px]">sessionStorage</code> (builds antigos ou export manual).
            </p>
            {candidatos.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] mt-2">Nenhuma chave com formato reconhecido.</p>
            ) : (
              <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {candidatos.slice(0, 12).map((c) => (
                  <li
                    key={`${c.origem}:${c.chave}`}
                    className="flex flex-col gap-1 rounded-lg border border-[var(--border)]/80 p-2 text-[11px]"
                  >
                    <span className="text-[var(--text)] font-medium break-all">{c.chave}</span>
                    <span className="text-[var(--text-muted)]">
                      {c.origem} · {c.registrosDetectados} reg. · {(c.tamanhoUtf8 / 1024).toFixed(1)} KiB
                    </span>
                    <button
                      type="button"
                      disabled={!podeSupabase || trabalhando}
                      onClick={() =>
                        void executar(`Chave ${c.chave}`, () => enviarChaveStorageParaSupabase(c.origem, c.chave))
                      }
                      className="self-start rounded-md border border-teal-300 bg-teal-50 text-teal-900 px-2 py-1 text-[11px] font-medium disabled:opacity-50 hover:bg-teal-100"
                    >
                      Enviar esta chave
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3">
            <p className="text-xs font-semibold text-[var(--text)] uppercase tracking-wide">Colar JSON</p>
            <textarea
              value={jsonPendente}
              onChange={(e) => setJsonPendente(e.target.value)}
              placeholder='Cole um array ou objeto com vendas/orçamentos (ex.: export de backup)...'
              rows={5}
              className="mt-2 w-full rounded-lg border border-[var(--border)] bg-white text-xs font-mono px-2 py-1.5 text-[var(--text)]"
            />
            <button
              type="button"
              disabled={!podeSupabase || trabalhando || !jsonPendente.trim()}
              onClick={() => void executar('JSON colado', () => enviarJsonMovimentacoesParaSupabase(jsonPendente))}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white text-xs font-medium py-2 px-3 text-[var(--text)] disabled:opacity-50 hover:bg-slate-50"
            >
              Enviar JSON ao Supabase
            </button>
          </section>

          {log.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-semibold uppercase text-slate-600">Último resultado</p>
              <pre className="mt-1 text-[11px] text-slate-800 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">
                {log.join('\n')}
              </pre>
            </section>
          )}
        </div>

        {trabalhando && (
          <div className="px-4 py-2 border-t border-[var(--border)] text-xs text-[var(--text-muted)] shrink-0">
            Processando… não feche a aba.
          </div>
        )}
      </div>
    </div>
  )
}
