import { useMemo, useState } from 'react'
import { ChevronLeft, Search, PackageSearch, FileSpreadsheet } from 'lucide-react'
import { mediaDiariaPorNome, nivelDoProduto, COR_NIVEL } from '../../utils/estoque'

const AZUL = '#1E63C8'

// ── Item da lista ─────────────────────────────────────────────
function ItemEstoque({ produto, nivel }) {
  return (
    <div className="est-item" style={{
      background: '#FFFFFF', border: `2px solid ${nivel.cor}`, borderRadius: 18,
      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 18, fontWeight: 800, color: '#18181B', margin: '0 0 10px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{produto.nome}</p>

        {/* Barra de nível — largura = atual/mínimo, teto 100% */}
        <div style={{ height: 8, background: '#F1F1F4', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${nivel.pct}%`, background: nivel.cor, borderRadius: 999 }} />
        </div>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 24, fontWeight: 800, color: nivel.cor, margin: 0, lineHeight: 1 }}>{nivel.atual}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#A1A1AA', margin: '2px 0 0' }}>de {nivel.minimo}</p>
      </div>
    </div>
  )
}

export default function Estoque({ produtosData = [], vendas = [], setTab }) {
  const [busca, setBusca] = useState('')

  const medias = useMemo(() => mediaDiariaPorNome(vendas), [vendas])

  // Ativos primeiro, mais crítico no topo — quem precisa de compra aparece antes.
  const lista = useMemo(() => {
    return (produtosData || [])
      .filter(p => p?.ativo !== false)
      .map(p => ({ produto: p, nivel: nivelDoProduto(p, medias[p.nome] || 0) }))
      .sort((a, b) => a.nivel.razao - b.nivel.razao)
  }, [produtosData, medias])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return lista
    return lista.filter(({ produto }) =>
      (produto.nome || '').toLowerCase().includes(q) ||
      (produto.ean || '').toLowerCase().includes(q)
    )
  }, [lista, busca])

  const acabando = lista.filter(i => i.nivel.estado !== 'ok').length

  return (
    <div className="est-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first: o estilo inline de cada elemento é o mobile (T6) — faixa
        azul cheia, lista em coluna única. A partir de 1024px vale o mesmo
        princípio do D1: fundo branco, cor só em elementos-chave (estado do
        item e ação primária), conteúdo centralizado com largura máxima e
        cartões que não esticam. O !important é necessário porque estilo inline
        vence folha de estilo — mesmo padrão de components/Layout.jsx.
      */}
      <style>{`
        /* --- Base (mobile) --- */
        /* Altura travada no viewport: é o que faz a lista rolar por dentro e o
           rodapé ficar fixo no rodapé da tela. Com min-height o root crescia
           junto com a lista e as ações saíam da área visível. */
        .est-root  { height: 100dvh; }
        .est-shell { display: contents; }

        /* --- Desktop --- */
        @container (min-width: 1024px) {
          /* No desktop a página rola inteira: a lista em grade cresce e o
             rodapé vem depois dela, sem scroll interno. */
          .est-root { height: auto; min-height: 100dvh; }

          .est-shell {
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

          /* A faixa azul vira cabeçalho neutro: cor sai do fundo e fica só
             nos estados dos itens e no botão primário. */
          .est-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .est-voltar     { color: #71717A !important; }
          .est-voltar svg { stroke: #71717A !important; }
          .est-titulo     { font-size: 34px !important; color: #18181B !important; }
          .est-busca {
            background: #F4F4F7 !important;
            border: 1.5px solid #E3E3E9 !important;
            max-width: 420px;
          }
          .est-busca input        { color: #18181B !important; }
          .est-busca input::placeholder { color: #8A8A93 !important; opacity: 1 !important; }
          .est-busca svg          { stroke: #8A8A93 !important; }
          .est-importar {
            border: 1.5px solid #E4E4E8 !important;
            background: #F4F4F7 !important;
            color: #3F3F46 !important;
          }
          .est-importar svg { stroke: #3F3F46 !important; }

          /* Alerta deixa de ser barra cheia e vira cartão contido */
          .est-alerta {
            border-radius: 18px !important;
            padding: 18px 22px !important;
            margin: 0 0 20px !important;
          }

          /* Lista em 2 colunas — cartões com altura própria, sem esticar */
          .est-lista {
            padding: 0 !important;
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            align-content: start;
            overflow: visible !important;
          }

          /* Rodapé compacto à direita, só a ação primária colorida */
          .est-rodape {
            padding: 22px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .est-rodape button { flex: 0 0 auto !important; min-width: 190px; }
        }
      `}</style>

      <div className="est-shell">
        {/* Faixa */}
        <div className="est-faixa" style={{ background: AZUL, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="est-voltar"
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

          <p className="est-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 14px' }}>
            Estoque
          </p>

          <div className="est-busca" style={{
            height: 56, borderRadius: 16, background: 'rgba(255,255,255,.18)',
            display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', boxSizing: 'border-box',
          }}>
            <Search size={20} color="#FFFFFF" strokeWidth={2.4} style={{ flexShrink: 0, opacity: .9 }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto"
              style={{
                flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none',
                fontSize: 18, fontWeight: 700, color: '#FFFFFF', opacity: .9, fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Ação secundária: importar em lote. Fica aqui, e não no rodapé,
              porque o rodapé é definido pela spec T6 (Contar estoque / Lista
              de compras) e não deve ganhar um terceiro botão. */}
          <button
            className="est-importar"
            onClick={() => setTab('importar')}
            style={{
              marginTop: 12, height: 44, borderRadius: 12, cursor: 'pointer',
              border: '1.5px solid rgba(255,255,255,.35)', background: 'rgba(255,255,255,.12)',
              color: '#FFFFFF', fontSize: 15, fontWeight: 800, fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 16px',
            }}
          >
            <FileSpreadsheet size={17} strokeWidth={2.3} />
            Importar planilha
          </button>
        </div>

        {/* Barra de alerta — só quando há algo acabando */}
        {acabando > 0 && (
          <div className="est-alerta" style={{
            background: '#FFF1EC', padding: '18px 22px', display: 'flex', alignItems: 'center',
            gap: 14, flexShrink: 0,
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', background: COR_NIVEL.critico, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF' }}>{acabando}</span>
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 19, fontWeight: 800, color: '#8A3427', margin: 0 }}>
                produto{acabando === 1 ? '' : 's'} est{acabando === 1 ? 'á' : 'ão'} acabando
              </p>
              <p style={{ fontSize: 15, color: '#8A3427', margin: '2px 0 0' }}>Precisa comprar mais</p>
            </div>
          </div>
        )}

        {/* Lista */}
        <div className="est-lista" style={{
          flex: 1, minHeight: 0, overflowY: 'auto',
          padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {filtrados.map(({ produto, nivel }) => (
            <ItemEstoque key={produto.id} produto={produto} nivel={nivel} />
          ))}

          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8A8A93' }}>
              <PackageSearch size={40} color="#C4C4CC" strokeWidth={1.8} />
              <p style={{ fontSize: 17, fontWeight: 700, margin: '12px 0 0' }}>
                {busca ? `Nada encontrado para "${busca}"` : 'Nenhum produto cadastrado'}
              </p>
              {!busca && (
                <p style={{ fontSize: 15, margin: '4px 0 0' }}>
                  Cadastre produtos para acompanhar o estoque.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="est-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex', gap: 12,
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          <button onClick={() => setTab('contar-estoque')} style={{
            flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
            background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            Contar estoque
          </button>
          <button onClick={() => setTab('lista-compras')} style={{
            flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
            background: AZUL, color: '#FFFFFF', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            Lista de compras
          </button>
        </div>
      </div>
    </div>
  )
}
