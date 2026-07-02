import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { ShoppingBag, Plus, Minus, X, Check, ChevronLeft, Copy, Search } from 'lucide-react'

function fmtR(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',') }

function getVariacaoLabel(v) {
  const key = Object.keys(v).find(k => k !== 'quantidade' && k !== 'custo')
  return key ? String(v[key]) : null
}

function produtoDisponivel(p) {
  if (!p.variacoes || p.variacoes.length === 0) return false
  return p.variacoes.some(v => (v.quantidade || 0) > 0)
}

// ── Header (fundo cor da loja full-width, conteúdo centralizado em 480px) ────
function CatalogoHeader({ config, etapa, onVoltar, busca, setBusca }) {
  const primary = config?.cor_primaria || '#5E2BD0'
  const nome = config?.nome || 'Catálogo'
  return (
    <div style={{ background: primary, color: '#fff', width: '100%', flexShrink: 0 }}>
      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 12px' }}>
        {etapa !== 'catalogo' && (
          <button onClick={onVoltar} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, width: 34, height: 34, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <ChevronLeft size={18} color="#fff" />
          </button>
        )}
        {config?.logo_url ? (
          <img src={config.logo_url} alt={nome} style={{ height: 36, width: 'auto', maxWidth: 80, objectFit: 'contain', borderRadius: 6 }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
            {nome.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontWeight: 700, fontSize: 15, color: '#fff', lineHeight: 1.2 }}>{nome}</p>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>
            {etapa === 'catalogo' ? 'Catálogo online' : etapa === 'checkout' ? 'Finalizar pedido' : 'Pedido confirmado!'}
          </p>
        </div>
      </div>
      {etapa === 'catalogo' && (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 16px 14px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="rgba(255,255,255,0.6)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar produto..."
              style={{
                width: '100%', height: 38, borderRadius: 10, border: 'none',
                background: 'rgba(255,255,255,0.2)', color: '#fff',
                paddingLeft: 34, paddingRight: 12, fontFamily: 'Manrope, sans-serif', fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Card de produto ──────────────────────────────────────────
function ProdutoCard({ produto, onAdd, primary, isB2BPro }) {
  const [varSel, setVarSel] = useState(null)

  const vars = (produto.variacoes || []).map(v => ({
    label: getVariacaoLabel(v),
    quantidade: v.quantidade || 0,
    raw: v,
  })).filter(v => v.label)

  // Estado de grade sempre inicializado (regra dos hooks — nunca condicional)
  const [gradeQtds, setGradeQtds] = useState(() => {
    const init = {}
    vars.forEach(v => { if (v.label) init[v.label] = 0 })
    return init
  })

  const disponivel = produtoDisponivel(produto)

  function handleAdd() {
    if (!varSel || varSel.quantidade === 0) return
    onAdd(produto, varSel.raw)
    setVarSel(null)
  }

  // Grade de tamanho — ativo apenas quando Pro E variacao usa chave 'tamanho'
  const isGrade = isB2BPro && (produto.variacoes || []).length > 0 && (() => {
    const v0 = produto.variacoes[0]
    const firstKey = Object.keys(v0).find(k => k !== 'quantidade' && k !== 'custo')
    return firstKey === 'tamanho'
  })()

  const gradeHasAny = Object.values(gradeQtds).some(q => q > 0)

  function setGradeQtd(label, rawVal) {
    const max = vars.find(v => v.label === label)?.quantidade || 0
    const n = Math.min(Math.max(0, parseInt(rawVal) || 0), max)
    setGradeQtds(prev => ({ ...prev, [label]: n }))
  }

  function handleAddGrade() {
    vars.forEach(v => {
      const q = gradeQtds[v.label] || 0
      if (q > 0) onAdd(produto, v.raw, q)
    })
    setGradeQtds(prev => Object.fromEntries(Object.keys(prev).map(k => [k, 0])))
  }

  // ── UI Grade de Tamanho ─────────────────────────────────────
  if (isGrade) {
    return (
      <div style={{
        background: '#fff', borderRadius: 14, border: '1px solid #ede8e3',
        overflow: 'hidden', opacity: disponivel ? 1 : 0.55,
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ background: primary + '12', height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShoppingBag size={28} color={primary + '80'} />
        </div>
        <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>
            {produto.nome}
          </p>
          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 700, color: primary }}>
            {fmtR(produto.preco_venda)}
          </p>
          {!disponivel ? (
            <button disabled style={{ marginTop: 4, height: 32, borderRadius: 8, border: 'none', background: '#e5e7eb', color: '#9ca3af', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'not-allowed' }}>
              Esgotado
            </button>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 2 }}>
                {vars.map(v => (
                  <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      fontFamily: 'Manrope, sans-serif', fontSize: 10, fontWeight: 700,
                      color: v.quantidade === 0 ? '#bbb' : '#555',
                      minWidth: 22, flexShrink: 0,
                    }}>
                      {v.label}
                    </span>
                    <input
                      type="number" min="0" max={v.quantidade}
                      value={gradeQtds[v.label] || 0}
                      disabled={v.quantidade === 0}
                      onChange={e => setGradeQtd(v.label, e.target.value)}
                      style={{
                        width: '100%', height: 26, borderRadius: 6, textAlign: 'center',
                        border: `1.5px solid ${(gradeQtds[v.label] || 0) > 0 ? primary : '#e5e7eb'}`,
                        background: (gradeQtds[v.label] || 0) > 0 ? primary + '10' : '#fafafa',
                        fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 600,
                        color: v.quantidade === 0 ? '#ccc' : '#1a1a1a',
                        outline: 'none', boxSizing: 'border-box',
                        opacity: v.quantidade === 0 ? 0.45 : 1,
                      }}
                    />
                  </div>
                ))}
              </div>
              <button
                onClick={handleAddGrade}
                disabled={!gradeHasAny}
                style={{
                  marginTop: 4, height: 34, borderRadius: 8, border: 'none',
                  background: gradeHasAny ? primary : '#e5e7eb',
                  color: gradeHasAny ? '#fff' : '#9ca3af',
                  fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700,
                  cursor: gradeHasAny ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <Plus size={13} /> Adicionar ao carrinho
              </button>
            </>
          )}
        </div>
      </div>
    )
  }

  // ── UI padrão (cor, tamanho sem grade Pro, ou sem variação) ──
  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid #ede8e3',
      overflow: 'hidden', opacity: disponivel ? 1 : 0.55,
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ background: primary + '12', height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ShoppingBag size={36} color={primary + '80'} />
      </div>

      <div style={{ padding: '10px 12px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a1a', lineHeight: 1.3 }}>{produto.nome}</p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: primary }}>{fmtR(produto.preco_venda)}</p>

        {!disponivel ? (
          <button disabled style={{ marginTop: 'auto', height: 34, borderRadius: 8, border: 'none', background: '#e5e7eb', color: '#9ca3af', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'not-allowed' }}>
            Esgotado
          </button>
        ) : vars.length > 0 ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {vars.map(v => (
                <button
                  key={v.label}
                  disabled={v.quantidade === 0}
                  onClick={() => setVarSel(prev => prev?.label === v.label ? null : v)}
                  style={{
                    padding: '3px 8px', borderRadius: 6, cursor: v.quantidade === 0 ? 'not-allowed' : 'pointer',
                    fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 600,
                    border: varSel?.label === v.label ? `2px solid ${primary}` : '1.5px solid #ede8e3',
                    background: varSel?.label === v.label ? primary + '15' : '#fff',
                    color: v.quantidade === 0 ? '#bbb' : (varSel?.label === v.label ? primary : '#555'),
                    opacity: v.quantidade === 0 ? 0.5 : 1,
                  }}
                >
                  {v.label}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              disabled={!varSel || varSel.quantidade === 0}
              style={{
                marginTop: 'auto', height: 34, borderRadius: 8, border: 'none',
                background: varSel && varSel.quantidade > 0 ? primary : '#e5e7eb',
                color: varSel && varSel.quantidade > 0 ? '#fff' : '#9ca3af',
                fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700,
                cursor: varSel && varSel.quantidade > 0 ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              <Plus size={13} /> Adicionar
            </button>
          </>
        ) : (
          <button
            onClick={() => onAdd(produto, {})}
            style={{ marginTop: 'auto', height: 34, borderRadius: 8, border: 'none', background: primary, color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          >
            <Plus size={13} /> Adicionar
          </button>
        )}
      </div>
    </div>
  )
}

// ── Etapa catálogo ───────────────────────────────────────────
function EtapaCatalogo({ produtos, onAdd, primary, busca, isB2BPro }) {
  const filtered = useMemo(() => {
    if (!busca.trim()) return produtos
    const q = busca.toLowerCase()
    return produtos.filter(p => p.nome.toLowerCase().includes(q))
  }, [produtos, busca])

  if (filtered.length === 0) {
    return (
      <div style={{ padding: '48px 24px', textAlign: 'center' }}>
        <ShoppingBag size={32} color="#ddd" style={{ margin: '0 auto 12px' }} />
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 14, color: '#999' }}>Nenhum produto encontrado.</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '16px' }}>
      {filtered.map(p => (
        <ProdutoCard key={p.id} produto={p} onAdd={onAdd} primary={primary} isB2BPro={isB2BPro} />
      ))}
    </div>
  )
}

// ── Etapa checkout ───────────────────────────────────────────
function EtapaCheckout({ carrinho, form, setForm, onConfirmar, onRemover, totalCarrinho, primary, salvando, erroConfirmar, hasMercadoPago }) {
  const opcoesPagamento = [
    { id: 'pix_manual', label: 'QR Code Pix', sub: 'Pague escaneando o QR Code' },
    ...(hasMercadoPago ? [{ id: 'mercadopago', label: 'Mercado Pago', sub: 'Cartão, Pix ou boleto' }] : []),
  ]

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Resumo */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede8e3', padding: '16px' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Seu pedido</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {carrinho.map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: '#1a1a1a' }}>{item.nome}</p>
                {item.variacao && <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#999' }}>{item.variacao}</p>}
              </div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: primary, whiteSpace: 'nowrap' }}>{fmtR(item.preco * item.qtd)}</p>
              <button onClick={() => onRemover(item.key)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', padding: 2, display: 'flex', alignItems: 'center' }}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid #ede8e3', marginTop: 12, paddingTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 600, color: '#555' }}>Total</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: primary }}>{fmtR(totalCarrinho)}</span>
        </div>
      </div>

      {/* Dados do cliente */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede8e3', padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em' }}>Seus dados</p>
        <div>
          <label style={{ display: 'block', fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5 }}>Nome completo *</label>
          <input
            value={form.nome}
            onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            placeholder="Maria da Silva"
            style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '0 12px', fontFamily: 'Manrope, sans-serif', fontSize: 14, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 5 }}>WhatsApp *</label>
          <input
            value={form.whatsapp}
            onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
            placeholder="(85) 99999-0000"
            type="tel"
            style={{ width: '100%', height: 42, borderRadius: 10, border: '1.5px solid #e5e7eb', padding: '0 12px', fontFamily: 'Manrope, sans-serif', fontSize: 14, color: '#1a1a1a', outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* Forma de pagamento — MP só aparece se config.mercadopago_token existir */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede8e3', padding: '16px' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Forma de pagamento</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {opcoesPagamento.map(op => {
            const isMp = op.id === 'mercadopago'
            const activeColor = isMp ? '#009EE3' : primary
            return (
              <button
                key={op.id}
                onClick={() => setForm(f => ({ ...f, formaPagamento: op.id }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                  border: form.formaPagamento === op.id ? `2px solid ${activeColor}` : '1.5px solid #e5e7eb',
                  background: form.formaPagamento === op.id ? activeColor + '08' : '#fff',
                }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 8, background: activeColor + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 18 }}>{isMp ? '💳' : '⬛'}</span>
                </div>
                <div>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a1a', marginBottom: 2 }}>{op.label}</p>
                  <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#999' }}>{op.sub}</p>
                </div>
                {form.formaPagamento === op.id && <Check size={16} color={activeColor} style={{ marginLeft: 'auto', flexShrink: 0 }} />}
              </button>
            )
          })}
        </div>
      </div>

      {/* Erro de confirmação */}
      {erroConfirmar && (
        <div style={{ background: '#FEE2E2', border: '0.5px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991B1B', fontFamily: 'Manrope, sans-serif' }}>
          {erroConfirmar}
        </div>
      )}

      <button
        onClick={onConfirmar}
        disabled={salvando || !form.nome.trim() || !form.whatsapp.trim()}
        style={{
          width: '100%', height: 50, borderRadius: 12, border: 'none',
          background: !salvando && form.nome.trim() && form.whatsapp.trim() ? primary : '#e5e7eb',
          color: !salvando && form.nome.trim() && form.whatsapp.trim() ? '#fff' : '#9ca3af',
          fontFamily: 'Manrope, sans-serif', fontSize: 15, fontWeight: 700,
          cursor: !salvando && form.nome.trim() && form.whatsapp.trim() ? 'pointer' : 'not-allowed',
        }}
      >
        {salvando ? 'Confirmando...' : 'Confirmar pedido'}
      </button>
    </div>
  )
}

// ── Etapa confirmado ─────────────────────────────────────────
function EtapaConfirmado({ config, totalCarrinho, form }) {
  const [copiado, setCopiado] = useState(false)
  const chavePix = config?.chave_pix || config?.email_acesso || 'Configure em Configurações'

  function copiar() {
    navigator.clipboard.writeText(chavePix)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const waNum = (config?.whatsapp_loja || '').replace(/\D/g, '')
  const waLink = waNum ? `https://wa.me/55${waNum}?text=${encodeURIComponent('Olá! Seguem os detalhes do meu pedido e o comprovante de pagamento.')}` : null

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Banner verde */}
      <div style={{ background: '#1F8A5B', borderRadius: 14, padding: '20px 18px', textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <Check size={24} color="#fff" strokeWidth={2.5} />
        </div>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Pedido confirmado!</p>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>Em breve entraremos em contato pelo WhatsApp</p>
      </div>

      {/* Card Pix */}
      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #ede8e3', padding: '20px 18px', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6 }}>Total a pagar</p>
        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: '#1a1a1a', marginBottom: 20 }}>{fmtR(totalCarrinho)}</p>

        <div style={{ width: 160, height: 160, borderRadius: 12, border: '2px dashed #ddd', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 32 }}>⬛</span>
          <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 10, color: '#bbb' }}>QR Code Pix</p>
        </div>

        <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, color: '#999', marginBottom: 8 }}>Chave Pix</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f5f5f5', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
          <code style={{ flex: 1, fontSize: 12, color: '#333', wordBreak: 'break-all', fontFamily: 'monospace', textAlign: 'left' }}>{chavePix}</code>
          <button onClick={copiar} style={{ background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
            {copiado ? <Check size={14} color="#1F8A5B" /> : <Copy size={14} color="#999" />}
          </button>
        </div>

        <div style={{ textAlign: 'left', background: '#f9fafb', borderRadius: 10, padding: '12px 14px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {['Abra o app do seu banco', 'Escaneie o QR Code ou cole a chave Pix', `Confirme o valor de ${fmtR(totalCarrinho)}`, 'Envie o comprovante pelo WhatsApp'].map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#1F8A5B20', color: '#1F8A5B', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'Manrope, sans-serif' }}>{i + 1}</span>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, color: '#555', lineHeight: 1.4 }}>{s}</p>
            </div>
          ))}
        </div>

        {waLink ? (
          <a href={waLink} target="_blank" rel="noopener noreferrer" style={{ display: 'block', height: 44, borderRadius: 10, background: '#25D366', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, lineHeight: '44px', textDecoration: 'none', marginBottom: 10 }}>
            Enviar comprovante
          </a>
        ) : (
          <button disabled style={{ width: '100%', height: 44, borderRadius: 10, background: '#e5e7eb', color: '#9ca3af', border: 'none', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, marginBottom: 10, cursor: 'not-allowed' }}>
            Enviar comprovante
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function CatalogoPublico({ lojaId }) {
  const [config, setConfig] = useState(null)
  const [produtos, setProdutos] = useState([])
  const [carrinho, setCarrinho] = useState([])
  const [etapa, setEtapa] = useState('catalogo')
  const [form, setForm] = useState({ nome: '', whatsapp: '', formaPagamento: 'pix_manual' })
  const [loading, setLoading] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erroConfirmar, setErroConfirmar] = useState('')
  const [busca, setBusca] = useState('')
  const [pedidoId, setPedidoId] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: cfg } = await supabase.from('lf_config').select('*').eq('loja_id', lojaId).maybeSingle()
      const { data: prods } = await supabase.from('lf_produtos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome')
      setConfig(cfg)
      setProdutos(prods || [])
      setLoading(false)
    }
    load()
  }, [lojaId])

  const primary = config?.cor_primaria || '#5E2BD0'
  const hasMercadoPago = !!config?.mercadopago_token
  const isB2BPro = config?.features?.catalogo_b2b === 'pro'

  function addItem(produto, variacaoRaw, qtd = 1) {
    const varLabel = getVariacaoLabel(variacaoRaw) || ''
    const key = produto.id + '_' + varLabel
    setCarrinho(prev => {
      const exists = prev.find(i => i.key === key)
      if (exists) return prev.map(i => i.key === key ? { ...i, qtd: i.qtd + qtd } : i)
      return [...prev, { key, produtoId: produto.id, nome: produto.nome, variacao: varLabel, preco: produto.preco_venda, qtd }]
    })
  }

  function removeItem(key) {
    setCarrinho(prev => prev.filter(i => i.key !== key))
  }

  const totalCarrinho = carrinho.reduce((acc, i) => acc + Number(i.preco) * i.qtd, 0)

  async function confirmarPedido() {
    if (!form.nome.trim() || !form.whatsapp.trim()) return
    setErroConfirmar('')
    setSalvando(true)
    try {
      const novoPedido = {
        loja_id: lojaId,
        cliente_nome: form.nome.trim(),
        cliente_whatsapp: form.whatsapp.trim(),
        produtos: carrinho.map(i => ({ nome: i.nome, variacao: i.variacao, qtd: i.qtd, preco: i.preco })),
        valor_total: totalCarrinho,
        status: 'aguardando_pagamento',
        forma_pagamento: form.formaPagamento,
      }
      const { data: pedidoInserido, error: insertError } = await supabase
        .from('lf_pedidos')
        .insert(novoPedido)
        .select()
        .single()

      if (insertError) {
        console.error('Erro ao inserir pedido:', insertError)
        setErroConfirmar('Erro ao registrar pedido: ' + insertError.message)
        return
      }

      // Dar baixa no estoque — agrupa por produto para aplicar todos os tamanhos de uma vez
      const byProduct = {}
      for (const item of carrinho) {
        if (!item.variacao) continue
        const prod = produtos.find(p => p.id === item.produtoId)
        if (!prod) continue
        if (!byProduct[item.produtoId]) byProduct[item.produtoId] = { prod, items: [] }
        byProduct[item.produtoId].items.push(item)
      }
      for (const { prod, items } of Object.values(byProduct)) {
        let novasVars = [...(prod.variacoes || [])]
        for (const item of items) {
          novasVars = novasVars.map(v => {
            const label = getVariacaoLabel(v)
            return label === item.variacao
              ? { ...v, quantidade: Math.max(0, (v.quantidade || 0) - item.qtd) }
              : v
          })
        }
        await supabase.from('lf_produtos').update({ variacoes: novasVars }).eq('id', prod.id)
      }

      setPedidoId(pedidoInserido?.id || null)
      setEtapa('confirmado')
    } catch (e) {
      console.error('Erro inesperado:', e)
      setErroConfirmar('Erro inesperado. Tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F5' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', border: `2.5px solid ${primary}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F8F7F5', fontFamily: 'Manrope, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header full-width */}
      <CatalogoHeader
        config={config}
        etapa={etapa}
        onVoltar={() => setEtapa('catalogo')}
        busca={busca}
        setBusca={setBusca}
      />

      {/* Conteúdo centralizado em 480px */}
      <div style={{ flex: 1, maxWidth: 480, width: '100%', margin: '0 auto', paddingBottom: carrinho.length > 0 && etapa === 'catalogo' ? 80 : 0, boxSizing: 'border-box' }}>
        {etapa === 'catalogo' && (
          <EtapaCatalogo produtos={produtos} onAdd={addItem} primary={primary} busca={busca} isB2BPro={isB2BPro} />
        )}
        {etapa === 'checkout' && (
          <EtapaCheckout
            carrinho={carrinho}
            form={form}
            setForm={setForm}
            onConfirmar={confirmarPedido}
            onRemover={removeItem}
            totalCarrinho={totalCarrinho}
            primary={primary}
            salvando={salvando}
            erroConfirmar={erroConfirmar}
            hasMercadoPago={hasMercadoPago}
          />
        )}
        {etapa === 'confirmado' && (
          <EtapaConfirmado config={config} totalCarrinho={totalCarrinho} form={form} />
        )}
      </div>

      {/* Barra de carrinho — full-width, conteúdo centralizado */}
      {carrinho.length > 0 && etapa === 'catalogo' && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '0.5px solid #ECE7F4', zIndex: 100 }}>
          <div style={{ maxWidth: 480, margin: '0 auto', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontFamily: 'Manrope, sans-serif', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                {carrinho.reduce((s, i) => s + i.qtd, 0)} {carrinho.reduce((s, i) => s + i.qtd, 0) === 1 ? 'item' : 'itens'}
              </p>
              <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 16, fontWeight: 700, color: primary }}>{fmtR(totalCarrinho)}</p>
            </div>
            <button
              onClick={() => setEtapa('checkout')}
              style={{ height: 42, padding: '0 20px', borderRadius: 10, border: 'none', background: '#F4613A', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >
              Ver carrinho
            </button>
          </div>
        </div>
      )}

      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Playfair+Display:wght@700&display=swap'); @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
