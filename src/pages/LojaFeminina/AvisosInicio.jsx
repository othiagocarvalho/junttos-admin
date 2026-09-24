// Avisos da tela Início — um componente só no lugar de AlertaBanner +
// BannerMeta. Visual do antigo BannerMeta (cartão claro na cor do aviso,
// ícone em quadrado arredondado, botão de texto e X).
//
// Mostra o aviso mais urgente como cartão principal; os demais ficam atrás
// de "+ N avisos", que expande a pilha. Nada troca sozinho.
//
// O que mostrar e em que ordem: utils/avisosInicio.js (montarAvisos, testado).
// Aqui só buscamos os dados remotos (contas e relatório do Sócio) e desenhamos.
// O X devolve ao pai o `dispensa` do aviso; o pai grava na coluna certa.

import { useState, useEffect } from 'react'
import { AlertTriangle, TrendingUp, CreditCard, Wallet, Sparkles, Target, X, ArrowRight, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { temAcesso } from '../../utils/planos'
import { montarAvisos, limiteJanelaContas } from '../../utils/avisosInicio'

const FONT = 'Plus Jakarta Sans, sans-serif'

const ICONES = {
  conta_pagar: CreditCard,
  conta_receber: Wallet,
  socio: Sparkles,
  estoque: AlertTriangle,
  meta: Target,
  meta_batida: TrendingUp,
}

function CartaoAviso({ aviso, onAbrir, onDispensar }) {
  const { cor } = aviso
  const Icon = ICONES[aviso.icone] || AlertTriangle
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      background: `${cor}0F`, border: `1px solid ${cor}2E`,
      borderRadius: 16, padding: '14px 14px 14px 16px',
      fontFamily: FONT,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 11, flexShrink: 0,
        background: `${cor}1F`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={19} color={cor} strokeWidth={2.1} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink, #18181B)', margin: '0 0 3px' }}>
          {aviso.titulo}
        </p>
        <p style={{
          fontSize: 12.5, color: 'var(--muted, #71717A)', lineHeight: 1.5, margin: '0 0 8px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {aviso.texto}
        </p>
        <button
          type="button"
          onClick={onAbrir}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13, fontWeight: 800, color: cor,
          }}
        >
          {aviso.botao} <ArrowRight size={14} strokeWidth={2.5} />
        </button>
      </div>

      {aviso.dispensa && (
        <button
          type="button"
          onClick={onDispensar}
          aria-label={aviso.rotuloDispensar || 'Esconder aviso'}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28, flexShrink: 0, borderRadius: 8,
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: 'var(--muted, #A1A1AA)',
          }}
        >
          <X size={15} strokeWidth={2.4} />
        </button>
      )}
    </div>
  )
}

// Props:
//   dispensas   { metaDispensadaEm, socioVistoPeriodo, socioIntroVisto, avisos }
//               — valores de lf_config (com a trava local do pai por cima)
//   onDispensar(dispensa)  o pai grava { campo, chave?, valor } na coluna certa
export default function AvisosInicio({ vendas, metas, produtosData = [], lojaId, plano, gerente = false, setTab, theme = {}, dispensas = {}, onDispensar }) {
  // null = ainda carregando. Erro vira lista vazia: sem aviso de conta, mas o
  // resto aparece normalmente.
  const [contas, setContas] = useState(null)
  // Relatório mais recente do Sócio. undefined = não carregou / erro; null = nenhum.
  const [socioUltimo, setSocioUltimo] = useState(undefined)
  const [aberto, setAberto] = useState(false)
  const socioLiberado = temAcesso(plano, 'pro')

  useEffect(() => {
    if (!lojaId || !socioLiberado) return
    let vivo = true
    supabase.from('lf_socio_relatorios')
      .select('periodo_inicio, periodo_fim')
      .eq('loja_id', lojaId)
      .order('periodo_inicio', { ascending: false })
      .limit(1)
      .then(({ data, error }) => {
        // Tabela ainda inexistente: sem aviso do Sócio, sem quebrar o resto.
        if (vivo && !error) setSocioUltimo(data?.[0] || null)
      })
    return () => { vivo = false }
  }, [lojaId, socioLiberado])

  useEffect(() => {
    if (!lojaId) return
    let vivo = true
    // Pendentes que vencem até hoje+3 no dia LOCAL — inclui as já vencidas
    // (antes só entrava de hoje em diante, e a data era calculada em UTC).
    const ate = limiteJanelaContas()
    const campos = 'id,descricao,valor,data_vencimento,status'
    Promise.all([
      supabase.from('lf_contas_pagar').select(campos)
        .eq('loja_id', lojaId).eq('status', 'pendente').lte('data_vencimento', ate),
      supabase.from('lf_contas_receber').select(campos)
        .eq('loja_id', lojaId).eq('status', 'pendente').lte('data_vencimento', ate),
    ])
      .then(([pagar, receber]) => {
        if (vivo) setContas({ pagar: pagar.data || [], receber: receber.data || [] })
      })
      .catch(() => { if (vivo) setContas({ pagar: [], receber: [] }) })
    return () => { vivo = false }
  }, [lojaId])

  // Espera as contas (como o AlertaBanner fazia) para o cartão principal não
  // trocar logo depois de aparecer.
  if (contas === null) return null

  const avisos = montarAvisos({
    plano,
    gerente,
    corLoja: theme.primary,
    vendas,
    metas,
    produtosData,
    contasPagar: contas.pagar,
    contasReceber: contas.receber,
    socioUltimo,
    socioVistoPeriodo: dispensas.socioVistoPeriodo,
    socioIntroVisto: dispensas.socioIntroVisto,
    metaDispensadaEm: dispensas.metaDispensadaEm,
    dispensados: dispensas.avisos,
  })

  if (avisos.length === 0) return null

  const [principal, ...demais] = avisos
  const cartao = a => (
    <CartaoAviso
      key={a.tipo}
      aviso={a}
      onAbrir={() => setTab(a.tab)}
      onDispensar={() => onDispensar?.(a.dispensa)}
    />
  )

  return (
    <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cartao(principal)}
      {demais.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setAberto(v => !v)}
            aria-expanded={aberto}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
              background: 'none', border: 'none', padding: '2px 4px', cursor: 'pointer',
              fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: 'var(--muted, #71717A)',
            }}
          >
            {aberto ? 'Mostrar menos' : `+ ${demais.length} ${demais.length === 1 ? 'aviso' : 'avisos'}`}
            <ChevronDown size={14} strokeWidth={2.5} style={{ transition: 'transform 0.2s', transform: aberto ? 'rotate(180deg)' : 'none' }} />
          </button>
          {aberto && demais.map(cartao)}
        </>
      )}
    </div>
  )
}
