-- Tabela de vínculo aluno ↔ academia (preparação para multiacademia)
-- Um aluno (identificado pelo profile_id) poderá estar em múltiplas academias.
-- Atualmente profiles.academia_id já serve como vínculo primário.
-- Esta tabela é a fundação para quando o aluno estiver em mais de uma academia.

CREATE TABLE IF NOT EXISTS aluno_academias (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   uuid NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  academia_id  uuid NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  aluno_id     uuid REFERENCES alunos(id) ON DELETE SET NULL,
  ativo        boolean NOT NULL DEFAULT true,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, academia_id)
);

-- Índices para consultas por academia e por aluno
CREATE INDEX IF NOT EXISTS idx_aluno_academias_academia ON aluno_academias(academia_id);
CREATE INDEX IF NOT EXISTS idx_aluno_academias_profile  ON aluno_academias(profile_id);

-- RLS
ALTER TABLE aluno_academias ENABLE ROW LEVEL SECURITY;

-- Dono/colaborador vê os vínculos da sua academia
CREATE POLICY "aluno_academias_select_staff"
  ON aluno_academias FOR SELECT
  TO authenticated
  USING (
    academia_id = (SELECT academia_id FROM profiles WHERE id = auth.uid())
  );

-- Aluno vê seus próprios vínculos
CREATE POLICY "aluno_academias_select_self"
  ON aluno_academias FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

-- Só dono/saas_admin insere/atualiza
CREATE POLICY "aluno_academias_insert_dono"
  ON aluno_academias FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('dono', 'saas_admin')
        AND academia_id = aluno_academias.academia_id
    )
  );

CREATE POLICY "aluno_academias_update_dono"
  ON aluno_academias FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('dono', 'saas_admin')
        AND academia_id = aluno_academias.academia_id
    )
  );
