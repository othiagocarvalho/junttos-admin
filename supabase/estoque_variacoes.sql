-- Migration: Estoque com variações por cor/modelo
-- Execute no Supabase Dashboard > SQL Editor

-- 1. Adiciona coluna variacoes (jsonb) se não existir
ALTER TABLE lf_produtos
  ADD COLUMN IF NOT EXISTS variacoes jsonb DEFAULT '[]'::jsonb;

-- 2. Limpa todos os produtos da biastore
DELETE FROM lf_produtos WHERE loja_id = 'biastore';

-- 3. Insere produtos com variações
INSERT INTO lf_produtos (loja_id, nome, categoria, preco_custo, preco_venda, quantidade, variacoes, ativo) VALUES

('biastore','Bermuda Jeans','Short',28.13,79.90,0,
  '[{"cor":"T.36 Padrão","quantidade":1},{"cor":"T.38 Padrão","quantidade":6},{"cor":"T.40 Padrão","quantidade":4},{"cor":"T.42 Padrão","quantidade":5},{"cor":"T.44 Padrão","quantidade":3}]',true),

('biastore','Short Alfaiataria c/ Cinto','Short',17.67,59.90,0,
  '[{"cor":"Preto","quantidade":3},{"cor":"Marrom","quantidade":1},{"cor":"Verde","quantidade":1},{"cor":"Roxo","quantidade":1},{"cor":"Azul","quantidade":1},{"cor":"Amarelo","quantidade":1},{"cor":"Rosa","quantidade":1}]',true),

('biastore','Short Alfaiataria s/ Cinto','Short',17.67,59.90,0,
  '[{"cor":"Preto","quantidade":5},{"cor":"Marrom","quantidade":2},{"cor":"Terracota","quantidade":1},{"cor":"Azul","quantidade":1},{"cor":"Azul Piscina","quantidade":1}]',true),

('biastore','Cropped Scuba','Cropped',16.67,49.90,0,
  '[{"cor":"Preto","quantidade":5},{"cor":"Vermelho","quantidade":3},{"cor":"Rosa Baby","quantidade":3},{"cor":"Marrom","quantidade":2},{"cor":"Terracota","quantidade":2},{"cor":"Verde","quantidade":1},{"cor":"Salmão","quantidade":1}]',true),

('biastore','Blusa Poliamida','Blusa',19.67,59.90,0,
  '[{"cor":"Vermelha","quantidade":2},{"cor":"Marrom","quantidade":2},{"cor":"Amarela","quantidade":2},{"cor":"Preta","quantidade":2}]',true),

('biastore','Blusa Poliamida Promo','Blusa',19.67,49.90,0,
  '[{"cor":"Preta","quantidade":1},{"cor":"Marrom","quantidade":1},{"cor":"Vermelha","quantidade":1}]',true),

('biastore','Blusa Junina','Blusa',16.67,39.90,0,
  '[{"cor":"Vermelha","quantidade":1},{"cor":"Rosa","quantidade":2}]',true),

('biastore','Blusa Junina Premium','Blusa',16.67,49.90,0,
  '[{"cor":"Rosa","quantidade":2},{"cor":"Vermelha","quantidade":3},{"cor":"Branco","quantidade":3}]',true),

('biastore','Blusa Junina Poliamida','Blusa',19.67,59.90,0,
  '[{"cor":"Marrom","quantidade":2}]',true),

('biastore','Blusa do Brasil','Blusa',19.67,59.90,0,
  '[{"cor":"Verde/Amarelo","quantidade":9}]',true),

-- Com variações
('biastore','Vestido Poliamida','Vestido',36.67,89.90,0,
  '[{"cor":"Branco","quantidade":2},{"cor":"Caramelo","quantidade":2},{"cor":"Vermelho","quantidade":2},{"cor":"Café","quantidade":2},{"cor":"Preto","quantidade":1}]',true),

('biastore','Vestido Poliamida Promo','Vestido',36.67,39.90,0,
  '[{"cor":"Vermelho","quantidade":1}]',true),

('biastore','Vestido Canelado','Vestido',21.67,54.90,0,
  '[{"cor":"Preto","quantidade":1},{"cor":"Vinho","quantidade":1},{"cor":"Marrom","quantidade":1}]',true),

('biastore','Macaquinho Canelado','Vestido',21.67,54.90,0,
  '[{"cor":"Amarelo","quantidade":1},{"cor":"Rosa","quantidade":1}]',true),

('biastore','Vestido de Couro','Vestido',31.67,79.90,0,
  '[{"cor":"Preto","quantidade":1}]',true),

('biastore','Sobretudo','Outros',11.67,29.90,0,
  '[{"cor":"Preto","quantidade":2},{"cor":"Vermelho","quantidade":1}]',true),

('biastore','Bolsas','Acessório',28.13,79.90,0,
  '[{"cor":"Modelo 1","quantidade":1},{"cor":"Modelo 2","quantidade":1},{"cor":"Modelo 3","quantidade":1},{"cor":"Modelo 4","quantidade":1},{"cor":"Modelo 5","quantidade":1},{"cor":"Modelo 6","quantidade":1},{"cor":"Modelo 7","quantidade":1},{"cor":"Modelo 8","quantidade":1},{"cor":"Modelo 9","quantidade":1}]',true),

('biastore','Óculos de Sol','Acessório',31.57,79.90,0,
  '[{"cor":"Modelo 1","quantidade":1},{"cor":"Modelo 2","quantidade":1},{"cor":"Modelo 3","quantidade":1},{"cor":"Modelo 4","quantidade":1},{"cor":"Modelo 5","quantidade":1},{"cor":"Modelo 6","quantidade":1},{"cor":"Modelo 7","quantidade":1},{"cor":"Modelo 8","quantidade":1}]',true),

('biastore','Conjunto Poliamida','Conjunto',36.67,59.90,0,
  '[{"cor":"Preto","quantidade":1}]',true),

('biastore','Conjunto Canelado','Conjunto',21.67,59.90,0,
  '[{"cor":"Preto","quantidade":1},{"cor":"Azul","quantidade":1}]',true),

('biastore','Conjunto Alfaiataria','Conjunto',26.67,59.90,0,
  '[{"cor":"Vinho","quantidade":1}]',true),

('biastore','Body Poliamida','Outros',17.67,54.90,0,
  '[{"cor":"Marrom","quantidade":4},{"cor":"Preto","quantidade":3},{"cor":"Bege","quantidade":2},{"cor":"Caramelo","quantidade":2},{"cor":"Lilás","quantidade":2},{"cor":"Nude","quantidade":2},{"cor":"Amarelo","quantidade":1},{"cor":"Azul","quantidade":1},{"cor":"Cinza","quantidade":1},{"cor":"Verde","quantidade":2},{"cor":"Azul Petróleo","quantidade":1}]',true),

('biastore','Body Suplex Promo','Outros',17.67,29.90,0,
  '[{"cor":"Preto","quantidade":1}]',true);
