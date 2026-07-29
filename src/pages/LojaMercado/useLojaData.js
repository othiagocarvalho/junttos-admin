import { useLojaData as useLojaDataBase } from '../LojaFeminina/useLojaData'
import { supabase } from '../../lib/supabase'

export function useLojaData(lojaId) {
  const base = useLojaDataBase(lojaId)

  // Override: inserts ean column + returns { error } instead of bare error
  async function addProduto(nome, extras = {}) {
    const { error } = await supabase.from('lf_produtos').insert({
      loja_id:        lojaId,
      nome,
      ean:            extras.ean            || null,
      preco_custo:    extras.preco_custo    || 0,
      preco_venda:    extras.preco_venda    || 0,
      variacoes:      extras.variacoes      || [],
      fornecedor:     extras.fornecedor     || null,
      referencia:     extras.referencia     || null,
      fotos:          extras.fotos          || [],
      disponivel_catalogo_b2b: extras.disponivel_catalogo_b2b ?? false,
    })
    if (!error) await base.fetchAll()
    return { error }
  }

  async function buscarPorEan(ean) {
    if (!ean?.trim() || !lojaId) return null
    const { data } = await supabase
      .from('lf_produtos')
      .select('id, nome, preco_venda, variacoes, ean')
      .eq('loja_id', lojaId)
      .eq('ean', ean.trim())
      .eq('ativo', true)
      .maybeSingle()
    return data || null
  }

  return { ...base, addProduto, buscarPorEan }
}
