-- ============================================================
-- Módulo: Loja Feminina (junttos-admin)
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- Configuração e feature flags da loja
CREATE TABLE IF NOT EXISTS lf_config (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id         text        NOT NULL UNIQUE,
  nome            text        NOT NULL DEFAULT 'Loja Feminina',
  cor_primaria    text        DEFAULT '#5E2BD0',
  cor_secundaria  text        DEFAULT '#FF6F5E',
  -- Feature flags: admin Junttos habilita/desabilita por loja
  features        jsonb       NOT NULL DEFAULT '{
    "vendas": true,
    "historico": true,
    "metas": true,
    "fechamento_caixa": true,
    "relatorios": true,
    "clientes": false,
    "estoque": false
  }',
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Catálogo de produtos por loja
CREATE TABLE IF NOT EXISTS lf_produtos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     text        NOT NULL,
  nome        text        NOT NULL,
  ativo       boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Vendas
CREATE TABLE IF NOT EXISTS lf_vendas (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id      text        NOT NULL,
  cliente_nome text,
  cliente_tel  text,
  valor        numeric     NOT NULL DEFAULT 0,
  forma_pgto   text,
  obs          text,
  produtos     jsonb       DEFAULT '[]',
  vendedora    text,
  data         timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now()
);

-- Fechamentos de caixa
CREATE TABLE IF NOT EXISTS lf_caixas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     text        NOT NULL,
  data        date        NOT NULL,
  dinheiro    numeric     DEFAULT 0,
  pix         numeric     DEFAULT 0,
  debito      numeric     DEFAULT 0,
  credito     numeric     DEFAULT 0,
  saldo_ini   numeric     DEFAULT 0,
  sangria     numeric     DEFAULT 0,
  despesas    numeric     DEFAULT 0,
  obs         text,
  total       numeric     DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Metas mensais por loja
CREATE TABLE IF NOT EXISTS lf_metas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     text        NOT NULL,
  mes         text        NOT NULL,  -- YYYY-MM
  valor       numeric     NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (loja_id, mes)
);

-- Desabilitar RLS (admin app — habilitar e configurar políticas se expor ao público)
ALTER TABLE lf_config   DISABLE ROW LEVEL SECURITY;
ALTER TABLE lf_produtos DISABLE ROW LEVEL SECURITY;
ALTER TABLE lf_vendas   DISABLE ROW LEVEL SECURITY;
ALTER TABLE lf_caixas   DISABLE ROW LEVEL SECURITY;
ALTER TABLE lf_metas    DISABLE ROW LEVEL SECURITY;

-- Índices de performance
CREATE INDEX IF NOT EXISTS lf_vendas_loja_data  ON lf_vendas  (loja_id, data DESC);
CREATE INDEX IF NOT EXISTS lf_caixas_loja_data  ON lf_caixas  (loja_id, data DESC);
CREATE INDEX IF NOT EXISTS lf_produtos_loja     ON lf_produtos (loja_id, ativo);
CREATE INDEX IF NOT EXISTS lf_metas_loja        ON lf_metas   (loja_id, mes);
