-- ─────────────────────────────────────────────────────────────────────────────
-- Mercado Pago Pix dinâmico — estrutura de banco.
--
-- NÃO FOI EXECUTADO. É DDL: rode manualmente no SQL Editor depois de ler a
-- seção de segurança abaixo, que explica por que o token NÃO vai em lf_config.
--
-- ─── POR QUE O TOKEN NÃO PODE MORAR EM lf_config ────────────────────────────
-- O pedido original era "adicione coluna mercadopago_access_token em
-- lf_config". Isso vazaria a credencial de pagamento de toda loja.
--
-- Medido contra o projeto em 21/08/2026:
--
--   curl "$URL/rest/v1/lf_config?select=*&limit=1" -H "apikey: <ANON>"
--   → 200, 44 colunas, linha completa
--
-- lf_config NÃO tem RLS (o próprio App.jsx comenta isso: "lf_config nem tem
-- RLS"), então a anon key lê a tabela inteira. Pior: o catálogo público faz
--
--   supabase.from('lf_config').select('*').eq('loja_id', lojaId)
--
-- direto do navegador. Um access token do Mercado Pago em lf_config seria
-- entregue no payload de QUALQUER visitante do catálogo, e ainda estaria
-- disponível por curl para quem tem a anon key (que é pública por definição,
-- está no bundle). Com esse token dá para criar cobranças, listar pagamentos
-- e, dependendo do escopo, movimentar dinheiro da conta do lojista.
--
-- Desenho adotado:
--   • o token vive em lf_credenciais_pagamento, tabela COM RLS e SEM policy
--     de SELECT — nem anon nem a própria lojista conseguem lê-lo de volta;
--     só a service_role (as Edge Functions) enxerga, porque ignora RLS;
--   • a lojista pode gravar/atualizar o token da PRÓPRIA loja, e nada mais;
--   • lf_config ganha só um booleano `mercadopago_ativo`, que não é segredo e
--     é o que o catálogo público usa para decidir se oferece o QR Code.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Credenciais de pagamento ─────────────────────────────────────────────
create table if not exists public.lf_credenciais_pagamento (
  loja_id                    text primary key
    references public.lf_config (loja_id) on delete cascade,
  mercadopago_access_token   text,
  -- Segredo da assinatura do webhook (Mercado Pago → "Suas integrações" →
  -- Webhooks → Chave secreta). Sem ele o mp-webhook recusa toda notificação.
  mercadopago_webhook_secret text,
  atualizado_em              timestamptz not null default now()
);

alter table public.lf_credenciais_pagamento enable row level security;

-- SEM policy de SELECT, de propósito: o token nunca volta para o navegador.
-- A tela de Configurações mostra só "configurado / não configurado", que ela
-- deduz de lf_config.mercadopago_ativo.

drop policy if exists "cred_pgto_insert_own_loja" on public.lf_credenciais_pagamento;
create policy "cred_pgto_insert_own_loja"
on public.lf_credenciais_pagamento for insert
to authenticated
with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

drop policy if exists "cred_pgto_update_own_loja" on public.lf_credenciais_pagamento;
create policy "cred_pgto_update_own_loja"
on public.lf_credenciais_pagamento for update
to authenticated
using      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

drop policy if exists "cred_pgto_delete_own_loja" on public.lf_credenciais_pagamento;
create policy "cred_pgto_delete_own_loja"
on public.lf_credenciais_pagamento for delete
to authenticated
using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- ── 2. Flag pública em lf_config ────────────────────────────────────────────
-- Booleano, não segredo: diz ao catálogo se vale oferecer o QR dinâmico.
-- Quem garante que existe token de verdade é a Edge Function, que devolve 409
-- se a flag estiver ligada sem credencial gravada.
alter table public.lf_config
  add column if not exists mercadopago_ativo boolean not null default false;

-- ── 3. Correlação pedido ↔ pagamento ────────────────────────────────────────
-- O webhook chega com o id do pagamento no Mercado Pago; sem esta coluna não
-- há como achar o pedido correspondente.
alter table public.lf_pedidos
  add column if not exists mp_payment_id text;

create index if not exists lf_pedidos_mp_payment_id_idx
  on public.lf_pedidos (mp_payment_id)
  where mp_payment_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. DUAS COISAS QUE ESTA MIGRATION *NÃO* CONSERTA — mas você precisa saber
--
-- 4a. lf_pedidos também está aberta para a anon key. Conferido:
--       curl "$URL/rest/v1/lf_pedidos?select=*" -H "apikey: <ANON>"
--     devolve os pedidos de TODAS as lojas, com cliente_nome e
--     cliente_whatsapp. Isso é exposição de dado pessoal de cliente final e
--     independe do Mercado Pago. O catálogo depende hoje desse acesso para
--     inserir o pedido e para consultar o status, então fechar exige uma
--     policy pensada (insert liberado, select restrito ao próprio pedido) —
--     trabalho separado, fora do escopo desta integração.
--
-- 4b. O status 'pago' passa a existir em lf_pedidos. Os valores em uso hoje
--     são 'aguardando_contato' e 'aguardando_pagamento' (texto livre, sem
--     enum nem check). Nenhuma constraint precisa mudar, mas as telas que
--     listam pedidos ganham um status novo para exibir.
-- ─────────────────────────────────────────────────────────────────────────────
