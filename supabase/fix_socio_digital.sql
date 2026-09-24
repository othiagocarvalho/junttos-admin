-- ============================================================================
-- Sócio Digital — relatório quinzenal SALVO (histórico fixo) + agendamento
-- Execute no Supabase Dashboard > SQL Editor. NÃO é rodado pelo app.
-- ============================================================================
--
-- ⚠️  EFEITO COLATERAL (aceito e aprovado pelo Thiago):
--     este arquivo ativa a extensão pg_cron para o PROJETO INTEIRO. Depois
--     disso, qualquer pessoa com acesso de administrador ao banco pode agendar
--     jobs. Hoje só existe o job 'socio-digital' (bloco 6).
--
-- O QUE FAZ
--   1. CREATE EXTENSION pg_cron
--   2. Tabela lf_socio_relatorios (1 linha por loja por quinzena)
--   3. RLS: a loja só LÊ os próprios relatórios. Ninguém escreve pelo app —
--      é isso que garante o "histórico fixo, nunca recalculado".
--   4. lf_config.socio_visto_periodo (aviso no banner)
--   5. Funções montar_dados_socio / gerar_relatorios_socio
--   6. cron.schedule — dias 1 e 16, 09:00 de Brasília
--
-- ─── POR QUE RLS LIGADA (e não DISABLE, como pedido originalmente) ─────────
-- O padrão DISABLE ROW LEVEL SECURITY é o ANTIGO (loja_feminina.sql:79-83).
-- A varredura de segurança de 08/2026 (migration_rls_varredura_completa.sql)
-- religou RLS em 20 das 23 tabelas lf_*: com a anon key — que é pública, está
-- no bundle — dava para ler e escrever qualquer loja. Uma tabela nova com RLS
-- desligada deixaria o faturamento de TODAS as lojas legível por qualquer
-- visitante. Aqui segue o padrão atual: own_loja (claim loja_id do JWT) +
-- exceção _demo para a 'sualoja' (Painel Demo do admin, que não tem loja_id).
--
-- ─── HORÁRIO ────────────────────────────────────────────────────────────────
-- pg_cron agenda em UTC. America/Sao_Paulo é UTC-03:00 o ano inteiro desde
-- 2019 (o Brasil aboliu o horário de verão) — conferido no próprio banco em
-- 23/09/2026: pg_timezone_names → utc_offset -03:00:00, is_dst false.
-- 09:00 BRT = 12:00 UTC → '0 12 1,16 * *'.
-- Se o horário de verão voltar a existir, o job passa a rodar às 10:00 no
-- verão — inofensivo (o relatório é de período já FECHADO).
--
-- ─── REGRAS DE NEGÓCIO (espelhadas do app) ──────────────────────────────────
--   · Venda válida: coalesce(status,'completa') = 'completa'. Exclui
--     pré-venda pendente ('aguardando_pagamento') e cancelada ('cancelada').
--   · Nº de vendas e ticket médio: mesma conta do Início
--     (utils/metas.js calcularIndicadores) — todas as vendas completas,
--     trocas inclusive; ticket = faturamento / nº de vendas.
--   · Trocas: lf_vendas.tipo_venda = 'troca'. NÃO por lf_estoque_mov
--     tipo='devolucao': medido em 23/09/2026, 77 dos 84 registros de
--     'devolucao' são "Venda excluída", não troca.
--   · Datas: lf_vendas.data é timestamptz; o dia da venda é o dia em
--     America/Sao_Paulo (o navegador da lojista também usa o fuso local).
--   · Cliente inativo: mesma regra do CRM (utils/crm.js isInativo) — tem ao
--     menos uma compra e a última foi há 45+ dias. Casamento por nome
--     normalizado (trim + lower), como o CRM faz.
--   · Crediário: parcela i vence em data_compra + i meses; paga se
--     i <= parcelas_pagas (utils/financeiro.js mesclarContasReceber).
--   · Estoque baixo: soma das variações entre 1 e 6 (AlertaBanner.jsx).
--   · Tudo é calculado relativo ao FIM do período (não ao dia em que o job
--     roda), para o relatório ser reprodutível. Exceção inevitável: estoque é
--     fotografia do momento da geração (não há histórico de saldo).
--
-- Sem limite de 1000 linhas: isso é da API REST do Supabase; aqui é SQL
-- direto no banco.
-- ============================================================================

BEGIN;

-- 1. pg_cron ------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Tabela -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lf_socio_relatorios (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  loja_id        text        NOT NULL,
  periodo_inicio date        NOT NULL,
  periodo_fim    date        NOT NULL,
  dados          jsonb       NOT NULL,
  gerado_em      timestamptz DEFAULT now(),
  -- Reexecução do cron (ou manual) não duplica e NÃO sobrescreve.
  UNIQUE (loja_id, periodo_inicio)
);

CREATE INDEX IF NOT EXISTS lf_socio_relatorios_loja_periodo
  ON lf_socio_relatorios (loja_id, periodo_inicio DESC);

-- 3. RLS — só leitura pelo app ------------------------------------------------
ALTER TABLE lf_socio_relatorios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_socio_relatorios_own_loja ON lf_socio_relatorios;
CREATE POLICY lf_socio_relatorios_own_loja ON lf_socio_relatorios
  FOR SELECT TO authenticated
  USING (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

DROP POLICY IF EXISTS lf_socio_relatorios_demo ON lf_socio_relatorios;
CREATE POLICY lf_socio_relatorios_demo ON lf_socio_relatorios
  FOR SELECT TO anon, authenticated
  USING (loja_id = 'sualoja');

-- Sem policy de INSERT/UPDATE/DELETE: pelo app, o relatório é imutável.
-- Quem grava é gerar_relatorios_socio (SECURITY DEFINER).

-- 4. Coluna do aviso ------------------------------------------------------------
-- Guarda o periodo_inicio ('YYYY-MM-DD') do último relatório que a lojista
-- abriu. Mesmo desenho de meta_lembrete_dispensado_em: texto, comparação por
-- string, nenhum job para "religar".
ALTER TABLE lf_config ADD COLUMN IF NOT EXISTS socio_visto_periodo text;

-- 5a. Métricas de UMA loja em UM período -------------------------------------
CREATE OR REPLACE FUNCTION montar_dados_socio(
  p_loja    text,
  p_ini     date,
  p_fim     date,
  p_ant_ini date,
  p_ant_fim date
) RETURNS jsonb
LANGUAGE plpgsql
-- VOLATILE (padrão), não STABLE: usa tabelas temporárias de trabalho.
SET search_path = public
AS $$
DECLARE
  v_metricas     jsonb;
  v_anterior     jsonb;
  v_dia_semana   jsonb;
  v_top_produtos jsonb;
  v_recomprar    jsonb;
  v_parados      jsonb;
  v_cli_top      jsonb;
  v_cli_inativos jsonb;
  v_inativos_tot integer;
  v_caixa        jsonb;
  v_crediario    jsonb;
  v_estoque_baixo integer;
  v_jan_ini      date := p_fim + 1;
  v_jan_fim      date := p_fim + 15;
BEGIN
  -- Vendas completas da loja, com o dia local de Brasília.
  CREATE TEMP TABLE IF NOT EXISTS _sd_vendas (
    id uuid, valor numeric, cliente_nome text, produtos jsonb,
    tipo_venda text, dia date, isodow int
  ) ON COMMIT DROP;
  TRUNCATE _sd_vendas;
  INSERT INTO _sd_vendas
  SELECT id, coalesce(valor, 0), cliente_nome, coalesce(produtos, '[]'::jsonb),
         coalesce(tipo_venda, 'venda'),
         (data AT TIME ZONE 'America/Sao_Paulo')::date,
         extract(isodow FROM (data AT TIME ZONE 'America/Sao_Paulo'))::int
    FROM lf_vendas
   WHERE loja_id = p_loja
     AND coalesce(status, 'completa') = 'completa'
     AND (data AT TIME ZONE 'America/Sao_Paulo')::date <= p_fim;

  -- Números do período e do período anterior
  SELECT jsonb_build_object(
           'faturamento',  round(coalesce(sum(valor), 0), 2),
           'vendas',       count(*),
           'ticket_medio', CASE WHEN count(*) > 0 THEN round(sum(valor) / count(*), 2) ELSE 0 END,
           'trocas',       count(*) FILTER (WHERE tipo_venda = 'troca')
         )
    INTO v_metricas
    FROM _sd_vendas WHERE dia BETWEEN p_ini AND p_fim;

  -- Peças vendidas (trocas fora: a peça de troca não é venda nova)
  v_metricas := v_metricas || jsonb_build_object('pecas',
    (SELECT coalesce(sum(coalesce((p->>'quantidade')::numeric, 1)), 0)
       FROM _sd_vendas v, jsonb_array_elements(v.produtos) p
      WHERE v.dia BETWEEN p_ini AND p_fim AND v.tipo_venda <> 'troca'));

  SELECT jsonb_build_object(
           'faturamento',  round(coalesce(sum(valor), 0), 2),
           'vendas',       count(*),
           'ticket_medio', CASE WHEN count(*) > 0 THEN round(sum(valor) / count(*), 2) ELSE 0 END,
           'trocas',       count(*) FILTER (WHERE tipo_venda = 'troca')
         )
    INTO v_anterior
    FROM _sd_vendas WHERE dia BETWEEN p_ant_ini AND p_ant_fim;

  -- Dia da semana que mais faturou (1 = segunda … 7 = domingo)
  SELECT jsonb_build_object('isodow', isodow, 'total', round(total, 2))
    INTO v_dia_semana
    FROM (SELECT isodow, sum(valor) AS total
            FROM _sd_vendas WHERE dia BETWEEN p_ini AND p_fim
           GROUP BY isodow ORDER BY total DESC LIMIT 1) d;

  -- Produtos mais vendidos (peças) no período
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'qtd', qtd) ORDER BY qtd DESC, nome), '[]'::jsonb)
    INTO v_top_produtos
    FROM (SELECT p->>'nome' AS nome, sum(coalesce((p->>'quantidade')::numeric, 1)) AS qtd
            FROM _sd_vendas v, jsonb_array_elements(v.produtos) p
           WHERE v.dia BETWEEN p_ini AND p_fim AND v.tipo_venda <> 'troca'
             AND coalesce(p->>'nome', '') <> ''
           GROUP BY p->>'nome' ORDER BY qtd DESC, nome LIMIT 5) t;

  -- Estoque atual por produto (soma das variações)
  CREATE TEMP TABLE IF NOT EXISTS _sd_estoque (nome text, estoque numeric, criado date) ON COMMIT DROP;
  TRUNCATE _sd_estoque;
  INSERT INTO _sd_estoque
  SELECT pr.nome,
         coalesce((SELECT sum(coalesce((va->>'quantidade')::numeric, 0))
                     FROM jsonb_array_elements(CASE WHEN jsonb_typeof(pr.variacoes) = 'array'
                                                    THEN pr.variacoes ELSE '[]'::jsonb END) va), 0),
         (pr.created_at AT TIME ZONE 'America/Sao_Paulo')::date
    FROM lf_produtos pr
   WHERE pr.loja_id = p_loja AND coalesce(pr.ativo, true);

  -- Recomprar já: vendeu 2+ peças no período e restam 3 ou menos
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'vendidos', qtd, 'estoque', estoque)
                            ORDER BY qtd DESC, nome), '[]'::jsonb)
    INTO v_recomprar
    FROM (SELECT e.nome, s.qtd, e.estoque
            FROM (SELECT p->>'nome' AS nome, sum(coalesce((p->>'quantidade')::numeric, 1)) AS qtd
                    FROM _sd_vendas v, jsonb_array_elements(v.produtos) p
                   WHERE v.dia BETWEEN p_ini AND p_fim AND v.tipo_venda <> 'troca'
                   GROUP BY p->>'nome') s
            JOIN _sd_estoque e ON e.nome = s.nome
           WHERE s.qtd >= 2 AND e.estoque <= 3
           ORDER BY s.qtd DESC, e.nome
           LIMIT 20) t;

  -- Girar em promoção: tem estoque e não vende há 45+ dias (ou nunca vendeu
  -- e foi cadastrado há 45+ dias)
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'estoque', estoque, 'dias', dias)
                            ORDER BY dias DESC, nome), '[]'::jsonb)
    INTO v_parados
    FROM (SELECT e.nome, e.estoque,
                 (p_fim - coalesce(u.ultima, e.criado))::int AS dias
            FROM _sd_estoque e
            LEFT JOIN (SELECT p->>'nome' AS nome, max(v.dia) AS ultima
                         FROM _sd_vendas v, jsonb_array_elements(v.produtos) p
                        WHERE v.tipo_venda <> 'troca'
                        GROUP BY p->>'nome') u ON u.nome = e.nome
           WHERE e.estoque > 0
             AND (p_fim - coalesce(u.ultima, e.criado)) >= 45
           ORDER BY dias DESC, e.nome
           LIMIT 20) t;

  -- Clientes que mais compraram no período
  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'total', round(total, 2), 'compras', compras)
                            ORDER BY total DESC, nome), '[]'::jsonb)
    INTO v_cli_top
    FROM (SELECT max(trim(cliente_nome)) AS nome, sum(valor) AS total, count(*) AS compras
            FROM _sd_vendas
           WHERE dia BETWEEN p_ini AND p_fim AND coalesce(trim(cliente_nome), '') <> ''
           GROUP BY lower(trim(cliente_nome))
           ORDER BY total DESC LIMIT 5) t;

  -- Clientes que sumiram (45+ dias, regra do CRM)
  SELECT count(*) INTO v_inativos_tot
    FROM lf_clientes c
    JOIN (SELECT lower(trim(cliente_nome)) AS chave, max(dia) AS ultima
            FROM _sd_vendas WHERE coalesce(trim(cliente_nome), '') <> ''
           GROUP BY 1) u ON u.chave = lower(trim(c.nome))
   WHERE c.loja_id = p_loja AND (p_fim - u.ultima) >= 45;

  SELECT coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'telefone', telefone, 'dias', dias)
                            ORDER BY dias DESC, nome), '[]'::jsonb)
    INTO v_cli_inativos
    FROM (SELECT c.nome, c.telefone, (p_fim - u.ultima)::int AS dias
            FROM lf_clientes c
            JOIN (SELECT lower(trim(cliente_nome)) AS chave, max(dia) AS ultima
                    FROM _sd_vendas WHERE coalesce(trim(cliente_nome), '') <> ''
                   GROUP BY 1) u ON u.chave = lower(trim(c.nome))
           WHERE c.loja_id = p_loja AND (p_fim - u.ultima) >= 45
           ORDER BY dias DESC, c.nome
           LIMIT 20) t;

  -- Caixa: os 15 dias seguintes ao fechamento
  WITH receber_manual AS (
    SELECT coalesce(sum(valor), 0) AS total FROM lf_contas_receber
     WHERE loja_id = p_loja AND status = 'pendente'
       AND data_vencimento BETWEEN v_jan_ini AND v_jan_fim
  ), parcelas AS (
    SELECT cr.valor_parcela, (cr.data_compra + make_interval(months => i))::date AS venc,
           i <= coalesce(cr.parcelas_pagas, 0) AS paga
      FROM lf_crediario cr, generate_series(1, greatest(coalesce(cr.parcelas, 1), 1)) i
     WHERE cr.loja_id = p_loja AND coalesce(cr.status, '') <> 'quitado'
  ), receber_cred AS (
    SELECT coalesce(sum(valor_parcela), 0) AS total FROM parcelas
     WHERE NOT paga AND venc BETWEEN v_jan_ini AND v_jan_fim
  ), pagar AS (
    SELECT coalesce(sum(valor), 0) AS total FROM lf_contas_pagar
     WHERE loja_id = p_loja AND status = 'pendente'
       AND data_vencimento BETWEEN v_jan_ini AND v_jan_fim
  ), maior AS (
    SELECT descricao, valor, data_vencimento FROM lf_contas_pagar
     WHERE loja_id = p_loja AND status = 'pendente'
       AND data_vencimento BETWEEN v_jan_ini AND v_jan_fim
     ORDER BY valor DESC LIMIT 1
  )
  SELECT jsonb_build_object(
           'janela_inicio', v_jan_ini,
           'janela_fim',    v_jan_fim,
           'entradas',      round((SELECT total FROM receber_manual) + (SELECT total FROM receber_cred), 2),
           'saidas',        round((SELECT total FROM pagar), 2),
           'saldo',         round((SELECT total FROM receber_manual) + (SELECT total FROM receber_cred)
                                  - (SELECT total FROM pagar), 2),
           'maior_conta',   (SELECT jsonb_build_object('descricao', descricao, 'valor', round(valor, 2),
                                                       'vencimento', data_vencimento) FROM maior)
         )
    INTO v_caixa;

  -- Crediário: parcelas vencidas e não pagas até o fechamento
  SELECT jsonb_build_object('parcelas_atrasadas', count(*),
                            'valor_atrasado', round(coalesce(sum(valor_parcela), 0), 2))
    INTO v_crediario
    FROM (SELECT cr.valor_parcela, (cr.data_compra + make_interval(months => i))::date AS venc,
                 i <= coalesce(cr.parcelas_pagas, 0) AS paga
            FROM lf_crediario cr, generate_series(1, greatest(coalesce(cr.parcelas, 1), 1)) i
           WHERE cr.loja_id = p_loja AND coalesce(cr.status, '') <> 'quitado') x
   WHERE NOT paga AND venc <= p_fim;

  SELECT count(*) INTO v_estoque_baixo FROM _sd_estoque WHERE estoque BETWEEN 1 AND 6;

  RETURN jsonb_build_object(
    'versao',            1,
    'periodo',           jsonb_build_object('inicio', p_ini, 'fim', p_fim),
    'periodo_anterior',  jsonb_build_object('inicio', p_ant_ini, 'fim', p_ant_fim),
    'metricas',          v_metricas,
    'anterior',          v_anterior,
    'melhor_dia_semana', v_dia_semana,
    'top_produtos',      v_top_produtos,
    'recomprar',         v_recomprar,
    'parados',           v_parados,
    'clientes_top',      v_cli_top,
    'clientes_inativos', jsonb_build_object('total', v_inativos_tot, 'lista', v_cli_inativos),
    'caixa',             v_caixa,
    'crediario',         v_crediario,
    'estoque_baixo',     v_estoque_baixo
  );
END $$;

-- 5b. Gera o relatório do período que acabou de fechar, para todas as lojas --
--
-- Período fechado relativo a p_data:
--   dia 16..31 → 1 a 15 do mesmo mês
--   dia  1..15 → 16 ao último dia do mês anterior
-- (o cron roda nos dias 1 e 16; rodar em outro dia gera o mesmo período, e
--  a UNIQUE impede duplicar).
--
-- p_loja (opcional): restringe a UMA loja. O cron NÃO passa — gera para
-- todas. Existe para o script de validação (scripts/validar-socio-digital.mjs)
-- testar na 'sualoja' sem gravar relatório nas lojas reais.
--
-- Retorna quantos relatórios NOVOS foram gravados.
CREATE OR REPLACE FUNCTION gerar_relatorios_socio(p_data date, p_loja text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje      date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_mes       date;
  v_ini       date;
  v_fim       date;
  v_ant_ini   date;
  v_ant_fim   date;
  v_loja      record;
  v_rows      integer;
  v_inseridos integer := 0;
BEGIN
  -- Nunca gerar relatório de período que ainda não fechou: com a UNIQUE,
  -- um relatório parcial ficaria gravado para sempre.
  IF p_data IS NULL OR p_data > v_hoje THEN
    RAISE EXCEPTION 'gerar_relatorios_socio: data % inválida (nula ou futura; hoje é %)', p_data, v_hoje;
  END IF;

  v_mes := date_trunc('month', p_data)::date;
  IF extract(day FROM p_data) >= 16 THEN
    v_ini     := v_mes;
    v_fim     := v_mes + 14;
    v_ant_ini := (v_mes - interval '1 month')::date + 15;
    v_ant_fim := v_mes - 1;
  ELSE
    v_ini     := (v_mes - interval '1 month')::date + 15;
    v_fim     := v_mes - 1;
    v_ant_ini := (v_mes - interval '1 month')::date;
    v_ant_fim := (v_mes - interval '1 month')::date + 14;
  END IF;

  FOR v_loja IN
    SELECT loja_id FROM lf_config
     WHERE lower(coalesce(plano, 'starter')) IN ('pro', 'business')
       AND coalesce(status, '') <> 'excluida'
       AND coalesce(segmento, 'moda') = 'moda'   -- Sócio Digital é tela do Moda
       AND (p_loja IS NULL OR loja_id = p_loja)
  LOOP
    -- Uma loja com problema não pode impedir as outras.
    BEGIN
      INSERT INTO lf_socio_relatorios (loja_id, periodo_inicio, periodo_fim, dados)
      VALUES (v_loja.loja_id, v_ini, v_fim,
              montar_dados_socio(v_loja.loja_id, v_ini, v_fim, v_ant_ini, v_ant_fim))
      ON CONFLICT (loja_id, periodo_inicio) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;
      v_inseridos := v_inseridos + v_rows;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'gerar_relatorios_socio: loja % falhou: %', v_loja.loja_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_inseridos;
END $$;

-- Só o banco (cron, SQL Editor) e o service_role chamam. Sem isto, qualquer
-- visitante com a anon key poderia chamar via /rest/v1/rpc.
REVOKE ALL ON FUNCTION gerar_relatorios_socio(date, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION montar_dados_socio(text, date, date, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION gerar_relatorios_socio(date, text) TO service_role;

COMMIT;

-- 6. Agendamento --------------------------------------------------------------
-- Fora da transação: cron.schedule com o mesmo nome substitui o job anterior.
-- current_date no servidor é UTC; às 12:00 UTC já é o mesmo dia em Brasília.
SELECT cron.schedule(
  'socio-digital',
  '0 12 1,16 * *',
  $$ SELECT gerar_relatorios_socio(current_date) $$
);

-- ============================================================================
-- CONFERÊNCIA (rodar depois)
--
-- Job agendado:
--   SELECT jobid, jobname, schedule, command, active FROM cron.job;
--
-- Histórico de execuções:
--   SELECT jobid, status, return_message, start_time, end_time
--     FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
--
-- Gerar agora, manualmente, o último período fechado (idempotente).
-- ATENÇÃO: sem o 2º parâmetro gera para TODAS as lojas Pro/Business e acende
-- o aviso no banner delas. Para testar numa loja só:
--   SELECT gerar_relatorios_socio(current_date, 'sualoja');
--   SELECT gerar_relatorios_socio(current_date);   -- todas
--
-- Ver o que foi gravado:
--   SELECT loja_id, periodo_inicio, periodo_fim, gerado_em,
--          dados->'metricas' AS metricas
--     FROM lf_socio_relatorios ORDER BY gerado_em DESC;
--
-- DESFAZER (se necessário):
--   SELECT cron.unschedule('socio-digital');
--   DROP FUNCTION IF EXISTS gerar_relatorios_socio(date, text);
--   DROP FUNCTION IF EXISTS montar_dados_socio(text, date, date, date, date);
--   DROP TABLE IF EXISTS lf_socio_relatorios;
--   ALTER TABLE lf_config DROP COLUMN IF EXISTS socio_visto_periodo;
--   -- pg_cron pode ficar instalada; para remover: DROP EXTENSION pg_cron;
-- ============================================================================
