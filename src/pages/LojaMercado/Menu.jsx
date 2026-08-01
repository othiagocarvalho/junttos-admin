import { Barcode, Camera, Package, CalendarClock, Receipt, Wallet } from 'lucide-react'
import Logo from '../../components/junttos/Logo'
import { parsePgtosRecibo } from '../../utils/recibo'
import { mediaDiariaPorNome, nivelDoProduto } from '../../utils/estoque'
import { agruparPorValidade } from '../../utils/validade'
import { agruparPorCliente, totaisFiado } from '../../utils/fiado'

function fmtK(v) {
  if (v === 0) return 'R$ 0'
  if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1).replace('.', ',').replace(',0', '') + 'k'
  return 'R$ ' + Math.round(v)
}

// Os contadores dos blocos eram fixos (6 e 4, placeholders da Fase 1). Agora
// que Estoque e Validade têm tela própria, vêm da mesma lógica que elas usam —
// senão o Menu anunciaria um número e a tela mostraria outro.

// Soma o valor de uma forma de pagamento específica dentro das vendas do dia.
// O PDV grava forma_pgto como JSON [{forma, valor}] com Dinheiro/Pix/Cartão/Fiado
// (NovaVenda.jsx:130); parsePgtosRecibo também cobre o formato legado em string.
function somaPorForma(vendas, forma) {
  return vendas.reduce((total, venda) => {
    const doDia = parsePgtosRecibo(venda).filter(p => p.forma === forma)
    return total + doDia.reduce((s, p) => s + Number(p.valor || 0), 0)
  }, 0)
}

function IconBox({ children }) {
  return (
    <div className="mkt-icone" style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </div>
  )
}

// Linha de contexto do bloco — só aparece no desktop (D1). No mobile o CSS
// esconde, mantendo a grade colorida exatamente como já era.
function Ctx({ children }) {
  return (
    <p className="mkt-ctx" style={{ fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,.88)', margin: '6px 0 0' }}>
      {children}
    </p>
  )
}

function Metrica({ label, valor, cor = '#18181B' }) {
  return (
    <div>
      <p style={{ fontSize: 12, fontWeight: 800, color: '#8A8A93', margin: 0, textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: cor, margin: '2px 0 0' }}>{valor}</p>
    </div>
  )
}

export default function Menu({ vendas = [], produtosData = [], fiado = [], config = {}, setTab }) {
  const now = new Date()
  const todayStr = now.toDateString()
  const vendasHoje = vendas.filter(v => new Date(v.data).toDateString() === todayStr)
  const totalHoje = vendasHoje.reduce((s, v) => s + Number(v.valor), 0)
  const noCaixa   = somaPorForma(vendasHoje, 'Dinheiro')  // dinheiro físico do dia
  const fiadoHoje = somaPorForma(vendasHoje, 'Fiado')     // vendas sem baixa financeira
  const medias = mediaDiariaPorNome(vendas)
  const qtdEstoqueBaixo = (produtosData || [])
    .filter(p => p?.ativo !== false)
    .filter(p => nivelDoProduto(p, medias[p.nome] || 0).estado !== 'ok').length

  const grupos = agruparPorValidade(produtosData)
  const qtdVencendo = grupos.urgente.length + grupos.atencao.length

  const contasFiado = agruparPorCliente(fiado)
  const qtdDevendo  = contasFiado.filter(c => c.devendo).length
  const totalFiado  = totaisFiado(contasFiado).aReceber

  const nomeLoja = config?.nome || 'Mercado'
  const dayStr = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  const dayCapitalized = dayStr.charAt(0).toUpperCase() + dayStr.slice(1)

  return (
    <div className="mkt-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first (regra 8.1): o mobile é o estilo inline de cada elemento e
        não é tocado aqui. Tudo abaixo de 1024px continua sendo a grade colorida
        de blocos grandes, com "Vender" ocupando 2 colunas e o Caixa no rodapé.
        A partir de 1024px entra o D1 (seção 5): fundo branco, cabeçalho com
        métricas em cartão e grade 3×2 de 6 células distintas — o Caixa sobe do
        rodapé para a grade e nenhum bloco ocupa mais de uma célula.
        O !important é necessário porque estilo inline vence folha de estilo —
        mesmo padrão já usado em components/Layout.jsx.
      */}
      <style>{`
        /* --- Base (mobile) --- */
        .mkt-shell       { display: contents; }
        .mkt-ctx         { display: none; }
        .mkt-metricas    { display: none; }
        .mkt-bloco-caixa { display: none; }

        /* --- D1 · Menu desktop --- */
        @media (min-width: 1024px) {
          .mkt-shell {
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

          /* Cabeçalho: identidade à esquerda, métricas compactas em cartão */
          .mkt-topo {
            padding: 0 0 24px !important;
            justify-content: space-between;
          }
          .mkt-metricas {
            display: flex;
            align-items: center;
            gap: 30px;
            margin-left: auto;
            background: #F4F4F7;
            border-radius: 18px;
            padding: 14px 28px;
          }

          /* Grade 3×2 — 6 células distintas, nenhuma ocupando mais de uma.
             flex 0 0 auto + linhas de altura fixa: no desktop os blocos têm
             tamanho próprio em vez de esticar para preencher a altura da
             janela, que era o que deixava a tela desproporcional. */
          .mkt-grid {
            flex: 0 0 auto !important;
            padding: 0 0 22px !important;
            grid-template-columns: repeat(3, 1fr) !important;
            grid-template-rows: repeat(2, minmax(0, 240px)) !important;
            gap: 20px !important;
          }
          .mkt-bloco-vender { grid-column: auto !important; }
          .mkt-bloco-caixa  { display: flex; }

          /* Blocos menores: raio 26, padding 30, ícone 52, título 34 */
          .mkt-bloco  { border-radius: 26px !important; padding: 30px !important; }
          .mkt-icone  { width: 52px !important; height: 52px !important; border-radius: 16px !important; }
          .mkt-titulo { font-size: 34px !important; line-height: 1.1 !important; }
          .mkt-ctx    { display: block; }

          /* No desktop o título ocupa uma linha só. O espaço antes do <br/> no
             JSX é o que separa as palavras aqui — sem ele viraria "Cadastrarproduto". */
          .mkt-titulo br { display: none; }

          /* Os números do dia já estão no cartão de métricas do cabeçalho, então
             no bloco Vender sobra só a linha de contexto. */
          .mkt-vender-metrica { display: none; }
          .mkt-vender-botoes  { margin-top: auto !important; }
          .mkt-vender-botoes button {
            height: 52px !important;
            min-height: 52px !important;
            font-size: 16px !important;
            border-radius: 14px !important;
          }

          /* Caixa virou bloco da grade; no rodapé fica só o Ajuda */
          .mkt-rodape       { padding: 0 !important; justify-content: flex-end; }
          .mkt-rodape-caixa { display: none !important; }
        }
      `}</style>

      <div className="mkt-shell">
        {/* Topo */}
        <div className="mkt-topo" style={{ padding: '14px 22px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Logo variant="light" size={38} showWordmark={false} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 21, fontWeight: 800, color: '#18181B', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nomeLoja}</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#8A8A93', margin: 0 }}>{dayCapitalized} · caixa aberto</p>
          </div>

          {/* Métricas compactas — desktop */}
          <div className="mkt-metricas">
            <Metrica label="Vendido hoje" valor={fmtK(totalHoje)} />
            <div style={{ width: 1, alignSelf: 'stretch', background: '#E3E3E9' }} />
            <Metrica label="No caixa" valor={fmtK(noCaixa)} />
            <div style={{ width: 1, alignSelf: 'stretch', background: '#E3E3E9' }} />
            <Metrica label="Fiado" valor={fmtK(fiadoHoje)} cor="#5E2BD0" />
          </div>
        </div>

        {/* Grade 2×3 (mobile) / 3×2 (desktop) */}
        <div className="mkt-grid" style={{
          flex: 1, padding: '0 22px 14px', minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1.35fr 1fr 1fr',
          gap: 14,
        }}>
          {/* Vender — span 2 no mobile, 1 célula no desktop */}
          <div className="mkt-bloco mkt-bloco-vender" style={{
            gridColumn: 'span 2', background: '#17864F', borderRadius: 26, padding: '22px 24px',
            display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', top: 22, right: 24, opacity: .85, pointerEvents: 'none' }}>
              <Barcode size={44} color="#FFFFFF" strokeWidth={1.6} />
            </div>
            <p className="mkt-titulo" style={{ fontSize: 34, fontWeight: 800, color: '#FFFFFF', margin: '0 0 4px', lineHeight: 1 }}>Vender</p>
            <p className="mkt-vender-metrica" style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,.88)', margin: '0 0 auto' }}>
              {fmtK(totalHoje)} vendidos hoje · {vendasHoje.length} {vendasHoje.length === 1 ? 'venda' : 'vendas'}
            </p>
            <Ctx>Passar produtos e receber</Ctx>
            <div className="mkt-vender-botoes" style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button
                onClick={() => setTab('venda')}
                style={{
                  flex: 1.5, height: 64, borderRadius: 18, border: 'none', minHeight: 56,
                  background: '#FFFFFF', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  fontSize: 20, fontWeight: 800, color: '#0F5C36',
                }}
              >
                <Camera size={20} color="#0F5C36" strokeWidth={2.2} />
                Bipar agora
              </button>
              <button
                onClick={() => setTab('venda')}
                style={{
                  flex: 1, height: 64, borderRadius: 18, border: 'none', minHeight: 56,
                  background: 'rgba(255,255,255,.2)', cursor: 'pointer',
                  fontSize: 18, fontWeight: 800, color: '#FFFFFF',
                }}
              >
                Digitar
              </button>
            </div>
          </div>

          {/* Cadastrar produto */}
          <div
            className="mkt-bloco"
            onClick={() => setTab('cadastrar')}
            style={{
              background: '#0E7C86', borderRadius: 24, padding: '20px 18px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            }}
          >
            <IconBox>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="4"/>
                <line x1="12" y1="8" x2="12" y2="16"/>
                <line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
            </IconBox>
            <div>
              <p className="mkt-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
                Cadastrar <br/>produto
              </p>
              <Ctx>Bipe o código de barras</Ctx>
            </div>
          </div>

          {/* Estoque */}
          <div className="mkt-bloco" onClick={() => setTab('estoque')} style={{
            background: '#1E63C8', borderRadius: 24, padding: '20px 18px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            position: 'relative', cursor: 'pointer',
          }}>
            <div style={{ position: 'absolute', top: 14, right: 14 }}>
              <span style={{ background: '#FFF', color: '#1E63C8', fontSize: 15, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>{qtdEstoqueBaixo}</span>
            </div>
            <IconBox><Package size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
            <div>
              <p className="mkt-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Estoque</p>
              <Ctx>{qtdEstoqueBaixo} produtos acabando</Ctx>
            </div>
          </div>

          {/* Validade */}
          <div className="mkt-bloco" onClick={() => setTab('validade')} style={{
            background: '#E07A0C', borderRadius: 24, padding: '20px 18px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            position: 'relative', cursor: 'pointer',
          }}>
            <div style={{ position: 'absolute', top: 14, right: 14 }}>
              <span style={{ background: '#FFF', color: '#E07A0C', fontSize: 15, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>{qtdVencendo}</span>
            </div>
            <IconBox><CalendarClock size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
            <div>
              <p className="mkt-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Validade</p>
              <Ctx>{qtdVencendo} itens vencendo em breve</Ctx>
            </div>
          </div>

          {/* Fiado */}
          <div className="mkt-bloco" onClick={() => setTab('fiado')} style={{
            background: '#5E2BD0', borderRadius: 24, padding: '20px 18px',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            position: 'relative', cursor: 'pointer',
          }}>
            {qtdDevendo > 0 && (
              <div style={{ position: 'absolute', top: 14, right: 14 }}>
                <span style={{ background: '#FFF', color: '#5E2BD0', fontSize: 15, fontWeight: 800, padding: '3px 12px', borderRadius: 999 }}>{qtdDevendo}</span>
              </div>
            )}
            <IconBox><Receipt size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
            <div>
              <p className="mkt-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Fiado</p>
              <Ctx>{fmtK(totalFiado)} a receber</Ctx>
            </div>
          </div>

          {/* Caixa — 6ª célula, só no desktop (no mobile continua no rodapé) */}
          <div className="mkt-bloco mkt-bloco-caixa" style={{
            background: '#3A3A44', borderRadius: 24, padding: '20px 18px',
            flexDirection: 'column', justifyContent: 'space-between',
            cursor: 'default',
          }}>
            <IconBox><Wallet size={24} color="#FFF" strokeWidth={2.2} /></IconBox>
            <div>
              <p className="mkt-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Caixa</p>
              <Ctx>Sobrou {fmtK(noCaixa)} hoje</Ctx>
            </div>
          </div>
        </div>

        {/* Rodapé — mobile: Caixa + Ajuda · desktop: só Ajuda */}
        <div className="mkt-rodape" style={{ padding: '0 22px 28px', display: 'flex', gap: 12, flexShrink: 0 }}>
          <button className="mkt-rodape-caixa" style={{
            flex: 1, height: 62, borderRadius: 18, border: 'none', minHeight: 56,
            background: '#3A3A44', color: '#FFFFFF', cursor: 'default',
            fontSize: 18, fontWeight: 800,
          }}>Caixa</button>
          <button style={{
            width: 120, height: 62, borderRadius: 18, border: 'none', minHeight: 56,
            background: '#F4F4F7', color: '#3F3F46', cursor: 'default',
            fontSize: 18, fontWeight: 800,
          }}>Ajuda</button>
        </div>
      </div>
    </div>
  )
}
