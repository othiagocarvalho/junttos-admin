// Vocabulário de ações do histórico de cobrança.
//
// Mora separado de historicoCobranca.js porque aquele módulo importa o
// cliente Supabase, e quem só precisa do nome da ação (o fluxo de criação de
// loja, os testes) não deveria arrastar uma conexão junto.
//
// historicoCobranca.js reexporta ACAO — continua valendo
// `import { registrarHistorico, ACAO } from '../lib/historicoCobranca'`.

export const ACAO = {
  CRIADA:             'criada',
  VENCIMENTO:         'vencimento',
  VALOR:              'valor',
  OBSERVACOES:        'observacoes',
  PAGO:               'pago',
  PAGAMENTO_DESFEITO: 'pagamento_desfeito',
  DESCONTO:           'desconto',
  // Ações da LOJA, não de uma cobrança: cobranca_id fica nulo, como no desconto.
  PLANO:              'plano',
  GRATUITO:           'gratuito',
  MODELO_VENDA:       'modelo_venda',
}
