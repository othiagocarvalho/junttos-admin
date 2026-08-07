import { useMemo } from 'react'
import { ChevronLeft, ShoppingCart, MessageCircle } from 'lucide-react'
import { mediaDiariaPorNome, nivelDoProduto, COR_NIVEL } from '../../utils/estoque'

const AZUL = '#1E63C8'

function ItemCompra({ produto, nivel }) {
  const faltam = Math.max(0, nivel.minimo - nivel.atual)
  return (
    <div className="lc-item" style={{
      background: '#FFFFFF', border: `2px solid ${nivel.cor}`, borderRadius: 18,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 18, fontWeight: 800, color: '#18181B', margin: '0 0 4px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{produto.nome}</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: nivel.cor, margin: 0 }}>
          {nivel.estado === 'critico' ? 'Crítico' : 'Baixo'} · tem {nivel.atual}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: nivel.cor, margin: 0, lineHeight: 1 }}>{faltam}</p>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#A1A1AA', margin: '2px 0 0' }}>comprar</p>
      </div>
    </div>
  )
}

/**
 * Deriva a lista de compras da mesma lógica de nível já usada em Estoque.jsx
 * (utils/estoque.js) — sem query nova, sem escrita no banco. Mostra só
 * crítico/baixo, ordenado por criticidade (mesma ordenação de Estoque.jsx).
 */
export default function ListaCompras({ produtosData = [], vendas = [], config = {}, setTab }) {
  const medias = useMemo(() => mediaDiariaPorNome(vendas), [vendas])

  const itens = useMemo(() => {
    return (produtosData || [])
      .filter(p => p?.ativo !== false)
      .map(p => ({ produto: p, nivel: nivelDoProduto(p, medias[p.nome] || 0) }))
      .filter(i => i.nivel.estado !== 'ok')
      .sort((a, b) => a.nivel.razao - b.nivel.razao)
  }, [produtosData, medias])

  const criticos = itens.filter(i => i.nivel.estado === 'critico')
  const baixos = itens.filter(i => i.nivel.estado === 'baixo')

  const texto = encodeURIComponent(
    `Lista de compras${config?.nome ? ` — ${config.nome}` : ''}\n\n` +
    itens.map(i => `• ${i.produto.nome} — comprar ${Math.max(0, i.nivel.minimo - i.nivel.atual)} (tem ${i.nivel.atual})`).join('\n')
  )

  return (
    <div className="lc-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/* Mesmo padrão responsivo de Estoque.jsx/ContarEstoque.jsx. */}
      <style>{`
        .lc-root  { height: 100dvh; }
        .lc-shell { display: contents; }

        @media (min-width: 1024px) {
          .lc-root { height: auto; min-height: 100dvh; }

          .lc-shell {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            width: 100%;
            max-width: 1160px;
            margin: 0 auto;
            padding: 30px 40px 34px;
            box-sizing: border-box;
          }

          .lc-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .lc-voltar     { color: #71717A !important; }
          .lc-voltar svg { stroke: #71717A !important; }
          .lc-titulo     { font-size: 34px !important; color: #18181B !important; }
          .lc-sub        { color: #71717A !important; opacity: 1 !important; }

          .lc-corpo { padding: 0 !important; overflow: visible !important; }
          .lc-secao + .lc-secao { margin-top: 26px !important; }
          .lc-itens {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            align-content: start;
          }

          .lc-rodape {
            padding: 22px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .lc-rodape a { flex: 0 0 auto !important; min-width: 280px; }
        }
      `}</style>

      <div className="lc-shell">
        {/* Faixa */}
        <div className="lc-faixa" style={{ background: AZUL, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="lc-voltar"
            onClick={() => setTab('estoque')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Estoque
          </button>

          <p className="lc-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Lista de compras
          </p>
          <p className="lc-sub" style={{ fontSize: 17, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
            {itens.length} produto{itens.length === 1 ? '' : 's'} precisa{itens.length === 1 ? '' : 'm'} de reposição
          </p>
        </div>

        {/* Conteúdo */}
        <div className="lc-corpo" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>
          {criticos.length > 0 && (
            <div className="lc-secao">
              <p style={{ fontSize: 17, fontWeight: 800, color: COR_NIVEL.critico, margin: '0 0 10px' }}>Crítico</p>
              <div className="lc-itens" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {criticos.map(({ produto, nivel }) => <ItemCompra key={produto.id} produto={produto} nivel={nivel} />)}
              </div>
            </div>
          )}
          {baixos.length > 0 && (
            <div className="lc-secao">
              <p style={{ fontSize: 17, fontWeight: 800, color: COR_NIVEL.baixo, margin: '0 0 10px' }}>Baixo</p>
              <div className="lc-itens" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {baixos.map(({ produto, nivel }) => <ItemCompra key={produto.id} produto={produto} nivel={nivel} />)}
              </div>
            </div>
          )}

          {itens.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8A8A93' }}>
              <ShoppingCart size={40} color="#C4C4CC" strokeWidth={1.8} />
              <p style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 0' }}>Tudo em dia</p>
              <p style={{ fontSize: 15, margin: '4px 0 0' }}>Nenhum produto crítico ou baixo no momento.</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {itens.length > 0 && (
          <div className="lc-rodape" style={{
            padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
            flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
          }}>
            <a
              href={`https://wa.me/?text=${texto}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                flex: 1, height: 68, minHeight: 68, borderRadius: 18, background: '#25D366',
                color: '#FFFFFF', textDecoration: 'none', fontSize: 18, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <MessageCircle size={20} strokeWidth={2.2} />
              Enviar lista no WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
