-- ═══════════════════════════════════════════════════════════════════════════
-- fix_rls_recorrencias.sql — remove a policy aberta de lf_recorrencias
-- ═══════════════════════════════════════════════════════════════════════════
--
-- PROBLEMA (auditado em 26/09/2026 via pg_policies):
--   lf_recorrencias tem 3 policies PERMISSIVE para ALL:
--     allow_all                 {anon,authenticated}  USING true  WITH CHECK true
--     lf_recorrencias_own_loja  {authenticated}       USING/CHECK loja_id = jwt.app_metadata.loja_id
--     lf_recorrencias_demo      {anon,authenticated}  USING/CHECK loja_id = 'sualoja'
--   Policies permissivas se somam com OR: com allow_all presente, as outras
--   duas não restringem nada. Qualquer um com a chave pública (anon, que vai
--   no bundle do app) lê, cria, altera e APAGA regras de recorrência de
--   QUALQUER loja.
--
-- CORREÇÃO: dropar só allow_all. As duas que ficam já cobrem tudo o que o
-- app faz hoje, leitura E escrita (são FOR ALL, com USING e WITH CHECK):
--   · lojista logada (authenticated, loja_id no app_metadata do JWT) →
--     só a própria loja — é o mesmo desenho de lf_contas_pagar/_receber
--     (lf_contas_pagar_own_loja), que o Financeiro já usa sem problema.
--   · loja demo 'sualoja' → aberta para anon/authenticated, igual às demais
--     tabelas _demo.
--   · service_role (scripts/admin) ignora RLS — não é afetado.
--
-- Quem perde acesso: apenas anon/authenticated de OUTRA loja — que é o
-- ponto. O Financeiro (Financeiro.jsx / FinanceiroDesktop.jsx) sempre filtra
-- por .eq('loja_id', lojaId) da loja logada, então nada muda para a lojista.
--
-- ROLLBACK (se algo inesperado quebrar):
--   create policy allow_all on public.lf_recorrencias
--     for all to anon, authenticated using (true) with check (true);
-- ═══════════════════════════════════════════════════════════════════════════


-- ── 0. CONFERÊNCIA ANTES (rode e confira que mostra as 3 policies acima) ──
select policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'lf_recorrencias'
order by policyname;

select relname, relrowsecurity as rls_ligada
from pg_class
where oid = 'public.lf_recorrencias'::regclass;


-- ── 1. CORREÇÃO ──
begin;

-- Trava: só segue se as duas policies corretas existirem — sem elas, dropar
-- allow_all deixaria a tabela inacessível para o app.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lf_recorrencias'
                 and policyname = 'lf_recorrencias_own_loja' and cmd = 'ALL') then
    raise exception 'lf_recorrencias_own_loja não existe — abortando';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lf_recorrencias'
                 and policyname = 'lf_recorrencias_demo' and cmd = 'ALL') then
    raise exception 'lf_recorrencias_demo não existe — abortando';
  end if;
end $$;

drop policy if exists allow_all on public.lf_recorrencias;

-- RLS continua ligada (já está — garante).
alter table public.lf_recorrencias enable row level security;

commit;


-- ── 2. CONFERÊNCIA DEPOIS (esperado: só _demo e _own_loja, nenhuma com qual = true) ──
select policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'lf_recorrencias'
order by policyname;
