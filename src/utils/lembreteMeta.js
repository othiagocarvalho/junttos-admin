// Regra de exibição do lembrete de meta mensal.
//
// DECISÃO DE MODELAGEM: uma coluna só em lf_config —
// `meta_lembrete_dispensado_em text`, guardando a competência 'YYYY-MM' em
// que a lojista fechou o banner.
//
// Por que a competência e não um booleano ou um timestamp:
//   · booleano precisaria de alguém para "religar" todo mês (cron que não
//     existe no plano gratuito do Supabase)
//   · timestamp exigiria converter para mês na leitura, com fuso no meio
// Guardando 'YYYY-MM', a comparação é uma igualdade de string e a virada de
// mês religa o banner sozinha, sem job nenhum.

import { competenciaAtual } from './tourOnboarding'

export { competenciaAtual }

/**
 * Mostra o lembrete?
 *
 * Só quando as duas coisas valem: não existe meta para o mês corrente E a
 * lojista não fechou o banner neste mesmo mês. Fechar em agosto silencia
 * agosto; em setembro ele volta, se setembro ainda estiver sem meta.
 *
 * Coluna ainda inexistente no banco chega undefined e cai no caso "nunca
 * dispensou" — ou seja, o comportamento é o mesmo antes e depois da migration.
 */
export function deveMostrarLembreteMeta({ metas = {}, dispensadoEm = null, hoje = new Date() } = {}) {
  const mes = competenciaAtual(hoje)
  if (Number(metas?.[mes]) > 0) return false
  return String(dispensadoEm || '') !== mes
}
