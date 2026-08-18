-- Migration: catálogo público — PARTE 2 de 2 (lf_pedidos)
--
-- ⛔ NÃO RODE AINDA. Esta parte QUEBRA o checkout se aplicada sozinha.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- PRÉ-REQUISITO OBRIGATÓRIO: ajuste no front
--
-- A policy abaixo dá ao visitante anônimo INSERT em lf_pedidos, mas NÃO
-- SELECT — de propósito, senão ele leria os pedidos de todos os clientes da
-- loja (nome e WhatsApp de terceiros).
--
-- Só que CatalogoPublico.jsx:740 faz:
--
--     const { data: pedidoInserido, error: insertError } = await supabase
--       .from('lf_pedidos').insert(novoPedido).select().single()
--     if (insertError) { setErroConfirmar('Erro ao registrar pedido: ...'); return }
--
-- Sem SELECT para o anon, o `.select()` pós-insert volta vazio (PGRST116). O
-- pedido É gravado, mas o código entra no `if (insertError)`, mostra "Erro ao
-- registrar pedido" para o cliente e faz `return` — pulando a baixa de
-- estoque. Resultado: pedido fantasma, estoque não baixado e o comprador
-- achando que falhou.
--
-- AJUSTE NECESSÁRIO ANTES DE APLICAR (CatalogoPublico.jsx):
--   1. Gerar o id no cliente:      const novoId = crypto.randomUUID()
--   2. Incluí-lo no payload:       const novoPedido = { id: novoId, ...  }
--   3. Trocar o insert por:        .from('lf_pedidos').insert(novoPedido)
--                                  (sem .select().single())
--   4. Usar `novoId` no lugar de `pedidoInserido?.id` nas duas referências
--      seguintes (p_pedido_id da RPC e setPedidoId).
--   5. Tratar o erro só por `insertError` do próprio insert.
--
-- Depois disso, o anon nunca lê lf_pedidos e o checkout segue funcionando.
--
-- Rodar a PARTE 1 primeiro. Ela é independente e já fecha 661 das 663 linhas
-- expostas; esta parte cobre as 2 linhas restantes de lf_pedidos.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────────────────────
-- lf_pedidos — visitante só cria; quem lê é a loja dona
--
-- RLS não filtra coluna: quem restringe o que o anon pode gravar é o GRANT
-- por coluna. Sem isso, o visitante poderia mandar loja_id de outra loja, ou
-- um valor_total de R$ 0,01, ou se declarar pago.

ALTER TABLE lf_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lf_pedidos_own_loja  ON lf_pedidos;
DROP POLICY IF EXISTS lf_pedidos_anon_novo ON lf_pedidos;

-- A loja logada faz tudo com os pedidos dela (PedidosCatalogo, cancelamento).
CREATE POLICY lf_pedidos_own_loja
    ON lf_pedidos FOR ALL
    TO authenticated
 USING      (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'))
 WITH CHECK (loja_id = (auth.jwt() -> 'app_metadata' ->> 'loja_id'));

-- Visitante só INSERT. Sem policy de SELECT para anon: ele não lê o próprio
-- pedido de volta nem o de ninguém. `status` é travado no valor inicial para
-- que ninguém se declare pago.
CREATE POLICY lf_pedidos_anon_novo
    ON lf_pedidos FOR INSERT
    TO anon
 WITH CHECK (status = 'aguardando_pagamento');

REVOKE ALL     ON lf_pedidos FROM anon;
GRANT  INSERT (id, loja_id, cliente_nome, cliente_whatsapp, produtos,
               valor_total, status, forma_pagamento)
                ON lf_pedidos TO anon;
-- `id` entra na lista porque, com o ajuste do front, ele passa a vir do
-- cliente (crypto.randomUUID()) em vez do default do banco.

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- CONFERÊNCIA (rodar depois)

-- 1) Policies:
-- SELECT tablename, policyname, roles, cmd FROM pg_policies
--  WHERE tablename = 'lf_pedidos' ORDER BY policyname;

-- 2) Anon não lê pedido de ninguém:
--    curl "$URL/rest/v1/lf_pedidos?select=*" -H "apikey:$ANON"   → []

-- 3) Anon não consegue se declarar pago:
--    curl -X POST "$URL/rest/v1/lf_pedidos" -H "apikey:$ANON" \
--      -d '{"loja_id":"sualoja","status":"pago","valor_total":1}' → 42501

-- 4) Checkout ponta a ponta (com o front já ajustado): pedido gravado,
--    tela de Pix exibida, estoque baixado, sem erro na tela do cliente.

-- 5) A loja logada continua vendo os pedidos dela em PedidosCatalogo e
--    consegue cancelar (o cancelarPedido faz update + select pós-update).

-- ROLLBACK:
-- ALTER TABLE lf_pedidos DISABLE ROW LEVEL SECURITY;
-- DROP POLICY IF EXISTS lf_pedidos_own_loja  ON lf_pedidos;
-- DROP POLICY IF EXISTS lf_pedidos_anon_novo ON lf_pedidos;
-- GRANT ALL ON lf_pedidos TO anon;
