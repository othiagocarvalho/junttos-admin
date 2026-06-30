import { Lock } from 'lucide-react'
import { PLANOS } from '../utils/planos'

const DESCRICOES = {
  meta:         'Defina metas mensais e acompanhe o progresso da sua loja em tempo real.',
  clientes:     'Cadastre seus clientes, veja o histórico de compras e fidelize com cartão digital.',
  catalogo:     'Venda pelo link com Pix integrado. Compartilhe o catálogo e receba pedidos online.',
  financeiro:   'Controle contas a pagar e a receber, fluxo de caixa e resultado mensal completo.',
  notificacoes: 'Receba alertas automáticos de estoque baixo, metas atingidas e vendas grandes.',
  crediario:    'Venda fiado com controle de parcelas. Acompanhe quem deve, quanto e quando vence.',
}

const BADGE_COLORS = {
  starter:  { bg: '#e5e7eb', color: '#374151' },
  pro:      { bg: '#dbeafe', color: '#1d4ed8' },
  business: { bg: '#ede9fe', color: '#6d28d9' },
}

export default function UpgradeWall({ planoAtual, planoNecessario, funcionalidade, theme, onVoltar }) {
  const labelAtual     = PLANOS[planoAtual]?.label     || planoAtual
  const labelNecessario = PLANOS[planoNecessario]?.label || planoNecessario
  const descricao      = DESCRICOES[funcionalidade] || 'Esta funcionalidade está disponível em um plano superior.'
  const badgeColors    = BADGE_COLORS[planoAtual] || BADGE_COLORS.starter
  const primary        = theme?.primary || '#6B4FBB'

  const waUrl = `https://wa.me/559XXXXXXXX?text=Ol%C3%A1!%20Tenho%20interesse%20em%20fazer%20upgrade%20do%20meu%20plano%20Junttos.`

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
        lineHeight: 1.6, maxWidth: 340, marginBottom: 36,
      }}>
        {descricao}
      </p>

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
      </div>
    </div>
  )
}
