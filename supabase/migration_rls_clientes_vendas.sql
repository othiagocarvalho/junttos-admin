-- Migration: liga RLS em lf_clientes e lf_vendas
-- Execute no Supabase Dashboard > SQL Editor.
--
-- Motivo: as duas tabelas estavam com RLS desligada e, com a anon key (que e
-- publica por natureza), qualquer um lia 1.442 clientes -- nome, telefone,
-- email, CPF/CNPJ, endereco completo -- e 4.418 vendas com nome e telefone do
-- comprador. Sao dados de terceiros: os consumidores das lojistas.
--
-- Criterio da policy: o lojista autentica de verdade no Supabase Auth
-- (ClientAuthContext usa signInWithPassword) e o ClientPrivateRoute exige
-- app_metadata.loja_id batendo com a loja da URL. Entao todo mundo que chega
-- no painel tem esse claim no JWT, e ele e a chave da regra abaixo.
--
-- Cada comando esta separado de proposito. Rode de cima para baixo; se algum
-- falhar, da para executar um por vez e ver qual foi.


-- ---------------------------------------------------------------------------
-- 1) lf_clientes

ALTER TABLE lf_clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_clientes_own_loja ON lf_clientes;

CREATE POLICY lf_clientes_own_loja
    ON lf_clientes FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));


-- Excecao da loja demo. Ver secao 3 no fim do arquivo.

DROP POLICY IF EXISTS lf_clientes_demo ON lf_clientes;

CREATE POLICY lf_clientes_demo
    ON lf_clientes FOR ALL
    TO anon, authenticated
 USING      (loja_id = 'sualoja')
 WITH CHECK (loja_id = 'sualoja');


-- ---------------------------------------------------------------------------
-- 2) lf_vendas

ALTER TABLE lf_vendas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_vendas_own_loja ON lf_vendas;

CREATE POLICY lf_vendas_own_loja
    ON lf_vendas FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));


DROP POLICY IF EXISTS lf_vendas_demo ON lf_vendas;

CREATE POLICY lf_vendas_demo
    ON lf_vendas FOR ALL
    TO anon, authenticated
 USING      (loja_id = 'sualoja')
 WITH CHECK (loja_id = 'sualoja');


-- ---------------------------------------------------------------------------
-- 3) Por que a excecao da demo e um loja_id literal
--
-- O DemoPanel do admin popula e reseta a loja "Sua Loja" com dados ficticios
-- (Ana Carolina Silva, Fernanda Rocha etc.). Ele roda no painel admin, que NAO
-- usa Supabase Auth -- a autenticacao ali e a lista de src/auth/users.js
-- guardada no localStorage -- entao o navegador do admin e sempre `anon` e
-- nunca teria um JWT com loja_id para satisfazer a policy de cima.
--
-- A excecao esta fixa em 'sualoja', e nao em algo como status = 'demo', por
-- dois motivos:
--
--   a) status = 'demo' abriria tambem a loja `catalogob2bdemo`, que carrega o
--      mesmo status no banco e nao precisa de acesso anonimo;
--   b) status e um campo editavel pelo painel -- alguem marcando uma loja real
--      como demo abriria os dados dela sem perceber. O loja_id nao muda.
--
-- Consequencia aceita: os dados de 'sualoja' seguem legiveis e gravaveis por
-- qualquer um com a anon key. Sao dados inventados pelo proprio DemoPanel, que
-- os apaga e recria a cada reset.
--
-- Se um dia o painel admin passar a ter sessao Supabase de verdade, estas duas
-- policies `_demo` podem ser removidas e nada mais precisa mudar.


-- ---------------------------------------------------------------------------
-- Conferencia (rode depois, separadamente)

-- 1) RLS ligada nas duas -- relrowsecurity deve ser true:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('lf_clientes','lf_vendas');

-- 2) As 4 policies criadas:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('lf_clientes','lf_vendas') ORDER BY tablename, policyname;

-- 3) O teste que importa -- rode no terminal, fora do SQL Editor, com a anon
--    key. Antes: 1442 e 4418. Depois: so as linhas da loja demo.
--
--    curl "$SUPABASE_URL/rest/v1/lf_clientes?select=id" \
--      -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
--      -H "Prefer: count=exact" -I | grep -i content-range
--
--    Esperado: 9 clientes e 95 vendas (todas de 'sualoja'), em vez do total.
