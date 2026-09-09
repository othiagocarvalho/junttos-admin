// Status da loja, do ponto de vista da geração de contrato.
//
// Fica em arquivo próprio por dois motivos. Primeiro, a function roda em Deno
// e não consegue importar de src/ — mesmo caso do valorPlano duplicado em
// index.ts. Segundo, sem Deno-específico nenhum aqui dentro, o vitest do
// projeto consegue importar este arquivo e testar a regra de verdade, em vez
// de testar uma cópia dela.
//
// NÃO reaproveita isLojaAtiva de src/utils/cobrancas.js de propósito: aquela
// devolve true só para 'ativo', e loja nova nasce 'Trial' (ver EMPTY_FORM em
// CadastroCliente). Usá-la aqui recusaria contrato justamente para as lojas
// que mais geram contrato — que é o momento da assinatura.

export const STATUS_EXCLUIDA = 'excluida'

/**
 * lf_config.status é texto livre: convivem 'Ativo' e 'ativo' no banco (ver o
 * comentário de isLojaAtiva). Além de caixa e espaço, tira acento — uma loja
 * marcada como 'Excluída' na mão pelo dashboard precisa ser barrada igual.
 * Errar para o lado de barrar é o lado seguro.
 */
export function normalizarStatus(status: unknown): string {
  return String(status ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function isLojaExcluida(status: unknown): boolean {
  return normalizarStatus(status) === STATUS_EXCLUIDA
}

// Mesma resposta para loja inexistente e loja excluída. Diferenciar as duas
// diria a quem perguntasse que aquele slug já foi uma loja — é o mesmo
// raciocínio do ERRO_LINK em index.ts, que não distingue token inexistente de
// expirado para não virar oráculo de enumeração.
export const ERRO_LOJA = 'Loja não encontrada.'

// União discriminada em vez de campos opcionais: garante no compilador que
// toda recusa carrega erro E status. Com `status?: number`, um veredito de
// recusa sem status cairia no default `= 200` do helper json() de index.ts e
// devolveria a recusa como sucesso.
export type VereditoLoja =
  | { ok: true }
  | { ok: false; erro: string; status: number }

/**
 * Decide se uma loja pode ter contrato gerado.
 *
 * O soft delete (status='excluida', ver handleDelete em CadastroCliente) tira
 * a loja da listagem mas não apaga a linha de lf_config — então ela seguia
 * resolvendo aqui e gerando contrato normalmente. Um contrato é documento
 * assinável: emitir um para loja excluída cria obrigação de um lado e do
 * outro para algo que o sistema considera que não existe mais.
 */
export function avaliarLojaParaContrato(loja: { status?: unknown } | null | undefined): VereditoLoja {
  if (!loja) return { ok: false, erro: ERRO_LOJA, status: 404 }
  if (isLojaExcluida(loja.status)) return { ok: false, erro: ERRO_LOJA, status: 404 }
  return { ok: true }
}
