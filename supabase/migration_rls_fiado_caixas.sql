-- Migration: fecha a escrita anônima em merc_fiado e lf_caixas
-- Execute no Supabase Dashboard > SQL Editor. NÃO é rodada pelo app.
--
-- PROBLEMA (confirmado em 18/08/2026, com a anon key do bundle):
--   INSERT anônimo em merc_fiado → HTTP 201
--   INSERT anônimo em lf_caixas  → HTTP 201
--   DELETE anônimo em lf_caixas  → HTTP 204
--
-- merc_fiado guarda nome de cliente e quanto ele deve; lf_caixas guarda o
-- fechamento diário de 6 lojas. A anon key é pública por natureza — está no
-- bundle JavaScript —, então hoje qualquer pessoa lê a caderneta inteira e
-- apaga fechamento de caixa de loja paga.
--
-- SOLUÇÃO: mesma policy já aplicada e validada em lf_vendas
-- (migration_rls_clientes_vendas.sql) — escopo por loja_id vindo do JWT.
-- Confirmado que o token da loja carrega o claim:
--   app_metadata = {"loja_id":"mercadodemo","provider":"email",...}
--
-- ATENÇÃO À ORDEM: rodar ANTES do deploy não quebra nada (o app já autentica
-- como a loja há tempos). Rodar DEPOIS também serve. O que não pode é rodar
-- só metade — as duas seções são a mesma correção.

-- ---------------------------------------------------------------------------
-- 1) merc_fiado
--
-- migration_merc_fiado_rls.sql deixou esta tabela com RLS DESABILITADA, e a
-- alternativa que ficou comentada lá (linhas 33-37) era
-- `TO anon, authenticated USING (true)` — RLS ligada com a porta aberta, que
-- não protege nada. Por isso aqui vai uma policy nova, não aquela.

ALTER TABLE merc_fiado ENABLE ROW LEVEL SECURITY;

-- Defensivo: se a policy aberta chegou a ser aplicada em algum momento,
-- ligar RLS sem removê-la manteria a exposição.
DROP POLICY IF EXISTS merc_fiado_anon_all ON merc_fiado;

DROP POLICY IF EXISTS merc_fiado_own_loja ON merc_fiado;

CREATE POLICY merc_fiado_own_loja
    ON merc_fiado FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- Sem exceção de demo aqui de propósito: a única loja de Mercado é a
-- mercadodemo, e ela tem login próprio (é assim que o PDV e a tela de Fiado
-- já funcionam hoje). Nada acessa merc_fiado anonimamente.

-- ---------------------------------------------------------------------------
-- 2) lf_caixas
--
-- CUIDADO: apesar de ter aparecido numa investigação do Mercado, esta tabela
-- é o Fechamento de Caixa das DUAS plataformas. Hoje tem 86 linhas de 6
-- lojas, e a maioria é da Moda em produção:
--   estrada 31 · biastore 28 · teixeiramultimarcas 15 · encantodemulher 7
--   hmboutique 4 · mercadodemo 1
-- O raio de alcance é bem maior que "só a loja demo".
--
-- Quem escreve: LojaFeminina/useLojaData.js:433 (fecharCaixa) e :439
-- (deleteCaixa), usados tanto pelo Fechamento da Moda quanto pelo Caixa do
-- Mercado. Os dois autenticam como a loja, então passam na regra.

ALTER TABLE lf_caixas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_caixas_own_loja ON lf_caixas;

CREATE POLICY lf_caixas_own_loja
    ON lf_caixas FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- Espelha lf_vendas_demo. A demo 'sualoja' já tem exceção anônima em
-- lf_vendas; sem a equivalente aqui, fechar caixa na demo passaria a falhar.
-- Expõe só os caixas da própria loja de demonstração.
DROP POLICY IF EXISTS lf_caixas_demo ON lf_caixas;

CREATE POLICY lf_caixas_demo
    ON lf_caixas FOR ALL
    TO anon, authenticated
 USING      (loja_id = 'sualoja')
 WITH CHECK (loja_id = 'sualoja');

-- ---------------------------------------------------------------------------
-- Conferência

-- 1) RLS ligada nas duas:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('merc_fiado','lf_caixas');

-- 2) As 3 policies criadas:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('merc_fiado','lf_caixas') ORDER BY tablename, policyname;

-- 3) Nenhuma linha deve sair pela anon key (rodar no terminal, sem login):
--    curl "$SUPABASE_URL/rest/v1/merc_fiado?select=*" -H "apikey: $ANON"  → []
--    curl "$SUPABASE_URL/rest/v1/lf_caixas?select=*"  -H "apikey: $ANON"  → só sualoja

-- 4) Nenhuma linha foi perdida (contar com service_role):
--    merc_fiado deve seguir com 8 · lf_caixas com 86
