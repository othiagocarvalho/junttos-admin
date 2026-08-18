-- Migration: fecha a escrita anônima nas tabelas lf_*/merc_* restantes
-- Execute no Supabase Dashboard > SQL Editor. NÃO é rodada pelo app.
--
-- CONTEXTO
-- supabase/loja_feminina.sql:79-83 desligou RLS em bloco, e as migrations
-- posteriores repetiram o padrão. lf_clientes, lf_vendas, lf_caixas e
-- merc_fiado já foram resgatadas. Esta migration cobre o GRUPO 1 da varredura
-- de 18/08/2026 — as tabelas em que só a loja logada escreve.
--
-- Medido com a anon key (pública, está no bundle): 750 linhas legíveis e
-- escrita liberada em 23 tabelas. Esta migration fecha 11 delas.
--
-- O QUE NÃO ESTÁ AQUI, DE PROPÓSITO — ver o relatório:
--   lf_pedidos, lf_produtos, lf_estoque_mov → checkout público do catálogo
--   lf_config                               → escrita pelo painel admin
--   bal_* (4)                               → tabelas-filhas sem loja_id
--   jt_* (4)                                → dados da Junttos, outro modelo
--
-- PADRÃO
-- Idêntico ao já aplicado e validado em lf_vendas / lf_caixas / merc_fiado:
--   own_loja → authenticated, loja_id casando com o claim do JWT
--   _demo    → anon + authenticated, restrito a loja_id = 'sualoja'
--
-- A exceção _demo não é decorativa: 'sualoja' é o DEMO_LOJA_ID que o painel
-- admin (pages/admin/DemoPanel.jsx:6) manipula, e o admin NÃO tem loja_id no
-- JWT — sem ela, o Painel Demo quebra. Ela também mantém funcionando os 5
-- scripts de validação que rodam com anon key contra a sualoja.
--
-- Rodar tudo de uma vez. Meia aplicação deixa metade das tabelas aberta.

BEGIN;

-- ---------------------------------------------------------------------------
-- Bloco A — tabelas da Moda (lf_*), com exceção de demo
--
-- Escrita hoje: LojaFeminina/useLojaData.js, Financeiro.jsx,
-- cliente/FinanceiroDesktop.jsx — todas autenticadas como a loja.
-- Mais o DemoPanel do admin, que só toca a 'sualoja'.

-- lf_compras           · compras/entradas de mercadoria
-- lf_contas_pagar      · contas a pagar do Financeiro
-- lf_contas_receber    · contas a receber do Financeiro
-- lf_corrida           · corrida de vendedoras
-- lf_followup_dispensado · follow-ups que a loja dispensou no CRM
-- lf_fornecedores      · fornecedores (criados sozinhos na venda)
-- lf_lembretes         · lembretes do CRM
-- lf_metas             · metas mensais
-- lf_recorrencias      · regras de conta recorrente

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'lf_compras', 'lf_contas_pagar', 'lf_contas_receber', 'lf_corrida',
    'lf_followup_dispensado', 'lf_fornecedores', 'lf_lembretes',
    'lf_metas', 'lf_recorrencias'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_own_loja', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL TO authenticated
        USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
        WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
    $f$, t || '_own_loja', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_demo', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL TO anon, authenticated
        USING (loja_id = 'sualoja') WITH CHECK (loja_id = 'sualoja')
    $f$, t || '_demo', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Bloco B — tabelas do Mercado (merc_*), SEM exceção de demo
--
-- A única loja de Mercado é a mercadodemo e ela tem login próprio — nada
-- acessa essas tabelas anonimamente pelo app. Mesma decisão já tomada em
-- merc_fiado.
--
-- ATENÇÃO: dois scripts de desenvolvimento rodam com ANON key contra a
-- mercadodemo e vão passar a falhar (ver relatório):
--   scripts/seed-mercadodemo-atacarejo.mjs → merc_precos_faixas
--   scripts/seed-mercadodemo-caixa.mjs     → merc_saidas, lf_contas_pagar
-- Correção: rodar com SUPABASE_SERVICE_KEY, como os outros seeds do Mercado
-- já fazem. Não é funcionalidade de cliente.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['merc_precos_faixas', 'merc_saidas'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_own_loja', t);
    EXECUTE format($f$
      CREATE POLICY %I ON %I FOR ALL TO authenticated
        USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
        WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
    $f$, t || '_own_loja', t);
  END LOOP;
END $$;

COMMIT;

-- ---------------------------------------------------------------------------
-- CONFERÊNCIA

-- 1) RLS ligada nas 11:
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('lf_compras','lf_contas_pagar','lf_contas_receber',
--                    'lf_corrida','lf_followup_dispensado','lf_fornecedores',
--                    'lf_lembretes','lf_metas','lf_recorrencias',
--                    'merc_precos_faixas','merc_saidas')
--  ORDER BY relname;

-- 2) Policies criadas (esperado: 20 = 9 lf_ × 2 + 2 merc_ × 1):
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename IN ('lf_compras','lf_contas_pagar','lf_contas_receber',
--                      'lf_corrida','lf_followup_dispensado','lf_fornecedores',
--                      'lf_lembretes','lf_metas','lf_recorrencias',
--                      'merc_precos_faixas','merc_saidas')
--  ORDER BY tablename, policyname;

-- 3) Anônimo não deve mais ler nada além da sualoja:
--    curl "$SUPABASE_URL/rest/v1/lf_contas_pagar?select=loja_id" -H "apikey: $ANON"
--    (hoje devolve 13 linhas; depois, só as de sualoja)

-- 4) Nenhuma linha perdida — contar com service_role antes e depois.
--    Contagens em 18/08/2026: lf_compras 0 · lf_contas_pagar 13 ·
--    lf_contas_receber 2 · lf_corrida 4 · lf_followup_dispensado 2 ·
--    lf_fornecedores 3 · lf_lembretes 5 · lf_metas 10 · lf_recorrencias 1 ·
--    merc_precos_faixas 4 · merc_saidas 2

-- ROLLBACK, se algo quebrar em produção:
-- ALTER TABLE <tabela> DISABLE ROW LEVEL SECURITY;
