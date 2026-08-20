/**
 * Status de loja que significa "esta loja não existe mais".
 *
 * É o valor exato que CadastroCliente grava no soft delete
 * (`update({ status: 'excluida' })`). Se um dia esse literal mudar lá, o teste
 * em lojaStatus.test.js quebra antes de a porta ficar aberta em silêncio.
 */
export const STATUS_EXCLUIDA = 'excluida'

/**
 * A loja foi excluída (soft delete)?
 *
 * Comparação normalizada — trim + lowercase — de propósito. Os status em
 * lf_config são inconsistentes por natureza ('ativo', 'Ativo', 'Trial',
 * 'demo'), e `isLojaAtiva` em utils/cobrancas.js já convive com isso da mesma
 * forma. Um 'Excluida' digitado à mão no Supabase Studio não pode reabrir o
 * acesso de uma loja encerrada.
 *
 * Null/undefined devolvem false: loja sem status é loja normal, não excluída.
 * Isto é importante — tratar ausência como exclusão derrubaria lojas legítimas.
 *
 * @param {string|null|undefined} status — lf_config.status
 * @returns {boolean}
 */
export function isLojaExcluida(status) {
  return String(status ?? '').trim().toLowerCase() === STATUS_EXCLUIDA
}
