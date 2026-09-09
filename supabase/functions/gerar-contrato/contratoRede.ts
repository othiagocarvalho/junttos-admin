// Regras puras do contrato de rede (múltiplas lojas, um contratante, um link
// de assinatura só). Fica em arquivo próprio pelo mesmo motivo de
// lojaStatus.ts: sem import de Deno nem de pdf-lib aqui dentro, o vitest
// consegue importar e testar o módulo real que a Edge Function executa, em
// vez de uma cópia da regra.

// Formato gravado em jt_contratos.lojas_incluidas (jsonb) — snapshot
// congelado de cada loja no momento da geração, mesmo espírito do resto da
// linha: se a loja mudar de nome ou plano depois, o contrato já assinado
// continua mostrando o que foi de fato acordado.
export type LojaIncluida = {
  loja_id:      string
  nome:         string
  segmento:     string | null
  plano:        string | null
  valor_mensal: number
}

/** Soma o valor_mensal de todas as lojas incluídas — é o total do contrato. */
export function somaValorMensal(lojas: LojaIncluida[]): number {
  return lojas.reduce((s, l) => s + (Number(l.valor_mensal) || 0), 0)
}

/**
 * Segmento do contrato: só grava um valor único quando TODAS as lojas
 * selecionadas são do mesmo segmento (moda/mercado). Rede mista devolve null
 * — o PDF e a tela tratam null como "múltiplos sistemas", nunca escolhem um
 * dos dois arbitrariamente.
 */
export function segmentoComum(lojas: LojaIncluida[]): string | null {
  const segmentos = new Set(lojas.map(l => l.segmento ?? 'moda'))
  return segmentos.size === 1 ? [...segmentos][0] : null
}

/**
 * Confere que todo loja_id pedido de fato pertence à rede informada — barra
 * um frontend com dado velho (ou uma chamada direta) de misturar loja de
 * outra rede/dono no mesmo contrato. lojasDaRede vem de uma query separada
 * (lf_config where rede_id = X), feita pela function com a lista atual do
 * banco — nunca confia na lista que o cliente mandou.
 */
export function validarSelecaoLojas(
  lojaIdsPedidos: unknown,
  lojasDaRede: { loja_id: string }[],
): { ok: true } | { ok: false; erro: string } {
  if (!Array.isArray(lojaIdsPedidos) || lojaIdsPedidos.length === 0) {
    return { ok: false, erro: 'Selecione ao menos uma loja para incluir no contrato.' }
  }
  const idsUnicos = [...new Set(lojaIdsPedidos.map(String))]
  const idsDaRede = new Set(lojasDaRede.map(l => l.loja_id))
  const foraDaRede = idsUnicos.filter(id => !idsDaRede.has(id))
  if (foraDaRede.length > 0) {
    return { ok: false, erro: `Loja(s) fora desta rede: ${foraDaRede.join(', ')}.` }
  }
  return { ok: true }
}

/**
 * Cancelamento de contratos anteriores em aberto, na geração de um contrato
 * novo. Para rede o escopo é OBRIGATORIAMENTE por rede_id, nunca por
 * loja_id — é o que garante que gerar (ou regerar) um contrato de rede jamais
 * toca no contrato individual de uma loja que também pertença à rede (ex.:
 * Tropicale, com contrato individual já assinado, vinculada à rede do Daniel
 * só como rótulo organizacional). Contratos individuais só são cancelados
 * pelo fluxo de loja_id existente, que continua intocado.
 */
export function filtroCancelamentoRede(redeId: string) {
  return { rede_id: redeId }
}

// ── Implantação de contrato de rede ─────────────────────────────────────────
//
// Desconto padrão vigente sobre a taxa de implantação de um contrato de rede
// (múltiplas lojas novas cobertas num contrato só) — negociado em 20% sobre
// o valor cheio por loja (ex.: R$300 → R$240/loja).
//
// Fica FIXO no código, e não como campo livre na tela de gerar contrato:
// mesma política de TAXA_IMPLANTACAO em contrato-pdf.ts/src/utils/planos.js
// (valor de negócio hardcoded, trocado por um PR revisado quando a política
// mudar). Abrir isso como campo digitável na hora de gerar deixaria um número
// errado (ex.: 92% em vez de 20%, ou um zero a mais) ir direto para um
// documento assinável, sem nenhuma revisão de código no meio — e diferente da
// mensalidade (que só reflete o que a loja já paga), a implantação é um valor
// que este fluxo *decide* sozinho, então o lugar mais seguro pra essa decisão
// morar é uma constante versionada, não um input.
//
// Se no futuro a Junttos negociar percentuais DIFERENTES por rede/cliente,
// este é o lugar certo pra virar parâmetro (ex.: lido de
// jt_contratantes_redes) — até lá, fixo é o caminho mais seguro.
export const DESCONTO_IMPLANTACAO_REDE = 0.20

/**
 * Valor de implantação de UMA loja num contrato de rede, com o desconto
 * padrão já aplicado. Recebe a taxa cheia como parâmetro (não duplica o
 * TAXA_IMPLANTACAO=300 de contrato-pdf.ts aqui — evita um terceiro lugar
 * guardando o mesmo número mágico; contrato-pdf.ts é quem já duplica de
 * src/utils/planos.js, e é ele quem passa o valor pra cá).
 */
export function valorImplantacaoPorLojaRede(taxaImplantacaoBase: number): number {
  return taxaImplantacaoBase * (1 - DESCONTO_IMPLANTACAO_REDE)
}

/** Total de implantação do contrato: valor por loja (já com desconto) × quantidade de lojas. */
export function totalImplantacaoRede(taxaImplantacaoBase: number, qtdLojas: number): number {
  return valorImplantacaoPorLojaRede(taxaImplantacaoBase) * qtdLojas
}
