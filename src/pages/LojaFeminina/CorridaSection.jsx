import { useState } from 'react'
import { Trophy, Gift, ChevronDown, Trash2 } from 'lucide-react'
import { calcularRankingCorrida, diasRestantesCorrida } from '../../utils/corrida'
import Card from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }
function fmtData(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}
function fmtValor(valor, tipo) {
  if (tipo === 'faturamento' || tipo === 'ticket_medio') return fmtR(valor)
  if (tipo === 'pa') return valor.toFixed(1) + ' peças/atend.'
  return Math.round(valor) + ' un.'
}

const CARD_THEMES = [
  { gradient: 'linear-gradient(135deg, #5E2BD0 0%, #8B5CF6 100%)', bar: '#7C3AED' },
  { gradient: 'linear-gradient(135deg, #F2643C 0%, #F97316 100%)', bar: '#EA580C' },
  { gradient: 'linear-gradient(135deg, #0891B2 0%, #38BDF8 100%)', bar: '#0284C7' },
  { gradient: 'linear-gradient(135deg, #16A34A 0%, #4ADE80 100%)', bar: '#15803D' },
]

const TIPO_LABELS = {
  faturamento:        'Faturamento',
  ticket_medio:       'Ticket Médio',
  pa:                 'P.A.',
  quantidade_produto: 'Qtd. Produto',
}

// ── Pódio visual para top 3 ────────────────────────────────────

function Podio({ ranking, tipo }) {
  if (ranking.length === 0) return null
  // ordem visual: 2º (esquerda), 1º (centro), 3º (direita)
  const slots   = [ranking[1], ranking[0], ranking[2]]
  const heights = [68, 96, 50]
  const podBg   = [
    '#e2e8f0',
    'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
    'rgba(217, 119, 6, 0.18)',
  ]
  const podColor = ['#475569', '#fff', '#92400e']
  const avatarBorder = ['#94a3b8', '#D97706', '#B45309']

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 6, padding: '8px 0 0' }}>
      {slots.map((person, vi) => {
        if (!person) return <div key={vi} style={{ flex: 1 }} />
        const isFirst  = vi === 1
        const initials = person.vendedora.substring(0, 1).toUpperCase()
        const shortName = person.vendedora.length > 9 ? person.vendedora.substring(0, 9) + '…' : person.vendedora

        return (
          <div key={person.vendedora} style={{ flex: isFirst ? 1.3 : 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Avatar */}
            <div style={{
              width: isFirst ? 46 : 36, height: isFirst ? 46 : 36, borderRadius: '50%',
              background: isFirst ? 'linear-gradient(135deg, #F59E0B, #D97706)' : 'var(--bg)',
              border: `2.5px solid ${avatarBorder[vi]}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 5,
              boxShadow: isFirst ? '0 2px 10px rgba(245,158,11,0.45)' : 'none',
            }}>
              <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: isFirst ? 17 : 14, color: isFirst ? '#fff' : 'var(--ink)' }}>
                {initials}
              </span>
            </div>

            {/* Nome */}
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--ink)', marginBottom: 2, textAlign: 'center' }}>
              {shortName}
            </p>

            {/* Valor */}
            <p style={{ fontFamily: "'Space Mono', monospace", fontSize: isFirst ? 12 : 10, fontWeight: 700, color: isFirst ? '#D97706' : 'var(--muted)', marginBottom: 6, textAlign: 'center' }}>
              {fmtValor(person.valor, tipo)}
            </p>

            {/* Plataforma */}
            <div style={{
              width: '100%', height: heights[vi],
              background: podBg[vi],
              borderRadius: '8px 8px 0 0',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 800, fontSize: isFirst ? 20 : 16, color: podColor[vi] }}>
                {person.posicao}º
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Card individual de corrida ─────────────────────────────────

function CorridaCard({ corrida, ranking, cardTheme, mobile, onDelete }) {
  const [open, setOpen] = useState(false)
  const isExpanded = !mobile || open
  const dias = diasRestantesCorrida(corrida)
  const lider = ranking[0]
  const maxVal = lider?.valor ?? 0

  const pillBg = dias < 0
    ? 'rgba(100,100,100,0.5)'
    : dias <= 2
    ? 'rgba(239,68,68,0.8)'
    : 'rgba(255,255,255,0.22)'

  const pillLabel = dias < 0 ? 'Encerrada' : dias === 0 ? 'Último dia!' : `faltam ${dias}d`

  return (
    <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)' }}>
      {/* Header */}
      <div
        onClick={mobile ? () => setOpen(o => !o) : undefined}
        style={{
          background: cardTheme.gradient,
          padding: '14px 16px',
          cursor: mobile ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 12,
          userSelect: 'none',
        }}
      >
        <div style={{ width: 34, height: 34, borderRadius: 9, background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Trophy size={17} color="#fff" />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {corrida.nome}
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.78)' }}>
            {fmtData(corrida.data_inicio)} – {fmtData(corrida.data_fim)}
            {mobile && lider && !open && <> · <strong>{lider.vendedora}</strong> lidera</>}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
          <span style={{
            background: pillBg, color: '#fff',
            fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 700,
            padding: '3px 10px', borderRadius: 99,
          }}>
            {pillLabel}
          </span>
          {mobile && (
            <ChevronDown size={15} color="rgba(255,255,255,0.75)"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
          )}
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div style={{ background: 'var(--surface)', padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Prêmio */}
          {corrida.premio_descricao && (
            <div style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px dashed rgba(245,158,11,0.38)', borderRadius: 11, padding: '10px 13px', display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              <Gift size={15} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: '#92400e', lineHeight: 1.45, fontWeight: 600 }}>
                {corrida.premio_descricao}
              </p>
            </div>
          )}

          {/* Sem vendas */}
          {ranking.length === 0 && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', textAlign: 'center', padding: '10px 0' }}>
              Nenhuma venda com vendedor(a) registrada no período ainda.
            </p>
          )}

          {/* Pódio + lista */}
          {ranking.length > 0 && (
            <>
              <Podio ranking={ranking} tipo={corrida.tipo_medicao} />

              {/* Divider */}
              <div style={{ height: 1, background: 'var(--line)' }} />

              {/* Lista com barras */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {ranking.map((r, i) => {
                  const pct = maxVal > 0 ? (r.valor / maxVal) * 100 : 0
                  const isTop3 = i < 3
                  const barBg = i === 0
                    ? 'linear-gradient(90deg, #D97706, #F59E0B)'
                    : `${cardTheme.bar}90`
                  return (
                    <div key={r.vendedora}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: isTop3 ? '#D97706' : 'var(--muted)', minWidth: 22, textAlign: 'right' }}>
                            {r.posicao}º
                          </span>
                          <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
                            {r.vendedora}
                          </span>
                        </div>
                        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: 'var(--ink)', flexShrink: 0 }}>
                          {fmtValor(r.valor, corrida.tipo_medicao)}
                        </span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--line)' }}>
                        <div style={{
                          height: '100%', borderRadius: 3, background: barBg,
                          width: `${pct}%`, transition: 'width 0.65s ease',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* Excluir */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
            <button
              onClick={onDelete}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, fontWeight: 600 }}
              onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef4444' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--muted)'; e.currentTarget.style.borderColor = 'var(--line)' }}
            >
              <Trash2 size={12} /> Excluir corrida
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────

export default function CorridaSection({ vendas, corridas, salvarCorrida, excluirCorrida, produtosData, mobile }) {
  // Form state
  const [nome, setNome] = useState('')
  const [tipoMedicao, setTipoMedicao] = useState('faturamento')
  const [produtoAlvo, setProdutoAlvo] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [premioDescricao, setPremioDescricao] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)

  const produtosList = produtosData.map(p => p.nome).sort()

  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const vigentes  = (corridas || []).filter(c => new Date(c.data_fim + 'T00:00:00') >= hoje)
  const encerradas = (corridas || []).filter(c => new Date(c.data_fim + 'T00:00:00') < hoje)

  const canSave = nome.trim() && dataInicio && dataFim
    && (tipoMedicao !== 'quantidade_produto' || produtoAlvo)

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setFormError(null)
    try {
      const err = await salvarCorrida({
        nome: nome.trim(),
        tipo_medicao: tipoMedicao,
        produto_alvo: tipoMedicao === 'quantidade_produto' ? produtoAlvo : null,
        data_inicio: dataInicio,
        data_fim: dataFim,
        premio_descricao: premioDescricao.trim() || null,
      })
      if (err) {
        setFormError(err.message || 'Erro ao criar corrida.')
      } else {
        setNome('')
        setTipoMedicao('faturamento')
        setProdutoAlvo('')
        setDataInicio('')
        setDataFim('')
        setPremioDescricao('')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    await excluirCorrida(id)
    setConfirmDel(null)
  }

  const selectStyle = {
    width: '100%', height: 44, boxSizing: 'border-box',
    background: 'var(--bg)', border: '1.5px solid var(--line)',
    borderRadius: 12, padding: '0 14px',
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
    color: 'var(--ink)', outline: 'none',
  }

  const toggleBtn = (active) => ({
    flex: 1, height: 38, borderRadius: 9,
    border: `1.5px solid ${active ? 'var(--primary)' : 'var(--line)'}`,
    background: active ? 'var(--primary)' : 'var(--bg)',
    color: active ? '#fff' : 'var(--muted)',
    fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', transition: 'all .15s',
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Formulário nova corrida ── */}
      <Card>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>Nome da corrida</Label>
            <Input
              value={nome} onChange={e => setNome(e.target.value)}
              placeholder="Ex: Corrida do mês de julho"
              onKeyDown={e => e.key === 'Enter' && handleSave()}
            />
          </div>

          <div>
            <Label>Tipo de medição</Label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { v: 'faturamento',        l: 'Faturamento'  },
                { v: 'ticket_medio',       l: 'Ticket Médio' },
                { v: 'pa',                 l: 'P.A.'         },
                { v: 'quantidade_produto', l: 'Qtd. Produto' },
              ].map(opt => (
                <button
                  key={opt.v} type="button"
                  onClick={() => { setTipoMedicao(opt.v); setProdutoAlvo('') }}
                  style={toggleBtn(tipoMedicao === opt.v)}
                >
                  {opt.l}
                </button>
              ))}
            </div>
          </div>

          {tipoMedicao === 'quantidade_produto' && (
            <div>
              <Label>Produto alvo</Label>
              <select
                value={produtoAlvo} onChange={e => setProdutoAlvo(e.target.value)}
                style={{ ...selectStyle, color: produtoAlvo ? 'var(--ink)' : 'var(--muted)' }}
              >
                <option value="">Selecionar produto…</option>
                {produtosList.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <Label>Data início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} />
            </div>
            <div>
              <Label>Data fim</Label>
              <Input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Prêmio / Descrição (opcional)</Label>
            <Input
              value={premioDescricao} onChange={e => setPremioDescricao(e.target.value)}
              placeholder="Ex: Vale compra de R$100"
            />
          </div>

          {formError && (
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: '#dc2626' }}>
              {formError}
            </p>
          )}

          <Button variant="primary" onClick={handleSave} disabled={saving || !canSave}>
            {saving ? '…' : 'Criar corrida'}
          </Button>
        </div>
      </Card>

      {/* ── Corridas vigentes ── */}
      {vigentes.length === 0 && encerradas.length === 0 ? (
        <Card padding={0}>
          <EmptyState
            icon={Trophy}
            title="Nenhuma corrida criada"
            subtitle="Crie uma corrida para motivar sua equipe com ranking ao vivo."
          />
        </Card>
      ) : (
        <>
          {vigentes.map((corrida, i) => {
            const cardTheme = CARD_THEMES[i % CARD_THEMES.length]
            const ranking = calcularRankingCorrida(vendas, corrida)
            return (
              <CorridaCard
                key={corrida.id}
                corrida={corrida}
                ranking={ranking}
                cardTheme={cardTheme}
                mobile={mobile}
                onDelete={() => setConfirmDel(corrida)}
              />
            )
          })}

          {encerradas.length > 0 && (
            <EncerradasSection
              encerradas={encerradas}
              vendas={vendas}
              mobile={mobile}
              onDelete={(c) => setConfirmDel(c)}
              vigentesCount={vigentes.length}
            />
          )}
        </>
      )}

      {/* ── Modal de confirmação de exclusão ── */}
      {confirmDel && (
        <div
          onClick={() => setConfirmDel(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: 'var(--surface)', borderRadius: '20px 20px 0 0', padding: '28px 20px 36px', width: '100%', maxWidth: 480, boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}
          >
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, fontSize: 15, color: 'var(--ink)', marginBottom: 6 }}>
              Excluir corrida?
            </p>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 20 }}>
              Excluir <strong>"{confirmDel.nome}"</strong>? O ranking será perdido e esta ação não pode ser desfeita.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmDel(null)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: 'var(--bg)', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 600, color: 'var(--ink)', fontSize: 14 }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDel.id)}
                style={{ flex: 1, height: 44, borderRadius: 12, border: 'none', background: '#ef4444', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 700, color: '#fff', fontSize: 14 }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Seção colapsável de corridas encerradas ────────────────────

function EncerradasSection({ encerradas, vendas, mobile, onDelete, vigentesCount }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
      >
        <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s' }} />
        Encerradas ({encerradas.length})
      </button>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          {encerradas.map((corrida, i) => {
            const idx = (vigentesCount + i) % CARD_THEMES.length
            const cardTheme = CARD_THEMES[idx]
            const ranking = calcularRankingCorrida(vendas, corrida)
            return (
              <CorridaCard
                key={corrida.id}
                corrida={corrida}
                ranking={ranking}
                cardTheme={cardTheme}
                mobile={mobile}
                onDelete={() => onDelete(corrida)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
