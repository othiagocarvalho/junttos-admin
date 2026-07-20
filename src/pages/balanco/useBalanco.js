import { supabase } from '../../lib/supabase'
import { getVarLabel } from '../../utils/balanco'

export function useBalanco() {

  async function buscarLojas() {
    const { data, error } = await supabase
      .from('lf_config')
      .select('loja_id, nome')
      .order('nome')
    return { data: data || [], error }
  }

  async function buscarProduto(query, lojaId) {
    if (!query.trim() || !lojaId) return []
    const { data } = await supabase
      .from('lf_produtos')
      .select('id, nome, variacoes, referencia')
      .eq('loja_id', lojaId)
      .eq('ativo', true)
      .or(`nome.ilike.%${query}%,referencia.ilike.%${query}%`)
      .limit(8)
    return data || []
  }

  async function criarSessao(dados) {
    const { data, error } = await supabase
      .from('bal_sessoes')
      .insert(dados)
      .select()
      .single()
    return { data, error }
  }

  async function criarSubcontagens(sessaoId, subs) {
    const rows = subs.map((s, i) => ({
      sessao_id: sessaoId,
      nome: s.nome,
      responsavel: s.responsavel || null,
      rodada: 1,
      sequencia: i + 1,
      status: 'pendente',
    }))
    const { data, error } = await supabase
      .from('bal_subcontagens')
      .insert(rows)
      .select()
      .order('sequencia')
    return { data: data || [], error }
  }

  async function iniciarSubcontagem(id) {
    const { error } = await supabase
      .from('bal_subcontagens')
      .update({ status: 'em_andamento' })
      .eq('id', id)
    return error
  }

  async function addItem(subcontagemId, item) {
    // Upsert: increment if same product+variacao already counted in this sub-count
    let matchQuery = supabase
      .from('bal_itens_contados')
      .select('id, quantidade')
      .eq('subcontagem_id', subcontagemId)

    if (item.produto_id) {
      matchQuery = matchQuery.eq('produto_id', item.produto_id)
      matchQuery = item.variacao_label
        ? matchQuery.eq('variacao_label', item.variacao_label)
        : matchQuery.is('variacao_label', null)
    } else {
      matchQuery = matchQuery.is('produto_id', null).eq('produto_nome', item.produto_nome)
    }

    const { data: existing } = await matchQuery.maybeSingle()

    if (existing) {
      const novaQtd = Number(existing.quantidade) + Number(item.quantidade)
      await supabase
        .from('bal_itens_contados')
        .update({ quantidade: novaQtd })
        .eq('id', existing.id)
      return { id: existing.id, subcontagem_id: subcontagemId, ...item, quantidade: novaQtd }
    }

    const { data, error } = await supabase
      .from('bal_itens_contados')
      .insert({ subcontagem_id: subcontagemId, ...item })
      .select()
      .single()
    if (error) return { subcontagem_id: subcontagemId, ...item }
    return data
  }

  async function carregarItensDaSubcontagem(subcontagemId) {
    const { data } = await supabase
      .from('bal_itens_contados')
      .select('*')
      .eq('subcontagem_id', subcontagemId)
      .order('created_at', { ascending: false })
    return data || []
  }

  async function carregarTodosItens(sessaoId) {
    const { data: subs } = await supabase
      .from('bal_subcontagens')
      .select('id')
      .eq('sessao_id', sessaoId)
    if (!subs || subs.length === 0) return []
    const { data } = await supabase
      .from('bal_itens_contados')
      .select('*')
      .in('subcontagem_id', subs.map(s => s.id))
    return data || []
  }

  async function finalizarSubcontagem(id) {
    const { error } = await supabase
      .from('bal_subcontagens')
      .update({ status: 'concluida' })
      .eq('id', id)
    return error
  }

  async function criarDesempate(sessaoId, rodada) {
    const { data, error } = await supabase
      .from('bal_subcontagens')
      .insert({
        sessao_id: sessaoId,
        nome: `Desempate — Rodada ${rodada}`,
        responsavel: null,
        rodada,
        sequencia: 1,
        status: 'pendente',
      })
      .select()
      .single()
    return { data, error }
  }

  async function aplicarAjustes(sessaoId, ajustes, aplicadoPor) {
    if (ajustes.length === 0) return null

    const ajusteRows = ajustes.map(a => ({
      sessao_id: sessaoId,
      produto_id: a.produto_id,
      variacao_label: a.variacao_label,
      qtd_anterior: a.qtd_anterior,
      qtd_nova: a.qtd_nova,
      aplicado_por: aplicadoPor,
      aplicado_em: new Date().toISOString(),
    }))
    const { error: errAjuste } = await supabase.from('bal_ajustes').insert(ajusteRows)
    if (errAjuste) return errAjuste

    for (const a of ajustes) {
      const { data: prod } = await supabase
        .from('lf_produtos')
        .select('variacoes')
        .eq('id', a.produto_id)
        .maybeSingle()
      if (!prod) continue

      const novasVariacoes = (prod.variacoes || []).map(v => {
        const label = getVarLabel(v)
        if (a.variacao_label && label !== a.variacao_label) return v
        return { ...v, quantidade: a.qtd_nova }
      })

      await supabase
        .from('lf_produtos')
        .update({ variacoes: novasVariacoes })
        .eq('id', a.produto_id)
    }
    return null
  }

  async function fecharSessao(id) {
    const { error } = await supabase
      .from('bal_sessoes')
      .update({ status: 'concluida' })
      .eq('id', id)
    return error
  }

  return {
    buscarLojas,
    buscarProduto,
    criarSessao,
    criarSubcontagens,
    iniciarSubcontagem,
    addItem,
    carregarItensDaSubcontagem,
    carregarTodosItens,
    finalizarSubcontagem,
    criarDesempate,
    aplicarAjustes,
    fecharSessao,
  }
}
