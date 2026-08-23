-- ─────────────────────────────────────────────────────────────────────────────
-- Tropicale — PATCH 204 com `content-range: */0`, token nunca gravado.
-- CAUSA RAIZ CONFIRMADA em 23/08/2026, medida no banco de produção.
--
-- ►► NÃO É PRECISO RODAR NADA AQUI. A correção é em código. ◄◄
--
-- Este arquivo existe por dois motivos:
--   1. registrar a evidência, para ninguém reinvestigar do zero;
--   2. avisar sobre a "correção óbvia" que ARROMBA a segurança (seção C).
-- ─────────────────────────────────────────────────────────────────────────────

-- ══ A. A EVIDÊNCIA ══════════════════════════════════════════════════════════
-- Rodado como `authenticated`, com o claim real da Tropicale
-- (app_metadata.loja_id = 'tropicaleatacado'), dentro de bloco abortado por
-- RAISE EXCEPTION — nada foi gravado:
--
--     select visível                            → 0 linhas
--     update ... WHERE loja_id = 'tropicale…'   → 0 linhas   ← o bug
--     update ...  (sem WHERE)                   → 1 linha
--
-- Descartados por medição, não por suposição:
--   • policies      — USING do UPDATE é IDÊNTICA ao WITH CHECK do INSERT;
--   • loja_id       — hex do banco = hex do claim = 74726f7069…, 16 bytes;
--   • tipo          — `text`, sem semântica de espaço à direita;
--   • GRANT         — `authenticated` tem INSERT, UPDATE, SELECT e DELETE;
--   • trigger       — nenhum trigger não-interno na tabela;
--   • deploy        — o `*/0` prova que `Prefer: count=exact` foi enviado,
--                     logo o bundle em produção já tinha o fix de 22/08.
--
-- O mecanismo: coluna citada no WHERE exige permissão de SELECT, e isso faz o
-- Postgres aplicar as policies de SELECT. Esta tabela não tem nenhuma, DE
-- PROPÓSITO (é o que impede o token de voltar ao navegador). Sem policy de
-- SELECT a linha fica invisível para o WHERE, o UPDATE casa zero linhas, e o
-- PostgREST devolve 204 sem erro nenhum.
--
-- É a mesma raiz do bug do upsert de antes: `ON CONFLICT DO UPDATE` também
-- precisava enxergar a linha. Trocar upsert por UPDATE não resolveu — trocou
-- um erro barulhento por um no-op mudo.


-- ══ B. A CORREÇÃO (já aplicada, em código) ══════════════════════════════════
-- src/utils/credenciaisPagamento.js: o UPDATE perdeu o `.eq('loja_id', …)`.
-- Quem recorta por loja passa a ser o RLS, que é onde o Postgres consegue
-- aplicar o recorte:
--
--     using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
--
-- e `loja_id` é a chave primária, então no máximo uma linha casa. Foi o que a
-- medição mostrou: exatamente 1. O código também passou a tratar count > 1
-- como erro, já que sem WHERE o RLS é a única barreira entre lojas.
--
-- Nenhum DDL. Nenhuma mudança de policy. Nada a rodar aqui.


-- ══ C. ⚠ A ARMADILHA — NÃO FAÇA ISTO ════════════════════════════════════════
-- A "correção óbvia" para um WHERE que não enxerga a linha é criar uma policy
-- de SELECT. NÃO CRIE — não sozinha.
--
-- Conferido em 23/08/2026: `authenticated` JÁ TEM GRANT DE SELECT NA TABELA
-- INTEIRA. O que impede a lojista de ler o access token hoje é só a ausência
-- da policy. Uma linha inocente como
--
--     create policy … for select to authenticated using (loja_id = …);   -- ⚠ NÃO
--
-- entrega `mercadopago_access_token` e `mercadopago_webhook_secret` para
-- qualquer `select *` do navegador — exatamente o vazamento que o desenho
-- desta tabela existe para evitar.
--
-- Se algum dia FOR mesmo necessário ter policy de SELECT aqui (para voltar a
-- usar WHERE, ou para upsert), as duas coisas têm de andar juntas, nesta
-- ordem, e o revoke vem PRIMEIRO:
--
--     revoke select (mercadopago_access_token, mercadopago_webhook_secret)
--       on public.lf_credenciais_pagamento from authenticated, anon;
--
--     grant select (loja_id, atualizado_em)
--       on public.lf_credenciais_pagamento to authenticated;
--
--     create policy "cred_pgto_select_own_loja"
--       on public.lf_credenciais_pagamento for select to authenticated
--       using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));
--
-- Aí `select loja_id` funciona e `select *` volta 403 por falta de permissão
-- de coluna. Enquanto a correção em código resolver, isto é superfície de
-- ataque comprada à toa — não rode.


-- ══ D. CONFERIR DEPOIS DO DEPLOY (só leitura) ═══════════════════════════════
-- A lojista salva o Access Token; rode isto. `atualizado_em` tem de sair de
-- 2026-08-21 20:47 e `tam_token` tem de sair de 14 para ~70.
select loja_id,
       atualizado_em,
       length(mercadopago_access_token)   as tam_token,
       length(mercadopago_webhook_secret) as tam_secret
  from public.lf_credenciais_pagamento
 where loja_id = 'tropicaleatacado';
