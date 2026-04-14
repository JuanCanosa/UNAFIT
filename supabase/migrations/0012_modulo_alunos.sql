-- ─── Categorias de alunos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_alunos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cor         TEXT DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (academia_id, nome)
);

-- ─── Alunos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alunos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id          UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  user_id              UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  categoria_id         UUID REFERENCES categorias_alunos(id) ON DELETE SET NULL,

  nome                 TEXT NOT NULL,
  email                TEXT NOT NULL,
  telefone             TEXT NOT NULL,
  cpf                  TEXT NOT NULL,

  -- Endereço
  endereco_cep         TEXT,
  endereco_rua         TEXT,
  endereco_numero      TEXT,
  endereco_complemento TEXT,
  endereco_bairro      TEXT,
  endereco_cidade      TEXT,
  endereco_estado      TEXT,

  -- Integração Asaas (preenchido quando a chave API for configurada)
  asaas_customer_id    TEXT,

  status               TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('ativo', 'inativo', 'pendente')),
  created_at           TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (academia_id, cpf),
  UNIQUE (academia_id, email)
);

-- ─── Planos ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id    UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  nome           TEXT NOT NULL,
  descricao      TEXT,
  valor          NUMERIC(10,2) NOT NULL,
  vencimento_dia INT NOT NULL CHECK (vencimento_dia BETWEEN 1 AND 28),
  ativo          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (academia_id, nome)
);

-- ─── Matrículas (aluno × plano) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aluno_planos (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id           UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  aluno_id              UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  plano_id              UUID NOT NULL REFERENCES planos(id) ON DELETE RESTRICT,
  data_inicio           DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim              DATE,
  status                TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado', 'suspenso')),
  -- Integração Asaas (preenchido quando a chave API for configurada)
  asaas_subscription_id TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Pagamentos ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pagamentos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id       UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  aluno_id          UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  aluno_plano_id    UUID REFERENCES aluno_planos(id) ON DELETE SET NULL,
  valor             NUMERIC(10,2) NOT NULL,
  data_vencimento   DATE NOT NULL,
  data_pagamento    DATE,
  status            TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'vencido', 'cancelado')),
  -- Integração Asaas (preenchido quando a chave API for configurada)
  asaas_payment_id  TEXT,
  link_pagamento    TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Checkins ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkins (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id    UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  aluno_id       UUID NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
  aula_id        UUID NOT NULL REFERENCES aulas_agenda(id) ON DELETE CASCADE,
  registrado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (aluno_id, aula_id)
);

-- ─── Resultados do WOD por checkin ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS checkin_resultados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_id       UUID NOT NULL REFERENCES checkins(id) ON DELETE CASCADE,
  wod_exercicio_id UUID REFERENCES wod_exercicios(id) ON DELETE SET NULL,
  descricao        TEXT,
  repeticoes       INT,
  carga            TEXT,
  tempo_segundos   INT,
  observacao       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE categorias_alunos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE alunos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE planos               ENABLE ROW LEVEL SECURITY;
ALTER TABLE aluno_planos         ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins             ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkin_resultados   ENABLE ROW LEVEL SECURITY;

-- Políticas: acesso apenas à própria academia
CREATE POLICY "academia_categorias_alunos" ON categorias_alunos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_alunos" ON alunos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_planos" ON planos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_aluno_planos" ON aluno_planos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_pagamentos" ON pagamentos
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_checkins" ON checkins
  USING (academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "academia_checkin_resultados" ON checkin_resultados
  USING (checkin_id IN (
    SELECT id FROM checkins
    WHERE academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid())
  ));
