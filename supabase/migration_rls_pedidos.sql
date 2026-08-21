-- ─────────────────────────────────────────────────────────────────────────────
-- RLS em lf_pedidos.
--
-- NÃO FOI EXECUTADO. É DDL: rode manualmente no SQL Editor.
--
-- ─── O QUE FOI MEDIDO (21/08/2026, contra o projeto, com a ANON KEY) ────────
-- A anon key é pública por definição: está no bundle JS de toda página do
-- catálogo. Com ela, hoje:
--
--   SELECT  → devolve os pedidos de TODAS as lojas, com cliente_nome e
--             cliente_whatsapp. Confirmado: 3 linhas, 2 lojas distintas.
--   INSERT  → cria pedido para qualquer loja_id, inclusive inexistente.
--   UPDATE  → confirmado marcando um pedido de teste como status='pago'.
--   DELETE  → confirmado, 204 e a linha some.
--
-- (O teste usou uma linha descartável com loja_id '__probe_rls__', apagada em
-- seguida; a verificação final devolveu [].)
--
-- O relato inicial era "expõe dado pessoal". A leitura é o menor dos
-- problemas: QUALQUER PESSOA MARCA QUALQUER PEDIDO COMO PAGO. Isso anula por
-- completo a validação de assinatura do mp-webhook — não adianta o webhook
-- exigir HMAC se o mesmo efeito se consegue com um PATCH direto no PostgREST.
-- E DELETE liberado significa que dá para apagar o histórico de pedidos de
-- todas as lojas.
--
-- ─── POR QUE ESTA TABELA SAI DO PADRÃO DAS OUTRAS lf_* ──────────────────────
-- Confirmado que lf_clientes, lf_vendas e lf_produtos também estão sem RLS —
-- é o design do sistema, e esta migration não mexe nelas. lf_pedidos é
-- diferente por dois motivos concretos: (1) é a única escrita pelo PÚBLICO
-- não autenticado, então a superfície é a internet inteira e não o painel; e
-- (2) o status dela virou gatilho financeiro com a integração do Mercado Pago.
--
-- ─── DESENHO ────────────────────────────────────────────────────────────────
--   anon           INSERT (colunas limitadas, status restrito)
--                  SELECT apenas (id, status), e só de pedido recente
--                  SEM update, SEM delete
--   authenticated  SELECT/UPDATE completos, só da própria loja
--                  SEM delete
--   service_role   ignora RLS — as Edge Functions seguem iguais
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.lf_pedidos enable row level security;

-- ── Privilégios de coluna ───────────────────────────────────────────────────
-- RLS filtra LINHAS; quem filtra COLUNAS é o GRANT. É esta parte que tira
-- cliente_nome e cliente_whatsapp do alcance do público — uma policy de SELECT
-- sozinha devolveria a linha inteira.
revoke all on public.lf_pedidos from anon;

-- O catálogo insere exatamente estas colunas (CatalogoPublicoV2.jsx,
-- registrarPedido). mp_payment_id e comprovante_url ficam de fora de
-- propósito: são campos de controle do fluxo de pagamento. Deixar o público
-- gravar mp_payment_id permitiria apontar um pedido falso para um pagamento
-- real e confundir o mp-webhook, que localiza o pedido por esse campo.
grant insert (loja_id, cliente_nome, cliente_whatsapp, produtos,
              valor_total, status, forma_pagamento, observacoes)
  on public.lf_pedidos to anon;

-- Só o suficiente para o checkout funcionar:
--   • `.insert(...).select('id')` devolve o id do pedido criado;
--   • o polling do Pix dinâmico lê o status até o webhook confirmar.
-- Nenhuma coluna com dado de pessoa.
grant select (id, status) on public.lf_pedidos to anon;

grant select, update on public.lf_pedidos to authenticated;

-- ── Policies: público ───────────────────────────────────────────────────────
drop policy if exists "pedidos_insert_publico" on public.lf_pedidos;
create policy "pedidos_insert_publico"
on public.lf_pedidos for insert
to anon
with check (
  -- Um pedido não nasce pago. 'pago' só entra pelo mp-webhook, que roda com
  -- service_role e ignora RLS — é o ponto da tarefa, e é o que fecha o buraco
  -- de marcar pedido como pago pelo PostgREST.
  status in ('aguardando_contato', 'aguardando_pagamento')
  -- Loja precisa existir. Sem isto dá para poluir a tabela com pedidos de
  -- lojas inventadas, que foi como o teste acima criou a linha descartável.
  and exists (select 1 from public.lf_config c where c.loja_id = lf_pedidos.loja_id)
  and valor_total >= 0
);

drop policy if exists "pedidos_select_publico_recente" on public.lf_pedidos;
create policy "pedidos_select_publico_recente"
on public.lf_pedidos for select
to anon
using (
  -- Janela curta: o público só precisa ler o pedido que acabou de criar. Sem
  -- o recorte, `GET /lf_pedidos?select=id,status` sem filtro devolveria a
  -- lista inteira de ids — sem dado pessoal, mas ainda assim um inventário.
  --
  -- Efeito de passar de 6h: o polling do Pix para de atualizar e a tela fica
  -- em "Aguardando o pagamento...". O pedido continua íntegro e o webhook
  -- continua marcando pago; só a confirmação na tela não aparece sozinha.
  created_at > now() - interval '6 hours'
);

-- SEM policy de UPDATE e SEM policy de DELETE para anon. Somado ao
-- `revoke all` acima, isso derruba os dois caminhos confirmados no teste.

-- ── Policies: lojista ───────────────────────────────────────────────────────
-- Mesmo padrão de app_metadata.loja_id já usado em ClientPrivateRoute e nas
-- policies de storage (ver migration_fiscal.sql).
drop policy if exists "pedidos_select_own_loja" on public.lf_pedidos;
create policy "pedidos_select_own_loja"
on public.lf_pedidos for select
to authenticated
using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

drop policy if exists "pedidos_update_own_loja" on public.lf_pedidos;
create policy "pedidos_update_own_loja"
on public.lf_pedidos for update
to authenticated
using      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
-- WITH CHECK impede mover o pedido para outra loja no meio de um update.
with check (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- Sem DELETE para authenticated: cancelarPedido (useLojaData.js) trabalha com
-- UPDATE status='cancelado', nunca apaga. Não há nada no app que precise.

-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE RODAR — confira que o fluxo continua de pé
--
-- Cada linha abaixo foi conferida contra o código em 21/08/2026:
--
--   ✔ CatalogoPublicoV2 registrarPedido  insert + .select('id')
--       INSERT permitido; SELECT(id) concedido; policy de select cobre a linha
--       recém-criada (created_at = now()).
--   ✔ CatalogoPublicoV2 polling do Pix   .select('status').eq('id', ...)
--       SELECT(id, status) concedido — id também é preciso, porque coluna
--       usada em WHERE exige privilégio de leitura.
--   ✔ useLojaData:135 listagem no painel  .select('*').eq('loja_id', lojaId)
--       authenticated com SELECT completo da própria loja.
--   ✔ useLojaData:630 updatePedido        .update().select().single()
--       UPDATE + SELECT da própria loja; o select pós-update encontra a linha,
--       que era a preocupação registrada no comentário de cancelarPedido.
--   ✔ useLojaData cancelarPedido          select + update + .select()
--       idem. A devolução de estoque não é pulada.
--   ✔ mp-criar-pix / mp-webhook           service_role, ignora RLS.
--   ✔ lf_pedido_baixa_estoque             não toca lf_pedidos, só estoque.
--
--   ✘ CatalogoPublico.jsx (V1) faz `.insert(...).select()` sem lista de
--     colunas, e passaria a falhar por falta de privilégio nas demais colunas.
--     NÃO é regressão de produção: o V1 está sem rota desde 208e53e, quando o
--     /{loja}/catalogo passou para o V2. Se um dia for reativado, troque por
--     `.select('id')`.
--
-- EFEITO COLATERAL BOM, mas que vale saber: com RLS ligada, uma lojista de
-- sessão expirada passa a ver ZERO pedidos em vez de todos. O supabase-js manda
-- a anon key quando não acha sessão (ver src/lib/authRefresh.js), e antes disso
-- a tabela aberta escondia o problema. Falhar fechado é o certo, mas a tela vai
-- parecer "sumiu tudo" em vez de "faça login de novo".
--
-- DEPOIS DE RODAR, confirme que o buraco fechou:
--   curl -X PATCH "$URL/rest/v1/lf_pedidos?id=eq.<algum-id>" \
--        -H "apikey: <ANON>" -H "Content-Type: application/json" \
--        -d '{"status":"pago"}'
--   → esperado: 401/403 (permission denied), e não 204.
-- ─────────────────────────────────────────────────────────────────────────────
