import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { montaPdf, sha256Hex } from './contrato-pdf.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'contratos'
const LINK_TTL = 120 // segundos -- o admin baixa na hora; link curto não vaza
const TOKEN_DIAS = 7 // validade do link público, contada da geração

// Status em que o link público ainda vale. 'gerado' entra porque contratos
// anteriores à Fase 4 pararam nele — hoje a geração já salta para
// aguardando_assinatura.
const ABERTOS = ['gerado', 'aguardando_assinatura']

// Resposta única para token inexistente, expirado ou já usado. Diferenciar o
// motivo transformaria a rota num oráculo de enumeração.
const ERRO_LINK = 'Link inválido ou expirado.'

// jt_contratos guarda CPF/CNPJ, endereço e telefone, então fica com RLS ligada
// e sem policy: nada entra ou sai pela anon key do navegador. Toda escrita e
// leitura passa por aqui, com service_role. É também por isso que o snapshot é
// montado no servidor, a partir de lf_config — o cliente não escolhe o que vai
// para dentro de um documento que depois será assinado.

// Espelha OBRIGATORIOS de src/pages/admin/LojaDetalhe.jsx. Sem estes o contrato
// sai sem partes identificadas ou com cláusula pela metade ("foro da comarca de
// não informado"). plano e valor_mensal ficam de fora: sempre existem.
const OBRIGATORIOS = [
  'razao_social', 'cpf_cnpj', 'responsavel_nome',
  'cidade', 'estado', 'contrato_inicio', 'vencimento_dia',
]

// Campos do contratante, copiados de jt_contratantes para o snapshot congelado.
// Moraram em lf_config até a migration_contratante.sql: lá ficavam visíveis
// para qualquer um com a anon key, inclusive no select('*') do catálogo
// público. Agora vivem numa tabela com RLS e sem policy, que só esta function
// enxerga.
const SNAPSHOT_FIELDS = [
  'razao_social', 'cpf_cnpj',
  'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'cep',
  'responsavel_nome', 'responsavel_email', 'responsavel_telefone',
  'contrato_inicio', 'vencimento_dia',
]

// Duplicado de src/utils/planos.js — a function roda em Deno e não importa src/.
const VALORES_PLANO: Record<string, Record<string, number>> = {
  moda:    { starter: 99.90, pro: 149.90, business: 259.90 },
  mercado: { starter: 79.90, pro: 109.90, business: 159.90 },
}
const SEGMENTO_PADRAO = 'moda'
function valorPlano(segmento: string | null, plano: string | null): number {
  const tabela = VALORES_PLANO[segmento ?? ''] ?? VALORES_PLANO[SEGMENTO_PADRAO]
  return tabela[plano ?? ''] ?? VALORES_PLANO[SEGMENTO_PADRAO][plano ?? ''] ?? 0
}

function faltamCampos(o: Record<string, unknown>): string[] {
  return OBRIGATORIOS.filter(k => k === 'vencimento_dia'
    ? !Number(o[k])                              // 0 viraria "todo dia 0"
    : !String(o[k] ?? '').trim())
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    })

  try {
    const { action = 'gerar', loja_id, contrato_id, contratante, token, assinatura_svg } = await req.json()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Cadastro do contratante: jt_contratantes é invisível para o navegador ──
    if (action === 'contratante-obter') {
      if (!loja_id) return json({ error: 'loja_id é obrigatório.' }, 400)
      const { data, error } = await admin
        .from('jt_contratantes').select('*').eq('loja_id', loja_id).maybeSingle()
      if (error) return json({ error: `Erro ao buscar contratante: ${error.message}` }, 500)
      return json({ contratante: data ?? null })
    }

    if (action === 'contratante-salvar') {
      if (!loja_id) return json({ error: 'loja_id é obrigatório.' }, 400)
      const dados = (contratante ?? {}) as Record<string, unknown>

      // Só grava o que veio preenchido — campo em branco não vira string vazia.
      const linha: Record<string, unknown> = { loja_id, updated_at: new Date().toISOString() }
      SNAPSHOT_FIELDS.forEach(k => {
        const v = dados[k]
        if (v === undefined || v === null || v === '') return
        linha[k] = k === 'vencimento_dia' ? Number(v) : v
      })

      // Nada preenchido: não cria linha vazia só para dizer que existe.
      if (Object.keys(linha).length <= 2) return json({ ok: true, contratante: null })

      const { data, error } = await admin
        .from('jt_contratantes').upsert(linha, { onConflict: 'loja_id' }).select().single()
      if (error) return json({ error: `Erro ao salvar contratante: ${error.message}` }, 500)
      return json({ ok: true, contratante: data })
    }

    // ── Histórico: a tela não consegue ler jt_contratos direto (RLS) ──
    // Devolve só o que a listagem exibe. pdf_path e token_assinatura ficam de
    // fora de propósito: o path do bucket não tem por que trafegar, e o token
    // é a credencial do link público — quem precisa deles pede por ação
    // específica (`link` e `link-assinatura`), por contrato.
    if (action === 'listar') {
      if (!loja_id) return json({ error: 'loja_id é obrigatório.' }, 400)
      const { data, error } = await admin
        .from('jt_contratos')
        .select('id, status, created_at, gerado_em, pdf_hash, pdf_path, token_expira_em, assinado_em, razao_social, cpf_cnpj, responsavel_nome')
        .eq('loja_id', loja_id)
        .order('created_at', { ascending: false })
      if (error) return json({ error: `Erro ao listar contratos: ${error.message}` }, 500)

      const contratos = (data ?? []).map(({ pdf_path, ...c }) => ({
        ...c,
        tem_pdf: !!pdf_path,   // a tela só precisa saber se dá para baixar
      }))
      return json({ contratos })
    }

    // ── Assinatura de um contrato, para o modal do admin ──
    if (action === 'assinatura-obter') {
      if (!contrato_id) return json({ error: 'contrato_id é obrigatório.' }, 400)
      const { data, error } = await admin
        .from('jt_contratos')
        .select('assinado_em, assinante_ip, assinante_user_agent, assinatura_svg, razao_social, cpf_cnpj, responsavel_nome, status')
        .eq('id', contrato_id).maybeSingle()
      if (error)  return json({ error: `Erro ao buscar assinatura: ${error.message}` }, 500)
      if (!data)  return json({ error: 'Contrato não encontrado.' }, 404)
      return json({ assinatura: data })
    }

    // ── Token do link público, sob demanda ──
    // O admin precisa do token para enviar o link ao cliente; sem isso a
    // feature não sai do lugar. Vem por ação própria em vez de embutido na
    // listagem, para o token não ficar circulando sem necessidade.
    if (action === 'link-assinatura') {
      if (!contrato_id) return json({ error: 'contrato_id é obrigatório.' }, 400)
      const { data, error } = await admin
        .from('jt_contratos')
        .select('token_assinatura, token_expira_em, status')
        .eq('id', contrato_id).maybeSingle()
      if (error) return json({ error: `Erro ao buscar o contrato: ${error.message}` }, 500)
      if (!data) return json({ error: 'Contrato não encontrado.' }, 404)
      if (!ABERTOS.includes(data.status)) {
        return json({ error: 'Este contrato não está aguardando assinatura.' }, 400)
      }
      return json({ token: data.token_assinatura, expira_em: data.token_expira_em })
    }

    // ── Rota pública: leitura pelo token ──
    // Devolve o mínimo para a tela de assinatura. Nunca loja_id, pdf_path nem
    // o id do contrato.
    if (action === 'publico-obter') {
      if (!token) return json({ error: ERRO_LINK }, 404)
      const { data: c } = await admin
        .from('jt_contratos').select('*').eq('token_assinatura', token).maybeSingle()
      if (!c) return json({ error: ERRO_LINK }, 404)

      if (c.status === 'assinado') {
        return json({
          estado: 'assinado',
          contrato: {
            razao_social: c.razao_social,
            assinado_em:  c.assinado_em,
          },
        })
      }
      if (!ABERTOS.includes(c.status)) return json({ error: ERRO_LINK }, 404)
      if (c.token_expira_em && new Date(c.token_expira_em) < new Date()) {
        return json({ error: ERRO_LINK }, 404)
      }

      const { data: signed } = await admin.storage
        .from(BUCKET).createSignedUrl(c.pdf_path, 600)

      return json({
        estado: 'pendente',
        contrato: {
          razao_social:     c.razao_social,
          cpf_cnpj:         c.cpf_cnpj,
          responsavel_nome: c.responsavel_nome,
          plano:            c.plano,
          segmento:         c.segmento,
          valor_mensal:     c.valor_mensal,
          contrato_inicio:  c.contrato_inicio,
          vencimento_dia:   c.vencimento_dia,
          pdf_url:          signed?.signedUrl ?? null,
        },
      })
    }

    // ── Rota pública: registrar o aceite ──
    if (action === 'publico-assinar') {
      if (!token) return json({ error: ERRO_LINK }, 404)
      if (!assinatura_svg || String(assinatura_svg).trim() === '') {
        return json({ error: 'Assine no campo indicado antes de confirmar.' }, 400)
      }

      const { data: c } = await admin
        .from('jt_contratos').select('id, status, token_expira_em')
        .eq('token_assinatura', token).maybeSingle()
      if (!c) return json({ error: ERRO_LINK }, 404)
      if (!ABERTOS.includes(c.status)) return json({ error: ERRO_LINK }, 404)
      if (c.token_expira_em && new Date(c.token_expira_em) < new Date()) {
        return json({ error: ERRO_LINK }, 404)
      }

      // IP e user-agent vêm do header — auto-declarados pelo cliente não
      // teriam valor probatório.
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
        || req.headers.get('x-real-ip') || null
      const ua = req.headers.get('user-agent') || null

      const { error: updErr } = await admin
        .from('jt_contratos')
        .update({
          status:               'assinado',
          assinado_em:          new Date().toISOString(),
          assinante_ip:         ip,
          assinante_user_agent: ua,
          assinatura_svg:       assinatura_svg,
        })
        .eq('id', c.id)
        .in('status', ABERTOS)   // corrida: dois cliques não assinam duas vezes
      if (updErr) return json({ error: `Erro ao registrar o aceite: ${updErr.message}` }, 500)

      return json({ ok: true, estado: 'assinado' })
    }

    // ── Link de download: signed URL curta; o path nunca vai pro frontend ──
    if (action === 'link') {
      if (!contrato_id) return json({ error: 'contrato_id é obrigatório.' }, 400)
      const { data: contrato, error: selErr } = await admin
        .from('jt_contratos').select('pdf_path').eq('id', contrato_id).maybeSingle()
      if (selErr)    return json({ error: `Erro ao buscar contrato: ${selErr.message}` }, 500)
      if (!contrato) return json({ error: 'Contrato não encontrado.' }, 404)
      if (!contrato.pdf_path) return json({ error: 'Contrato ainda não tem PDF gerado.' }, 400)

      const { data, error } = await admin.storage
        .from(BUCKET).createSignedUrl(contrato.pdf_path, LINK_TTL)
      if (error) return json({ error: `Erro ao gerar link: ${error.message}` }, 500)
      return json({ url: data.signedUrl, expira_em: LINK_TTL })
    }

    // ── Geração: cria o snapshot e o PDF, tudo do lado do servidor ──
    if (!loja_id) return json({ error: 'loja_id é obrigatório.' }, 400)

    // Aceita loja_id ou slug, em consultas separadas para não montar filtro
    // com string vinda do cliente.
    let loja = (await admin.from('lf_config').select('*').eq('loja_id', loja_id).maybeSingle()).data
    if (!loja) {
      loja = (await admin.from('lf_config').select('*').eq('slug', loja_id).maybeSingle()).data
    }
    if (!loja) return json({ error: 'Loja não encontrada.' }, 404)

    // O contratante vem de jt_contratantes; lf_config só entrega plano e
    // segmento, que não são dados pessoais.
    const { data: contratanteAtual } = await admin
      .from('jt_contratantes').select('*').eq('loja_id', loja.loja_id).maybeSingle()

    const faltando = faltamCampos(contratanteAtual ?? {})
    if (faltando.length > 0) {
      return json({ error: `Faltam dados obrigatórios no cadastro: ${faltando.join(', ')}.` }, 400)
    }

    // lf_config não guarda valor mensal — o valor real cobrado está na cobrança
    // mais recente. Sem cobrança, cai na tabela de preço do plano.
    const { data: cobrancas } = await admin
      .from('jt_cobrancas').select('valor')
      .eq('loja_id', loja.loja_id)
      .order('created_at', { ascending: false }).limit(1)
    const doBanco = cobrancas?.[0]?.valor
    const valorMensal = doBanco !== undefined && doBanco !== null
      ? Number(doBanco)
      : valorPlano(loja.segmento, loja.plano)

    const snapshot: Record<string, unknown> = {
      loja_id: loja.loja_id,
      status: 'rascunho',
      valor_mensal: valorMensal,
      plano: loja.plano,
      segmento: loja.segmento,
    }
    SNAPSHOT_FIELDS.forEach(k => {
      const v = contratanteAtual?.[k]
      if (v !== undefined && v !== null && v !== '') snapshot[k] = v
    })

    // Um contrato novo invalida os anteriores que ainda estavam em aberto —
    // é também o caminho para revogar um link que vazou, já que não existe
    // tela de revogação. Os já assinados NÃO são tocados: mudar o status de um
    // contrato assinado apagaria o registro de que ele foi aceito.
    const { error: cancErr } = await admin
      .from('jt_contratos')
      .update({ status: 'cancelado' })
      .eq('loja_id', loja.loja_id)
      .in('status', ['rascunho', ...ABERTOS])
    if (cancErr) return json({ error: `Erro ao cancelar contratos anteriores: ${cancErr.message}` }, 500)

    const { data: novo, error: insErr } = await admin
      .from('jt_contratos').insert(snapshot).select().single()
    if (insErr) return json({ error: `Erro ao criar o contrato: ${insErr.message}` }, 500)

    const bytes = await montaPdf(novo)
    const hash  = await sha256Hex(bytes)
    const path  = `${novo.loja_id}/${novo.id}.pdf`

    const { error: upErr } = await admin.storage
      .from(BUCKET)
      .upload(path, bytes, { contentType: 'application/pdf', upsert: true })
    if (upErr) return json({ error: `Contrato criado, mas falhou ao salvar o PDF: ${upErr.message}` }, 500)

    // Com o PDF no bucket o link público já é válido, então o contrato entra
    // direto em aguardando_assinatura — 'gerado' seria um estado que duraria
    // milissegundos e não diria nada a mais na tela.
    const agora = new Date()
    const expira = new Date(agora.getTime() + TOKEN_DIAS * 24 * 60 * 60 * 1000)

    const { data: atualizado, error: updErr } = await admin
      .from('jt_contratos')
      .update({
        pdf_path:        path,
        pdf_hash:        hash,
        gerado_em:       agora.toISOString(),
        token_expira_em: expira.toISOString(),
        status:          'aguardando_assinatura',
      })
      .eq('id', novo.id)
      .select().single()
    if (updErr) {
      return json({ error: `PDF salvo, mas falhou ao atualizar o registro: ${updErr.message}` }, 500)
    }

    return json({ ok: true, contrato: atualizado })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
