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
// ─── TRAVA DE BALANÇO ────────────────────────────────────────────────────────
// addVenda() (Nova Venda) checa checarTravaBalanco antes de gravar; como
// aqui não passamos por addVenda (addVendaRaw não mexe em estoque, de
// propósito — ver o comentário dela em useLojaData.js), a checagem é feita
// aqui, uma vez, ao abrir a tela: bipar durante um balanço em andamento
// corromperia a contagem em curso.

import { useState, useEffect, useRef } from 'react'
import { User, Phone, ScanLine, Trash2, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import SecaoTitulo from '../../components/studio/SecaoTitulo'
import Input, { Label } from '../../components/studio/Input'
import Button from '../../components/studio/Button'
import EmptyState from '../../components/studio/EmptyState'
import CampoScanner from '../../components/etiquetas/CampoScanner'
import SelectVendedor from '../../components/vendedores/SelectVendedor'
import { buscarPorCodigo } from '../../utils/codigoBarras'
import { temAcesso } from '../../utils/planos'
import { vendedorParaVenda } from '../../utils/vendedores'
import { checarTravaBalanco } from '../../utils/balanco'
import { calcularTotalVenda } from '../../utils/venda'
import { fmtR } from '../../utils/formatters'
import {
  montarInsertPrimeiroBipe, acrescentarBipe, removerLinha,
  variacaoParaRpc, parseErroEstoquePrevenda, mensagemErroEstoquePrevenda,
  encontrarProdutoPorNome,
} from '../../utils/prevenda'

export default function PreVenda({ produtosData = [], addVendaRaw, updateVenda, LOJA_ID = '', theme, config = null, onSalvo }) {
  const temAcessoVendedores = temAcesso(config?.plano || 'starter', 'pro')

  const [clienteNome, setClienteNome] = useState('')
  const [clienteTel, setClienteTel] = useState('')
  const [vendedora, setVendedora] = useState('')
  // Trava os dados da cliente assim que o primeiro bipe grava — mudar nome/
  // vendedora depois criaria a impressão de editar um campo que já foi pro
  // banco sem realmente atualizar lá (o INSERT já aconteceu).
  const [dadosTravados, setDadosTravados] = useState(false)

  const [itens, setItens] = useState([])
  const [vendaId, setVendaId] = useState(null)
  const [removendo, setRemovendo] = useState(null) // índice em remoção, trava o botão

  const [checandoTrava, setCheckandoTrava] = useState(true)
  const [travado, setTravado] = useState(false)

  // Trava síncrona contra bipe concorrente — ver o comentário completo no
  // início de lerCodigoBarras. Ref, não state: precisa ser lida/escrita na
  // mesma volta síncrona do event loop, antes de qualquer await, e
  // setState não garante isso (é assíncrono/em lote).
  const bipandoRef = useRef(false)

  useEffect(() => {
    let vivo = true
    async function checar() {
      const { travado: t } = await checarTravaBalanco(supabase, LOJA_ID)
      if (vivo) { setTravado(t); setCheckandoTrava(false) }
    }
    checar()
    return () => { vivo = false }
  }, [LOJA_ID])

  const valor = calcularTotalVenda(itens, produtosData)
  const totalPecas = itens.reduce((s, it) => s + (Number(it.quantidade) || 1), 0)

  /**
   * aoLer do CampoScanner — async (CampoScanner.jsx já foi ajustado pra
   * esperar). Cada bipe: 1) resolve o código em produtosData (memória,
   * síncrono); 2) chama bipar_item_prevenda (rede — decremento atômico);
   * 3) só se (2) der certo, persiste em lf_vendas (INSERT no primeiro bipe,
   * UPDATE nos seguintes). Se a persistência falhar DEPOIS do decremento ter
   * dado certo, desfaz o decremento (restaurar_item_prevenda) — nunca deixa
   * estoque baixado sem registro.
   *
   * ─── POR QUE bipandoRef ─────────────────────────────────────────────────
   * Entre "bipar_item_prevenda deu certo" e "setVendaId(venda.id) aplicado",
   * há um round-trip de rede — se a vendedora bipar uma segunda peça bem
   * rápido, `vendaId` no closure ainda pode estar null, e essa segunda
   * chamada tentaria criar um SEGUNDO registro em vez de UPDATE no primeiro.
   * bipandoRef bloqueia qualquer bipe novo enquanto um anterior ainda está
   * em voo — CampoScanner mostra "aguarde" e a peça pode ser bipada de novo
   * um instante depois; nenhum estoque é tocado nesse bloqueio (ele acontece
   * ANTES de chamar a RPC).
   */
  async function lerCodigoBarras(codigo) {
    if (travado) return { ok: false, texto: 'Vendas travadas: balanço de estoque em andamento' }
    if (bipandoRef.current) return { ok: false, texto: 'Aguarde, ainda processando o bipe anterior.' }

    const achado = buscarPorCodigo(produtosData, LOJA_ID, codigo)
    if (!achado) return { ok: false, texto: 'Código não encontrado nesta loja' }

    bipandoRef.current = true
    try {
      const { error: erroRpc } = await supabase.rpc('bipar_item_prevenda', {
        p_loja_id: LOJA_ID,
        p_produto_id: achado.produto.id,
        p_variacao: variacaoParaRpc(achado.rotulo),
        p_origem_id: vendaId,
      })
      if (erroRpc) {
        const info = parseErroEstoquePrevenda(erroRpc.message)
        return { ok: false, texto: mensagemErroEstoquePrevenda(achado.produto.nome, info) }
      }

      setDadosTravados(true)

      if (!vendaId) {
        const payload = montarInsertPrimeiroBipe({
          lojaId: LOJA_ID,
          nome: achado.produto.nome,
          rotulo: achado.rotulo,
          clienteNome,
          clienteTel,
          vendedora: vendedorParaVenda(vendedora),
          produtosData,
        })
        const { error: erroInsert, venda } = await addVendaRaw(payload)
        if (erroInsert || !venda) {
          // Compensação: o decremento já aconteceu, mas não há onde registrar
          // — devolve a peça em vez de deixar estoque baixado sem pré-venda.
          await supabase.rpc('restaurar_item_prevenda', {
            p_loja_id: LOJA_ID, p_produto_id: achado.produto.id, p_variacao: variacaoParaRpc(achado.rotulo),
          })
          return { ok: false, texto: 'Não foi possível salvar a pré-venda. Tente de novo.' }
        }
        setVendaId(venda.id)
        setItens(payload.produtos)
      } else {
        const { produtos, valor: valorNovo } = acrescentarBipe(itens, { nome: achado.produto.nome, variacao: achado.rotulo }, produtosData)
        const erroUpdate = await updateVenda(vendaId, { produtos, valor: valorNovo })
        if (erroUpdate) {
          await supabase.rpc('restaurar_item_prevenda', {
            p_loja_id: LOJA_ID, p_produto_id: achado.produto.id, p_variacao: variacaoParaRpc(achado.rotulo),
          })
          return { ok: false, texto: 'Não foi possível salvar o item. Tente de novo.' }
        }
        setItens(produtos)
      }

      return { ok: true, texto: `${achado.produto.nome}${achado.rotulo ? ` · ${achado.rotulo}` : ''}` }
    } finally {
      bipandoRef.current = false
    }
  }

  /**
   * Remove uma linha inteira (todas as unidades daquela combinação). Devolve
   * ao estoque uma unidade por vez (restaurar_item_prevenda só devolve 1 por
   * chamada, mesmo padrão do bipe). Se era a última linha, cancela a
   * pré-venda inteira — não faz sentido um registro 'aguardando_pagamento'
   * com produtos=[].
   */
  async function handleRemover(indice) {
    setRemovendo(indice)
    try {
      const { produtos, valor: valorNovo, item, ficouVazia } = removerLinha(itens, indice, produtosData)
      if (!item) return

      const produto = encontrarProdutoPorNome(produtosData, item.nome)
      if (produto) {
        const vezes = Math.max(1, Number(item.quantidade) || 1)
        for (let i = 0; i < vezes; i++) {
          await supabase.rpc('restaurar_item_prevenda', {
            p_loja_id: LOJA_ID, p_produto_id: produto.id, p_variacao: variacaoParaRpc(item.variacao),
          })
        }
      }
      // produto null: sumiu do catálogo desde a bipagem — segue sem
      // restaurar esse item específico (mesmo comportamento de
      // aplicarEstoque pra esse caso), mas a linha some da pré-venda do
      // mesmo jeito.

      if (ficouVazia) {
        await updateVenda(vendaId, { status: 'cancelada' })
        setVendaId(null)
        setItens([])
        setDadosTravados(false)
      } else {
        await updateVenda(vendaId, { produtos, valor: valorNovo })
        setItens(produtos)
      }
    } finally {
      setRemovendo(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 24 }}>
      <SecaoTitulo
        Icon={ScanLine}
        titulo="Pré-venda"
        descricao="Bipe as peças separadas — o estoque já baixa na hora."
        theme={theme}
      />

      {checandoTrava ? null : travado ? (
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
          {!dadosTravados && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <Label><User size={13} /> Cliente (opcional)</Label>
                <Input value={clienteNome} onChange={e => setClienteNome(e.target.value)} placeholder="Nome da cliente" />
              </div>
              <div>
                <Label><Phone size={13} /> WhatsApp (opcional)</Label>
                <Input value={clienteTel} onChange={e => setClienteTel(e.target.value)} placeholder="(85) 99999-0000" />
              </div>
              <div>
                <Label>Vendedor(a)</Label>
                {temAcessoVendedores ? (
                  <SelectVendedor
                    lojaId={LOJA_ID}
                    valor={vendedora}
                    aoMudar={setVendedora}
                    style={{
                      width: '100%', height: 44, boxSizing: 'border-box',
                      background: 'var(--bg)', border: '1.5px solid var(--line)',
                      borderRadius: 'var(--r-input)', padding: '0 14px',
                      fontFamily: 'var(--font-ui)', fontSize: 14, color: 'var(--ink)', outline: 'none',
                    }}
                  />
                ) : (
                  <Input value={vendedora} onChange={e => setVendedora(e.target.value)} placeholder="Nome de quem está atendendo" />
                )}
              </div>
            </div>
          )}

          {dadosTravados && (clienteNome || vendedora) && (
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: 12.5, color: 'var(--muted)' }}>
              {clienteNome || 'Cliente não identificada'}{vendedora ? ` · ${vendedora}` : ''}
            </p>
          )}

          <CampoScanner aoLer={lerCodigoBarras} theme={theme} autoFoco dica="Bipe a peça separada" />

          {itens.length === 0 ? (
            <EmptyState
              icon={ScanLine}
              title="Nenhuma peça bipada ainda"
              subtitle="Bipe o código de barras da peça separada — o estoque baixa na hora."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {itens.map((it, i) => (
                <div key={`${it.nome}|${it.variacao ?? ''}`} style={{
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
                    onClick={() => handleRemover(i)}
                    disabled={removendo === i}
                    aria-label={`Remover ${it.nome}`}
                    style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      border: 'none', background: 'var(--bg)', color: 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: removendo === i ? 'not-allowed' : 'pointer',
                      opacity: removendo === i ? 0.5 : 1,
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {itens.length > 0 && (
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
                  {totalPecas} {totalPecas === 1 ? 'peça' : 'peças'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: 'var(--ink)' }}>
                  {fmtR(valor)}
                </span>
              </div>
              <Button variant="primary" fullWidth icon={ArrowRight} onClick={onSalvo}>
                Salvar e continuar depois
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
