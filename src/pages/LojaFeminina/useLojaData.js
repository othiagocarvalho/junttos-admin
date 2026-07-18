import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { decrementarVariacoes, restaurarVariacoes } from '../../utils/venda'

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
  const [fornecedores, setFornecedores] = useState([])
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
        const { data: fornData } = await supabase.from('lf_fornecedores').select('*').eq('loja_id', lojaId).order('nome')
        setFornecedores(fornData || [])
      } catch (_e) {
        setFornecedores([])
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
    const { error } = await supabase.from('lf_produtos').insert(rows)
    if (!error) await fetchAll()
    return error
  }

  async function addVenda(venda) {
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
      const itensDevolvidos = (produto_devolvido || []).filter(p => p.variacao)
      if (itensDevolvidos.length > 0) {
        const nomesDevolvidos = [...new Set(itensDevolvidos.map(i => i.nome))]
        for (const nomeProd of nomesDevolvidos) {
          const itensProd = itensDevolvidos.filter(i => i.nome === nomeProd)
          const { data: prod } = await supabase
            .from('lf_produtos').select('id, variacoes')
            .eq('loja_id', lojaId).eq('nome', nomeProd).maybeSingle()
          if (prod) {
            const novasVariacoes = restaurarVariacoes(prod.variacoes, itensProd)
            await supabase.from('lf_produtos').update({ variacoes: novasVariacoes })
              .eq('id', prod.id).eq('loja_id', lojaId)
          }
        }
      }
      const itensComVariacao = (venda.produtos || []).filter(p => p.variacao)
      if (itensComVariacao.length > 0) {
        const nomesProd = [...new Set(itensComVariacao.map(i => i.nome))]
        for (const nomeProd of nomesProd) {
          const itensProd = itensComVariacao.filter(i => i.nome === nomeProd)
          const { data: prod } = await supabase
            .from('lf_produtos')
            .select('id, variacoes')
            .eq('loja_id', lojaId)
            .eq('nome', nomeProd)
            .maybeSingle()
          if (prod) {
            const novasVariacoes = decrementarVariacoes(prod.variacoes, itensProd)
            await supabase
              .from('lf_produtos')
              .update({ variacoes: novasVariacoes })
              .eq('id', prod.id)
              .eq('loja_id', lojaId)
          }
        }
      }
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
      const itensComVariacao = (venda?.produtos || []).filter(p => p.variacao)
      if (itensComVariacao.length > 0) {
        const nomesProd = [...new Set(itensComVariacao.map(i => i.nome))]
        for (const nomeProd of nomesProd) {
          const itensProd = itensComVariacao.filter(i => i.nome === nomeProd)
          const { data: prod } = await supabase
            .from('lf_produtos')
            .select('id, variacoes')
            .eq('loja_id', lojaId)
            .eq('nome', nomeProd)
            .maybeSingle()
          if (prod) {
            const novasVariacoes = restaurarVariacoes(prod.variacoes, itensProd)
            await supabase
              .from('lf_produtos')
              .update({ variacoes: novasVariacoes })
              .eq('id', prod.id)
              .eq('loja_id', lojaId)
          }
        }
      }
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
    const { error } = await supabase.from('lf_produtos').insert({
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
    })
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

  async function updateVariacoes(id, variacoes) {
    const { error } = await supabase
      .from('lf_produtos')
      .update({ variacoes })
      .eq('id', id)
      .eq('loja_id', lojaId)
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

  async function addCliente(dados) {
    const novo = {
      loja_id: lojaId,
      nome: dados.nome?.trim(),
      telefone: dados.telefone?.trim() || null,
      email: dados.email?.trim() || null,
      data_nascimento: dados.data_nascimento || null,
      observacoes: dados.observacoes?.trim() || null,
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

  async function addFornecedor(dados) {
    const novo = {
      loja_id: lojaId,
      nome: dados.nome?.trim(),
      contato: dados.contato?.trim() || null,
      documento: dados.documento?.trim() || null,
      prazo_pagamento_dias: dados.prazo_pagamento_dias ? Number(dados.prazo_pagamento_dias) : null,
      observacoes: dados.observacoes?.trim() || null,
      ativo: true,
    }
    const { data, error } = await supabase.from('lf_fornecedores').insert(novo).select().single()
    if (error) throw error
    setFornecedores(prev => [...prev, data].sort((a, b) => a.nome.localeCompare(b.nome)))
    return data
  }

  async function updateFornecedor(id, dados) {
    const { data, error } = await supabase.from('lf_fornecedores').update(dados).eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setFornecedores(prev => prev.map(f => f.id === id ? data : f).sort((a, b) => a.nome.localeCompare(b.nome)))
    return data
  }

  async function removeFornecedor(id) {
    const { data, error } = await supabase.from('lf_fornecedores').update({ ativo: false }).eq('id', id).eq('loja_id', lojaId).select().single()
    if (error) throw error
    setFornecedores(prev => prev.map(f => f.id === id ? data : f))
    return data
  }

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
    fornecedores,
    addFornecedor,
    updateFornecedor,
    removeFornecedor,
    compras,
    addCompra,
    marcarCompraPaga,
    deleteCompra,
  }
}
