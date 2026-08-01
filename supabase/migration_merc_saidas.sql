-- Migration: merc_saidas — saídas de caixa do Mercado (T10)
-- Execute no Supabase Dashboard > SQL Editor ANTES de usar a tela de Caixa.
--
-- MOTIVO
-- A T10 mostra "Saiu / R$ X" e tem "Anotar saída" no rodapé, mas não havia
-- onde guardar cada saída: lf_caixas.sangria e lf_caixas.despesas são totais
-- agregados, gravados só no momento do fechamento. Sem uma linha por saída o
-- card não tem de onde ler durante o dia, e o histórico se perderia.
--
-- Cada saída é uma linha. O card "Saiu" da T10 soma as do dia; no fechamento
-- (T13) o total vai para lf_caixas.despesas, e as linhas individuais
-- continuam existindo como histórico.

CREATE TABLE IF NOT EXISTS merc_saidas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     text        NOT NULL,
  valor       numeric     NOT NULL,
  descricao   text,
  categoria   text,       -- troco, despesa, sangria, outro
  data        date        NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz DEFAULT now()
);

-- RLS desabilitado, alinhando com as tabelas lf_* (loja_feminina.sql:80-84),
-- merc_fiado e merc_precos_faixas. O app roda com a chave anon; com RLS
-- habilitado e sem policy o INSERT falha com 42501 e o SELECT devolve []
-- em silêncio — foi assim que merc_fiado e merc_precos_faixas quebraram.
ALTER TABLE merc_saidas DISABLE ROW LEVEL SECURITY;

-- A tela sempre consulta por loja e dia.
CREATE INDEX IF NOT EXISTS merc_saidas_loja_data
  ON merc_saidas (loja_id, data DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência
--
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'merc_saidas';
--   → relrowsecurity deve ser false
--
-- Teste real com a chave anon (o SELECT vazio não prova nada — só o INSERT):
--   INSERT INTO merc_saidas (loja_id, valor, descricao, categoria, data)
--   VALUES ('mercadodemo', 1, 'teste', 'outro', CURRENT_DATE);
--   DELETE FROM merc_saidas WHERE descricao = 'teste';
