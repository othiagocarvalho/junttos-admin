// Lista de Pré-vendas (mobile e desktop) — etapa 2.
//
// Componente ÚNICO pros dois — mesmo padrão de PedidosCatalogo.jsx, que já é
// compartilhado (index.jsx e ClientDashboardDesktop.jsx importam o mesmo
// arquivo). Ao contrário da tela de bipagem (PreVenda.jsx/DesktopPreVenda),
// que o pedido explicitamente separou em duas implementações, esta tela não
// tem motivo estrutural pra duplicar: é lista + filtro + busca + um painel de
// finalização, sem o tipo de layout que já forçou Nova Venda a virar dois
// arquivos.
//
// ─── POR QUE SÓ 'aguardando_pagamento' E 'cancelada' APARECEM AQUI ─────────
// Depois de finalizada, uma pré-venda vira status='completa' — o MESMO valor
// que toda venda normal já tem. Não existe (nem foi pedido) um jeito de
// marcar "esta venda completa nasceu de uma pré-venda"; uma vez finalizada,
// ela se torna uma venda comum de verdade, e passa a viver em
// Histórico/Relatórios, não aqui. Esta tela é só o ciclo de vida ANTES disso
// — pendente ou cancelada.

import { useState } from 'react'
import { ScanLine, Search, Package, Clock, Plus, X, Check, ChevronDown, Trash2, CreditCard, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import { HeroCard } from '../../components/studio/Card'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import Input from '../../components/studio/Input'
import Chip, { ChipRow } from '../../components/studio/Chip'
import EmptyState from '../../components/studio/EmptyState'
import SecaoTitulo from '../../components/studio/SecaoTitulo'
import { fmtR } from '../../utils/formatters'
import { itensParaRestaurar, variacaoParaRpc, encontrarProdutoDoItem, finalizarPreVenda } from '../../utils/prevenda'

const STATUS_MAP = {
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warn' },
  cancelada:             { label: 'Cancelada',            tone: 'bad' },
}

const FILTROS = [
  { key: 'aguardando_pagamento', label: 'Pendentes' },
  { key: 'todas', label: 'Todas' },
]

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']

function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function iniciais(nome) {
  return (nome || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export default function PreVendasLista({ vendas = [], produtosData = [], updateVenda, sincronizarClienteVenda, LOJA_ID = '', theme, onNovaPreVenda }) {
  const [filtro, setFiltro] = useState('aguardando_pagamento')
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState(null)

  const [cancelando, setCancelando] = useState(null)       // id em confirmação de cancelamento
  const [processandoCancel, setProcessandoCancel] = useState(false)

  const [finalizando, setFinalizando] = useState(null)     // pré-venda aberta pra finalizar
  const [pagamentos, setPagamentos] = useState([{ forma: 'Pix', valor: '' }])
  const [salvandoFinal, setSalvandoFinal] = useState(false)

  const [erroAcao, setErroAcao] = useState('')

  // Só o ciclo de vida da pré-venda propriamente dita — ver o comentário no
  // topo do arquivo sobre por que 'completa' nunca aparece aqui.
  const preVendas = vendas.filter(v => v.status === 'aguardando_pagamento' || v.status === 'cancelada')
  const pendentes = preVendas.filter(v => v.status === 'aguardando_pagamento')
  const totalPendente = pendentes.reduce((s, v) => s + (Number(v.valor) || 0), 0)

  const buscaNorm = busca.trim().toLowerCase()
  const filtradas = preVendas.filter(v => {
    if (filtro !== 'todas' && v.status !== filtro) return false
    if (buscaNorm && !(v.cliente_nome || '').toLowerCase().includes(buscaNorm)) return false
    return true
  })

  function abrirFinalizacao(preVenda) {
    setErroAcao('')
    setFinalizando(preVenda)
    const valorStr = (Number(preVenda.valor) || 0).toFixed(2).replace('.', ',')
    setPagamentos([{ forma: 'Pix', valor: valorStr }])
  }

  function addPgto() {
    setPagamentos(prev => [...prev, { forma: 'Pix', valor: '' }])
  }
  function removePgto(i) {
    setPagamentos(prev => prev.filter((_, idx) => idx !== i))
  }
  function setPgto(i, campo, val) {
    setPagamentos(prev => prev.map((p, idx) => idx === i ? { ...p, [campo]: val } : p))
  }

  const totalFinal = finalizando ? Number(finalizando.valor) || 0 : 0
  const alocado = pagamentos.reduce((s, p) => s + (parseFloat((p.valor || '0').replace(',', '.')) || 0), 0)
  const pgtoOk = Math.abs(alocado - totalFinal) < 0.005

  async function handleConfirmarFinalizacao() {
    if (!pgtoOk || !finalizando) return
    setSalvandoFinal(true)
    setErroAcao('')
    try {
      const forma_pgto = JSON.stringify(pagamentos.map(p => ({
        forma: p.forma,
        valor: parseFloat((p.valor || '0').replace(',', '.')) || 0,
      })))
      // Só status + forma_pgto — o estoque já foi resolvido na bipagem
      // (fix_prevenda_schema.sql), nenhuma chamada a bipar/restaurar aqui.
      // Com a venda confirmada, a cliente entra em lf_clientes pelo mesmo
      // caminho da Nova Venda — ver finalizarPreVenda (utils/prevenda.js).
      const erro = await finalizarPreVenda({ updateVenda, sincronizarClienteVenda }, finalizando, forma_pgto)
      if (erro) { setErroAcao('Não foi possível finalizar agora. Tente de novo.'); return }
      setFinalizando(null)
    } finally {
      setSalvandoFinal(false)
    }
  }

  /**
   * Cancelamento devolve TODA a peça reservada — uma chamada de
   * restaurar_item_prevenda por UNIDADE de cada linha (a RPC só devolve 1
   * por vez, mesmo padrão do bipe). Produto que sumiu do catálogo desde a
   * bipagem é pulado (mesmo comportamento de aplicarEstoque) — a pré-venda
   * ainda assim é marcada cancelada, pra não travar a lojista por causa de
   * um produto que não existe mais.
   */
  async function handleCancelarConfirmado(preVenda) {
    setProcessandoCancel(true)
    setErroAcao('')
    try {
      for (const grupo of itensParaRestaurar(preVenda.produtos)) {
        const produto = encontrarProdutoDoItem(produtosData, grupo)
        if (!produto) continue
        for (let i = 0; i < grupo.vezes; i++) {
          await supabase.rpc('restaurar_item_prevenda', {
            p_loja_id: LOJA_ID, p_produto_id: produto.id, p_variacao: variacaoParaRpc(grupo.variacao),
          })
        }
      }
      const erro = await updateVenda(preVenda.id, { status: 'cancelada' })
      if (erro) { setErroAcao('Não foi possível cancelar agora. Tente de novo.'); return }
      setCancelando(null)
      setExpandido(null)
    } finally {
      setProcessandoCancel(false)
    }
  }

  // ── Subview: finalização ────────────────────────────────────────────────
  if (finalizando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 24 }}>
        <button
          type="button"
          onClick={() => setFinalizando(null)}
          style={{
            alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
            fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 600, color: 'var(--muted)',
          }}
        >
          ← Voltar
        </button>

        <SecaoTitulo
          Icon={CreditCard}
          titulo="Finalizar pré-venda"
          descricao={finalizando.cliente_nome || 'Cliente não identificada'}
          theme={theme}
        />

        {/* Itens — somente leitura de propósito: trocar item aqui reabriria
            a necessidade de mexer em estoque, fora do escopo desta etapa. */}
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-card)', padding: '14px 16px' }}>
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10,
          }}>Itens bipados</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(finalizando.produtos || []).map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, color: 'var(--ink)' }}>
                  {p.nome}{p.variacao && p.variacao !== 'Único' ? ` — ${p.variacao}` : ''}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: 13, color: 'var(--muted)' }}>Total</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(totalFinal)}</span>
        </div>

        <div>
          <p style={{
            fontFamily: 'var(--font-ui)', fontSize: 10, fontWeight: 700, color: 'var(--muted)',
            textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8,
          }}>Formas de pagamento</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pagamentos.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={p.forma}
                  onChange={e => setPgto(i, 'forma', e.target.value)}
                  style={{
                    height: 44, flex: '2 1 0', minWidth: 0,
                    border: '1.5px solid var(--line)', borderRadius: 'var(--r-input)',
                    padding: '0 8px', fontFamily: 'var(--font-ui)', fontSize: 12.5, fontWeight: 600,
                    color: 'var(--ink)', background: 'var(--bg)', outline: 'none', cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  {PGTOS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'var(--font-ui)', pointerEvents: 'none' }}>R$</span>
                  <Input value={p.valor} onChange={e => setPgto(i, 'valor', e.target.value)} placeholder="0,00" style={{ paddingLeft: 30 }} />
                </div>
                {pagamentos.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removePgto(i)}
                    aria-label="Remover forma de pagamento"
                    style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addPgto}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              padding: '7px 14px', borderRadius: 10, border: '1px dashed var(--line)',
              background: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
            }}
          >
            <Plus size={13} /> Adicionar forma
          </button>

          <div style={{
            marginTop: 10, padding: '8px 12px', borderRadius: 10,
            background: pgtoOk ? 'var(--status-ok-bg)' : 'var(--status-bad-bg)',
            fontFamily: 'var(--font-ui)', fontSize: 12, fontWeight: 600,
            color: pgtoOk ? 'var(--status-ok-tx)' : 'var(--status-bad-tx)',
          }}>
            {pgtoOk ? '✓ Pagamento completo' : `Alocado: ${fmtR(alocado)} · Total: ${fmtR(totalFinal)}`}
          </div>
        </div>

        {erroAcao && (
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--status-bad-tx)' }}>{erroAcao}</p>
        )}

        <Button variant="primary" fullWidth icon={Check} disabled={!pgtoOk || salvandoFinal} onClick={handleConfirmarFinalizacao}>
          {salvandoFinal ? 'Salvando...' : 'Confirmar venda'}
        </Button>
      </div>
    )
  }

  // ── Subview: lista ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <SecaoTitulo Icon={ScanLine} titulo="Pré-vendas" descricao="Peças reservadas, aguardando pagamento" theme={theme} style={{ marginBottom: 0 }} />
        {onNovaPreVenda && (
          <Button variant="primary" icon={Plus} onClick={onNovaPreVenda} style={{ flexShrink: 0 }}>Nova</Button>
        )}
      </div>

      <StatGrid>
        <HeroCard>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
            Reservado, aguardando pagamento
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 30, fontWeight: 700, color: '#fff' }}>{fmtR(totalPendente)}</p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 8 }}>
            {pendentes.length} {pendentes.length === 1 ? 'pré-venda pendente' : 'pré-vendas pendentes'}
          </p>
        </HeroCard>
        <StatCard label="Total de pré-vendas" value={preVendas.length} icon={Package} iconColor="var(--status-info-dot)" />
      </StatGrid>

      {preVendas.length === 0 ? (
        <EmptyState
          icon={ScanLine}
          title="Nenhuma pré-venda ainda"
          subtitle={onNovaPreVenda
            ? 'Toque em "Nova" e bipe as peças separadas pela cliente para criar a primeira.'
            : 'Bipe as peças separadas pela cliente para criar a primeira.'}
        />
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ChipRow>
              {FILTROS.map(f => (
                <Chip
                  key={f.key}
                  label={f.label}
                  count={f.key === 'todas' ? preVendas.length : pendentes.length}
                  active={filtro === f.key}
                  onClick={() => setFiltro(f.key)}
                />
              ))}
            </ChipRow>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por cliente..." style={{ paddingLeft: 38 }} />
            </div>
          </div>

          {erroAcao && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--status-bad-tx)' }}>{erroAcao}</p>
          )}

          {filtradas.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title={buscaNorm ? `Nada encontrado para "${busca.trim()}"` : 'Nenhuma pré-venda com esse filtro'}
              subtitle={buscaNorm ? 'Tente buscar por outro nome de cliente.' : 'Experimente outro filtro.'}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtradas.map(pv => {
                const statusInfo = STATUS_MAP[pv.status] || STATUS_MAP.aguardando_pagamento
                const isOpen = expandido === pv.id
                const itens = pv.produtos || []
                const qtdItens = itens.reduce((s, p) => s + Number(p.quantidade || 1), 0)
                const podeAgir = pv.status === 'aguardando_pagamento'
                const confirmandoEste = cancelando === pv.id

                return (
                  <div key={pv.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setExpandido(isOpen ? null : pv.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `color-mix(in srgb, var(--primary) 14%, white)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--primary)',
                      }}>
                        {iniciais(pv.cliente_nome)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pv.cliente_nome || 'Cliente não identificada'}
                        </p>
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {fmtDT(pv.data)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(pv.valor)}</p>
                        <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
                      </div>
                      <ChevronDown size={18} color="var(--muted)" style={{ flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {itens.map((p, i) => (
                            <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'var(--font-ui)' }}>
                              {p.nome}{p.variacao && p.variacao !== 'Único' ? ` — ${p.variacao}` : ''}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}
                            </span>
                          ))}
                        </div>

                        {pv.vendedora && (
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                            <User size={12} /> {pv.vendedora}
                          </p>
                        )}

                        {podeAgir && (
                          confirmandoEste ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <Button variant="secondary" fullWidth onClick={() => setCancelando(null)} disabled={processandoCancel}>Voltar</Button>
                              <Button
                                variant="primary" fullWidth icon={Trash2}
                                style={{ background: 'var(--status-bad-dot)' }}
                                disabled={processandoCancel}
                                onClick={() => handleCancelarConfirmado(pv)}
                              >
                                {processandoCancel ? 'Cancelando...' : 'Confirmar cancelamento'}
                              </Button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <Button variant="secondary" fullWidth icon={Trash2} onClick={() => setCancelando(pv.id)}>Cancelar</Button>
                              <Button variant="primary" fullWidth icon={CreditCard} onClick={() => abrirFinalizacao(pv)}>Finalizar</Button>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
