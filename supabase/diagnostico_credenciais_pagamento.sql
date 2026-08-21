-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnóstico e contingência: "new row violates row-level security policy
-- for table lf_credenciais_pagamento" ao salvar o Access Token do Mercado Pago.
--
-- NÃO FOI EXECUTADO. Rode o BLOCO 1 (só leitura) antes de qualquer outra coisa.
--
-- ─── CAUSA JÁ IDENTIFICADA (corrigida no app) ───────────────────────────────
-- O código usava `.upsert(..., { onConflict: 'loja_id' })`, que vira
--   INSERT ... ON CONFLICT (loja_id) DO UPDATE
-- e o Postgres exige que a linha conflitante seja VISÍVEL por uma policy de
-- SELECT para resolver o conflito. Esta tabela não tem policy de SELECT
-- nenhuma — é o desenho que impede o token de voltar para o navegador.
--
-- Já corrigido em src/utils/credenciaisPagamento.js: agora é INSERT e, se der
-- 23505 (unique_violation), UPDATE. Nenhum dos dois precisa de SELECT.
--
-- Só rode os blocos 2 e 3 se o BLOCO 1 mostrar que também falta policy.
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ BLOCO 1 — DIAGNÓSTICO (só leitura, rode primeiro) ═══════════════════════

-- 1a. RLS está ligada?
select relname, relrowsecurity, relforcerowsecurity
  from pg_class
 where oid = 'public.lf_credenciais_pagamento'::regclass;

-- 1b. Quais policies existem? Esperado: insert, update e delete para
--     authenticated, e NENHUMA de select.
select polname,
       polcmd,
       polpermissive,
       (select array_agg(rolname) from pg_roles where oid = any(polroles)) as papeis,
       pg_get_expr(polqual,      polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
  from pg_policy
 where polrelid = 'public.lf_credenciais_pagamento'::regclass
 order by polcmd;

-- 1c. Quem tem GRANT na tabela? `authenticated` precisa de INSERT e UPDATE.
--     Se `anon` aparecer aqui, veja o bloco 3.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'lf_credenciais_pagamento'
 order by grantee, privilege_type;

-- 1d. A loja que está tentando salvar já tem linha? Se sim, o caminho é o
--     UPDATE, e é aí que o upsert quebrava.
select loja_id, atualizado_em,
       mercadopago_access_token   is not null as tem_token,
       mercadopago_webhook_secret is not null as tem_segredo
  from public.lf_credenciais_pagamento;

-- 1e. O JWT da lojista tem app_metadata.loja_id, e ele bate com lf_config?
--     Linha sem loja_id em app_metadata nunca passa no WITH CHECK.
select u.email,
       u.raw_app_meta_data ->> 'loja_id' as loja_id_no_jwt,
       c.loja_id                          as loja_id_no_config,
       (u.raw_app_meta_data ->> 'loja_id') is not distinct from c.loja_id as bate
  from auth.users u
  left join public.lf_config c on c.loja_id = u.raw_app_meta_data ->> 'loja_id'
 where u.raw_app_meta_data ? 'loja_id'
 order by 2;

-- ══ BLOCO 2 — CONTINGÊNCIA: recria as policies ══════════════════════════════
-- Rode SÓ se 1b vier vazio ou com expressão diferente da esperada.
-- É idempotente: pode rodar de novo sem estragar nada.

-- alter table public.lf_credenciais_pagamento enable row level security;
--
-- drop policy if exists "cred_pgto_insert_own_loja" on public.lf_credenciais_pagamento;
-- create policy "cred_pgto_insert_own_loja"
-- on public.lf_credenciais_pagamento for insert
-- to authenticated
-- with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));
--
-- drop policy if exists "cred_pgto_update_own_loja" on public.lf_credenciais_pagamento;
-- create policy "cred_pgto_update_own_loja"
-- on public.lf_credenciais_pagamento for update
-- to authenticated
-- using      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
-- with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));
--
-- drop policy if exists "cred_pgto_delete_own_loja" on public.lf_credenciais_pagamento;
-- create policy "cred_pgto_delete_own_loja"
-- on public.lf_credenciais_pagamento for delete
-- to authenticated
-- using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));
--
-- -- NENHUMA policy de SELECT, de propósito. Se alguém adicionar uma para
-- -- "fazer o upsert funcionar", o token passa a poder ser lido de volta pelo
-- -- navegador — que é exatamente o que este desenho evita. O app já não
-- -- depende mais de SELECT.
--
-- grant insert, update on public.lf_credenciais_pagamento to authenticated;

-- ══ BLOCO 3 — ENDURECIMENTO (opcional, recomendado) ═════════════════════════
-- Hoje a RLS barra o anon, mas o GRANT de tabela pode continuar existindo.
-- Tirar o grant deixa a proteção em duas camadas, como já fizemos em
-- lf_pedidos: mesmo que uma policy seja afrouxada por engano, o anon não passa.
--
-- revoke all on public.lf_credenciais_pagamento from anon;
