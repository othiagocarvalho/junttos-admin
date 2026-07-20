import { useState, useEffect } from 'react'
import { ClipboardList, Plus, X, ChevronDown } from 'lucide-react'
import { useBalanco } from './useBalanco'

const PRIMARY = '#5E2BD0'

const SEGMENTOS = [
  { value: 'moda',      label: 'Moda / Vestuário' },
  { value: 'farmacia',  label: 'Farmácia / Cosméticos' },
  { value: 'alimentos', label: 'Alimentos / Perecíveis' },
  { value: 'generico',  label: 'Genérico' },
]

const MODOS = [
  { value: 'unico',       label: 'Único',        desc: 'Uma contagem por uma pessoa' },
  { value: 'conferencia', label: 'Conferência',  desc: 'Duas ou mais contagens independentes para comparação' },
  { value: 'setores',     label: 'Setores',      desc: 'Cada pessoa cobre uma área diferente' },
]

const inp = {
  width: '100%', height: 48, border: '1.5px solid #e5e5e5', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15,
  color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box',
}

const lbl = {
  display: 'block', fontSize: 11, fontWeight: 700, color: '#7a7a7a',
  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 6,
  fontFamily: 'Plus Jakarta Sans, sans-serif',
}

export default function BalancoSessao({ onIniciada }) {
  const balanco = useBalanco()

  const [clienteTipo, setClienteTipo] = useState('junttos') // 'junttos' | 'externo'
  const [buscaLoja, setBuscaLoja] = useState('')
  const [lojaSelecionada, setLojaSelecionada] = useState(null) // { loja_id, nome }
  const [lojas, setLojas] = useState([])
  const [lojasFiltradas, setLojasFiltradas] = useState([])
  const [lojaDropOpen, setLojaDropOpen] = useState(false)
  const [clienteExterno, setClienteExterno] = useState('')
  const [segmento, setSegmento] = useState('moda')
  const [deposito, setDeposito] = useState('Loja')
  const [modoCont, setModoCont] = useState('unico')
  const [conferentes, setConferentes] = useState(['', '']) // min 2 for conferencia
  const [setores, setSetores] = useState([{ nome: '', responsavel: '' }])
  const [travarVendas, setTravarVendas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    balanco.buscarLojas().then(({ data }) => setLojas(data))
  }, [])

  useEffect(() => {
    const q = buscaLoja.toLowerCase()
    setLojasFiltradas(
      q ? lojas.filter(l => l.nome.toLowerCase().includes(q) || l.loja_id.toLowerCase().includes(q)) : lojas
    )
  }, [buscaLoja, lojas])

  function addConferente() {
    setConferentes(prev => [...prev, ''])
  }
  function removeConferente(i) {
    setConferentes(prev => prev.filter((_, idx) => idx !== i))
  }
  function setConferente(i, val) {
    setConferentes(prev => prev.map((v, idx) => idx === i ? val : v))
  }

  function addSetor() {
    setSetores(prev => [...prev, { nome: '', responsavel: '' }])
  }
  function removeSetor(i) {
    setSetores(prev => prev.filter((_, idx) => idx !== i))
  }
  function setSetor(i, field, val) {
    setSetores(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  function buildSubcontagens() {
    if (modoCont === 'unico') {
      return [{ nome: 'Contagem', responsavel: null }]
    }
    if (modoCont === 'conferencia') {
      return conferentes.filter(c => c.trim()).map(nome => ({ nome, responsavel: null }))
    }
    return setores.filter(s => s.nome.trim()).map(s => ({ nome: s.nome.trim(), responsavel: s.responsavel.trim() || null }))
  }

  async function handleIniciar() {
    setErro('')
    if (clienteTipo === 'junttos' && !lojaSelecionada) { setErro('Selecione a loja.'); return }
    if (clienteTipo === 'externo' && !clienteExterno.trim()) { setErro('Informe o nome do cliente.'); return }
    const subs = buildSubcontagens()
    if (subs.length === 0) { setErro('Adicione ao menos um conferente / setor.'); return }
    if (modoCont === 'conferencia' && subs.length < 2) { setErro('Conferência requer ao menos 2 conferentes.'); return }

    setSalvando(true)
    const sessaoPayload = {
      loja_id: clienteTipo === 'junttos' ? lojaSelecionada.loja_id : null,
      cliente_tipo: clienteTipo,
      cliente_nome: clienteTipo === 'junttos' ? lojaSelecionada.nome : clienteExterno.trim(),
      segmento,
      deposito: deposito.trim() || 'Loja',
      modo_contagem: modoCont,
      travar_vendas: clienteTipo === 'junttos' ? travarVendas : false,
      status: 'aberta',
    }

    const { data: sessao, error } = await balanco.criarSessao(sessaoPayload)
    if (error) { setErro('Erro ao criar sessão: ' + error.message); setSalvando(false); return }

    const { data: subcontagens, error: errSub } = await balanco.criarSubcontagens(sessao.id, subs)
    if (errSub) { setErro('Erro ao criar subcontagens: ' + errSub.message); setSalvando(false); return }

    onIniciada(sessao, subcontagens)
  }

  const canSubmit = !salvando && (
    (clienteTipo === 'junttos' && !!lojaSelecionada) ||
    (clienteTipo === 'externo' && clienteExterno.trim())
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#F8F7F5', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: PRIMARY, padding: '20px 20px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardList size={20} color="#fff" />
        </div>
        <div>
          <p style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 16, color: '#fff' }}>Balanço de Estoque</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>Nova sessão de contagem</p>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Tipo de cliente */}
        <Section title="Tipo de Cliente">
          <div style={{ display: 'flex', gap: 10 }}>
            {[['junttos', 'Loja Junttos'], ['externo', 'Cliente Externo']].map(([val, label]) => (
              <button key={val} type="button" onClick={() => setClienteTipo(val)} style={{
                flex: 1, height: 48, borderRadius: 12, cursor: 'pointer', fontFamily: 'Plus Jakarta Sans, sans-serif',
                fontSize: 14, fontWeight: 600, border: 'none',
                background: clienteTipo === val ? PRIMARY : '#fff',
                color: clienteTipo === val ? '#fff' : '#7a7a7a',
                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              }}>{label}</button>
            ))}
          </div>
        </Section>

        {/* Loja Junttos */}
        {clienteTipo === 'junttos' && (
          <Section title="Loja">
            <div style={{ position: 'relative' }}>
              <input
                value={lojaSelecionada ? lojaSelecionada.nome : buscaLoja}
                onChange={e => { setBuscaLoja(e.target.value); setLojaSelecionada(null); setLojaDropOpen(true) }}
                onFocus={() => setLojaDropOpen(true)}
                onBlur={() => setTimeout(() => setLojaDropOpen(false), 160)}
                placeholder="Buscar loja por nome..."
                style={inp}
              />
              {lojaDropOpen && lojasFiltradas.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4,
                  background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 12,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)', overflow: 'hidden', maxHeight: 220, overflowY: 'auto',
                }}>
                  {lojasFiltradas.slice(0, 10).map(l => (
                    <button key={l.loja_id} type="button"
                      onMouseDown={() => { setLojaSelecionada(l); setBuscaLoja(l.nome); setLojaDropOpen(false) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                        border: 'none', borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer',
                        fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 500, color: '#1a1a1a',
                      }}
                    >
                      {l.nome}
                      <span style={{ fontSize: 11, color: '#aaa', marginLeft: 6 }}>{l.loja_id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {lojaSelecionada && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 600 }}>{lojaSelecionada.nome} selecionada</span>
              </div>
            )}
          </Section>
        )}

        {/* Cliente externo */}
        {clienteTipo === 'externo' && (
          <Section title="Nome do Estabelecimento">
            <input value={clienteExterno} onChange={e => setClienteExterno(e.target.value)}
              placeholder="Ex: Farmácia Central" style={inp} />
          </Section>
        )}

        {/* Segmento */}
        <Section title="Segmento">
          <div style={{ position: 'relative' }}>
            <select value={segmento} onChange={e => setSegmento(e.target.value)}
              style={{ ...inp, paddingRight: 36, appearance: 'none', cursor: 'pointer' }}>
              {SEGMENTOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={16} color="#aaa" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>
        </Section>

        {/* Depósito */}
        <Section title="Depósito / Área">
          <input value={deposito} onChange={e => setDeposito(e.target.value)}
            placeholder="Ex: Loja, Estoque, Câmara Fria..." style={inp} />
        </Section>

        {/* Modo de contagem */}
        <Section title="Modo de Contagem">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MODOS.map(m => (
              <label key={m.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', cursor: 'pointer',
                borderRadius: 12, border: `1.5px solid ${modoCont === m.value ? PRIMARY : '#e5e5e5'}`,
                background: modoCont === m.value ? `${PRIMARY}0d` : '#fff',
                transition: 'border-color .15s, background .15s',
              }}>
                <input type="radio" name="modo" value={m.value} checked={modoCont === m.value}
                  onChange={() => setModoCont(m.value)} style={{ marginTop: 2, accentColor: PRIMARY }} />
                <div>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>{m.label}</p>
                  <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 2 }}>{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </Section>

        {/* Conferentes */}
        {modoCont === 'conferencia' && (
          <Section title="Conferentes">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {conferentes.map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input value={c} onChange={e => setConferente(i, e.target.value)}
                    placeholder={`Conferente ${i + 1}`}
                    style={{ ...inp, flex: 1 }} />
                  {conferentes.length > 2 && (
                    <button type="button" onClick={() => removeConferente(i)}
                      style={{ width: 38, height: 38, borderRadius: 10, border: 'none', background: '#fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <X size={15} color="#dc2626" />
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addConferente} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                border: '1.5px dashed #d0d0d0', borderRadius: 10, background: 'none', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#7a7a7a',
              }}>
                <Plus size={14} /> Adicionar conferente
              </button>
            </div>
          </Section>
        )}

        {/* Setores */}
        {modoCont === 'setores' && (
          <Section title="Setores">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {setores.map((s, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 14px', background: '#fff', borderRadius: 12, border: '1.5px solid #e5e5e5' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input value={s.nome} onChange={e => setSetor(i, 'nome', e.target.value)}
                      placeholder="Nome do setor (ex: Masculino, Infantil...)"
                      style={{ ...inp, flex: 1, height: 42 }} />
                    {setores.length > 1 && (
                      <button type="button" onClick={() => removeSetor(i)}
                        style={{ width: 36, height: 36, borderRadius: 9, border: 'none', background: '#fee2e2', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <X size={14} color="#dc2626" />
                      </button>
                    )}
                  </div>
                  <input value={s.responsavel} onChange={e => setSetor(i, 'responsavel', e.target.value)}
                    placeholder="Responsável (opcional)"
                    style={{ ...inp, height: 42, fontSize: 13 }} />
                </div>
              ))}
              <button type="button" onClick={addSetor} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px',
                border: '1.5px dashed #d0d0d0', borderRadius: 10, background: 'none', cursor: 'pointer',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#7a7a7a',
              }}>
                <Plus size={14} /> Adicionar setor
              </button>
            </div>
          </Section>
        )}

        {/* Trava de vendas — só para clientes Junttos */}
        {clienteTipo === 'junttos' && (
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 12, padding: '14px 16px',
            background: '#fff', borderRadius: 14, border: '1.5px solid #e5e5e5',
            cursor: 'pointer', marginBottom: 20,
          }}>
            <input type="checkbox" checked={travarVendas} onChange={e => setTravarVendas(e.target.checked)}
              style={{ marginTop: 2, width: 18, height: 18, accentColor: PRIMARY, flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>Travar vendas durante a contagem</p>
              <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 2 }}>
                Bloqueia o checkout da loja enquanto o balanço estiver em andamento.
              </p>
            </div>
          </label>
        )}

        {erro && (
          <p style={{ color: '#dc2626', fontSize: 13, fontWeight: 600, marginBottom: 16, padding: '10px 14px', background: '#fee2e2', borderRadius: 10 }}>
            {erro}
          </p>
        )}

        <button onClick={handleIniciar} disabled={!canSubmit} style={{
          width: '100%', height: 52, borderRadius: 14, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
          background: canSubmit ? PRIMARY : '#d0d0d0', color: '#fff',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 16, fontWeight: 700,
          boxShadow: canSubmit ? '0 4px 16px rgba(94,43,208,0.35)' : 'none',
        }}>
          {salvando ? 'Iniciando...' : 'Iniciar Contagem'}
        </button>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={lbl}>{title}</label>
      {children}
    </div>
  )
}
