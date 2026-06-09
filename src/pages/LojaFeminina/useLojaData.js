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
  const [vendas, setVendas] = useState([])
  const [caixas, setCaixas] = useState([])
  const [metas, setMetas] = useState({})
  const [produtos, setProdutos] = useState([])
  const [estoque, setEstoque]   = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [vendasRes, caixasRes, metasRes, produtosRes, configRes, estoqueRes] = await Promise.all([
        supabase.from('lf_vendas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_caixas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
        supabase.from('lf_metas').select('*').eq('loja_id', lojaId),
        supabase.from('lf_produtos').select('*').eq('loja_id', lojaId).eq('ativo', true).order('nome'),
        supabase.from('lf_config').select('*').eq('loja_id', lojaId).maybeSingle(),
        supabase.from('lf_estoque').select('*').eq('loja_id', lojaId).order('produto').order('cor'),
      ])

      if (vendasRes.error) throw vendasRes.error
      if (caixasRes.error) throw caixasRes.error
      if (metasRes.error) throw metasRes.error
      if (produtosRes.error) throw produtosRes.error

      setVendas(vendasRes.data || [])
      setCaixas(caixasRes.data || [])

      const metasMap = {}
      ;(metasRes.data || []).forEach(m => { metasMap[m.mes] = m.valor })
      setMetas(metasMap)

      setProdutos((produtosRes.data || []).map(p => p.nome))
      setEstoque(estoqueRes.data || [])
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
        }))
      )
      await fetchAll()
    }
  }

  async function addVenda(venda) {
    const { error } = await supabase.from('lf_vendas').insert({ ...venda, loja_id: lojaId })
    if (!error) await fetchAll()
    return error
  }

  async function deleteVenda(id) {
    const { error } = await supabase.from('lf_vendas').delete().eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  async function updateVenda(id, updates) {
    const { error } = await supabase.from('lf_vendas').update(updates).eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  async function fecharCaixa(caixa) {
    const { error } = await supabase.from('lf_caixas').insert({ ...caixa, loja_id: lojaId })
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

  async function addProduto(nome) {
    const { error } = await supabase.from('lf_produtos').insert({ loja_id: lojaId, nome })
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

  async function addEstoqueItem(item) {
    const { error } = await supabase.from('lf_estoque').insert({ ...item, loja_id: lojaId })
    if (!error) await fetchAll()
    return error
  }

  async function updateEstoqueItem(id, updates) {
    const { error } = await supabase.from('lf_estoque').update(updates).eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  async function deleteEstoqueItem(id) {
    const { error } = await supabase.from('lf_estoque').delete().eq('id', id)
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
    updateVenda,
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
