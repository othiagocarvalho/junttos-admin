// Núcleo da bipagem da Pré-venda — sem React, testável com um supabase falso.
// PreVenda.jsx (mobile) e DesktopPreVenda (ClientDashboardDesktop.jsx) usam
// isto através de usePreVendaBipagem.js; a regra mora num lugar só.
//
// ─── O QUE CONTINUA IGUAL ───────────────────────────────────────────────────
// A arquitetura de utils/prevenda.js não mudou: cada peça é reservada pela
// RPC bipar_item_prevenda (decremento atômico no banco) e só DEPOIS gravada
// em lf_vendas — INSERT no primeiro bipe, UPDATE nos seguintes. Se a gravação
// falhar depois do decremento, a peça é devolvida (restaurar_item_prevenda):
// nunca fica estoque baixado sem registro.
//
// ─── O QUE MUDOU (lentidão relatada pela Tropicale) ─────────────────────────
// 1. A gravação passa `recarregar: false`: antes, cada bipe esperava um
//    fetchAll inteiro (2,4 a 3,6 s medidos) antes de liberar o próximo.
// 2. Fila em vez de recusa: bipe que chega com outro em andamento entra na
//    fila (utils/filaSerial.js) e roda depois, em ordem. A fila é o que
//    garante que nunca rodam dois bipes ao mesmo tempo — a mesma proteção que
//    o antigo bipandoRef dava contra criar DUAS pré-vendas no primeiro bipe
//    (vendaId ainda null), sem jogar o bipe fora.
// 3. Remoção de linha entra na MESMA fila: remover e bipar ao mesmo tempo
//    gravariam listas de produtos diferentes por cima uma da outra.
// 4. vendaId/itens vivem aqui, em variáveis, e não em state do React: cada
//    tarefa da fila precisa ver o resultado da anterior na hora, sem esperar
//    re-render.

import { criarFilaSerial } from './filaSerial'
import { mesmoItem } from './itemVenda'
import {
  montarInsertPrimeiroBipe, acrescentarBipe, removerLinha, variacaoParaRpc,
  parseErroEstoquePrevenda, mensagemErroEstoquePrevenda, encontrarProdutoDoItem,
  chaveReserva,
} from './prevenda'

export const TEXTO_BALANCO = 'Vendas travadas: balanço de estoque em andamento'
const TEXTO_FALHA_REDE = 'Não foi possível bipar este item agora. Tente de novo.'

/**
 * @param deps.supabase      cliente com .rpc(nome, args)
 * @param deps.lojaId
 * @param deps.aoMudar       (estado) => void — chamado a cada mudança.
 *
 * O contexto — { clienteNome, clienteTel, vendedora, produtosData, travado,
 * addVendaRaw, updateVenda } — é entregue por definirContexto() a cada
 * render e lido na HORA de processar cada tarefa da fila, não no momento do
 * bipe. (Dá para passar deps.lerContexto no lugar, como os testes fazem.)
 */
export function criarBipagemPreVenda({ supabase, lojaId, lerContexto, aoMudar }) {
  let contexto = {}
  const ler = lerContexto || (() => contexto)
  const addVendaRaw = (...a) => ler().addVendaRaw(...a)
  const updateVenda = (...a) => ler().updateVenda(...a)
  const fila = criarFilaSerial()
  let vendaId = null
  let itens = []
  let reservas = {}

  function estado() {
    return {
      vendaId,
      itens,
      reservas,
      pendentes: fila.pendentes(),
      // Dados da cliente travam assim que o primeiro bipe entra na fila (o
      // INSERT vai ler o que estiver no campo quando rodar) e destravam se a
      // pré-venda deixar de existir.
      dadosTravados: vendaId !== null || fila.pendentes() > 0,
    }
  }
  function avisar() { aoMudar?.(estado()) }
  fila.assinar(avisar)

  function reservar(produtoId, rotulo, delta) {
    const chave = chaveReserva(produtoId, rotulo)
    const n = (reservas[chave] || 0) + delta
    const novo = { ...reservas }
    if (n === 0) delete novo[chave]
    else novo[chave] = n
    reservas = novo
  }

  function restaurar(produtoId, rotulo) {
    return supabase.rpc('restaurar_item_prevenda', {
      p_loja_id: lojaId, p_produto_id: produtoId, p_variacao: variacaoParaRpc(rotulo),
    })
  }

  async function processarBipe(produto, rotulo) {
    const ctx = ler()
    if (ctx.travado) return { ok: false, texto: TEXTO_BALANCO }

    let baixou = false
    let gravou = false
    try {
      const { error: erroRpc } = await supabase.rpc('bipar_item_prevenda', {
        p_loja_id: lojaId,
        p_produto_id: produto.id,
        p_variacao: variacaoParaRpc(rotulo),
        p_origem_id: vendaId,
      })
      if (erroRpc) {
        const info = parseErroEstoquePrevenda(erroRpc.message)
        return { ok: false, texto: mensagemErroEstoquePrevenda(produto.nome, info) }
      }
      baixou = true

      if (!vendaId) {
        const payload = montarInsertPrimeiroBipe({
          lojaId,
          produtoId: produto.id,
          nome: produto.nome,
          rotulo,
          clienteNome: ctx.clienteNome,
          clienteTel: ctx.clienteTel,
          vendedora: ctx.vendedora,
          produtosData: ctx.produtosData,
        })
        const { error: erroInsert, venda } = await addVendaRaw(payload, { recarregar: false })
        if (erroInsert || !venda) {
          // Compensação: o decremento já aconteceu, mas não há onde registrar
          // — devolve a peça em vez de deixar estoque baixado sem pré-venda.
          await restaurar(produto.id, rotulo)
          baixou = false
          return { ok: false, texto: 'Não foi possível salvar a pré-venda. Tente de novo.' }
        }
        gravou = true
        vendaId = venda.id
        itens = payload.produtos
      } else {
        const { produtos, valor } = acrescentarBipe(itens, { produto_id: produto.id, nome: produto.nome, variacao: rotulo }, ctx.produtosData)
        const erroUpdate = await updateVenda(vendaId, { produtos, valor }, { recarregar: false })
        if (erroUpdate) {
          await restaurar(produto.id, rotulo)
          baixou = false
          return { ok: false, texto: 'Não foi possível salvar o item. Tente de novo.' }
        }
        gravou = true
        itens = produtos
      }

      reservar(produto.id, rotulo, +1)
      return { ok: true, texto: `${produto.nome}${rotulo ? ` · ${rotulo}` : ''}` }
    } catch {
      // Exceção inesperada (supabase-js normalmente devolve {error}, não
      // lança). Se a peça já tinha saído do estoque e não foi gravada, a
      // mesma compensação dos caminhos acima.
      if (baixou && !gravou) {
        try { await restaurar(produto.id, rotulo) } catch { /* nada mais a fazer */ }
      }
      return { ok: false, texto: TEXTO_FALHA_REDE }
    } finally {
      avisar()
    }
  }

  /**
   * Remove uma linha inteira (todas as unidades). Lógica de devolução
   * idêntica à de antes: uma chamada de restaurar_item_prevenda por unidade;
   * produto que sumiu do catálogo é pulado; última linha cancela a pré-venda.
   * A linha é localizada na HORA de rodar (por mesmoItem), não pelo índice
   * de quando o botão foi tocado — bipes na fila podem ter mudado a lista.
   */
  async function processarRemocao(item) {
    const ctx = ler()
    try {
      const indice = itens.findIndex(it => mesmoItem(it, item))
      if (indice === -1 || !vendaId) return { ok: true }

      const { produtos, valor, item: linha, ficouVazia } = removerLinha(itens, indice, ctx.produtosData)
      const produto = encontrarProdutoDoItem(ctx.produtosData, linha)
      if (produto) {
        const vezes = Math.max(1, Number(linha.quantidade) || 1)
        for (let i = 0; i < vezes; i++) {
          const { error } = await restaurar(produto.id, linha.variacao)
          if (!error) reservar(produto.id, linha.variacao, -1)
        }
      }
      // produto null: sumiu do catálogo desde a bipagem — segue sem
      // restaurar esse item (mesmo comportamento de aplicarEstoque), mas a
      // linha some da pré-venda do mesmo jeito.

      if (ficouVazia) {
        await updateVenda(vendaId, { status: 'cancelada' }, { recarregar: false })
        vendaId = null
        itens = []
      } else {
        await updateVenda(vendaId, { produtos, valor }, { recarregar: false })
        itens = produtos
      }
      return { ok: true }
    } finally {
      avisar()
    }
  }

  return {
    definirContexto(c) { contexto = c },
    /** Reserva uma peça (produto + rótulo; rótulo null = sem variação). */
    registrarItem(produto, rotulo) {
      if (ler().travado) return Promise.resolve({ ok: false, texto: TEXTO_BALANCO })
      return fila.enfileirar(() => processarBipe(produto, rotulo ?? null))
    },
    removerItem(item) {
      return fila.enfileirar(() => processarRemocao(item))
    },
    /** Reservas são só de exibição: zeram quando produtosData é recarregado
     *  do banco, que a partir daí já reflete as baixas. */
    zerarReservas() {
      if (Object.keys(reservas).length === 0) return
      reservas = {}
      avisar()
    },
    aguardarVazia: () => fila.aguardarVazia(),
    pendentes: () => fila.pendentes(),
    estado,
  }
}
