import { useState, useEffect } from 'react'
import { ChevronLeft } from 'lucide-react'
import { useLojaData } from './useLojaData'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import { useViewMode } from '../../hooks/useViewMode'
import Menu from './Menu'
import CadastrarProduto from './CadastrarProduto'
import Estoque from './Estoque'
import ContarEstoque from './ContarEstoque'
import ListaCompras from './ListaCompras'
import Validade from './Validade'
import Promocao from './Promocao'
import Fiado from './Fiado'
import ImportarProdutos from './ImportarProdutos'
import Caixa from './Caixa'
import NovaVenda from './NovaVenda'
import Ajuda from './Ajuda'
import LojaConfig from '../LojaFeminina/LojaConfig'
// Financeiro é o MESMO componente da Moda, não uma cópia: Contas a Pagar,
// Contas a Receber, Fluxo de Caixa e DRE já leem lf_contas_pagar/receber, que
// é o que o Mercado usa também. Ele recebe lojaId + vendas + theme e o resto
// vem das CSS vars globais (src/index.css), então renderiza igual aqui.
// Mesmo padrão de reuso já adotado pelo LojaConfig acima.
import Financeiro from '../LojaFeminina/Financeiro'
import Relatorios from './Relatorios'
import ModoVisualizacao from './ModoVisualizacao'
import UpgradeWall from '../../components/UpgradeWall'
import { temAcesso } from '../../utils/planos'

export default function LojaMercado({ lojaId = 'mercadodemo' }) {
  const data = useLojaData(lojaId)
  useLojaTheme(data.config)
  const { viewMode, setViewMode } = useViewMode()
  const [tab, setTab] = useState('inicio')

  useEffect(() => {
    if (!data.loading) data.ensureDefaults?.()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.loading])

  if (data.loading) {
    return (
      <div style={{ minHeight: '100dvh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '2.5px solid #17864F', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const panels = {
    inicio:    <Menu vendas={data.vendas} produtosData={data.produtosData} fiado={data.fiado} config={data.config} setTab={setTab} />,
    venda:     <NovaVenda produtosData={data.produtosData} addVenda={data.addVenda} addFiadoCompra={data.addFiadoCompra} clientes={data.clientes} buscarPorEan={data.buscarPorEan} vendas={data.vendas} precosFaixas={data.precosFaixas} fetchAll={data.fetchAll} config={data.config} features={data.features} setTab={setTab} />,
    cadastrar: <CadastrarProduto addProduto={data.addProduto} addPrecosFaixas={data.addPrecosFaixas} features={data.features} setTab={setTab} />,
    estoque:   <Estoque produtosData={data.produtosData} vendas={data.vendas} setTab={setTab} />,
    'contar-estoque': <ContarEstoque lojaId={lojaId} config={data.config} fetchAll={data.fetchAll} buscarPorEan={data.buscarPorEan} setTab={setTab} />,
    'lista-compras': <ListaCompras produtosData={data.produtosData} vendas={data.vendas} config={data.config} setTab={setTab} />,
    validade:  <Validade produtosData={data.produtosData} setTab={setTab} />,
    promocao:  <Promocao produtosData={data.produtosData} config={data.config} setTab={setTab} />,
    fiado:     <Fiado fiado={data.fiado} clientes={data.clientes} config={data.config} setTab={setTab} addFiadoCompra={data.addFiadoCompra} addFiadoPagamento={data.addFiadoPagamento} />,
    importar:  <ImportarProdutos importarProdutos={data.importarProdutos} setTab={setTab} />,
    caixa:     <Caixa vendas={data.vendas} saidas={data.saidas} caixas={data.caixas} contas={data.contas} config={data.config} setTab={setTab} addSaida={data.addSaida} fecharCaixa={data.fecharCaixa} />,
    ajuda:     <Ajuda setTab={setTab} />,
    relatorios: <Relatorios vendas={data.vendas} setTab={setTab} />,
    // Business puro: sem `legado ||`, porque não existe loja de Mercado
    // legada — o segmento nasceu depois da régua de planos.
    financeiro: temAcesso(data.config?.plano || 'starter', 'business')
      ? (
        <>
          <div style={{ background: 'var(--bg, #FFFFFF)', padding: '18px 22px 6px' }}>
            <button onClick={() => setTab('inicio')} style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', padding: 0, color: '#3F3F46',
              fontSize: 17, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif',
            }}>
              <ChevronLeft size={24} strokeWidth={2.5} />
              Menu
            </button>
          </div>
          <div style={{ padding: '10px 16px 40px' }}>
            <Financeiro lojaId={lojaId} vendas={data.vendas} theme={{ primary: '#17864F' }} />
          </div>
        </>
      )
      : <UpgradeWall planoAtual={data.config?.plano || 'starter'} planoNecessario="business" funcionalidade="financeiro" theme={{ primary: '#17864F' }} onVoltar={() => setTab('inicio')} segmento={data.config?.segmento || 'mercado'} />,
    rede:      <UpgradeWall planoAtual={data.config?.plano || 'starter'} planoNecessario="business" funcionalidade="rede" theme={{ primary: '#18181B' }} onVoltar={() => setTab('inicio')} segmento={data.config?.segmento || 'mercado'} />,
    mais: (
      <>
        {/* LojaConfig.jsx (compartilhado com a Moda) não tem cabeçalho próprio
            nem botão de voltar — sem isso o usuário ficava preso na tela.
            Adicionado aqui, fora do arquivo compartilhado, mesmo padrão
            "← Menu" já usado nas outras telas do Mercado. */}
        <div style={{ background: 'var(--bg, #FFFFFF)', padding: '18px 22px 6px' }}>
          <button onClick={() => setTab('inicio')} style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', padding: 0, color: '#3F3F46',
            fontSize: 17, fontWeight: 800, fontFamily: 'Plus Jakarta Sans, sans-serif',
          }}>
            <ChevronLeft size={24} strokeWidth={2.5} />
            Menu
          </button>
        </div>
        <LojaConfig config={data.config} features={data.features} saveConfig={data.saveConfig} theme={{ primary: '#5E2BD0' }} hideFeatureToggles />
        <div style={{ background: 'var(--bg)', padding: '0 16px 32px' }}>
          <ModoVisualizacao viewMode={viewMode} setViewMode={setViewMode} theme={{ primary: '#5E2BD0' }} />
        </div>
      </>
    ),
  }

  // "Celular" no toggle de Modo de visualização (Login.jsx, compartilhado com
  // a Moda) força largura de telefone mesmo em tela grande. Diferente da
  // Moda, não trocamos de componente — o Mercado já é responsivo desde a
  // Fase 1, mas cada tela decide mobile-vs-desktop via @media (min-width:
  // 1024px), que olha pro VIEWPORT real do navegador, não pra largura deste
  // container. Por isso só encolher a largura aqui não bastava (telas
  // continuavam recebendo o CSS de desktop). A correção: containerType
  // abaixo estabelece este <div> como contexto de Container Query, e cada
  // tela do Mercado usa @container (min-width: 1024px) em vez de @media —
  // aí a decisão passa a olhar pra largura DESTE elemento, não do viewport.
  //
  // useViewMode() cai em 'mobile' por padrão quando nada foi escolhido
  // (localStorage.getItem(KEY) || 'mobile') — faz sentido pra Moda, onde
  // 'mobile' já É o comportamento padrão dela. Pro Mercado isso inverteria
  // o requisito ("nada escolhido = comportamento atual"): todo usuário
  // novo forçaria 480px sem nunca ter tocado no toggle. Por isso só força
  // quando existe de fato uma escolha salva no localStorage.
  const escolhaSalva = typeof window !== 'undefined' && localStorage.getItem('junttos_viewMode') !== null
  const forcarMobile = escolhaSalva && viewMode === 'mobile'

  return (
    <div style={{
      minHeight: '100dvh', background: '#FFFFFF',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      overflowX: 'hidden', boxSizing: 'border-box',
      WebkitFontSmoothing: 'antialiased',
      containerType: 'inline-size',
      ...(forcarMobile
        ? { maxWidth: 480, margin: '0 auto' }
        : { maxWidth: '100vw' }),
    }}>
      {panels[tab] || panels.inicio}
    </div>
  )
}
