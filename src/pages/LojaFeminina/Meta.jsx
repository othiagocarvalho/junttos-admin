import { useState, useRef } from 'react'
import { Target, Lock } from 'lucide-react'
import Card from '../../components/studio/Card'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import { temAcesso } from '../../utils/planos'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

const sectionLabelStyle = {
  fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700,
  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em',
}

function ProgressBar({ pct }) {
  const clamped = Math.min(Math.max(pct, 0), 100)
  return (
    <div style={{ width: '100%', height: 14, borderRadius: 'var(--r-pill)', background: 'var(--bg)', overflow: 'hidden' }}>
      <div style={{
        width: `${clamped}%`, height: '100%', borderRadius: 'var(--r-pill)',
        background: 'linear-gradient(90deg, var(--primary) 0%, var(--accent) 100%)',
        transition: 'width 0.7s ease',
      }} />
    </div>
  )
}

function ProBadge() {
  return (
    <span style={{
      background: '#dbeafe', color: '#1d4ed8', fontSize: 9, fontWeight: 700,
      borderRadius: 99, padding: '2px 7px', textTransform: 'uppercase',
      letterSpacing: '0.1em', verticalAlign: 'middle', marginLeft: 6,
    }}>Pro</span>
  )
}

function ProLock() {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '4px 0' }}>
        <Lock size={16} color="var(--muted)" strokeWidth={2} style={{ flexShrink: 0 }} />
        <div>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
            Recurso exclusivo Pro
          </p>
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)' }}>
            Faça upgrade para o plano Pro para desbloquear.
          </p>
        </div>
      </div>
    </Card>
  )
}

export default function Meta({ vendas, metas, salvarMeta, metasVendedora = [], salvarMetaVendedora, plano }) {
  const temPro = temAcesso(plano, 'pro')
  const now = new Date()
  const currentYM = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')

  // ── Meta geral state ──
  const [mes, setMes] = useState(currentYM)
  const [valor, setValor] = useState('')
  const [saving, setSaving] = useState(false)
  const valorInputRef = useRef(null)

  const meta = metas[mes] || 0
  const [y, m] = mes.split('-').map(Number)
  const vendasMes = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === y && d.getMonth() + 1 === m
  })
  const realizado = vendasMes.reduce((s, v) => s + Number(v.valor), 0)
  const diasNoMes = new Date(y, m, 0).getDate()
  const diaAtual = mes === currentYM ? now.getDate() : diasNoMes
  const diasRestantes = Math.max(diasNoMes - diaAtual, 0)
  const mediaDiaria = diaAtual > 0 ? realizado / diaAtual : 0
  const projecao = mediaDiaria * diasNoMes
  const pct = meta > 0 ? (realizado / meta) * 100 : 0
  const atingida = meta > 0 && realizado >= meta
  const precisaDia = diasRestantes > 0 && meta > realizado ? fmtR((meta - realizado) / diasRestantes) : null

  async function handleSave() {
    const v = parseFloat(valor.replace(',', '.'))
    if (!v || v <= 0) return
    setSaving(true)
    try {
      const err = await salvarMeta(mes, v)
      if (!err) setValor('')
    } finally {
      setSaving(false)
    }
  }

  // ── Meta por vendedora state ──
  const vendedoras = [...new Set(vendas.filter(v => v.vendedora).map(v => v.vendedora))].sort()
  const [mesVend, setMesVend] = useState(currentYM)
  const [vendedoraSel, setVendedoraSel] = useState('')
  const [valorVend, setValorVend] = useState('')
  const [savingVend, setSavingVend] = useState(false)

  const [yV, mV] = mesVend.split('-').map(Number)
  const vendasMesVend = vendas.filter(v => {
    const d = new Date(v.data)
    return d.getFullYear() === yV && d.getMonth() + 1 === mV
  })

  async function handleSaveVend() {
    if (!vendedoraSel) return
    const v = parseFloat(valorVend.replace(',', '.'))
    if (!v || v <= 0) return
    setSavingVend(true)
    try {
      const err = await salvarMetaVendedora(mesVend, vendedoraSel, v)
      if (!err) setValorVend('')
    } finally {
      setSavingVend(false)
    }
  }

  // ── Comparativo últimos 6 meses ──
  const mesesComp = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const metaValor = metas[ym] || 0
    const realizadoMes = vendas
      .filter(v => { const dd = new Date(v.data); return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth() })
      .reduce((s, v) => s + Number(v.valor), 0)
    mesesComp.push({
      ym,
      label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      meta: metaValor,
      realizado: realizadoMes,
      pct: metaValor > 0 ? Math.min((realizadoMes / metaValor) * 100, 999) : null,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, overflowX: 'hidden', maxWidth: '100%', boxSizing: 'border-box' }}>

      {/* ══ Meta Geral (Starter) ══ */}
      <Card>
        <p style={{ ...sectionLabelStyle, marginBottom: 16 }}>Definir Meta Mensal</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Label>Mês / Ano</Label>
            <Input type="month" value={mes} onChange={e => setMes(e.target.value)} />
          </div>
          <div>
            <Label>
              Valor da meta{meta > 0 && <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> — atual: {fmtR(meta)}</span>}
            </Label>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', zIndex: 1 }}>R$</span>
                <Input
                  ref={valorInputRef}
                  mono
                  value={valor} onChange={e => setValor(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                  placeholder="0,00"
                  inputMode="decimal"
                  style={{ paddingLeft: 36 }}
                />
              </div>
              <Button variant="primary" onClick={handleSave} disabled={saving || !valor}>
                {saving ? '...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {meta > 0 ? (
        <Card padding="24px 18px">
          <p style={{ ...sectionLabelStyle, marginBottom: 20, textAlign: 'center' }}>
            {new Date(y, m - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
          </p>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 40, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
              {Math.min(pct, 100).toFixed(0)}%
            </span>
            <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 4, fontWeight: 600 }}>da meta</p>
          </div>
          <div style={{ marginBottom: 24 }}>
            <ProgressBar pct={pct} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Realizado', value: fmtR(realizado), sub: `${vendasMes.length} vendas` },
              { label: atingida ? 'Meta batida' : 'Faltam', value: atingida ? '🎉' : fmtR(Math.max(meta - realizado, 0)), sub: atingida ? 'Parabéns!' : `${diasRestantes}d restantes` },
              { label: 'Projeção', value: fmtR(projecao), sub: projecao >= meta ? '✅ No caminho' : '⚠️ Abaixo' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg)', borderRadius: 'var(--r-input)', padding: '12px 10px', textAlign: 'center' }}>
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>{s.label}</p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: 'var(--ink)', lineHeight: 1, marginBottom: 3 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{s.sub}</p>
              </div>
            ))}
          </div>
          {precisaDia && !atingida && (
            <div style={{ marginTop: 14, background: 'var(--bg)', borderRadius: 'var(--r-input)', padding: '12px 16px', textAlign: 'center' }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                Para bater a meta, precisa de{' '}
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{precisaDia}/dia</span>
                {' '}nos {diasRestantes} dias restantes.
              </p>
            </div>
          )}
        </Card>
      ) : (
        <Card padding={0}>
          <EmptyState
            icon={Target}
            title="Nenhuma meta definida"
            subtitle="Defina o alvo do mês para acompanhar seu progresso."
            actionLabel="Definir meta"
            onAction={() => valorInputRef.current?.focus()}
          />
        </Card>
      )}

      {/* ══ Meta por Vendedora (Pro) ══ */}
      <div>
        <p style={{ ...sectionLabelStyle, marginBottom: 12 }}>
          Meta por Vendedor(a)<ProBadge />
        </p>
        {!temPro ? <ProLock /> : (
          <>
            <Card style={{ marginBottom: 10 }}>
              {vendedoras.length === 0 ? (
                <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12, color: 'var(--muted)', padding: '4px 0' }}>
                  Nenhum(a) vendedor(a) registrado(a). Adicione o campo vendedor(a) ao lançar vendas.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <Label>Vendedor(a)</Label>
                    <select
                      value={vendedoraSel}
                      onChange={e => setVendedoraSel(e.target.value)}
                      style={{
                        width: '100%', height: 44, boxSizing: 'border-box',
                        background: 'var(--bg)', border: '1.5px solid var(--line)',
                        borderRadius: 12, padding: '0 14px',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14,
                        color: vendedoraSel ? 'var(--ink)' : 'var(--muted)', outline: 'none',
                      }}
                    >
                      <option value="">Selecionar vendedor(a)…</option>
                      {vendedoras.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Mês / Ano</Label>
                    <Input type="month" value={mesVend} onChange={e => setMesVend(e.target.value)} />
                  </div>
                  <div>
                    <Label>
                      Valor da meta
                      {vendedoraSel && (() => {
                        const atual = metasVendedora.find(mv => mv.vendedora === vendedoraSel && mv.mes === mesVend)?.valor
                        return atual ? <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}> — atual: {fmtR(atual)}</span> : null
                      })()}
                    </Label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--muted)', fontFamily: 'Plus Jakarta Sans, sans-serif', zIndex: 1 }}>R$</span>
                        <Input
                          mono
                          value={valorVend} onChange={e => setValorVend(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleSaveVend()}
                          placeholder="0,00"
                          inputMode="decimal"
                          style={{ paddingLeft: 36 }}
                        />
                      </div>
                      <Button variant="primary" onClick={handleSaveVend} disabled={savingVend || !valorVend || !vendedoraSel}>
                        {savingVend ? '...' : 'Salvar'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {vendedoras.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {vendedoras.map(vendedora => {
                  const metaVRow = metasVendedora.find(mv => mv.vendedora === vendedora && mv.mes === mesVend)
                  const metaV = metaVRow?.valor || 0
                  const vendasV = vendasMesVend.filter(v => v.vendedora === vendedora)
                  const realizadoV = vendasV.reduce((s, v) => s + Number(v.valor), 0)
                  const pctV = metaV > 0 ? Math.min((realizadoV / metaV) * 100, 100) : 0
                  const atingidaV = metaV > 0 && realizadoV >= metaV
                  return (
                    <Card key={vendedora} padding="16px 18px">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: metaV > 0 ? 10 : 0 }}>
                        <div>
                          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>
                            {vendedora}
                          </p>
                          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)' }}>
                            {vendasV.length} venda{vendasV.length !== 1 ? 's' : ''} · {fmtR(realizadoV)}
                          </p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: atingidaV ? 'var(--accent)' : 'var(--ink)', lineHeight: 1 }}>
                            {metaV > 0 ? `${pctV.toFixed(0)}%` : '—'}
                          </p>
                          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                            {metaV > 0 ? `meta: ${fmtR(metaV)}` : 'sem meta'}
                          </p>
                        </div>
                      </div>
                      {metaV > 0 && <ProgressBar pct={pctV} />}
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* ══ Comparativo Mês a Mês (Pro) ══ */}
      <div>
        <p style={{ ...sectionLabelStyle, marginBottom: 12 }}>
          Comparativo Mês a Mês<ProBadge />
        </p>
        {!temPro ? <ProLock /> : (
          <Card padding="0">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--line)' }}>
                    {['Mês', 'Meta', 'Realizado', '%'].map((h, i) => (
                      <th key={h} style={{
                        fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase',
                        letterSpacing: '0.1em', padding: '12px 16px', textAlign: i === 0 ? 'left' : 'right',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mesesComp.map(({ ym, label, meta: mv, realizado: rv, pct: pv }, i) => (
                    <tr key={ym} style={{
                      borderBottom: i < mesesComp.length - 1 ? '1px solid var(--line)' : 'none',
                      background: ym === currentYM ? 'var(--bg)' : 'transparent',
                    }}>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: ym === currentYM ? 700 : 400, color: 'var(--ink)' }}>
                        {label}
                        {ym === currentYM && <span style={{ fontSize: 10, color: 'var(--muted)', marginLeft: 6, fontWeight: 400 }}>atual</span>}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: mv > 0 ? 'var(--ink)' : 'var(--muted)', textAlign: 'right', fontFamily: "'Space Mono', monospace" }}>
                        {mv > 0 ? fmtR(mv) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--ink)', textAlign: 'right', fontFamily: "'Space Mono', monospace" }}>
                        {fmtR(rv)}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        {pv !== null ? (
                          <span style={{
                            fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
                            color: pv >= 100 ? 'var(--accent)' : pv >= 70 ? 'var(--primary)' : 'var(--muted)',
                          }}>
                            {pv.toFixed(0)}%
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
