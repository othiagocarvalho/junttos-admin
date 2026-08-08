import { useState, useEffect } from 'react'
import { ChevronLeft, CheckCircle, Download, Save } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBalanco } from '../balanco/useBalanco'
import { somarSetores } from '../../utils/balanco'

const AZUL = '#1E63C8'

function fmtDiv(v) {
  if (v == null) return '—'
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : String(v)
}

function divColor(v) {
  if (v == null) return '#8A8A93'
  if (v === 0) return '#1C9257'
  return v < 0 ? '#C4321F' : '#E07A0C'
}

/**
 * Resumo enxuto: só o que faz sentido em modo Único — sem UI de
 * divergência/desempate (aquilo é só pra Conferência, que aqui nem existe).
 * somarSetores() é reaproveitado de utils/balanco.js sem alteração — soma
 * as subcontagens (aqui, só uma) e calcula a diferença contra o sistema.
 */
export default function ContarEstoqueResumo({ sessao, config, fetchAll, setTab }) {
  const balanco = useBalanco()

  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [ajustando, setAjustando] = useState(false)
  const [ajustesOk, setAjustesOk] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    balanco.carregarTodosItens(sessao.id).then(itens => {
      setLinhas(somarSetores(itens))
      setCarregando(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao.id])

  const linhasParaAjuste = linhas.filter(l => l.produto_id && l.divergencia != null && l.divergencia !== 0)
  const totalUnidades = linhas.reduce((s, l) => s + (l.qtdContada || 0), 0)

  async function handleAplicarAjuste() {
    setErro('')
    setAjustando(true)
    const ajustes = linhasParaAjuste.map(l => ({
      produto_id: l.produto_id,
      variacao_label: l.variacao_label,
      qtd_anterior: l.qtd_sistema,
      qtd_nova: l.qtdContada,
    }))
    const err = await balanco.aplicarAjustes(sessao.id, ajustes, config?.nome ? `Lojista — ${config.nome}` : 'Contagem Mercado')
    if (err) { setErro('Erro ao aplicar ajustes: ' + err.message); setAjustando(false); return }
    await balanco.fecharSessao(sessao.id)
    await fetchAll?.()
    setAjustesOk(true)
    setAjustando(false)
  }

  function exportarExcel() {
    const header = ['Produto', 'Variação', 'Código de Barras', 'Lote', 'Validade', 'Qtd Sistema', 'Qtd Contada', 'Diferença']
    const rows = linhas.map(l => [
      l.produto_nome, l.variacao_label || '', l.codigo_barras || '', l.lote || '', l.validade || '',
      l.qtd_sistema ?? '', l.qtdContada ?? '', l.divergencia != null ? l.divergencia : '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Contagem')
    const nome = `contagem_estoque_${(config?.nome || 'loja').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, nome)
  }

  function voltar() {
    setTab('estoque')
  }

  if (carregando) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFFFFF' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${AZUL}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div className="rsm-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      <style>{`
        .rsm-root  { height: 100dvh; }
        .rsm-shell { display: contents; }

        @container (min-width: 1024px) {
          .rsm-root { height: auto; min-height: 100dvh; }

          .rsm-shell {
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

          .rsm-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .rsm-voltar     { color: #71717A !important; }
          .rsm-voltar svg { stroke: #71717A !important; }
          .rsm-titulo     { font-size: 30px !important; color: #18181B !important; }

          .rsm-corpo { padding: 0 !important; overflow: visible !important; }

          .rsm-rodape {
            padding: 22px 0 0 !important;
            flex-direction: row-reverse !important;
            justify-content: flex-start !important;
            border-top: none !important;
          }
          .rsm-rodape button { flex: 0 0 auto !important; min-width: 220px; }
        }
      `}</style>

      <div className="rsm-shell">
        {/* Faixa */}
        <div className="rsm-faixa" style={{ background: AZUL, padding: '14px 22px 20px', flexShrink: 0 }}>
          <button
            className="rsm-voltar"
            onClick={voltar}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
              cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
              fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
            }}
          >
            <ChevronLeft size={24} strokeWidth={2.5} />
            Estoque
          </button>

          <p className="rsm-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
            Resumo da contagem
          </p>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <StatCard value={linhas.length} label="Produtos" />
            <StatCard value={totalUnidades} label="Unidades contadas" />
          </div>
        </div>

        <div className="rsm-corpo" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '16px 22px' }}>
          {ajustesOk ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <CheckCircle size={40} color="#1C9257" style={{ marginBottom: 10 }} />
              <p style={{ fontWeight: 800, fontSize: 17, color: '#18181B' }}>Estoque atualizado!</p>
              <p style={{ fontSize: 14, color: '#71717A', marginTop: 4 }}>Os ajustes foram aplicados com sucesso.</p>
            </div>
          ) : linhas.length > 0 ? (
            <div style={{ background: '#F4F4F7', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px', padding: '10px 14px', background: '#EAEAEF' }}>
                {['Produto', 'Sistema', 'Contado', 'Dif.'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 800, color: '#8A8A93', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</span>
                ))}
              </div>
              {linhas.map((l, i) => (
                <div key={l.key} style={{
                  display: 'grid', gridTemplateColumns: '1fr 70px 70px 60px',
                  padding: '11px 14px', borderTop: i > 0 ? '1px solid #E3E3E9' : 'none',
                  alignItems: 'center', background: '#FFFFFF',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.produto_nome}
                    </p>
                    {l.variacao_label && l.variacao_label !== 'Único' && (
                      <p style={{ fontSize: 11, color: '#8A8A93', marginTop: 1 }}>{l.variacao_label}</p>
                    )}
                  </div>
                  <span style={{ fontSize: 13, color: '#71717A' }}>{l.qtd_sistema ?? '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#18181B' }}>{l.qtdContada ?? '—'}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: divColor(l.divergencia) }}>{fmtDiv(l.divergencia)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', color: '#8A8A93', fontSize: 14, marginTop: 32 }}>
              Nenhum item foi contado.
            </p>
          )}

          {erro && (
            <p style={{ color: '#C4321F', fontSize: 13, marginTop: 16, padding: '10px 14px', background: '#FFF1EC', borderRadius: 10 }}>{erro}</p>
          )}
        </div>

        {/* Rodapé */}
        <div className="rsm-rodape" style={{
          padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 10,
          flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
        }}>
          {ajustesOk ? (
            <button onClick={voltar} style={{
              height: 68, minHeight: 68, borderRadius: 18, border: 'none',
              background: AZUL, color: '#FFFFFF', cursor: 'pointer', fontSize: 18, fontWeight: 800,
            }}>
              Voltar ao estoque
            </button>
          ) : (
            <>
              {linhasParaAjuste.length > 0 ? (
                <button onClick={handleAplicarAjuste} disabled={ajustando} style={{
                  height: 68, minHeight: 68, borderRadius: 18, border: 'none',
                  cursor: ajustando ? 'not-allowed' : 'pointer',
                  background: ajustando ? '#D4D4D8' : AZUL, color: '#FFFFFF',
                  fontSize: 17, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                }}>
                  <Save size={18} />
                  {ajustando ? 'Aplicando...' : `Aplicar ajuste no estoque (${linhasParaAjuste.length})`}
                </button>
              ) : linhas.length > 0 ? (
                <p style={{ textAlign: 'center', fontSize: 14, color: '#1C9257', fontWeight: 700, padding: '10px 0', margin: 0 }}>
                  ✓ Estoque já está correto — nenhum ajuste necessário
                </p>
              ) : null}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={exportarExcel} style={{
                  flex: 1, height: 52, borderRadius: 14, border: '1.5px solid #E3E3E9',
                  background: '#fff', cursor: 'pointer', color: '#18181B',
                  fontSize: 14, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Download size={15} /> Exportar planilha
                </button>
                <button onClick={voltar} style={{
                  flex: 1, height: 52, borderRadius: 14, border: '1px solid #E3E3E9',
                  background: 'none', cursor: 'pointer', color: '#71717A', fontSize: 14, fontWeight: 700,
                }}>
                  Voltar ao estoque
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.18)', borderRadius: 12, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ fontWeight: 800, fontSize: 22, color: '#FFFFFF', margin: 0 }}>{value}</p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', margin: '2px 0 0' }}>{label}</p>
    </div>
  )
}
