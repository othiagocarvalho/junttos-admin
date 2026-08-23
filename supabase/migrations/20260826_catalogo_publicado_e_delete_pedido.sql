-- ─────────────────────────────────────────────────────────────────────────────
-- Duas coisas que a tela nova precisa e o banco ainda não permite:
--   1. lf_config.catalogo_publicado — a chave de "loja aberta / loja fechada";
--   2. DELETE em lf_pedidos para a lojista — hoje NÃO existe, e sem isto o
--      botão Excluir não apaga nada.
--
-- ⚠️ NÃO FOI EXECUTADA. Tem DDL e mexe em RLS de produção: rode manualmente no
--    SQL Editor, depois de ler a seção "ANTES DE RODAR" no fim.
--
-- Enquanto ela não roda, o app se comporta assim, de propósito:
--   • catálogo continua PUBLICADO (a leitura usa `!== false`, então coluna
--     ausente = publicado). O botão de publicar aparece e vai falhar ao
--     salvar, com erro visível — não em silêncio;
--   • Excluir pedido mostra "o banco não apagou nenhum pedido", que é a
--     mensagem certa: a permissão ainda não existe.
-- ═══════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Publicar / despublicar o catálogo ────────────────────────────────────
-- DEFAULT TRUE é obrigatório aqui: as 13 lojas já têm catálogo no ar, e um
-- default false derrubaria todas no instante em que a migration rodasse.
--
-- Fica em lf_config, e não em tabela nova, porque não é segredo: o catálogo
-- público já lê lf_config inteira com a anon key, e ele PRECISA deste valor
-- para saber se mostra as peças. É o mesmo raciocínio do mercadopago_ativo.
--
-- NOME: `catalogo_publicado`, não `catalogo_publico`. A segunda JÁ EXISTE e é
-- outra coisa completamente diferente — guarda o segmento do público
-- ('feminino'). Confundir as duas seria despublicar loja achando que estava
-- trocando de segmento.
alter table public.lf_config
  add column if not exists catalogo_publicado boolean not null default true;

comment on column public.lf_config.catalogo_publicado is
  'Catálogo público visível? false mostra a tela de "voltamos em breve" com o '
  'WhatsApp da loja, sem produto nem preço. Não confundir com catalogo_publico, '
  'que é o segmento do público.';

-- ── 2. Excluir pedido ───────────────────────────────────────────────────────
-- migration_rls_pedidos.sql concedeu a `authenticated` apenas SELECT e UPDATE,
-- e escreveu explicitamente:
--
--   "Sem DELETE para authenticated: cancelarPedido (useLojaData.js) trabalha
--    com UPDATE status='cancelado', nunca apaga. Não há nada no app que
--    precise."
--
-- Isso mudou: a lojista pediu para apagar pedido de teste e pedido duplicado,
-- que hoje ficam para sempre poluindo a lista e as somas.
--
-- CANCELAR CONTINUA SENDO O CAMINHO NORMAL. A diferença importa:
--   • Cancelar  → muda status e DEVOLVE ao estoque o que o checkout baixou;
--   • Excluir   → apaga a linha e NÃO devolve estoque nenhum.
-- Por isso a tela só oferece Excluir junto com Cancelar, nunca no lugar dele,
-- e avisa que a ação não tem volta.
grant delete on public.lf_pedidos to authenticated;

drop policy if exists "pedidos_delete_own_loja" on public.lf_pedidos;
create policy "pedidos_delete_own_loja"
on public.lf_pedidos for delete
to authenticated
-- Mesmo recorte das policies de select e update desta tabela: a lojista só
-- alcança pedido da PRÓPRIA loja. O claim é o mesmo usado em
-- ClientPrivateRoute e nas policies de storage.
using (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- E o público continua SEM delete. Isto aqui não é decorativo: a tabela aceita
-- INSERT de gente não autenticada, e um anon com DELETE apagaria o histórico
-- de pedidos de todas as lojas. Nenhuma policy de delete `to anon` é criada, e
-- o revoke abaixo é a segunda tranca, caso um grant amplo apareça um dia.
revoke delete on public.lf_pedidos from anon;

commit;

-- ═══════════════════════════════════════════════════════════════════════════
-- ANTES DE RODAR
--
-- 1. Confirme que a coluna do segmento não vai ser confundida. As duas devem
--    coexistir depois desta migration:
--
--      select column_name, data_type, column_default
--        from information_schema.columns
--       where table_schema = 'public' and table_name = 'lf_config'
--         and column_name in ('catalogo_publico', 'catalogo_publicado')
--       order by column_name;
--
-- 2. Veja o estado das policies de lf_pedidos ANTES, para poder comparar:
--
--      select policyname, roles, cmd from pg_policies
--       where schemaname = 'public' and tablename = 'lf_pedidos'
--       order by cmd, policyname;
--
--    O esperado ANTES: insert/select para anon, select/update para
--    authenticated, e NENHUMA de delete.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- DEPOIS DE RODAR
--
-- 1. Todas as lojas continuam publicadas — nenhuma pode ter caído:
--
--      select loja_id, catalogo_publicado from public.lf_config
--       order by catalogo_publicado, loja_id;
--      -- esperado: todas com true
--
-- 2. O público NÃO pode apagar pedido. Este curl tem de falhar:
--
--      curl -i -X DELETE "$URL/rest/v1/lf_pedidos?id=eq.<algum-id>" \
--        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
--      -- esperado: 401/403. NUNCA 204 com a linha sumindo.
--
-- 3. A lojista apaga só o que é dela. Com sessão de OUTRA loja, o DELETE tem
--    de afetar zero linhas (o PostgREST devolve 204 mesmo assim — por isso o
--    app confere a contagem, ver excluirPedido em useLojaData.js).
--
-- 4. Despublicar e conferir a tela pública:
--
--      update public.lf_config set catalogo_publicado = false
--       where loja_id = 'tropicaleatacado';
--
--    Abrir /tropicaleatacado/catalogo: tem de mostrar a tela de aviso com o
--    botão de WhatsApp, e NENHUM produto ou preço. Depois:
--
--      update public.lf_config set catalogo_publicado = true
--       where loja_id = 'tropicaleatacado';
--
-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK
--
--   drop policy if exists "pedidos_delete_own_loja" on public.lf_pedidos;
--   revoke delete on public.lf_pedidos from authenticated;
--   -- a coluna pode ficar: com default true ela não muda o comportamento de
--   -- nada que exista hoje. Se for mesmo remover:
--   -- alter table public.lf_config drop column if exists catalogo_publicado;
-- ═══════════════════════════════════════════════════════════════════════════
