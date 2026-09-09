-- ─────────────────────────────────────────────────────────────────────────────
-- Gravação da credencial do Mercado Pago via função, não via PATCH.
--
-- ►► É DDL. NÃO FOI EXECUTADO. Rode manualmente no SQL Editor do Supabase. ◄◄
--
-- ►► RODE ISTO **ANTES** DE FAZER O DEPLOY DO CÓDIGO. ◄◄
--    O código novo chama esta função. Se ele subir antes, a lojista recebe
--    "a função de gravação ainda não existe no banco" — mensagem explícita,
--    não falha silenciosa, mas ainda assim não grava.
--
-- ─── O IMPASSE QUE ISTO RESOLVE ─────────────────────────────────────────────
-- lf_credenciais_pagamento não tem policy de SELECT, de propósito: é o que
-- impede o access token de voltar para o navegador. Essa decisão fechou os
-- dois caminhos de UPDATE via PostgREST, um de cada vez:
--
--   COM  .eq('loja_id', …)  → coluna no WHERE exige permissão de SELECT, o que
--                             faz o Postgres aplicar as policies de SELECT.
--                             Não há nenhuma → a linha some para o WHERE →
--                             0 linhas afetadas, resposta 204, silêncio.
--                             (medido em produção em 23/08/2026)
--
--   SEM  .eq('loja_id', …)  → o PostgREST recusa a operação inteira:
--                             400  21000  "UPDATE requires a WHERE clause".
--                             (confirmado em produção em 23/08/2026)
--
-- Não é escolher o lado menos ruim: os dois lados estão fechados. A saída é
-- parar de mandar UPDATE de fora e mandar o banco fazer a gravação.
--
-- SECURITY DEFINER roda como o dono da função, que enxerga a linha sem
-- depender de policy de SELECT — e como não é um PATCH, a trava do WHERE do
-- PostgREST não se aplica. A proteção por loja que o RLS dava passa a ser
-- feita aqui dentro, explicitamente, ANTES de qualquer escrita.
--
-- ─── O QUE ESTA FUNÇÃO NÃO FAZ ──────────────────────────────────────────────
-- Não lê e não devolve `mercadopago_access_token` nem
-- `mercadopago_webhook_secret`. Retorna void. Nenhum caminho aqui traz
-- segredo de volta para o cliente — a tabela continua sem policy de SELECT e
-- continua ilegível pelo navegador.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.salvar_credencial_mercadopago(
  p_loja_id        text,
  p_access_token   text default null,
  p_webhook_secret text default null
)
returns void
language plpgsql
security definer
-- search_path vazio + tudo qualificado: sem isso, quem controlasse um schema
-- no caminho poderia sequestrar uma chamada dentro de uma função que roda com
-- privilégio elevado.
set search_path = ''
as $$
declare
  v_claim  text;
  v_token  text := nullif(btrim(p_access_token),   '');
  v_secret text := nullif(btrim(p_webhook_secret), '');
begin
  if nullif(btrim(coalesce(p_loja_id, '')), '') is null then
    raise exception 'Loja não identificada.' using errcode = '22023';
  end if;

  -- ── A checagem que substitui o RLS ────────────────────────────────────
  -- Vem ANTES de qualquer escrita. `auth.jwt()` lê o claim que o PostgREST
  -- põe na conexão a partir do JWT da sessão; SECURITY DEFINER troca o papel,
  -- não o claim, então isto continua sendo a identidade real de quem chamou.
  -- Mesma comparação que a policy de UPDATE fazia:
  --   using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
  v_claim := auth.jwt() -> 'app_metadata' ->> 'loja_id';

  -- 42501 (insufficient_privilege) porque o PostgREST traduz para HTTP 403.
  -- Sessão sem claim de loja cai aqui também, e é o que se quer: token velho,
  -- emitido antes de a loja existir no app_metadata, não grava nada.
  if v_claim is null or v_claim <> p_loja_id then
    raise exception 'Esta sessão não tem permissão para gravar a credencial desta loja.'
      using errcode = '42501';
  end if;

  -- Nada digitado é nada a gravar. Evita bater em `atualizado_em` à toa.
  if v_token is null and v_secret is null then
    return;
  end if;

  -- ── Campo vazio MANTÉM o que está gravado ─────────────────────────────
  -- `coalesce(excluded.x, cred.x)`: valor novo quando veio, valor atual
  -- quando não veio. Sem isto, salvar só o webhook apagaria o access token —
  -- foi o bug de 23/08/2026, em que cada salvamento desfazia o anterior.
  --
  -- ON CONFLICT aqui é seguro: o `upsert` do PostgREST falhava porque o
  -- Postgres precisa ENXERGAR a linha conflitante, e RLS a escondia. Rodando
  -- como dono da função, não há RLS a esconder nada.
  insert into public.lf_credenciais_pagamento as cred
        (loja_id, mercadopago_access_token, mercadopago_webhook_secret, atualizado_em)
  values (p_loja_id, v_token, v_secret, now())
  on conflict (loja_id) do update
     set mercadopago_access_token   = coalesce(excluded.mercadopago_access_token,
                                               cred.mercadopago_access_token),
         mercadopago_webhook_secret = coalesce(excluded.mercadopago_webhook_secret,
                                               cred.mercadopago_webhook_secret),
         -- Relógio do servidor, não o do navegador.
         atualizado_em              = now();
end;
$$;

-- ── Quem pode chamar ────────────────────────────────────────────────────────
-- Função SECURITY DEFINER nasce executável por `public`. Tirar isso primeiro e
-- só então liberar para `authenticated` — `anon` nunca. (Conferido em
-- 23/08/2026: `anon` não tem GRANT nenhum nesta tabela; manter assim.)
revoke all on function public.salvar_credencial_mercadopago(text, text, text) from public;
revoke all on function public.salvar_credencial_mercadopago(text, text, text) from anon;
grant execute on function public.salvar_credencial_mercadopago(text, text, text) to authenticated;

-- ── Conferência depois de rodar (só leitura) ────────────────────────────────
-- Esperado: prosecdef = true, e o ACL com `authenticated=X` e sem `anon`.
select p.proname,
       p.prosecdef              as security_definer,
       p.proconfig              as config,
       pg_catalog.pg_get_userbyid(p.proowner) as dono,
       p.proacl                 as permissoes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname = 'public'
   and p.proname = 'salvar_credencial_mercadopago';
