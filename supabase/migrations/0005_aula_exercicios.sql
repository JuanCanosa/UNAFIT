-- =============================================================================
-- UNAFIT — Exercícios por seção de aula
-- Cada aula tem 3 seções: mobilidade, skills, wod.
-- Cada seção tem N exercícios com carga e repetições.
-- Remove mobilidade do WOD (cada professor tem a sua).
-- =============================================================================

-- Remove o campo mobilidade da tabela wods (era redundante)
ALTER TABLE wods DROP COLUMN IF EXISTS mobilidade;

-- =============================================================================
-- TABELA: aula_exercicios
-- Exercícios vinculados a uma aula específica, organizados por seção.
-- =============================================================================

CREATE TYPE secao_aula AS ENUM ('mobilidade', 'skills', 'wod');

CREATE TABLE aula_exercicios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aula_id      UUID NOT NULL REFERENCES aulas_agenda(id) ON DELETE CASCADE,
    academia_id  UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    secao        secao_aula NOT NULL DEFAULT 'wod',
    exercicio_id UUID REFERENCES exercicios(id) ON DELETE SET NULL,
    nome_livre   TEXT,    -- nome quando exercício ainda não existe no banco
    ordem        INTEGER NOT NULL DEFAULT 1,
    repeticoes   TEXT,    -- ex: "21-15-9", "10", "3x5", "MAX"
    carga        TEXT,    -- ex: "43kg / 29kg", "70% 1RM", "bodyweight"
    observacao   TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Precisa de nome: ou via exercicio_id ou via nome_livre
    CONSTRAINT deve_ter_nome CHECK (exercicio_id IS NOT NULL OR nome_livre IS NOT NULL)
);

CREATE INDEX idx_aula_exercicios_aula   ON aula_exercicios(aula_id);
CREATE INDEX idx_aula_exercicios_secao  ON aula_exercicios(aula_id, secao);

-- =============================================================================
-- RLS: aula_exercicios
-- =============================================================================

ALTER TABLE aula_exercicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aula_exercicios_select" ON aula_exercicios FOR SELECT
    USING (academia_id = minha_academia_id() OR meu_role() = 'saas_admin');

CREATE POLICY "aula_exercicios_insert" ON aula_exercicios FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

CREATE POLICY "aula_exercicios_update" ON aula_exercicios FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

CREATE POLICY "aula_exercicios_delete" ON aula_exercicios FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );
