import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function sendWelcomeEmail(
  resendKey: string,
  email: string,
  nome: string,
  lojaUrl: string,
  senha: string,
) {
  const html = `
    <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#fff;border-radius:12px">
      <h2 style="color:#5E2BD0;margin-bottom:8px">Bem-vindo(a) à Junttos! 🎉</h2>
      <p style="color:#444;line-height:1.6">Olá, <strong>${nome}</strong>! Seu painel de loja está pronto.</p>
      <p style="margin:24px 0">
        <a href="${lojaUrl}" style="display:inline-block;padding:12px 28px;background:#5E2BD0;color:#fff;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px">
          Acessar meu painel
        </a>
      </p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <tr>
          <td style="padding:8px 12px;background:#f7f5fc;border-radius:8px 0 0 0;font-size:13px;color:#666;width:90px">Link</td>
          <td style="padding:8px 12px;background:#f7f5fc;border-radius:0 8px 0 0;font-size:13px;color:#3A2470;font-family:monospace">${lojaUrl}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f0eef9;font-size:13px;color:#666">E-mail</td>
          <td style="padding:8px 12px;background:#f0eef9;font-size:13px;color:#3A2470;font-family:monospace">${email}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f7f5fc;border-radius:0 0 0 8px;font-size:13px;color:#666">Senha</td>
          <td style="padding:8px 12px;background:#f7f5fc;border-radius:0 0 8px 0;font-size:13px;color:#3A2470;font-family:monospace">${senha}</td>
        </tr>
      </table>
      <p style="margin:16px 0;padding:12px 16px;background:#FFF4E5;border-left:3px solid #E8A33D;border-radius:6px;font-size:13px;color:#7A5200;line-height:1.5">
        🔒 <strong>Por segurança, recomendamos trocar sua senha</strong> assim que acessar o painel pela primeira vez.
      </p>
      <p style="font-size:12px;color:#999;line-height:1.6">
        Você pode alterar sua senha a qualquer momento nas configurações da loja.<br>
        Qualquer dúvida, nos chame no WhatsApp: <a href="https://wa.me/5591992733546" style="color:#5E2BD0">+55 91 99273-3546</a>
      </p>
    </div>
  `

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Junttos <onboarding@resend.dev>',
      to: [email],
      subject: `Bem-vindo(a) à Junttos — seu painel está pronto!`,
      html,
    }),
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, password, loja_id, nome, enviarBV, lojaUrl, senhaCleartext } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { loja_id },
    })

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    if (loja_id && data.user) {
      await supabaseAdmin.from('lf_usuarios').insert({
        loja_id,
        auth_user_id: data.user.id,
        email,
        nome: nome || email,
        ativo: true,
      })
    }

    if (enviarBV) {
      const resendKey = Deno.env.get('RESEND_API_KEY') ?? ''
      if (resendKey) {
        try {
          await sendWelcomeEmail(resendKey, email, nome || email, lojaUrl ?? '', senhaCleartext ?? '')
        } catch (_emailErr) {
          // Email failure is non-fatal — user was created successfully
        }
      }
    }

    return new Response(JSON.stringify({ user: data.user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
