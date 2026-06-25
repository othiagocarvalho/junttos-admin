import { useState } from 'react'
import { User, Phone, ShoppingBag, CreditCard, Check, Plus, X, ChevronRight, ChevronLeft, ChevronDown } from 'lucide-react'

const METALLIC = 'linear-gradient(135deg, #E8C0AF 0%, #D49E8A 22%, #B97766 42%, #7A3E33 58%, #B97766 72%, #DCAA96 88%, #F0C9B6 100%)'
const GOLD = 'linear-gradient(135deg, #C8900A 0%, #D4A017 30%, #F0C040 55%, #D4A017 75%, #C8900A 100%)'

const PGTOS = ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito']
const EMPTY = { nome: '', tel: '', produtos: [], valor: '', pagamentos: [{ forma: 'Pix', valor: '' }], obs: '', vendedora: '', nome_loja: '', cidade_estado: '', forma_envio: '' }
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

export default function NovaVenda({ produtos, produtosData = [], addVenda, addProduto, features = {}, theme }) {
  const isDark = !!theme.isDark
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [newProd, setNewProd] = useState('')
  const [addingProd, setAddingProd] = useState(false)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [expandedProd, setExpandedProd] = useState(null)

  function getVarLabel(v) {
    const k = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
    return k ? String(v[k]) : null
  }

  function toggleProd(nome) {
    const exists = form.produtos.find(p => p.nome === nome)
    setForm({
      ...form,
      produtos: exists
        ? form.produtos.filter(p => p.nome !== nome)
        : [...form.produtos, { nome, obs: '' }],
    })
  }

  function setProdObs(nome, obs) {
    setForm({ ...form, produtos: form.produtos.map(p => p.nome === nome ? { ...p, obs } : p) })
  }

  async function handleAddProd() {
    if (!newProd.trim()) return
    await addProduto(newProd.trim())
    setNewProd('')
    setAddingProd(false)
  }

  function handleValorChange(val) {
    setForm(prev => ({
      ...prev,
      valor: val,
      pagamentos: prev.pagamentos.length === 1
        ? [{ ...prev.pagamentos[0], valor: val }]
        : prev.pagamentos,
    }))
  }

  function addPgto() {
    setForm(prev => ({ ...prev, pagamentos: [...prev.pagamentos, { forma: 'Pix', valor: '' }] }))
  }

  function removePgto(idx) {
    setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.filter((_, i) => i !== idx) }))
  }

  function setPgto(idx, field, val) {
    setForm(prev => ({
      ...prev,
      pagamentos: prev.pagamentos.map((p, i) => i === idx ? { ...p, [field]: val } : p),
    }))
  }

  async function handleSave() {
    setSaving(true)
    const err = await addVenda({
      cliente_nome: form.nome || null,
      cliente_tel: form.tel || null,
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      forma_pgto: JSON.stringify(form.pagamentos.map(p => ({
        forma: p.forma,
        valor: parseFloat((p.valor || '0').replace(',', '.')) || 0,
        ...(p.forma === 'Boleto' && p.vencimento ? { vencimento: p.vencimento } : {}),
      }))),
      obs: form.obs || null,
      produtos: form.produtos,
      vendedora: form.vendedora || null,
      data: new Date().toISOString(),
      ...(features?.atacado ? {
        nome_loja: form.nome_loja || null,
        cidade_estado: form.cidade_estado || null,
        forma_envio: form.forma_envio || null,
      } : {}),
    })
    setSaving(false)
    if (!err) {
      setDone(true)
      setTimeout(() => { setDone(false); setForm(EMPTY); setStep(0) }, 2200)
    }
  }

  const totalValor = parseFloat((form.valor || '0').replace(',', '.')) || 0
  const alocado = form.pagamentos.reduce((s, p) => s + (parseFloat((p.valor || '0').replace(',', '.')) || 0), 0)
  const pgtoOpts = features?.atacado ? ['Pix', 'Dinheiro', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto'] : PGTOS
  const pgtoOk = form.valor.trim() !== '' && form.pagamentos.length > 0 && Math.abs(alocado - totalValor) < 0.005
    && form.pagamentos.every(p => p.forma !== 'Boleto' || !!p.vencimento)

  if (done) {
    return (
      <div style={{
        background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--line)',
        padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: isDark ? GOLD : METALLIC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={26} color={isDark ? '#0A0A0A' : '#fff'} strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Venda registrada!</p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'var(--muted)' }}>Salva com sucesso no histórico.</p>
      </div>
    )
  }

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
                {i > 0 && (
                  <div style={{ width: 28, height: 1, background: past ? 'var(--rose-deep)' : 'var(--line)' }} />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, fontFamily: 'Manrope, sans-serif',
                    ...(past
                      ? { background: isDark ? GOLD : METALLIC, color: isDark ? '#0A0A0A' : '#fff' }
                      : active
                        ? { background: 'none', color: 'var(--rose-deep)', border: '2px solid var(--rose-deep)' }
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
            {features?.atacado && (<>
              <Field label="Nome da Loja">
                <input value={form.nome_loja} onChange={e => setForm({ ...form, nome_loja: e.target.value })}
                  placeholder="Ex: Boutique da Maria" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label="Cidade / Estado">
                <input value={form.cidade_estado} onChange={e => setForm({ ...form, cidade_estado: e.target.value })}
                  placeholder="Ex: Fortaleza / CE" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
              </Field>
              <Field label="Forma de Envio">
                <input value={form.forma_envio} onChange={e => setForm({ ...form, forma_envio: e.target.value })}
                  placeholder="Ex: Transportadora, Motoboy, Retirada" style={inputBase} onFocus={focusIn} onBlur={focusOut} />
              </Field>
            </>)}
            <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 4 }}>
              <MetallicBtn onClick={() => setStep(1)} isDark={isDark}>
                Próximo — Produtos <ChevronRight size={16} />
              </MetallicBtn>
            </div>
          </div>
        )}

        {/* ── Step 1: Produtos ── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Produtos Vendidos</p>
                <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>
                  {form.produtos.length > 0 ? `${form.produtos.length} selecionado(s)` : 'Selecione os produtos'}
                </p>
              </div>
              <button
                onClick={() => setAddingProd(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
                  border: '1px solid var(--line)', background: 'var(--bg)',
                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)',
                }}
              >
                <Plus size={13} /> Novo
              </button>
            </div>

            {addingProd && (
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newProd} onChange={e => setNewProd(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddProd()}
                  placeholder="Nome do produto..." autoFocus
                  style={{ ...inputBase, flex: 1 }} onFocus={focusIn} onBlur={focusOut} />
                <button onClick={handleAddProd} style={{ padding: '0 16px', borderRadius: 14, background: isDark ? GOLD : METALLIC, border: 'none', color: isDark ? '#0A0A0A' : '#fff', fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>OK</button>
                <button onClick={() => { setAddingProd(false); setNewProd('') }} style={{ padding: '0 12px', borderRadius: 14, border: '1px solid var(--line)', background: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
                  <X size={15} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {produtos.map(nome => {
                const pd = produtosData.find(p => p.nome === nome)
                const vars = (pd?.variacoes || []).map(v => {
                  const label = getVarLabel(v)
                  return label ? { label, qty: Number(v.quantidade || 0) } : null
                }).filter(Boolean)
                const isSimples = vars.length === 1 && vars[0].label === 'Único'
                const hasVars = vars.length > 0 && !isSimples
                const selItems = form.produtos.filter(p => p.nome === nome)
                const selCount = selItems.reduce((sum, p) => sum + (p.quantidade || 1), 0)
                const isOpen = expandedProd === nome

                function toggleSimples() {
                  const exists = form.produtos.find(p => p.nome === nome && p.variacao === 'Único')
                  setForm(f => ({
                    ...f,
                    produtos: exists
                      ? f.produtos.filter(p => !(p.nome === nome && p.variacao === 'Único'))
                      : [...f.produtos, { nome, variacao: 'Único', obs: '', quantidade: 1 }],
                  }))
                }

                return (
                  <div key={nome}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => isSimples ? toggleSimples() : hasVars ? setExpandedProd(prev => prev === nome ? null : nome) : toggleProd(nome)}
                      onKeyDown={e => e.key === 'Enter' && (isSimples ? toggleSimples() : hasVars ? setExpandedProd(prev => prev === nome ? null : nome) : toggleProd(nome))}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 14px', cursor: 'pointer', userSelect: 'none',
                        borderRadius: isOpen ? '14px 14px 0 0' : 14,
                        border: selCount > 0
                          ? `1.5px solid ${theme.primary}`
                          : (isDark ? '1px solid #3a3a3a' : '1px solid #ddd'),
                        background: selCount > 0
                          ? (isDark ? '#2a1f00' : `${theme.primary}20`)
                          : (isDark ? '#1a1a1a' : '#f5f5f5'),
                        color: selCount > 0 ? theme.primary : (isDark ? theme.primary : '#1a1a1a'),
                        transition: 'background .15s, border-color .15s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: 6, flexShrink: 0,
                          background: selCount > 0 ? (isDark ? GOLD : METALLIC) : 'transparent',
                          border: selCount > 0 ? 'none' : (isDark ? '1.5px solid #3a3a3a' : '1.5px solid #ddd'),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {selCount > 0 && <Check size={12} color={isDark ? '#0A0A0A' : '#fff'} strokeWidth={2.5} />}
                        </div>
                        <span style={{
                          fontSize: 14, fontFamily: 'Manrope, sans-serif',
                          color: selCount > 0 ? theme.primary : (isDark ? theme.primary : '#1a1a1a'),
                          fontWeight: selCount > 0 ? 600 : 400,
                        }}>{nome}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {selCount > 0 && (
                          <span style={{
                            fontSize: 11, padding: '2px 7px', borderRadius: 99,
                            background: isDark ? `${theme.primary}30` : `${theme.primary}20`,
                            color: theme.primary, fontWeight: 700,
                          }}>{selCount}×</span>
                        )}
                        {hasVars && !isSimples && (
                          <ChevronDown size={14} color={isDark ? theme.primary : '#9C8580'}
                            style={{ flexShrink: 0, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .15s' }} />
                        )}
                      </div>
                    </div>

                    {hasVars && isOpen && (
                      <div style={{
                        padding: '10px 14px 12px',
                        borderLeft: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderRight: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderRadius: '0 0 14px 14px',
                        background: isDark ? '#111110' : '#F6EFE8',
                      }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: isDark ? '#A07830' : '#9C8580', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8, fontFamily: 'Manrope, sans-serif' }}>Variações disponíveis</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {vars.map(({ label, qty }, idx) => {
                            const isSel = form.produtos.some(p => p.nome === nome && p.variacao === label)
                            const selQty = isSel ? (form.produtos.find(p => p.nome === nome && p.variacao === label)?.quantidade || 1) : 0
                            const esgotado = qty === 0 && !isSel
                            if (isSel) {
                              return (
                                <div key={idx} style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  borderRadius: 8, overflow: 'hidden', userSelect: 'none',
                                  border: `1.5px solid ${theme.primary}`,
                                  background: theme.primary,
                                  fontFamily: 'Manrope, sans-serif',
                                }}>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (selQty <= 1) {
                                        setForm(f => ({ ...f, produtos: f.produtos.filter(p => !(p.nome === nome && p.variacao === label)) }))
                                      } else {
                                        setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && p.variacao === label ? { ...p, quantidade: p.quantidade - 1 } : p) }))
                                      }
                                    }}
                                    style={{ padding: '5px 9px', background: 'transparent', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                                  >−</button>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', padding: '0 2px' }}>{label} · {selQty}</span>
                                  <button
                                    onClick={e => {
                                      e.stopPropagation()
                                      if (selQty < qty) {
                                        setForm(f => ({ ...f, produtos: f.produtos.map(p => p.nome === nome && p.variacao === label ? { ...p, quantidade: p.quantidade + 1 } : p) }))
                                      }
                                    }}
                                    style={{ padding: '5px 9px', background: 'transparent', border: 'none', cursor: selQty >= qty ? 'not-allowed' : 'pointer', color: selQty >= qty ? 'rgba(255,255,255,0.45)' : '#fff', fontSize: 16, fontWeight: 700, lineHeight: 1 }}
                                  >+</button>
                                </div>
                              )
                            }
                            return (
                              <div key={idx} role="button" tabIndex={0}
                                onClick={() => {
                                  if (!esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label, quantidade: 1 }] }))
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !esgotado) setForm(f => ({ ...f, produtos: [...f.produtos, { nome, variacao: label, obs: label, quantidade: 1 }] }))
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: '5px 12px', borderRadius: 8,
                                  cursor: esgotado ? 'not-allowed' : 'pointer',
                                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                                  userSelect: 'none', opacity: esgotado ? 0.5 : 1,
                                  border: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                                  background: isDark ? '#1a1a1a' : '#f5f5f5',
                                  color: isDark ? theme.primary : '#1a1a1a',
                                }}>
                                {label}
                                <span style={{ marginLeft: 4, fontSize: 10, fontWeight: 400, color: isDark ? '#A07830' : '#9C8580' }}>
                                  {qty === 0 ? '(esgotado)' : `(${qty})`}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {!hasVars && selCount > 0 && (
                      <div style={{
                        padding: '0 14px 12px',
                        borderLeft: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderRight: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderBottom: isDark ? '1px solid #3a3a3a' : '1px solid #ddd',
                        borderRadius: '0 0 14px 14px',
                        background: isDark ? '#1a1a1a' : '#f5f5f5',
                      }}>
                        <input value={selItems[0]?.obs || ''} onChange={e => setProdObs(nome, e.target.value)}
                          onClick={e => e.stopPropagation()} placeholder="Obs: cor, tamanho, modelo..."
                          style={{ ...inputBase, height: 40, fontSize: 13 }} onFocus={focusIn} onBlur={focusOut} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <OutlineBtn onClick={() => setStep(0)}><ChevronLeft size={15} /> Voltar</OutlineBtn>
              <MetallicBtn onClick={() => setStep(2)} isDark={isDark}>Próximo — Pagamento <ChevronRight size={16} /></MetallicBtn>
            </div>
          </div>
        )}

        {/* ── Step 2: Pagamento ── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>Pagamento</p>
              <p style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'Manrope, sans-serif' }}>Valor e formas de pagamento</p>
            </div>

            <Field label="Valor Total (R$)" Icon={CreditCard}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 14, fontFamily: 'Manrope, sans-serif' }}>R$</span>
                <input value={form.valor} onChange={e => handleValorChange(e.target.value)}
                  placeholder="0,00" autoFocus
                  style={{ ...inputBase, paddingLeft: 36, fontSize: 18, fontWeight: 700 }}
                  onFocus={focusIn} onBlur={focusOut} />
              </div>
            </Field>

            <div>
              <label style={labelStyle}>
                <ShoppingBag size={12} /> Formas de Pagamento
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {form.pagamentos.map((p, i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <select
                        value={p.forma}
                        onChange={e => {
                          const f = e.target.value
                          setForm(prev => ({ ...prev, pagamentos: prev.pagamentos.map((x, idx) => idx === i ? { ...x, forma: f, ...(f !== 'Boleto' ? { vencimento: undefined } : {}) } : x) }))
                        }}
                        style={{
                          height: 46, flex: '2 1 0', minWidth: 0,
                          border: '1.5px solid var(--line)', borderRadius: 12,
                          padding: '0 8px',
                          fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                          color: 'var(--ink)', background: 'var(--bg)',
                          outline: 'none', cursor: 'pointer', boxSizing: 'border-box',
                        }}
                      >
                        {pgtoOpts.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <div style={{ position: 'relative', flex: '1 1 0', minWidth: 0 }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 13, fontFamily: 'Manrope, sans-serif', pointerEvents: 'none' }}>R$</span>
                        <input
                          value={p.valor}
                          onChange={e => setPgto(i, 'valor', e.target.value)}
                          placeholder="0,00"
                          style={{
                            width: '100%', height: 46,
                            border: '1.5px solid var(--line)', borderRadius: 12,
                            padding: '0 10px 0 28px',
                            fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
                            color: 'var(--ink)', background: 'var(--bg)',
                            outline: 'none', boxSizing: 'border-box',
                          }}
                          onFocus={focusIn} onBlur={focusOut}
                        />
                      </div>
                      {form.pagamentos.length > 1 && (
                        <button
                          onClick={() => removePgto(i)}
                          style={{ width: 36, height: 36, borderRadius: 8, border: 'none', background: 'var(--bg)', cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                    {p.forma === 'Boleto' && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingLeft: 2 }}>
                        {[15, 30, 45, 60].map(dias => (
                          <button key={dias} type="button" onClick={() => setPgto(i, 'vencimento', dias)} style={{
                            padding: '5px 14px', borderRadius: 8, cursor: 'pointer',
                            fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                            border: p.vencimento === dias ? 'none' : '1px solid var(--line)',
                            background: p.vencimento === dias ? theme.primary : 'var(--bg)',
                            color: p.vencimento === dias ? '#fff' : 'var(--muted)',
                          }}>{dias} dias</button>
                        ))}
                        {!p.vencimento && <span style={{ fontSize: 11, color: '#dc2626', fontFamily: 'Manrope, sans-serif', alignSelf: 'center' }}>Selecione o vencimento</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={addPgto}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                  padding: '7px 14px', borderRadius: 10,
                  border: '1px dashed var(--line)', background: 'none', cursor: 'pointer',
                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600, color: 'var(--muted)',
                }}
              >
                <Plus size={13} /> Adicionar forma
              </button>

              {form.valor && (
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 10,
                  background: pgtoOk ? 'rgba(22,163,74,0.06)' : 'rgba(220,38,38,0.06)',
                  border: `1px solid ${pgtoOk ? 'rgba(22,163,74,0.2)' : 'rgba(220,38,38,0.2)'}`,
                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                  color: pgtoOk ? '#16a34a' : '#dc2626',
                }}>
                  {pgtoOk
                    ? '✓ Pagamento completo'
                    : `Alocado: R$ ${alocado.toFixed(2).replace('.', ',')} · Total: R$ ${totalValor.toFixed(2).replace('.', ',')}`
                  }
                </div>
              )}
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
                  {form.produtos.map((p, idx) => (
                    <span key={idx} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)', fontFamily: 'Manrope, sans-serif' }}>
                      {p.nome}{p.obs ? ` — ${p.obs}` : ''}{p.quantidade > 1 ? ` ×${p.quantidade}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
              <OutlineBtn onClick={() => setStep(1)}><ChevronLeft size={15} /> Voltar</OutlineBtn>
              <button
                disabled={saving || !pgtoOk}
                onClick={handleSave}
                style={{
                  flex: 1, height: 48, background: saving || !pgtoOk ? 'var(--line)' : (isDark ? GOLD : METALLIC),
                  color: saving || !pgtoOk ? 'var(--muted)' : (isDark ? '#0A0A0A' : '#fff'),
                  border: 'none', borderRadius: 99, cursor: saving || !pgtoOk ? 'not-allowed' : 'pointer',
                  fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: saving || !pgtoOk ? 'none' : (isDark ? '0 4px 16px rgba(212,160,23,0.35)' : '0 4px 16px rgba(122,62,51,0.28)'),
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

function MetallicBtn({ onClick, children, disabled, isDark }) {
  const bg = isDark ? GOLD : METALLIC
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 20px', height: 44, borderRadius: 99,
      background: disabled ? 'var(--line)' : bg,
      color: disabled ? 'var(--muted)' : isDark ? '#0A0A0A' : '#fff',
      border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700,
      boxShadow: disabled ? 'none' : isDark ? '0 4px 14px rgba(212,160,23,0.30)' : '0 4px 14px rgba(122,62,51,0.25)',
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
