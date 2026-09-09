-- ═══════════════════════════════════════════════════════════════════════════
-- ►► JÁ EXECUTADO EM 23/08/2026. CAUSA RAIZ ENCONTRADA. ◄◄
--
--   bloco 2 (policies)  → USING do UPDATE idêntica ao WITH CHECK do INSERT
--   bloco 5 (o UPDATE)  → linhas_afetadas = 0
--   experimento extra   → o MESMO update SEM WHERE afeta 1 linha
--
-- O WHERE era a causa. Ver supabase/correcao_tropicale_update_credenciais.sql
-- para a evidência completa e para a armadilha a evitar. Este arquivo fica
-- como registro do caminho percorrido.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- Tropicale — o PATCH devolve 204 e o token no banco não muda. Quantas linhas
-- o UPDATE realmente pega: 0 ou 1?
--
-- NÃO EXECUTADO POR MIM. Rode no SQL Editor do Supabase (roda como service_role).
--
-- NÃO ALTERA NADA. O único bloco que escreve (o 5) roda dentro de
-- `begin … rollback` e é desfeito. Rode o bloco 5 INTEIRO, do `begin;` ao
-- `rollback;`, de uma vez só — parar no meio deixa transação aberta.
--
-- Nenhuma query aqui devolve o valor de credencial nenhuma: só comprimento,
-- nulidade e timestamp.
--
-- ─── ANTES DE RODAR QUALQUER COISA: A RESPOSTA PODE JÁ ESTAR NO DEVTOOLS ────
-- A sessão que você capturou já contém a prova. No DevTools → Network → clique
-- no PATCH que voltou 204 → aba Headers → Response Headers → `content-range`:
--
--   content-range: */0     → ZERO linhas. A hipótese "UPDATE não casa linha"
--                            está certa; siga para os blocos 2 e 5.
--   content-range: 0-0/1   → UMA linha casou e foi gravada. O problema NÃO é
--                            a policy; é onde você está lendo o valor (bloco 1).
--   (header ausente)       → o bundle em produção é ANTERIOR ao fix de
--                            22/08/2026 (b12d2ee). Sem `Prefer: count=exact` o
--                            app não detecta o no-op. Redeploy antes de tudo.
--
-- Medido em 23/08/2026 contra este projeto: um PATCH que casa zero linhas
-- responde `204` + `content-range: */0`, e `Content-Range` está em
-- `access-control-expose-headers`, então o navegador consegue lê-lo.
-- ─────────────────────────────────────────────────────────────────────────────


-- ══ 1. O valor mudou mesmo? E os bytes do loja_id batem? ════════════════════
-- `atualizado_em` é escrito em TODO salvamento, junto com o token. Se ele
-- avançou e o token não, o UPDATE pegou a linha e o problema é outro.
-- O hex expõe espaço em branco e caractere invisível que o olho não vê.
select c.loja_id,
       encode(convert_to(c.loja_id, 'UTF8'), 'hex')   as loja_id_em_hex,
       length(c.loja_id)                              as tam_loja_id,
       c.loja_id = 'tropicaleatacado'                 as casa_o_filtro_do_codigo,
       c.atualizado_em,
       now() - c.atualizado_em                        as tempo_desde_ultima_gravacao,
       length(c.mercadopago_access_token)             as tam_token,
       length(c.mercadopago_webhook_secret)           as tam_webhook_secret
  from public.lf_credenciais_pagamento c
 where c.loja_id ilike '%tropical%';

-- Tipo da coluna: `character` (bpchar) tem semântica de espaço à direita
-- diferente de `text` e faria `=` se comportar de forma inesperada.
select column_name, data_type, character_maximum_length
  from information_schema.columns
 where table_schema = 'public'
   and table_name   = 'lf_credenciais_pagamento'
 order by ordinal_position;


-- ══ 2. As policies: USING do UPDATE vs WITH CHECK do INSERT ═════════════════
-- No arquivo supabase/migration_mercadopago_pix.sql as duas expressões são
-- IDÊNTICAS. Se aqui aparecerem diferentes, o banco não está com a versão do
-- arquivo — e a diferença é a causa raiz.
select polname,
       case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE'
                   else polcmd::text end             as comando,
       (select array_agg(rolname) from pg_roles where oid = any(polroles)) as papeis,
       pg_get_expr(polqual,      polrelid)           as using_expr,
       pg_get_expr(polwithcheck, polrelid)           as with_check_expr
  from pg_policy
 where polrelid = 'public.lf_credenciais_pagamento'::regclass
 order by polcmd;


-- ══ 3. GRANTs — inclusive por coluna ════════════════════════════════════════
-- GRANT de UPDATE que não cubra `mercadopago_access_token` faria a coluna ser
-- recusada. (Recusa com erro, não em silêncio — mas confirma o desenho.)
select grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema = 'public' and table_name = 'lf_credenciais_pagamento'
 order by grantee, privilege_type;

select grantee, column_name, privilege_type
  from information_schema.column_privileges
 where table_schema = 'public' and table_name = 'lf_credenciais_pagamento'
 order by grantee, column_name;


-- ══ 4. Trigger que descarte a alteração ═════════════════════════════════════
-- Um BEFORE UPDATE que devolva OLD sobrescreveria o token calado, com count=1.
select tgname,
       pg_get_triggerdef(oid) as definicao
  from pg_trigger
 where tgrelid = 'public.lf_credenciais_pagamento'::regclass
   and not tgisinternal;


-- ══ 5. A PROVA: o UPDATE real, como a lojista, e depois DESFEITO ════════════
-- Reproduz exatamente o que o navegador manda — mesmo papel (`authenticated`),
-- mesmo claim de JWT, mesmo filtro — e conta as linhas afetadas.
--
-- Não precisa de usuário de teste: `set local request.jwt.claims` é a fonte de
-- onde `auth.jwt()` lê. E não grava: o `rollback` no fim desfaz tudo.
--
-- Só mexe em `atualizado_em`. O token NÃO é tocado em hipótese nenhuma.
--
-- linhas_afetadas = 0 → a USING da policy não casa a linha. Causa raiz na policy.
-- linhas_afetadas = 1 → a policy está correta e o UPDATE grava. Causa é outra.
begin;

  set local role authenticated;
  set local request.jwt.claims =
    '{"role":"authenticated","app_metadata":{"loja_id":"tropicaleatacado"}}';

  with alvo as (
    update public.lf_credenciais_pagamento
       set atualizado_em = now()
     where loja_id = 'tropicaleatacado'
    returning 1
  )
  select count(*) as linhas_afetadas from alvo;

rollback;
-- ↑ confira que rodou: nada acima deve ter sido gravado.


-- ══ 6. O claim do JWT de cada usuário da loja ═══════════════════════════════
-- Usuário sem `app_metadata.loja_id` nunca passa na USING — e o UPDATE vira
-- no-op silencioso mesmo com a policy escrita corretamente.
select u.email,
       u.raw_app_meta_data ->> 'loja_id'                     as loja_id_no_jwt,
       encode(convert_to(coalesce(u.raw_app_meta_data ->> 'loja_id', ''), 'UTF8'), 'hex')
                                                             as claim_em_hex,
       (u.raw_app_meta_data ->> 'loja_id') = 'tropicaleatacado' as claim_bate_exato,
       u.last_sign_in_at
  from auth.users u
 where u.raw_app_meta_data ->> 'loja_id' ilike '%tropical%'
    or u.email ilike '%tropical%'
 order by u.last_sign_in_at desc nulls last;
