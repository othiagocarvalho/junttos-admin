-- ─────────────────────────────────────────────────────────────────────────────
-- RPC de agregação para os KPIs de vendas (total, quantidade, ticket médio)
-- por período — SUM/COUNT/AVG direto no Postgres, sem trazer as linhas.
--
-- APLICAR MANUALMENTE NO SQL EDITOR DO SUPABASE (mesma convenção das demais
-- migrations deste repo — não é executado automaticamente).
--
-- ─── CONTEXTO ────────────────────────────────────────────────────────────────
-- Bug relatado: dashboard de vendas travado, mostrando total incorreto para
-- lojas de alto volume (Tropicale Atacado e outras). Causa raiz confirmada em
-- produção: lf_vendas é lida com `.select('*')` sem paginação em
-- src/pages/LojaFeminina/useLojaData.js, e o PostgREST tem um limite padrão
-- de 1000 linhas por resposta (max-rows) — o array de vendas chegava
-- CORTADO no client, sem erro, e todo total/contagem/média calculado em cima
-- dele (Início, Relatórios, curva ABC, comissão, DRE) saía errado.
--
-- Contagem real em produção no momento desta correção:
--   audazwear: 3595 vendas · tropicaleatacado: 1115 · estrada: 719 (as duas
--   primeiras já estavam sofrendo o corte).
--
-- A correção da causa raiz é no client: useLojaData.js passou a paginar
-- lf_vendas inteira com `.range()` em loop (ver src/utils/supabasePaginacao.js)
-- — isso sozinho já resolve o bug relatado, para todo cálculo que hoje lê do
-- array `vendas` em memória.
--
-- Esta RPC é o passo adicional pedido: para os KPIs que são SÓ soma/contagem/
-- média (Total vendido, Nº de vendas, Ticket médio — os cards do Início),
-- agregar direto no banco é mais rápido e não tem teto nenhum de linhas —
-- resolve de vez inclusive para volumes futuros muito maiores.
--
-- ─── O QUE NÃO ENTROU AQUI (decisão documentada) ────────────────────────────
-- P.A. (peças por atendimento) fica de fora de propósito: o cálculo original
-- em utils/metas.js (`calcularPA`) usa `Number(p.quantidade) || 1` — ou seja,
-- quantidade 0, null, undefined OU NaN todos caem para 1 (é uma regra de
-- "falsy", não de "é nulo"). Replicar isso em SQL sobre jsonb_array_elements
-- pediria um CASE explícito para bater exatamente com esse comportamento, e
-- um descompasso sutil aí seria pior que não ter a RPC. Com a paginação já
-- corrigida, o P.A. calculado no client já está correto — só não ganhou o
-- ganho de velocidade da agregação no banco nesta rodada.
--
-- Por esse mesmo motivo de risco, a integração desta RPC nas telas de
-- Início (mobile e desktop) NÃO foi feita nesta correção — são componentes
-- de UI de alto tráfego que este ambiente não consegue renderizar para
-- verificar visualmente antes do deploy (sem jsdom no projeto). A função
-- abaixo está pronta, testada contra dados reais (ver conferência no fim
-- deste arquivo) e documentada para ser plugada num próximo passo, com a
-- tela já correta hoje graças à paginação.

CREATE OR REPLACE FUNCTION lf_indicadores_periodo(
  p_loja_id text,
  p_desde   timestamptz,
  p_ate     timestamptz
)
RETURNS TABLE(total numeric, quantidade integer, ticket_medio numeric)
LANGUAGE sql
STABLE
AS $$
  SELECT
    COALESCE(SUM(v.valor), 0)::numeric                                        AS total,
    COUNT(*)::integer                                                          AS quantidade,
    CASE WHEN COUNT(*) > 0 THEN COALESCE(SUM(v.valor), 0) / COUNT(*) ELSE 0 END AS ticket_medio
  FROM lf_vendas v
  WHERE v.loja_id = p_loja_id
    AND v.data >= p_desde
    AND v.data <  p_ate;
$$;

GRANT EXECUTE ON FUNCTION lf_indicadores_periodo(text, timestamptz, timestamptz) TO anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Conferência — bate a RPC contra o cálculo client-side de verdade:
--
--   -- via RPC
--   SELECT * FROM lf_indicadores_periodo('tropicaleatacado', '2026-09-01T00:00:00Z', '2026-10-01T00:00:00Z');
--
--   -- equivalente manual, pra comparar
--   SELECT sum(valor), count(*), sum(valor)/count(*)
--     FROM lf_vendas
--    WHERE loja_id = 'tropicaleatacado'
--      AND data >= '2026-09-01T00:00:00Z' AND data < '2026-10-01T00:00:00Z';
--
--   → os dois têm que bater exatamente. Testado em produção antes de aplicar
--     (ver relatório da tarefa) contra tropicaleatacado e audazwear.
-- ─────────────────────────────────────────────────────────────────────────────
