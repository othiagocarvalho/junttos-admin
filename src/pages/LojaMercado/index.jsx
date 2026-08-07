import { useState, useEffect } from 'react'
import { useLojaData } from './useLojaData'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import Menu from './Menu'
import CadastrarProduto from './CadastrarProduto'
import Estoque from './Estoque'
import ContarEstoque from './ContarEstoque'
import ListaCompras from './ListaCompras'
import Validade from './Validade'
import Fiado from './Fiado'
import ImportarProdutos from './ImportarProdutos'
import Caixa from './Caixa'
import NovaVenda from './NovaVenda'
import Ajuda from './Ajuda'
import LojaConfig from '../LojaFeminina/LojaConfig'
import UpgradeWall from '../../components/UpgradeWall'

export default function LojaMercado({ lojaId = 'mercadodemo' }) {
  const data = useLojaData(lojaId)
  useLojaTheme(data.config)
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
    venda:     <NovaVenda produtosData={data.produtosData} addVenda={data.addVenda} buscarPorEan={data.buscarPorEan} vendas={data.vendas} precosFaixas={data.precosFaixas} fetchAll={data.fetchAll} config={data.config} features={data.features} setTab={setTab} />,
    cadastrar: <CadastrarProduto addProduto={data.addProduto} addPrecosFaixas={data.addPrecosFaixas} features={data.features} setTab={setTab} />,
    estoque:   <Estoque produtosData={data.produtosData} vendas={data.vendas} setTab={setTab} />,
    'contar-estoque': <ContarEstoque lojaId={lojaId} config={data.config} fetchAll={data.fetchAll} buscarPorEan={data.buscarPorEan} setTab={setTab} />,
    'lista-compras': <ListaCompras produtosData={data.produtosData} vendas={data.vendas} config={data.config} setTab={setTab} />,
    validade:  <Validade produtosData={data.produtosData} setTab={setTab} />,
    fiado:     <Fiado fiado={data.fiado} clientes={data.clientes} config={data.config} setTab={setTab} addFiadoCompra={data.addFiadoCompra} addFiadoPagamento={data.addFiadoPagamento} />,
    importar:  <ImportarProdutos importarProdutos={data.importarProdutos} setTab={setTab} />,
    caixa:     <Caixa vendas={data.vendas} saidas={data.saidas} caixas={data.caixas} contas={data.contas} config={data.config} setTab={setTab} addSaida={data.addSaida} fecharCaixa={data.fecharCaixa} />,
    ajuda:     <Ajuda setTab={setTab} />,
    rede:      <UpgradeWall planoAtual={data.config?.plano || 'starter'} planoNecessario="business" funcionalidade="rede" theme={{ primary: '#18181B' }} onVoltar={() => setTab('inicio')} />,
    mais:      <LojaConfig config={data.config} features={data.features} saveConfig={data.saveConfig} theme={{ primary: '#5E2BD0' }} />,
  }

  return (
    <div style={{
      minHeight: '100dvh', background: '#FFFFFF',
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box',
      WebkitFontSmoothing: 'antialiased',
    }}>
      {panels[tab] || panels.inicio}
    </div>
  )
}
