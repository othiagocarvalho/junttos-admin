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

/**
 * Desfaz um createUser que não pôde ser completado.
 *
 * Sem isto, uma falha depois do createUser deixava um login válido apontando
 * para uma loja que o cliente já removeu — e-mail "já cadastrado" e ninguém
 * conseguia recriar a loja sem limpar na mão pelo Dashboard do Auth.
 */
async function desfazerUsuario(
  admin: ReturnType<typeof createClient>,
  userId: string,
  lojaId: string | undefined,
) {
  if (lojaId) {
    await admin.from('lf_usuarios').delete().eq('auth_user_id', userId).eq('loja_id', lojaId)
  }
  await admin.auth.admin.deleteUser(userId)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      action,
      email, password,
      loja_id, consultant_id,
      nome, enviarBV, lojaUrl, senhaCleartext,
    } = await req.json()

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    // ─── Rollback ────────────────────────────────────────────────────────────
    // Chamado pelo cadastro de loja quando a criação falhou no meio e o
    // usuário pode ter sobrado. Cobre o caso em que o invoke estourou por
    // rede DEPOIS de a function já ter criado o login: o cliente nunca soube
    // o id do usuário, só o e-mail e a loja.
    //
    // A trava que impede isto de virar um "apague qualquer usuário": só
    // remove se NÃO existir lf_config para a loja. Usuário de loja viva é
    // intocável por esta rota.
    if (action === 'rollback') {
      if (!loja_id || !email) {
        return json({ error: 'rollback exige loja_id e email.' }, 400)
      }

      const { data: cfg, error: cfgErr } = await supabaseAdmin
        .from('lf_config')
        .select('loja_id')
        .eq('loja_id', loja_id)
        .maybeSingle()

      if (cfgErr) return json({ error: `Não foi possível verificar a loja: ${cfgErr.message}` }, 500)
      if (cfg) {
        return json({ error: `A loja "${loja_id}" existe — rollback recusado.` }, 409)
      }

      // Caminho preciso: a linha de lf_usuarios guarda o auth_user_id.
      const { data: vinculos } = await supabaseAdmin
        .from('lf_usuarios')
        .select('auth_user_id')
        .eq('loja_id', loja_id)
        .eq('email', email)

      let userId: string | undefined = vinculos?.[0]?.auth_user_id ?? undefined

      // A linha pode nem ter sido gravada (é justamente uma das falhas que
      // disparam rollback). Aí procura pelo e-mail no Auth.
      if (!userId) {
        const { data: lista } = await supabaseAdmin.auth.admin.listUsers()
        const achado = lista?.users?.find((u: { email?: string }) => u.email === email)
        // Só remove se o login pertencer a esta loja — evita apagar um
        // homônimo de outra loja por e-mail repetido.
        if (achado && achado.app_metadata?.loja_id === loja_id) userId = achado.id
      }

      await supabaseAdmin.from('lf_usuarios').delete().eq('loja_id', loja_id).eq('email', email)

      if (!userId) {
        // Nada para remover no Auth — rollback está completo mesmo assim.
        return json({ rolledBack: true, authUserRemovido: false }, 200)
      }

      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (delErr) return json({ error: `Falha ao remover o usuário: ${delErr.message}` }, 500)

      return json({ rolledBack: true, authUserRemovido: true }, 200)
    }

    // ─── Criação ─────────────────────────────────────────────────────────────

    // Build app_metadata with whatever identifiers are provided
    const appMetadata: Record<string, unknown> = {}
    if (loja_id)       appMetadata.loja_id       = loja_id
    if (consultant_id) appMetadata.consultant_id = consultant_id

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: appMetadata,
    })

    if (error) {
      return json({ error: error.message }, 400)
    }

    // Daqui para baixo o usuário JÁ EXISTE no Auth. Toda falha precisa
    // desfazê-lo antes de responder — senão o cliente recebe erro, apaga a
    // lf_config, e o login fica órfão.
    if (data.user) {
      try {
        // Link auth user to loja's usuarios table
        if (loja_id) {
          const { error: vincErr } = await supabaseAdmin.from('lf_usuarios').insert({
            loja_id,
            auth_user_id: data.user.id,
            email,
            nome: nome || email,
            ativo: true,
          })
          // Antes este retorno era descartado: o insert falhava, a function
          // devolvia 200 e a loja nascia com um login que nenhuma tela
          // conseguia associar à loja.
          if (vincErr) throw new Error(`vínculo com a loja: ${vincErr.message}`)
        }

        // Link auth user back to jt_consultants record
        if (consultant_id) {
          const { error: consErr } = await supabaseAdmin
            .from('jt_consultants')
            .update({ auth_user_id: data.user.id })
            .eq('id', consultant_id)
          if (consErr) throw new Error(`vínculo com o consultor: ${consErr.message}`)
        }
      } catch (stepErr) {
        await desfazerUsuario(supabaseAdmin, data.user.id, loja_id)
        return json({ error: `${String((stepErr as Error).message)} — usuário removido (rollback).` }, 400)
      }
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

    return json({ user: data.user }, 200)
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})
