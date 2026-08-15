// Regras do ciclo de cobrança da assinatura Junttos (jt_cobrancas).
//
// Tudo aqui é função pura, sem Supabase e sem React: é dinheiro de cliente e
// precisa ser testável em isolamento. Quem conversa com o banco é
// useGeracaoCobrancas.js.
//
// Não confundir com src/utils/recorrencia.js, que trata das contas a pagar da
// loja cliente (lf_recorrencias → lf_contas_pagar). Aqui é a mensalidade que a
// Junttos cobra da loja.

import { valorPlano } from './planos'

export const TIPO_IMPLANTACAO = 'implantacao'
export const TIPO_MENSALIDADE = 'mensalidade'

// Quantos dias antes do vencimento a cobrança do mês já pode ser criada. Sem
// alguma antecedência, a cobrança só nasceria no próprio dia de vencer.
export const ANTECEDENCIA_DIAS = 7

// Trava de segurança do laço de geração. 24 meses é muito mais do que qualquer
// atraso plausível — se estourar, é bug, e é melhor parar do que criar 500
// cobranças.
const MAX_MESES = 24

// ── Datas ────────────────────────────────────────────────────────
// Sempre no fuso local. new Date().toISOString() devolve UTC e, à noite no
// Brasil, isso vira o dia seguinte — foi assim que o vencimento antigo
// (created_at + 30) nasceu com um dia de diferença em algumas lojas.

/** Date → 'YYYY-MM-DD', no fuso local. */
export function diaISO(d) {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** 'YYYY-MM-DD' → Date ao meio-dia local (imune a horário de verão). */
export function deISO(s) {
  const [a, m, d] = String(s).split('-').map(Number)
  return new Date(a, m - 1, d, 12, 0, 0)
}

/** Último dia do mês (1–31). */
export function ultimoDiaDoMes(ano, mes0) {
  return new Date(ano, mes0 + 1, 0).getDate()
}

/**
 * Data de vencimento dentro de um mês específico, respeitando meses curtos:
 * dia 31 em fevereiro cai no dia 28 (ou 29). Hoje o CHECK do banco limita
 * vencimento_dia a 28 e esse caso não acontece, mas a função não depende disso.
 */
export function vencimentoNoMes(ano, mes0, vencimentoDia) {
  const dia = Math.min(Number(vencimentoDia), ultimoDiaDoMes(ano, mes0))
  return new Date(ano, mes0, dia, 12, 0, 0)
}

export function somaDias(d, dias) {
  const r = new Date(d)
  r.setDate(r.getDate() + dias)
  return r
}

// ── Status da loja ───────────────────────────────────────────────

/**
 * Só loja 'ativo' entra no ciclo automático — decisão do Thiago, 15/08/2026.
 * Trial fica de fora de propósito: teixeiramultimarcas é cortesia e
 * encantodemulher não tem condição de pagar. Nenhuma das duas deve receber
 * cobrança gerada sozinha.
 *
 * A comparação é case-insensitive porque lf_config.status é texto livre e
 * convivem 'Ativo' e 'ativo' no banco.
 */
export function isLojaAtiva(status) {
  return String(status || '').trim().toLowerCase() === 'ativo'
}

// ── Desconto ─────────────────────────────────────────────────────

/**
 * Desconto permanente da loja, aplicado a toda mensalidade gerada dali em
 * diante. Nunca retroage em cobrança já criada.
 *
 * Percentual acima de 100 ou fixo maior que o valor zeram a mensalidade em vez
 * de virar valor negativo — cobrança negativa não existe.
 */
export function aplicarDesconto(valor, descontoTipo, descontoValor) {
  const base = Number(valor) || 0
  const desc = Number(descontoValor) || 0
  if (!descontoTipo || desc <= 0) return arredonda(base)
  const abatimento = descontoTipo === 'percentual' ? base * (desc / 100) : desc
  return arredonda(Math.max(0, base - abatimento))
}

function arredonda(v) {
  return Math.round(v * 100) / 100
}

/** Texto curto do desconto, para exibir na tela. '' quando não há. */
export function rotuloDesconto(descontoTipo, descontoValor) {
  const desc = Number(descontoValor) || 0
  if (!descontoTipo || desc <= 0) return ''
  return descontoTipo === 'percentual'
    ? `${String(desc).replace('.', ',')}% off`
    : `R$ ${desc.toFixed(2).replace('.', ',')} off`
}

// ── Valor base da mensalidade ────────────────────────────────────

/**
 * Preço cheio da mensalidade da loja, antes do desconto.
 *
 * Prioriza a última mensalidade existente para preservar preço negociado — o
 * admin pode digitar um valor livre no cadastro, e esse combinado não pode se
 * perder no mês 2. valor_cheio vem antes de valor justamente para não aplicar
 * desconto duas vezes sobre um valor que já estava descontado.
 */
export function valorCheioMensalidade(loja, cobrancasDaLoja = []) {
  const mensalidades = cobrancasDaLoja
    .filter(c => c.tipo === TIPO_MENSALIDADE)
    .sort((a, b) => String(b.vencimento).localeCompare(String(a.vencimento)))
  const ultima = mensalidades[0]
  if (ultima) {
    const base = ultima.valor_cheio ?? ultima.valor
    if (base !== null && base !== undefined && Number(base) > 0) return arredonda(Number(base))
  }
  return arredonda(valorPlano(loja?.segmento, loja?.plano))
}

// ── Geração ──────────────────────────────────────────────────────

/** Chave de competência 'YYYY-MM' de uma data ISO. */
export function competencia(vencimentoISO) {
  return String(vencimentoISO || '').slice(0, 7)
}

/**
 * As cobranças de mensalidade que faltam existir para esta loja.
 *
 * A duplicata é evitada por COMPETÊNCIA (ano-mês), não por data exata: as
 * cobranças antigas nasceram com vencimento em created_at + 30 dias e caem em
 * dias diferentes do vencimento_dia da loja. Sem isso, hmboutique — que já tem
 * cobrança vencendo 13/09 e vencimento_dia 14 — ganharia uma segunda cobrança
 * de setembro. O índice único do banco (loja_id, vencimento, tipo) é a trava
 * contra corrida entre duas abas; a checagem por mês é a trava contra
 * cobrar o mesmo mês duas vezes.
 *
 * Devolve [] quando a loja não deve ser cobrada automaticamente. Exigir
 * cobranca_automatica_desde é proposital: sem esse marco, uma loja antiga
 * geraria meses de dívida retroativa no primeiro load da tela.
 */
export function cobrancasFaltantes(loja, cobrancasDaLoja = [], hoje = new Date()) {
  if (!loja?.loja_id) return []
  if (!isLojaAtiva(loja.status)) return []

  const dia = Number(loja.vencimento_dia)
  if (!dia || dia < 1 || dia > 31) return []
  if (!loja.cobranca_automatica_desde) return []

  const desde  = deISO(loja.cobranca_automatica_desde)
  const limite = somaDias(hoje, ANTECEDENCIA_DIAS)
  if (desde > limite) return []

  const mesesOcupados = new Set(
    cobrancasDaLoja
      .filter(c => c.tipo === TIPO_MENSALIDADE)
      .map(c => competencia(c.vencimento)),
  )

  const cheio = valorCheioMensalidade(loja, cobrancasDaLoja)
  const valor = aplicarDesconto(cheio, loja.desconto_tipo, loja.desconto_valor)
  const temDesconto = valor !== cheio

  const faltantes = []
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1, 12, 0, 0)

  for (let i = 0; i < MAX_MESES; i++) {
    const venc = vencimentoNoMes(cursor.getFullYear(), cursor.getMonth(), dia)
    if (venc > limite) break

    const vencISO = diaISO(venc)
    if (venc >= desde && !mesesOcupados.has(competencia(vencISO))) {
      mesesOcupados.add(competencia(vencISO))
      faltantes.push({
        loja_id:     loja.loja_id,
        tipo:        TIPO_MENSALIDADE,
        valor,
        valor_cheio: temDesconto ? cheio : null,
        vencimento:  vencISO,
        status:      'pendente',
      })
    }
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return faltantes
}

/** Junta as faltantes de todas as lojas. cobrancas = tabela inteira. */
export function faltantesDeTodas(lojas = [], cobrancas = [], hoje = new Date()) {
  const porLoja = new Map()
  for (const c of cobrancas) {
    if (!porLoja.has(c.loja_id)) porLoja.set(c.loja_id, [])
    porLoja.get(c.loja_id).push(c)
  }
  return lojas.flatMap(l => cobrancasFaltantes(l, porLoja.get(l.loja_id) || [], hoje))
}

/**
 * O que deveria existir, já venceu, e não existe — o que alimenta o aviso de
 * atraso na tela. Depois de uma geração bem-sucedida isto fica vazio; se
 * continuar cheio, a geração não conseguiu gravar e o atraso precisa aparecer
 * para alguém em vez de morrer num log.
 */
export function geracaoAtrasada(lojas = [], cobrancas = [], hoje = new Date()) {
  const hojeISO = diaISO(hoje)
  return faltantesDeTodas(lojas, cobrancas, hoje).filter(f => f.vencimento <= hojeISO)
}

// ── Status efetivo ───────────────────────────────────────────────

export function statusEfetivo(cobranca, hoje = new Date()) {
  if (cobranca?.status === 'pago') return 'pago'
  if (cobranca?.vencimento && cobranca.vencimento < diaISO(hoje)) return 'atrasado'
  return 'pendente'
}

// ── Relatório por período ────────────────────────────────────────

/**
 * Totais recebidos entre duas datas, pelo eixo data_pagamento — quando o
 * dinheiro entrou, não quando a cobrança vencia. É outra pergunta que a tabela
 * do mês, que filtra por vencimento.
 */
export function totaisPorPeriodo(cobrancas = [], de, ate) {
  const pagas = cobrancas.filter(c =>
    c.status === 'pago' &&
    c.data_pagamento &&
    (!de  || c.data_pagamento >= de) &&
    (!ate || c.data_pagamento <= ate),
  )

  const soma = tipo => pagas
    .filter(c => c.tipo === tipo)
    .reduce((s, c) => s + (Number(c.valor) || 0), 0)

  const implantacao = arredonda(soma(TIPO_IMPLANTACAO))
  const mensalidade = arredonda(soma(TIPO_MENSALIDADE))

  return {
    pagas: pagas.slice().sort((a, b) => String(a.data_pagamento).localeCompare(String(b.data_pagamento))),
    implantacao,
    mensalidade,
    total: arredonda(implantacao + mensalidade),
    qtdImplantacao: pagas.filter(c => c.tipo === TIPO_IMPLANTACAO).length,
    qtdMensalidade: pagas.filter(c => c.tipo === TIPO_MENSALIDADE).length,
    qtd: pagas.length,
  }
}

/**
 * MRR: soma da mensalidade mais recente de cada loja ativa. Só tipo
 * 'mensalidade' — sem esse filtro a taxa de implantação de R$ 300 entraria
 * como receita recorrente.
 */
export function calcularMRR(lojas = [], cobrancas = []) {
  const ativas = new Set(lojas.filter(l => isLojaAtiva(l.status)).map(l => l.loja_id))
  const porLoja = new Map()
  for (const c of cobrancas) {
    if (c.tipo !== TIPO_MENSALIDADE) continue
    if (!ativas.has(c.loja_id)) continue
    const atual = porLoja.get(c.loja_id)
    if (!atual || String(c.vencimento) > String(atual.vencimento)) porLoja.set(c.loja_id, c)
  }
  return arredonda([...porLoja.values()].reduce((s, c) => s + (Number(c.valor) || 0), 0))
}
