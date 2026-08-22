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

export default function VendedoresConfig({ lojaId, theme }) {
  const { vendedores, carregando, erro, adicionar, definirAtivo } = useVendedores(lojaId)
  const [novo, setNovo] = useState('')
  const [msg, setMsg] = useState(null)
  const [salvando, setSalvando] = useState(false)

  async function handleAdicionar() {
    const problema = validarNovoVendedor(novo, vendedores.map(v => v.nome))
    if (problema) { setMsg({ tipo: 'erro', texto: problema }); return }
    setSalvando(true)
    const e = await adicionar(novo)
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
        ou letra maiúscula.
      </p>

      {erro ? (
        <p style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: 12.5, color: '#b45309', background: 'rgba(202,138,4,0.08)', border: '1px solid rgba(202,138,4,0.2)', borderRadius: 10, padding: '9px 12px', lineHeight: 1.45 }}>
          Cadastro indisponível no momento. A Nova Venda continua funcionando com o
          campo de texto.
        </p>
      ) : (
        <>
          <Label>Adicionar vendedor</Label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <Input
                value={novo}
                onChange={e => { setNovo(e.target.value); setMsg(null) }}
                onKeyDown={e => e.key === 'Enter' && handleAdicionar()}
                placeholder="Nome do vendedor"
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
