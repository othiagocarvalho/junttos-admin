// Fluxo de criação de loja — orquestração pura, sem React e sem Supabase.
//
// Mora fora de useCreateLoja.js de propósito. O hook importa `supabase`, e
// importar o cliente em ambiente de teste explode com "supabaseUrl is
// required" (não há VITE_SUPABASE_URL no vitest). Com o fluxo isolado e
// recebendo as dependências por parâmetro, cada etapa — e principalmente
// cada rollback — vira testável sem tocar em rede.
//
// Quem injeta as dependências de verdade é useCreateLoja.js.

import { temAcesso, TAXA_IMPLANTACAO } from '../utils/planos'
import { SLUGS_RESERVADOS, isSlugReservado } from '../utils/rotasReservadas'
import {
  aplicarDesconto, diaISO, marcoCobrancaAutomatica,
  TIPO_IMPLANTACAO, TIPO_MENSALIDADE,
} from '../utils/cobrancas'
import { pedidoMinimoPayload } from '../utils/modeloVenda'
import { ACAO } from '../lib/historicoCobrancaAcoes'

export function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export { SLUGS_RESERVADOS, isSlugReservado }

export function isValidSlug(s) {
  if (isSlugReservado(s)) return false
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(s) && s.length >= 2 && s.length <= 40
}

const DEFAULT_FEATURES = {
  vendas: true, historico: true, metas: true,
  fechamento_caixa: true, relatorios: true,
  clientes: false, estoque: false,
  legado: false, catalogo_b2b: false,
  // CPF/CNPJ + endereço na tela de cliente. Ligado por padrão em Pro e
  // Business (ver buildLojaPayload); no Starter fica off.
  cadastro_completo_cliente: false,
}

/**
 * Etapas do fluxo. Servem para o teste dizer ONDE quer falhar e para a
 * mensagem de erro dizer onde falhou de fato.
 */
export const ETAPA = {
  CONFIG:      'config',
  CONTRATANTE: 'contratante',
  USUARIO:     'usuario',
  COBRANCAS:   'cobrancas',
}

/**
 * Monta o objeto a ser inserido em lf_config.
 * Exportado para facilitar testes unitários.
 *
 * Os dados do contratante (CPF/CNPJ, endereço, responsável) NÃO entram aqui:
 * lf_config é lida por anon — o App.jsx resolve slug antes do login e o
 * catálogo público faz select('*') nela. Esses campos vivem em
 * jt_contratantes e são gravados pela Edge Function, logo após este insert.
 */
export function buildLojaPayload({
  nome, slug,
  status = 'Trial', plano = 'starter',
  segmento = 'moda',
  cor_primaria, cor_secundaria,
  features = {},
  logoUrl = null,
  cadastrado_por_consultor_id = null,
  vencimento_dia = null,
  desconto_tipo = null,
  desconto_valor = null,
  desconto_motivo = null,
  cobranca_automatica_desde = null,
  // Pedido mínimo do catálogo de atacado. Só entra no payload quando o
  // cadastro realmente escolheu atacado e preencheu — omitir mantém o INSERT
  // idêntico ao de antes para quem não passa nada (ConsultorNovaLoja).
  pedido_minimo = null,
}) {
  const payload = {
    loja_id:        slug,
    slug,
    nome,
    status,
    plano,
    segmento,
    cor_primaria,
    cor_secundaria,
    features:       {
      ...DEFAULT_FEATURES,
      cadastro_completo_cliente: temAcesso(plano, 'pro'),
      ...features,
    },
    logo_url:       logoUrl,
    updated_at:     new Date().toISOString(),
    // Ciclo de cobrança. vencimento_dia nulo tira a loja da geração
    // automática — é o que mantém as lojas demo fora do faturamento.
    vencimento_dia:            Number(vencimento_dia) || null,
    cobranca_automatica_desde: cobranca_automatica_desde || null,
    // O CHECK do banco exige os dois juntos ou nenhum.
    desconto_tipo:  Number(desconto_valor) > 0 ? desconto_tipo : null,
    desconto_valor: Number(desconto_valor) > 0 ? Number(desconto_valor) : null,
    desconto_motivo: Number(desconto_valor) > 0 ? (desconto_motivo || null) : null,
  }
  if (cadastrado_por_consultor_id) {
    payload.cadastrado_por_consultor_id = cadastrado_por_consultor_id
  }
  if (pedido_minimo) {
    Object.assign(payload, pedidoMinimoPayload(pedido_minimo))
  }
  return payload
}

/**
 * Desfaz o que já foi gravado quando a criação falha no meio.
 *
 * O bug que motivou isto: o rollback antigo apagava só lf_config. Se a
 * create-user já tivesse criado o usuário no Supabase Auth (e a linha em
 * lf_usuarios) e o erro viesse depois — ou a resposta se perdesse no
 * caminho — sobrava um login válido apontando para uma loja que não existe
 * mais. O e-mail ficava "já cadastrado" e o admin não conseguia recriar a
 * loja sem ir no Dashboard do Auth apagar na mão.
 *
 * Ordem importa: lf_config sai primeiro porque a Edge Function só aceita
 * remover o usuário de uma loja que já não existe — é essa checagem que
 * impede a rota de rollback de virar um "apague qualquer usuário".
 *
 * Nunca lança: devolve o que conseguiu desfazer e o que sobrou, para a
 * mensagem final dizer a verdade ao admin.
 */
export async function desfazerCriacao({ supabase, slug, email, criouUsuario }) {
  const desfeito  = []
  const pendencias = []

  const { error: cfgErr } = await supabase.from('lf_config').delete().eq('loja_id', slug)
  if (cfgErr) pendencias.push(`a configuração da loja (${cfgErr.message})`)
  else desfeito.push('config')

  // Sem usuário criado não há o que limpar no Auth.
  if (!criouUsuario) return { desfeito, pendencias }

  try {
    const { data, error } = await supabase.functions.invoke('create-user', {
      body: { action: 'rollback', loja_id: slug, email },
    })
    const msg = error?.message || data?.error
    if (msg) pendencias.push(`o usuário de acesso "${email}" (${msg})`)
    else desfeito.push('usuario')
  } catch (err) {
    pendencias.push(`o usuário de acesso "${email}" (${err.message})`)
  }

  return { desfeito, pendencias }
}

/**
 * Monta a mensagem de erro final. Quando o rollback foi completo, diz isso;
 * quando sobrou coisa, diz exatamente o que o admin precisa limpar na mão.
 */
export function mensagemFalha({ etapa, motivo, desfeito, pendencias }) {
  const ondeFalhou = etapa === ETAPA.USUARIO ? 'Erro ao criar usuário' : 'Erro ao criar loja'
  if (pendencias.length === 0) {
    const oQue = desfeito.includes('usuario')
      ? 'config e usuário removidos (rollback completo)'
      : 'config removida (rollback)'
    return `${ondeFalhou}: ${motivo} — ${oQue}.`
  }
  return `${ondeFalhou}: ${motivo} — o rollback não conseguiu remover ${pendencias.join(' e ')}. ` +
         `Remova manualmente antes de tentar de novo.`
}

/**
 * Executa a criação da loja de ponta a ponta.
 *
 * Devolve { link, aviso }. `aviso` é falha NÃO fatal — a loja existe e é
 * usável, mas alguma coisa acessória não foi gravada. Lança Error quando a
 * criação não pode continuar; nesse caso o rollback já rodou.
 *
 * deps: { supabase, origin, registrarHistorico }
 */
export async function executarCriacaoLoja(params, deps) {
  const {
    nome, slug,
    status = 'Trial', plano = 'starter',
    segmento = 'moda',
    cor_primaria, cor_secundaria,
    features = {},
    logoUrl = null,
    email_acesso = '', senha_acesso = '',
    valor_mensal = '0',
    enviarBV = true,
    cadastrado_por_consultor_id = null,
    contratante = null,
    vencimento_dia = null,
    desconto_tipo = null,
    desconto_valor = null,
    desconto_motivo = null,
    pedido_minimo = null,
  } = params

  const { supabase, origin, registrarHistorico } = deps

  // Último aviso vence — mesmo comportamento de antes, quando cada etapa
  // acessória chamava setError por conta própria.
  let aviso = ''

  const { data: existing } = await supabase
    .from('lf_config')
    .select('nome')
    .or(`loja_id.eq.${slug},slug.eq.${slug}`)
    .maybeSingle()
  if (existing) throw new Error(`O slug "${slug}" já está em uso pela loja "${existing.nome}".`)

  const { error: cfgErr } = await supabase
    .from('lf_config')
    .insert(buildLojaPayload({
      nome, slug, status, plano, segmento, cor_primaria, cor_secundaria,
      features, logoUrl, cadastrado_por_consultor_id,
      vencimento_dia, desconto_tipo, desconto_valor, desconto_motivo,
      pedido_minimo,
      // Só loja que já nasce ativa entra no ciclo — ver a explicação em
      // marcoCobrancaAutomatica.
      cobranca_automatica_desde: marcoCobrancaAutomatica(status),
    }))
  // Nada foi gravado ainda: falhar aqui não deixa resíduo para desfazer.
  if (cfgErr) throw new Error(cfgErr.message)

  // jt_contratantes tem RLS e nenhuma policy — quem grava é a function.
  // Falhar aqui não invalida a loja: o cadastro do contratante pode ser
  // refeito depois, então o erro vira aviso e não derruba a criação.
  if (contratante && Object.values(contratante).some(v => v !== '' && v != null)) {
    const { data: ctData, error: ctErr } = await supabase.functions.invoke('gerar-contrato', {
      body: { action: 'contratante-salvar', loja_id: slug, contratante },
    })
    const ctMsg = ctErr?.message || ctData?.error
    if (ctMsg) aviso = `Loja criada, mas os dados do contratante não foram salvos: ${ctMsg}`
  }

  if (email_acesso && senha_acesso) {
    const lojaUrl = `${origin}/${slug}/`
    let authError
    try {
      const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-user', {
        body: {
          email: email_acesso, password: senha_acesso,
          loja_id: slug, nome,
          enviarBV, lojaUrl,
          senhaCleartext: enviarBV ? senha_acesso : undefined,
        },
      })
      authError = fnErr?.message || fnData?.error || ''
    } catch (err) {
      // invoke pode estourar por rede/timeout DEPOIS de a function já ter
      // criado o usuário. É exatamente o caso em que o rollback só de
      // lf_config deixava o login órfão — por isso cai no mesmo tratamento.
      authError = err.message
    }

    if (authError) {
      const { desfeito, pendencias } = await desfazerCriacao({
        supabase, slug, email: email_acesso, criouUsuario: true,
      })
      throw new Error(mensagemFalha({
        etapa: ETAPA.USUARIO, motivo: authError, desfeito, pendencias,
      }))
    }
  }

  // O contrato promete taxa de implantação + primeira mensalidade integral
  // "no ato da assinatura" — então as duas nascem vencendo hoje. Antes daqui
  // nascia uma cobrança só, com vencimento em 30 dias, e a implantação
  // simplesmente nunca era cobrada.
  const hoje = diaISO(new Date())
  const cheio = parseFloat(valor_mensal) || 0
  const comDesconto = aplicarDesconto(cheio, desconto_tipo, desconto_valor)

  const { data: criadas, error: cobErr } = await supabase
    .from('jt_cobrancas')
    .insert([
      {
        loja_id:    slug,
        tipo:       TIPO_IMPLANTACAO,
        valor:      TAXA_IMPLANTACAO,   // desconto de assinatura não se aplica à implantação
        vencimento: hoje,
        status:     'pendente',
      },
      {
        loja_id:     slug,
        tipo:        TIPO_MENSALIDADE,
        valor:       comDesconto,
        valor_cheio: comDesconto !== cheio ? cheio : null,
        vencimento:  hoje,
        status:      'pendente',
      },
    ])
    .select()

  // Antes o retorno deste insert era descartado: uma falha aqui criava a
  // loja sem cobrança nenhuma, em silêncio. A loja já existe e o usuário
  // já foi criado, então isto segue sendo aviso e NÃO rollback — desfazer
  // uma loja válida por causa de cobrança é pior do que avisar o admin.
  if (cobErr) {
    aviso = `Loja criada, mas as cobranças iniciais não foram geradas: ${cobErr.message}`
  } else {
    await registrarHistorico((criadas || []).map(c => ({
      cobranca_id: c.id,
      loja_id:     c.loja_id,
      acao:        ACAO.CRIADA,
      campo:       'cadastro_loja',
      valor_novo:  `${c.tipo} R$ ${c.valor} venc ${c.vencimento}`,
    })))
  }

  return { link: `${origin}/${slug}/`, aviso }
}
