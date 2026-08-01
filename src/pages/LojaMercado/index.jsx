import { useState, useEffect } from 'react'
import { useLojaData } from './useLojaData'
import { useLojaTheme } from '../../hooks/useLojaTheme'
import Menu from './Menu'
import CadastrarProduto from './CadastrarProduto'
import Estoque from './Estoque'
import NovaVenda from './NovaVenda'
import LojaConfig from '../LojaFeminina/LojaConfig'

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
    inicio:    <Menu vendas={data.vendas} config={data.config} setTab={setTab} />,
    venda:     <NovaVenda produtosData={data.produtosData} addVenda={data.addVenda} buscarPorEan={data.buscarPorEan} vendas={data.vendas} fetchAll={data.fetchAll} config={data.config} setTab={setTab} />,
    cadastrar: <CadastrarProduto addProduto={data.addProduto} setTab={setTab} />,
    estoque:   <Estoque produtosData={data.produtosData} vendas={data.vendas} setTab={setTab} />,
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
