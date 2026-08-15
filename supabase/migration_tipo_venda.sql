-- ============================================================================
-- Migration: lf_vendas.tipo_venda — distingue venda comum de troca
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
--
-- MOTIVO
-- A tela de Nova Venda (mobile e desktop) grava `tipo_venda: 'troca'` quando a
-- venda é uma troca de produto, e 'venda' no fluxo normal. Sem a coluna, o
-- insert falha ou o campo é descartado em silêncio, e a troca fica
-- indistinguível de uma venda comum no histórico e nos relatórios.
--
-- O DEFAULT 'venda' cobre as linhas já existentes: tudo que foi gravado antes
-- desta migration era venda comum — a troca não existia no produto ainda.
--
-- Idempotente: pode rodar mais de uma vez sem erro.
-- ============================================================================

alter table lf_vendas
  add column if not exists tipo_venda text not null default 'venda';

-- Só os dois valores que o app grava. Sem a constraint, um typo no client
-- entra no banco e só aparece quando o relatório vier errado.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'lf_vendas_tipo_venda_check'
  ) then
    alter table lf_vendas
      add constraint lf_vendas_tipo_venda_check
      check (tipo_venda in ('venda', 'troca'));
  end if;
end $$;

-- O histórico e os relatórios filtram por loja + tipo; sem índice isso vira
-- seq scan na tabela que mais cresce.
create index if not exists lf_vendas_loja_tipo_idx
  on lf_vendas (loja_id, tipo_venda);

-- ── Conferência ─────────────────────────────────────────────────────────────
-- select column_name, data_type, column_default, is_nullable
--   from information_schema.columns
--  where table_name = 'lf_vendas' and column_name = 'tipo_venda';
--
-- select tipo_venda, count(*) from lf_vendas group by tipo_venda;
