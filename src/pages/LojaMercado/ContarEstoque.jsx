import { useState, useEffect, useRef } from 'react'
import { ChevronLeft, Camera, Search, X, CheckCircle } from 'lucide-react'
import { useBalanco } from '../balanco/useBalanco'
import { getVarLabel } from '../../utils/balanco'
import BarcodeScanner from '../../components/BarcodeScanner'
import ContarEstoqueResumo from './ContarEstoqueResumo'

const AZUL = '#1E63C8'

const inp = {
  width: '100%', height: 48, border: '1.5px solid #E3E3E9', borderRadius: 12,
  padding: '0 14px', fontFamily: 'inherit', fontSize: 15,
  color: '#18181B', background: '#fff', outline: 'none', boxSizing: 'border-box',
}

/**
 * Sessão de balanço criada automaticamente nos bastidores: modo Único,
 * segmento 'alimentos' (valor permitido pelo CHECK de bal_sessoes; mostra
 * lote/validade na origem), sem escolha de loja/modo — a loja já é a que
 * está logada. Reaproveita bal_sessoes/bal_subcontagens/bal_itens_contados
 * e o hook useBalanco() da Moda sem alterá-los.
 */
export default function ContarEstoque({ lojaId, config, fetchAll, buscarPorEan, setTab }) {
  const balanco = useBalanco()
  const inputRef = useRef(null)

  const [screen, setScreen] = useState('iniciando') // 'iniciando' | 'contagem' | 'resumo'
  const [sessao, setSessao] = useState(null)
  const [subcontagem, setSubcontagem] = useState(null)
  const [erroInicio, setErroInicio] = useState('')

  const [itens, setItens] = useState([])
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState([])
  const [produtoSel, setProdutoSel] = useState(null)
  const [variacaoSel, setVariacaoSel] = useState(null)
  const [qtd, setQtd] = useState(1)
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [modoManual, setModoManual] = useState(false)
  const [nomeManual, setNomeManual] = useState('')
  const [cameraAberta, setCameraAberta] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [ultimoFeedback, setUltimoFeedback] = useState(null)
  const [finalizando, setFinalizando] = useState(false)

  // Cria sessão + subcontagem única ao entrar na tela.
  useEffect(() => {
    let cancelado = false
    async function iniciar() {
      const { data: novaSessao, error } = await balanco.criarSessao({
        loja_id: lojaId,
        cliente_tipo: 'junttos',
        cliente_nome: config?.nome || lojaId,
        // 'alimentos' (não 'mercado') — bal_sessoes.segmento tem um CHECK
        // constraint restrito aos 4 valores de BalancoSessao.jsx; 'alimentos'
        // é o mais correto semanticamente e já é o que ativa lote/validade
        // na origem, embora aqui essas colunas sejam sempre mostradas.
        segmento: 'alimentos',
        deposito: 'Loja',
        modo_contagem: 'unico',
        travar_vendas: false,
        status: 'aberta',
      })
      if (cancelado) return
      if (error) { setErroInicio('Erro ao iniciar contagem: ' + error.message); return }

      const { data: subs, error: errSub } = await balanco.criarSubcontagens(novaSessao.id, [{ nome: 'Contagem', responsavel: null }])
      if (cancelado) return
      if (errSub || !subs?.[0]) { setErroInicio('Erro ao iniciar contagem: ' + (errSub?.message || 'falha ao criar subcontagem')); return }

      setSessao(novaSessao)
      setSubcontagem(subs[0])
      await balanco.iniciarSubcontagem(subs[0].id)
      if (cancelado) return
      setScreen('contagem')
      setTimeout(() => inputRef.current?.focus(), 300)
    }
    iniciar()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Busca por nome (bipagem por EAN usa buscarPorEan, não este endpoint)
  useEffect(() => {
    if (!busca.trim() || modoManual || screen !== 'contagem') { setResultados([]); return }
    const t = setTimeout(async () => {
      const res = await balanco.buscarProduto(busca, lojaId)
      setResultados(res)
    }, 300)
    return () => clearTimeout(t)
  }, [busca, modoManual, screen])

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
    const vars = (p.variacoes || []).map(v => ({ label: getVarLabel(v), raw: v }))
    if (vars.length === 1) setVariacaoSel(vars[0].label)
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
    setUltimoFeedback({ nome: produtoNome, qtd: item.quantidade })
    resetForm()
  }

  async function handleBarcodeDetected(codigo) {
    setCameraAberta(false)
    setBusca(codigo)
    const p = await buscarPorEan?.(codigo)
    if (p) {
      const vars = (p.variacoes || []).map(v => ({ label: getVarLabel(v), raw: v }))
      const varLabel = vars[0]?.label || null
      const qtdSist = vars[0] ? Number(vars[0].raw.quantidade || 0) : null
      await quickAdd(p.id, p.nome, varLabel, qtdSist, codigo)
      return
    }
    setModoManual(true)
    setNomeManual(codigo)
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  async function handleAdicionar() {
    if (salvando) return
    const podeAdicionar = modoManual ? nomeManual.trim() : (produtoSel && variacaoSel !== null)
    if (!podeAdicionar) return

    setSalvando(true)
    let payload
    if (modoManual) {
      payload = {
        produto_id: null,
        produto_nome: nomeManual.trim(),
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
    setUltimoFeedback({ nome: payload.produto_nome, qtd: item.quantidade })
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
    setScreen('resumo')
  }

  if (screen === 'resumo') {
    return (
      <ContarEstoqueResumo
        sessao={sessao}
        config={config}
        fetchAll={fetchAll}
        setTab={setTab}
      />
    )
  }

  const totalItens = itens.reduce((s, i) => s + Number(i.quantidade), 0)
  const variacoes = produtoSel
    ? (produtoSel.variacoes || []).map(v => ({ label: getVarLabel(v), qty: Number(v.quantidade || 0) })).filter(v => v.label)
    : []

  if (screen === 'iniciando') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF', padding: 24 }}>
        {erroInicio ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: '#C4321F' }}>{erroInicio}</p>
            <button onClick={() => setTab('estoque')} style={{
              marginTop: 16, height: 44, padding: '0 20px', borderRadius: 12, border: 'none',
              background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer', fontSize: 14, fontWeight: 700,
            }}>Voltar ao estoque</button>
          </div>
        ) : (
          <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${AZUL}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="ctg-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mesmo padrão responsivo de Estoque.jsx/Validade.jsx: mobile-first com
        faixa azul cheia e rodapé fixo; a partir de 1024px vira cabeçalho
        neutro com conteúdo centralizado e rodapé compacto à direita.
      */}
      <style>{`
        .ctg-root  { height: 100dvh; }
        .ctg-shell { display: contents; }

        @media (min-width: 1024px) {
          .ctg-root { height: auto; min-height: 100dvh; }

          .ctg-shell {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            width: 100%;
            max-width: 720px;
            margin: 0 auto;
            padding: 30px 40px 34px;
            box-sizing: border-box;
          }

          .ctg-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .ctg-voltar     { color: #71717A !important; }
          .ctg-voltar svg { stroke: #71717A !important; }
          .ctg-titulo     { font-size: 30px !important; color: #18181B !important; }
          .ctg-sub        { color: #71717A !important; opacity: 1 !important; }

          .ctg-corpo {
            padding: 0 !important;
            overflow: visible !important;
          }

          .ctg-rodape {
            padding: 22px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .ctg-rodape button { flex: 0 0 auto !important; min-width: 220px; }
        }
      `}</style>

      <div className="ctg-shell">
        {/* Faixa */}
        <div className="ctg-faixa" style={{ background: AZUL, padding: '14px 22px 16px', flexShrink: 0 }}>
          <button
            className="ctg-voltar"
            onClick={() => setTab('estoque')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Estoque
          </button>

          <p className="ctg-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Contar estoque
          </p>
          <p className="ctg-sub" style={{ fontSize: 14, color: '#FFFFFF', opacity: .85, margin: '4px 0 0' }}>
            {totalItens} unidade{totalItens !== 1 ? 's' : ''} contada{totalItens !== 1 ? 's' : ''}
          </p>
        </div>

        <div className="ctg-corpo" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Feedback do último item */}
          {ultimoFeedback && (
            <div style={{
              background: '#1C9257', padding: '10px 22px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle size={16} color="#fff" />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{ultimoFeedback.nome}</span>
              </div>
              <span style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>Total: {ultimoFeedback.qtd}×</span>
            </div>
          )}

          {/* Campo de bipagem */}
          <div style={{ padding: '14px 22px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} color="#8A8A93" style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                <input
                  ref={inputRef}
                  value={busca}
                  onChange={e => { setBusca(e.target.value); setProdutoSel(null); setModoManual(false) }}
                  placeholder="Bipar ou buscar produto..."
                  style={{ ...inp, paddingLeft: 38 }}
                  autoComplete="off"
                />
              </div>
              <button onClick={() => setCameraAberta(true)} style={{
                width: 48, height: 48, borderRadius: 12, border: 'none', background: AZUL,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Camera size={20} color="#fff" />
              </button>
            </div>

            {/* Dropdown de resultados */}
            {!modoManual && resultados.length > 0 && !produtoSel && (
              <div style={{
                background: '#fff', border: '1.5px solid #E3E3E9', borderRadius: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.1)', marginTop: 4, overflow: 'hidden',
              }}>
                {resultados.map(p => {
                  const vars = (p.variacoes || []).map(v => getVarLabel(v)).filter(Boolean)
                  return (
                    <button key={p.id} onClick={() => selecionarProduto(p)} style={{
                      display: 'block', width: '100%', textAlign: 'left', padding: '11px 14px',
                      border: 'none', borderBottom: '1px solid #F1F1F4', background: 'none', cursor: 'pointer',
                    }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#18181B' }}>{p.nome}</p>
                      {vars.length > 0 && vars[0] !== 'Único' && (
                        <p style={{ fontSize: 12, color: '#8A8A93', marginTop: 2 }}>{vars.join(' · ')}</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Produto encontrado */}
            {!modoManual && produtoSel && (
              <div style={{ background: '#F4F4F7', borderRadius: 12, border: `1.5px solid ${AZUL}33`, padding: '12px 14px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: '#18181B' }}>{produtoSel.nome}</p>
                  <button onClick={resetForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A93' }}>
                    <X size={16} />
                  </button>
                </div>

                {variacoes.length > 1 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {variacoes.map(v => (
                        <button key={v.label} onClick={() => setVariacaoSel(v.label)} style={{
                          padding: '6px 14px', borderRadius: 8, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 13, fontWeight: 700, border: 'none',
                          background: variacaoSel === v.label ? AZUL : '#fff',
                          color: variacaoSel === v.label ? '#fff' : '#18181B',
                        }}>
                          {v.label} <span style={{ fontSize: 11, opacity: 0.6 }}>({v.qty})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {variacaoSel && (
                  <p style={{ fontSize: 12, color: '#8A8A93', marginTop: 8 }}>
                    Estoque sistema:{' '}
                    <strong style={{ color: '#18181B' }}>
                      {(produtoSel.variacoes || []).find(v => getVarLabel(v) === variacaoSel)?.quantidade ?? '—'}
                    </strong>
                  </p>
                )}

                <QtyExtrasRow qtd={qtd} setQtd={setQtd} lote={lote} setLote={setLote} validade={validade} setValidade={setValidade} />

                <button onClick={handleAdicionar} disabled={salvando || !variacaoSel} style={{
                  width: '100%', height: 44, marginTop: 12, borderRadius: 10, border: 'none',
                  cursor: salvando || !variacaoSel ? 'not-allowed' : 'pointer',
                  background: salvando || !variacaoSel ? '#D4D4D8' : AZUL,
                  color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                }}>
                  {salvando ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            )}

            {/* Não encontrado */}
            {!modoManual && busca.trim() && !produtoSel && resultados.length === 0 && (
              <div style={{ marginTop: 8, padding: '10px 14px', background: '#F4F4F7', borderRadius: 12, border: '1.5px solid #E3E3E9' }}>
                <p style={{ fontSize: 13, color: '#71717A' }}>Produto não encontrado no catálogo.</p>
                <button onClick={() => { setModoManual(true); setNomeManual(busca) }} style={{
                  marginTop: 6, padding: '6px 14px', borderRadius: 8, border: 'none',
                  background: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: '#18181B',
                }}>
                  Adicionar manualmente
                </button>
              </div>
            )}

            {/* Entrada manual */}
            {modoManual && (
              <div style={{ background: '#F4F4F7', borderRadius: 12, border: '1.5px solid #E3E3E9', padding: '12px 14px', marginTop: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Item avulso</p>
                  <button onClick={() => { setModoManual(false); setNomeManual('') }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8A8A93' }}>
                    <X size={15} />
                  </button>
                </div>
                <input value={nomeManual} onChange={e => setNomeManual(e.target.value)}
                  placeholder="Nome do produto" style={{ ...inp, height: 42, marginBottom: 8, background: '#fff' }} />
                <QtyExtrasRow qtd={qtd} setQtd={setQtd} lote={lote} setLote={setLote} validade={validade} setValidade={setValidade} />
                <button onClick={handleAdicionar} disabled={salvando || !nomeManual.trim()} style={{
                  width: '100%', height: 44, marginTop: 10, borderRadius: 10, border: 'none',
                  cursor: 'pointer', background: AZUL, color: '#fff', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                }}>
                  {salvando ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            )}
          </div>

          {/* Lista de itens */}
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 22px 16px' }}>
            {itens.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#C4C4CC', fontSize: 13, marginTop: 32 }}>
                Nenhum item contado ainda
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {itens.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', background: '#F4F4F7', borderRadius: 12,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 14, fontWeight: 700, color: '#18181B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.produto_nome}
                      </p>
                      {(item.lote || item.validade) && (
                        <p style={{ fontSize: 12, color: '#8A8A93', marginTop: 1 }}>
                          {[item.lote && `Lote: ${item.lote}`, item.validade && `Val: ${item.validade}`].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                      <p style={{ fontWeight: 800, fontSize: 16, color: AZUL }}>{item.quantidade}×</p>
                      {item.qtd_sistema != null && (
                        <p style={{ fontSize: 11, color: '#8A8A93' }}>sist: {item.qtd_sistema}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rodapé */}
        <div className="ctg-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          <button onClick={handleFinalizar} disabled={finalizando} style={{
            flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
            background: AZUL, color: '#FFFFFF', cursor: finalizando ? 'not-allowed' : 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
          }}>
            {finalizando ? 'Finalizando...' : 'Finalizar contagem'}
          </button>
        </div>
      </div>

      {cameraAberta && (
        <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setCameraAberta(false)} />
      )}
    </div>
  )
}

function QtyExtrasRow({ qtd, setQtd, lote, setLote, validade, setValidade }) {
  const sm = { height: 40, border: '1.5px solid #E3E3E9', borderRadius: 10, padding: '0 12px', fontFamily: 'inherit', fontSize: 13, color: '#18181B', background: '#fff', outline: 'none', boxSizing: 'border-box', width: '100%' }
  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#71717A', flexShrink: 0 }}>Qtd:</p>
        <div style={{ display: 'flex', alignItems: 'center', borderRadius: 10, overflow: 'hidden', border: `1.5px solid ${AZUL}`, flexShrink: 0 }}>
          <button onClick={() => setQtd(q => Math.max(1, q - 1))}
            style={{ padding: '0 12px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer', color: AZUL, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>−</button>
          <span style={{ fontWeight: 800, fontSize: 15, color: AZUL, padding: '0 4px', minWidth: 24, textAlign: 'center' }}>{qtd}</span>
          <button onClick={() => setQtd(q => q + 1)}
            style={{ padding: '0 12px', height: 36, background: 'transparent', border: 'none', cursor: 'pointer', color: AZUL, fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <input value={lote} onChange={e => setLote(e.target.value)} placeholder="Lote (opcional)" style={sm} />
        {/* bal_itens_contados.validade é coluna date — input nativo evita
            formato inválido (ex: "12/26" quebraria o insert). */}
        <input type="date" value={validade} onChange={e => setValidade(e.target.value)} style={{ ...sm, color: validade ? '#18181B' : '#8A8A93' }} />
      </div>
    </>
  )
}
