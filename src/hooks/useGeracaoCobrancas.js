// Geração automática das mensalidades recorrentes.
//
// O projeto está no plano gratuito do Supabase, sem cron nem scheduled
// functions, então a checagem roda no navegador: toda vez que a tela de
// Cobranças ou o Dashboard carrega, o sistema confere as lojas ativas e cria
// o que estiver faltando.
//
// A consequência aceita é que, se ninguém abrir nenhuma das duas telas por
// semanas, nada é gerado — por isso rodar nos dois lugares, e por isso o aviso
// de atraso existe: o atraso precisa ficar visível na tela, não sumir num log.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { faltantesDeTodas, geracaoAtrasada } from '../utils/cobrancas'
import { registrarHistorico, autorAtual, ACAO } from '../lib/historicoCobranca'

// Postgres: unique_violation. Duas abas abertas tentam criar a mesma cobrança
// e uma delas perde a corrida — isso é o índice único fazendo o trabalho dele,
// não um erro que interesse a alguém.
const DUPLICATA = '23505'

const CAMPOS_LOJA =
  'loja_id, nome, status, plano, segmento, vencimento_dia, ' +
  'cobranca_automatica_desde, desconto_tipo, desconto_valor'

/**
 * Roda a checagem uma vez. Não depende de React — dá para chamar de qualquer
 * lugar. Devolve o que criou, o que continua faltando e o erro, se houve.
 */
export async function executarGeracao(autor = autorAtual()) {
  const vazio = { criadas: [], atrasadas: [], erro: null }

  const [lojasRes, cobRes] = await Promise.all([
    supabase.from('lf_config').select(CAMPOS_LOJA),
    supabase.from('jt_cobrancas').select('*'),
  ])
  if (lojasRes.error) return { ...vazio, erro: lojasRes.error.message }
  if (cobRes.error)   return { ...vazio, erro: cobRes.error.message }

  const lojas     = lojasRes.data || []
  const cobrancas = cobRes.data || []
  const faltantes = faltantesDeTodas(lojas, cobrancas)

  if (faltantes.length === 0) {
    return { criadas: [], atrasadas: geracaoAtrasada(lojas, cobrancas), erro: null }
  }

  // Uma a uma, não em lote: num insert em lote a duplicata de uma linha
  // derruba as outras todas, e aí uma corrida entre abas impediria a geração
  // legítima das demais lojas.
  const criadas = []
  const erros = []
  for (const linha of faltantes) {
    const { data, error } = await supabase
      .from('jt_cobrancas').insert(linha).select().single()
    if (error) {
      if (error.code !== DUPLICATA) erros.push(`${linha.loja_id}: ${error.message}`)
      continue
    }
    criadas.push(data)
  }

  if (criadas.length > 0) {
    await registrarHistorico(
      criadas.map(c => ({
        cobranca_id: c.id,
        loja_id:     c.loja_id,
        acao:        ACAO.CRIADA,
        campo:       'geracao_automatica',
        valor_novo:  `${c.tipo} R$ ${c.valor} venc ${c.vencimento}`,
      })),
      autor,
    )
  }

  // Reconsulta para o atraso refletir o que de fato entrou no banco.
  const { data: depois } = await supabase.from('jt_cobrancas').select('*')
  return {
    criadas,
    atrasadas: geracaoAtrasada(lojas, depois || cobrancas),
    erro: erros.length ? erros.join(' · ') : null,
  }
}

/**
 * Roda a checagem uma vez por montagem do componente.
 *
 * O ref evita a segunda execução do StrictMode em dev, que criaria a mesma
 * cobrança duas vezes se não fosse o índice único do banco.
 */
export function useGeracaoCobrancas({ ativo = true, aoGerar } = {}) {
  const [rodando, setRodando]     = useState(false)
  const [criadas, setCriadas]     = useState([])
  const [atrasadas, setAtrasadas] = useState([])
  const [erro, setErro]           = useState(null)
  const jaRodou = useRef(false)
  // O callback vive num ref para que trocá-lo não redispare a geração. A
  // escrita vai dentro de um efeito: mexer em ref durante o render quebra o
  // modo concorrente do React.
  const aoGerarRef = useRef(aoGerar)
  useEffect(() => { aoGerarRef.current = aoGerar }, [aoGerar])

  const rodar = useCallback(async () => {
    setRodando(true)
    const r = await executarGeracao()
    setCriadas(r.criadas)
    setAtrasadas(r.atrasadas)
    setErro(r.erro)
    setRodando(false)
    if (r.criadas.length > 0) aoGerarRef.current?.(r.criadas)
    return r
  }, [])

  useEffect(() => {
    if (!ativo || jaRodou.current) return
    jaRodou.current = true
    rodar()
  }, [ativo, rodar])

  return { rodando, criadas, atrasadas, erro, rodar }
}
