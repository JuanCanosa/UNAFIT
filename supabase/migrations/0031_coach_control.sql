-- =============================================================================
-- UNAFIT — Coach Control: treinos individuais e feedback de WOD
-- =============================================================================

CREATE TYPE coach_sessao_status AS ENUM ('pendente', 'concluida', 'cancelada');

-- Sessões individuais atribuídas pelo coach a um aluno
CREATE TABLE coach_sessoes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id   UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  aluno_id      UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  coach_id      UUID NOT NULL REFERENCES profiles(id),
  titulo        TEXT NOT NULL,
  tags          TEXT[] NOT NULL DEFAULT '{}',
  data_agendada DATE NOT NULL,
  status        coach_sessao_status NOT NULL DEFAULT 'pendente',
  pse           SMALLINT CHECK (pse BETWEEN 1 AND 10),
  tempo_segundos INTEGER CHECK (tempo_segundos > 0),
  comentario    TEXT,
  concluida_em  TIMESTAMPTZ,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_coach_sessoes_academia ON coach_sessoes(academia_id);
CREATE INDEX idx_coach_sessoes_aluno    ON coach_sessoes(aluno_id);
CREATE INDEX idx_coach_sessoes_data     ON coach_sessoes(data_agendada);

-- Exercícios de cada sessão
CREATE TABLE coach_sessao_exercicios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sessao_id   UUID NOT NULL REFERENCES coach_sessoes(id) ON DELETE CASCADE,
  academia_id UUID NOT NULL REFERENCES academias(id)    ON DELETE CASCADE,
  ordem       INTEGER NOT NULL DEFAULT 1,
  nome        TEXT NOT NULL,
  exercicio_id UUID REFERENCES exercicios(id) ON DELETE SET NULL,
  serie_reps  TEXT,
  carga       TEXT,
  observacao  TEXT
);

CREATE INDEX idx_coach_sessao_exs_sessao ON coach_sessao_exercicios(sessao_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE coach_sessoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_sessao_exercicios ENABLE ROW LEVEL SECURITY;

-- Coach/dono vê todas da academia; aluno vê só as suas
CREATE POLICY "coach_sessoes_select" ON coach_sessoes FOR SELECT
  USING (
    academia_id = minha_academia_id()
    AND (meu_role() IN ('dono', 'colaborador', 'saas_admin') OR aluno_id = auth.uid())
  );

CREATE POLICY "coach_sessoes_insert" ON coach_sessoes FOR INSERT
  WITH CHECK (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'colaborador', 'saas_admin'));

-- Coach edita tudo; aluno só pode preencher PSE/tempo/comentario/status na própria sessão
CREATE POLICY "coach_sessoes_update" ON coach_sessoes FOR UPDATE
  USING (
    academia_id = minha_academia_id()
    AND (meu_role() IN ('dono', 'colaborador', 'saas_admin') OR aluno_id = auth.uid())
  );

CREATE POLICY "coach_sessoes_delete" ON coach_sessoes FOR DELETE
  USING (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'colaborador', 'saas_admin'));

CREATE POLICY "coach_sessao_exs_select" ON coach_sessao_exercicios FOR SELECT
  USING (academia_id = minha_academia_id() AND (
    meu_role() IN ('dono', 'colaborador', 'saas_admin')
    OR EXISTS (SELECT 1 FROM coach_sessoes s WHERE s.id = sessao_id AND s.aluno_id = auth.uid())
  ));

CREATE POLICY "coach_sessao_exs_insert" ON coach_sessao_exercicios FOR INSERT
  WITH CHECK (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'colaborador', 'saas_admin'));

CREATE POLICY "coach_sessao_exs_update" ON coach_sessao_exercicios FOR UPDATE
  USING (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'colaborador', 'saas_admin'));

CREATE POLICY "coach_sessao_exs_delete" ON coach_sessao_exercicios FOR DELETE
  USING (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'colaborador', 'saas_admin'));
