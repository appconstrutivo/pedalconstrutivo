import { useEffect, useState } from 'react'
import { formatarBrl } from '../utils/moeda'

type PropsPergunta = {
  aberto: boolean
  onSim: () => void
  onNao: () => void
}

export function ModalPerguntaAberturaTurno({ aberto, onSim, onNao }: PropsPergunta) {
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-abertura-turno"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-xl overflow-hidden"
      >
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 id="titulo-abertura-turno" className="text-sm font-semibold text-[var(--text)]">
            Abertura do turno de caixa
          </h2>
        </div>
        <div className="px-5 py-4 flex gap-3">
          <div
            className="shrink-0 w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 font-bold text-lg"
            aria-hidden
          >
            ?
          </div>
          <p className="text-sm text-[var(--text)] leading-relaxed">
            Prezado usuário, o turno ainda não foi aberto. Deseja efetuar a abertura do turno?
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--surface)]/80">
          <button
            type="button"
            onClick={onNao}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Não
          </button>
          <button
            type="button"
            onClick={onSim}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  )
}

type PropsSaldo = {
  aberto: boolean
  /** Saldo sugerido (ex.: valor deixado no fechamento do dia anterior). */
  valorInicialSugerido?: number | null
  onConfirmar: (saldo: number) => void
  onCancelar: () => void
}

export function ModalSaldoAberturaTurno({
  aberto,
  valorInicialSugerido,
  onConfirmar,
  onCancelar,
}: PropsSaldo) {
  const [valor, setValor] = useState('')

  useEffect(() => {
    if (!aberto) return
    if (valorInicialSugerido !== undefined && valorInicialSugerido !== null) {
      setValor(String(valorInicialSugerido))
    } else {
      setValor('')
    }
  }, [aberto, valorInicialSugerido])

  function submit() {
    const n = Number(String(valor).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) {
      window.alert('Informe um saldo válido (valor maior ou igual a zero).')
      return
    }
    onConfirmar(Math.round(n * 100) / 100)
  }

  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-saldo-turno"
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-card)] shadow-xl overflow-hidden"
      >
        <div className="border-b border-[var(--border)] px-5 py-3">
          <h2 id="titulo-saldo-turno" className="text-sm font-semibold text-[var(--text)]">
            Saldo em caixa na abertura
          </h2>
        </div>
        <div className="px-5 py-4 space-y-3">
          <p className="text-sm text-[var(--text-muted)]">
            Informe o valor em dinheiro disponível no caixa neste momento. A abertura será registrada com a data e hora
            atuais.
          </p>
          <label htmlFor="saldo-abertura" className="block text-sm font-medium text-[var(--text)]">
            Saldo em caixa (R$)
          </label>
          <input
            id="saldo-abertura"
            type="number"
            min={0}
            step={0.01}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                submit()
              }
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm tabular-nums"
            placeholder="0,00"
            autoFocus
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-[var(--border)] bg-[var(--surface)]/80">
          <button
            type="button"
            onClick={onCancelar}
            className="rounded-xl border border-[var(--border)] bg-white px-4 py-2 text-sm font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-hover)]"
          >
            Confirmar abertura
          </button>
        </div>
      </div>
    </div>
  )
}

/** Linha discreta quando o turno do dia já está aberto. */
export function ResumoTurnoAbertoInline(props: { saldo: number; abertoEmIso: string }) {
  const d = new Date(props.abertoEmIso)
  const quando = d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <p className="text-xs text-[var(--text-muted)] text-center rounded-xl bg-teal-50/80 border border-teal-100 px-3 py-2">
      Turno do dia aberto em <span className="font-medium text-[var(--text)]">{quando}</span> · Saldo inicial{' '}
      <span className="font-semibold text-[var(--accent)] tabular-nums">{formatarBrl(props.saldo)}</span>
    </p>
  )
}
