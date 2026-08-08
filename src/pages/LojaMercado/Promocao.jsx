import { useState, useMemo } from 'react'
import { ChevronLeft, Tag, MessageCircle } from 'lucide-react'
import { agruparPorValidade } from '../../utils/validade'

const LARANJA = '#E07A0C'

function fmtR(v) {
  return 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
const DESCONTOS_RAPIDOS = [10, 20, 30, 50]
const DESCONTO_PADRAO = 20

function precoPromo(precoAtual, desconto) {
  return Math.max(0, precoAtual * (1 - desconto / 100))
}

function ItemPromocao({ item, desconto, onDesconto }) {
  const preco = Number(item.produto.preco_venda) || 0
  const promo = precoPromo(preco, desconto)

  return (
    <div className="pr-item" style={{
      background: '#F4F4F7', borderRadius: 18, padding: '14px 16px',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: item.estado === 'urgente' ? item.cor : '#FFFFFF',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: item.estado === 'urgente' ? '#FFFFFF' : '#52525B', lineHeight: 1 }}>
            {item.bloco?.dia}
          </span>
          <span style={{ fontSize: 10, fontWeight: 800, color: item.estado === 'urgente' ? 'rgba(255,255,255,.85)' : '#52525B', lineHeight: 1, marginTop: 2 }}>
            {item.bloco?.mes}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.produto.nome}
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: item.cor, margin: '2px 0 0' }}>{item.texto}</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div>
          <span style={{ fontSize: 13, color: '#A1A1AA', textDecoration: 'line-through' }}>{fmtR(preco)}</span>
          <span style={{ fontSize: 17, fontWeight: 800, color: '#17864F', marginLeft: 8 }}>{fmtR(promo)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DESCONTOS_RAPIDOS.map(d => (
            <button key={d} onClick={() => onDesconto(d)} style={{
              padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 800, fontFamily: 'inherit',
              background: desconto === d ? LARANJA : '#FFFFFF',
              color: desconto === d ? '#FFFFFF' : '#71717A',
            }}>
              {d}%
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Gera um texto de anúncio pra WhatsApp com os produtos vencendo e um
 * desconto sugerido — não grava nada em lf_produtos.preco_venda. Mesma
 * lógica de agrupamento de Validade.jsx (utils/validade.js), mesmo padrão
 * de export wa.me/?text= já usado em ListaCompras.jsx/Caixa.jsx.
 */
export default function Promocao({ produtosData = [], config = {}, setTab }) {
  const { urgente, atencao } = useMemo(() => agruparPorValidade(produtosData), [produtosData])
  const todosItens = useMemo(() => [...urgente, ...atencao], [urgente, atencao])

  const [descontos, setDescontos] = useState({}) // produto.id -> %

  function descontoDe(item) {
    return descontos[item.produto.id] ?? DESCONTO_PADRAO
  }
  function setDesconto(produtoId, valor) {
    setDescontos(prev => ({ ...prev, [produtoId]: valor }))
  }

  const texto = encodeURIComponent(
    `🔥 Promoção${config?.nome ? ` — ${config.nome}` : ''} — vencendo, aproveita!\n\n` +
    todosItens.map(item => {
      const preco = Number(item.produto.preco_venda) || 0
      const d = descontoDe(item)
      return `• ${item.produto.nome} — de ${fmtR(preco)} por ${fmtR(precoPromo(preco, d))} (${item.texto.toLowerCase()})`
    }).join('\n')
  )

  return (
    <div className="pr-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/* Mesmo padrão responsivo de Validade.jsx/Estoque.jsx/ListaCompras.jsx. */}
      <style>{`
        .pr-root  { height: 100dvh; }
        .pr-shell { display: contents; }

        @container (min-width: 1024px) {
          .pr-root { height: auto; min-height: 100dvh; }

          .pr-shell {
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

          .pr-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .pr-voltar     { color: #71717A !important; }
          .pr-voltar svg { stroke: #71717A !important; }
          .pr-titulo     { font-size: 34px !important; color: #18181B !important; }
          .pr-sub        { color: #71717A !important; opacity: 1 !important; }

          .pr-corpo { padding: 0 !important; overflow: visible !important; }
          .pr-secao + .pr-secao { margin-top: 26px !important; }
          .pr-itens {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            align-content: start;
          }

          .pr-rodape {
            padding: 22px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .pr-rodape a { flex: 0 0 auto !important; min-width: 280px; }
        }
      `}</style>

      <div className="pr-shell">
        {/* Faixa */}
        <div className="pr-faixa" style={{ background: LARANJA, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="pr-voltar"
            onClick={() => setTab('validade')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Validade
          </button>

          <p className="pr-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Colocar em promoção
          </p>
          <p className="pr-sub" style={{ fontSize: 17, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
            {todosItens.length} produto{todosItens.length === 1 ? '' : 's'} vencendo — ajuste o desconto e anuncie
          </p>
        </div>

        {/* Conteúdo */}
        <div className="pr-corpo" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>
          {urgente.length > 0 && (
            <div className="pr-secao">
              <p style={{ fontSize: 17, fontWeight: 800, color: '#C4321F', margin: '0 0 10px' }}>Urgente</p>
              <div className="pr-itens" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {urgente.map(item => (
                  <ItemPromocao key={item.produto.id} item={item} desconto={descontoDe(item)} onDesconto={d => setDesconto(item.produto.id, d)} />
                ))}
              </div>
            </div>
          )}
          {atencao.length > 0 && (
            <div className="pr-secao">
              <p style={{ fontSize: 17, fontWeight: 800, color: '#71717A', margin: '0 0 10px' }}>Fique de olho</p>
              <div className="pr-itens" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {atencao.map(item => (
                  <ItemPromocao key={item.produto.id} item={item} desconto={descontoDe(item)} onDesconto={d => setDesconto(item.produto.id, d)} />
                ))}
              </div>
            </div>
          )}

          {todosItens.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8A8A93' }}>
              <Tag size={40} color="#C4C4CC" strokeWidth={1.8} />
              <p style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 0' }}>Nada vencendo</p>
              <p style={{ fontSize: 15, margin: '4px 0 0' }}>Sem produtos pra colocar em promoção no momento.</p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        {todosItens.length > 0 && (
          <div className="pr-rodape" style={{
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
              Enviar promoção no WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
