-- ─────────────────────────────────────────────────────────────────────────────
-- Diagnóstico SÓ LEITURA — estado da credencial de pagamento da Tropicale.
--
-- NÃO FOI EXECUTADO. Não altera nada: só SELECT.
--
-- Motivo de não ter rodado daqui: VITE_SUPABASE_SERVICE_KEY está VAZIA no .env
-- local (0 caracteres — o .env foi puxado do Vercel e a variável veio sem
-- valor). Com a anon key não dá: lf_credenciais_pagamento não tem policy de
-- SELECT nenhuma, de propósito, então nem a própria lojista lê o token de
-- volta. Rode no SQL Editor do Supabase, que roda como service_role.
--
-- Responde exatamente as três perguntas do pedido:
--   1. existe linha para a loja?
--   2. quais campos estão preenchidos e quais estão nulos?
--   3. o Thiago vai precisar pedir os valores de novo?  (a query 3 responde
--      direto, em português)
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ 0. Confirmar o slug certo da loja ═══════════════════════════════════════
-- O código chama de `loja_id`. Confirme aqui antes de olhar o resto: o valor
-- que aparecer nesta coluna é o que deve casar na tabela de credenciais.
select loja_id,
       nome,
       mercadopago_ativo
  from public.lf_config
 where loja_id ilike '%tropical%'
    or nome    ilike '%tropical%';

-- ══ 1 e 2. Existe linha? Quais campos estão preenchidos? ════════════════════
-- Sem expor os segredos: só comprimento, prefixo e nulidade. Comprimento já
-- basta para saber se o valor presta — access token de produção do Mercado
-- Pago tem ~70 caracteres e começa com "APP_USR-".
select c.loja_id,
       c.atualizado_em,
       (c.mercadopago_access_token   is not null) as tem_access_token,
       length(c.mercadopago_access_token)          as tam_access_token,
       left(coalesce(c.mercadopago_access_token, ''), 8) as prefixo_access_token,
       (c.mercadopago_webhook_secret is not null) as tem_webhook_secret,
       length(c.mercadopago_webhook_secret)        as tam_webhook_secret
  from public.lf_credenciais_pagamento c
 where c.loja_id ilike '%tropical%';

-- ══ 3. Resposta direta: precisa pedir de novo? ══════════════════════════════
-- Troque o slug abaixo pelo que a query 0 devolveu, se for diferente.
select case
         when c.loja_id is null
           then 'NÃO EXISTE LINHA — pedir Access Token E chave do webhook.'
         when c.mercadopago_access_token is null and c.mercadopago_webhook_secret is null
           then 'LINHA EXISTE, MAS OS DOIS CAMPOS ESTÃO NULOS — pedir os dois de novo.'
         when c.mercadopago_access_token is null
           then 'FALTA SÓ O ACCESS TOKEN — o webhook já está gravado.'
         when c.mercadopago_webhook_secret is null
           then 'FALTA SÓ A CHAVE DO WEBHOOK — o access token já está gravado.'
         when length(c.mercadopago_access_token) < 40
           then 'OS DOIS PREENCHIDOS, MAS O TOKEN É CURTO DEMAIS (' ||
                length(c.mercadopago_access_token) ||
                ' chars) — provavelmente não é access token; pedir de novo.'
         else 'OS DOIS PREENCHIDOS E COM CARA DE VÁLIDOS — não precisa pedir nada.'
       end as veredito
  from (select 'tropicaleatacado'::text as slug) p
  left join public.lf_credenciais_pagamento c on c.loja_id = p.slug;

-- ══ 4. Por que o app não conseguia atualizar — checar GRANT e policy ════════
-- Investigação paralela: o 409 do console é o caminho NORMAL (INSERT bate na
-- PK e o app cai no UPDATE em seguida). Mas se faltar o GRANT de UPDATE para
-- `authenticated`, o UPDATE volta 403 e nada é gravado.
--
-- Esperado em 4a: linhas para `authenticated` com INSERT e UPDATE.
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public'
   and table_name   = 'lf_credenciais_pagamento'
 order by grantee, privilege_type;

-- Esperado em 4b: policies de insert, update e delete para authenticated,
-- e NENHUMA de select (é o desenho que impede o token de voltar ao navegador).
select polname,
       polcmd,
       (select array_agg(rolname) from pg_roles where oid = any(polroles)) as papeis,
       pg_get_expr(polqual,      polrelid) as using_expr,
       pg_get_expr(polwithcheck, polrelid) as with_check_expr
  from pg_policy
 where polrelid = 'public.lf_credenciais_pagamento'::regclass
 order by polcmd;

-- ══ 5. O JWT da lojista carrega app_metadata.loja_id? ══════════════════════
-- As policies comparam `loja_id` com (auth.jwt() -> 'app_metadata' ->> 'loja_id').
-- Usuário sem esse claim nunca passa no WITH CHECK — e o UPDATE não acha linha.
select u.email,
       u.raw_app_meta_data ->> 'loja_id' as loja_id_no_jwt,
       c.loja_id                          as loja_id_no_config,
       (u.raw_app_meta_data ->> 'loja_id') is not distinct from c.loja_id as bate
  from auth.users u
  left join public.lf_config c on c.loja_id = u.raw_app_meta_data ->> 'loja_id'
 where u.raw_app_meta_data ->> 'loja_id' ilike '%tropical%'
 order by u.email;
