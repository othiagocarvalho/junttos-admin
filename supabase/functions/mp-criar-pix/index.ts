// Cria uma cobrança Pix dinâmica no Mercado Pago para um pedido do catálogo.
//
// Entrada:  { pedido_id }
// Saída:    { payment_id, qr_code, qr_code_base64, expira_em, valor }
//
// ─── DECISÕES QUE VALE ENTENDER ANTES DE MEXER ──────────────────────────────
//
// 1. O VALOR NÃO VEM DO CLIENTE. A chamada recebe só o pedido_id; o valor sai
//    de lf_pedidos.valor_total, lido aqui com a service_role. Aceitar `valor`
//    do navegador deixaria qualquer pessoa abrir o DevTools e pagar R$ 0,01
//    num pedido de R$ 500 — o QR sairia válido e o webhook marcaria "pago".
//
// 2. O TOKEN NÃO ESTÁ EM lf_config. Aquela tabela não tem RLS e é lida pelo
//    catálogo público com select('*'), então token ali é token vazado. Mora
//    em lf_credenciais_pagamento, que tem RLS e nenhuma policy de SELECT —
//    só a service_role enxerga. Ver supabase/migration_mercadopago_pix.sql.
//
// 3. IDEMPOTÊNCIA. Recarregar a tela do QR não pode gerar uma segunda
//    cobrança: se o pedido já tem mp_payment_id, a função devolve o mesmo
//    pagamento em vez de criar outro.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

const MP_API = 'https://api.mercadopago.com'

type PagamentoMP = {
  id: number
  status: string
  date_of_expiration?: string
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string
      qr_code_base64?: string
    }
  }
}

function dadosDoQr(pg: PagamentoMP) {
  const td = pg.point_of_interaction?.transaction_data
  return {
    payment_id: String(pg.id),
    qr_code: td?.qr_code ?? '',            // copia-e-cola gerado pelo MP
    qr_code_base64: td?.qr_code_base64 ?? '', // PNG em base64, sem prefixo data:
    expira_em: pg.date_of_expiration ?? null,
    status: pg.status,
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { pedido_id } = await req.json()
    if (!pedido_id) return json({ error: 'pedido_id é obrigatório.' }, 400)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Pedido ───────────────────────────────────────────────────────────────
    const { data: pedido, error: errPedido } = await admin
      .from('lf_pedidos')
      .select('id, loja_id, valor_total, status, mp_payment_id, cliente_nome')
      .eq('id', pedido_id)
      .maybeSingle()

    if (errPedido) return json({ error: `Falha ao ler o pedido: ${errPedido.message}` }, 500)
    if (!pedido)   return json({ error: 'Pedido não encontrado.' }, 404)
    if (pedido.status === 'pago') return json({ error: 'Este pedido já está pago.', pago: true }, 409)

    const valor = Number(pedido.valor_total)
    if (!Number.isFinite(valor) || valor <= 0) {
      return json({ error: 'Pedido sem valor válido.' }, 422)
    }

    // ── Credencial da loja ───────────────────────────────────────────────────
    const { data: cred, error: errCred } = await admin
      .from('lf_credenciais_pagamento')
      .select('mercadopago_access_token')
      .eq('loja_id', pedido.loja_id)
      .maybeSingle()

    if (errCred) return json({ error: `Falha ao ler a credencial: ${errCred.message}` }, 500)

    const token = cred?.mercadopago_access_token
    if (!token) {
      // 409 e não 500: não é defeito, é loja sem Mercado Pago configurado. O
      // catálogo usa este código para cair no Pix copia-e-cola sem alarde.
      return json({ error: 'Loja sem Mercado Pago configurado.', semCredencial: true }, 409)
    }

    // ── Já existe cobrança para este pedido? ─────────────────────────────────
    if (pedido.mp_payment_id) {
      const r = await fetch(`${MP_API}/v1/payments/${pedido.mp_payment_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) {
        const pg = await r.json() as PagamentoMP
        // Reaproveita só enquanto continua cobrável; expirado/cancelado cai
        // para baixo e gera um QR novo.
        if (pg.status === 'pending' || pg.status === 'approved') {
          return json({ ...dadosDoQr(pg), valor, reaproveitado: true }, 200)
        }
      }
    }

    // ── Cria o pagamento ─────────────────────────────────────────────────────
    const notificationUrl = `${Deno.env.get('SUPABASE_URL') ?? ''}/functions/v1/mp-webhook`

    const resp = await fetch(`${MP_API}/v1/payments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // Sem esta chave, um retry de rede vira uma segunda cobrança no MP.
        'X-Idempotency-Key': `pedido-${pedido.id}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(valor.toFixed(2)),
        description: `Pedido ${String(pedido.id).slice(0, 8)} — ${pedido.loja_id}`,
        payment_method_id: 'pix',
        // external_reference é o que amarra o pagamento ao pedido: o webhook
        // usa isso quando o mp_payment_id ainda não foi gravado.
        external_reference: String(pedido.id),
        notification_url: notificationUrl,
        payer: {
          // O catálogo não pede e-mail da cliente. O MP exige o campo, então
          // vai um placeholder por loja — nada de inventar e-mail de pessoa.
          email: `pedidos+${pedido.loja_id}@junttos.app`,
          first_name: (pedido.cliente_nome || 'Cliente').slice(0, 40),
        },
      }),
    })

    const corpo = await resp.json().catch(() => ({}))

    if (!resp.ok) {
      const msg = corpo?.message || corpo?.error || `HTTP ${resp.status}`
      // 401/403 do MP quase sempre é token errado ou revogado — vale
      // distinguir para a lojista não caçar bug no lugar errado.
      const credencialRuim = resp.status === 401 || resp.status === 403
      return json({
        error: credencialRuim
          ? 'O Mercado Pago recusou a credencial desta loja. Confira o access token nas Configurações.'
          : `Mercado Pago recusou a cobrança: ${msg}`,
        credencialRuim,
      }, credencialRuim ? 409 : 502)
    }

    const pg = corpo as PagamentoMP
    const dados = dadosDoQr(pg)

    if (!dados.qr_code) {
      return json({ error: 'O Mercado Pago não devolveu o código Pix.' }, 502)
    }

    // Grava a correlação ANTES de responder: se isto falhar, o webhook não
    // acharia o pedido e o pagamento ficaria pago sem ninguém saber.
    const { error: errUp } = await admin
      .from('lf_pedidos')
      .update({ mp_payment_id: dados.payment_id, forma_pagamento: 'pix_mercadopago' })
      .eq('id', pedido.id)

    if (errUp) {
      return json({ error: `Cobrança criada, mas não foi possível vinculá-la ao pedido: ${errUp.message}` }, 500)
    }

    return json({ ...dados, valor }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
