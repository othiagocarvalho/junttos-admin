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

  // ── Saídas de caixa (merc_saidas) e contas a pagar ──────────
  // Uma linha por saída. lf_caixas.despesas continua sendo o total agregado
  // gravado no fechamento; as linhas individuais ficam como histórico.
  const [saidas, setSaidas] = useState([])
  const [contas, setContas] = useState([])

  const fetchCaixaExtras = useCallback(async () => {
    if (!lojaId) return
    const [sd, ct] = await Promise.all([
      supabase.from('merc_saidas').select('*').eq('loja_id', lojaId).order('data', { ascending: false }),
      supabase.from('lf_contas_pagar').select('*').eq('loja_id', lojaId).order('data_vencimento'),
    ])
    if (!sd.error) setSaidas(sd.data || [])
    if (!ct.error) setContas(ct.data || [])
  }, [lojaId])

  useEffect(() => { fetchCaixaExtras() }, [fetchCaixaExtras])

  // ── Preços por faixa (merc_precos_faixas) — atacarejo ───────
  const [precosFaixas, setPrecosFaixas] = useState([])

  const fetchPrecosFaixas = useCallback(async () => {
    if (!lojaId) return
    const { data, error } = await supabase
      .from('merc_precos_faixas').select('*').eq('loja_id', lojaId)
    if (!error) setPrecosFaixas(data || [])
  }, [lojaId])

  useEffect(() => { fetchPrecosFaixas() }, [fetchPrecosFaixas])

  /** Grava as faixas de um produto recém-cadastrado. */
  async function addPrecosFaixas(produtoId, faixas) {
    const linhas = (faixas || [])
      .filter(f => Number(f.qtd_minima) > 0 && Number(f.preco_faixa) > 0)
      .map(f => ({
        loja_id:     lojaId,
        produto_id:  produtoId,
        qtd_minima:  Number(f.qtd_minima),
        preco_faixa: Number(f.preco_faixa),
      }))
    if (!linhas.length) return { error: null }
    const { error } = await supabase.from('merc_precos_faixas').insert(linhas)
    if (!error) await fetchPrecosFaixas()
    return { error }
  }

  async function addSaida({ valor, descricao = null, categoria = 'outro' }) {
    const v = Number(valor)
    if (!Number.isFinite(v) || v <= 0) return { error: { message: 'Informe um valor válido.' } }
    const { error } = await supabase.from('merc_saidas').insert({
      loja_id:   lojaId,
      valor:     v,
      descricao: descricao?.trim() || null,
      categoria,
      data:      hojeISO(),
    })
    if (!error) await fetchCaixaExtras()
    return { error }
  }

  // Override: inserts ean column + returns { error, produto } instead of bare error
  async function addProduto(nome, extras = {}) {
    const { data, error } = await supabase.from('lf_produtos').insert({
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
    }).select().single()
    if (!error) await base.fetchAll()
    return { error, produto: data || null }
  }

  /**
   * Importação em lote do Mercado.
   *
   * Override do importarProdutos do hook base, que não mapeia `ean` nem
   * `data_vencimento` — os dois campos que a planilha do Mercado traz. Feito
   * aqui em vez de alterar o hook da Moda, pelo mesmo motivo do addProduto.
   *
   * Difere do base também no retorno: em vez de um erro único, devolve
   * { inseridos, erros[] } para a tela poder dizer o que falhou em cada linha.
   * Linhas com problema são puladas — o resto é importado do mesmo jeito.
   */
  async function importarProdutos(lista) {
    const comEan = (lista || []).map(p => p.ean).filter(Boolean)

    // EANs que já existem na loja: importar de novo criaria produto duplicado
    let jaCadastrados = new Set()
    if (comEan.length) {
      const { data } = await supabase
        .from('lf_produtos').select('ean').eq('loja_id', lojaId).in('ean', comEan)
      jaCadastrados = new Set((data || []).map(r => r.ean))
    }

    const vistos  = new Set()
    const validos = []
    const erros   = []

    for (const p of (lista || [])) {
      const ref = { linha: p.linha, nome: p.nome }
      if (!p.nome)                              { erros.push({ ...ref, motivo: 'sem nome' }); continue }
      if (p.ean && vistos.has(p.ean))           { erros.push({ ...ref, motivo: 'EAN repetido na planilha' }); continue }
      if (p.ean && jaCadastrados.has(p.ean))    { erros.push({ ...ref, motivo: 'EAN já cadastrado na loja' }); continue }
      if (p.ean) vistos.add(p.ean)

      validos.push({
        loja_id:         lojaId,
        nome:            p.nome,
        ean:             p.ean || null,
        preco_custo:     0,
        preco_venda:     p.precoVenda || 0,
        quantidade:      0,
        variacoes:       p.variacoes || [],
        // Único lugar onde a validade é gravada — é daqui que a tela de
        // Validade (T7) lê. Não é duplicada dentro de variacoes.
        data_vencimento: p.validade || null,
        ativo:           true,
        disponivel_catalogo_b2b: false,
      })
    }

    if (validos.length) {
      const { error } = await supabase.from('lf_produtos').insert(validos)
      if (error) return { inseridos: 0, erros, error }
      await base.fetchAll()
    }
    return { inseridos: validos.length, erros, error: null }
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
    importarProdutos,
    buscarPorEan,
    fiado,
    fiadoLoading,
    saidas,
    contas,
    addSaida,
    fetchCaixaExtras,
    fetchFiado,
    addFiadoCompra,
    addFiadoPagamento,
    precosFaixas,
    addPrecosFaixas,
    fetchPrecosFaixas,
  }
}
