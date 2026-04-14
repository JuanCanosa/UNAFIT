-- ─── White label: logo da academia ──────────────────────────────────────────
ALTER TABLE academias ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE academias ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT; -- cliente da academia no Asaas UNAFIT

-- ─── SaaS: planos do UNAFIT ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_planos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL UNIQUE,
  descricao   TEXT,
  valor       NUMERIC(10,2) NOT NULL,
  limite_alunos INT,           -- null = ilimitado
  ativo       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Planos padrão do UNAFIT
INSERT INTO saas_planos (nome, descricao, valor, limite_alunos) VALUES
  ('Starter',  'Até 50 alunos',      99.90,  50),
  ('Pro',      'Até 200 alunos',    199.90, 200),
  ('Business', 'Alunos ilimitados', 349.90, null)
ON CONFLICT (nome) DO NOTHING;

-- ─── SaaS: assinaturas das academias ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_assinaturas (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id           UUID NOT NULL UNIQUE REFERENCES academias(id) ON DELETE CASCADE,
  saas_plano_id         UUID NOT NULL REFERENCES saas_planos(id),
  status                TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','cancelada','suspensa','trial')),
  data_inicio           DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim              DATE,
  asaas_subscription_id TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SaaS: faturas das academias ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saas_faturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id       UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  saas_assinatura_id UUID REFERENCES saas_assinaturas(id) ON DELETE SET NULL,
  descricao         TEXT NOT NULL,
  valor             NUMERIC(10,2) NOT NULL,
  data_vencimento   DATE NOT NULL,
  data_pagamento    DATE,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','vencido','cancelado')),
  asaas_payment_id  TEXT,
  link_pagamento    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE saas_planos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_assinaturas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE saas_faturas      ENABLE ROW LEVEL SECURITY;

-- Planos: visíveis por todos autenticados
CREATE POLICY "saas_planos_leitura" ON saas_planos FOR SELECT USING (auth.role() = 'authenticated');

-- Assinaturas: academia vê a sua própria
CREATE POLICY "saas_assinaturas_propria" ON saas_assinaturas
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

-- Faturas: academia vê as suas próprias
CREATE POLICY "saas_faturas_propria" ON saas_faturas
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));
