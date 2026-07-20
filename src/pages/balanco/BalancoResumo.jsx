import { useState, useEffect } from 'react'
import { CheckCircle, AlertTriangle, RotateCcw, Download, Save, ChevronLeft } from 'lucide-react'
import * as XLSX from 'xlsx'
import { useBalanco } from './useBalanco'
import { useAuth } from '../../context/AuthContext'
import { compararConferencia, somarSetores } from '../../utils/balanco'

const PRIMARY = '#5E2BD0'

function fmtDiv(v) {
  if (v == null) return '—'
  if (v === 0) return '±0'
  return v > 0 ? `+${v}` : String(v)
}

function divColor(v) {
  if (v == null) return '#aaa'
  if (v === 0) return '#16a34a'
  return v < 0 ? '#dc2626' : '#f59e0b'
}

export default function BalancoResumo({ sessao, subcontagens, onDesempate, onNovaSessao }) {
  const balanco = useBalanco()
  const { user } = useAuth()

  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [ajustando, setAjustando] = useState(false)
  const [ajustesOk, setAjustesOk] = useState(false)
  const [criandoDesempate, setCriandoDesempate] = useState(false)
  const [erro, setErro] = useState('')

  const modoConferencia = sessao.modo_contagem === 'conferencia'
  const isJunttos = sessao.cliente_tipo === 'junttos'
  const rodadaMax = Math.max(...subcontagens.map(s => s.rodada || 1), 1)

  useEffect(() => {
    balanco.carregarTodosItens(sessao.id).then(itens => {
      const res = modoConferencia ? compararConferencia(itens) : somarSetores(itens)
      setLinhas(res)
      setCarregando(false)
    })
  }, [sessao.id, modoConferencia])

  const divergencias = linhas.filter(l => l.batimento === 'divergencia')
  const confirmados = linhas.filter(l => l.batimento === 'ok')
  const linhasParaAjuste = confirmados.filter(l => l.produto_id && l.divergencia != null && l.divergencia !== 0)

  async function handleAplicarAjuste() {
    setErro('')
    setAjustando(true)
    const ajustes = linhasParaAjuste.map(l => ({
      produto_id: l.produto_id,
      variacao_label: l.variacao_label,
      qtd_anterior: l.qtd_sistema,
      qtd_nova: l.qtdContada,
    }))
    const err = await balanco.aplicarAjustes(sessao.id, ajustes, user?.name || 'Equipe Junttos')
    if (err) { setErro('Erro ao aplicar ajustes: ' + err.message); setAjustando(false); return }
    await balanco.fecharSessao(sessao.id)
    setAjustesOk(true)
    setAjustando(false)
  }

  async function handleDesempate() {
    setCriandoDesempate(true)
    const novaRodada = rodadaMax + 1
    const { data, error } = await balanco.criarDesempate(sessao.id, novaRodada)
    if (error) { setErro('Erro ao criar desempate: ' + error.message); setCriandoDesempate(false); return }
    onDesempate(data)
  }

  function exportarExcel() {
    const header = [
      'Produto', 'Variação', 'Código de Barras', 'Lote', 'Validade',
      'Qtd Sistema', 'Qtd Contada', 'Diferença',
    ]
    const rows = linhas.map(l => [
      l.produto_nome,
      l.variacao_label || '',
      l.codigo_barras || '',
      l.lote || '',
      l.validade || '',
      l.qtd_sistema ?? '',
      l.qtdContada ?? (l.batimento === 'divergencia' ? 'DIVERGÊNCIA' : ''),
      l.divergencia != null ? l.divergencia : '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Balanço')
    const nome = `balanco_${sessao.cliente_nome?.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, nome)
  }

  if (carregando) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F8F7F5' }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: `2.5px solid ${PRIMARY}`, borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#F8F7F5', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: PRIMARY, padding: '16px 16px 20px' }}>
        <p style={{ fontFamily: 'Space Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
          {sessao.cliente_nome} · {sessao.modo_contagem === 'unico' ? 'Único' : sessao.modo_contagem === 'conferencia' ? 'Conferência' : 'Setores'}
        </p>
        <p style={{ fontWeight: 700, fontSize: 18, color: '#fff', marginTop: 4 }}>Resumo do Balanço</p>

        {/* Cards de estatísticas */}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <StatCard value={confirmados.length} label="Confirmados" color="#16a34a" />
          {modoConferencia && <StatCard value={divergencias.length} label={divergencias.length === 1 ? 'Divergência' : 'Divergências'} color={divergencias.length > 0 ? '#f59e0b' : '#16a34a'} />}
          <StatCard value={linhas.length} label="Produtos" color="rgba(255,255,255,0.6)" />
        </div>
      </div>

      <div style={{ padding: '16px 16px 48px', maxWidth: 720, margin: '0 auto' }}>

        {/* Divergências — Modo Conferência */}
        {modoConferencia && divergencias.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader icon={<AlertTriangle size={15} color="#f59e0b" />} title={`${divergencias.length} divergência${divergencias.length !== 1 ? 's' : ''} encontrada${divergencias.length !== 1 ? 's' : ''}`} color="#f59e0b" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {divergencias.map(l => (
                <div key={l.key} style={{ background: '#fff', borderRadius: 12, border: '1.5px solid #fde68a', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: 14, color: '#1a1a1a' }}>
                        {l.produto_nome}{l.variacao_label ? ` — ${l.variacao_label}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                        {[...l.porSubcontagem.entries()].map(([subId, qty], i) => {
                          const sub = subcontagens.find(s => s.id === subId)
                          return (
                            <span key={subId} style={{ fontSize: 12, color: '#7a7a7a' }}>
                              {sub?.nome || `Sub ${i + 1}`}: <strong style={{ color: '#1a1a1a' }}>{qty}</strong>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#f59e0b', fontFamily: 'Space Mono, monospace' }}>?</span>
                  </div>
                </div>
              ))}
            </div>
            {!ajustesOk && (
              <button onClick={handleDesempate} disabled={criandoDesempate} style={{
                marginTop: 12, width: '100%', height: 46, borderRadius: 12, border: `1.5px solid #f59e0b`,
                background: '#fffbeb', cursor: 'pointer', color: '#92400e',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <RotateCcw size={15} /> {criandoDesempate ? 'Criando...' : 'Iniciar contagem de desempate'}
              </button>
            )}
          </div>
        )}

        {/* Tabela de resultados */}
        {linhas.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <SectionHeader
              icon={<CheckCircle size={15} color="#16a34a" />}
              title={modoConferencia ? `${confirmados.length} item${confirmados.length !== 1 ? 's' : ''} confirmado${confirmados.length !== 1 ? 's' : ''}` : `${linhas.length} produto${linhas.length !== 1 ? 's' : ''} contado${linhas.length !== 1 ? 's' : ''}`}
              color="#16a34a"
            />
            <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #eee', overflow: 'hidden' }}>
              {/* Table header */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px 72px', padding: '10px 14px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                {['Produto', 'Sistema', 'Contado', 'Dif.'].map(h => (
                  <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{h}</span>
                ))}
              </div>
              {(modoConferencia ? confirmados : linhas).map((l, i) => (
                <div key={l.key} style={{
                  display: 'grid', gridTemplateColumns: '1fr 80px 80px 72px',
                  padding: '11px 14px', borderBottom: i < linhas.length - 1 ? '1px solid #f8f8f8' : 'none',
                  alignItems: 'center',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.produto_nome}
                    </p>
                    {l.variacao_label && (
                      <p style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{l.variacao_label}</p>
                    )}
                  </div>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, color: '#7a7a7a' }}>
                    {l.qtd_sistema ?? '—'}
                  </span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, color: '#1a1a1a' }}>
                    {l.qtdContada ?? '—'}
                  </span>
                  <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 13, fontWeight: 700, color: divColor(l.divergencia) }}>
                    {fmtDiv(l.divergencia)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {erro && (
          <p style={{ color: '#dc2626', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: '#fee2e2', borderRadius: 10 }}>{erro}</p>
        )}

        {/* Ações */}
        {ajustesOk ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircle size={40} color="#16a34a" style={{ marginBottom: 10 }} />
            <p style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>Estoque atualizado!</p>
            <p style={{ fontSize: 13, color: '#7a7a7a', marginTop: 4 }}>Os ajustes foram aplicados com sucesso.</p>
            <button onClick={exportarExcel} style={{
              marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 10, border: `1px solid #e5e5e5`,
              background: '#fff', cursor: 'pointer',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, fontWeight: 600, color: '#1a1a1a',
            }}>
              <Download size={15} /> Exportar relatório
            </button>
            <button onClick={onNovaSessao} style={{
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', height: 48, borderRadius: 12, border: 'none',
              background: PRIMARY, cursor: 'pointer', color: '#fff', justifyContent: 'center',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700,
            }}>
              Nova contagem
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {isJunttos && linhasParaAjuste.length > 0 && divergencias.length === 0 && (
              <button onClick={handleAplicarAjuste} disabled={ajustando} style={{
                height: 52, borderRadius: 14, border: 'none', cursor: ajustando ? 'not-allowed' : 'pointer',
                background: ajustando ? '#d0d0d0' : PRIMARY, color: '#fff',
                fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 15, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: ajustando ? 'none' : '0 4px 16px rgba(94,43,208,0.35)',
              }}>
                <Save size={18} />
                {ajustando ? 'Aplicando...' : `Aplicar ajuste no estoque (${linhasParaAjuste.length} item${linhasParaAjuste.length !== 1 ? 's' : ''})`}
              </button>
            )}
            {isJunttos && linhasParaAjuste.length === 0 && divergencias.length === 0 && (
              <p style={{ textAlign: 'center', fontSize: 13, color: '#16a34a', fontWeight: 600, padding: '10px 0' }}>
                ✓ Estoque já está correto — nenhum ajuste necessário
              </p>
            )}
            <button onClick={exportarExcel} style={{
              height: 46, borderRadius: 12, border: '1.5px solid #e5e5e5',
              background: '#fff', cursor: 'pointer', color: '#1a1a1a',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <Download size={15} /> Exportar planilha Excel
            </button>
            <button onClick={onNovaSessao} style={{
              height: 46, borderRadius: 12, border: '1px solid #e5e5e5',
              background: 'none', cursor: 'pointer', color: '#7a7a7a',
              fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
              <ChevronLeft size={15} /> Nova contagem
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ value, label, color }) {
  return (
    <div style={{ flex: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
      <p style={{ fontFamily: 'Space Mono, monospace', fontWeight: 700, fontSize: 22, color }}>
        {value}
      </p>
      <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{label}</p>
    </div>
  )
}

function SectionHeader({ icon, title, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      {icon}
      <p style={{ fontSize: 13, fontWeight: 700, color }}>{title}</p>
    </div>
  )
}
