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
import { hydrateCadastrosFromSupabase } from './supabase/hydrate'
import { ensureSupabaseSeededFromLocal } from './supabase/seedFromLocal'

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
        // Se Supabase estiver vazio, faz seed com dados offline acumulados.
        await ensureSupabaseSeededFromLocal()
        // Depois hidrata do Supabase para cache local.
        await hydrateCadastrosFromSupabase()
      } catch (err) {
        // Offline / env ausente na build / erro de rede ou permissão no Postgres.
        console.error('[Pedal Construtivo] Falha ao sincronizar com Supabase:', err)
      }
    })()

    const onAnyChange = () => setDataVersion((v) => v + 1)
    window.addEventListener('pc:data-changed', onAnyChange as EventListener)
    return () => window.removeEventListener('pc:data-changed', onAnyChange as EventListener)
  }, [])

  const avisoSupabaseSemEnv =
    DATA_MODE === 'supabase' && supabase === null && import.meta.env.PROD

  const bannerSupabaseDeploy =
    avisoSupabaseSemEnv ? (
      <div className="fixed inset-x-0 top-0 z-[9999] border-b border-amber-300 bg-amber-50 px-4 py-3 text-center text-sm text-amber-950 shadow-sm">
        <strong>Supabase não configurado neste deploy.</strong> Defina{' '}
        <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_URL</code> e{' '}
        <code className="rounded bg-amber-100 px-1">VITE_SUPABASE_ANON_KEY</code> na Vercel (Production e
        Preview) e faça um <strong>Redeploy</strong>. Sem isso, o app só usa o armazenamento vazio deste
        navegador.
      </div>
    ) : null

  if (tela === 'produtos') {
    return (
      <>
        {bannerSupabaseDeploy}
        <GestaoProdutos onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'estoque') {
    return (
      <>
        {bannerSupabaseDeploy}
        <Estoque onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'tipos-produto') {
    return (
      <>
        {bannerSupabaseDeploy}
        <GestaoTiposProduto onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'clientes') {
    return (
      <>
        {bannerSupabaseDeploy}
        <GestaoClientes onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'fornecedores') {
    return (
      <>
        {bannerSupabaseDeploy}
        <GestaoFornecedores onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'vender') {
    return (
      <>
        {bannerSupabaseDeploy}
        <VendaFlow onSair={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'caixa') {
    return (
      <>
        {bannerSupabaseDeploy}
        <FechamentoCaixa onVoltar={() => setTela('inicio')} />
      </>
    )
  }

  if (tela === 'inicio') {
    return (
      <>
        {bannerSupabaseDeploy}
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
      {bannerSupabaseDeploy}
      <Layout tab={tab} onTab={setTab} onIrParaInicio={() => setTela('inicio')}>
        {tab === 'fornecedores' && <Fornecedores />}
        {tab === 'cotacao' && <Cotacao fornecedores={fornecedores} />}
      </Layout>
    </>
  )
}

export default App
