import { parsePgtosRecibo } from './recibo'
import { paraDataLocal } from './datas'

// ── Caixa do Mercado (T10–T13) ────────────────────────────────
// As fórmulas vêm de LojaFeminina/Fechamento.jsx, que já rodava para a Moda:
//   dinheiroEsperado = dinheiro − saídas
//   diferenca        = valor contado − dinheiroEsperado
// A Moda usa "sangria" e "suprimento" como campos separados; no Mercado tudo
// que sai do caixa é uma saída em merc_saidas, então a subtração é uma só.

/** Formas de pagamento do PDV do Mercado (NovaVenda.jsx:285). */
export const FORMAS = ['Dinheiro', 'Pix', 'Cartão']

// Fiado não entra no caixa: é venda sem baixa financeira, vira saldo devedor
// em merc_fiado. Contar como dinheiro que entrou inflaria o fechamento e a
// contagem física nunca bateria.
export const FORMA_SEM_CAIXA = 'Fiado'

const arredonda = v => Math.round((Number(v) || 0) * 100) / 100

/** 'YYYY-MM-DD' local — nunca toISOString(), que muda o dia. */
export function diaISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Filtra os registros de um dia, comparando a data no fuso local. */
export function doDia(itens, dia, campo = 'data') {
  return (itens || []).filter(i => {
    const d = paraDataLocal(i?.[campo])
    return d ? diaISO(d) === dia : false
  })
}

/**
 * Quanto entrou por forma de pagamento, mais o fiado do dia à parte.
 * @returns {{Dinheiro, Pix, Cartão, fiado, total}}
 */
export function entradasPorForma(vendas, dia = diaISO()) {
  const totais = { Dinheiro: 0, Pix: 0, 'Cartão': 0, fiado: 0 }

  for (const venda of doDia(vendas, dia)) {
    for (const p of parsePgtosRecibo(venda)) {
      const valor = Number(p.valor) || 0
      if (p.forma === FORMA_SEM_CAIXA) { totais.fiado += valor; continue }
      if (p.forma in totais) totais[p.forma] += valor
      else totais['Cartão'] += valor  // formas antigas caem em cartão
    }
  }

  for (const k of Object.keys(totais)) totais[k] = arredonda(totais[k])
  totais.total = arredonda(totais.Dinheiro + totais.Pix + totais['Cartão'])
  return totais
}

/** Percentual de cada forma sobre o total que entrou (0 quando não houve venda). */
export function participacao(entradas) {
  const t = entradas.total
  return FORMAS.map(forma => ({
    forma,
    valor: entradas[forma],
    pct: t > 0 ? Math.round((entradas[forma] / t) * 100) : 0,
  }))
}

/** Soma das saídas do dia. */
export function totalSaidas(saidas, dia = diaISO()) {
  return arredonda(doDia(saidas, dia).reduce((s, x) => s + (Number(x.valor) || 0), 0))
}

/**
 * Resumo do caixa do dia: o que entrou, o que saiu e o que sobrou.
 * "Sobrou" é o resultado do dia (entrou − saiu), não o dinheiro em gaveta —
 * esse é o dinheiroEsperado, que só considera a parte em espécie.
 */
export function resumoCaixa(vendas, saidas, dia = diaISO()) {
  const entradas = entradasPorForma(vendas, dia)
  const saiu     = totalSaidas(saidas, dia)
  return {
    dia,
    entradas,
    entrou: entradas.total,
    saiu,
    sobrou: arredonda(entradas.total - saiu),
    // Só o que está fisicamente na gaveta pode ser contado à mão
    dinheiroEsperado: arredonda(entradas.Dinheiro - saiu),
  }
}

/**
 * Diferença entre o contado e o esperado.
 * Positivo = sobrou mais do que o previsto; negativo = faltou.
 */
export function conferirContagem(dinheiroEsperado, valorContado) {
  // '' e null viram 0 no Number(), o que faria um campo ainda em branco
  // aparecer como falta de caixa. Sem valor digitado não há diferença.
  if (valorContado === '' || valorContado === null || valorContado === undefined) {
    return { diferenca: null, bate: false }
  }
  const contado = Number(valorContado)
  if (!Number.isFinite(contado)) return { diferenca: null, bate: false }
  const diferenca = arredonda(contado - dinheiroEsperado)
  return { diferenca, bate: Math.abs(diferenca) < 0.01 }
}

/** Já existe fechamento para o dia? (mesma regra da Moda) */
export function jaFechado(caixas, dia) {
  return (caixas || []).some(c => String(c.data).slice(0, 10) === dia)
}

/** Contas a vencer amanhã — usado no aviso do passo 3. */
export function contasDeAmanha(contas, hoje = new Date()) {
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)
  const alvo = diaISO(amanha)
  return (contas || []).filter(c =>
    c?.status !== 'pago' && String(c?.data_vencimento).slice(0, 10) === alvo
  )
}

/**
 * Urgência de uma conta a pagar, para a cor do cartão na T10.
 * vencido → #FFEBE7 · vence em breve (até 3 dias) → #FFF3EA · normal → #F4F4F7
 */
export function urgenciaConta(conta, hoje = new Date()) {
  const venc = paraDataLocal(conta?.data_vencimento)
  if (!venc) return 'normal'
  const dias = Math.round(
    (Date.UTC(venc.getFullYear(), venc.getMonth(), venc.getDate()) -
     Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())) / 86400000
  )
  if (dias < 0) return 'vencido'
  if (dias <= 3) return 'breve'
  return 'normal'
}

export const COR_URGENCIA = {
  vencido: { fundo: '#FFEBE7', texto: '#C4321F' },
  breve:   { fundo: '#FFF3EA', texto: '#B45309' },
  normal:  { fundo: '#F4F4F7', texto: '#3F3F46' },
}
