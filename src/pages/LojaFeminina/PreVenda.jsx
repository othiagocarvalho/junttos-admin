// Tela de bipagem da Pré-venda (mobile) — etapa 2.
//
// ─── POR QUE NÃO É UM STEP A MAIS DE NovaVenda.jsx ──────────────────────────
// Nova Venda acumula tudo em estado local e só grava no fim (handleSave).
// Pré-venda é o oposto: o estoque já sai da loja no MOMENTO do bipe (decisão
// da etapa 1, bipar_item_prevenda), então a persistência em lf_vendas não
// pode esperar o fim — o primeiro bipe já grava (INSERT), cada bipe seguinte
// só acrescenta (UPDATE). Enfiar isso dentro do fluxo de passos de Nova
// Venda misturaria dois modelos de gravação diferentes no mesmo componente.
// Ver utils/prevenda.js para o raciocínio completo.
//
// ─── ONDE ESTÁ A REGRA ───────────────────────────────────────────────────────
// Fila de bipes, RPC, gravação, compensação e trava de balanço: em
// usePreVendaBipagem.js + utils/bipagemPreVenda.js, compartilhados com o
// DesktopPreVenda. Esta tela só desenha.
//
// Duas entradas de peça, o MESMO caminho (registrarItem): o leitor de código
// de barras e a busca por nome (SeletorProduto). A busca é o único jeito de
// reservar peça sem etiqueta e produto sem variação.

import { useState } from 'react'
import { User, Phone, ScanLine, Trash2, ArrowRight, Search, ChevronDown } from 'lucide-react'
import SecaoTitulo from '../../components/studio/SecaoTitulo'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import CampoScanner from '../../components/etiquetas/CampoScanner'
import SeletorProduto from '../../components/venda/SeletorProduto'
import SelectVendedor from '../../components/vendedores/SelectVendedor'
import { temAcesso } from '../../utils/planos'
import { fmtR } from '../../utils/formatters'
import { chaveLinha } from '../../utils/prevenda'
import { usePreVendaBipagem } from './usePreVendaBipagem'

export default function PreVenda({ produtosData = [], addVendaRaw, updateVenda, fetchAll, LOJA_ID = '', theme, config = null, onSalvo }) {
  const temAcessoVendedores = temAcesso(config?.plano || 'starter', 'pro')
  const [buscaAberta, setBuscaAberta] = useState(false)

  const b = usePreVendaBipagem({ produtosData, addVendaRaw, updateVenda, fetchAll, LOJA_ID, onSalvo })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 24 }}>
      <SecaoTitulo
        Icon={ScanLine}
        titulo="Pré-venda"
        descricao="Bipe as peças separadas — o estoque já baixa na hora."
        theme={theme}
      />

      {b.checandoTrava ? null : b.travado ? (
        <div style={{
          padding: '14px 16px', borderRadius: 'var(--r-card)',
          background: 'var(--status-warn-bg)', border: '1px solid var(--status-warn-dot)',
        }}>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13, fontWeight: 700, color: 'var(--status-warn-tx)' }}>
            Balanço em andamento
          </p>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--status-warn-tx)', marginTop: 3 }}>
            Pré-venda fica travada enquanto o balanço de estoque desta loja estiver ativo.
          </p>
        </div>
      ) : (
        <>
          {!b.dadosTravados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label><User size={13} /> Cliente (opcional)</Label>
                <Input value={b.clienteNome} onChange={e => b.setClienteNome(e.target.value)} placeholder="Nome da cliente" />
              </div>
              <div>
                <Label><Phone size={13} /> WhatsApp (opcional)</Label>
                <Input value={b.clienteTel} onChange={e => b.setClienteTel(e.target.value)} placeholder="(85) 99999-0000" />
              </div>
              <div>
                <Label>Vendedor(a)</Label>
                {temAcessoVendedores ? (
                  <SelectVendedor
                    lojaId={LOJA_ID}
                    valor={b.vendedora}
                    aoMudar={b.setVendedora}
                    style={{
                      width: '100%', height: 44, boxSizing: 'border-box',
                      background: 'var(--bg)', border: '1.5px solid var(--line)',
                      borderRadius: 'var(--r-input)', padding: '0 14px',
                      fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', outline: 'none',
                    }}
                  />
                ) : (
                  <Input value={b.vendedora} onChange={e => b.setVendedora(e.target.value)} placeholder="Nome de quem está atendendo" />
                )}
              </div>
            </div>
          )}

          {b.dadosTravados && (b.clienteNome || b.vendedora) && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)' }}>
              {b.clienteNome || 'Cliente não identificada'}{b.vendedora ? ` · ${b.vendedora}` : ''}
            </p>
          )}

          <div>
            <CampoScanner aoLer={b.lerCodigoBarras} theme={theme} autoFoco dica="Bipe a peça separada" />
            {b.pendentes > 0 && (
              <p role="status" aria-live="polite" style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                Processando {b.pendentes} {b.pendentes === 1 ? 'peça' : 'peças'}… pode continuar bipando.
              </p>
            )}
          </div>

          <div>
            <button
              type="button"
              onClick={() => setBuscaAberta(v => !v)}
              aria-expanded={buscaAberta}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                padding: '10px 14px', borderRadius: 'var(--r-input)', cursor: 'pointer',
                border: '1px dashed var(--line)', background: 'var(--bg)',
                fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 600, color: 'var(--ink-soft)',
              }}
            >
              <Search size={15} />
              <span style={{ flex: 1, textAlign: 'left' }}>Peça sem etiqueta? Buscar pelo nome</span>
              <ChevronDown size={15} style={{ transform: buscaAberta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
            </button>
            {buscaAberta && (
              <div style={{ marginTop: 10 }}>
                <SeletorProduto
                  produtos={b.produtosExibicao}
                  itens={b.itens}
                  aoEscolher={({ produto, rotulo }) => b.registrarItem(produto, rotulo)}
                  primary={theme?.primary}
                  desabilitado={b.saindo}
                />
              </div>
            )}
          </div>

          {b.itens.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="Nenhuma peça bipada ainda"
              subtitle="Bipe o código de barras da peça separada — o estoque baixa na hora."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {b.itens.map(it => {
                const chave = chaveLinha(it)
                const emRemocao = b.removendo.has(chave)
                return (
                  <div key={chave} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    background: 'var(--surface)', border: '1px solid var(--line)',
                    borderRadius: 'var(--r-card)', padding: '10px 12px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontFamily: 'var(--font-ui)', fontSize: 13.5, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.nome}
                      </p>
                      {(it.variacao || it.quantidade > 1) && (
                        <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--muted)' }}>
                          {it.variacao && it.variacao !== 'Único' ? it.variacao : ''}
                          {it.variacao && it.variacao !== 'Único' && it.quantidade > 1 ? ' · ' : ''}
                          {it.quantidade > 1 ? `${it.quantidade}×` : ''}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => b.removerItem(it)}
                      disabled={emRemocao || b.saindo}
                      aria-label={`Remover ${it.nome}`}
                      style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        border: 'none', background: 'var(--bg)', color: 'var(--muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: emRemocao ? 'not-allowed' : 'pointer',
                        opacity: emRemocao ? 0.5 : 1,
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {(b.itens.length > 0 || b.pendentes > 0) && (
            <div style={{
              position: 'sticky', bottom: 0, background: 'var(--bg)',
              paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', borderRadius: 'var(--r-card)',
                background: 'var(--surface)', border: '1px solid var(--line)',
              }}>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)' }}>
                  {b.totalPecas} {b.totalPecas === 1 ? 'peça' : 'peças'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                  {fmtR(b.valor)}
                </span>
              </div>
              <Button variant="primary" fullWidth icon={ArrowRight} onClick={b.sair} disabled={b.saindo}>
                {b.saindo
                  ? (b.pendentes > 0 ? `Aguardando ${b.pendentes} ${b.pendentes === 1 ? 'peça' : 'peças'}…` : 'Salvando…')
                  : 'Salvar e continuar depois'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
