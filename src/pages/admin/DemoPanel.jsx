import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { ExternalLink, RotateCcw, Check, AlertCircle, Loader2, Zap, Smartphone, X } from 'lucide-react'
import { T } from '../../theme/tokens'

const DEMO_LOJA_ID    = 'sualoja'
const DEMO_URL        = `${window.location.origin}/sualoja/dashboard`
const DEMO_URL_MOBILE = `${window.location.origin}/sualoja/dashboard?forceMobile=1`
const PLANOS       = ['starter', 'pro', 'business']
const PLANO_LABEL  = { starter: 'Starter', pro: 'Pro', business: 'Business' }

// ── Date helpers ──────────────────────────────────────────────────
function diasAtras(n) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10)
}
function diasFrente(n) {
  const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

// ── Seed constants ────────────────────────────────────────────────
// gerarClientes(): birthdays are relative to today so birthday/follow-up demo works on any run date.
function gerarClientes() {
  function nascimento(offsetDias, anoNasc) {
    const d = new Date()
    d.setDate(d.getDate() + offsetDias)
    return `${anoNasc}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  return [
    { loja_id: DEMO_LOJA_ID, nome: 'Ana Carolina Silva', telefone: '(85) 99821-4530', data_nascimento: nascimento(0, 1995) }, // aniversário hoje
    { loja_id: DEMO_LOJA_ID, nome: 'Fernanda Rocha',     telefone: '(85) 98765-3210', data_nascimento: nascimento(3, 1993) }, // aniversário em 3 dias
    { loja_id: DEMO_LOJA_ID, nome: 'Mariana Costa',      telefone: '(85) 99123-4567', data_nascimento: nascimento(6, 1991) }, // aniversário em 6 dias
    { loja_id: DEMO_LOJA_ID, nome: 'Juliana Matos',      telefone: '(85) 99234-5678', data_nascimento: '1990-03-22' },
    { loja_id: DEMO_LOJA_ID, nome: 'Beatriz Oliveira',   telefone: '(85) 99876-1122', data_nascimento: '1988-11-15' },
    { loja_id: DEMO_LOJA_ID, nome: 'Larissa Mendes',     telefone: '(85) 98901-6677', data_nascimento: '1996-08-07' },
    { loja_id: DEMO_LOJA_ID, nome: 'Rafaela Souza',      telefone: '(85) 97654-3210', data_nascimento: '1994-05-30' }, // VIP (vendas abaixo)
    { loja_id: DEMO_LOJA_ID, nome: 'Camila Torres',      telefone: '(85) 99345-7890', data_nascimento: '1992-09-18' }, // inativo (vendas abaixo)
  ]
}

function gerarLembretes() {
  return [
    { loja_id: DEMO_LOJA_ID, cliente_nome: 'Fernanda Rocha',   nota: 'Ligar sobre encomenda do vestido florido',   data_lembrete: diasFrente(1), concluido: false },
    { loja_id: DEMO_LOJA_ID, cliente_nome: 'Beatriz Oliveira', nota: 'Avisar que chegou o tamanho M da blusa',     data_lembrete: diasFrente(2), concluido: false },
    { loja_id: DEMO_LOJA_ID, cliente_nome: 'Juliana Matos',    nota: 'Confirmar pedido de calça jeans azul',       data_lembrete: diasAtras(1),  concluido: false },
    { loja_id: DEMO_LOJA_ID, cliente_nome: 'Larissa Mendes',   nota: 'Apresentar nova coleção de verão',           data_lembrete: diasFrente(5), concluido: false },
  ]
}

const SEED_FORNECEDORES = [
  { loja_id: DEMO_LOJA_ID, nome: 'Confecções Ana Ltda',    contato: '(11) 98000-1234', prazo_pagamento_dias: 30, observacoes: 'Entrega em até 7 dias úteis.', ativo: true },
  { loja_id: DEMO_LOJA_ID, nome: 'Moda Sul Distribuidora', contato: '(51) 99567-8901', prazo_pagamento_dias: 15, observacoes: null, ativo: true },
  { loja_id: DEMO_LOJA_ID, nome: 'Studio Moda Atacado',    contato: '(21) 97654-3210', prazo_pagamento_dias: 45, observacoes: 'Mínimo 10 peças por pedido.', ativo: true },
]

const NOMES_CLI = ['Ana Carolina Silva', 'Fernanda Rocha', 'Juliana Matos', 'Beatriz Oliveira', 'Larissa Mendes', null, null]
const PRODS_DEMO = [
  [{ nome: 'Vestido Floral',   quantidade: 1 }],
  [{ nome: 'Blusa Listrada',   quantidade: 1 }],
  [{ nome: 'Calça Skinny',     quantidade: 1 }],
  [{ nome: 'Cropped Básico',   quantidade: 2 }],
  [{ nome: 'Saia Midi',        quantidade: 1 }],
  [{ nome: 'Conjunto Tie Dye', quantidade: 1 }],
]
const VALORES_VENDA = [89, 127, 98, 145, 161, 210, 76, 139, 185, 220, 95, 170, 115, 240, 88]
const FORMAS_PGTO   = ['Pix', 'Cartão de Crédito', 'Dinheiro', 'Pix', 'Cartão de Débito']
// 15 vendas todas no mês corrente — diasAtras(0)=hoje, diasAtras(9)=dia 1 do mês
const DIAS_AGO = [0, 1, 1, 2, 3, 3, 4, 5, 5, 6, 7, 7, 8, 8, 9]
const HORAS    = [14, 10, 16, 11, 9, 15, 13, 10, 17, 11, 10, 15, 14, 9, 11]

// ── Seed functions (dates evaluated at call time) ─────────────────
function gerarVendas() {
  const base = Array.from({ length: 15 }, (_, i) => ({
    loja_id:      DEMO_LOJA_ID,
    data:         `${diasAtras(DIAS_AGO[i])}T${String(HORAS[i]).padStart(2, '0')}:00:00+00:00`,
    valor:        VALORES_VENDA[i],
    cliente_nome: NOMES_CLI[i % NOMES_CLI.length],
    cliente_tel:  null,
    produtos:     PRODS_DEMO[i % PRODS_DEMO.length],
    forma_pgto:   JSON.stringify([{ forma: FORMAS_PGTO[i % FORMAS_PGTO.length], valor: '' }]),
    obs:          null,
    vendedora:    i % 4 === 0 ? 'Carla' : null,
    ajuste_valor: null,
  }))

  // Rafaela Souza — VIP: 5 compras totalizando R$1540 (>= 10× ticket médio ~R$143)
  // Última compra 38 dias atrás → aparece no feed VIP (>= 30 dias)
  const vip = [
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(38)}T11:00:00+00:00`,  valor: 290, cliente_nome: 'Rafaela Souza', cliente_tel: null, produtos: [{ nome: 'Calça Skinny', quantidade: 1 }], forma_pgto: JSON.stringify([{ forma: 'Pix', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(55)}T14:00:00+00:00`,  valor: 280, cliente_nome: 'Rafaela Souza', cliente_tel: null, produtos: [{ nome: 'Vestido Floral', quantidade: 1 }], forma_pgto: JSON.stringify([{ forma: 'Cartão de Crédito', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(62)}T10:00:00+00:00`,  valor: 320, cliente_nome: 'Rafaela Souza', cliente_tel: null, produtos: [{ nome: 'Conjunto Tie Dye', quantidade: 2 }], forma_pgto: JSON.stringify([{ forma: 'Cartão de Crédito', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(70)}T15:30:00+00:00`,  valor: 350, cliente_nome: 'Rafaela Souza', cliente_tel: null, produtos: [{ nome: 'Saia Midi', quantidade: 1 }, { nome: 'Blusa Listrada', quantidade: 2 }], forma_pgto: JSON.stringify([{ forma: 'Pix', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(80)}T09:00:00+00:00`,  valor: 300, cliente_nome: 'Rafaela Souza', cliente_tel: null, produtos: [{ nome: 'Cropped Básico', quantidade: 3 }], forma_pgto: JSON.stringify([{ forma: 'Cartão de Crédito', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
  ]

  // Camila Torres — inativo: última compra 55 dias atrás → aparece no feed inativo (>= 45 dias)
  const inativo = [
    { loja_id: DEMO_LOJA_ID, data: `${diasAtras(55)}T09:00:00+00:00`, valor: 120, cliente_nome: 'Camila Torres', cliente_tel: null, produtos: [{ nome: 'Blusa Listrada', quantidade: 1 }], forma_pgto: JSON.stringify([{ forma: 'Dinheiro', valor: '' }]), obs: null, vendedora: null, ajuste_valor: null },
  ]

  return [...base, ...vip, ...inativo]
}

function gerarCompras(fornecedores) {
  return [
    { loja_id: DEMO_LOJA_ID, fornecedor_id: fornecedores[0].id, descricao: 'Lote vestidos — 20 peças',    valor: 1200, data_compra: diasAtras(15), data_vencimento: diasFrente(15), status_pgto: 'pendente' },
    { loja_id: DEMO_LOJA_ID, fornecedor_id: fornecedores[0].id, descricao: 'Blusas listradas — 30 peças', valor: 850,  data_compra: diasAtras(30), data_vencimento: diasAtras(2),   status_pgto: 'pago', data_pagamento: diasAtras(2) },
    { loja_id: DEMO_LOJA_ID, fornecedor_id: fornecedores[1].id, descricao: 'Calças e saias — mix',        valor: 2300, data_compra: diasAtras(7),  data_vencimento: diasFrente(8),  status_pgto: 'pendente' },
  ]
}

function gerarContasPagar() {
  return [
    { loja_id: DEMO_LOJA_ID, descricao: 'Aluguel',                    categoria: 'aluguel',    valor: 500,   data_vencimento: diasFrente(20), status: 'pendente', data_pagamento: null,         recorrente: true  },
    { loja_id: DEMO_LOJA_ID, descricao: 'Fornecedor — Confecções Ana', categoria: 'fornecedor', valor: 320,   data_vencimento: diasFrente(7),  status: 'pendente', data_pagamento: null,         recorrente: false },
    { loja_id: DEMO_LOJA_ID, descricao: 'Maquininha — mensalidade',    categoria: 'fixo',       valor: 149,   data_vencimento: diasFrente(2),  status: 'pendente', data_pagamento: null,         recorrente: true  },
    { loja_id: DEMO_LOJA_ID, descricao: 'Internet e telefone',         categoria: 'fixo',       valor: 89.90, data_vencimento: diasAtras(3),   status: 'pago',     data_pagamento: diasAtras(3), recorrente: true  },
  ]
}

function gerarContasReceber() {
  return [
    { loja_id: DEMO_LOJA_ID, descricao: 'Venda parcelada — Fernanda', categoria: 'vendas', valor: 450, data_vencimento: diasFrente(15), status: 'pendente',  data_recebimento: null,         origem: 'manual' },
    { loja_id: DEMO_LOJA_ID, descricao: 'Reembolso — devolução',      categoria: 'outros', valor: 127, data_vencimento: diasAtras(5),   status: 'recebido', data_recebimento: diasAtras(5), origem: 'manual' },
  ]
}

const SEED_PRODUTO_BAIXO = {
  loja_id: DEMO_LOJA_ID,
  nome: 'Body Canelado',
  preco_custo: 28,
  preco_venda: 69,
  variacoes: [{ cor: 'Preto P', quantidade: 2 }, { cor: 'Preto M', quantidade: 1 }],
  fotos: [],
  disponivel_catalogo_b2b: false,
}

const DEMO_FEATURES = {
  vendas: true, historico: true, metas: true, fechamento_caixa: true,
  relatorios: true, clientes: true, estoque: true,
  legado: false, catalogo_b2b: true, atacado: false, crm: false,
}

// ── Reset logic ───────────────────────────────────────────────────
async function executarReset() {
  // lf_compras references lf_fornecedores — delete children first
  await supabase.from('lf_compras').delete().eq('loja_id', DEMO_LOJA_ID)

  await Promise.all([
    supabase.from('lf_fornecedores').delete().eq('loja_id', DEMO_LOJA_ID),
    supabase.from('lf_vendas').delete().eq('loja_id', DEMO_LOJA_ID),
    supabase.from('lf_clientes').delete().eq('loja_id', DEMO_LOJA_ID),
    supabase.from('lf_lembretes').delete().eq('loja_id', DEMO_LOJA_ID),
    supabase.from('lf_followup_dispensado').delete().eq('loja_id', DEMO_LOJA_ID),
    supabase.from('lf_contas_pagar').delete().eq('loja_id', DEMO_LOJA_ID).not('descricao', 'ilike', '[TESTE-AUTO]%'),
    supabase.from('lf_contas_receber').delete().eq('loja_id', DEMO_LOJA_ID).not('descricao', 'ilike', '[TESTE-AUTO]%'),
  ])

  const { error: vErr } = await supabase.from('lf_vendas').insert(gerarVendas())
  if (vErr) throw new Error(`lf_vendas: ${vErr.message}`)

  const { error: cliErr } = await supabase.from('lf_clientes').insert(gerarClientes())
  if (cliErr) throw new Error(`lf_clientes: ${cliErr.message}`)

  const { error: lemErr } = await supabase.from('lf_lembretes').insert(gerarLembretes())
  if (lemErr) throw new Error(`lf_lembretes: ${lemErr.message}`)

  const { data: fornecedores, error: fErr } = await supabase
    .from('lf_fornecedores').insert(SEED_FORNECEDORES).select()
  if (fErr) throw new Error(`lf_fornecedores: ${fErr.message}`)

  if (fornecedores?.length >= 2) {
    const { error: compErr } = await supabase.from('lf_compras').insert(gerarCompras(fornecedores))
    if (compErr) throw new Error(`lf_compras: ${compErr.message}`)
  }

  const { error: cpErr } = await supabase.from('lf_contas_pagar').insert(gerarContasPagar())
  if (cpErr) throw new Error(`lf_contas_pagar: ${cpErr.message}`)

  const { error: crErr } = await supabase.from('lf_contas_receber').insert(gerarContasReceber())
  if (crErr) throw new Error(`lf_contas_receber: ${crErr.message}`)

  await supabase.from('lf_produtos').delete().eq('loja_id', DEMO_LOJA_ID).eq('nome', SEED_PRODUTO_BAIXO.nome)
  const { error: prodErr } = await supabase.from('lf_produtos').insert(SEED_PRODUTO_BAIXO)
  if (prodErr) throw new Error(`lf_produtos: ${prodErr.message}`)

  const { error: cfgErr } = await supabase.from('lf_config').update({ features: DEMO_FEATURES }).eq('loja_id', DEMO_LOJA_ID)
  if (cfgErr) throw new Error(`lf_config: ${cfgErr.message}`)
}

// ── Component ─────────────────────────────────────────────────────
export default function DemoPanel() {
  const [planoAtual,    setPlanoAtual]    = useState(null)
  const [trocando,      setTrocando]      = useState(null)
  const [resetando,     setResetando]     = useState(false)
  const [confirmReset,  setConfirmReset]  = useState(false)
  const [feedbackPlano, setFeedbackPlano] = useState(null) // 'ok' | 'erro'
  const [feedbackReset, setFeedbackReset] = useState(null) // 'ok' | 'erro'
  const [showMobile,    setShowMobile]    = useState(false)

  const fetchPlano = useCallback(async () => {
    const { data } = await supabase
      .from('lf_config').select('plano').eq('loja_id', DEMO_LOJA_ID).single()
    if (data) setPlanoAtual(data.plano)
  }, [])

  useEffect(() => { fetchPlano() }, [fetchPlano])

  async function trocarPlano(novoPlano) {
    if (trocando || resetando || novoPlano === planoAtual) return
    setTrocando(novoPlano); setFeedbackPlano(null)
    const { error } = await supabase
      .from('lf_config').update({ plano: novoPlano }).eq('loja_id', DEMO_LOJA_ID)
    if (!error) { setPlanoAtual(novoPlano); setFeedbackPlano('ok') }
    else setFeedbackPlano('erro')
    setTrocando(null)
    setTimeout(() => setFeedbackPlano(null), 3000)
  }

  async function handleReset() {
    setResetando(true); setConfirmReset(false); setFeedbackReset(null)
    try {
      await executarReset()
      setFeedbackReset('ok')
    } catch {
      setFeedbackReset('erro')
    } finally {
      setResetando(false)
      setTimeout(() => setFeedbackReset(null), 4000)
    }
  }

  const busy = !!trocando || resetando

  return (
    <div style={{
      background:   'linear-gradient(135deg, #F4F0FC 0%, #FEF6F3 100%)',
      border:       `1.5px solid ${T.purple}28`,
      borderRadius: T.rCard + 4,
      padding:      '18px 22px',
      marginBottom: 32,
      fontFamily:   T.ui,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
            <Zap size={14} color={T.purple} />
            <p style={{ fontSize: 11, fontWeight: 700, color: T.purple, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Painel Demo — Sua Loja
            </p>
          </div>
          <p style={{ fontSize: 12, color: T.muted }}>
            Troque o plano ao vivo e resete os dados de exemplo antes de uma demo.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button
            onClick={() => setShowMobile(v => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 36, padding: '0 16px', borderRadius: T.rPill,
              border: `1.5px solid ${showMobile ? T.purple : T.line}`,
              background: showMobile ? `${T.purple}12` : T.white,
              color: showMobile ? T.purple : T.muted,
              fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: T.ui,
            }}
          >
            <Smartphone size={12} /> Ver mobile
          </button>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 36, padding: '0 16px', borderRadius: T.rPill,
              background: T.purple, color: '#fff', textDecoration: 'none',
              fontSize: 12.5, fontWeight: 700,
              boxShadow: '0 2px 8px rgba(94,43,208,.22)',
            }}
          >
            <ExternalLink size={12} /> Abrir demo
          </a>
        </div>
      </div>

      {/* Plan switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 2 }}>
          Plano
        </p>
        {PLANOS.map(p => {
          const isAtivo   = planoAtual === p
          const carregando = trocando === p
          return (
            <button
              key={p}
              onClick={() => trocarPlano(p)}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 34, padding: '0 16px', borderRadius: T.rPill,
                border:     isAtivo ? `2px solid ${T.purple}` : `1.5px solid ${T.line}`,
                background: isAtivo ? T.purple : T.white,
                color:      isAtivo ? '#fff' : T.ink,
                fontFamily: T.ui, fontSize: 13, fontWeight: 700,
                cursor:  busy ? 'not-allowed' : 'pointer',
                opacity: busy && !carregando ? 0.5 : 1,
                boxShadow: isAtivo ? '0 2px 8px rgba(94,43,208,.22)' : 'none',
                transition: 'all .15s',
              }}
            >
              {carregando
                ? <Loader2 size={11} style={{ animation: 'spin .9s linear infinite' }} />
                : isAtivo && <Check size={11} />
              }
              {PLANO_LABEL[p]}
            </button>
          )
        })}
        {feedbackPlano === 'ok' && (
          <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            ✓ Atualizado — recarregue a aba da demo
          </span>
        )}
        {feedbackPlano === 'erro' && (
          <span style={{ fontSize: 12, color: T.coralText, fontWeight: 600 }}>Erro ao atualizar plano</span>
        )}
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: `${T.purple}18`, margin: '4px 0 12px' }} />

      {/* Reset row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {!confirmReset ? (
          <button
            onClick={() => setConfirmReset(true)}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              height: 34, padding: '0 16px', borderRadius: T.rPill,
              border: `1.5px solid ${T.line}`, background: T.white,
              color: T.muted, fontSize: 12.5, fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: resetando ? 0.5 : 1, fontFamily: T.ui,
            }}
          >
            {resetando
              ? <><Loader2 size={12} style={{ animation: 'spin .9s linear infinite' }} /> Resetando…</>
              : <><RotateCcw size={12} /> Resetar dados demo</>
            }
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, color: T.ink, fontWeight: 600 }}>
              Apagar e reinserir dados de exemplo?
            </span>
            <button
              onClick={handleReset}
              style={{
                height: 32, padding: '0 14px', borderRadius: T.rPill,
                border: 'none', background: T.coral, color: '#fff',
                fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: T.ui,
              }}
            >
              Confirmar
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              style={{
                height: 32, padding: '0 12px', borderRadius: T.rPill,
                border: `1.5px solid ${T.line}`, background: T.white,
                color: T.muted, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: T.ui,
              }}
            >
              Cancelar
            </button>
          </div>
        )}

        {feedbackReset === 'ok' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#16a34a', fontWeight: 600 }}>
            <Check size={12} /> Dados resetados — recarregue a aba da demo
          </span>
        )}
        {feedbackReset === 'erro' && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: T.coralText, fontWeight: 600 }}>
            <AlertCircle size={12} /> Erro ao resetar dados
          </span>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>

      {/* Phone simulator */}
      {showMobile && (
        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <div style={{ height: 1, background: `${T.purple}18`, width: '100%', marginBottom: 2 }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Simulador mobile — 375 × 812 px
            </p>
            <button
              onClick={() => setShowMobile(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                height: 30, padding: '0 12px', borderRadius: T.rPill,
                border: `1.5px solid ${T.line}`, background: T.white,
                color: T.muted, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: T.ui,
              }}
            >
              <X size={11} /> Fechar
            </button>
          </div>

          {/* Scale wrapper: frame natural size 399×901px → scale(0.8) → 319×721px visible.
               marginBottom compensates the 180px of layout gap left by the transform. */}
          <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center', marginBottom: -180 }}>
            {/* Phone frame */}
            <div style={{
              background: '#141414',
              borderRadius: 52,
              padding: '18px 12px 30px',
              boxShadow: '0 24px 64px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06) inset',
              position: 'relative',
            }}>
              {/* Dynamic-island pill */}
              <div style={{
                width: 116, height: 30, background: '#141414',
                borderRadius: '0 0 20px 20px',
                margin: '-18px auto 10px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <div style={{ width: 56, height: 5, borderRadius: 99, background: '#2a2a2a' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#1e1e1e', border: '1.5px solid #3a3a3a' }} />
              </div>
              {/* Screen */}
              <div style={{ borderRadius: 40, overflow: 'hidden', width: 375, height: 812, background: '#000' }}>
                <iframe
                  src={DEMO_URL_MOBILE}
                  width={375}
                  height={812}
                  style={{ border: 'none', display: 'block' }}
                  title="Simulador mobile — Sua Loja"
                />
              </div>
              {/* Home bar */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
                <div style={{ width: 120, height: 5, borderRadius: 99, background: '#333' }} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
