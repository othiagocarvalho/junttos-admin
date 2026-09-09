// Leitura e escrita de lf_vendedores.
//
// Hook próprio, e não mais um campo em useLojaData, por dois motivos: o CRUD
// mora em LojaConfig, que o LojaMercado monta passando props explícitas (sem
// o spread de `data`), e o select mora na Nova Venda. Um hook que busca
// sozinho a partir do loja_id funciona nos três pontos de montagem sem
// alterar a assinatura de ninguém.

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { normalizarNomeVendedor } from '../../utils/vendedores'
import { normalizarPercentual } from '../../utils/comissao'

export function useVendedores(lojaId, { apenasAtivos = false } = {}) {
  const [vendedores, setVendedores] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)

  const carregar = useCallback(async () => {
    // Sem setCarregando(true) aqui de propósito: o estado já nasce true, e
    // recarregar depois de adicionar/desativar não precisa piscar a lista —
    // ela só troca. Também evita setState síncrono dentro do efeito.
    if (!lojaId) { setVendedores([]); setCarregando(false); return }
    let q = supabase.from('lf_vendedores').select('*').eq('loja_id', lojaId)
    if (apenasAtivos) q = q.eq('ativo', true)
    const { data, error } = await q.order('nome')
    // Tabela ainda não criada (migration não rodada) não pode derrubar a tela:
    // a Nova Venda cai no campo de texto e o cadastro mostra o aviso.
    if (error) { setErro(error); setVendedores([]) }
    else { setErro(null); setVendedores(data || []) }
    setCarregando(false)
  }, [lojaId, apenasAtivos])

  // Busca ao montar. A regra set-state-in-effect existe para desencorajar
  // estado derivado calculado em efeito — não é o caso: isto é I/O, e a
  // própria documentação que ela cita ("You Might Not Need an Effect") trata
  // fetch como uso legítimo. Mesmo padrão de dispensa que NovaVenda.jsx já usa.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar() }, [carregar])

  async function adicionar(nomeBruto, comissaoBruta = 0) {
    const nome = normalizarNomeVendedor(nomeBruto)
    const { error } = await supabase.from('lf_vendedores').insert({
      loja_id: lojaId,
      nome,
      comissao_percentual: normalizarPercentual(comissaoBruta),
    })
    if (!error) await carregar()
    return error
  }

  /** Só o percentual — o nome não muda por aqui, para não órfãos as vendas
   *  já lançadas com a grafia antiga. */
  async function definirComissao(id, percentualBruto) {
    const { error } = await supabase
      .from('lf_vendedores')
      .update({ comissao_percentual: normalizarPercentual(percentualBruto) })
      .eq('id', id)
    if (!error) await carregar()
    return error
  }

  /** Sem exclusão física: venda antiga guarda o nome como texto e o relatório
   *  ainda agrupa por ele. Apagar o cadastro não apagaria o histórico, mas
   *  tirar do ar quem já vendeu confunde mais do que ajuda. */
  async function definirAtivo(id, ativo) {
    const { error } = await supabase.from('lf_vendedores').update({ ativo }).eq('id', id)
    if (!error) await carregar()
    return error
  }

  return { vendedores, carregando, erro, recarregar: carregar, adicionar, definirAtivo, definirComissao }
}
