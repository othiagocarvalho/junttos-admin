// Recebe a notificação de pagamento do Mercado Pago e marca o pedido como pago.
//
// ─── DUAS CAMADAS DE VERIFICAÇÃO, DE PROPÓSITO ──────────────────────────────
//
// 1. ASSINATURA. O MP manda `x-signature: ts=<epoch>,v1=<hmac>` e
//    `x-request-id`. O manifesto assinado é, literalmente:
//        id:<data.id>;request-id:<x-request-id>;ts:<ts>;
//    com HMAC-SHA256 usando a chave secreta do webhook da loja. Sem isso,
//    qualquer pessoa que descubra a URL da function marca pedido como pago
//    mandando um POST — a URL é pública por natureza.
//
// 2. RE-CONSULTA NA API. Mesmo com assinatura válida, o corpo do webhook só
//    diz "o pagamento X mudou". O status vem de uma chamada nossa a
//    GET /v1/payments/X. Assinatura confirma a origem; a consulta confirma o
//    fato. Um replay de notificação antiga não consegue forjar "approved".
//
// A comparação do HMAC é feita em tempo constante: comparar com === vazaria
// o segredo byte a byte por timing, que é ataque conhecido contra webhook.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
// Helpers puros, sem dependência de runtime — testados em
// src/utils/mpAssinatura.test.js.
import {
  parseAssinatura, montarManifesto, assinaturaConfere, dentroDaJanela,
} from './assinatura.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-signature, x-request-id',
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })
}

const MP_API = 'https://api.mercadopago.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const corpo = await req.json().catch(() => null)
    if (!corpo) return json({ error: 'Corpo inválido.' }, 400)

    // O MP manda vários tipos de evento; só pagamento interessa aqui.
    const tipo = corpo.type ?? corpo.topic
    const dataId = String(corpo?.data?.id ?? corpo?.resource ?? '')
    if (tipo !== 'payment' || !dataId) {
      // 200 de propósito: evento que não nos serve não é erro, e devolver
      // 4xx faria o MP reenviar em loop.
      return json({ ignorado: true, tipo }, 200)
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // ── Qual loja? ───────────────────────────────────────────────────────────
    // A notificação não diz a loja, então o pedido é encontrado pelo
    // mp_payment_id que o mp-criar-pix gravou.
    const { data: pedido, error: errPedido } = await admin
      .from('lf_pedidos')
      .select('id, loja_id, status, valor_total')
      .eq('mp_payment_id', dataId)
      .maybeSingle()

    if (errPedido) return json({ error: `Falha ao localizar o pedido: ${errPedido.message}` }, 500)
    if (!pedido) {
      // Pode ser cobrança de outro sistema na mesma conta MP. 200 para o MP
      // parar de reenviar.
      return json({ ignorado: true, motivo: 'pedido não encontrado' }, 200)
    }

    const { data: cred } = await admin
      .from('lf_credenciais_pagamento')
      .select('mercadopago_access_token, mercadopago_webhook_secret')
      .eq('loja_id', pedido.loja_id)
      .maybeSingle()

    const segredo = cred?.mercadopago_webhook_secret
    const token = cred?.mercadopago_access_token
    if (!segredo || !token) {
      return json({ error: 'Loja sem credenciais de webhook configuradas.' }, 409)
    }

    // ── Camada 1: assinatura ─────────────────────────────────────────────────
    const { ts, v1 } = parseAssinatura(req.headers.get('x-signature'))
    const requestId = req.headers.get('x-request-id') ?? ''
    if (!ts || !v1) return json({ error: 'Assinatura ausente.' }, 401)

    const ok = await assinaturaConfere(segredo, montarManifesto(dataId, requestId, ts), v1)
    if (!ok) return json({ error: 'Assinatura inválida.' }, 401)

    // Janela de 5 minutos: assinatura válida capturada e reenviada semanas
    // depois não deve ser aceita.
    if (!dentroDaJanela(ts, Date.now())) {
      return json({ error: 'Assinatura fora da janela de validade.' }, 401)
    }

    // ── Camada 2: o status vem da API, não do corpo ──────────────────────────
    const r = await fetch(`${MP_API}/v1/payments/${dataId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!r.ok) return json({ error: `Mercado Pago não devolveu o pagamento: HTTP ${r.status}` }, 502)

    const pg = await r.json()
    if (pg.status !== 'approved') {
      return json({ ok: true, status: pg.status, alterado: false }, 200)
    }

    // Confere o valor: pagamento aprovado por menos do que o pedido vale não
    // pode marcar o pedido como quitado.
    const pago = Number(pg.transaction_amount)
    const devido = Number(pedido.valor_total)
    if (!Number.isFinite(pago) || pago + 0.01 < devido) {
      return json({
        ok: true, alterado: false,
        motivo: `valor pago (${pago}) menor que o do pedido (${devido})`,
      }, 200)
    }

    if (pedido.status === 'pago') {
      // Reentrega da mesma notificação — o MP reenvia até receber 200.
      return json({ ok: true, alterado: false, jaEstavaPago: true }, 200)
    }

    const { error: errUp } = await admin
      .from('lf_pedidos')
      .update({ status: 'pago', forma_pagamento: 'pix_mercadopago' })
      .eq('id', pedido.id)

    if (errUp) return json({ error: `Falha ao marcar o pedido como pago: ${errUp.message}` }, 500)

    return json({ ok: true, alterado: true, pedido_id: pedido.id }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
