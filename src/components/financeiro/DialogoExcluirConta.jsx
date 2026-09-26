// Confirmação de exclusão de conta a pagar/receber — um componente só para
// Financeiro.jsx (mobile) e FinanceiroDesktop.jsx. A regra do que cada opção
// faz mora em utils/acoesConta.js; aqui é só a escolha + confirmação.
//
// Conta avulsa: confirmação simples. Conta recorrente: as 3 opções de
// OPCOES_RECORRENTE, nenhuma pré-selecionada — excluir exige escolher.

import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'
import { OPCOES_RECORRENTE, ehRecorrente } from '../../utils/acoesConta'
import { fmtR } from '../../utils/formatters'

const FONT = 'Plus Jakarta Sans, sans-serif'
const fmtDate = s => s ? new Date(s + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

export default function DialogoExcluirConta({ conta, processando = false, erro = '', onCancelar, onConfirmar }) {
  const recorrente = ehRecorrente(conta)
  const [opcao, setOpcao] = useState(null)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape' && !processando) onCancelar() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancelar, processando])

  const podeConfirmar = !processando && (!recorrente || !!opcao)

  return (
    <div onClick={() => !processando && onCancelar()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div role="dialog" aria-modal="true" aria-label="Excluir conta" onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 20, padding: '24px 22px', width: '100%', maxWidth: 440, maxHeight: '90dvh', overflowY: 'auto', boxSizing: 'border-box', boxShadow: '0 24px 60px rgba(0,0,0,0.2)', fontFamily: FONT }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)', margin: 0 }}>Excluir conta?</p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: '4px 0 0', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--ink)' }}>{conta.descricao}</strong> · {fmtR(conta.valor)} · vence {fmtDate(conta.data_vencimento)}
            </p>
          </div>
          <button type="button" onClick={onCancelar} disabled={processando} aria-label="Fechar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, flexShrink: 0 }}><X size={18} /></button>
        </div>

        {recorrente ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: 'var(--ink)', margin: '0 0 2px', fontWeight: 600 }}>Esta conta é recorrente. O que você quer excluir?</p>
            {OPCOES_RECORRENTE.map(o => {
              const ativo = opcao === o.id
              return (
                <button key={o.id} type="button" onClick={() => setOpcao(o.id)} disabled={processando} style={{
                  textAlign: 'left', borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                  border: `1.5px solid ${ativo ? 'var(--negative)' : 'var(--line)'}`,
                  background: ativo ? 'color-mix(in srgb, var(--negative) 7%, var(--surface))' : 'var(--surface)',
                  padding: '11px 13px', display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: `2px solid ${ativo ? 'var(--negative)' : 'var(--line)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {ativo && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--negative)' }} />}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)' }}>{o.titulo}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2, lineHeight: 1.45 }}>{o.descricao}</span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0, lineHeight: 1.5 }}>
            A conta será apagada de vez. Esta ação não pode ser desfeita.
          </p>
        )}

        {erro && <p style={{ fontSize: 12.5, color: 'var(--negative)', margin: '12px 0 0', fontWeight: 600 }}>{erro}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button type="button" onClick={onCancelar} disabled={processando} style={{ flex: 1, height: 44, borderRadius: 'var(--r-input)', border: '1px solid var(--line)', background: 'var(--surface)', cursor: 'pointer', fontFamily: FONT, fontWeight: 600, color: 'var(--muted)', fontSize: 14 }}>Cancelar</button>
          <button type="button" onClick={() => onConfirmar(opcao)} disabled={!podeConfirmar} style={{ flex: 2, height: 44, borderRadius: 'var(--r-input)', border: 'none', background: podeConfirmar ? 'var(--negative)' : 'var(--line)', cursor: podeConfirmar ? 'pointer' : 'not-allowed', fontFamily: FONT, fontWeight: 700, color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Trash2 size={14} /> {processando ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
