import { useState } from 'react'
import { User, Phone, ShoppingBag, CreditCard, Check, Plus, X, ChevronRight, ChevronLeft } from 'lucide-react'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'

const PGTOS = ['Dinheiro', 'Pix', 'Débito', 'Crédito', 'Fiado']
const EMPTY = { nome: '', tel: '', produtos: [], valor: '', pgto: 'Pix', obs: '', vendedora: '' }
const STEPS = ['Cliente', 'Produtos', 'Pagamento']

const labelStyle = {
  display: 'flex', alignItems: 'center', gap: 6,
  fontSize: 11, fontWeight: 700, color: 'var(--muted)',
  letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'Manrope, sans-serif', marginBottom: 8,
}

const inputBase = {
  width: '100%', height: 48,
  border: '1.5px solid var(--line)', borderRadius: 14,
  padding: '0 14px',
  fontFamily: 'Manrope, sans-serif', fontSize: 15,
  color: 'var(--ink)', background: 'var(--bg)',
  outline: 'none', boxSizing: 'border-box',
  transition: 'border-color .18s, box-shadow .18s',
}

function focusIn(e) {
  e.target.style.borderColor = 'var(--rose-deep)'
  e.target.style.boxShadow = '0 0 0 3px rgba(180,122,107,0.12)'
  e.target.style.background = '#fff'
}
function focusOut(e) {
  e.target.style.borderColor = 'var(--line)'
  e.target.style.boxShadow = 'none'
  e.target.style.background = 'var(--bg)'
}

export default function NovaVenda({ estoque = [], addVenda, addProduto, theme }) {
  const primary = theme?.primary || '#B47A6B'
  const isDark  = primary === '#D4A017'

  const [step,    setStep]    = useState(0)
  const [form,    setForm]    = useState(EMPTY)
  const [done,    setDone]    = useState(false)
  const [saving,  setSaving]  = useState(false)

  // toggle product selection
  function toggleProd(nome) {
    const exists = form.produtos.find(p => p.nome === nome)
    setForm({
      ...form,
      produtos: exists
        ? form.produtos.filter(p => p.nome !== nome)
        : [...form.produtos, { nome, cor: null, obs: '' }],
    })
  }

  function setCor(nome, cor) {
    setForm({ ...form, produtos: form.produtos.map(p => p.nome === nome ? { ...p, cor } : p) })
  }

  function setProdObs(nome, obs) {
    setForm({ ...form, produtos: form.produtos.map(p => p.nome === nome ? { ...p, obs } : p) })
  }

  async function handleSave() {
    setSaving(true)
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel:  form.tel  || null,
      valor:        parseFloat(form.valor.replace(',', '.')) || 0,
      forma_pgto:   form.pgto,
      obs:          form.obs || null,
      produtos:     form.produtos,
      vendedora:    form.vendedora || null,
      data:         new Date().toISOString(),
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY); setStep(0) }, 2200)
    }
  }

  if (done) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)',
        padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: isDark ? primary : METALLIC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={26} color={isDark ? '#0A0A0A' : '#fff'} strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Venda registrada!</p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Salva com sucesso no histórico.</p>
      </div>
    )
  }

  const activeColor = isDark ? primary : 'var(--rose-deep)'
  const activeBg    = isDark ? `${primary}10` : 'rgba(217,169,155,0.06)'
  const activeBorder = isDark ? primary : 'var(--rose)'
  const chip = (active) => ({
    padding: '5px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, transition: 'all .15s',
    background: active ? primary : 'var(--bg)',
    color: active ? (isDark ? '#0A0A0A' : '#fff') : 'var(--ink-soft)',
    boxShadow: active ? `0 2px 8px ${primary}30` : 'none',
  })

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)', overflow: 'hidden' }}>
      {/* Step indicator */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {STEPS.map((s, i) => {
            const past = i < step
            const active = i === step
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {i > 0 && <div style={{ width: 28, height: 1, background: past ? activeColor : 'var(--line)' }} />}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                    ...(past
                      ? { background: isDark ? primary : METALLIC, color: isDark ? '#0A0A0A' : '#fff' }
                      : active
                        ? { background: 'none', color: activeColor, border: `2px solid ${activeColor}` }
                        : { background: 'var(--bg)', color: 'var(--muted)' }),
                  }}>
                    {past ? <Check size={13} strokeWidth={2.5} /> : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12, fontFamily: 'Manrope, sans-serif', fontWeight: 600,
                    color: active ? 'var(--ink)' : past ? 'var(--ink-soft)' : 'var(--muted)',
                    display: window.innerWidth < 360 ? 'none' : 'block',
                  }}>{s}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {/* ── Step 0: Cliente ── */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Dados da Cliente</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>Identificação opcional</p>
            </div>
            <Field label="Nome da Cliente" Icon={User}>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Maria Silva" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
            </Field>
            <Field label="Telefone" Icon={Phone}>
              <input value={form.tel} onChange={e => setForm({ ...form, tel: e.target.value })}
                placeholder="(85) 99999-0000" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
            </Field>
            <Field label="Vendedora">
              <input value={form.vendedora} onChange={e => setForm({ ...form, vendedora: e.target.value })}
                placeholder="Quem está realizando a venda" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
              <ActionBtn primary={primary} isDark={isDark} onClick={() => setStep(1)}>
                Próximo — Produtos <ChevronRight size={16} />
              </ActionBtn>
            </div>
          </div>
        )}

        {/* ── Step 1: Produtos ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Produtos Vendidos</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>
                {form.produtos.length > 0 ? `${form.produtos.length} selecionado(s)` : 'Selecione os produtos'}
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {estoque.map(item => {
                const vars     = item.variacoes || []
                const selEntry = form.produtos.find(p => p.nome === item.nome)
                const isSel    = !!selEntry

                return (
                  <div key={item.id || item.nome} style={{
                    border: `1.5px solid ${isSel ? activeBorder : 'var(--line)'}`,
                    borderRadius: 14, overflow: 'hidden', transition: 'border-color .15s',
                  }}>
                    <button onClick={() => toggleProd(item.nome)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: isSel ? activeBg : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                        background: isSel ? (isDark ? primary : METALLIC) : 'transparent',
                        border: isSel ? 'none' : '1.5px solid var(--line)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {isSel && <Check size={12} color={isDark ? '#0A0A0A' : '#fff'} strokeWidth={2.5} />}
                      </div>
                      <span style={{ flex: 1, fontSize: 14, fontFamily: 'Manrope, sans-serif', color: 'var(--ink)', fontWeight: isSel ? 600 : 400 }}>
                        {item.nome}
                      </span>
                      {vars.length > 0 && (
                        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif', flexShrink: 0 }}>
                          {vars.reduce((s, v) => s + Number(v.quantidade || 0), 0)} un
                        </span>
                      )}
                    </button>

                    {isSel && (
                      <div style={{ padding: '0 14px 12px' }}>
                        {/* Color chips for products with variacoes */}
                        {vars.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: 6 }}>Cor / Modelo</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {vars.map(v => (
                                <button key={v.cor}
                                  onClick={e => { e.stopPropagation(); setCor(item.nome, v.cor) }}
                                  style={{
                                    ...chip(selEntry.cor === v.cor),
                                    opacity: Number(v.quantidade) === 0 ? 0.45 : 1,
                                  }}>
                                  {v.cor}
                                  {Number(v.quantidade) === 0 && ' (0)'}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <input value={selEntry.obs} onChange={e => setProdObs(item.nome, e.target.value)}
                          onClick={e => e.stopPropagation()} placeholder="Obs: tamanho, cor manual..."
                          style={{ ...inputBase, height: 38, fontSize: 13 }} onFocus={focusIn} onBlur={focusOut} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <OutlineBtn onClick={() => setStep(0)}><ChevronLeft size={15} /> Voltar</OutlineBtn>
              <ActionBtn primary={primary} isDark={isDark} onClick={() => setStep(2)}>
                Próximo — Pagamento <ChevronRight size={16} />
              </ActionBtn>
            </div>
          </div>
        )}

        {/* ── Step 2: Pagamento ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Pagamento</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>Valor e forma de pagamento</p>
            </div>

            <Field label="Valor (R$)" Icon={CreditCard}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>R$</span>
                <input value={form.valor} onChange={e => setForm({ ...form, valor: e.target.value })}
                  placeholder="0,00" autoFocus
                  style={{ ...inputBase, paddingLeft: 36, fontSize: 18, fontWeight: 700 }}
                  onFocus={focusIn} onBlur={focusOut} />
              </div>
            </Field>

            <div>
              <label style={labelStyle}><ShoppingBag size={12} /> Forma de Pagamento</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {PGTOS.map(p => (
                  <button key={p} onClick={() => setForm({ ...form, pgto: p })} style={chip(form.pgto === p)}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Observações">
              <input value={form.obs} onChange={e => setForm({ ...form, obs: e.target.value })}
                placeholder="Anotações sobre esta venda..."
                style={inputBase} onFocus={focusIn} onBlur={focusOut} />
            </Field>

            {form.produtos.length > 0 && (
              <div style={{ background: 'var(--bg)', borderRadius: 14, padding: '14px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 10, fontFamily: 'Manrope, sans-serif' }}>Resumo dos produtos</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {form.produtos.map(p => (
                    <span key={p.nome + (p.cor || '')} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Manrope, sans-serif' }}>
                      {p.nome}{p.cor ? ` — ${p.cor}` : ''}{p.obs ? ` (${p.obs})` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <OutlineBtn onClick={() => setStep(1)}><ChevronLeft size={15} /> Voltar</OutlineBtn>
              <button
                disabled={saving || !form.valor}
                onClick={handleSave}
                style={{
                  flex: 1, height: 48,
                  background: saving || !form.valor ? 'var(--line)' : (isDark ? primary : METALLIC),
                  color: saving || !form.valor ? 'var(--muted)' : (isDark ? '#0A0A0A' : '#fff'),
                  border: 'none', borderRadius: 99, cursor: saving || !form.valor ? 'not-allowed' : 'pointer',
                  fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: saving || !form.valor ? 'none' : `0 4px 16px ${isDark ? 'rgba(212,160,23,0.3)' : 'rgba(122,62,51,0.28)'}`,
                }}
              >
                {saving ? 'Salvando...' : 'Confirmar Venda'} {!saving && <Check size={16} />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label: lbl, Icon, children }) {
  return (
    <div>
      <label style={labelStyle}>{Icon && <Icon size={12} />}{lbl}</label>
      {children}
    </div>
  )
}

function ActionBtn({ onClick, children, disabled, primary, isDark }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 20px', height: 44, borderRadius: 99,
      background: disabled ? 'var(--line)' : primary,
      color: disabled ? 'var(--muted)' : (isDark ? '#0A0A0A' : '#fff'),
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
      boxShadow: disabled ? 'none' : `0 4px 14px ${primary}40`,
      marginLeft: 'auto',
    }}>{children}</button>
  )
}

function OutlineBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 16px', height: 44, borderRadius: 99,
      background: 'var(--surface)', border: '1px solid var(--line)',
      cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
      fontSize: 13, fontWeight: 600, color: 'var(--ink-soft)',
    }}>{children}</button>
  )
}
