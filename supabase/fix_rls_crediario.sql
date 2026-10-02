-- ═══════════════════════════════════════════════════════════════════════════
-- fix_rls_crediario.sql — libera o crediário (venda fiada) por loja
--   lf_crediario
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Execute no Supabase Dashboard > SQL Editor. NÃO é aplicada automaticamente.
-- Aplicado manualmente em produção em 01/10/2026 — confirmado em 02/10/2026
-- consultando pg_policies: lf_crediario com RLS ligada e exatamente as duas
-- policies abaixo (lf_crediario_demo e lf_crediario_own_loja, cmd ALL).
--
-- Não depende de deploy: o código já grava e lê do jeito que as policies
-- abaixo esperam. Pode rodar a qualquer momento.
--
-- ─── O PROBLEMA (confirmado em produção, 01/10/2026) ───────────────────────
-- lf_crediario tem RLS LIGADA e NENHUMA policy. Sem policy, a RLS nega tudo:
--   · INSERT → "new row violates row-level security policy for table
--     lf_crediario" — o Daniel não consegue cadastrar venda fiada em nenhuma
--     loja (Crediario.jsx mostra o alert "Erro ao salvar: …").
--   · SELECT → volta vazio, SEM erro (por isso a lista só aparece vazia).
--   · UPDATE (pagar parcela) → também bloqueado.
-- A tabela tem 0 linhas — o crediário nunca chegou a gravar nada desde que a
-- RLS foi ligada. Grants de anon/authenticated estão normais (todos), então
-- o bloqueio é só a falta de policy.
--
-- ─── ESTRUTURA (01/10) ─────────────────────────────────────────────────────
--   id uuid PK, loja_id text NOT NULL, cliente_nome, cliente_telefone,
--   valor_total, parcelas, valor_parcela, data_compra, parcelas_pagas,
--   status ('aberto'|'quitado'), observacoes, created_at.
-- loja_id é NOT NULL — não existe linha "sem loja" a tratar.
--
-- ─── COMO O CÓDIGO USA (01/10) ─────────────────────────────────────────────
-- Tudo pelo client das lojas (src/lib/supabase.js, anon key + sessão da
-- lojista → role authenticated, loja_id no app_metadata do JWT):
--   useLojaData.js  fetchAll      select  .eq('loja_id', lojaId)
--   useLojaData.js  addCrediario  insert  { loja_id: lojaId, … }
--   useLojaData.js  pagarParcela  update  .eq('id').eq('loja_id', lojaId)
--   Financeiro.jsx / cliente/FinanceiroDesktop.jsx  select .eq('loja_id')
-- Sempre com loja_id da própria loja; nenhum DELETE no código.
-- Todas as 17 lojas com login têm loja_id no app_metadata (conferido em
-- auth.users, 01/10).
--
-- ─── O DESENHO ──────────────────────────────────────────────────────────────
-- Mesmo padrão de lf_clientes, lf_caixas, lf_compras, lf_contas_* —
-- duas policies permissivas (somam com OR), todas as operações:
--   lf_crediario_own_loja  authenticated        loja_id = jwt.app_metadata.loja_id
--   lf_crediario_demo      anon, authenticated  loja_id = 'sualoja'
--
-- ROLLBACK: bloco comentado no fim do arquivo.
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0. CONFERÊNCIA ANTES ──
-- Esperado: nenhuma linha (zero policies); RLS ligada; 0 linhas na tabela.
select tablename, policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'lf_crediario'
order by policyname;

select relname, relrowsecurity as rls_ligada
from pg_class where oid = 'public.lf_crediario'::regclass;

select loja_id, count(*) from public.lf_crediario group by loja_id order by loja_id;


-- ── 1. CORREÇÃO ──
begin;

drop policy if exists lf_crediario_own_loja on public.lf_crediario;
create policy lf_crediario_own_loja on public.lf_crediario
  for all to authenticated
  using      (loja_id = ((auth.jwt() -> 'app_metadata') ->> 'loja_id'))
  with check (loja_id = ((auth.jwt() -> 'app_metadata') ->> 'loja_id'));

drop policy if exists lf_crediario_demo on public.lf_crediario;
create policy lf_crediario_demo on public.lf_crediario
  for all to anon, authenticated
  using      (loja_id = 'sualoja')
  with check (loja_id = 'sualoja');

-- RLS continua ligada (já está — garante).
alter table public.lf_crediario enable row level security;

commit;


-- ── 2. CONFERÊNCIA DEPOIS ──
-- Esperado: lf_crediario_demo e lf_crediario_own_loja, cmd ALL.
select tablename, policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'lf_crediario'
order by policyname;

-- 2.1 Teste de fumaça com a RLS de verdade. Cada bloco termina em ROLLBACK:
-- nada fica gravado.
-- lojista tropicaleatacado: INSERT na própria loja passa; o SELECT enxerga.
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"loja_id":"tropicaleatacado"}}', true);
insert into public.lf_crediario (loja_id, cliente_nome, valor_total, parcelas, valor_parcela)
values ('tropicaleatacado', 'TESTE RLS', 100, 2, 50);
select 'lojista tropicaleatacado' as papel, count(*) as visiveis,
       string_agg(distinct loja_id, ', ') as lojas
from public.lf_crediario;
rollback;

-- lojista tropicaleatacado tentando gravar em OUTRA loja: tem que ser
-- bloqueado. O bloco captura o erro de RLS (42501) e só avisa — se o insert
-- PASSAR, ele aborta com "FALHOU".
begin;
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated","app_metadata":{"loja_id":"tropicaleatacado"}}', true);
do $$
begin
  insert into public.lf_crediario (loja_id, cliente_nome, valor_total, parcelas, valor_parcela)
  values ('audazwear', 'TESTE RLS', 100, 2, 50);
  raise exception 'FALHOU: lojista conseguiu gravar crediário de outra loja';
exception when insufficient_privilege then
  raise notice 'OK: insert em outra loja bloqueado pela RLS';
end $$;
rollback;

-- anon: só a 'sualoja' (demo). Insert na sualoja passa.
begin;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
insert into public.lf_crediario (loja_id, cliente_nome, valor_total, parcelas, valor_parcela)
values ('sualoja', 'TESTE RLS', 100, 2, 50);
select 'anon' as papel, count(*) as visiveis, string_agg(distinct loja_id, ', ') as lojas
from public.lf_crediario;
rollback;

-- 2.2 Depois de rodar, teste na tela (loja do Daniel):
--   · Crediário → "Novo crediário" → salvar: aparece na lista, sem alert.
--   · "Pagar parcela" num crediário: parcelas_pagas sobe; na última, status
--     vira quitado.
--   · Financeiro: o crediário aparece onde aparecia antes.
--   · Recarregar a página: o crediário continua lá.


-- ── 3. ROLLBACK (comentado) ──
-- Volta ao estado de antes (RLS ligada, zero policies — ou seja, crediário
-- BLOQUEADO de novo). Para rodar: descomente do begin ao commit.
--
-- begin;
-- drop policy if exists lf_crediario_own_loja on public.lf_crediario;
-- drop policy if exists lf_crediario_demo     on public.lf_crediario;
-- commit;
