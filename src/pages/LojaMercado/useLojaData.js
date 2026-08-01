import { useState, useEffect, useCallback } from 'react'
import { useLojaData as useLojaDataBase } from '../LojaFeminina/useLojaData'
import { supabase } from '../../lib/supabase'

/** Data de hoje em 'YYYY-MM-DD', montada à mão — toISOString() muda o dia. */
function hojeISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useLojaData(lojaId) {
  const base = useLojaDataBase(lojaId)

  // ── Fiado (merc_fiado) ──────────────────────────────────────
  // Conta corrente: 'compra' aumenta o saldo devedor, 'pagamento' abate.
  // O saldo nunca é gravado — é derivado por soma em utils/fiado.js.
  const [fiado, setFiado] = useState([])
  const [fiadoLoading, setFiadoLoading] = useState(true)

  const fetchFiado = useCallback(async () => {
    if (!lojaId) return
    const { data, error } = await supabase
      .from('merc_fiado').select('*').eq('loja_id', lojaId)
      .order('data', { ascending: false })
    if (!error) setFiado(data || [])
    setFiadoLoading(false)
  }, [lojaId])

  useEffect(() => { fetchFiado() }, [fetchFiado])

  /** Insere um lançamento. cliente_id é opcional — aceita nome livre. */
  async function addFiadoLancamento({ tipo, cliente_nome, cliente_id = null, valor, descricao = null }) {
    const nome = String(cliente_nome || '').trim()
    if (!nome) return { error: { message: 'Informe o nome do cliente.' } }
    const v = Number(valor)
    if (!Number.isFinite(v) || v <= 0) return { error: { message: 'Informe um valor válido.' } }

    const { error } = await supabase.from('merc_fiado').insert({
      loja_id:      lojaId,
      cliente_id:   cliente_id || null,
      cliente_nome: nome,
      tipo,
      valor:        v,
      descricao:    descricao?.trim() || null,
      data:         hojeISO(),
    })
    if (!error) await fetchFiado()
    return { error }
  }

  const addFiadoCompra    = args => addFiadoLancamento({ ...args, tipo: 'compra' })
  const addFiadoPagamento = args => addFiadoLancamento({ ...args, tipo: 'pagamento' })

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

  return {
    ...base,
    addProduto,
    buscarPorEan,
    fiado,
    fiadoLoading,
    fetchFiado,
    addFiadoCompra,
    addFiadoPagamento,
  }
}
