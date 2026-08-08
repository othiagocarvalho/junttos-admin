import { useMemo } from 'react'
import { ChevronLeft, CalendarCheck } from 'lucide-react'
import { agruparPorValidade, DIAS_ATENCAO } from '../../utils/validade'
import { estoqueAtual } from '../../utils/estoque'

const LARANJA = '#E07A0C'

// ── Item da lista ─────────────────────────────────────────────
function ItemValidade({ item }) {
  const urgente = item.estado === 'urgente'
  const unidades = estoqueAtual(item.produto)

  return (
    <div className="val-item" style={{
      background: urgente ? '#FFF1EC' : '#F4F4F7', borderRadius: 18,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      {/* Bloco de data 60×60 — tingido quando urgente, branco quando neutro */}
      <div style={{
        width: 60, height: 60, borderRadius: 16, flexShrink: 0,
        background: urgente ? item.cor : '#FFFFFF',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 21, fontWeight: 800, color: urgente ? '#FFFFFF' : '#52525B', lineHeight: 1 }}>
          {item.bloco?.dia}
        </span>
        <span style={{ fontSize: 12, fontWeight: 800, color: urgente ? 'rgba(255,255,255,.85)' : '#52525B', lineHeight: 1, marginTop: 2 }}>
          {item.bloco?.mes}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 18, fontWeight: 800, color: '#18181B', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{item.produto.nome}</p>
        <p style={{ fontSize: 16, fontWeight: 800, color: item.cor, margin: '4px 0 0' }}>
          {item.texto} · {unidades} un.
        </p>
      </div>
    </div>
  )
}

function Secao({ rotulo, cor, itens }) {
  if (!itens.length) return null
  return (
    <div className="val-secao">
      <p className="val-rotulo" style={{ fontSize: 17, fontWeight: 800, color: cor, margin: '0 0 10px' }}>
        {rotulo}
      </p>
      <div className="val-itens" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {itens.map(item => <ItemValidade key={item.produto.id} item={item} />)}
      </div>
    </div>
  )
}

export default function Validade({ produtosData = [], setTab }) {
  const { urgente, atencao } = useMemo(() => agruparPorValidade(produtosData), [produtosData])
  const total = urgente.length + atencao.length

  // Quantos produtos têm alguma data cadastrada — separa "nada vencendo" de
  // "ninguém preencheu validade ainda", que pedem mensagens diferentes.
  const comData = (produtosData || []).filter(p => p?.data_vencimento).length

  return (
    <div className="val-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first: o estilo inline é o mobile (T7) — faixa laranja cheia,
        seções em coluna única. A partir de 1024px vale o princípio do D1:
        fundo branco, cor só em elementos-chave (estado do item e ação
        primária), conteúdo centralizado e blocos que não esticam.
        O !important é necessário porque estilo inline vence folha de estilo —
        mesmo padrão de components/Layout.jsx.
      */}
      <style>{`
        /* --- Base (mobile) --- */
        /* Altura travada no viewport para a lista rolar por dentro e o rodapé
           ficar fixo — mesmo motivo da tela de Estoque. */
        .val-root  { height: 100dvh; }
        .val-shell { display: contents; }

        /* --- Desktop --- */
        @container (min-width: 1024px) {
          .val-root { height: auto; min-height: 100dvh; }

          .val-shell {
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

          /* A faixa laranja vira cabeçalho neutro */
          .val-faixa {
            background: #FFFFFF !important;
            padding: 0 0 24px !important;
          }
          .val-voltar     { color: #71717A !important; }
          .val-voltar svg { stroke: #71717A !important; }
          .val-titulo     { font-size: 34px !important; color: #18181B !important; }
          .val-sub        { color: #71717A !important; opacity: 1 !important; }

          /* Seções lado a lado; itens em 2 colunas dentro de cada uma */
          .val-conteudo {
            padding: 0 !important;
            overflow: visible !important;
          }
          .val-secao + .val-secao { margin-top: 26px !important; }
          .val-itens {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            align-content: start;
          }

          /* Rodapé compacto à direita */
          .val-rodape {
            padding: 24px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .val-rodape button { flex: 0 0 auto !important; min-width: 260px; }
        }
      `}</style>

      <div className="val-shell">
        {/* Faixa */}
        <div className="val-faixa" style={{ background: LARANJA, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="val-voltar"
            onClick={() => setTab('inicio')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Menu
          </button>

          <p className="val-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Validade
          </p>
          <p className="val-sub" style={{ fontSize: 17, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
            {total} produto{total === 1 ? '' : 's'} vencendo esta semana
          </p>
        </div>

        {/* Seções */}
        <div className="val-conteudo" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 22,
        }}>
          <Secao rotulo="Urgente"       cor="#C4321F" itens={urgente} />
          <Secao rotulo="Fique de olho" cor="#71717A" itens={atencao} />

          {total === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8A8A93' }}>
              <CalendarCheck size={40} color="#C4C4CC" strokeWidth={1.8} />
              <p style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 0' }}>
                {comData === 0
                  ? 'Nenhum produto com validade cadastrada'
                  : `Nada vencendo nos próximos ${DIAS_ATENCAO} dias`}
              </p>
              <p style={{ fontSize: 15, margin: '4px 0 0' }}>
                {comData === 0
                  ? 'Informe a validade no cadastro do produto para acompanhar aqui.'
                  : 'Tudo em dia por enquanto.'}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="val-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          <button onClick={() => setTab('promocao')} style={{
            flex: 1, height: 72, minHeight: 72, borderRadius: 18, border: 'none',
            background: LARANJA, color: '#FFFFFF', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            Colocar em promoção
          </button>
        </div>
      </div>
    </div>
  )
}
