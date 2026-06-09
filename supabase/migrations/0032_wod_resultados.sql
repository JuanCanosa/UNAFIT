-- =============================================================================
-- UNAFIT — WOD Resultados: drop sessões individuais, adicionar avaliação por WOD
-- =============================================================================

-- Drop tabelas de sessões individuais (não utilizadas)
DROP TABLE IF EXISTS coach_sessao_exercicios CASCADE;
DROP TABLE IF EXISTS coach_sessoes CASCADE;
DROP TYPE  IF EXISTS coach_sessao_status CASCADE;

-- Habilita alunos avaliarem o WOD do dia
ALTER TABLE wods ADD COLUMN IF NOT EXISTS aberto_para_avaliacao BOOLEAN NOT NULL DEFAULT false;

-- Resultado do aluno em um WOD
CREATE TABLE wod_resultados (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id      UUID    NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  wod_id           UUID    NOT NULL REFERENCES wods(id)      ON DELETE CASCADE,
  aluno_id         UUID    NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  categoria        TEXT    NOT NULL CHECK (categoria IN ('rx','intermediario','scaled','iniciante')),
  deu_cap          BOOLEAN NOT NULL DEFAULT false,
  tempo_segundos   INTEGER CHECK (tempo_segundos > 0),
  repeticoes       INTEGER CHECK (repeticoes >= 0),
  carga_kg         NUMERIC(8,2) CHECK (carga_kg > 0),
  pse              SMALLINT CHECK (pse BETWEEN 1 AND 10),
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (wod_id, aluno_id)
);

CREATE INDEX idx_wod_resultados_wod      ON wod_resultados(wod_id);
CREATE INDEX idx_wod_resultados_academia ON wod_resultados(academia_id);
CREATE INDEX idx_wod_resultados_aluno    ON wod_resultados(aluno_id);

ALTER TABLE wod_resultados ENABLE ROW LEVEL SECURITY;

-- Todos da academia podem ver o leaderboard
CREATE POLICY "wod_resultados_select" ON wod_resultados FOR SELECT
  USING (academia_id = minha_academia_id());

-- Aluno insere/atualiza o próprio resultado
CREATE POLICY "wod_resultados_insert" ON wod_resultados FOR INSERT
  WITH CHECK (academia_id = minha_academia_id() AND aluno_id = auth.uid());

CREATE POLICY "wod_resultados_update" ON wod_resultados FOR UPDATE
  USING (academia_id = minha_academia_id() AND (aluno_id = auth.uid() OR meu_role() IN ('dono','colaborador','saas_admin')));

-- Staff pode deletar
CREATE POLICY "wod_resultados_delete" ON wod_resultados FOR DELETE
  USING (academia_id = minha_academia_id() AND meu_role() IN ('dono','colaborador','saas_admin'));
