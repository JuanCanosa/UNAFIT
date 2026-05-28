-- =============================================================================
-- UNAFIT — Módulo de Performance: PRs e Rankings
-- =============================================================================

-- Tipo de resultado de um exercício
CREATE TYPE tipo_resultado AS ENUM ('peso', 'tempo', 'reps', 'rounds_reps');

-- Adiciona tipo_resultado à tabela exercicios
ALTER TABLE exercicios ADD COLUMN IF NOT EXISTS tipo_resultado tipo_resultado NOT NULL DEFAULT 'reps';

-- =============================================================================
-- TABELA: prs (Personal Records)
-- =============================================================================

CREATE TABLE prs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id     UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    aluno_id        UUID NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
    exercicio_id    UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,

    -- tipo denormalizado do exercício (evita joins em queries de ranking)
    tipo            tipo_resultado NOT NULL,

    -- valores por tipo (apenas um é preenchido por registro)
    valor_peso      NUMERIC(7,2),       -- kg  (peso)
    valor_tempo_seg INTEGER,            -- segundos totais (tempo)
    valor_reps      INTEGER,            -- repetições (reps)
    valor_rounds    INTEGER,            -- rounds completos (rounds_reps)
    valor_reps_extra INTEGER,           -- reps do round incompleto (rounds_reps)

    rx              BOOLEAN NOT NULL DEFAULT true,  -- TRUE = RX, FALSE = Scaled
    data_registro   DATE NOT NULL DEFAULT CURRENT_DATE,
    aula_id         UUID REFERENCES aulas_agenda(id) ON DELETE SET NULL,
    registrado_por  UUID REFERENCES profiles(id) ON DELETE SET NULL,
    observacao      TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_prs_academia     ON prs(academia_id);
CREATE INDEX idx_prs_aluno        ON prs(aluno_id);
CREATE INDEX idx_prs_exercicio    ON prs(exercicio_id);
CREATE INDEX idx_prs_aluno_ex     ON prs(aluno_id, exercicio_id);

-- =============================================================================
-- RLS: prs
-- =============================================================================

ALTER TABLE prs ENABLE ROW LEVEL SECURITY;

-- Todos da academia veem (para rankings)
CREATE POLICY "prs_select" ON prs FOR SELECT
    USING (academia_id = minha_academia_id() OR meu_role() = 'saas_admin');

-- Aluno insere seus próprios; dono/colaborador inserem de qualquer aluno da academia
CREATE POLICY "prs_insert" ON prs FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND (
            (meu_role() = 'aluno'      AND aluno_id = auth.uid())
            OR meu_role() IN ('dono', 'colaborador', 'saas_admin')
        )
    );

-- Aluno edita/remove seus próprios; dono/colaborador editam/removem qualquer um
CREATE POLICY "prs_update" ON prs FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND (
            (meu_role() = 'aluno'      AND aluno_id = auth.uid())
            OR meu_role() IN ('dono', 'colaborador', 'saas_admin')
        )
    );

CREATE POLICY "prs_delete" ON prs FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND (
            (meu_role() = 'aluno'      AND aluno_id = auth.uid())
            OR meu_role() IN ('dono', 'colaborador', 'saas_admin')
        )
    );
