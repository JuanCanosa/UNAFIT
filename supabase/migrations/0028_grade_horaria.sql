-- Grade horária padrão da academia (template para geração de semanas)
CREATE TABLE grade_horaria (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id   UUID        NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  dia_semana    SMALLINT    NOT NULL CHECK (dia_semana BETWEEN 1 AND 7),
  -- 1=Segunda  2=Terça  3=Quarta  4=Quinta  5=Sexta  6=Sábado  7=Domingo
  modalidade    TEXT        NOT NULL,
  horario_inicio TIME       NOT NULL,
  horario_fim    TIME       NOT NULL,
  capacidade_max INTEGER,
  ordem          SMALLINT   DEFAULT 0,
  criado_em      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE grade_horaria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_horaria_read" ON grade_horaria
  FOR SELECT USING (academia_id = minha_academia_id());

CREATE POLICY "grade_horaria_write" ON grade_horaria
  FOR ALL USING (
    academia_id = minha_academia_id()
    AND meu_role() IN ('dono', 'colaborador', 'saas_admin')
  );
