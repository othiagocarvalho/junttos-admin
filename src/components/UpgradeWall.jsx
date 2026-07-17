import { Lock } from 'lucide-react'
import { PLANOS } from '../utils/planos'

const DESCRICOES = {
  meta:              'Defina metas mensais e acompanhe o progresso da sua loja em tempo real.',
  meta_vendedor:     'Defina metas individuais por vendedor(a) e acompanhe o desempenho de cada um.',
  meta_produto:      'Defina metas por produto ou categoria e acompanhe o desempenho por item.',
  meta_comparativo:  'Compare o desempenho mês a mês e visualize a evolução das suas vendas ao longo do tempo.',
  clientes:          'Cadastre seus clientes, veja o histórico de compras e fidelize com cartão digital.',
  catalogo:          'Venda pelo link com Pix integrado. Compartilhe o catálogo e receba pedidos online.',
  financeiro:        'Controle contas a pagar e a receber, fluxo de caixa e resultado mensal completo.',
  notificacoes:      'Receba alertas automáticos de estoque baixo, metas atingidas e vendas grandes.',
  crediario:         'Venda fiado com controle de parcelas. Acompanhe quem deve, quanto e quando vence.',
  corrida:           'Crie competições motivacionais entre vendedores com ranking ao vivo, pódio visual e prêmios.',
}

const NOMES = {
  meta:              'Metas & Resultados',
  meta_vendedor:     'Meta por Vendedor(a)',
  meta_produto:      'Meta por Produto',
  meta_comparativo:  'Comparativo Mês a Mês',
  clientes:          'Gestão de Clientes',
  catalogo:          'Catálogo B2B',
  financeiro:        'Módulo Financeiro',
  notificacoes:      'Notificações Automáticas',
  crediario:         'Crediário',
  corrida:           'Corrida de Vendas',
}

const BADGE_COLORS = {
  starter:  { bg: '#e5e7eb', color: '#374151' },
  pro:      { bg: '#dbeafe', color: '#1d4ed8' },
  business: { bg: '#ede9fe', color: '#6d28d9' },
}

const PRECOS = {
  starter:  99.90,
  pro:      149.90,
  business: 259.90,
}

function fmtPreco(valor) {
  return valor.toFixed(2).replace('.', ',')
}

export default function UpgradeWall({ planoAtual, planoNecessario, funcionalidade, theme, onVoltar }) {
  const labelAtual      = PLANOS[planoAtual]?.label      || planoAtual
  const labelNecessario = PLANOS[planoNecessario]?.label  || planoNecessario
  const descricao       = DESCRICOES[funcionalidade] || 'Esta funcionalidade está disponível em um plano superior.'
  const badgeColors     = BADGE_COLORS[planoAtual]   || BADGE_COLORS.starter
  const primary         = theme?.primary || '#6B4FBB'

  const nivelAtual      = PLANOS[planoAtual]?.nivel      || 1
  const nivelNecessario = PLANOS[planoNecessario]?.nivel  || 1
  const gap             = nivelNecessario - nivelAtual

  const nomeFuncionalidade = NOMES[funcionalidade] || funcionalidade
  const diff = gap === 1
    ? fmtPreco((PRECOS[planoNecessario] || 0) - (PRECOS[planoAtual] || 0) - 0.10)
    : null

  const waUrl = `https://wa.me/5591992733546?text=Ol%C3%A1!%20Tenho%20interesse%20em%20fazer%20upgrade%20do%20meu%20plano%20Junttos.`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
      minHeight: 400,
    }}>
      {/* Badge plano atual */}
      <span style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: 99,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        fontFamily: 'Manrope, sans-serif', marginBottom: 20,
        background: badgeColors.bg, color: badgeColors.color,
      }}>
        Plano {labelAtual}
      </span>

      {/* Cadeado */}
      <div style={{
        width: 72, height: 72, borderRadius: '50%',
        background: 'rgba(109,40,217,0.1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 24,
      }}>
        <Lock size={32} color="#6d28d9" />
      </div>

      {/* Título */}
      <p style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 20, fontWeight: 700, color: 'var(--ink)',
        marginBottom: 10, lineHeight: 1.3,
        maxWidth: 340,
      }}>
        Esta funcionalidade não está disponível no plano {labelAtual}
      </p>

      {/* Subtítulo */}
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
        color: '#6d28d9', marginBottom: 12,
      }}>
        Disponível a partir do plano {labelNecessario}
      </p>

      {/* Descrição */}
      <p style={{
        fontFamily: 'Manrope, sans-serif', fontSize: 14, color: 'var(--muted)',
        lineHeight: 1.6, maxWidth: 340, marginBottom: diff ? 20 : 36,
      }}>
        {descricao}
      </p>

      {/* Chamada de incentivo — só quando o gap é exatamente 1 nível */}
      {diff && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(109,40,217,0.08), rgba(109,40,217,0.04))',
          border: '1px solid rgba(109,40,217,0.2)',
          borderRadius: 14,
          padding: '14px 20px',
          marginBottom: 28,
          maxWidth: 320,
          width: '100%',
        }}>
          <p style={{
            fontFamily: 'Manrope, sans-serif',
            fontSize: 14,
            fontWeight: 700,
            color: '#6d28d9',
            lineHeight: 1.5,
            margin: 0,
          }}>
            Por mais R${diff}/mês você libera {nomeFuncionalidade} no plano {labelNecessario}.
          </p>
        </div>
      )}

      {/* Botões */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', height: 50, borderRadius: 14,
            background: 'linear-gradient(135deg, #6d28d9, #4c1d95)',
            color: '#fff', fontFamily: 'Manrope, sans-serif',
            fontSize: 15, fontWeight: 700, lineHeight: '50px',
            textDecoration: 'none', textAlign: 'center',
            boxShadow: '0 4px 16px rgba(109,40,217,0.35)',
          }}
        >
          Falar sobre upgrade
        </a>
        {onVoltar && (
          <button
            onClick={onVoltar}
            style={{
              height: 50, borderRadius: 14, border: '1.5px solid var(--line)',
              background: 'transparent', cursor: 'pointer',
              fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 600,
              color: 'var(--muted)',
            }}
          >
            Voltar
          </button>
        )}
      </div>
    </div>
  )
}
