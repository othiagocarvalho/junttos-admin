import { useState } from 'react'
import { ShoppingBag, Copy, Check, ChevronDown, MessageCircle, Search, Clock, CheckCircle2, Package, Pencil, Trash2, Eye, EyeOff, X } from 'lucide-react'
import StatCard, { StatGrid } from '../../components/studio/StatCard'
import { HeroCard } from '../../components/studio/Card'
import StatusPill from '../../components/studio/StatusPill'
import Button from '../../components/studio/Button'
import Input from '../../components/studio/Input'
import Chip, { ChipRow } from '../../components/studio/Chip'
import EmptyState from '../../components/studio/EmptyState'
import { fmtR } from '../../utils/formatters'

function fmtDT(s) {
  return new Date(s).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function iniciais(nome) {
  return (nome || '?').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// aguardando_contato vem do catálogo público novo (CatalogoPublicoV2): o
// pedido é gravado no instante em que a cliente toca em "Enviar pedido no
// WhatsApp", ANTES de a conversa existir. Serve para a lojista ver a intenção
// mesmo quando a mensagem nunca chega. Não é pagamento pendente — daí o tom
// 'info' em vez de 'warn', que continua sendo só de quem já fechou e não pagou.
const STATUS_MAP = {
  aguardando_contato:   { label: 'Aguardando contato',   tone: 'info' },
  aguardando_pagamento: { label: 'Aguardando pagamento', tone: 'warn' },
  pago:                 { label: 'Pago',                 tone: 'ok' },
  cancelado:            { label: 'Cancelado',            tone: 'bad' },
}

/**
 * Caixa modal simples, usada pela edição e pela confirmação de exclusão.
 *
 * Não virou componente de studio/ porque é o único lugar que precisa dela
 * hoje; se um segundo aparecer, sobe para lá. O clique no fundo fecha, e o
 * clique dentro não propaga — sem isso, mexer no formulário fecharia o
 * diálogo.
 */
function Dialogo({ titulo, aoFechar, children }) {
  return (
    <div
      onClick={aoFechar}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 'var(--r-card)',
          width: 'min(420px, 100%)', maxHeight: '88vh', overflow: 'auto',
          boxSizing: 'border-box',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '16px 18px', borderBottom: '1px solid var(--line)',
        }}>
          <p style={{
            flex: 1, margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: 15, fontWeight: 700, color: 'var(--ink)',
          }}>{titulo}</p>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0, cursor: 'pointer',
              border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          ><X size={15} /></button>
        </div>
        <div style={{ padding: 18 }}>{children}</div>
      </div>
    </div>
  )
}

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'aguardando_contato', label: 'Contato' },
  { key: 'aguardando_pagamento', label: 'Aguardando' },
  { key: 'pago', label: 'Pagos' },
  { key: 'cancelado', label: 'Cancelados' },
]

// Status que a lojista pode escolher na mão. É a mesma lista do STATUS_MAP —
// sair dela criaria pedido com status que nenhuma tela sabe desenhar.
const STATUS_EDITAVEIS = Object.keys(STATUS_MAP)

export default function PedidosCatalogo({
  pedidos = [], updatePedido, cancelarPedido, excluirPedido, theme, lojaId,
  // Opcionais: quando o ponto de montagem não passa config/saveConfig, o botão
  // de publicar simplesmente não aparece e o resto da tela segue igual.
  config = null, saveConfig,
}) {
  const [atualizando, setAtualizando] = useState(null)
  const [copiado, setCopiado] = useState(false)
  const [expandido, setExpandido] = useState(null)
  const [filtro, setFiltro] = useState('todos')
  const [busca, setBusca] = useState('')
  // Pedido em edição (objeto) e rascunho do formulário.
  const [editando, setEditando] = useState(null)
  const [rascunho, setRascunho] = useState({ status: '', nome: '', whatsapp: '' })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)
  const [erroEdicao, setErroEdicao] = useState('')
  // Confirmação de exclusão em DUAS etapas: o id só entra aqui depois do
  // primeiro clique, e o segundo clique é num botão diferente, dentro do
  // diálogo. Um clique nunca apaga.
  const [confirmandoExclusao, setConfirmandoExclusao] = useState(null)
  const [excluindo, setExcluindo] = useState(false)
  const [erroExclusao, setErroExclusao] = useState('')
  const [publicando, setPublicando] = useState(false)
  const [erroPublicar, setErroPublicar] = useState('')

  // Coluna ausente (migration ainda não rodada) conta como PUBLICADO: o
  // catálogo das 13 lojas está no ar hoje, e o padrão nunca pode derrubá-lo.
  const publicado = config?.catalogo_publicado !== false
  const podePublicar = !!config && typeof saveConfig === 'function'

  const linkCatalogo = `${window.location.origin}/${lojaId}/catalogo`

  const now = new Date()
  const hoje = now.toDateString()

  const contato = pedidos.filter(p => p.status === 'aguardando_contato')
  const aguardando = pedidos.filter(p => p.status === 'aguardando_pagamento')
  const pagos = pedidos.filter(p => p.status === 'pago')
  const cancelados = pedidos.filter(p => p.status === 'cancelado')
  const pagosHoje = pedidos.filter(p => p.status === 'pago' && new Date(p.created_at).toDateString() === hoje)
  const totalHoje = pagosHoje.reduce((s, p) => s + Number(p.valor_total), 0)

  const COUNTS = {
    todos: pedidos.length,
    aguardando_contato: contato.length,
    aguardando_pagamento: aguardando.length,
    pago: pagos.length,
    cancelado: cancelados.length,
  }

  const buscaNorm = busca.trim().toLowerCase()
  const filtrados = pedidos.filter(p => {
    if (filtro !== 'todos' && p.status !== filtro) return false
    if (buscaNorm && !(p.cliente_nome || '').toLowerCase().includes(buscaNorm)) return false
    return true
  })

  async function marcarPago(id) {
    setAtualizando(id)
    try { await updatePedido(id, { status: 'pago' }) } catch (e) { alert('Erro: ' + e.message) }
    setAtualizando(null)
  }

  // cancelarPedido devolve ao estoque o que o checkout já tinha baixado —
  // updatePedido sozinho só mudaria o status e deixaria a peça reservada.
  async function cancelar(id) {
    setAtualizando(id)
    try { await cancelarPedido(id) } catch (e) { alert('Erro: ' + e.message) }
    setAtualizando(null)
  }

  function copiarLink() {
    navigator.clipboard.writeText(linkCatalogo)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function limparFiltros() {
    setFiltro('todos')
    setBusca('')
  }

  function abrirEdicao(pedido) {
    setErroEdicao('')
    setEditando(pedido)
    setRascunho({
      status: pedido.status || 'aguardando_pagamento',
      nome: pedido.cliente_nome || '',
      whatsapp: pedido.cliente_whatsapp || '',
    })
  }

  /**
   * Salva status e contato.
   *
   * Os ITENS do pedido não entram: mexer neles exigiria refazer a baixa de
   * estoque que o checkout já aplicou (ver aplicarEstoque em useLojaData), e
   * isso é conserto de venda, não correção de cadastro. O que a lojista pediu
   * — corrigir status e erro de digitação no contato — está tudo aqui.
   *
   * Sobre trocar o status na mão: NÃO passa por cancelarPedido, então marcar
   * "cancelado" por aqui não devolve estoque. É por isso que o botão Cancelar
   * do card continua existindo e o aviso abaixo do seletor explica a
   * diferença — tirar um em favor do outro perderia comportamento.
   */
  async function salvarEdicao() {
    if (!editando) return
    setSalvandoEdicao(true)
    setErroEdicao('')
    try {
      await updatePedido(editando.id, {
        status: rascunho.status,
        cliente_nome: rascunho.nome.trim(),
        cliente_whatsapp: rascunho.whatsapp.trim(),
      })
      setEditando(null)
    } catch (e) {
      setErroEdicao(e?.message || 'Não foi possível salvar. Tente de novo.')
    } finally {
      setSalvandoEdicao(false)
    }
  }

  async function confirmarExclusao() {
    if (!confirmandoExclusao) return
    setExcluindo(true)
    setErroExclusao('')
    try {
      await excluirPedido(confirmandoExclusao.id)
      setConfirmandoExclusao(null)
      setExpandido(null)
    } catch (e) {
      setErroExclusao(e?.message || 'Não foi possível excluir. Tente de novo.')
    } finally {
      setExcluindo(false)
    }
  }

  async function alternarPublicacao() {
    if (!podePublicar) return
    setPublicando(true)
    setErroPublicar('')
    try {
      // saveConfig DEVOLVE o erro em vez de lançar (useLojaData.js). Ignorar o
      // retorno é o que fazia a tela de Configurações mostrar sucesso sem ter
      // salvado nada — aqui ele é conferido.
      const erro = await saveConfig({ catalogo_publicado: !publicado })
      if (erro) setErroPublicar('Não foi possível mudar a publicação: ' + (erro.message || erro))
    } catch (e) {
      setErroPublicar('Não foi possível mudar a publicação: ' + (e?.message || e))
    } finally {
      setPublicando(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Pedidos do catálogo</p>
      </div>

      {/* Copiar link e publicar andam juntos: são as duas decisões sobre "o
          catálogo está no ar?". flex-wrap resolve o celular sem media query. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button
          variant="secondary"
          icon={copiado ? Check : Copy}
          onClick={copiarLink}
          style={{ color: copiado ? 'var(--status-ok-tx)' : 'var(--ink)' }}
        >
          {copiado ? 'Copiado!' : 'Copiar link do catálogo'}
        </Button>

        {podePublicar && (
          <button
            type="button"
            onClick={alternarPublicacao}
            disabled={publicando}
            aria-pressed={publicado}
            title={publicado
              ? 'O catálogo está no ar. Clique para tirar do ar.'
              : 'O catálogo está fora do ar. Clique para publicar.'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              height: 40, padding: '0 14px', borderRadius: 'var(--r-input)',
              cursor: publicando ? 'progress' : 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
              // Verde = no ar. Laranja = fora do ar, e é um estado que precisa
              // saltar aos olhos: loja despublicada sem querer não vende.
              border: `1px solid ${publicado ? 'var(--status-ok-dot)' : 'var(--status-warn-dot)'}`,
              background: publicado ? 'var(--status-ok-bg, rgba(15,123,69,.08))' : 'var(--status-warn-bg, rgba(202,138,4,.10))',
              color: publicado ? 'var(--status-ok-tx)' : 'var(--status-warn-tx, #92400e)',
              opacity: publicando ? 0.6 : 1,
            }}
          >
            {publicado ? <Eye size={15} /> : <EyeOff size={15} />}
            {publicando ? 'Salvando...' : publicado ? 'Catálogo publicado' : 'Catálogo fora do ar'}
          </button>
        )}
      </div>

      {erroPublicar && (
        <p role="alert" style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, lineHeight: 1.5,
          color: 'var(--status-bad-tx)', background: 'rgba(180,56,31,.08)',
          border: '1px solid var(--status-bad-tx)', borderRadius: 'var(--r-input)',
          padding: '10px 12px', margin: 0,
        }}>{erroPublicar}</p>
      )}

      {!publicado && podePublicar && (
        <p style={{
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, lineHeight: 1.5,
          color: 'var(--status-warn-tx, #92400e)', background: 'rgba(202,138,4,.08)',
          border: '1px solid rgba(202,138,4,.25)', borderRadius: 'var(--r-input)',
          padding: '10px 12px', margin: 0,
        }}>
          Quem abrir o link vê um aviso de "voltamos em breve" com o seu WhatsApp.
          Nenhuma peça e nenhum preço aparecem enquanto estiver fora do ar.
        </p>
      )}

      {/* Cards de resumo */}
      <StatGrid>
        {contato.length > 0 && (
          <StatCard label="Aguardando contato" value={contato.length} icon={MessageCircle} iconColor="var(--status-info-dot)" />
        )}
        <StatCard label="Aguardando" value={aguardando.length} icon={Clock} iconColor="var(--status-warn-dot)" />
        <StatCard label="Pagos" value={pagos.length} icon={CheckCircle2} iconColor="var(--status-ok-dot)" />
        <HeroCard tone="primary">
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.78)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Recebido hoje</p>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1 }}>{fmtR(totalHoje)}</p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.78)', marginTop: 10 }}>
            {pagosHoje.length} {pagosHoje.length === 1 ? 'pedido pago' : 'pedidos pagos'} hoje
          </p>
        </HeroCard>
        <StatCard label="Total de pedidos" value={pedidos.length} icon={Package} iconColor="var(--status-info-dot)" />
      </StatGrid>

      {pedidos.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Nenhum pedido ainda"
          subtitle="Compartilhe o link do catálogo para receber pedidos com pagamento."
        />
      ) : (
        <>
          {/* Filtros por status + busca */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ChipRow>
              {FILTROS.map(f => (
                <Chip key={f.key} label={f.label} count={COUNTS[f.key]} active={filtro === f.key} onClick={() => setFiltro(f.key)} />
              ))}
            </ChipRow>
            <div style={{ position: 'relative' }}>
              <Search size={16} color="var(--muted)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
              <Input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por cliente..."
                style={{ paddingLeft: 38 }}
              />
            </div>
          </div>

          {/* Lista de pedidos */}
          {filtrados.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={buscaNorm ? `Nada encontrado para "${busca.trim()}"` : 'Nenhum pedido com esse status'}
              subtitle={buscaNorm ? 'Tente buscar por outro nome de cliente.' : 'Experimente outro filtro ou veja todos os pedidos.'}
              actionLabel={buscaNorm ? 'Limpar busca' : 'Ver todos'}
              onAction={limparFiltros}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filtrados.map(pedido => {
                const statusInfo = STATUS_MAP[pedido.status] || STATUS_MAP.aguardando_pagamento
                // Só pedido que passou pelo checkout ganha "Marcar como pago" e
                // "Cancelar". aguardando_contato fica de fora de propósito:
                // cancelarPedido devolve ao estoque o que o checkout baixou, e
                // esses pedidos nunca baixaram nada — cancelar um deles
                // inflaria o estoque. Enquanto não houver contato, a linha é só
                // registro da intenção.
                const isAguardando = pedido.status === 'aguardando_pagamento'
                const busy = atualizando === pedido.id
                const isOpen = expandido === pedido.id
                const itens = pedido.produtos || []
                const qtdItens = itens.reduce((s, p) => s + Number(p.qtd || 0), 0)
                const waDigits = (pedido.cliente_whatsapp || '').replace(/\D/g, '')

                return (
                  <div key={pedido.id} style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-card)', overflow: 'hidden' }}>
                    <button
                      type="button"
                      onClick={() => setExpandido(isOpen ? null : pedido.id)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', boxSizing: 'border-box' }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: `color-mix(in srgb, ${theme.primary} 14%, white)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: theme.primary,
                      }}>
                        {iniciais(pedido.cliente_nome)}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {pedido.cliente_nome}
                        </p>
                        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {qtdItens} {qtdItens === 1 ? 'item' : 'itens'} · {fmtDT(pedido.created_at)}
                        </p>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                        <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>{fmtR(pedido.valor_total)}</p>
                        <StatusPill tone={statusInfo.tone} label={statusInfo.label} />
                      </div>

                      <ChevronDown size={18} color="var(--muted)" style={{ flexShrink: 0, transition: 'transform .15s', transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {isOpen && (
                      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12 }} />

                        {itens.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: -12 }}>
                            {itens.map((p, i) => (
                              <span key={i} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 'var(--r-chip)', background: 'var(--bg)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                                {p.qtd}× {p.nome}{p.variacao ? ` (${p.variacao})` : ''}
                              </span>
                            ))}
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {waDigits && (
                            <a
                              href={`https://wa.me/55${waDigits}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={e => e.stopPropagation()}
                              style={{
                                flex: '1 1 140px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--bg)',
                                color: 'var(--ink)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, textDecoration: 'none',
                              }}
                            >
                              <MessageCircle size={15} /> WhatsApp
                            </a>
                          )}
                          {isAguardando && (
                            <>
                              <button
                                onClick={e => { e.stopPropagation(); marcarPago(pedido.id) }}
                                disabled={busy}
                                style={{
                                  flex: '1 1 140px', height: 40, borderRadius: 'var(--r-input)', border: 'none',
                                  background: busy ? 'var(--line)' : 'var(--status-ok-dot)', color: '#fff',
                                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
                                }}
                              >
                                {busy ? '...' : 'Marcar como pago'}
                              </button>
                              <button
                                onClick={e => { e.stopPropagation(); cancelar(pedido.id) }}
                                disabled={busy}
                                style={{
                                  flex: '1 1 100px', height: 40, borderRadius: 'var(--r-input)', border: '1px solid var(--line)',
                                  background: 'var(--bg)', color: 'var(--status-bad-tx)',
                                  cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                                }}
                              >
                                Cancelar
                              </button>
                            </>
                          )}
                        </div>

                        {/* Editar e Excluir valem para QUALQUER status — é o
                            ponto delas: corrigir um pedido que ficou com o
                            status errado, ou apagar teste e duplicado. Ficam
                            numa linha própria, separadas das ações de fluxo
                            acima, para ninguém apertar Excluir achando que
                            está cancelando. */}
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                          <button
                            onClick={e => { e.stopPropagation(); abrirEdicao(pedido) }}
                            style={{
                              flex: '1 1 120px', height: 38, borderRadius: 'var(--r-input)',
                              border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)',
                              cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            }}
                          >
                            <Pencil size={14} /> Editar
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setErroExclusao(''); setConfirmandoExclusao(pedido) }}
                            style={{
                              flex: '1 1 120px', height: 38, borderRadius: 'var(--r-input)',
                              border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--status-bad-tx)',
                              cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                            }}
                          >
                            <Trash2 size={14} /> Excluir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Editar pedido ─────────────────────────────────────────────────── */}
      {editando && (
        <Dialogo titulo="Editar pedido" aoFechar={() => !salvandoEdicao && setEditando(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={rotulo}>Status</label>
              <select
                value={rascunho.status}
                onChange={e => setRascunho(r => ({ ...r, status: e.target.value }))}
                style={{
                  width: '100%', height: 44, boxSizing: 'border-box',
                  background: 'var(--bg)', border: '1.5px solid var(--line)',
                  borderRadius: 12, padding: '0 14px',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, color: 'var(--ink)',
                }}
              >
                {STATUS_EDITAVEIS.map(k => (
                  <option key={k} value={k}>{STATUS_MAP[k].label}</option>
                ))}
              </select>
              {/* A diferença que mais custa caro se ninguém contar. */}
              {rascunho.status === 'cancelado' && editando.status !== 'cancelado' && (
                <p style={{
                  margin: '7px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: 12, lineHeight: 1.5, color: 'var(--status-warn-tx, #92400e)',
                }}>
                  Cancelar por aqui só muda o status. Para devolver as peças ao estoque,
                  use o botão <strong>Cancelar</strong> no próprio pedido.
                </p>
              )}
            </div>

            <div>
              <label style={rotulo}>Nome do cliente</label>
              <Input value={rascunho.nome} onChange={e => setRascunho(r => ({ ...r, nome: e.target.value }))} placeholder="Nome" />
            </div>

            <div>
              <label style={rotulo}>WhatsApp</label>
              <Input
                value={rascunho.whatsapp}
                onChange={e => setRascunho(r => ({ ...r, whatsapp: e.target.value }))}
                placeholder="85999990000"
                inputMode="tel"
              />
            </div>

            {/* Os itens ficam de fora de propósito: mexer neles exigiria
                refazer a baixa de estoque do checkout, que é conserto de venda
                e não correção de cadastro. */}
            <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Os itens e o valor do pedido não são editáveis por aqui.
            </p>

            {erroEdicao && (
              <p role="alert" style={{
                margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, lineHeight: 1.5,
                color: 'var(--status-bad-tx)', background: 'rgba(180,56,31,.08)',
                border: '1px solid var(--status-bad-tx)', borderRadius: 'var(--r-input)', padding: '10px 12px',
              }}>{erroEdicao}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setEditando(null)}
                disabled={salvandoEdicao}
                style={{
                  flex: '1 1 120px', height: 44, borderRadius: 'var(--r-input)',
                  border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)',
                  cursor: salvandoEdicao ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
                }}
              >Voltar</button>
              <button
                onClick={salvarEdicao}
                disabled={salvandoEdicao || !rascunho.nome.trim()}
                style={{
                  flex: '1 1 140px', height: 44, borderRadius: 'var(--r-input)', border: 'none',
                  background: theme?.primary || 'var(--ink)', color: '#fff',
                  cursor: salvandoEdicao || !rascunho.nome.trim() ? 'not-allowed' : 'pointer',
                  opacity: salvandoEdicao || !rascunho.nome.trim() ? 0.6 : 1,
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
                }}
              >{salvandoEdicao ? 'Salvando...' : 'Salvar alterações'}</button>
            </div>
          </div>
        </Dialogo>
      )}

      {/* ── Excluir: SEGUNDA etapa ────────────────────────────────────────────
          O primeiro clique (no card) só abre isto. Apagar exige um segundo
          clique, num botão diferente, com o nome do cliente na frente para a
          pessoa conferir que é o pedido certo. */}
      {confirmandoExclusao && (
        <Dialogo titulo="Excluir pedido" aoFechar={() => !excluindo && setConfirmandoExclusao(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, lineHeight: 1.6, color: 'var(--ink)' }}>
              Tem certeza? <strong>Esta ação não pode ser desfeita.</strong>
            </p>
            <div style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderRadius: 'var(--r-input)', padding: '12px 14px' }}>
              <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                {confirmandoExclusao.cliente_nome}
              </p>
              <p style={{ margin: '3px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'var(--muted)' }}>
                {fmtR(confirmandoExclusao.valor_total)} · {fmtDT(confirmandoExclusao.created_at)}
              </p>
            </div>
            {/* Excluir NÃO devolve estoque — cancelar devolve. Quem apaga um
                pedido que já baixou peça deixa a peça reservada para sempre. */}
            <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, lineHeight: 1.55, color: 'var(--status-warn-tx, #92400e)' }}>
              Excluir <strong>não devolve peças ao estoque</strong>. Se este pedido chegou a
              reservar estoque, cancele antes de excluir.
            </p>

            {erroExclusao && (
              <p role="alert" style={{
                margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, lineHeight: 1.5,
                color: 'var(--status-bad-tx)', background: 'rgba(180,56,31,.08)',
                border: '1px solid var(--status-bad-tx)', borderRadius: 'var(--r-input)', padding: '10px 12px',
              }}>{erroExclusao}</p>
            )}

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => setConfirmandoExclusao(null)}
                disabled={excluindo}
                style={{
                  flex: '1 1 120px', height: 44, borderRadius: 'var(--r-input)',
                  border: '1px solid var(--line)', background: 'var(--bg)', color: 'var(--ink)',
                  cursor: excluindo ? 'not-allowed' : 'pointer',
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
                }}
              >Manter pedido</button>
              <button
                onClick={confirmarExclusao}
                disabled={excluindo}
                style={{
                  flex: '1 1 150px', height: 44, borderRadius: 'var(--r-input)', border: 'none',
                  background: 'var(--status-bad-tx)', color: '#fff',
                  cursor: excluindo ? 'not-allowed' : 'pointer', opacity: excluindo ? 0.6 : 1,
                  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              ><Trash2 size={15} /> {excluindo ? 'Excluindo...' : 'Excluir definitivamente'}</button>
            </div>
          </div>
        </Dialogo>
      )}
    </div>
  )
}

const rotulo = {
  display: 'block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11,
  fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
  letterSpacing: '0.1em', marginBottom: 7,
}
