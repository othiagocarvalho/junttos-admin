import { useMemo, useState } from 'react'
import { ChevronLeft, Plus, Check, Search, MessageCircle } from 'lucide-react'
import { agruparPorCliente, totaisFiado, descricaoLancamento, PRAZO_PADRAO_DIAS } from '../../utils/fiado'
import { iniciais, fmtDiaMes, fmtDataExtenso } from '../../utils/datas'
import { normalizeWaPhone } from '../../utils/crm'

const ROXO      = '#5E2BD0'
const VERMELHO  = '#C4321F'
const VERDE     = '#17864F'

const fmtR = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',')

// ═══════════════════════════════════════════════════════════════
// T8 · Lista
// ═══════════════════════════════════════════════════════════════
function ItemConta({ conta, onAbrir }) {
  const atrasado = conta.atrasado
  return (
    <div
      className="fia-item"
      onClick={() => onAbrir(conta)}
      style={{
        background: '#FFFFFF', border: `1.5px solid ${atrasado ? '#F4C7BE' : '#E4E4E8'}`,
        borderRadius: 18, padding: '12px 14px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 14,
      }}
    >
      <div style={{
        width: 52, height: 52, borderRadius: '50%', flexShrink: 0,
        background: atrasado ? '#FFEBE7' : '#F1EEF9',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: atrasado ? VERMELHO : ROXO }}>
          {iniciais(conta.cliente_nome)}
        </span>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 18, fontWeight: 800, color: '#18181B', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{conta.cliente_nome}</p>
        {atrasado ? (
          <p style={{ fontSize: 15, fontWeight: 800, color: VERMELHO, margin: '3px 0 0' }}>
            {conta.diasAtraso} dia{conta.diasAtraso === 1 ? '' : 's'} de atraso
          </p>
        ) : conta.devendo ? (
          <p style={{ fontSize: 15, fontWeight: 700, color: '#71717A', margin: '3px 0 0' }}>
            Paga dia {fmtDiaMes(conta.vencimento)}
          </p>
        ) : (
          <p style={{ fontSize: 15, fontWeight: 700, color: '#71717A', margin: '3px 0 0' }}>
            Em dia
          </p>
        )}
      </div>

      <p style={{ fontSize: 21, fontWeight: 800, color: atrasado ? VERMELHO : '#18181B', margin: 0, flexShrink: 0 }}>
        {fmtR(conta.saldo)}
      </p>
    </div>
  )
}

function Lista({ contas, totais, onAbrir, onNovo, setTab }) {
  const [filtro, setFiltro] = useState('devendo')

  const devendo = contas.filter(c => c.devendo)
  const emDia   = contas.filter(c => !c.devendo)
  const visiveis = filtro === 'devendo' ? devendo : emDia

  const pill = ativa => ({
    padding: '9px 18px', borderRadius: 999, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 15, fontWeight: 800,
    background: ativa ? ROXO : '#F4F4F7', color: ativa ? '#FFFFFF' : '#3F3F46',
  })

  return (
    <>
      <div className="fia-faixa" style={{ background: ROXO, padding: '14px 22px 22px', flexShrink: 0 }}>
        <button
          className="fia-voltar"
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

        <p className="fia-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: '0 0 16px' }}>
          Fiado
        </p>

        <div className="fia-metricas" style={{ display: 'flex', gap: 26 }}>
          <div>
            <p className="fia-met-label" style={{ fontSize: 15, color: '#FFFFFF', opacity: .9, margin: 0 }}>Tem a receber</p>
            <p className="fia-met-valor" style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', margin: '2px 0 0' }}>
              {fmtR(totais.aReceber)}
            </p>
          </div>
          <div>
            <p className="fia-met-label" style={{ fontSize: 15, color: '#FFFFFF', opacity: .9, margin: 0 }}>Atrasado</p>
            <p className="fia-met-valor fia-met-atrasado" style={{ fontSize: 32, fontWeight: 800, color: '#FFC9BC', margin: '2px 0 0' }}>
              {fmtR(totais.atrasado)}
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="fia-filtros" style={{ display: 'flex', gap: 10, padding: '16px 22px 0', flexShrink: 0 }}>
        <button style={pill(filtro === 'devendo')} onClick={() => setFiltro('devendo')}>
          Devendo ({devendo.length})
        </button>
        <button style={pill(filtro === 'emdia')} onClick={() => setFiltro('emdia')}>
          Em dia ({emDia.length})
        </button>
      </div>

      {/* Lista */}
      <div className="fia-lista" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '14px 22px',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {visiveis.map(c => <ItemConta key={c.chave} conta={c} onAbrir={onAbrir} />)}

        {visiveis.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 20px', color: '#8A8A93' }}>
            <p style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
              {filtro === 'devendo' ? 'Ninguém devendo por aqui' : 'Ninguém com conta quitada ainda'}
            </p>
            <p style={{ fontSize: 15, margin: '4px 0 0' }}>
              {filtro === 'devendo' ? 'Tudo em dia por enquanto.' : 'As contas quitadas aparecem aqui.'}
            </p>
          </div>
        )}
      </div>

      <div className="fia-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button
          onClick={onNovo}
          style={{
            flex: 1, height: 72, minHeight: 72, borderRadius: 18, border: 'none',
            background: ROXO, color: '#FFFFFF', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Plus size={22} strokeWidth={2.6} />
          Anotar novo fiado
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// T9 · Conta do cliente
// ═══════════════════════════════════════════════════════════════
function LinhaExtrato({ lancamento }) {
  const pagamento = lancamento.tipo === 'pagamento'
  return (
    <div className="fia-lanc" style={{
      background: pagamento ? '#E8F5EE' : '#F4F4F7', borderRadius: 16,
      padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 12, background: '#FFFFFF', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, fontWeight: 800, color: pagamento ? VERDE : VERMELHO, lineHeight: 1,
      }}>
        {pagamento ? '−' : '+'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 16, fontWeight: 800, color: pagamento ? '#0F5C36' : '#18181B', margin: 0,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{descricaoLancamento(lancamento)}</p>
        <p style={{ fontSize: 14, fontWeight: 600, color: pagamento ? '#0F5C36' : '#71717A', margin: '2px 0 0', opacity: .85 }}>
          {fmtDataExtenso(lancamento.data, lancamento.created_at)}
        </p>
      </div>

      <p style={{ fontSize: 17, fontWeight: 800, margin: 0, flexShrink: 0, color: pagamento ? '#0F5C36' : '#18181B' }}>
        {pagamento ? '−' : '+'}{fmtR(lancamento.valor)}
      </p>
    </div>
  )
}

function Conta({ conta, telefone, nomeLoja, onVoltar, onPagar, salvando }) {
  const [confirmando, setConfirmando] = useState(false)
  const wa = normalizeWaPhone(telefone)

  const mensagem = encodeURIComponent(
    `Oi, ${conta.cliente_nome}! Passando para lembrar do fiado aqui ${nomeLoja ? `d${/^[aeiou]/i.test(nomeLoja) ? '' : 'o '}${nomeLoja}` : 'da loja'}: ` +
    `está ${fmtR(conta.saldo)}${conta.atrasado ? `, com ${conta.diasAtraso} dia${conta.diasAtraso === 1 ? '' : 's'} de atraso` : ''}. ` +
    `Quando puder dar um jeitinho, agradeço!`
  )

  return (
    <>
      {/* Faixa alta */}
      <div className="fia-faixa fia-faixa-conta" style={{ background: ROXO, padding: '14px 22px 22px', flexShrink: 0 }}>
        <button
          className="fia-voltar"
          onClick={onVoltar}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', marginBottom: 18, padding: 0, color: '#FFFFFF',
            fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          Voltar
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <div style={{
            width: 62, height: 62, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(255,255,255,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 23, fontWeight: 800, color: '#FFFFFF' }}>
              {iniciais(conta.cliente_nome)}
            </span>
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="fia-conta-nome" style={{
              fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{conta.cliente_nome}</p>
            {telefone && (
              <p style={{ fontSize: 16, color: '#FFFFFF', opacity: .85, margin: '2px 0 0' }}>{telefone}</p>
            )}
          </div>
        </div>

        {/* Cartão do saldo */}
        <div style={{
          background: 'rgba(255,255,255,.16)', borderRadius: 18, padding: '16px 18px',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, color: '#FFFFFF', opacity: .9, margin: 0 }}>Está devendo</p>
            <p style={{ fontSize: 34, fontWeight: 800, color: '#FFFFFF', margin: '2px 0 0' }}>{fmtR(conta.saldo)}</p>
          </div>
          {conta.atrasado && (
            <span style={{
              background: '#FFEBE7', color: VERMELHO, borderRadius: 999,
              padding: '7px 16px', fontSize: 15, fontWeight: 800, flexShrink: 0,
            }}>
              {conta.diasAtraso} dia{conta.diasAtraso === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>

      {/* Extrato */}
      <div className="fia-extrato" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '18px 22px',
      }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: '#18181B', margin: '0 0 12px' }}>
          O que ela levou e pagou
        </p>
        <div className="fia-lancs" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[...conta.lancamentos].reverse().map(l => <LinhaExtrato key={l.id} lancamento={l} />)}
        </div>
      </div>

      {/* Rodapé — duas linhas */}
      <div className="fia-rodape fia-rodape-conta" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))',
        display: 'flex', flexDirection: 'column', gap: 10,
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        {!confirmando ? (
          <button
            onClick={() => setConfirmando(true)}
            disabled={!conta.devendo}
            style={{
              height: 70, minHeight: 70, borderRadius: 18, border: 'none',
              background: conta.devendo ? VERDE : '#E4E4E8',
              color: conta.devendo ? '#FFFFFF' : '#8A8A93',
              cursor: conta.devendo ? 'pointer' : 'default',
              fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
            }}
          >
            Ela está pagando agora
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => setConfirmando(false)}
              style={{
                flex: 1, height: 70, minHeight: 70, borderRadius: 18, border: 'none',
                background: '#F4F4F7', color: '#3F3F46', cursor: 'pointer', fontSize: 17, fontWeight: 800,
              }}
            >
              Cancelar
            </button>
            <button
              onClick={onPagar}
              disabled={salvando}
              style={{
                flex: 2, height: 70, minHeight: 70, borderRadius: 18, border: 'none',
                background: VERDE, color: '#FFFFFF', cursor: 'pointer', fontSize: 17, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <Check size={20} strokeWidth={2.6} />
              {salvando ? 'Salvando...' : `Quitar ${fmtR(conta.saldo)}`}
            </button>
          </div>
        )}

        {wa ? (
          <a
            href={`https://wa.me/${wa}?text=${mensagem}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              height: 62, minHeight: 62, borderRadius: 18, background: '#F4F4F7',
              color: '#3F3F46', textDecoration: 'none', fontSize: 17, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <MessageCircle size={20} strokeWidth={2.2} />
            Mandar lembrete no WhatsApp
          </a>
        ) : (
          <button
            disabled
            title="Cliente sem telefone cadastrado em lf_clientes"
            style={{
              height: 62, minHeight: 62, borderRadius: 18, border: 'none', background: '#F4F4F7',
              color: '#A1A1AA', cursor: 'default', fontSize: 17, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <MessageCircle size={20} strokeWidth={2.2} />
            Sem telefone cadastrado
          </button>
        )}
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Anotar novo fiado
// ═══════════════════════════════════════════════════════════════
function NovoFiado({ clientes, onVoltar, onSalvar, salvando }) {
  const [nome, setNome]           = useState('')
  const [clienteId, setClienteId] = useState(null)
  const [valor, setValor]         = useState('')
  const [descricao, setDescricao] = useState('')
  const [erro, setErro]           = useState('')

  // Busca em lf_clientes; o nome digitado também vale sozinho (nome livre).
  const sugestoes = useMemo(() => {
    const q = nome.trim().toLowerCase()
    if (!q || clienteId) return []
    return (clientes || [])
      .filter(c => (c.nome || '').toLowerCase().includes(q))
      .slice(0, 5)
  }, [clientes, nome, clienteId])

  async function salvar() {
    const v = Number(String(valor).replace(',', '.'))
    if (!nome.trim())              { setErro('Informe o nome do cliente.'); return }
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor válido.'); return }
    setErro('')
    const { error } = await onSalvar({
      cliente_nome: nome.trim(),
      cliente_id:   clienteId,
      valor:        v,
      descricao:    descricao,
    })
    if (error) setErro(error.message || 'Erro ao salvar.')
  }

  const campo = {
    width: '100%', boxSizing: 'border-box', height: 56, borderRadius: 16,
    border: '1.5px solid #E4E4E8', background: '#FFFFFF', padding: '0 16px',
    fontSize: 18, fontWeight: 700, color: '#18181B', outline: 'none', fontFamily: 'inherit',
  }
  const rotulo = { fontSize: 15, fontWeight: 800, color: '#52525B', margin: '0 0 6px' }

  return (
    <>
      <div className="fia-faixa" style={{ background: ROXO, padding: '14px 22px 20px', flexShrink: 0 }}>
        <button
          className="fia-voltar"
          onClick={onVoltar}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
            cursor: 'pointer', marginBottom: 14, padding: 0, color: '#FFFFFF',
            fontSize: 17, fontWeight: 800, fontFamily: 'inherit',
          }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} />
          Voltar
        </button>
        <p className="fia-titulo" style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', margin: 0 }}>
          Anotar novo fiado
        </p>
      </div>

      <div className="fia-form" style={{
        flex: 1, minHeight: 0, overflowY: 'auto', padding: '20px 22px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        <div>
          <p style={rotulo}>Quem levou</p>
          <div style={{ position: 'relative' }}>
            <Search size={19} color="#8A8A93" strokeWidth={2.2}
              style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              value={nome}
              onChange={e => { setNome(e.target.value); setClienteId(null) }}
              placeholder="Nome do cliente"
              autoFocus
              style={{ ...campo, paddingLeft: 44 }}
            />
          </div>
          {clienteId && (
            <p style={{ fontSize: 14, fontWeight: 700, color: VERDE, margin: '6px 0 0' }}>
              Vinculado ao cadastro do cliente
            </p>
          )}
          {sugestoes.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {sugestoes.map(c => (
                <button
                  key={c.id}
                  onClick={() => { setNome(c.nome); setClienteId(c.id) }}
                  style={{
                    textAlign: 'left', border: '1.5px solid #E4E4E8', background: '#FFFFFF',
                    borderRadius: 14, padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#18181B' }}>{c.nome}</span>
                  {c.telefone && <span style={{ fontSize: 14, color: '#71717A', marginLeft: 8 }}>{c.telefone}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <p style={rotulo}>Valor</p>
          <input
            value={valor}
            onChange={e => setValor(e.target.value)}
            placeholder="0,00"
            inputMode="decimal"
            style={campo}
          />
        </div>

        <div>
          <p style={rotulo}>O que levou <span style={{ fontWeight: 600, color: '#8A8A93' }}>(opcional)</span></p>
          <input
            value={descricao}
            onChange={e => setDescricao(e.target.value)}
            placeholder="Ex: 3 itens, pão e leite..."
            style={campo}
          />
        </div>

        {erro && <p style={{ fontSize: 15, fontWeight: 700, color: VERMELHO, margin: 0 }}>{erro}</p>}
      </div>

      <div className="fia-rodape" style={{
        padding: '14px 22px calc(20px + env(safe-area-inset-bottom))', display: 'flex',
        flexShrink: 0, borderTop: '1px solid #F1F1F4', background: '#FFFFFF',
      }}>
        <button
          onClick={salvar}
          disabled={salvando}
          style={{
            flex: 1, height: 72, minHeight: 72, borderRadius: 18, border: 'none',
            background: ROXO, color: '#FFFFFF', cursor: 'pointer',
            fontSize: 18, fontWeight: 800, whiteSpace: 'nowrap',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          <Check size={22} strokeWidth={2.6} />
          {salvando ? 'Salvando...' : 'Anotar fiado'}
        </button>
      </div>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
export default function Fiado({ fiado = [], clientes = [], config = {}, setTab, addFiadoCompra, addFiadoPagamento }) {
  const [view, setView]         = useState('lista')  // 'lista' | 'conta' | 'novo'
  const [chaveAberta, setChave] = useState(null)
  const [salvando, setSalvando] = useState(false)

  const contas = useMemo(() => agruparPorCliente(fiado), [fiado])
  const totais = useMemo(() => totaisFiado(contas), [contas])
  const conta  = contas.find(c => c.chave === chaveAberta) || null

  // Telefone vem de lf_clientes quando o lançamento está vinculado
  const telefone = useMemo(() => {
    if (!conta?.cliente_id) return null
    return (clientes || []).find(c => c.id === conta.cliente_id)?.telefone || null
  }, [conta, clientes])

  async function salvarCompra(dados) {
    setSalvando(true)
    const res = await addFiadoCompra(dados)
    setSalvando(false)
    if (!res?.error) setView('lista')
    return res || {}
  }

  async function quitar() {
    if (!conta) return
    setSalvando(true)
    await addFiadoPagamento({
      cliente_nome: conta.cliente_nome,
      cliente_id:   conta.cliente_id,
      valor:        conta.saldo,
      descricao:    'Quitou a conta',
    })
    setSalvando(false)
    setView('lista')
  }

  return (
    <div className="fia-root" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: '#FFFFFF' }}>
      {/*
        Mobile-first: o estilo inline é o mobile (T8/T9) — faixa roxa cheia,
        listas em coluna única. A partir de 1024px vale o princípio do D1:
        fundo branco, cor só em elementos-chave, conteúdo centralizado e
        blocos que não esticam. O !important é necessário porque estilo inline
        vence folha de estilo — mesmo padrão de components/Layout.jsx.
      */}
      <style>{`
        /* --- Base (mobile) --- */
        .fia-root  { height: 100dvh; }
        .fia-shell { display: contents; }

        /* --- Desktop --- */
        @container (min-width: 1024px) {
          .fia-root { height: auto; min-height: 100dvh; }

          .fia-shell {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            width: 100%;
            max-width: 1160px;
            margin: 0 auto;
            padding: 30px 40px 34px;
            box-sizing: border-box;
          }

          /* A faixa roxa vira cabeçalho neutro; o roxo fica nas ações e nos dados */
          .fia-faixa {
            background: #FFFFFF !important;
            padding: 0 0 22px !important;
          }
          .fia-voltar     { color: #71717A !important; }
          .fia-voltar svg { stroke: #71717A !important; }
          .fia-titulo     { font-size: 34px !important; color: #18181B !important; }
          .fia-met-label  { color: #71717A !important; opacity: 1 !important; }
          .fia-met-valor  { color: #18181B !important; }
          /* #FFC9BC só funciona sobre o roxo do mobile; no fundo claro do
             desktop sumiria. O vermelho mantém a distinção do valor atrasado,
             que é justamente um dos elementos-chave que devem ter cor. */
          .fia-met-atrasado { color: #C4321F !important; }
          .fia-metricas {
            gap: 26px !important;
            background: #F4F4F7;
            border-radius: 18px;
            padding: 16px 26px;
            display: inline-flex !important;
          }

          /* Conta: cabeçalho neutro, cartão de saldo com fundo próprio */
          .fia-faixa-conta .fia-conta-nome { color: #18181B !important; }
          .fia-faixa-conta > div:nth-of-type(1) > div:first-child { background: #F1EEF9 !important; }
          .fia-faixa-conta > div:nth-of-type(1) > div:first-child span { color: #5E2BD0 !important; }
          .fia-faixa-conta > div:nth-of-type(1) p:not(.fia-conta-nome) { color: #71717A !important; opacity: 1 !important; }
          .fia-faixa-conta > div:last-child { background: #F1EEF9 !important; max-width: 460px; }
          .fia-faixa-conta > div:last-child p { color: #18181B !important; opacity: 1 !important; }

          .fia-filtros { padding: 0 0 16px !important; }

          /* Listas em 2 colunas, itens com altura própria */
          .fia-lista, .fia-extrato { padding: 0 !important; overflow: visible !important; }
          .fia-lista, .fia-lancs {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr);
            gap: 12px;
            align-content: start;
          }

          /* Formulário não estica na largura toda */
          .fia-form { padding: 0 !important; overflow: visible !important; max-width: 520px; }

          /* Rodapés compactos à direita */
          .fia-rodape {
            padding: 24px 0 0 !important;
            justify-content: flex-end;
            border-top: none !important;
          }
          .fia-rodape button, .fia-rodape a { flex: 0 0 auto !important; min-width: 260px; }
          .fia-rodape-conta {
            flex-direction: row !important;
            align-items: center;
          }
        }
      `}</style>

      <div className="fia-shell">
        {view === 'lista' && (
          <Lista
            contas={contas}
            totais={totais}
            setTab={setTab}
            onAbrir={c => { setChave(c.chave); setView('conta') }}
            onNovo={() => setView('novo')}
          />
        )}

        {view === 'conta' && conta && (
          <Conta
            conta={conta}
            telefone={telefone}
            nomeLoja={config?.nome}
            salvando={salvando}
            onVoltar={() => setView('lista')}
            onPagar={quitar}
          />
        )}

        {view === 'novo' && (
          <NovoFiado
            clientes={clientes}
            salvando={salvando}
            onVoltar={() => setView('lista')}
            onSalvar={salvarCompra}
          />
        )}
      </div>
    </div>
  )
}

export { PRAZO_PADRAO_DIAS }
