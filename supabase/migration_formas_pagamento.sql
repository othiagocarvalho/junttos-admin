-- ═══════════════════════════════════════════════════════════════════════════
-- migration_formas_pagamento.sql — formas de pagamento cadastradas por loja
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- NÃO FOI EXECUTADA — este arquivo só foi gerado (01/10/2026).
--
-- Cria lf_config.formas_pagamento (jsonb, padrão []), lista das formas que a
-- loja cadastrou em Configurações → Formas de Pagamento:
--   [{ "nome": "Link de pagamento", "conta_como": "Cartão de Crédito", "ativo": true }]
-- conta_como: 'Dinheiro' | 'Pix' | 'Cartão de Débito' | 'Cartão de Crédito' | 'nenhum'
-- (ver src/utils/formasPagamento.js). Remover só marca ativo = false.
--
-- Pode rodar ANTES ou DEPOIS do deploy: sem a coluna, o código mostra só as
-- formas padrão e o cadastro avisa que ainda não foi liberado. Com a coluna
-- e sem o deploy, nada muda (ninguém lê a coluna).
--
-- RLS: lf_config hoje está com RLS DESLIGADA (01/10) — nada a criar aqui.
-- Quando a RLS de lf_config for ligada, esta coluna segue a mesma regra da
-- linha (_own_loja).
--
-- ROLLBACK: bloco comentado no fim do arquivo.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 0. CONFERÊNCIA ANTES ── esperado: nenhuma linha
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'lf_config' and column_name = 'formas_pagamento';

-- ── 1. CORREÇÃO ──
begin;

alter table public.lf_config
  add column if not exists formas_pagamento jsonb not null default '[]'::jsonb;

-- Garante que é sempre uma lista (o código também tolera lixo, mas assim o
-- banco não aceita outra coisa).
alter table public.lf_config drop constraint if exists lf_config_formas_pagamento_array;
alter table public.lf_config add constraint lf_config_formas_pagamento_array
  check (jsonb_typeof(formas_pagamento) = 'array');

commit;

-- A API do Supabase (PostgREST) precisa recarregar o schema para enxergar a
-- coluna nova sem esperar:
notify pgrst, 'reload schema';

-- ── 2. CONFERÊNCIA DEPOIS ── esperado: jsonb, NO, '[]'::jsonb; e todas as lojas com []
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'lf_config' and column_name = 'formas_pagamento';

select formas_pagamento, count(*) from public.lf_config group by formas_pagamento;

-- ── 3. ROLLBACK (comentado) ── apaga as formas que as lojas já cadastraram.
-- begin;
-- alter table public.lf_config drop constraint if exists lf_config_formas_pagamento_array;
-- alter table public.lf_config drop column if exists formas_pagamento;
-- commit;
-- notify pgrst, 'reload schema';
