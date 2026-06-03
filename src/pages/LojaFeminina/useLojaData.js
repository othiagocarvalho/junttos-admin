import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const LOJA_ID = 'estrada'

const DEFAULT_FEATURES = {
  vendas: true,
  historico: true,
  metas: true,
  fechamento_caixa: true,
  relatorios: true,
  clientes: false,
  estoque: false,
}

export function useLojaData() {
  const [vendas, setVendas] = useState([])
  const [caixas, setCaixas] = useState([])
  const [metas, setMetas] = useState({})
  const [produtos, setProdutos] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [dbError, setDbError] = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [vendasRes, caixasRes, metasRes, produtosRes, configRes] = await Promise.all([
        supabase.from('lf_vendas').select('*').eq('loja_id', LOJA_ID).order('data', { ascending: false }),
        supabase.from('lf_caixas').select('*').eq('loja_id', LOJA_ID).order('data', { ascending: false }),
        supabase.from('lf_metas').select('*').eq('loja_id', LOJA_ID),
        supabase.from('lf_produtos').select('*').eq('loja_id', LOJA_ID).eq('ativo', true).order('nome'),
        supabase.from('lf_config').select('*').eq('loja_id', LOJA_ID).maybeSingle(),
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
      setConfig(configRes.data || null)
      setDbError(null)
    } catch (e) {
      setDbError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function ensureDefaults() {
    const { data: cfg } = await supabase
      .from('lf_config')
      .select('id')
      .eq('loja_id', LOJA_ID)
      .maybeSingle()

    if (!cfg) {
      await supabase.from('lf_config').insert({
        loja_id: LOJA_ID,
        nome: 'Estrada',
        features: DEFAULT_FEATURES,
      })
    }

    const { data: prods } = await supabase
      .from('lf_produtos')
      .select('id')
      .eq('loja_id', LOJA_ID)
      .limit(1)

    if (!prods || prods.length === 0) {
      await supabase.from('lf_produtos').insert(
        ['Vestido', 'Cropped', 'Blusa', 'Saia', 'Short', 'Calça', 'Conjunto'].map(nome => ({
          loja_id: LOJA_ID,
          nome,
        }))
      )
      await fetchAll()
    }
  }

  async function addVenda(venda) {
    const { error } = await supabase.from('lf_vendas').insert({ ...venda, loja_id: LOJA_ID })
    if (!error) await fetchAll()
    return error
  }

  async function deleteVenda(id) {
    const { error } = await supabase.from('lf_vendas').delete().eq('id', id)
    if (!error) await fetchAll()
    return error
  }

  async function fecharCaixa(caixa) {
    const { error } = await supabase.from('lf_caixas').insert({ ...caixa, loja_id: LOJA_ID })
    if (!error) await fetchAll()
    return error
  }

  async function salvarMeta(mes, valor) {
    const { error } = await supabase
      .from('lf_metas')
      .upsert({ loja_id: LOJA_ID, mes, valor }, { onConflict: 'loja_id,mes' })
    if (!error) await fetchAll()
    return error
  }

  async function addProduto(nome) {
    const { error } = await supabase.from('lf_produtos').insert({ loja_id: LOJA_ID, nome })
    if (!error) await fetchAll()
    return error
  }

  async function removeProduto(nome) {
    const { error } = await supabase
      .from('lf_produtos')
      .update({ ativo: false })
      .eq('loja_id', LOJA_ID)
      .eq('nome', nome)
    if (!error) await fetchAll()
    return error
  }

  async function saveConfig(updates) {
    const { error } = await supabase
      .from('lf_config')
      .upsert(
        { loja_id: LOJA_ID, ...updates, updated_at: new Date().toISOString() },
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
    config,
    features,
    LOJA_ID,
    DEFAULT_FEATURES,
    fetchAll,
    ensureDefaults,
    addVenda,
    deleteVenda,
    fecharCaixa,
    salvarMeta,
    addProduto,
    removeProduto,
    saveConfig,
  }
}
