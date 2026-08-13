import { useMemo, useState } from 'react'
import { ChevronLeft, Check, Delete, MessageCircle } from 'lucide-react'
import {
  diaISO, resumoCaixa, participacao, conferirContagem, jaFechado,
  contasDeAmanha, urgenciaConta, COR_URGENCIA,
} from '../../utils/caixa'
import { fmtDiaMes } from '../../utils/datas'
import { fmtR } from '../../utils/formatters'

const GRAFITE = '#3A3A44'
const VERDE   = '#17864F'

// Cada opção vira o texto salvo em lf_caixas.motivo_diferenca.
const MOTIVOS = [
  'Dei troco errado',
  'Tirei dinheiro pra uma despesa',
  'Não sei explicar',
]

// ═══════════════════════════════════════════════════════════════
// T10 · Caixa de hoje
// ═══════════════════════════════════════════════════════════════
function CardTopo({ label, valor, corValor, branco }) {
  return (
    <div style={{
      flex: 1, minWidth: 0, borderRadius: 16, padding: '12px 14px',
      background: branco ? '#FFFFFF' : 'rgba(255,255,255,.12)',
    }}>
      <p style={{ fontSize: 14, margin: 0, color: branco ? '#71717A' : 'rgba(255,255,255,.85)' }}>{label}</p>
      <p style={{
        fontSize: 20, fontWeight: 800, margin: '2px 0 0',
        color: branco ? '#18181B' : corValor,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{valor}</p>
    </div>
  )
}

function Origem({ forma, valor, pct }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#3F3F46', margin: 0, width: 74, flexShrink: 0 }}>{forma}</p>
      <div style={{ flex: 1, height: 16, background: '#E4E4E8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: GRAFITE, borderRadius: 999 }} />
      </div>
      <p style={{ fontSize: 15, fontWeight: 800, color: '#18181B', margin: 0, width: 92, textAlign: 'right', flexShrink: 0 }}>
        {fmtR(valor)}
      </p>
    </div>
  )
}

function Painel({ resumo, contas, fechado, onSaida, onFechar, setTab }) {
  const origens = participacao(resumo.entradas)

  return (
    <>
      <div className="cx-faixa" style={{ background: GRAFITE, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button
          className="cx-voltar"
          onClick={() => setTab('inicio')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
            fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          Menu
        </button>

        <p className="cx-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 16px' }}>
          Caixa de hoje
        </p>

        <div className="cx-cards" style={{ display: 'flex', gap: 10 }}>
          <CardTopo label="Entrou" valor={fmtR(resumo.entrou)} corValor="#7BE8AE" />
          <CardTopo label="Saiu"   valor={fmtR(resumo.saiu)}   corValor="#FFB3A3" />
          <CardTopo label="Sobrou" valor={fmtR(resumo.sobrou)} branco />
        </div>
      </div>

      <div className="cx-corpo" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        {/* De onde veio o dinheiro */}
        <div className="cx-origens" style={{ background: '#F4F4F7', borderRadius: 20, padding: '18px 20px' }}>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: '0 0 14px' }}>
            De onde veio o dinheiro
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {origens.map(o => <Origem key={o.forma} {...o} />)}
          </div>
          {resumo.entradas.fiado > 0 && (
            <p style={{ fontSize: 14, color: '#71717A', margin: '14px 0 0' }}>
              Mais {fmtR(resumo.entradas.fiado)} em fiado, que não entrou no caixa.
            </p>
          )}
        </div>

        {/* Contas a pagar */}
        <div>
          <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: '0 0 12px' }}>Contas a pagar</p>
          {contas.length === 0 ? (
            <div style={{ background: '#F4F4F7', borderRadius: 16, padding: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#52525B', margin: 0 }}>Nenhuma conta cadastrada</p>
              <p style={{ fontSize: 14, color: '#8A8A93', margin: '4px 0 0' }}>
                As contas do mês aparecem aqui quando forem cadastradas.
              </p>
            </div>
          ) : (
            <div className="cx-contas" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {contas.map(c => {
                const cor = COR_URGENCIA[urgenciaConta(c)]
                return (
                  <div key={c.id} style={{
                    background: cor.fundo, borderRadius: 16, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{c.descricao}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: cor.texto, margin: '2px 0 0' }}>
                        vence {fmtDiaMes(c.data_vencimento)}
                      </p>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 800, color: cor.texto, margin: 0, flexShrink: 0 }}>
                      {fmtR(c.valor)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <div className="cx-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex', gap: 12,
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button
          onClick={onSaida}
          style={{
            flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
            background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer',
            fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap',
          }}
        >
          Anotar saída
        </button>
        <button
          onClick={onFechar}
          disabled={fechado}
          style={{
            flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
            background: fechado ? '#E4E4E8' : GRAFITE,
            color: fechado ? '#8A8A93' : '#FFFFFF',
            cursor: fechado ? 'default' : 'pointer',
            fontSize: 17, fontWeight: 800, whiteSpace: 'nowrap',
          }}
        >
          {fechado ? 'Caixa já fechado' : 'Fechar o caixa'}
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Anotar saída
// ═══════════════════════════════════════════════════════════════
function NovaSaida({ onVoltar, onSalvar, salvando }) {
  const [valor, setValor] = useState('')
  const [descricao, setDesc] = useState('')
  const [erro, setErro] = useState('')

  async function salvar() {
    const v = Number(String(valor).replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor válido.'); return }
    setErro('')
    const res = await onSalvar({ valor: v, descricao })
    if (res?.error) setErro(res.error.message || 'Erro ao salvar.')
  }

  const campo = {
    width: '100%', boxSizing: 'border-box', height: 56, borderRadius: 16,
    border: '1.5px solid #E4E4E8', background: '#FFFFFF', padding: '0 16px',
    fontSize: 18, fontWeight: 700, color: '#18181B', outline: 'none', fontFamily: 'inherit',
  }

  return (
    <>
      <div className="cx-faixa" style={{ background: GRAFITE, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button className="cx-voltar" onClick={onVoltar} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
          fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
        }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
          Caixa
        </button>
        <p className="cx-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Anotar saída
        </p>
      </div>

      <div className="cx-corpo" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#52525B', margin: '0 0 6px' }}>Quanto saiu</p>
          <input value={valor} onChange={e => setValor(e.target.value)} placeholder="0,00" inputMode="decimal" autoFocus style={campo} />
        </div>
        <div>
          <p style={{ fontSize: 15, fontWeight: 800, color: '#52525B', margin: '0 0 6px' }}>
            Pra quê <span style={{ fontWeight: 600, color: '#8A8A93' }}>(opcional)</span>
          </p>
          <input value={descricao} onChange={e => setDesc(e.target.value)} placeholder="Ex: troco, gás, entrega..." style={campo} />
        </div>
        {erro && <p style={{ fontSize: 15, fontWeight: 700, color: '#C4321F', margin: 0 }}>{erro}</p>}
      </div>

      <div className="cx-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button onClick={salvar} disabled={salvando} style={{
          flex: 1, height: 68, minHeight: 68, borderRadius: 18, border: 'none',
          background: GRAFITE, color: '#FFFFFF', cursor: 'pointer', fontSize: 18, fontWeight: 800,
        }}>
          {salvando ? 'Salvando...' : 'Anotar saída'}
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// T11 · Contar
// ═══════════════════════════════════════════════════════════════
function Trilha({ passo }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {['Contar', 'Conferir', 'Pronto'].map((r, i) => (
        <div key={r} style={{
          flex: 1, padding: '7px 0', borderRadius: 999, textAlign: 'center',
          background: i === passo ? '#FFFFFF' : 'rgba(255,255,255,.22)',
          color: i === passo ? GRAFITE : '#FFFFFF',
          fontSize: 14, fontWeight: 800,
        }}>{i + 1} {r}</div>
      ))}
    </div>
  )
}

function Contar({ valor, setValor, onVoltar, onAvancar }) {
  // Teclas de 56px: com 66px a última linha não cabe em 844px de altura.
  const TECLA = 56
  const teclas = ['1','2','3','4','5','6','7','8','9',',','0','del']

  function tecla(t) {
    if (t === 'del') return setValor(v => v.slice(0, -1))
    if (t === ',' && valor.includes(',')) return
    setValor(v => (v + t).slice(0, 10))
  }

  return (
    <>
      <div className="cx-faixa" style={{ background: GRAFITE, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button className="cx-voltar" onClick={onVoltar} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
          fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
        }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
          Caixa
        </button>
        <Trilha passo={0} />
        <p className="cx-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Conte o dinheiro que está na gaveta
        </p>
        <p className="cx-sub" style={{ fontSize: 16, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
          Só as notas e moedas. Pix e cartão já estão registrados.
        </p>
      </div>

      <div className="cx-corpo" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ background: '#F4F4F7', borderRadius: 20, padding: '22px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 15, color: '#71717A', margin: 0 }}>Você contou</p>
          <p style={{ fontSize: 40, fontWeight: 800, color: '#18181B', margin: '4px 0 0' }}>
            R$ {valor || '0,00'}
          </p>
        </div>

        <div className="cx-teclado" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10,
        }}>
          {teclas.map(t => (
            <button key={t} onClick={() => tecla(t)} style={{
              height: TECLA, minHeight: TECLA, borderRadius: 14, border: 'none',
              background: t === 'del' ? '#F4F4F7' : '#FFFFFF',
              boxShadow: t === 'del' ? 'none' : 'inset 0 0 0 1.5px #E4E4E8',
              cursor: 'pointer', fontSize: 22, fontWeight: 800, color: '#18181B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t === 'del' ? <Delete size={22} strokeWidth={2.2} /> : t}
            </button>
          ))}
        </div>
      </div>

      <div className="cx-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button onClick={onAvancar} disabled={!valor} style={{
          flex: 1, height: 72, minHeight: 72, borderRadius: 18, border: 'none',
          background: valor ? GRAFITE : '#E4E4E8', color: valor ? '#FFFFFF' : '#8A8A93',
          cursor: valor ? 'pointer' : 'default', fontSize: 18, fontWeight: 800,
        }}>
          Conferir
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// T12 · Conferir
// ═══════════════════════════════════════════════════════════════
function Conferir({ esperado, contado, motivo, setMotivo, onVoltar, onConfirmar, salvando }) {
  const { diferenca, bate } = conferirContagem(esperado, contado)
  const sobra = diferenca > 0

  return (
    <>
      <div className="cx-faixa" style={{ background: GRAFITE, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button className="cx-voltar" onClick={onVoltar} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
          fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
        }}>
          <ChevronLeft size={24} strokeWidth={2.5} />
          Voltar
        </button>
        <Trilha passo={1} />
        <p className="cx-titulo" style={{ fontSize: 22, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          {bate ? 'Bateu certinho' : 'Vamos conferir juntos'}
        </p>
      </div>

      <div className="cx-corpo" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ background: '#F4F4F7', borderRadius: 20, padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
            <p style={{ fontSize: 16, color: '#52525B', margin: 0 }}>Pelas vendas, deveria ter</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0 }}>{fmtR(esperado)}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <p style={{ fontSize: 16, color: '#52525B', margin: 0 }}>Você contou</p>
            <p style={{ fontSize: 16, fontWeight: 800, color: '#18181B', margin: 0 }}>{fmtR(contado)}</p>
          </div>
        </div>

        {bate ? (
          <div style={{ background: '#E8F5EE', borderRadius: 20, padding: '22px 20px', textAlign: 'center' }}>
            <Check size={34} color={VERDE} strokeWidth={2.4} />
            <p style={{ fontSize: 19, fontWeight: 800, color: '#0F5C36', margin: '8px 0 0' }}>
              O caixa fechou certinho
            </p>
          </div>
        ) : (
          <>
            <div style={{ background: '#F1EEF9', borderRadius: 20, padding: '20px' }}>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: 0 }}>
                {sobra
                  ? `Tem ${fmtR(Math.abs(diferenca))} a mais na gaveta.`
                  : `Faltam ${fmtR(Math.abs(diferenca))} pra fechar a conta.`}
              </p>
              <p style={{ fontSize: 16, color: '#52525B', margin: '6px 0 0', lineHeight: 1.5 }}>
                Acontece direto. Marcar o que foi ajuda a entender o dia depois.
              </p>
            </div>

            <div>
              <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: '0 0 10px' }}>O que aconteceu?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {MOTIVOS.map(m => {
                  const ativo = motivo === m
                  return (
                    <button key={m} onClick={() => setMotivo(m)} style={{
                      textAlign: 'left', borderRadius: 16, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1.5px solid ${ativo ? GRAFITE : '#E4E4E8'}`,
                      background: ativo ? '#F4F4F7' : '#FFFFFF',
                      padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
                    }}>
                      <span style={{
                        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                        border: `2px solid ${ativo ? GRAFITE : '#C4C4CC'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {ativo && <span style={{ width: 11, height: 11, borderRadius: '50%', background: GRAFITE }} />}
                      </span>
                      <span style={{ fontSize: 17, fontWeight: 700, color: '#18181B' }}>{m}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="cx-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button onClick={onConfirmar} disabled={salvando} style={{
          flex: 1, height: 72, minHeight: 72, borderRadius: 18, border: 'none',
          background: GRAFITE, color: '#FFFFFF', cursor: 'pointer', fontSize: 18, fontWeight: 800,
        }}>
          {salvando ? 'Salvando...' : 'Confirmar fechamento'}
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// T13 · Pronto
// ═══════════════════════════════════════════════════════════════
function Pronto({ resumo, contado, motivo, contasAmanha, nomeLoja, setTab }) {
  const { diferenca, bate } = conferirContagem(resumo.dinheiroEsperado, contado)

  const texto = encodeURIComponent(
    `Resumo do dia ${nomeLoja ? `— ${nomeLoja}` : ''}\n` +
    `Entrou: ${fmtR(resumo.entrou)}\n` +
    `Saiu: ${fmtR(resumo.saiu)}\n` +
    `Sobrou: ${fmtR(resumo.sobrou)}\n` +
    (bate ? 'Caixa conferido, bateu certinho.' : `Diferença: ${fmtR(diferenca)}${motivo ? ` (${motivo})` : ''}`)
  )

  const linha = (label, valor, cor) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderBottom: '1px solid #F1F1F4' }}>
      <p style={{ fontSize: 16, color: '#52525B', margin: 0 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: cor || '#18181B', margin: 0 }}>{valor}</p>
    </div>
  )

  return (
    <>
      <div className="cx-faixa cx-faixa-ok" style={{ background: VERDE, padding: '18px 22px 24px', flexShrink: 0 }}>
        <Trilha passo={2} />
        <div style={{ textAlign: 'center', marginTop: 8 }}>
          <Check size={40} color="#FFFFFF" strokeWidth={2.6} />
          <p className="cx-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '8px 0 0' }}>
            Caixa fechado!
          </p>
          <p className="cx-sub" style={{ fontSize: 16, color: '#FFFFFF', opacity: .9, margin: '4px 0 0' }}>
            Dia registrado. Pode descansar.
          </p>
        </div>
      </div>

      <div className="cx-corpo" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div style={{ background: '#F4F4F7', borderRadius: 20, padding: '6px 18px 12px' }}>
          {linha('Vendas do dia', fmtR(resumo.entrou))}
          {linha('Saídas', fmtR(resumo.saiu))}
          {linha('Diferença na contagem', bate ? 'nenhuma' : fmtR(diferenca), bate ? VERDE : '#C4321F')}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '13px 0 4px' }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: 0 }}>Sobrou</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#18181B', margin: 0 }}>{fmtR(resumo.sobrou)}</p>
          </div>
        </div>

        {contasAmanha.length > 0 && (
          <div style={{ background: '#F1EEF9', borderRadius: 20, padding: '18px 20px' }}>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#18181B', margin: 0 }}>Amanhã tem conta</p>
            {contasAmanha.map(c => (
              <p key={c.id} style={{ fontSize: 16, color: '#52525B', margin: '6px 0 0' }}>
                {c.descricao} — <strong style={{ color: '#18181B' }}>{fmtR(c.valor)}</strong>
              </p>
            ))}
          </div>
        )}
      </div>

      <div className="cx-rodape cx-rodape-ok" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <a
          href={`https://wa.me/?text=${texto}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            height: 68, minHeight: 68, borderRadius: 18, background: '#25D366',
            color: '#FFFFFF', textDecoration: 'none', fontSize: 18, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <MessageCircle size={21} strokeWidth={2.3} />
          Mandar resumo do dia
        </a>
        <button onClick={() => setTab('inicio')} style={{
          height: 62, minHeight: 62, borderRadius: 18, border: 'none',
          background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer', fontSize: 17, fontWeight: 800,
        }}>
          Voltar ao menu
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function Caixa({
  vendas = [], saidas = [], caixas = [], contas = [], config = {},
  setTab, addSaida, fecharCaixa,
}) {
  const hoje = diaISO()
  const [view, setView]         = useState('painel') // painel | saida | contar | conferir | pronto
  const [contado, setContado]   = useState('')
  const [motivo, setMotivo]     = useState('')
  const [salvando, setSalvando] = useState(false)

  const resumo   = useMemo(() => resumoCaixa(vendas, saidas, hoje), [vendas, saidas, hoje])
  const fechado  = useMemo(() => jaFechado(caixas, hoje), [caixas, hoje])
  const doDiaContas = useMemo(() => (contas || []).filter(c => c?.status !== 'pago'), [contas])
  const amanha   = useMemo(() => contasDeAmanha(contas), [contas])

  const contadoNum = contado ? Number(contado.replace(',', '.')) : ''

  async function salvarSaida(dados) {
    setSalvando(true)
    const res = await addSaida(dados)
    setSalvando(false)
    if (!res?.error) setView('painel')
    return res || {}
  }

  async function confirmarFechamento() {
    setSalvando(true)
    const { diferenca } = conferirContagem(resumo.dinheiroEsperado, contadoNum)
    await fecharCaixa({
      data:             hoje,
      dinheiro:         resumo.entradas.Dinheiro,
      pix:              resumo.entradas.Pix,
      // O PDV do Mercado tem uma forma "Cartão" só, sem separar débito de
      // crédito; vai tudo em credito e debito fica zerado.
      credito:          resumo.entradas['Cartão'],
      debito:           0,
      despesas:         resumo.saiu,
      total:            resumo.entrou,
      valor_contado:    contadoNum === '' ? null : contadoNum,
      diferenca:        diferenca,
      motivo_diferenca: diferenca && Math.abs(diferenca) >= 0.01 ? (motivo || null) : null,
    })
    setSalvando(false)
    setView('pronto')
  }

  return (
    <div className="cx-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first: o estilo inline é o mobile (T10–T13). A partir de 1024px
        vale o princípio do D1 — fundo branco, cor só em elementos-chave,
        conteúdo centralizado e blocos que não esticam.
      */}
      <style>{`
        .cx-root  { height: 100dvh; }
        .cx-shell { display: contents; }

        @container (min-width: 1024px) {
          .cx-root { height: auto; min-height: 100dvh; }
          .cx-shell {
            display: flex; flex-direction: column; flex: 1; min-height: 0;
            width: 100%; max-width: 1160px; margin: 0 auto;
            padding: 30px 40px 34px; box-sizing: border-box;
          }
          .cx-faixa { background: #FFFFFF !important; padding: 0 0 22px !important; }
          .cx-voltar     { color: #71717A !important; }
          .cx-voltar svg { stroke: #71717A !important; }
          .cx-titulo     { font-size: 34px !important; color: #18181B !important; }
          .cx-sub        { color: #71717A !important; opacity: 1 !important; }

          /* Cards do topo em fundo claro: o translúcido sobre branco sumiria */
          .cx-cards      { max-width: 620px; }
          .cx-cards > div { background: #F4F4F7 !important; }
          .cx-cards > div p:first-child { color: #71717A !important; }
          .cx-cards > div:nth-child(1) p:last-child { color: #17864F !important; }
          .cx-cards > div:nth-child(2) p:last-child { color: #C4321F !important; }
          .cx-cards > div:nth-child(3) { background: #18181B !important; }
          .cx-cards > div:nth-child(3) p:first-child { color: rgba(255,255,255,.75) !important; }
          .cx-cards > div:nth-child(3) p:last-child  { color: #FFFFFF !important; }

          /* Passo 3 mantém o verde de sucesso como elemento-chave */
          .cx-faixa-ok { background: #E8F5EE !important; border-radius: 20px; padding: 22px !important; }
          .cx-faixa-ok .cx-titulo { color: #0F5C36 !important; }
          .cx-faixa-ok .cx-sub    { color: #0F5C36 !important; }
          .cx-faixa-ok svg        { stroke: #17864F !important; }

          .cx-corpo   { padding: 0 !important; overflow: visible !important; max-width: 720px; }
          .cx-origens { max-width: 620px; }
          .cx-teclado { max-width: 340px; }
          .cx-rodape {
            padding: 24px 0 0 !important; justify-content: flex-end;
            border-top: none !important; max-width: 720px;
          }
          .cx-rodape button, .cx-rodape a { flex: 0 0 auto !important; min-width: 240px; }
          .cx-rodape-ok { flex-direction: row !important; align-items: center; }
        }
      `}</style>

      <div className="cx-shell">
        {view === 'painel' && (
          <Painel
            resumo={resumo} contas={doDiaContas} fechado={fechado} setTab={setTab}
            onSaida={() => setView('saida')}
            onFechar={() => { setContado(''); setMotivo(''); setView('contar') }}
          />
        )}
        {view === 'saida' && (
          <NovaSaida onVoltar={() => setView('painel')} onSalvar={salvarSaida} salvando={salvando} />
        )}
        {view === 'contar' && (
          <Contar valor={contado} setValor={setContado}
            onVoltar={() => setView('painel')} onAvancar={() => setView('conferir')} />
        )}
        {view === 'conferir' && (
          <Conferir
            esperado={resumo.dinheiroEsperado} contado={contadoNum}
            motivo={motivo} setMotivo={setMotivo} salvando={salvando}
            onVoltar={() => setView('contar')} onConfirmar={confirmarFechamento} />
        )}
        {view === 'pronto' && (
          <Pronto resumo={resumo} contado={contadoNum} motivo={motivo}
            contasAmanha={amanha} nomeLoja={config?.nome} setTab={setTab} />
        )}
      </div>
    </div>
  )
}
