import { useState } from 'react'
import { ChevronLeft, Check, Camera } from 'lucide-react'
import BarcodeScanner from '../../components/BarcodeScanner'

const TEAL = '#0E7C86'
const EMPTY = { ean: '', nome: '', preco_venda: '', quantidade: 1, ncm: '', cfop: '' }

function StepPills({ step }) {
  const labels = ['Código', 'Dados', 'Pronto']
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {labels.map((label, i) => (
        <div key={i} style={{
          flex: 1, padding: '8px 0', borderRadius: 999, textAlign: 'center',
          background: i === step ? '#FFFFFF' : 'rgba(255,255,255,.22)',
          fontSize: 14, fontWeight: 800,
          color: i === step ? TEAL : '#FFFFFF',
        }}>
          {i + 1} {label}
        </div>
      ))}
    </div>
  )
}

function ModuleHeader({ onBack, backLabel, step }) {
  return (
    <div style={{ background: TEAL, padding: '14px 22px 20px', flexShrink: 0 }}>
      <button
        onClick={onBack}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          marginBottom: 14, padding: 0,
        }}
      >
        <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2.5} />
        <span style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF' }}>{backLabel}</span>
      </button>
      <StepPills step={step} />
    </div>
  )
}

const FAIXAS_VAZIAS = [{ qtd_minima: '6', preco_faixa: '' }, { qtd_minima: '12', preco_faixa: '' }]

export default function CadastrarProduto({ addProduto, addPrecosFaixas, features, setTab }) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState(EMPTY)
  const [scanner, setScanner] = useState(false)
  const [atacarejo, setAtacarejo] = useState(false)
  const [faixas, setFaixas] = useState(FAIXAS_VAZIAS)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  function setFaixa(i, field, val) {
    setFaixas(prev => prev.map((f, n) => n === i ? { ...f, [field]: val } : f))
  }

  function setF(field, val) { setForm(prev => ({ ...prev, [field]: val })) }

  function handleEanScanned(ean) {
    setScanner(false)
    setF('ean', ean)
    setStep(1)
  }

  async function handleSave() {
    if (!form.nome.trim()) { setErr('Informe o nome do produto.'); return }
    const preco = parseFloat(String(form.preco_venda).replace(',', '.')) || 0
    if (preco <= 0) { setErr('Informe um preço de venda válido.'); return }
    if (form.quantidade <= 0) { setErr('Informe a quantidade inicial.'); return }

    let faixasValidas = []
    if (atacarejo) {
      faixasValidas = faixas.map(f => ({
        qtd_minima:  parseInt(f.qtd_minima, 10) || 0,
        preco_faixa: parseFloat(String(f.preco_faixa).replace(',', '.')) || 0,
      }))
      if (faixasValidas.some(f => f.qtd_minima <= 0 || f.preco_faixa <= 0)) {
        setErr('Preencha a quantidade e o preço das duas faixas de atacado.')
        return
      }
      if (faixasValidas[1].qtd_minima <= faixasValidas[0].qtd_minima) {
        setErr('A segunda faixa precisa de uma quantidade maior que a primeira.')
        return
      }
    }

    setErr('')
    setSaving(true)
    const { error, produto } = await addProduto(form.nome.trim(), {
      ean: form.ean.trim() || null,
      preco_venda: preco,
      variacoes: [{ cor: 'Único', quantidade: form.quantidade }],
      ncm: form.ncm.trim() || null,
      cfop: form.cfop.trim() || null,
    })
    if (error) {
      setSaving(false)
      setErr('Erro ao salvar: ' + (error.message || JSON.stringify(error)))
      return
    }

    if (atacarejo && produto?.id) {
      const { error: errFaixas } = await addPrecosFaixas(produto.id, faixasValidas)
      if (errFaixas) {
        setSaving(false)
        setErr('Produto salvo, mas as faixas de atacado falharam: ' + (errFaixas.message || JSON.stringify(errFaixas)))
        return
      }
    }

    setSaving(false)
    setStep(2)
  }

  function reset() {
    setForm(EMPTY)
    setAtacarejo(false)
    setFaixas(FAIXAS_VAZIAS)
    setErr('')
    setStep(0)
  }

  // ── Step 2: Pronto ──────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        <ModuleHeader onBack={() => setTab('inicio')} backLabel="Menu" step={2} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Check size={34} color="#FFF" strokeWidth={2.5} />
          </div>
          <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#18181B', marginBottom: 8, textAlign: 'center' }}>
            Produto cadastrado!
          </p>
          <p style={{ fontSize: 16, fontWeight: 600, color: '#8A8A93', marginBottom: 36, textAlign: 'center' }}>
            {form.nome} foi adicionado ao estoque.
          </p>
          <button
            onClick={reset}
            style={{
              width: '100%', maxWidth: 320, height: 72, borderRadius: 18, border: 'none',
              background: TEAL, color: '#FFF', cursor: 'pointer',
              fontSize: 18, fontWeight: 800,
            }}
          >
            Cadastrar outro
          </button>
          <button
            onClick={() => setTab('inicio')}
            style={{
              width: '100%', maxWidth: 320, height: 56, borderRadius: 18, border: 'none',
              background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer',
              fontSize: 18, fontWeight: 800, marginTop: 12,
            }}
          >
            Voltar ao menu
          </button>
        </div>
      </div>
    )
  }

  // ── Step 1: Dados ───────────────────────────────────────────────────────────
  if (step === 1) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
        <ModuleHeader onBack={() => setStep(0)} backLabel="Voltar" step={1} />
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 22px 110px' }}>

          {/* EAN confirmation card */}
          {form.ean ? (
            <div style={{
              background: '#E6F4F5', borderRadius: 18, padding: '16px 18px',
              display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: TEAL, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Check size={22} color="#FFF" strokeWidth={2.5} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: '#0A5A61', margin: 0 }}>Código lido com sucesso</p>
                <p style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, color: TEAL, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{form.ean}</p>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
              <span style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 600, whiteSpace: 'nowrap' }}>sem código de barras</span>
              <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
            </div>
          )}

          {/* Nome */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
              Qual o nome do produto?
            </label>
            <input
              style={{
                width: '100%', height: 66, background: '#F4F4F7', border: 'none',
                borderRadius: 16, padding: '0 18px', fontSize: 17, fontWeight: 600,
                color: '#18181B', outline: 'none', boxSizing: 'border-box',
              }}
              placeholder="Ex: Arroz Tio João 5kg"
              value={form.nome}
              onChange={e => setF('nome', e.target.value)}
              autoFocus
            />
          </div>

          {/* Preço */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
              Preço de venda (R$)
            </label>
            <input
              style={{
                width: '100%', height: 66, background: '#FFFFFF', border: `3px solid ${TEAL}`,
                borderRadius: 16, padding: '0 18px', fontSize: 22, fontWeight: 700,
                color: '#18181B', outline: 'none', boxSizing: 'border-box',
                fontFamily: "'Space Mono', monospace",
              }}
              placeholder="0,00"
              inputMode="decimal"
              value={form.preco_venda}
              onChange={e => setF('preco_venda', e.target.value)}
            />
          </div>

          {/* Quantidade */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
              Quantidade em estoque
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <button
                onClick={() => setF('quantidade', Math.max(0, form.quantidade - 1))}
                style={{
                  width: 52, height: 52, borderRadius: 14, border: `2px solid ${TEAL}`,
                  background: '#FFFFFF', cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: TEAL, lineHeight: 1,
                }}
              >−</button>
              <span style={{
                flex: 1, textAlign: 'center',
                fontFamily: "'Space Mono', monospace",
                fontSize: 32, fontWeight: 700, color: '#18181B',
              }}>{form.quantidade}</span>
              <button
                onClick={() => setF('quantidade', form.quantidade + 1)}
                style={{
                  width: 52, height: 52, borderRadius: 14, border: 'none',
                  background: TEAL, cursor: 'pointer', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: '#FFFFFF', lineHeight: 1,
                }}
              >+</button>
            </div>
          </div>

          {/* Atacarejo toggle */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
            background: '#F4F4F7', borderRadius: 16, padding: '16px 18px', marginBottom: atacarejo ? 14 : 24,
          }}>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#18181B', margin: 0 }}>
              Quero preço mais barato pra quem leva mais (atacarejo)
            </p>
            <button
              onClick={() => setAtacarejo(a => !a)}
              style={{
                width: 56, height: 32, borderRadius: 999, border: 'none',
                background: atacarejo ? TEAL : '#D4D4DA',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                transition: 'background 200ms',
              }}
            >
              <span style={{
                position: 'absolute', top: 4,
                left: atacarejo ? 28 : 4,
                width: 24, height: 24, borderRadius: '50%', background: '#FFF',
                display: 'block', transition: 'left 200ms',
              }} />
            </button>
          </div>

          {/* Faixas de preço por quantidade */}
          {atacarejo && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
              {faixas.map((f, i) => (
                <div key={i} style={{ flex: 1, minWidth: 0, background: '#F6F4F0', borderRadius: 14, padding: '14px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#71717A' }}>A partir de</span>
                    <input
                      value={f.qtd_minima}
                      onChange={e => setFaixa(i, 'qtd_minima', e.target.value.replace(/\D/g, ''))}
                      inputMode="numeric"
                      style={{
                        width: 34, border: 'none', borderBottom: '2px solid #D9D5CB', background: 'transparent',
                        fontSize: 15, fontWeight: 800, color: '#18181B', outline: 'none', textAlign: 'center', padding: 0,
                      }}
                    />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#71717A' }}>un.</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#52525B' }}>R$</span>
                    <input
                      value={f.preco_faixa}
                      onChange={e => setFaixa(i, 'preco_faixa', e.target.value)}
                      placeholder="0,00"
                      inputMode="decimal"
                      style={{
                        width: '100%', minWidth: 0, border: 'none', background: 'transparent',
                        fontSize: 20, fontWeight: 800, color: '#18181B', outline: 'none', padding: 0,
                        fontFamily: "'Space Mono', monospace",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* NCM/CFOP — só aparecem com o addon de NFC-e ativo na loja */}
          {features?.nfce_ativo && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
                  NCM
                </label>
                <input
                  style={{
                    width: '100%', height: 56, background: '#F4F4F7', border: 'none',
                    borderRadius: 14, padding: '0 16px', fontSize: 16, fontWeight: 600,
                    color: '#18181B', outline: 'none', boxSizing: 'border-box',
                  }}
                  placeholder="00000000"
                  inputMode="numeric"
                  maxLength={8}
                  value={form.ncm}
                  onChange={e => setF('ncm', e.target.value.replace(/\D/g, ''))}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#71717A', marginBottom: 8 }}>
                  CFOP
                </label>
                <input
                  style={{
                    width: '100%', height: 56, background: '#F4F4F7', border: 'none',
                    borderRadius: 14, padding: '0 16px', fontSize: 16, fontWeight: 600,
                    color: '#18181B', outline: 'none', boxSizing: 'border-box',
                  }}
                  placeholder="5102"
                  inputMode="numeric"
                  maxLength={4}
                  value={form.cfop}
                  onChange={e => setF('cfop', e.target.value.replace(/\D/g, ''))}
                />
              </div>
            </div>
          )}

          {err && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
              padding: '12px 16px', marginBottom: 16,
              fontSize: 14, color: '#DC2626', fontWeight: 600,
            }}>
              {err}
            </div>
          )}
        </div>

        {/* Save button — fixed footer */}
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '14px 22px 28px', background: '#FFFFFF', borderTop: '1px solid #F4F4F7' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', height: 72, borderRadius: 20, border: 'none',
              background: saving ? '#A1C8CB' : TEAL,
              color: '#FFFFFF', cursor: saving ? 'default' : 'pointer',
              fontSize: 18, fontWeight: 800,
            }}
          >
            {saving ? 'Salvando...' : 'Salvar produto'}
          </button>
        </div>
      </div>
    )
  }

  // ── Step 0: Código ──────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      <ModuleHeader onBack={() => setTab('inicio')} backLabel="Menu" step={0} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px' }}>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#18181B', marginBottom: 8, textAlign: 'center' }}>
          Qual o código de barras?
        </p>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#8A8A93', marginBottom: 32, textAlign: 'center' }}>
          Escaneie ou digite o EAN do produto
        </p>

        <button
          onClick={() => setScanner(true)}
          style={{
            width: '100%', maxWidth: 320, height: 72, borderRadius: 20, border: 'none',
            background: TEAL, color: '#FFF', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
            fontSize: 18, fontWeight: 800, marginBottom: 14,
          }}
        >
          <Camera size={24} color="#FFF" strokeWidth={2.2} />
          Escanear código
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 320, marginBottom: 14 }}>
          <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
          <span style={{ fontSize: 13, color: '#A1A1AA', fontWeight: 600 }}>ou</span>
          <div style={{ flex: 1, height: 1, background: '#E4E4E7' }} />
        </div>

        <input
          style={{
            width: '100%', maxWidth: 320, height: 56, background: '#F4F4F7', border: 'none',
            borderRadius: 16, padding: '0 18px', fontSize: 17, fontWeight: 600,
            color: '#18181B', outline: 'none', boxSizing: 'border-box',
            fontFamily: "'Space Mono', monospace", letterSpacing: '0.04em',
          }}
          placeholder="7891000100103"
          inputMode="numeric"
          value={form.ean}
          onChange={e => setF('ean', e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') setStep(1) }}
        />

        <button
          onClick={() => setStep(1)}
          style={{
            width: '100%', maxWidth: 320, height: 56, borderRadius: 16, border: 'none',
            background: '#F4F4F7', color: '#71717A', cursor: 'pointer',
            fontSize: 16, fontWeight: 700, marginTop: 20,
          }}
        >
          Continuar sem código
        </button>
      </div>

      {scanner && (
        <BarcodeScanner
          onDetected={handleEanScanned}
          onClose={() => setScanner(false)}
        />
      )}
    </div>
  )
}
