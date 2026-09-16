// Parsing + agrupamento da planilha de importação de estoque (Estoque —
// "Importar Estoque"). Formato esperado, uma linha por variação:
//   Produto | Cor | Tamanho | Quantidade | Custo | Venda
//
// A gravação em lf_produtos é feita por importarProdutos() (useLojaData.js),
// que já existe e já sabe marcar a movimentação inicial como 'importacao' —
// este módulo só entrega a ele a lista de produtos no formato que espera
// ({ nome, precoCusto, precoVenda, variacoes: [{cor, quantidade}] }).
//
// `variacoes` em lf_produtos é de UMA dimensão só (chave `cor`) — não existe
// hoje um produto com cor E tamanho como campos separados (ver
// catalogoV2.js:39 e migration_catalogo_novo.sql:308). Por isso Cor e Tamanho
// da planilha viram um único rótulo: quando as duas dimensões são reais,
// combina ("Preto M"); quando só uma é real, usa só ela; quando as duas são
// "Único" (ou vazias), o rótulo final é "Único" — o mesmo literal que o
// cadastro manual de produto sem variação já grava.

export const UNICO = 'Único'

function normalizarTexto(v) {
  return (v ?? '').toString().trim()
}

/** Converte texto de planilha (vírgula ou ponto decimal) em número, ou null. */
export function normalizarNumero(v) {
  if (v === null || v === undefined || v === '') return null
  const n = parseFloat(String(v).trim().replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function normalizarInteiro(v) {
  const n = normalizarNumero(v)
  if (n === null) return null
  const i = Math.trunc(n)
  return i >= 0 ? i : null
}

/** Combina Cor + Tamanho da planilha num único rótulo de variação. */
export function montarLabelVariacao(corBruta, tamanhoBruta) {
  const cor = normalizarTexto(corBruta) || UNICO
  const tamanho = normalizarTexto(tamanhoBruta) || UNICO
  if (cor !== UNICO && tamanho !== UNICO) return `${cor} ${tamanho}`
  if (cor !== UNICO) return cor
  if (tamanho !== UNICO) return tamanho
  return UNICO
}

/**
 * Agrupa as linhas cruas da planilha (uma por variação) em produtos prontos
 * para importarProdutos(). Linha com erro é descartada sem derrubar as
 * demais; produto sem nenhuma linha válida simplesmente não aparece.
 *
 * @param {Array<{Produto,Cor,Tamanho,Quantidade,Custo,Venda}>} linhas
 * @returns {{ produtos: Array<{nome,precoCusto,precoVenda,variacoes,avisos,totalPecas}>,
 *             erros: Array<{linha:number, motivo:string}> }}
 */
export function agruparLinhasPlanilha(linhas = []) {
  const erros = []
  const grupos = new Map()
  const ordem = []

  linhas.forEach((linha, i) => {
    const numeroLinha = i + 2 // linha 1 da planilha é o cabeçalho

    const nome = normalizarTexto(linha?.Produto)
    if (!nome) {
      erros.push({ linha: numeroLinha, motivo: 'Produto vazio ou coluna "Produto" ausente.' })
      return
    }

    const quantidade = normalizarInteiro(linha?.Quantidade)
    if (quantidade === null) {
      erros.push({ linha: numeroLinha, motivo: `Quantidade inválida: "${linha?.Quantidade ?? ''}".` })
      return
    }

    const custo = normalizarNumero(linha?.Custo) ?? 0
    const venda = normalizarNumero(linha?.Venda) ?? 0
    const cor  = montarLabelVariacao(linha?.Cor, linha?.Tamanho)

    const chave = nome.toLowerCase()
    let grupo = grupos.get(chave)
    if (!grupo) {
      grupo = { nome, precoCusto: custo, precoVenda: venda, variacoes: [], avisos: [] }
      grupos.set(chave, grupo)
      ordem.push(chave)
    } else {
      if (custo !== grupo.precoCusto) {
        grupo.avisos.push(
          `Linha ${numeroLinha}: Custo ${custo} diferente do já usado para "${nome}" (${grupo.precoCusto}) — mantido o valor da primeira linha.`
        )
      }
      if (venda !== grupo.precoVenda) {
        grupo.avisos.push(
          `Linha ${numeroLinha}: Venda ${venda} diferente do já usado para "${nome}" (${grupo.precoVenda}) — mantido o valor da primeira linha.`
        )
      }
    }
    grupo.variacoes.push({ cor, quantidade })
  })

  const produtos = ordem.map(chave => {
    const g = grupos.get(chave)
    return { ...g, totalPecas: g.variacoes.reduce((s, v) => s + v.quantidade, 0) }
  })

  return { produtos, erros }
}

/** Totais do lote inteiro, para a tela de prévia. */
export function totalizarProdutosImportados(produtos = []) {
  return produtos.reduce((acc, p) => {
    const pecas = p.variacoes.reduce((s, v) => s + Number(v.quantidade || 0), 0)
    acc.totalProdutos += 1
    acc.totalPecas     += pecas
    acc.totalCusto     += pecas * Number(p.precoCusto || 0)
    acc.totalVenda     += pecas * Number(p.precoVenda || 0)
    return acc
  }, { totalProdutos: 0, totalPecas: 0, totalCusto: 0, totalVenda: 0 })
}
