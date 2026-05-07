import { useEffect, useMemo, useState } from 'react'
import { DATA_MODE } from './config/dataMode'
import { supabase } from './lib/supabaseClient'
import { Layout } from './components/Layout'
import { Fornecedores } from './pages/Fornecedores'
import { Cotacao } from './pages/Cotacao'
import { Inicio } from './pages/Inicio'
import { GestaoProdutos } from './pages/GestaoProdutos'
import { GestaoTiposProduto } from './pages/GestaoTiposProduto'
import { GestaoClientes } from './pages/GestaoClientes'
import { VendaFlow } from './pages/VendaFlow'
import { FechamentoCaixa } from './pages/FechamentoCaixa'
import { GestaoFornecedores } from './pages/GestaoFornecedores'
import { loadFornecedores } from './store/fornecedores'
import { Estoque } from './pages/Estoque.tsx'
import { hydrateAppFromSupabase } from './supabase/hydrate'

function App() {
  const [tela, setTela] = useState<
    'inicio' | 'legado' | 'produtos' | 'estoque' | 'tipos-produto' | 'clientes' | 'fornecedores' | 'vender' | 'caixa'
  >('inicio')
  const [tab, setTab] = useState<'fornecedores' | 'cotacao'>('fornecedores')
  const [dataVersion, setDataVersion] = useState(0)
  const fornecedores = useMemo(() => loadFornecedores(), [tab, dataVersion])

  useEffect(() => {
    void (async () => {
      try {
        await hydrateAppFromSupabase()
      } catch (err) {
        // Erro de rede, permissão, ou Supabase não configurado.
        console.error('[Pedal Construtivo] Falha ao sincronizar com Supabase:', err)
      }
    })()

    const onAnyChange = () => setDataVersion((v) => v + 1)
    window.addEventListener('pc:data-changed', onAnyChange as EventListener)
    return () => window.removeEventListener('pc:data-changed', onAnyChange as EventListener)
  }, [])

  const supabaseNaoConfigurado = DATA_MODE === 'supabase' && supabase === null

  if (supabaseNaoConfigurado) {
    return (
      <div className="min-h-screen bg-[var(--surface)] flex items-center justify-center p-6">
        <div className="w-full max-w-2xl rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Configuração obrigatória</p>
          <h1 className="mt-1 text-lg font-bold text-amber-950">Supabase não configurado</h1>
          <p className="mt-2 text-sm text-amber-950">
            Este sistema opera em modo <strong>Supabase-only</strong>. Para rodar (dev e produção), defina:
          </p>
          <ul className="mt-3 list-disc pl-5 text-sm text-amber-950 space-y-1">
            <li>
              <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code>
            </li>
            <li>
              <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code>
            </li>
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            Local: crie um <code className="rounded bg-amber-100 px-1">.env.local</code> baseado no{' '}
            <code className="rounded bg-amber-100 px-1">.env.example</code>. Na Vercel: configure as mesmas variáveis
            (Production e Preview) e faça redeploy.
          </p>
        </div>
      </div>
    )
  }

  if (tela === 'produtos') {
    return (
      <>
        <GestaoProdutos onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'estoque') {
    return (
      <>
        <Estoque onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'tipos-produto') {
    return (
      <>
        <GestaoTiposProduto onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'clientes') {
    return (
      <>
        <GestaoClientes onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'fornecedores') {
    return (
      <>
        <GestaoFornecedores onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'vender') {
    return (
      <>
        <VendaFlow onSair={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'caixa') {
    return (
      <>
        <FechamentoCaixa onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'inicio') {
    return (
      <>
        <Inicio
          onOpenPrototype={() => setTela('legado')}
          onOpenProdutos={() => setTela('produtos')}
          onOpenEstoque={() => setTela('estoque')}
          onOpenTiposProduto={() => setTela('tipos-produto')}
          onOpenClientes={() => setTela('clientes')}
          onOpenFornecedores={() => setTela('fornecedores')}
          onOpenVender={() => setTela('vender')}
          onOpenCaixa={() => setTela('caixa')}
        />
      </>
    )
  }

  return (
    <>
      <Layout tab={tab} onTab={setTab} onIrParaInicio={() => setTela('inicio')}>
        {tab === 'fornecedores' && <Fornecedores />}
        {tab === 'cotacao' && <Cotacao fornecedores={fornecedores} />}
      </Layout>
    </>
  )
}

export default App
