import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { decrementarVariacoes, restaurarVariacoes } from '../../utils/venda'
import { checarTravaBalanco } from '../../utils/balanco'
import { precisaDevolverEstoque, normalizarItensEstoque, agruparPorNome, rpcAusente } from '../../utils/estoqueMov'
// ── Demo auto-top-up helpers ──────────────────────────────────────
// DEMO_MULT_DIA deve ser mantido em sync com DemoPanel.jsx manualmente.
const _DEMO_MULT_DIA = [
  0.70, 1.20, 0.80, 1.40, 0.90,
  0.60, 1.50, 1.10, 0.75, 1.30,
  0.90, 1.05, 0.80, 1.20, 1.40,
  0.65, 1.30, 1.00, 0.60, 1.20,
  0.90, 1.40, 0.80, 1.15, 0.70,
  1.30, 0.95, 1.50, 1.20, 0.80,
  1.00,
]
const _DEMO_NOMES = ['Ana Carolina Silva', 'Fernanda Rocha', 'Juliana Matos', 'Beatriz Oliveira', 'Larissa Mendes', null, null]
const _DEMO_PRODS = [
  [{ nome: 'Vestido Floral', quantidade: 1 }],
  [{ nome: 'Blusa Listrada', quantidade: 1 }],
  [{ nome: 'Calça Skinny', quantidade: 1 }],
  [{ nome: 'Cropped Básico', quantidade: 2 }],
  [{ nome: 'Saia Midi', quantidade: 1 }],
  [{ nome: 'Conjunto Tie Dye', quantidade: 1 }],
]
const _DEMO_FORMAS = ['Pix', 'Cartão de Crédito', 'Dinheiro', 'Pix', 'Cartão de Débito']

function _vendasHojeDemo(lojaId) {
  const hoje = new Date()
  const dia = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const mult = _DEMO_MULT_DIA[Math.min(dia - 1, _DEMO_MULT_DIA.length - 1)]
  const valorDia = (30000 / diasNoMes) * mult
  const nVendas = mult < 0.80 ? 2 : mult < 1.20 ? 3 : 4
  return Array.from({ length: nVendas }, (_, i) => {
    const varFactor = 0.87 + ((dia * 7 + i * 13) % 26) / 100
    const valor = Math.round((valorDia / nVendas) * varFactor)
    const hora = 9 + ((dia * 3 + i * 5) % 9)
    const min = (dia * 11 + i * 17) % 60
    return {
      loja_id: lojaId,
      data: new Date(hoje.getFullYear(), hoje.getMonth(), dia, hora, min).toISOString(),
      valor,
      cliente_nome: _DEMO_NOMES[(dia * 3 + i) % _DEMO_NOMES.length],
      cliente_tel: null,
      produtos: _DEMO_PRODS[(dia + i) % _DEMO_PRODS.length],
      forma_pgto: JSON.stringify([{ forma: _DEMO_FORMAS[(dia + i * 2) % _DEMO_FORMAS.length], valor: '' }]),
      obs: null,
      vendedora: (dia + i) % 5 === 0 ? 'Carla' : null,
      ajuste_valor: null,
    }
  })
}

const DEFAULT_FEATURES = {
  vendas: true,
  historico: true,
  metas: true,
  fechamento_caixa: true,
  relatorios: true,
  clientes: false,
  estoque: false,
}

export function useLojaData(lojaId = 'estrada') {
  const [vendas, setVendas] = useState([])
  const [caixas, setCaixas] = useState([])
  const [metas, setMetas] = useState({})
  const [metasVendedora, setMetasVendedora] = useState([])
  const [metaProduto, setMetaProduto] = useState(null)
  const [corridas, setCorridas]         = useState([])
  const [produtos, setProdutos]         = useState([])
  const [produtosData, setProdutosData] = useState([])
  const [config, setConfig] = useState(null)
  const [clientes, setClientes] = useState([])
  const [crediario, setCrediario] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [compras, setCompras] = useState([])
  const [lembretes, setLembretes] = useState([])
  const [dispensados, setDispensados] = useState([])
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)
  const hasLoaded = useRef(false)

  const fetchAll = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true)
    try {
      const [vendasRes, caixasRes, metasRes, produtosRes, configRes, clientesRes, metasVendRes, metaProdRes, corridasRes] = await Promise.all([
        supabase.from('lf_vendas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_caixas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_metas').select('*').eq('loja_id', lojaId),
        supabase.from('lf_produtos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
        supabase.from('lf_config').select('*').eq('loja_id', lojaId).maybeSingle(),
        supabase.from('lf_clientes').select('*').eq('loja_id', lojaId).order('nome'),
        supabase.from('lf_metas_vendedora').select('*').eq('loja_id', lojaId),
        supabase.from('lf_meta_produto').select('*').eq('loja_id', lojaId).eq('ativa', true).maybeSingle(),
        supabase.from('lf_corrida').select('*').eq('loja_id', lojaId).eq('ativa', true).order('created_at', { ascending: false }),
      ])

      if (vendasRes.error) throw vendasRes.error
      if (caixasRes.error) throw caixasRes.error
      if (metasRes.error) throw metasRes.error
      if (produtosRes.error) throw produtosRes.error
      if (clientesRes.error) throw clientesRes.error
      if (metasVendRes.error) throw metasVendRes.error
      if (metaProdRes.error) throw metaProdRes.error
      if (corridasRes.error) throw corridasRes.error

      setVendas(vendasRes.data || [])
      setCaixas(caixasRes.data || [])

      const metasMap = {}
      ;(metasRes.data || []).forEach(m => { metasMap[m.mes] = m.valor })
      setMetas(metasMap)
      setMetasVendedora(metasVendRes.data || [])
      setMetaProduto(metaProdRes.data || null)
      setCorridas(corridasRes.data || [])

      const prods = produtosRes.data || []
      setProdutos([...new Set(prods.map(p => p.nome))])
      setProdutosData(prods)
      const cfg = configRes.data || null
      if (cfg && typeof cfg.features === 'string') {
        try { cfg.features = JSON.parse(cfg.features) } catch (e) { cfg.features = {} }
      }
      setConfig(cfg)
      setClientes(clientesRes.data || [])
      try {
        const { data: crediarioData } = await supabase.from('lf_crediario').select('*').eq('loja_id', lojaId).order('data_compra', { ascending: false })
        setCrediario(crediarioData || [])
      } catch (_e) {
        setCrediario([])
      }
      try {
        const { data: pedidosData } = await supabase.from('lf_pedidos').select('*').eq('loja_id', lojaId).order('created_at', { ascending: false })
        setPedidos(pedidosData || [])
      } catch (_e) {
        setPedidos([])
      }
      try {
        const { data: comprasData } = await supabase.from('lf_compras').select('*').eq('loja_id', lojaId).order('data_compra', { ascending: false })
        setCompras(comprasData || [])
      } catch (_e) {
        setCompras([])
      }
      try {
        const { data: lembretesData } = await supabase.from('lf_lembretes').select('*').eq('loja_id', lojaId).order('data_lembrete')
        setLembretes(lembretesData || [])
      } catch (_e) {
        setLembretes([])
      }
      try {
        const { data: dispData } = await supabase.from('lf_followup_dispensado').select('*').eq('loja_id', lojaId)
        setDispensados(dispData || [])
      } catch (_e) {
        setDispensados([])
      }

      // Auto-top-up para a loja demo: se não há vendas de hoje, insere silenciosamente.
      // Garante que "Vendas hoje" e % da meta fiquem sempre atualizados sem reset manual.
      if (lojaId === 'sualoja') {
        const hojeStr = new Date().toISOString().slice(0, 10)
        const hasToday = (vendasRes.data || []).some(v => (v.data || '').startsWith(hojeStr))
        if (!hasToday) {
          await supabase.from('lf_vendas').insert(_vendasHojeDemo(lojaId))
          const { data: vendasNow } = await supabase
            .from('lf_vendas').select('*').eq('loja_id', lojaId).order('data', { ascending: false })
          setVendas(vendasNow || [])
        }
      }

      setDbError(null)
    } catch (e) {
      setDbError(e.message)
    } finally {
      setLoading(false)
      hasLoaded.current = true
    }
  }, [lojaId])

  useEffect(() => { fetchAll() }, [fetchAll])

  useEffect(() => {
    const channel = supabase
      .channel(`config-${lojaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'lf_config', filter: `loja_id=eq.${lojaId}` },
        ({ new: newRow }) => {
          if (!newRow) return
          if (typeof newRow.features === 'string') {
            try { newRow.features = JSON.parse(newRow.features) } catch (_) { newRow.features = {} }
          }
          setConfig(newRow)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [lojaId])

  async function ensureDefaults() {
    const { data: cfg } = await supabase
      .from('lf_config')
      .select('id')
      .eq('loja_id', lojaId)
      .maybeSingle()

    if (!cfg) {
      await supabase.from('lf_config').insert({
        loja_id: lojaId,
        nome: lojaId,
        features: DEFAULT_FEATURES,
      })
    }
  }

  async function importarProdutos(lista) {
    const rows = lista.map(p => ({
      loja_id:     lojaId,
      nome:        p.nome,
      preco_custo: p.precoCusto || 0,
      preco_venda: p.precoVenda || 0,
      variacoes:   p.variacoes  || [],
      fornecedor:  p.fornecedor || null,
      referencia:  p.referencia || null,
    }))
    // Via RPC para o trigger de lf_estoque_mov marcar as linhas como
    // 'importacao' em vez do fallback 'cadastro'.
    const error = await inserirProdutos(rows, 'importacao')
    if (!error) await fetchAll()
    return error
  }

  // Insert de produtos com o contexto de movimentação. Cai no insert direto
  // enquanto a migration não estiver aplicada — ver rpcAusente().
  async function inserirProdutos(rows, tipo) {
    const { error } = await supabase.rpc('lf_inserir_produtos', {
      p_rows: rows,
      p_tipo: tipo,
      p_usuario: null,
    })
    if (!rpcAusente(error)) return error
    console.warn('[estoque] lf_inserir_produtos ausente — rode migration_estoque_mov.sql')
    const { error: errDireto } = await supabase.from('lf_produtos').insert(rows)
    return errDireto
  }

  /**
   * Baixa ou restauração de estoque a partir dos itens de uma venda/pedido.
   * Caminho único de venda, troca e exclusão de venda — antes eram três blocos
   * praticamente iguais. Passa pela RPC lf_set_variacoes para que o trigger de
   * lf_estoque_mov saiba o motivo da mudança (venda, devolução...) em vez de
   * cair no fallback 'ajuste'.
   *
   * @param produtosItens itens no formato de lf_vendas.produtos ou lf_pedidos.produtos
   * @param modo 'baixa' | 'restauro'
   *
   * ─── O RETORNO É NOVO, O COMPORTAMENTO NÃO ──────────────────────────────
   * Antes esta função engolia a falha: dava console.error e seguia para o
   * próximo produto, devolvendo undefined sempre. Isso serve para venda e
   * troca, onde travar o fluxo por um produto seria pior do que registrar o
   * erro — e continua igual, porque todos os chamadores antigos ignoram o
   * retorno.
   *
   * O que mudou é que agora ela DIZ o que falhou, numa lista. Quem precisa
   * decidir em cima disso — excluirPedido, que não pode apagar o pedido sem
   * ter devolvido as peças — passa a conseguir.
   *
   * @returns {Promise<Array<{nome, mensagem}>>} vazia quando tudo gravou
   */
  async function aplicarEstoque(produtosItens, { modo, tipo, origemTipo = null, origemId = null, motivo = null }) {
    const falhas = []
    const itens = normalizarItensEstoque(produtosItens)
    if (itens.length === 0) return falhas

    for (const grupo of agruparPorNome(itens)) {
      const { data: prod } = await supabase
        .from('lf_produtos')
        .select('id, variacoes')
        .eq('loja_id', lojaId)
        .eq('nome', grupo.nome)
        .maybeSingle()
      // Produto sumiu do catálogo: não há estoque para mexer, então não é
      // falha de gravação — é ausência de alvo. Bloquear por isso deixaria o
      // pedido impossível de excluir para sempre. Mesmo comportamento que
      // cancelarPedido já tinha.
      if (!prod) continue

      const novasVariacoes = modo === 'baixa'
        ? decrementarVariacoes(prod.variacoes, grupo.itens)
        : restaurarVariacoes(prod.variacoes, grupo.itens)

      const error = await gravarVariacoes(prod.id, novasVariacoes, { tipo, origemTipo, origemId, motivo })
      if (error) {
        console.error('[estoque] gravação de variações falhou:', error.message, grupo.nome)
        falhas.push({ nome: grupo.nome, mensagem: error.message })
      }
    }
    return falhas
  }

  // Update de variacoes com o contexto de movimentação. Cai no update direto
  // enquanto a migration não estiver aplicada — ver rpcAusente().
  async function gravarVariacoes(id, variacoes, ctx = {}) {
    const { error } = await supabase.rpc('lf_set_variacoes', {
      p_produto_id:  id,
      p_variacoes:   variacoes,
      p_loja_id:     lojaId,
      p_tipo:        ctx.tipo       || 'ajuste',
      p_origem_tipo: ctx.origemTipo || 'manual',
      p_origem_id:   ctx.origemId   || null,
      p_motivo:      ctx.motivo     || null,
      p_usuario:     ctx.usuario    || null,
    })
    if (!rpcAusente(error)) return error
    console.warn('[estoque] lf_set_variacoes ausente — rode migration_estoque_mov.sql')
    const { error: errDireto } = await supabase
      .from('lf_produtos')
      .update({ variacoes })
      .eq('id', id)
      .eq('loja_id', lojaId)
    return errDireto
  }

  async function addVenda(venda) {
    // Verificar trava de balanço de estoque.
    // A consulta usa .limit(1), nunca .maybeSingle(): com múltiplas sessões
    // abertas, .maybeSingle() devolvia { data: null, error: PGRST116 } e o erro
    // era silenciosamente ignorado, liberando a venda indevidamente.
    // checarTravaBalanco renova a sessão e repete uma vez quando o token
    // expirou — sem isso, uma tela aberta o dia inteiro acusava
    // "balanço em andamento" sem existir balanço nenhum.
    const { travado, result: balResult, renovou } = await checarTravaBalanco(supabase, lojaId)
    if (renovou) console.info('[addVenda] sessão renovada antes de checar a trava de balanço')
    if (balResult?.error) {
      console.error('[addVenda] erro ao checar trava de balanço:', balResult.error)
    }
    if (travado) {
      const msg = balResult?.error
        ? 'Não foi possível confirmar a venda agora. Verifique a conexão e tente de novo.'
        : 'Vendas travadas: há um balanço de estoque em andamento para esta loja.'
      return { error: { code: 'BAL_TRAVA', message: msg, causa: balResult?.error ? 'erro' : 'balanco' }, venda: null }
    }

    const { produto_devolvido, ...vendaPayload } = venda
    const { data: novaVenda, error } = await supabase
      .from('lf_vendas')
      .insert({ ...vendaPayload, loja_id: lojaId })
      .select()
      .single()
    // PGRST116 = select-after-insert retornou 0 linhas (insert OK, RLS edge case).
    // Outros erros = insert falhou de verdade — retorna sem executar side-effects.
    if (error && error.code !== 'PGRST116') {
      return { error, venda: null }
    }
    // Restaura estoque do produto devolvido em troca
      await aplicarEstoque(produto_devolvido, {
        modo:       'restauro',
        tipo:       'devolucao',
        origemTipo: 'venda',
        origemId:   novaVenda?.id || null,
        motivo:     'Devolução em troca',
      })
      await aplicarEstoque(venda.produtos, {
        modo:       'baixa',
        tipo:       'venda',
        origemTipo: 'venda',
        origemId:   novaVenda?.id || null,
      })
      // Auto-criação silenciosa de fornecedor em lf_fornecedores
      const nomeFornecedor = (venda.fornecedor || '').trim()
      if (nomeFornecedor) {
        try {
          const norm = s => s.toLowerCase().replace(/\s+/g, ' ').trim()
          const { data: fornExist } = await supabase
            .from('lf_fornecedores')
            .select('id, nome')
            .eq('loja_id', lojaId)
            .ilike('nome', nomeFornecedor)
          const match = (fornExist || []).find(f => norm(f.nome) === norm(nomeFornecedor))
          if (!match) {
            await supabase.from('lf_fornecedores').insert({ loja_id: lojaId, nome: nomeFornecedor })
          }
        } catch (e) {
          console.error('[auto-fornecedor]', e)
        }
      }

      // Auto-sincronização silenciosa de cliente em lf_clientes (sem gate de plano)
      const nomeVenda = (venda.cliente_nome || '').trim()
      if (nomeVenda) {
        try {
          const telVenda = (venda.cliente_tel || '').trim()
          const normTel = t => (t || '').replace(/[\s\-().]/g, '')
          const telVendaNorm = normTel(telVenda)

          const { data: existentes } = await supabase
            .from('lf_clientes')
            .select('id, nome, telefone')
            .eq('loja_id', lojaId)
            .ilike('nome', nomeVenda)

          const match = (existentes || []).find(c => {
            const ct = normTel(c.telefone || '')
            if (telVendaNorm && ct) return ct === telVendaNorm
            return true
          })

          if (!match) {
            await supabase.from('lf_clientes').insert({
              loja_id: lojaId,
              nome: nomeVenda,
              telefone: telVenda || null,
              email: null,
              data_nascimento: null,
              observacoes: null,
            })
          } else if (!match.telefone && telVenda) {
            await supabase.from('lf_clientes').update({ telefone: telVenda }).eq('id', match.id).eq('loja_id', lojaId)
          }
        } catch (e) {
          console.error('[auto-cliente]', e)
        }
      }

    return { error: null, venda: novaVenda || null }
  }

  async function deleteVenda(id) {
    const { data: venda } = await supabase
      .from('lf_vendas')
      .select('produtos')
      .eq('id', id)
      .maybeSingle()

    const { error } = await supabase.from('lf_vendas').delete().eq('id', id).eq('loja_id', lojaId)
    if (!error) {
      // origem_id fica nulo de propósito: a venda acabou de ser apagada, e um
      // id que não existe mais só levaria o extrato a um link quebrado.
      await aplicarEstoque(venda?.produtos, {
        modo:       'restauro',
        tipo:       'devolucao',
        origemTipo: 'venda_excluida',
        motivo:     'Venda excluída',
      })
      await fetchAll()
    }
    return error
  }

  async function updateVenda(id, updates) {
    const { error } = await supabase.from('lf_vendas').update(updates).eq('id', id).eq('loja_id', lojaId)
    if (!error) await fetchAll()
    return error
  }

  async function fecharCaixa(caixa) {
    const { error } = await supabase.from('lf_caixas').insert({ ...caixa, loja_id: lojaId })
    if (!error) await fetchAll()
    return error
  }

  async function deleteCaixa(id) {
    const { error } = await supabase.from('lf_caixas').delete().eq('id', id).eq('loja_id', lojaId)
    if (!error) await fetchAll()
    return error
  }

  async function salvarMeta(mes, valor) {
    const { error } = await supabase
      .from('lf_metas')
      .upsert({ loja_id: lojaId, mes, valor }, { onConflict: 'loja_id,mes' })
    if (!error) await fetchAll()
    return error
  }

  async function salvarMetaVendedora(mes, vendedora, valor) {
    const { error } = await supabase
      .from('lf_metas_vendedora')
      .upsert({ loja_id: lojaId, mes, vendedora, valor }, { onConflict: 'loja_id,mes,vendedora' })
    if (!error) await fetchAll()
    return error
  }

  async function salvarCorrida(dados) {
    const { error } = await supabase
      .from('lf_corrida')
      .insert({ loja_id: lojaId, ativa: true, ...dados })
    if (!error) await fetchAll()
    return error
  }

  async function excluirCorrida(id) {
    const { error } = await supabase
      .from('lf_corrida')
      .delete()
      .eq('id', id)
      .eq('loja_id', lojaId)
    if (!error) await fetchAll()
    return error
  }

  async function salvarMetaProduto(dados) {
    const { error: deactivateErr } = await supabase
      .from('lf_meta_produto')
      .update({ ativa: false })
      .eq('loja_id', lojaId)
      .eq('ativa', true)
    if (deactivateErr) return deactivateErr
    const { error } = await supabase
      .from('lf_meta_produto')
      .insert({ loja_id: lojaId, ativa: true, ...dados })
    if (!error) await fetchAll()
    return error
  }

  async function addProduto(nome, extras = {}) {
    // Via RPC pelo mesmo motivo de importarProdutos: o trigger precisa saber
    // que a quantidade inicial veio de um cadastro.
    const error = await inserirProdutos([{
      loja_id: lojaId,
      nome,
      preco_custo:     extras.precoCusto     || 0,
      preco_venda:     extras.precoVenda     || 0,
      variacoes:       extras.variacoes      || [],
      fornecedor:      extras.fornecedor     || null,
      fornecedor_id:   extras.fornecedor_id  || null,
      referencia:      extras.referencia     || null,
      valor_lote:      extras.valor_lote     || null,
      data_vencimento: extras.data_vencimento || null,
      status_pgto:     extras.status_pgto    || null,
      video_url:       extras.video_url      || null,
      fotos:           extras.fotos          || [],
      disponivel_catalogo_b2b: extras.disponivel_catalogo_b2b ?? false,
    }], 'cadastro')
    if (!error) await fetchAll()
    return error
  }

  async function updateProduto(id, updates) {
    const { error } = await supabase
      .from('lf_produtos')
      .update(updates)
      .eq('id', id)
      .eq('loja_id', lojaId)
    if (!error) await fetchAll()
    return error
  }

  async function removeProduto(nome) {
    const { error } = await supabase
      .from('lf_produtos')
      .update({ ativo: false })
      .eq('loja_id', lojaId)
      .eq('nome', nome)
    if (!error) await fetchAll()
    return error
  }

  // ctx é opcional: sem ele a movimentação entra como 'ajuste' manual, que é
  // exatamente o que a edição de estoque na tela é.
  async function updateVariacoes(id, variacoes, ctx = {}) {
    const error = await gravarVariacoes(id, variacoes, ctx)
    if (!error) await fetchAll()
    return error
  }

  async function saveConfig(updates) {
    const { error } = await supabase
      .from('lf_config')
      .upsert(
        { loja_id: lojaId, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'loja_id' }
      )
    if (!error) await fetchAll()
    return error
  }

  // Campos do cadastro completo (features.cadastro_completo_cliente). Só entram
  // no insert quando o formulário mandou algum deles — no Starter a tela nem os
  // exibe, e aí o insert continua exatamente como era antes.
  const CAMPOS_CADASTRO_COMPLETO = [
    'cpf_cnpj', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
  ]

  async function addCliente(dados) {
    const novo = {
      loja_id: lojaId,
      nome: dados.nome?.trim(),
      telefone: dados.telefone?.trim() || null,
      email: dados.email?.trim() || null,
      data_nascimento: dados.data_nascimento || null,
      observacoes: dados.observacoes?.trim() || null,
    }
    for (const campo of CAMPOS_CADASTRO_COMPLETO) {
      if (dados[campo] !== undefined) novo[campo] = dados[campo]?.trim() || null
    }
    const { data, error } = await supabase.from('lf_clientes').insert(novo).select().single()
    if (error) throw error
    setClientes(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    return data
  }

  async function updateCliente(id, dados) {
    const { data, error } = await supabase.from('lf_clientes').update(dados).eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setClientes(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function deleteCliente(id) {
    const { error } = await supabase.from('lf_clientes').delete().eq('id', id).eq('loja_id', lojaId)
    if (error) throw error
    setClientes(prev => prev.filter(c => c.id !== id))
  }

  async function addCrediario(dados) {
    const valorParcela = Number(dados.valor_total) / Number(dados.parcelas)
    const novo = {
      loja_id: lojaId,
      cliente_nome: dados.cliente_nome?.trim(),
      cliente_telefone: dados.cliente_telefone?.trim() || null,
      valor_total: Number(dados.valor_total),
      parcelas: Number(dados.parcelas),
      valor_parcela: valorParcela,
      data_compra: dados.data_compra || new Date().toISOString().slice(0, 10),
      parcelas_pagas: 0,
      status: 'aberto',
      observacoes: dados.observacoes?.trim() || null,
    }
    const { data, error } = await supabase.from('lf_crediario').insert(novo).select().single()
    if (error) throw error
    setCrediario(prev => [data, ...prev])
    return data
  }

  async function pagarParcela(id) {
    const item = crediario.find(c => c.id === id)
    if (!item) return
    const novasPagas = item.parcelas_pagas + 1
    const novoStatus = novasPagas >= item.parcelas ? 'quitado' : 'aberto'
    const { data, error } = await supabase.from('lf_crediario').update({ parcelas_pagas: novasPagas, status: novoStatus }).eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setCrediario(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function saveComissaoPercentual(percentual) {
    const { error } = await supabase.from('lf_config').update({ comissao_percentual: percentual }).eq('loja_id', lojaId)
    if (error) throw error
    setConfig(prev => ({ ...prev, comissao_percentual: percentual }))
  }

  async function updatePedido(id, updates) {
    const { data, error } = await supabase.from('lf_pedidos').update(updates).eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setPedidos(prev => prev.map(p => p.id === id ? data : p))
    return data
  }

  /**
   * Cancela um pedido do catálogo e devolve ao estoque o que já tinha sido
   * baixado.
   *
   * A baixa acontece na CRIAÇÃO do pedido (CatalogoPublico.jsx, via
   * lf_pedido_baixa_estoque), não no pagamento. Sem devolver no cancelamento,
   * a peça ficava reservada para sempre num pedido que não vai acontecer.
   *
   * O .neq('status', 'cancelado') faz a transição valer como trava: se o
   * pedido já estava cancelado nenhuma linha volta, e o estoque não é
   * devolvido duas vezes.
   */
  async function cancelarPedido(id) {
    const { data: pedido } = await supabase
      .from('lf_pedidos')
      .select('produtos')
      .eq('id', id)
      .eq('loja_id', lojaId)
      .maybeSingle()

    const { data, error } = await supabase
      .from('lf_pedidos')
      .update({ status: 'cancelado' })
      .eq('id', id)
      .eq('loja_id', lojaId)
      .neq('status', 'cancelado')
      .select()
      .maybeSingle()
    if (error) throw error
    // data nulo = nenhuma linha transitou (já estava cancelado, ou é de outra
    // loja).
    //
    // Este comentário avisava que ligar RLS em lf_pedidos poderia fazer o
    // select pós-update voltar vazio com o update tendo funcionado, pulando a
    // devolução de estoque em silêncio. A migration de RLS
    // (supabase/migration_rls_pedidos.sql) foi desenhada com isso em mente: a
    // lojista tem policy de SELECT *e* de UPDATE sobre os pedidos da própria
    // loja, então a linha atualizada continua visível para o select seguinte.
    // Se um dia a policy de SELECT for estreitada, esta função volta a ser um
    // dos pontos a reconferir.
    if (!data) return null

    // Só itens com variação foram baixados no checkout, e é exatamente esse
    // filtro que normalizarItensEstoque aplica — a devolução espelha a baixa.
    await aplicarEstoque(pedido?.produtos, {
      modo:       'restauro',
      tipo:       'devolucao',
      origemTipo: 'pedido',
      origemId:   id,
      motivo:     'Pedido cancelado',
    })

    setPedidos(prev => prev.map(p => p.id === id ? data : p))
    await fetchAll()
    return data
  }

  // Fornecedor saiu inteiro da experiência: primeiro o CRUD, junto com a tela
  // Fornecedores.jsx, e agora a leitura de lf_fornecedores, junto com o
  // dropdown do cadastro de produto — sem a tela de cadastro não havia como
  // popular a lista, e ela ficava presa em "Nenhum".
  // A tabela e as colunas em lf_produtos continuam no banco, intactas.

  async function addCompra(dados) {
    const novo = {
      loja_id: lojaId,
      fornecedor_id: dados.fornecedor_id,
      produto_id: dados.produto_id || null,
      descricao: dados.descricao?.trim() || null,
      valor: Number(dados.valor) || 0,
      data_compra: dados.data_compra || new Date().toISOString().slice(0, 10),
      data_vencimento: dados.data_vencimento || null,
      status_pgto: dados.status_pgto || 'pendente',
      observacoes: dados.observacoes?.trim() || null,
    }
    const { data, error } = await supabase.from('lf_compras').insert(novo).select().single()
    if (error) throw error
    setCompras(prev => [data, ...prev])
    return data
  }

  async function marcarCompraPaga(id) {
    const { data, error } = await supabase
      .from('lf_compras')
      .update({ status_pgto: 'pago', data_pagamento: new Date().toISOString().slice(0, 10) })
      .eq('id', id)
      .eq('loja_id', lojaId)
      .select()
      .single()
    if (error) throw error
    setCompras(prev => prev.map(c => c.id === id ? data : c))
    return data
  }

  async function deleteCompra(id) {
    const { error } = await supabase.from('lf_compras').delete().eq('id', id).eq('loja_id', lojaId)
    if (error) throw error
    setCompras(prev => prev.filter(c => c.id !== id))
  }

  async function addLembrete(dados) {
    const novo = {
      loja_id: lojaId,
      cliente_nome: (dados.cliente_nome || '').trim(),
      nota: (dados.nota || '').trim() || null,
      data_lembrete: dados.data_lembrete,
      concluido: false,
    }
    const { data, error } = await supabase.from('lf_lembretes').insert(novo).select().single()
    if (error) throw error
    setLembretes(prev => [...prev, data].sort((a, b) => a.data_lembrete.localeCompare(b.data_lembrete)))
    return data
  }

  async function concluirLembrete(id) {
    const { data, error } = await supabase
      .from('lf_lembretes').update({ concluido: true })
      .eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setLembretes(prev => prev.map(l => l.id === id ? data : l))
    return data
  }

  async function deleteLembrete(id) {
    const { error } = await supabase.from('lf_lembretes').delete().eq('id', id).eq('loja_id', lojaId)
    if (error) throw error
    setLembretes(prev => prev.filter(l => l.id !== id))
  }

  async function dispensarFollowup(clienteNome, tipo, dataReferencia) {
    const { data, error } = await supabase.from('lf_followup_dispensado').insert({
      loja_id: lojaId,
      cliente_nome: clienteNome,
      tipo,
      data_referencia: dataReferencia,
    }).select().single()
    if (error) {
      if (error.code === '23505') return
      throw error
    }
    if (data) setDispensados(prev => [...prev, data])
  }

  const features = { ...DEFAULT_FEATURES, ...(config?.features || {}) }

  /**
   * Apaga um pedido do catálogo, de vez — devolvendo o estoque antes.
   *
   * ─── POR QUE DEVOLVE ────────────────────────────────────────────────────
   * A baixa acontece na CRIAÇÃO do pedido (lf_pedido_baixa_estoque), não no
   * pagamento. A primeira versão desta função só apagava a linha, e quem
   * excluísse um pedido sem cancelar antes deixava a peça reservada num
   * pedido que não existe mais: furo de estoque silencioso.
   *
   * Agora a devolução é a MESMA de cancelarPedido — aplicarEstoque em modo
   * 'restauro'. Nada de lógica paralela: um caminho só para devolver peça.
   *
   * ─── QUANDO NÃO DEVOLVE ─────────────────────────────────────────────────
   * Pedido já cancelado teve o estoque devolvido no cancelamento. Devolver de
   * novo duplicaria peças — o erro oposto, igualmente caro. Quem decide é
   * precisaDevolverEstoque(status), em utils/estoqueMov.js.
   *
   * ─── A ORDEM IMPORTA ────────────────────────────────────────────────────
   * Devolve PRIMEIRO, apaga depois. Se a devolução falhar, o DELETE não
   * acontece e o pedido continua lá — é sempre melhor um pedido a mais na
   * lista do que uma peça a menos no estoque.
   *
   * E se a devolução der certo mas o DELETE falhar, o estoque ficaria inflado
   * com o pedido ainda vivo. Esse caso é compensado: refaz a baixa e avisa.
   *
   * Serve para pedido de teste e pedido duplicado, que hoje ficam para sempre
   * poluindo a lista e as somas.
   *
   * ─── POR QUE CONFERIR A CONTAGEM ────────────────────────────────────────
   * No PostgREST, um DELETE que não casa NENHUMA linha é 204 SEM ERRO. Como
   * lf_pedidos filtra por RLS, isso acontece em dois casos reais: a migration
   * de permissão ainda não rodou, ou a sessão expirou. Sem a contagem, a tela
   * diria "pedido excluído" com a linha intacta no banco — exatamente o tipo
   * de falha silenciosa que já mordeu o salvamento de credenciais aqui.
   *
   * `count` null é tratado como DESCONHECIDO, nunca como falha: se um dia o
   * header não vier, o comportamento degrada para o de sempre em vez de
   * acusar erro numa exclusão que funcionou.
   */
  async function excluirPedido(id) {
    // ── 1. Lê o pedido ANTES de apagar ────────────────────────────────────
    // Depois do DELETE não há mais de onde tirar os itens nem o status.
    const { data: pedido, error: erroLeitura } = await supabase
      .from('lf_pedidos')
      .select('status, produtos')
      .eq('id', id)
      .eq('loja_id', lojaId)
      .maybeSingle()

    if (erroLeitura) throw erroLeitura
    if (!pedido) {
      throw new Error(
        'Pedido não encontrado. Ele pode já ter sido excluído — atualize a '
        + 'lista. Nada foi alterado.',
      )
    }

    // ── 2. Devolve o estoque, se ainda não foi devolvido ──────────────────
    const devolveu = precisaDevolverEstoque(pedido.status)
    if (devolveu) {
      const falhas = await aplicarEstoque(pedido.produtos, {
        modo:       'restauro',
        tipo:       'devolucao',
        origemTipo: 'pedido',
        origemId:   id,
        motivo:     'Pedido excluído',
      })
      // Aborta ANTES do DELETE: apagar o pedido sem ter devolvido as peças é
      // exatamente o furo que esta função existe para não abrir.
      if (falhas.length > 0) {
        throw new Error(
          'Não foi possível devolver ao estoque: '
          + falhas.map(f => f.nome).join(', ')
          + '. O pedido NÃO foi excluído — nada foi alterado.',
        )
      }
    }

    // ── 3. Só então apaga ─────────────────────────────────────────────────
    const { error, count } = await supabase
      .from('lf_pedidos')
      .delete({ count: 'exact' })
      .eq('id', id)
      .eq('loja_id', lojaId)

    // O DELETE falhou DEPOIS de a devolução ter passado: o pedido continua
    // vivo e o estoque já subiu. Refaz a baixa para o banco voltar ao estado
    // anterior — sem isso, tentar excluir de novo somaria peça a cada
    // tentativa.
    const falhouDelete = !!error || count === 0
    if (falhouDelete && devolveu) {
      await aplicarEstoque(pedido.produtos, {
        modo:       'baixa',
        tipo:       'venda',
        origemTipo: 'pedido',
        origemId:   id,
        motivo:     'Exclusão desfeita — estoque devolvido à reserva',
      })
    }

    if (error) throw error
    if (count === 0) {
      throw new Error(
        'O banco não apagou nenhum pedido. Normalmente é permissão que ainda '
        + 'não foi liberada, ou sessão expirada — saia, entre de novo e tente. '
        + 'Nada foi alterado.',
      )
    }

    setPedidos(prev => prev.filter(p => p.id !== id))
    await fetchAll()
    return true
  }

  return {
    loading,
    dbError,
    vendas,
    caixas,
    metas,
    metasVendedora,
    metaProduto,
    corridas,
    produtos,
    produtosData,
    config,
    features,
    LOJA_ID: lojaId,
    DEFAULT_FEATURES,
    fetchAll,
    ensureDefaults,
    addVenda,
    deleteVenda,
    updateVenda,
    fecharCaixa,
    deleteCaixa,
    salvarMeta,
    salvarMetaVendedora,
    salvarMetaProduto,
    salvarCorrida,
    excluirCorrida,
    addProduto,
    updateProduto,
    removeProduto,
    updateVariacoes,
    importarProdutos,
    saveConfig,
    clientes,
    addCliente,
    updateCliente,
    deleteCliente,
    lembretes,
    dispensados,
    addLembrete,
    concluirLembrete,
    deleteLembrete,
    dispensarFollowup,
    crediario,
    addCrediario,
    pagarParcela,
    saveComissaoPercentual,
    pedidos,
    updatePedido,
    cancelarPedido,
    excluirPedido,
    compras,
    addCompra,
    marcarCompraPaga,
    deleteCompra,
  }
}
