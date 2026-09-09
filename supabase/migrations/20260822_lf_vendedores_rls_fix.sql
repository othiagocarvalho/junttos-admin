-- ─────────────────────────────────────────────────────────────────────────────
-- CORREÇÃO DE BUG EM PRODUÇÃO — dropdown de vendedor vazio na Nova Venda.
--
-- NÃO FOI EXECUTADO. É DDL: rodar manualmente no SQL Editor.
-- ⚠️ SEM RODAR ISTO O BUG CONTINUA. A correção é 100% de banco; o código do
--    app já estava certo.
--
-- ─── DIAGNÓSTICO (medido em 22/08/2026, com a anon key) ─────────────────────
--   GET  /rest/v1/lf_vendedores?select=*        → []      (200)
--   HEAD ... Prefer: count=exact                → content-range: */0
--   POST /rest/v1/lf_vendedores {...}           → 42501
--        "new row violates row-level security policy for table lf_vendedores"
--
-- O 42501 é a prova: a tabela está com RLS LIGADA e sem policy nenhuma. Com
-- RLS ativa e zero policies, TODO papel que não seja service_role enxerga zero
-- linhas — e o PostgREST devolve `[]` com 200, sem erro. Por isso o app não
-- tinha o que registrar em log: para ele a resposta foi "sucesso, lista vazia".
--
-- A migration original (20260822_lf_vendedores.sql) trazia
-- `disable row level security`. O estado do banco não bate com ela — o mais
-- provável é a tabela ter sido criada pelo Table Editor do Supabase, que liga
-- RLS por padrão, com a migration nunca tendo sido executada ou tendo sido
-- executada só em parte.
--
-- ─── POR QUE POLICIES, E NÃO `disable row level security` ───────────────────
-- A migration original mandava desligar, para acompanhar as outras lf_*. Estou
-- REVERTENDO essa decisão de propósito:
--
--   • nome de vendedor é dado pessoal de terceiro — funcionário da loja. É o
--     mesmo tipo de exposição que motivou ligar RLS em lf_pedidos
--     (migration_rls_pedidos.sql), e ali a lição foi cara;
--   • a RLS já está ligada. Adicionar policy é uma mudança menor e mais segura
--     do que desligar a proteção que já existe;
--   • ninguém não autenticado precisa desta tabela: o catálogo público não a
--     usa, só o painel da lojista.
--
-- Mesmo padrão de app_metadata.loja_id usado em ClientPrivateRoute, nas
-- policies de storage (migration_fiscal.sql) e em lf_pedidos.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lf_vendedores enable row level security;

-- Defesa em duas camadas: sem o GRANT, uma policy afrouxada por engano no
-- futuro ainda não abre a tabela para o público.
revoke all on public.lf_vendedores from anon;
grant select, insert, update on public.lf_vendedores to authenticated;

drop policy if exists "vendedores_select_own_loja" on public.lf_vendedores;
create policy "vendedores_select_own_loja"
on public.lf_vendedores for select
to authenticated
using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

drop policy if exists "vendedores_insert_own_loja" on public.lf_vendedores;
create policy "vendedores_insert_own_loja"
on public.lf_vendedores for insert
to authenticated
with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

drop policy if exists "vendedores_update_own_loja" on public.lf_vendedores;
create policy "vendedores_update_own_loja"
on public.lf_vendedores for update
to authenticated
using      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
-- WITH CHECK impede mover o vendedor para outra loja no meio de um update.
with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- Sem policy de DELETE: o CRUD desativa (ativo = false), nunca apaga — venda
-- já lançada guarda o nome como texto e o relatório de comissão agrupa por ele.

-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE RODAR
--
-- 1. Confirme que os 6 vendedores estão mesmo lá. A leitura pela anon key
--    devolve [] por causa da RLS, então isto precisa ser rodado no SQL Editor,
--    que usa service_role e ignora RLS:
--
--      select loja_id, nome, ativo, comissao_percentual
--        from public.lf_vendedores
--       order by loja_id, nome;
--
--    Se vier vazio, a RLS não era o único problema: o cadastro também não foi
--    gravado, e a semente da migration original precisa ser rodada.
--
-- 2. Confira que o app_metadata.loja_id das usuárias bate com o loja_id dos
--    vendedores — a policy compara os dois, e divergência devolve lista vazia
--    com a mesma cara de bug:
--
--      select u.email,
--             u.raw_app_meta_data ->> 'loja_id' as loja_no_jwt,
--             v.loja_id                          as loja_no_vendedor
--        from auth.users u
--        join public.lf_vendedores v
--          on v.loja_id = u.raw_app_meta_data ->> 'loja_id'
--       group by 1,2,3;
--
-- DEPOIS DE RODAR, confirme que o buraco fechou e o app enxerga:
--
--      curl "$URL/rest/v1/lf_vendedores?select=nome" -H "apikey: <ANON>"
--      → esperado: 401/permission denied (anon não deve mais nem chegar na RLS)
--
--    e abrir a Nova Venda da tropicaleatacado: os 6 nomes no dropdown.
-- ─────────────────────────────────────────────────────────────────────────────
