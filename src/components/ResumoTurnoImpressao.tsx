import type { FechamentoTurnoCaixa } from '../types'
import { formatarBrl } from '../utils/moeda'

type Props = {
  dados: FechamentoTurnoCaixa
}

function fmtDataHora(iso: string): { data: string; hora: string } {
  const d = new Date(iso)
  return {
    data: d.toLocaleDateString('pt-BR'),
    hora: d.toLocaleTimeString('pt-BR'),
  }
}

/** Cupom estreito para impressora térmica / resumo de turno. */
export function ResumoTurnoImpressao({ dados }: Props) {
  const ab = fmtDataHora(dados.abertoEmIso)
  const fe = fmtDataHora(dados.fechadoEmIso)

  return (
    <article
      id="resumo-turno-print"
      className="max-w-[280px] mx-auto bg-white px-4 py-6 font-mono text-[11px] leading-relaxed text-slate-900 border border-dashed border-slate-300 print:border-slate-400 print:shadow-none"
    >
      <header className="text-center border-b border-slate-200 pb-3 mb-3">
        <p className="font-bold text-xs tracking-wide uppercase">Pedal Construtivo</p>
        <p className="mt-2 font-bold text-sm uppercase">Resumo de turno</p>
      </header>

      <p className="text-center text-[10px] mb-3">
        POR: <span className="font-semibold">{dados.operador.toUpperCase()}</span>
      </p>

      <div className="space-y-0.5 text-[10px] mb-4">
        <p>
          ABERTO: {ab.data} ÀS {ab.hora}
        </p>
        <p>
          FECHADO: {fe.data} ÀS {fe.hora}
        </p>
      </div>

      <p className="font-bold text-[10px] uppercase border-b border-slate-200 pb-1 mb-2">Informações gerais</p>
      <div className="space-y-1 text-[10px]">
        <div className="flex justify-between gap-2">
          <span>TOTAL DINHEIRO</span>
          <span className="tabular-nums">{formatarBrl(dados.dinheiro)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>TOTAL PIX</span>
          <span className="tabular-nums">{formatarBrl(dados.pix)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>TOTAL CARTÃO</span>
          <span className="tabular-nums">{formatarBrl(dados.cartao)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>TOTAL BOLETO</span>
          <span className="tabular-nums">{formatarBrl(dados.boleto)}</span>
        </div>
        <div className="flex justify-between gap-2 font-bold pt-1 border-t border-slate-200 mt-1">
          <span>SOMA GERAL</span>
          <span className="tabular-nums">{formatarBrl(dados.totalVendas)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-1 text-[10px] border-t border-slate-200 pt-3">
        <div className="flex justify-between gap-2">
          <span>TURNO ABERTO COM</span>
          <span className="tabular-nums">{formatarBrl(dados.saldoAbertura)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>VR. P. PROX. TUR.</span>
          <span className="tabular-nums font-semibold">{formatarBrl(dados.proximoCaixa)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span>T. VENDAS</span>
          <span className="tabular-nums">{formatarBrl(dados.totalVendas)}</span>
        </div>
        <div className="flex justify-between gap-2 font-bold text-emerald-800 pt-1">
          <span>TOTAL TURNO</span>
          <span className="tabular-nums">{formatarBrl(dados.totalVendas)}</span>
        </div>
      </div>

      <footer className="mt-5 pt-3 border-t border-dashed border-slate-200 text-center text-[9px] text-slate-500">
        Registro local · Pedal Construtivo
      </footer>
    </article>
  )
}
