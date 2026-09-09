-- ─────────────────────────────────────────────────────────────────────────────
-- lf_vendedores — cadastro de vendedores por loja.
--
-- NÃO FOI EXECUTADO. Rodar manualmente no SQL Editor.
--
-- ─── POR QUE ESTA TABELA EXISTE ─────────────────────────────────────────────
-- Hoje o nome do vendedor é TEXTO LIVRE, digitado a cada venda:
--   src/pages/LojaFeminina/NovaVenda.jsx        (input, mobile)
--   src/pages/cliente/ClientDashboardDesktop.jsx (input, desktop)
--
-- E a comissão automática agrupa por igualdade EXATA de string:
--   src/pages/LojaFeminina/Relatorios.jsx
--     const nome = v.vendedora || 'Sem vendedor(a)'
--     mapa[nome].total += Number(v.valor)
--
-- Ou seja: "Ana Lívia", "ana lívia" e "Ana  Lívia" viram TRÊS pessoas
-- diferentes no relatório de comissão, e ninguém percebe até o fechamento do
-- mês. A tabela existe para o nome virar escolha, não digitação.
--
-- ─── SEM RLS, DE PROPÓSITO ──────────────────────────────────────────────────
-- Segue o padrão das outras lf_* (lf_produtos, lf_vendas, lf_clientes), todas
-- sem RLS neste projeto. lf_pedidos foi a exceção e ganhou RLS em
-- migration_rls_pedidos.sql — mas lá o motivo era específico: é a única tabela
-- escrita pelo PÚBLICO não autenticado, e o status dela virou gatilho
-- financeiro. lf_vendedores é escrita só pelo painel autenticado e não guarda
-- dado pessoal de terceiro nem valor. Ligar RLS só aqui deixaria o conjunto
-- incoerente sem ganho real.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.lf_vendedores (
  id         uuid primary key default gen_random_uuid(),
  loja_id    text        not null,
  nome       text        not null,
  ativo      boolean     not null default true,
  created_at timestamptz not null default now()
);

alter table public.lf_vendedores disable row level security;

-- O select da Nova Venda filtra por (loja_id, ativo). Índice acompanha.
create index if not exists lf_vendedores_loja_ativo_idx
  on public.lf_vendedores (loja_id, ativo);

-- Impede o mesmo nome duas vezes na mesma loja — é justamente a duplicidade
-- que quebra o agrupamento da comissão. Case-insensitive porque "Brenda" e
-- "brenda" são a mesma pessoa para quem digita.
create unique index if not exists lf_vendedores_loja_nome_uniq
  on public.lf_vendedores (loja_id, lower(btrim(nome)));

-- ─────────────────────────────────────────────────────────────────────────────
-- SEMENTE — rodar manualmente junto com o CREATE TABLE
--
-- Vendedores da tropicaleatacado. `on conflict do nothing` para rodar duas
-- vezes não duplicar.
-- ─────────────────────────────────────────────────────────────────────────────

-- insert into public.lf_vendedores (loja_id, nome) values
--   ('tropicaleatacado', 'Ana Lívia'),
--   ('tropicaleatacado', 'Brenda'),
--   ('tropicaleatacado', 'Eduarda'),
--   ('tropicaleatacado', 'Gabriele'),
--   ('tropicaleatacado', 'Laiane'),
--   ('tropicaleatacado', 'Letícia')
-- on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- DEPOIS DE RODAR
--
-- 1. Vendas antigas NÃO são migradas, de propósito. Elas guardam o nome como
--    texto e continuam agrupando por ele na comissão. Se o nome digitado no
--    passado bater com o cadastrado agora, some naturalmente na mesma linha;
--    se não bater (erro de digitação antigo), aparece como linha separada —
--    que é exatamente o que já acontece hoje, sem piora.
--
-- 2. Para ver se existe sujeira herdada que valha limpar à mão:
--
--      select coalesce(vendedora, '(sem vendedor)') as nome, count(*), sum(valor)
--        from public.lf_vendas
--       where loja_id = 'tropicaleatacado'
--       group by 1
--       order by 2 desc;
--
--    Nomes quase iguais na listagem (espaço a mais, caixa diferente) são
--    candidatos a um UPDATE manual para unificar o histórico. Não faço isso
--    aqui: reescrever venda lançada é decisão da loja, não de migration.
-- ─────────────────────────────────────────────────────────────────────────────
