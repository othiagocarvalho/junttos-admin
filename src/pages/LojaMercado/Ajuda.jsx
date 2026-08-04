import { useState } from 'react'
import { ChevronLeft, ChevronDown, Barcode, Package, Receipt, Wallet, MessageCircle } from 'lucide-react'

// Número de suporte do Junttos — o mesmo já usado em components/UpgradeWall.jsx
// pra falar com o time. Fixo porque é conteúdo estático: não há campo de
// telefone/suporte em lf_config, e essa tela não precisa de um.
const WHATSAPP_SUPORTE = '5591992733546'
const MSG_SUPORTE = encodeURIComponent('Olá! Preciso de ajuda com o app do Mercado Junttos.')

function IconCadastro() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4"/>
      <line x1="12" y1="8" x2="12" y2="16"/>
      <line x1="8" y1="12" x2="16" y2="12"/>
    </svg>
  )
}

// Mesmas cores e ícones de cada módulo, já usados no Menu (Menu.jsx) — quem
// já reconhece o bloco colorido lá reconhece a pergunta aqui.
const PERGUNTAS = [
  {
    id: 'venda',
    pergunta: 'Como faço uma venda?',
    resposta: 'Toca em "Vender" no menu. Aponta a câmera pro código de barras de cada produto, ou digita se não tiver código. Quando terminar, toca em "Ir para o pagamento", escolhe como o cliente vai pagar e confirma. O recibo aparece na hora, com opção de mandar pelo WhatsApp.',
    cor: '#17864F',
    destacado: true,
    icon: <Barcode size={22} color="#FFFFFF" strokeWidth={2.2} />,
  },
  {
    id: 'cadastro',
    pergunta: 'Como cadastro um produto novo?',
    resposta: 'Toca em "Cadastrar produto". Escaneia o código de barras, ou pula essa parte se não tiver. Preenche o nome, o preço de venda e quantas unidades você tem. Toca em "Salvar produto" e já pode vender ele na hora.',
    cor: '#0E7C86',
    icon: <IconCadastro />,
  },
  {
    id: 'fiado',
    pergunta: 'Como anoto o fiado de um cliente?',
    resposta: 'Toca em "Fiado" no menu e depois em "Novo fiado". Escolhe o cliente já cadastrado ou digita o nome de quem ainda não tem cadastro, e anota o valor da compra. Quando ele pagar, você volta na conta dele e anota o pagamento — o saldo desconta sozinho.',
    cor: '#5E2BD0',
    icon: <Receipt size={22} color="#FFFFFF" strokeWidth={2.2} />,
  },
  {
    id: 'caixa',
    pergunta: 'Como fecho o caixa no fim do dia?',
    resposta: 'Toca em "Caixa". Confere quanto entrou, quanto saiu e o que sobrou no dia. Toca em "Fechar o caixa", conta o dinheiro que está na gaveta e digita o valor contado. O app compara com o que era esperado: se bateu, tudo certo; se não bateu, você marca o motivo. No final dá pra mandar o resumo do dia pelo WhatsApp.',
    cor: '#3A3A44',
    icon: <Wallet size={22} color="#FFFFFF" strokeWidth={2.2} />,
  },
  {
    id: 'estoque',
    pergunta: 'Como conto o estoque?',
    resposta: 'Não precisa contar nada na mão toda hora — a tela de Estoque já mostra sozinha o que está acabando, comparando com o quanto você costuma vender de cada produto. Os que aparecem em vermelho ou laranja são os que precisam de reposição primeiro.',
    cor: '#1E63C8',
    icon: <Package size={22} color="#FFFFFF" strokeWidth={2.2} />,
  },
]

function Pergunta({ item, aberto, onToggle }) {
  const corTexto = item.destacado ? '#0F5C36' : '#18181B'
  return (
    <div style={{
      borderRadius: 18, padding: '18px 20px',
      background: item.destacado ? '#E8F5EE' : '#F4F4F7',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 14,
          background: 'none', border: 'none', padding: 0, margin: 0,
          cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        }}
      >
        <div style={{
          width: 46, height: 46, borderRadius: 14, flexShrink: 0,
          background: item.cor, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {item.icon}
        </div>
        <p style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, margin: 0, color: corTexto }}>
          {item.pergunta}
        </p>
        <ChevronDown
          size={20} strokeWidth={2.5}
          color={item.destacado ? '#0F5C36' : '#71717A'}
          style={{ flexShrink: 0, transform: aberto ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}
        />
      </button>
      {aberto && (
        <p style={{
          margin: '14px 0 0', paddingLeft: 60, fontSize: 15, lineHeight: 1.55, fontWeight: 600,
          color: item.destacado ? '#0F5C36' : '#52525B',
        }}>
          {item.resposta}
        </p>
      )}
    </div>
  )
}

export default function Ajuda({ setTab }) {
  const [abertos, setAbertos] = useState({})
  function toggle(id) { setAbertos(prev => ({ ...prev, [id]: !prev[id] })) }

  return (
    <div className="ajd-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first, mesmo princípio das outras telas do módulo: estilo
        inline é o mobile; a partir de 1024px o conteúdo centraliza com
        largura máxima, sem esticar. Aqui não há faixa colorida pra
        neutralizar — a tela já nasce branca/flat nas duas telas.
      */}
      <style>{`
        .ajd-root  { height: 100dvh; }
        .ajd-shell { display: contents; }

        @media (min-width: 1024px) {
          .ajd-root { height: auto; min-height: 100dvh; }
          .ajd-shell {
            display: flex; flex-direction: column; flex: 1; min-height: 0;
            width: 100%; max-width: 760px; margin: 0 auto;
            padding: 30px 40px 34px; box-sizing: border-box;
          }
          .ajd-header  { padding: 0 0 24px !important; }
          .ajd-titulo  { font-size: 34px !important; }
          .ajd-corpo   { padding: 0 !important; overflow: visible !important; }
          .ajd-rodape  {
            padding: 24px 0 0 !important; border-top: none !important;
            justify-content: flex-end; display: flex;
          }
          .ajd-rodape a { flex: 0 0 auto !important; min-width: 300px; }
        }
      `}</style>

      <div className="ajd-shell">
        <div className="ajd-header" style={{ padding: '14px 22px 20px', borderBottom: '1px solid #EDEDF1', flexShrink: 0 }}>
          <button
            onClick={() => setTab('inicio')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#52525B',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Menu
          </button>
          <p className="ajd-titulo" style={{ fontSize: 26, fontWeight: 800, color: '#18181B', margin: '0 0 6px' }}>
            Preciso de ajuda
          </p>
          <p style={{ fontSize: 16, color: '#71717A', margin: 0 }}>
            Escolha o que você quer fazer
          </p>
        </div>

        <div className="ajd-corpo" style={{
          flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          {PERGUNTAS.map(item => (
            <Pergunta key={item.id} item={item} aberto={!!abertos[item.id]} onToggle={() => toggle(item.id)} />
          ))}
        </div>

        <div className="ajd-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))',
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          <a
            href={`https://wa.me/${WHATSAPP_SUPORTE}?text=${MSG_SUPORTE}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 72, minHeight: 72, borderRadius: 18, background: '#25D366',
              color: '#FFFFFF', textDecoration: 'none', fontSize: 18, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            }}
          >
            <MessageCircle size={22} strokeWidth={2.3} />
            Falar com uma pessoa
          </a>
        </div>
      </div>
    </div>
  )
}
