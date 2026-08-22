// Comissão por vendedor.
//
// ─── O QUE MUDOU ────────────────────────────────────────────────────────────
// Antes, Relatorios.jsx aplicava UM percentual da loja
// (lf_config.comissao_percentual) igual para todo mundo, e incluía na lista
// uma linha "Sem vendedor(a)" com comissão calculada. Esse campo nunca teve
// tela — o único gravador, useLojaData.saveComissaoPercentual, não é chamado
// por ninguém —, então na prática saía zero para todos.
//
// Agora o percentual vem de lf_vendedores.comissao_percentual, por pessoa.
//
// ─── DUAS DECISÕES QUE MUDAM NÚMERO NA TELA ─────────────────────────────────
//
// 1. VENDA SEM VENDEDOR FICA DE FORA. Antes ela virava uma linha "Sem
//    vendedor(a)" com comissão. Não existe quem receber essa comissão, e
//    mostrá-la inflava o total a pagar. O faturamento dessas vendas continua
//    aparecendo no resto do relatório, que não muda.
//
// 2. O AGRUPAMENTO PASSA A IGNORAR CAIXA E ESPAÇO. Antes era igualdade exata
//    de string, então "Ana Lívia", "ana lívia" e "Ana  Lívia" — todas
//    possíveis na época do campo de texto livre — viravam três linhas. Agora
//    caem na mesma pessoa, usando a mesma chave que o cadastro usa para
//    barrar duplicata. Vendas antigas se juntam sozinhas.

import { normalizarNomeVendedor, chaveVendedor } from './vendedores'

/** Percentual utilizável: número entre 0 e 100. Qualquer outra coisa vira 0. */
export function normalizarPercentual(bruto) {
  const n = typeof bruto === 'string'
    ? Number(bruto.replace(',', '.'))
    : Number(bruto)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

/**
 * Valida o que a lojista digitou no CRUD. Devolve a mensagem, ou null se ok.
 *
 * Campo vazio conta como 0 — vendedor sem comissão é caso real, e obrigar a
 * digitar "0" seria atrito à toa.
 */
export function validarPercentual(bruto) {
  const texto = String(bruto ?? '').trim()
  if (texto === '') return null
  const n = Number(texto.replace(',', '.'))
  if (!Number.isFinite(n)) return 'Use apenas números.'
  if (n < 0)   return 'A comissão não pode ser negativa.'
  if (n > 100) return 'A comissão não pode passar de 100%.'
  return null
}

/**
 * Comissão de cada vendedor no período.
 *
 * @param vendas      já filtradas pelo período/busca da tela
 * @param vendedores  linhas de lf_vendedores (ativos e inativos)
 * @returns [{ nome, total, pct, comissao, cadastrado }] ordenado pela comissão
 *
 * `cadastrado: false` marca nome que aparece em venda mas não existe em
 * lf_vendedores — texto livre da época anterior ao cadastro, ou vendedor
 * apagado à mão. Fica visível com 0% em vez de sumir: esconder faturamento
 * de alguém é pior do que mostrar que falta cadastrar.
 *
 * Inativos entram normalmente: quem vendeu no período tem comissão a receber,
 * mesmo que já tenha saído da loja.
 */
export function calcularComissoes(vendas = [], vendedores = []) {
  const cadastro = new Map()
  for (const v of vendedores || []) {
    const nome = normalizarNomeVendedor(v?.nome)
    if (!nome) continue
    cadastro.set(chaveVendedor(nome), {
      nome,
      pct: normalizarPercentual(v?.comissao_percentual),
    })
  }

  const linhas = new Map()
  for (const venda of vendas || []) {
    const nome = normalizarNomeVendedor(venda?.vendedora)
    if (!nome) continue                     // decisão 1: sem vendedor fica fora
    const chave = chaveVendedor(nome)
    const cad = cadastro.get(chave)
    const linha = linhas.get(chave) || {
      // Prefere a grafia do cadastro à digitada na venda: é a que a lojista
      // reconhece e a que aparece no CRUD.
      nome: cad?.nome || nome,
      total: 0,
      pct: cad?.pct ?? 0,
      cadastrado: !!cad,
    }
    linha.total += Number(venda?.valor) || 0
    linhas.set(chave, linha)
  }

  return [...linhas.values()]
    .map(l => ({ ...l, comissao: l.total * (l.pct / 100) }))
    .sort((a, b) => b.comissao - a.comissao || b.total - a.total)
}

/** Soma a pagar no período — o número que a lojista leva para o caixa. */
export function totalComissoes(linhas = []) {
  return (linhas || []).reduce((s, l) => s + (Number(l.comissao) || 0), 0)
}
