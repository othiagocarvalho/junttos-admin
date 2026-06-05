import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

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
  const [vendas,   setVendas]   = useState([])
  const [caixas,   setCaixas]   = useState([])
  const [metas,    setMetas]    = useState({})
  const [produtos, setProdutos] = useState([])   // string[] — nomes para o form de venda
  const [estoque,  setEstoque]  = useState([])   // object[] — registros completos para EstoquePage
  const [config,   setConfig]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [dbError,  setDbError]  = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [vendasRes, caixasRes, metasRes, produtosRes, configRes] = await Promise.all([
        supabase.from('lf_vendas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_caixas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_metas').select('*').eq('loja_id', lojaId),
        supabase.from('lf_produtos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
        supabase.from('lf_config').select('*').eq('loja_id', lojaId).maybeSingle(),
      ])

      if (vendasRes.error)   throw vendasRes.error
      if (caixasRes.error)   throw caixasRes.error
      if (metasRes.error)    throw metasRes.error
      if (produtosRes.error) throw produtosRes.error

      setVendas(vendasRes.data || [])
      setCaixas(caixasRes.data || [])

      const metasMap = {}
      ;(metasRes.data || []).forEach(m => { metasMap[m.mes] = m.valor })
      setMetas(metasMap)

      const prods = produtosRes.data || []
      setProdutos(prods.map(p => p.nome))   // nomes para o formulário de venda
      setEstoque(prods)                      // objetos completos para EstoquePage

      setConfig(configRes.data || null)
      setDbError(null)
    } catch (e) {
      setDbError(e.message)
    } finally {
      setLoading(false)
    }
  }, [lojaId])

  useEffect(() => { fetchAll() }, [fetchAll])

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

    const { data: prods } = await supabase
      .from('lf_produtos')
      .select('id')
      .eq('loja_id', lojaId)
      .limit(1)

    if (!prods || prods.length === 0) {
      await supabase.from('lf_produtos').insert(
        ['Vestido', 'Cropped', 'Blusa', 'Saia', 'Short', 'Calça', 'Conjunto'].map(nome => ({
          loja_id: lojaId,
          nome,
          quantidade: 0,
          preco_custo: 0,
          preco_venda: 0,
        }))
      )
      await fetchAll()
    }
  }

  // ── Vendas ────────────────────────────────────────────────────
  async function addVenda(venda) {
    const { error } = await supabase.from('lf_vendas').insert({ ...venda, loja_id: lojaId })
    if (!error) {
      // Desconta automaticamente o estoque de cada produto vendido
      for (const prod of (venda.produtos || [])) {
        const { data: item } = await supabase
          .from('lf_produtos')
          .select('id, quantidade')
          .eq('loja_id', lojaId)
          .eq('nome', prod.nome)
          .eq('ativo', true)
          .maybeSingle()
        if (item && Number(item.quantidade) > 0) {
          await supabase
            .from('lf_produtos')
            .update({ quantidade: Number(item.quantidade) - 1 })
            .eq('id', item.id)
        }
      }
      await fetchAll()
    }
    return error
  }

  async function deleteVenda(id) {
    const { error } = await supabase.from('lf_vendas').delete().eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  // ── Caixas ────────────────────────────────────────────────────
  async function fecharCaixa(caixa) {
    const { error } = await supabase.from('lf_caixas').insert({ ...caixa, loja_id: lojaId })
    if (!error) await fetchAll()
    return error
  }

  // ── Metas ─────────────────────────────────────────────────────
  async function salvarMeta(mes, valor) {
    const { error } = await supabase
      .from('lf_metas')
      .upsert({ loja_id: lojaId, mes, valor }, { onConflict: 'loja_id,mes' })
    if (!error) await fetchAll()
    return error
  }

  // ── Produtos (catálogo de nomes para venda) ───────────────────
  async function addProduto(nome) {
    const { error } = await supabase.from('lf_produtos').insert({ loja_id: lojaId, nome, quantidade: 0, preco_custo: 0, preco_venda: 0 })
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

  // ── Estoque CRUD ──────────────────────────────────────────────
  async function addEstoqueItem(item) {
    const { error } = await supabase.from('lf_produtos').insert({ ...item, loja_id: lojaId, ativo: true })
    if (!error) await fetchAll()
    return error
  }

  async function updateEstoqueItem(id, updates) {
    const { error } = await supabase.from('lf_produtos').update(updates).eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  async function deleteEstoqueItem(id) {
    const { error } = await supabase.from('lf_produtos').update({ ativo: false }).eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  // ── Config ────────────────────────────────────────────────────
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

  const features = { ...DEFAULT_FEATURES, ...(config?.features || {}) }

  return {
    loading,
    dbError,
    vendas,
    caixas,
    metas,
    produtos,
    estoque,
    config,
    features,
    LOJA_ID: lojaId,
    DEFAULT_FEATURES,
    fetchAll,
    ensureDefaults,
    addVenda,
    deleteVenda,
    fecharCaixa,
    salvarMeta,
    addProduto,
    removeProduto,
    addEstoqueItem,
    updateEstoqueItem,
    deleteEstoqueItem,
    saveConfig,
  }
}
