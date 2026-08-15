import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { temAcesso, TAXA_IMPLANTACAO } from '../utils/planos'
import { aplicarDesconto, diaISO, TIPO_IMPLANTACAO, TIPO_MENSALIDADE } from '../utils/cobrancas'
import { registrarHistorico, ACAO } from '../lib/historicoCobranca'

export function toSlug(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Primeiros segmentos de URL que o App.jsx trata antes de procurar uma loja.
 * Uma loja com um destes slugs sequestraria a rota — ou seria engolida por ela.
 * 'c' é o portal do consultor; 'contrato' é o link público de assinatura.
 */
export const SLUGS_RESERVADOS = ['c', 'contrato', 'admin', 'api']

export function isSlugReservado(s) {
  return SLUGS_RESERVADOS.includes(String(s || '').toLowerCase())
}

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
  return payload
}

/**
 * Hook que encapsula toda a lógica de criação de loja:
 * validação → INSERT lf_config → create-user edge function → INSERT jt_cobrancas.
 *
 * Usado tanto por CadastroCliente (admin) quanto por ConsultorNovaLoja.
 * O campo cadastrado_por_consultor_id só é enviado quando fornecido.
 */
export function useCreateLoja() {
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')
  const [successLink, setSuccessLink] = useState('')

  function reset() { setError(''); setSuccessLink('') }

  async function save({
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
  }) {
    if (!nome?.trim() || !slug?.trim()) {
      setError('Nome e slug são obrigatórios.')
      return null
    }
    if (isSlugReservado(slug)) {
      setError(`"${slug}" é um endereço reservado do sistema. Escolha outro slug.`)
      return null
    }
    if (!isValidSlug(slug)) {
      setError('Slug inválido. Use apenas letras minúsculas, números e hífens (2–40 caracteres, sem começar/terminar com hífen).')
      return null
    }

    setSaving(true); setError('')
    try {
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
          // A geração automática começa a valer hoje: nunca cria cobrança
          // anterior ao cadastro.
          cobranca_automatica_desde: diaISO(new Date()),
        }))
      if (cfgErr) throw new Error(cfgErr.message)

      // jt_contratantes tem RLS e nenhuma policy — quem grava é a function.
      // Falhar aqui não invalida a loja: o cadastro do contratante pode ser
      // refeito depois, então o erro vira aviso e não derruba a criação.
      if (contratante && Object.values(contratante).some(v => v !== '' && v != null)) {
        const { data: ctData, error: ctErr } = await supabase.functions.invoke('gerar-contrato', {
          body: { action: 'contratante-salvar', loja_id: slug, contratante },
        })
        const ctMsg = ctErr?.message || ctData?.error
        if (ctMsg) setError(`Loja criada, mas os dados do contratante não foram salvos: ${ctMsg}`)
      }

      if (email_acesso && senha_acesso) {
        const lojaUrl = `${window.location.origin}/${slug}/`
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('create-user', {
          body: {
            email: email_acesso, password: senha_acesso,
            loja_id: slug, nome,
            enviarBV, lojaUrl,
            senhaCleartext: enviarBV ? senha_acesso : undefined,
          },
        })
        const authError = fnErr?.message || fnData?.error
        if (authError) {
          await supabase.from('lf_config').delete().eq('loja_id', slug)
          throw new Error(`Erro ao criar usuário: ${authError} — config removida (rollback).`)
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
      // já foi criado, então isto é aviso e não rollback — mas precisa aparecer.
      if (cobErr) {
        setError(`Loja criada, mas as cobranças iniciais não foram geradas: ${cobErr.message}`)
      } else {
        await registrarHistorico((criadas || []).map(c => ({
          cobranca_id: c.id,
          loja_id:     c.loja_id,
          acao:        ACAO.CRIADA,
          campo:       'cadastro_loja',
          valor_novo:  `${c.tipo} R$ ${c.valor} venc ${c.vencimento}`,
        })))
      }

      const link = `${window.location.origin}/${slug}/`
      setSuccessLink(link)
      return link
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSaving(false)
    }
  }

  return { save, saving, error, successLink, reset }
}
