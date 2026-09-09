-- ─────────────────────────────────────────────────────────────────────────────
-- Contato da cliente obrigatório em lf_pedidos.
--
-- NÃO FOI EXECUTADO. É DDL: rode manualmente no SQL Editor.
--
-- ─── O QUE ACONTECEU ────────────────────────────────────────────────────────
-- Um pedido real da Tropicale chegou com cliente_nome = '' e
-- cliente_whatsapp = '' — a lojista não tinha como falar com quem pediu.
--
-- A causa não era validação frouxa: era ausência dos campos. O catálogo V1
-- (CatalogoPublico.jsx) coletava os dois e travava o botão sem eles
-- (`disabled={... || !form.nome.trim() || !form.whatsapp.trim()}`), mas o V2
-- nasceu sem formulário nenhum e gravava literalmente:
--
--     cliente_nome: '',
--     cliente_whatsapp: '',
--
-- A ideia do V2 era que a cliente se identificasse ao mandar a mensagem no
-- WhatsApp. Isso até se sustenta nesse caminho, mas cai por terra nos dois
-- caminhos de Pix: ela paga e pode nunca mandar mensagem — aí o pedido fica
-- pago e anônimo.
--
-- O app já foi corrigido (CatalogoPublicoV2.jsx pede nome e WhatsApp e trava
-- os quatro caminhos que registram pedido). Esta migration é a segunda
-- camada: o banco não deve depender de o front estar correto, ainda mais
-- numa tabela que aceita INSERT do público não autenticado.
--
-- ─── POR QUE NA POLICY, E NÃO NUM CHECK DE TABELA ───────────────────────────
-- Um `alter table ... add constraint ... check (...)` valeria para TODO mundo,
-- inclusive para a service_role e para os UPDATEs da lojista. Efeito colateral
-- ruim: os pedidos antigos que já estão com contato vazio passariam a recusar
-- qualquer UPDATE — cancelarPedido (useLojaData.js) quebraria justamente nas
-- linhas problemáticas. Mesmo com NOT VALID, o CHECK vale para toda linha
-- alterada dali em diante.
--
-- A policy de INSERT do anon acerta o alvo exato: a porta por onde os pedidos
-- ruins entram, sem tocar no que já existe nem no que a lojista faz.
-- ─────────────────────────────────────────────────────────────────────────────

-- Substitui a policy criada em migration_rls_pedidos.sql, acrescentando as
-- duas checagens de contato. As regras que já existiam continuam iguais.
drop policy if exists "pedidos_insert_publico" on public.lf_pedidos;
create policy "pedidos_insert_publico"
on public.lf_pedidos for insert
to anon
with check (
  -- Um pedido não nasce pago. 'pago' só entra pelo mp-webhook, que roda com
  -- service_role e ignora RLS.
  status in ('aguardando_contato', 'aguardando_pagamento')

  -- Loja precisa existir.
  and exists (select 1 from public.lf_config c where c.loja_id = lf_pedidos.loja_id)

  and valor_total >= 0

  -- ── NOVO: contato de verdade ──────────────────────────────────────────
  -- Espelha exatamente a validação do app (src/utils/catalogoV2.js:
  -- nomeValido e whatsappValido). Se um dia divergirem, o banco é quem manda
  -- e a cliente leva um erro genérico — por isso as duas precisam andar
  -- juntas.
  and cliente_nome is not null
  and length(btrim(cliente_nome)) >= 2

  and cliente_whatsapp is not null
  -- 10 dígitos = fixo com DDD, 11 = celular com DDD. A máscara é irrelevante:
  -- o app grava só dígitos, mas a checagem tira qualquer coisa que não seja
  -- número antes de contar, então '(85) 99999-0000' também passaria.
  and length(regexp_replace(cliente_whatsapp, '\D', '', 'g')) between 10 and 11
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ANTES DE RODAR
--
-- 1. Veja quantos pedidos já estão sem contato. Esta migration NÃO mexe neles
--    de propósito — apagar ou alterar pedido real é decisão sua, não de um
--    script:
--
--      select id, loja_id, valor_total, status, created_at
--        from public.lf_pedidos
--       where coalesce(btrim(cliente_nome), '') = ''
--          or length(regexp_replace(coalesce(cliente_whatsapp, ''), '\D', '', 'g')) < 10
--       order by created_at desc;
--
--    Para os que ainda dá para recuperar, o histórico do WhatsApp da loja é a
--    única fonte — não há nada no banco que ligue o pedido a uma pessoa.
--
-- 2. Confirme que o caminho bom continua passando. Um INSERT com contato
--    válido tem de funcionar; um sem, tem de falhar com
--    "new row violates row-level security policy":
--
--      -- deve PASSAR
--      insert into public.lf_pedidos
--        (loja_id, cliente_nome, cliente_whatsapp, produtos, valor_total, status)
--      values ('tropicaleatacado', 'Teste', '85999990000', '[]'::jsonb, 1,
--              'aguardando_contato');
--
--      -- deve FALHAR
--      insert into public.lf_pedidos
--        (loja_id, cliente_nome, cliente_whatsapp, produtos, valor_total, status)
--      values ('tropicaleatacado', '', '', '[]'::jsonb, 1, 'aguardando_contato');
--
--    (Rodando como service_role no SQL Editor a RLS é ignorada e os dois
--    passam. Para valer, teste via PostgREST com a anon key — ou
--    `set local role anon;` dentro de uma transação que você dá rollback.)
--
-- 3. Se rodar isto SEM o deploy do front corrigido, o catálogo passa a falhar
--    em todo pedido: o app ainda mandaria strings vazias e o banco recusaria.
--    A ordem certa é front primeiro, banco depois — ou os dois juntos.
-- ─────────────────────────────────────────────────────────────────────────────
