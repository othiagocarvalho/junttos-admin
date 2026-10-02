-- ═══════════════════════════════════════════════════════════════════════════
-- migration_caixas_formas_extras.sql — detalhe por forma cadastrada no
-- fechamento de caixa (Moda)
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- NÃO FOI EXECUTADA — este arquivo só foi gerado (02/10/2026).
--
-- Cria lf_caixas.formas_extras (jsonb, pode ser nulo): quanto o fechamento
-- registrou em cada forma de pagamento cadastrada pela loja em Configurações
-- (lf_config.formas_pagamento), que agora tem campo próprio no Fechamento:
--   [{ "nome": "PIX ONLINE", "conta_como": "Pix", "valor": 120.5 }]
-- As colunas dinheiro/pix/debito/credito continuam com o TOTAL da linha
-- (forma padrão + formas cadastradas que somam nela, pelo conta_como) e
-- total continua sendo a soma das quatro — igual a antes. formas_extras é só
-- o detalhe, para o fechamento salvo mostrar cada forma separada.
--
-- Pode rodar ANTES ou DEPOIS do deploy: sem a coluna, o Fechamento salva sem
-- o detalhe (useLojaData.fecharCaixa tenta de novo sem formas_extras) e os
-- totais saem certos; só o fechamento salvo não mostra cada forma separada.
-- Loja sem forma cadastrada nunca envia a coluna.
--
-- RLS: as policies de lf_caixas valem por linha — nada a criar aqui.
--
-- ROLLBACK: bloco comentado no fim do arquivo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. CONFERÊNCIA ANTES ── esperado: nenhuma linha
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lf_caixas' and column_name = 'formas_extras';

-- ── 1. CORREÇÃO ──
begin;

alter table public.lf_caixas
  add column if not exists formas_extras jsonb;

-- Nulo (fechamento sem forma cadastrada) ou lista.
alter table public.lf_caixas drop constraint if exists lf_caixas_formas_extras_array;
alter table public.lf_caixas add constraint lf_caixas_formas_extras_array
  check (formas_extras is null or jsonb_typeof(formas_extras) = 'array');

commit;

-- A API do Supabase (PostgREST) precisa recarregar o schema para enxergar a
-- coluna nova sem esperar:
notify pgrst, 'reload schema';

-- ── 2. CONFERÊNCIA DEPOIS ── esperado: jsonb, YES, sem default; todos nulos
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'lf_caixas' and column_name = 'formas_extras';

select count(*) as fechamentos, count(formas_extras) as com_detalhe from public.lf_caixas;

-- ── 3. ROLLBACK (comentado) ── perde só o detalhe; os totais ficam nas
-- colunas de sempre. Rodar o rollback com o deploy no ar não quebra o
-- fechamento (volta a salvar sem o detalhe).
-- begin;
-- alter table public.lf_caixas drop constraint if exists lf_caixas_formas_extras_array;
-- alter table public.lf_caixas drop column if exists formas_extras;
-- commit;
-- notify pgrst, 'reload schema';
