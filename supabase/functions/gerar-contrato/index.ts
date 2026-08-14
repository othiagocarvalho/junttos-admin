import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { montaPdf, sha256Hex } from './contrato-pdf.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BUCKET = 'contratos'
const LINK_TTL = 120 // segundos -- o admin baixa na hora; link curto não vaza

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

// Campos copiados de lf_config para o snapshot congelado.
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
    const { action = 'gerar', loja_id, contrato_id } = await req.json()

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Histórico: a tela não consegue ler jt_contratos direto (RLS) ──
    if (action === 'listar') {
      if (!loja_id) return json({ error: 'loja_id é obrigatório.' }, 400)
      const { data, error } = await admin
        .from('jt_contratos').select('*')
        .eq('loja_id', loja_id)
        .order('created_at', { ascending: false })
      if (error) return json({ error: `Erro ao listar contratos: ${error.message}` }, 500)
      return json({ contratos: data ?? [] })
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

    const faltando = faltamCampos(loja)
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
      const v = loja[k]
      if (v !== undefined && v !== null && v !== '') snapshot[k] = v
    })

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

    const { data: atualizado, error: updErr } = await admin
      .from('jt_contratos')
      .update({
        pdf_path:  path,
        pdf_hash:  hash,
        gerado_em: new Date().toISOString(),
        status:    'gerado',
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
