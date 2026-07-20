import { useState, useEffect, useRef, useCallback } from 'react'
import { Camera, X, Search, Plus, Minus, CheckCircle, ChevronRight, AlertCircle } from 'lucide-react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { useBalanco } from './useBalanco'
import { getVarLabel } from '../../utils/balanco'

const PRIMARY = '#5E2BD0'
const SEGMENTOS_EXTRAS = ['farmacia', 'alimentos'] // show lote/validade

const inp = {
  width: '100%', height: 48, border: '1.5px solid #e5e5e5', borderRadius: 12,
  padding: '0 14px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15,
  color: '#1a1a1a', background: '#fff', outline: 'none', boxSizing: 'border-box',
}

// ── Barcode Scanner overlay ───────────────────────────────────────────────────
function BarcodeScanner({ onDetected, onClose }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [permErr, setPermErr] = useState(false)

  const handleDetected = useCallback(onDetected, [])

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    reader.decodeFromConstraints(
      { video: { facingMode: { ideal: 'environment' } } },
      videoRef.current,
      (result) => {
        if (result) {
          controlsRef.current?.stop()
          handleDetected(result.getText())
        }
      }
    ).then(controls => {
      controlsRef.current = controls
    }).catch(err => {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermErr(true)
      }
    })
    return () => { controlsRef.current?.stop() }
  }, [handleDetected])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 20, padding: 20,
    }}>
      {permErr ? (
        <div style={{ textAlign: 'center', color: '#fff', padding: 20 }}>
          <AlertCircle size={40} color="#f59e0b" style={{ marginBottom: 12 }} />
          <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 600 }}>
            Permissão de câmera negada
          </p>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 6 }}>
            Ative o acesso à câmera nas configurações do navegador.
          </p>
        </div>
      ) : (
        <>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
            Aponte para o código de barras
          </p>
          <div style={{ position: 'relative', width: '100%', maxWidth: 380 }}>
            <video ref={videoRef} style={{ width: '100%', borderRadius: 14, display: 'block', background: '#111' }} />
            {/* Aiming box */}
            <div style={{
              position: 'absolute', top: '35%', left: '10%', right: '10%', height: '30%',
              border: '2px solid rgba(94,43,208,0.8)', borderRadius: 8,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
            }} />
          </div>
        </>
      )}
      <button onClick={() => { controlsRef.current?.stop(); onClose() }}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 28px', borderRadius: 12, border: 'none',
          background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
        }}>
        <X size={16} /> Fechar câmera
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BalancoContagem({ sessao, subcontagem, subcontagemIdx, totalSubcontagens, onFinalizada }) {
  const balanco = useBalanco()
  const inputRef = useRef(null)

  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [produtoSel, setProdutoSel] = useState(null)  // product found in DB
  const [variacaoSel, setVariacaoSel] = useState(null)
  const [qtd, setQtd] = useState(1)
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [nomeManual, setNomeManual] = useState('')
  const [cameraAberta, setCameraAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [ultimoFeedback, setUltimoFeedback] = useState(null) // { nome, qtd }
  const [finalizando, setFinalizando] = useState(false)
  const [iniciado, setIniciado] = useState(false)

  const isJunttos = sessao.cliente_tipo === 'junttos'
  const precisaExtras = SEGMENTOS_EXTRAS.includes(sessao.segmento)

  // Mark sub-count as started and load existing items
  useEffect(() => {
    if (!subcontagem) return
    balanco.iniciarSubcontagem(subcontagem.id)
    balanco.carregarItensDaSubcontagem(subcontagem.id).then(data => {
      setItens(data)
      setIniciado(true)
    })
    // Focus input after start
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [subcontagem?.id])

  // Search products (debounced)
  useEffect(() => {
    if (!isJunttos || !busca.trim() || modoManual) {
      setResultados([])
      return
    }
    const t = setTimeout(async () => {
      const res = await balanco.buscarProduto(busca, sessao.loja_id)
      setResultados(res)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, isJunttos, modoManual])

  function resetForm() {
    setBusca('')
    setResultados([])
    setProdutoSel(null)
    setVariacaoSel(null)
    setQtd(1)
    setLote('')
    setValidade('')
    setModoManual(false)
    setNomeManual('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  function selecionarProduto(p) {
    setProdutoSel(p)
    setResultados([])
    setBusca(p.nome)
    // Auto-select if single variation
    const vars = (p.variacoes || []).map(v => ({ label: getVarLabel(v), qty: Number(v.quantidade || 0), raw: v }))
    if (vars.length === 1 || (vars.length === 1 && vars[0].label === 'Único')) {
      setVariacaoSel(vars[0].label)
    }
  }

  async function handleBarcodeDetected(codigo) {
    setCameraAberta(false)
    setBusca(codigo)
    if (isJunttos) {
      const res = await balanco.buscarProduto(codigo, sessao.loja_id)
      if (res.length > 0) {
        const p = res[0]
        const vars = (p.variacoes || []).map(v => ({ label: getVarLabel(v), raw: v }))
        // Quick-add: single variation → add immediately
        if (vars.length <= 1) {
          const varLabel = vars[0]?.label || null
          const qtdSist = vars[0] ? Number(vars[0].raw.quantidade || 0) : null
          await quickAdd(p.id, p.nome, varLabel, qtdSist, codigo)
          return
        }
        selecionarProduto(p)
      } else {
        setModoManual(true)
        setNomeManual(codigo)
      }
    } else {
      // External: always manual
      setModoManual(true)
      setNomeManual(codigo)
    }
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function quickAdd(produtoId, produtoNome, varLabel, qtdSistema, codigo) {
    const item = await balanco.addItem(subcontagem.id, {
      produto_id: produtoId,
      produto_nome: produtoNome,
      variacao_label: varLabel,
      quantidade: 1,
      codigo_barras: codigo || null,
      lote: null, validade: null,
      qtd_sistema: qtdSistema,
    })
    atualizarLista(item)
    setUltimoFeedback({ nome: produtoNome + (varLabel ? ` — ${varLabel}` : ''), qtd: item.quantidade })
    resetForm()
  }

  async function handleAdicionar() {
    if (salvando) return
    const podeAdicionar = modoManual
      ? nomeManual.trim()
      : (isJunttos ? (produtoSel && variacaoSel !== undefined) : !!busca.trim())
    if (!podeAdicionar) return

    setSalvando(true)

    let payload
    if (modoManual || !isJunttos) {
      payload = {
        produto_id: null,
        produto_nome: modoManual ? nomeManual.trim() : busca.trim(),
        variacao_label: null,
        quantidade: qtd,
        codigo_barras: busca || null,
        lote: lote || null,
        validade: validade || null,
        qtd_sistema: null,
      }
    } else {
      const variacao = (produtoSel.variacoes || []).find(v => getVarLabel(v) === variacaoSel)
      payload = {
        produto_id: produtoSel.id,
        produto_nome: produtoSel.nome,
        variacao_label: variacaoSel,
        quantidade: qtd,
        codigo_barras: busca || null,
        lote: lote || null,
        validade: validade || null,
        qtd_sistema: variacao ? Number(variacao.quantidade || 0) : null,
      }
    }

    const item = await balanco.addItem(subcontagem.id, payload)
    atualizarLista(item)
    setUltimoFeedback({ nome: payload.produto_nome + (payload.variacao_label ? ` — ${payload.variacao_label}` : ''), qtd: item.quantidade })
    setSalvando(false)
    resetForm()
  }

  function atualizarLista(item) {
    setItens(prev => {
      const idx = prev.findIndex(i => i.id === item.id)
      if (idx >= 0) return prev.map((it, i) => i === idx ? item : it)
      return [item, ...prev]
    })
  }

  async function handleFinalizar() {
    setFinalizando(true)
    await balanco.finalizarSubcontagem(subcontagem.id)
    onFinalizada()
  }

  const totalItens = itens.reduce((s, i) => s + Number(i.quantidade), 0)
  const nomeSubcontagem = subcontagem?.nome || 'Contagem'
  const label = totalSubcontagens > 1
    ? `${nomeSubcontagem} — ${subcontagemIdx + 1} de ${totalSubcontagens}`
    : nomeSubcontagem

  const variacoes = produtoSel
    ? (produtoSel.variacoes || []).map(v => ({ label: getVarLabel(v), qty: Number(v.quantidade || 0) })).filter(v => v.label)
    : []

  return (
    <div style={{ minHeight: '100dvh', background: '#F8F7F5', fontFamily: 'Plus Jakarta Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: PRIMARY, padding: '14px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{sessao.cliente_nome}</p>
            <p style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginTop: 2 }}>{label}</p>
          </div>
          <button onClick={handleFinalizar} disabled={finalizando}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(255,255,255,0.18)', color: '#fff',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 700,
            }}>
            {finalizando ? 'Finalizando...' : 'Finalizar'} <ChevronRight size={14} />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 6 }}>
          {totalItens} unidade{totalItens !== 1 ? 's' : ''} contada{totalItens !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Feedback do último item */}
      {ultimoFeedback && (
        <div style={{
          background: '#16a34a', padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} color="#fff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{ultimoFeedback.nome}</span>
          </div>
          <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#fff' }}>
            Total: {ultimoFeedback.qtd}×
          </span>
        </div>
      )}

      {/* Campo de bipagem */}
      <div style={{ padding: '14px 16px 0', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} color="#aaa" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              ref={inputRef}
              value={busca}
              onChange={e => { setBusca(e.target.value); setProdutoSel(null); setModoManual(false) }}
              onKeyDown={e => { if (e.key === 'Enter' && !isJunttos && busca.trim()) handleAdicionar() }}
              placeholder={isJunttos ? 'Bipar ou buscar produto...' : 'Nome ou código do produto...'}
              style={{ ...inp, paddingLeft: 38 }}
              autoComplete="off"
            />
          </div>
          <button onClick={() => setCameraAberta(true)} style={{
            width: 48, height: 48, borderRadius: 12, border: 'none', background: PRIMARY,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Camera size={20} color="#fff" />
          </button>
        </div>

        {/* Dropdown de resultados Junttos */}
        {isJunttos && !modoManual && resultados.length > 0 && !produtoSel && (
          <div style={{
            background: '#fff', border: '1.5px solid #e5e5e5', borderRadius: 12,
            boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 4, overflow: 'hidden',
          }}>
            {resultados.map(p => {
              const vars = (p.variacoes || []).map(v => getVarLabel(v)).filter(Boolean)
              return (
                <button key={p.id} onClick={() => selecionarProduto(p)} style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                  border: 'none', borderBottom: '1px solid #f0f0f0', background: 'none', cursor: 'pointer',
                }}>
                  <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600, color: '#1a1a1a' }}>{p.nome}</p>
                  {vars.length > 0 && (
                    <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 2 }}>{vars.join(' · ')}</p>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Produto encontrado — card de seleção */}
        {isJunttos && !modoManual && produtoSel && (
          <div style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${PRIMARY}33`, padding: '12px 14px', marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ fontWeight: 700, fontSize: 15, color: '#1a1a1a' }}>{produtoSel.nome}</p>
              <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
                <X size={16} />
              </button>
            </div>

            {variacoes.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                  Variação
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {variacoes.map(v => (
                    <button key={v.label} onClick={() => setVariacaoSel(v.label)} style={{
                      padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600,
                      border: 'none',
                      background: variacaoSel === v.label ? PRIMARY : '#f0f0f0',
                      color: variacaoSel === v.label ? '#fff' : '#1a1a1a',
                    }}>
                      {v.label}
                      <span style={{ fontSize: 11, opacity: 0.6, marginLeft: 4 }}>({v.qty})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {variacaoSel && (
              <p style={{ fontSize: 12, color: '#7a7a7a', marginTop: 8 }}>
                Estoque sistema:{' '}
                <strong style={{ color: '#1a1a1a' }}>
                  {(produtoSel.variacoes || []).find(v => getVarLabel(v) === variacaoSel)?.quantidade ?? '—'}
                </strong>
              </p>
            )}

            <QtyExtrasRow qtd={qtd} setQtd={setQtd} lote={lote} setLote={setLote} validade={validade} setValidade={setValidade} precisaExtras={precisaExtras} />

            <button onClick={handleAdicionar}
              disabled={salvando || !variacaoSel}
              style={{
                width: '100%', height: 44, marginTop: 12, borderRadius: 10, border: 'none',
                cursor: salvando || !variacaoSel ? 'not-allowed' : 'pointer',
                background: salvando || !variacaoSel ? '#d0d0d0' : PRIMARY,
                color: '#fff', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
              }}>
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        )}

        {/* Produto não encontrado → entrada manual */}
        {isJunttos && !modoManual && busca.trim() && !produtoSel && resultados.length === 0 && (
          <div style={{ marginTop: 8, padding: '10px 14px', background: '#fff', borderRadius: 12, border: '1.5px solid #e5e5e5' }}>
            <p style={{ fontSize: 13, color: '#7a7a7a' }}>Produto não encontrado no catálogo.</p>
            <button onClick={() => { setModoManual(true); setNomeManual(busca) }} style={{
              marginTop: 6, padding: '6px 14px', borderRadius: 8, border: 'none',
              background: '#f0f0f0', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#1a1a1a',
            }}>
              Adicionar manualmente
            </button>
          </div>
        )}

        {/* Entrada manual */}
        {(modoManual || !isJunttos) && busca.trim() && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #e5e5e5', padding: '12px 14px', marginTop: 8 }}>
            {modoManual && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#7a7a7a', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Item avulso</p>
                  <button onClick={() => { setModoManual(false); setNomeManual('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa' }}>
                    <X size={15} />
                  </button>
                </div>
                <input value={nomeManual} onChange={e => setNomeManual(e.target.value)}
                  placeholder="Nome do produto" style={{ ...inp, height: 42, marginBottom: 8 }} />
              </>
            )}
            <QtyExtrasRow qtd={qtd} setQtd={setQtd} lote={lote} setLote={setLote} validade={validade} setValidade={setValidade} precisaExtras={precisaExtras} />
            <button onClick={handleAdicionar} disabled={salvando || (modoManual && !nomeManual.trim())} style={{
              width: '100%', height: 44, marginTop: 10, borderRadius: 10, border: 'none',
              cursor: 'pointer', background: PRIMARY, color: '#fff',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
            }}>
              {salvando ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        )}
      </div>

      {/* Lista de itens */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px' }}>
        {itens.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#bbb', fontSize: 13, marginTop: 32 }}>
            Nenhum item contado ainda
          </p>
        ) : (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
              Itens contados ({itens.length} produto{itens.length !== 1 ? 's' : ''})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {itens.map(item => (
                <div key={item.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#fff', borderRadius: 12, border: '1px solid #eee',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.produto_nome}
                    </p>
                    <p style={{ fontSize: 12, color: '#aaa', marginTop: 1 }}>
                      {[item.variacao_label, item.lote && `Lote: ${item.lote}`, item.validade && `Val: ${item.validade}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                    <p style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 16, color: PRIMARY }}>
                      {item.quantidade}×
                    </p>
                    {item.qtd_sistema != null && (
                      <p style={{ fontSize: 11, color: '#aaa' }}>sist: {item.qtd_sistema}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {cameraAberta && (
        <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setCameraAberta(false)} />
      )}
    </div>
  )
}

// ── Shared quantity + extras row ─────────────────────────────────────────────
function QtyExtrasRow({ qtd, setQtd, lote, setLote, validade, setValidade, precisaExtras }) {
  const sm = { height: 40, border: '1.5px solid #e5e5e5', borderRadius: 10, padding: '0 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: '#1a1a1a', background: '#f8f8f8', outline: 'none', boxSizing: 'border-box', width: '100%' }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#7a7a7a', flexShrink: 0 }}>Qtd:</p>
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${PRIMARY}`, flexShrink: 0 }}>
          <button onClick={() => setQtd(q => Math.max(1, q - 1))}
            style={{ padding: '0 12px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>−</button>
          <span style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 15, color: PRIMARY, padding: '0 4px', minWidth: 24, textAlign: 'center' }}>{qtd}</span>
          <button onClick={() => setQtd(q => q + 1)}
            style={{ padding: '0 12px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer', color: PRIMARY, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</button>
        </div>
      </div>
      {precisaExtras && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input value={lote} onChange={e => setLote(e.target.value)} placeholder="Lote" style={sm} />
          <input value={validade} onChange={e => setValidade(e.target.value)} placeholder="Validade (MM/AA)" style={sm} />
        </div>
      )}
    </>
  )
}
