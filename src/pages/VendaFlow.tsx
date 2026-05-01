import { useState } from 'react'
import type { Cliente, ModoLancamentoVenda, PdvBootstrap } from '../types'
import { IniciarVenda } from './IniciarVenda'
import { PdvLancamento } from './PdvLancamento'

type Props = {
  onSair: () => void
}

export function VendaFlow({ onSair }: Props) {
  const [etapa, setEtapa] = useState<'abertura' | 'pdv'>('abertura')
  const [modo, setModo] = useState<ModoLancamentoVenda>('venda')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [pdvSeed, setPdvSeed] = useState<PdvBootstrap | null>(null)
  const [pdvKey, setPdvKey] = useState(0)

  function abrirPdvNovo(c: Cliente | null) {
    setCliente(c)
    setPdvSeed(null)
    setPdvKey((k) => k + 1)
    setEtapa('pdv')
  }

  function abrirPdvComBootstrap(b: PdvBootstrap) {
    setModo(b.modo)
    setCliente(b.cliente)
    setPdvSeed(b)
    setPdvKey((k) => k + 1)
    setEtapa('pdv')
  }

  if (etapa === 'abertura') {
    return (
      <IniciarVenda
        modo={modo}
        onModo={setModo}
        onContinuar={(c) => {
          abrirPdvNovo(c)
        }}
        onAbrirPdvComBootstrap={abrirPdvComBootstrap}
        onVoltar={onSair}
      />
    )
  }

  return (
    <PdvLancamento
      key={pdvKey}
      modo={modo}
      cliente={cliente}
      clienteNomeFallback={pdvSeed?.clienteNomeFallback ?? null}
      pdvSeed={pdvSeed}
      onVoltar={() => {
        setEtapa('abertura')
        setPdvSeed(null)
      }}
      onSair={onSair}
    />
  )
}
