-- =============================================================================
-- UNAFIT — Exercícios e vínculo com WODs
-- Exercício é uma entidade reutilizável por academia.
-- wod_exercicios é a tabela de junção com carga e repetições específicas.
-- =============================================================================

-- =============================================================================
-- TABELA: exercicios
-- =============================================================================

CREATE TABLE exercicios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id  UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,
    descricao    TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT exercicio_nome_academia_unico UNIQUE (academia_id, nome)
);

-- =============================================================================
-- TABELA: wod_exercicios (exercício vinculado a um WOD, com carga e reps)
-- =============================================================================

CREATE TABLE wod_exercicios (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wod_id       UUID NOT NULL REFERENCES wods(id) ON DELETE CASCADE,
    academia_id  UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    exercicio_id UUID NOT NULL REFERENCES exercicios(id) ON DELETE CASCADE,
    ordem        INTEGER NOT NULL DEFAULT 1,
    repeticoes   TEXT,     -- ex: "21-15-9", "10", "MAX", "30 seg"
    carga        TEXT,     -- ex: "43kg / 29kg", "95lbs", "bodyweight"
    observacao   TEXT,
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wod_exercicios_wod ON wod_exercicios(wod_id);
CREATE INDEX idx_exercicios_academia ON exercicios(academia_id);

-- =============================================================================
-- RLS: exercicios
-- =============================================================================

ALTER TABLE exercicios ENABLE ROW LEVEL SECURITY;

-- Todos da academia podem ver
CREATE POLICY "exercicios_select" ON exercicios FOR SELECT
    USING (academia_id = minha_academia_id() OR meu_role() = 'saas_admin');

-- Dono e professor podem criar
CREATE POLICY "exercicios_insert" ON exercicios FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

-- Dono e professor podem editar
CREATE POLICY "exercicios_update" ON exercicios FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

-- Apenas dono pode excluir
CREATE POLICY "exercicios_delete" ON exercicios FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'saas_admin')
    );

-- =============================================================================
-- RLS: wod_exercicios
-- =============================================================================

ALTER TABLE wod_exercicios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wod_exercicios_select" ON wod_exercicios FOR SELECT
    USING (academia_id = minha_academia_id() OR meu_role() = 'saas_admin');

CREATE POLICY "wod_exercicios_insert" ON wod_exercicios FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

CREATE POLICY "wod_exercicios_update" ON wod_exercicios FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );

CREATE POLICY "wod_exercicios_delete" ON wod_exercicios FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('dono', 'professor', 'saas_admin')
    );
