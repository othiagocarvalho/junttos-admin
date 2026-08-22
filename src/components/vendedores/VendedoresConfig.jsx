// CRUD de vendedores, dentro de Configurações.
//
// Fica aqui porque Configurações é onde a loja já regula o que alimenta os
// Relatórios (é para lá que o próprio relatório manda quem precisa ajustar o
// percentual de comissão), e porque LojaConfig.jsx é montado por mobile,
// desktop e LojaMercado — um componente só cobre os três.
//
// Sem exclusão física, de propósito: venda já lançada guarda o nome como
// texto e o relatório de comissão ainda agrupa por ele. Apagar o cadastro não
// apagaria o histórico e só tiraria a pessoa do select — que é exatamente o
// que "desativar" faz, sem sugerir que o passado sumiu.

import { useState } from 'react'
import { Users, Plus } from 'lucide-react'
import Card from '../studio/Card'
import Input, { Label } from '../studio/Input'
import Button from '../studio/Button'
import Toggle from '../studio/Toggle'
import { useVendedores } from './useVendedores'
import { validarNovoVendedor } from '../../utils/vendedores'
import { validarPercentual, normalizarPercentual } from '../../utils/comissao'

/** Percentual editável de uma linha da lista. */
function ComissaoInput({ valor, aoSalvar }) {
  const [texto, setTexto] = useState(String(valor ?? 0))
  const [erro, setErro] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
      <input
        value={texto}
        onChange={e => { setTexto(e.target.value); setErro(!!validarPercentual(e.target.value)) }}
        onBlur={e => {
          // Lê do DOM, não do estado: se o blur chegar antes de o React
          // reprocessar a última tecla, `texto` ainda seria o valor anterior e
          // a alteração se perderia em silêncio.
          const bruto = e.target.value
          if (validarPercentual(bruto)) { setTexto(String(valor ?? 0)); setErro(false); return }
          const limpo = normalizarPercentual(bruto)
          setTexto(String(limpo))
          setErro(false)
          if (limpo !== Number(valor ?? 0)) aoSalvar(limpo)
        }}
        type="number" min="0" max="100" step="0.5" inputMode="decimal"
        aria-label="Percentual de comissão"
        style={{
          width: 62, height: 34, textAlign: 'right', boxSizing: 'border-box',
          border: `1px solid ${erro ? 'var(--status-bad-dot, #fca5a5)' : 'var(--line)'}`,
          borderRadius: 8, padding: '0 7px', background: 'var(--surface)',
          fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 13, color: 'var(--ink)',
        }}
      />
      <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'var(--muted)' }}>%</span>
    </div>
  )
}

export default function VendedoresConfig({ lojaId, theme }) {
  const { vendedores, carregando, erro, adicionar, definirAtivo, definirComissao } = useVendedores(lojaId)
  const [novo, setNovo] = useState('')
  const [novaComissao, setNovaComissao] = useState('')
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)

  async function handleAdicionar() {
    const problema = validarNovoVendedor(novo, vendedores.map(v => v.nome))
      || validarPercentual(novaComissao)
    if (problema) { setMsg({ tipo: 'erro', texto: problema }); return }
    setSalvando(true)
    const e = await adicionar(novo, novaComissao)
    setSalvando(false)
    if (e) {
      // 23505 = o índice único (loja_id, lower(btrim(nome))) da migration.
      setMsg({
        tipo: 'erro',
        texto: e.code === '23505'
          ? 'Já existe um vendedor com esse nome nesta loja.'
          : 'Não foi possível salvar: ' + e.message,
      })
      return
    }
    setNovo('')
    setNovaComissao('')
    setMsg({ tipo: 'ok', texto: 'Vendedor adicionado.' })
    setTimeout(() => setMsg(null), 2600)
  }

  const ativos = vendedores.filter(v => v.ativo)
  const inativos = vendedores.filter(v => !v.ativo)

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
        <Users size={16} color={theme?.primary} />
        <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
          Vendedores
        </p>
      </div>
      <p style={{ margin: '0 0 16px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
        Quem aparece na lista da Nova Venda. Com o nome escolhido em vez de digitado,
        a comissão nos Relatórios para de se dividir em linhas por causa de espaço
        ou letra maiúscula. Cada um tem o seu percentual — quem fica em 0% aparece
        no relatório com o faturamento, mas sem valor a receber.
      </p>

      {erro ? (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: '#b45309', background: 'rgba(202,138,4,0.08)', border: '1px solid rgba(202,138,4,0.2)', borderRadius: 10, padding: '9px 12px', lineHeight: 1.45 }}>
          Cadastro indisponível no momento. A Nova Venda continua funcionando com o
          campo de texto.
        </p>
      ) : (
        <>
          <Label>Adicionar vendedor</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 160px', minWidth: 140 }}>
              <Input
                value={novo}
                onChange={e => { setNovo(e.target.value); setMsg(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                placeholder="Nome do vendedor"
              />
            </div>
            <div style={{ flex: '0 0 104px' }}>
              <Input
                value={novaComissao}
                onChange={e => { setNovaComissao(e.target.value); setMsg(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                placeholder="% comissão"
                type="number" min="0" max="100" step="0.5" inputMode="decimal"
              />
            </div>
            <Button onClick={handleAdicionar} disabled={salvando || !novo.trim()}>
              <Plus size={14} /> {salvando ? 'Salvando...' : 'Adicionar'}
            </Button>
          </div>

          {msg && (
            <p style={{
              margin: '8px 0 0', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5,
              color: msg.tipo === 'ok' ? 'var(--status-ok-tx, #15803d)' : 'var(--status-bad-tx, #b91c1c)',
            }}>{msg.texto}</p>
          )}

          <div style={{ marginTop: 18 }}>
            {carregando ? (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'var(--muted)' }}>Carregando...</p>
            ) : vendedores.length === 0 ? (
              <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: 'var(--muted)', lineHeight: 1.5 }}>
                Nenhum vendedor cadastrado ainda. Enquanto a lista estiver vazia, a
                Nova Venda mostra apenas "Sem vendedor".
              </p>
            ) : (
              <>
                {[['Ativos', ativos], ['Inativos', inativos]].map(([titulo, lista]) => lista.length > 0 && (
                  <div key={titulo} style={{ marginBottom: 14 }}>
                    <p style={{ margin: '0 0 8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                      {titulo} ({lista.length})
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {lista.map(v => (
                        <div key={v.id} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                          border: '1px solid var(--line)', borderRadius: 10, background: 'var(--bg)',
                        }}>
                          <span style={{
                            flex: 1, minWidth: 0, fontFamily: 'Plus Jakarta Sans, sans-serif',
                            fontSize: 13.5, color: v.ativo ? 'var(--ink)' : 'var(--muted)',
                            textDecoration: v.ativo ? 'none' : 'line-through',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{v.nome}</span>
                          {/* Grava no blur, não a cada tecla: digitar "10" passaria
                              por "1" e mandaria um UPDATE intermediário. */}
                          <ComissaoInput
                            valor={v.comissao_percentual}
                            aoSalvar={pct => definirComissao(v.id, pct)}
                          />
                          <Toggle on={v.ativo} onClick={() => definirAtivo(v.id, !v.ativo)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {inativos.length > 0 && (
                  <p style={{ margin: 0, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.45 }}>
                    Inativo some da Nova Venda, mas as vendas já lançadas com o nome dele
                    continuam intactas no histórico e na comissão.
                  </p>
                )}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
