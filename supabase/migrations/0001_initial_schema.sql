-- =============================================================================
-- UNAFIT - SCHEMA INICIAL
-- Migration: 0001_initial_schema.sql
-- Última revisão: alinhado com docs/RULES.md v1.0
-- =============================================================================

-- gen_random_uuid() é nativo no PostgreSQL 13+ (Supabase usa pg15+)
-- uuid-ossp não é necessário

-- =============================================================================
-- TIPOS ENUM
-- =============================================================================

CREATE TYPE user_role    AS ENUM ('saas_admin', 'dono', 'professor', 'aluno');
CREATE TYPE fatura_status AS ENUM ('pendente', 'paga', 'vencida', 'cancelada');
CREATE TYPE score_type   AS ENUM ('tempo', 'reps', 'carga', 'rounds_reps', 'pass_fail');

-- =============================================================================
-- TABELA: academias (global - sem academia_id)
-- =============================================================================

CREATE TABLE academias (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,           -- ex: "crossfit-norte"
    asaas_api_key   TEXT,                           -- chave Asaas da academia (criptografar em prod)
    ativo           BOOLEAN NOT NULL DEFAULT true,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABELA: profiles (usuários ligados ao auth.users do Supabase)
-- =============================================================================

CREATE TABLE profiles (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    academia_id      UUID REFERENCES academias(id) ON DELETE CASCADE,
    -- saas_admin terá academia_id = NULL
    role             user_role NOT NULL DEFAULT 'aluno',
    nome_completo    TEXT NOT NULL,
    telefone         TEXT,
    asaas_cliente_id TEXT,                          -- ID do cliente no Asaas
    ativo            BOOLEAN NOT NULL DEFAULT true,
    criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABELA: wods (conteúdo do treino — separado do evento/aula)
-- RULES.md §3: WOD = conteúdo; Aula = evento. Um WOD pode ter várias aulas.
-- =============================================================================

CREATE TABLE wods (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id  UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    nome         TEXT NOT NULL,                     -- ex: "Fran", "Murph"
    homenagem    TEXT,                              -- história/origem do WOD (opcional)
    mobilidade   TEXT,                              -- prescrição de mobilidade
    aquecimento  TEXT,                              -- prescrição de aquecimento
    treino       TEXT NOT NULL,                     -- prescrição principal
    score_type   score_type NOT NULL DEFAULT 'tempo',
    criado_por   UUID REFERENCES profiles(id),
    criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABELA: aulas_agenda (evento = Data + Horário Início + Horário Fim + WOD)
-- RULES.md §3: A Aula é o evento; o WOD é o conteúdo vinculado a ela.
-- =============================================================================

CREATE TABLE aulas_agenda (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id     UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    wod_id          UUID REFERENCES wods(id) ON DELETE SET NULL,
    data_aula       DATE NOT NULL,
    horario_inicio  TIME NOT NULL,
    horario_fim     TIME NOT NULL,
    capacidade_max  INTEGER,                        -- NULL = sem limite de vagas
    criado_por      UUID REFERENCES profiles(id),
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT horario_valido CHECK (horario_fim > horario_inicio)
);

-- =============================================================================
-- TABELA: checkins (presença do aluno numa aula específica)
-- RULES.md §4: Janela de tempo e trava financeira são validadas via trigger abaixo.
-- =============================================================================

CREATE TABLE checkins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    aula_id     UUID NOT NULL REFERENCES aulas_agenda(id) ON DELETE CASCADE,
    aluno_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    feito_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Garante que cada aluno faz apenas 1 check-in por aula
    CONSTRAINT checkin_unico UNIQUE (aula_id, aluno_id)
);

-- =============================================================================
-- TABELA: resultados_performance
-- RULES.md §5: "O resultado é amarrado à Aula (Data/Hora específica)."
-- Vinculado a aula_id → que carrega data_aula + horario_inicio + horario_fim.
-- O WOD é acessível via aula_id → aulas_agenda.wod_id → wods.
-- =============================================================================

CREATE TABLE resultados_performance (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id UUID NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
    -- Vínculo à AULA (data/hora específica), não ao WOD diretamente
    aula_id     UUID NOT NULL REFERENCES aulas_agenda(id) ON DELETE CASCADE,
    aluno_id    UUID NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,

    -- ── Campos de score (preenchidos conforme score_type do WOD) ────────────
    tempo       INTERVAL,               -- score_type = 'tempo'      ex: '12:34' (mm:ss)
    repeticoes  INTEGER,                -- score_type = 'reps'       ex: 150
    carga_kg    NUMERIC(6,2),           -- score_type = 'carga'      ex: 102.50
    rounds      INTEGER,                -- score_type = 'rounds_reps' ex: 5 rounds
    reps_extra  INTEGER,                -- score_type = 'rounds_reps' reps do round incompleto
    passou      BOOLEAN,                -- score_type = 'pass_fail'

    -- ── Metadados do resultado ───────────────────────────────────────────────
    rx_scaled   BOOLEAN NOT NULL DEFAULT true,   -- TRUE = RX | FALSE = Scaled
    observacao  TEXT,                            -- notas livres (ex: "joelho inflamado")
    registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Garante 1 resultado por aluno por aula
    CONSTRAINT resultado_unico UNIQUE (aula_id, aluno_id)
);

-- =============================================================================
-- TABELA: faturas (financeiro — integrado ao Asaas)
-- RULES.md §2: Professor BLOQUEADO. Aluno vê apenas as próprias. Dono vê todas.
-- RULES.md §4: Trava financeira: bloqueia check-in se status IN ('pendente','vencida').
-- =============================================================================

CREATE TABLE faturas (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    academia_id        UUID NOT NULL REFERENCES academias(id)  ON DELETE CASCADE,
    aluno_id           UUID NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
    asaas_pagamento_id TEXT,                           -- ID do charge no Asaas
    asaas_link_boleto  TEXT,                           -- URL boleto/PIX gerada pelo Asaas
    valor              NUMERIC(10,2) NOT NULL,
    status             fatura_status NOT NULL DEFAULT 'pendente',
    vencimento         DATE NOT NULL,
    pago_em            TIMESTAMPTZ,
    mes_referencia     DATE NOT NULL,                  -- sempre dia 1 do mês (ex: 2026-04-01)
    descricao          TEXT,                           -- ex: "Mensalidade Abril/2026"
    criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES DE PERFORMANCE
-- =============================================================================

CREATE INDEX idx_profiles_academia        ON profiles(academia_id);
CREATE INDEX idx_wods_academia            ON wods(academia_id);
CREATE INDEX idx_aulas_academia_data      ON aulas_agenda(academia_id, data_aula);
CREATE INDEX idx_checkins_aula            ON checkins(aula_id);
CREATE INDEX idx_checkins_aluno           ON checkins(aluno_id);
CREATE INDEX idx_checkins_academia        ON checkins(academia_id);
CREATE INDEX idx_resultados_aula          ON resultados_performance(aula_id);
CREATE INDEX idx_resultados_aluno         ON resultados_performance(aluno_id);
-- Índice composto para lookup rápido de faturas bloqueantes (usado no trigger)
CREATE INDEX idx_faturas_aluno_status     ON faturas(aluno_id, academia_id, status);
CREATE INDEX idx_faturas_mes_ref          ON faturas(aluno_id, academia_id, mes_referencia, status);

-- =============================================================================
-- TRIGGER: trava financeira no check-in
-- RULES.md §4: "Bloquear check-in se houver faturas PENDENTES ou VENCIDAS."
-- Executado no banco — garante a regra mesmo se a camada app for bypassada.
-- =============================================================================

CREATE OR REPLACE FUNCTION fn_validar_checkin_financeiro()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_faturas_bloqueantes INTEGER;
    v_fatura_mes_atual    INTEGER;
    v_mes_atual           DATE := DATE_TRUNC('month', NOW())::DATE;
BEGIN
    -- ── 1. Bloqueia se houver faturas PENDENTES ou VENCIDAS ─────────────────
    --    (RULES.md §4 — trava financeira)
    SELECT COUNT(*) INTO v_faturas_bloqueantes
    FROM faturas
    WHERE aluno_id    = NEW.aluno_id
      AND academia_id = NEW.academia_id
      AND status      IN ('pendente', 'vencida');

    IF v_faturas_bloqueantes > 0 THEN
        RAISE EXCEPTION 'CHECKIN_BLOQUEADO_FATURA_PENDENTE'
            USING HINT = 'Existem mensalidades em aberto. Regularize para fazer check-in.';
    END IF;

    -- ── 2. Bloqueia se não houver fatura PAGA no mês vigente ────────────────
    --    (garante que o aluno pagou o mês atual antes de treinar)
    SELECT COUNT(*) INTO v_fatura_mes_atual
    FROM faturas
    WHERE aluno_id      = NEW.aluno_id
      AND academia_id   = NEW.academia_id
      AND status        = 'paga'
      AND mes_referencia = v_mes_atual;

    IF v_fatura_mes_atual = 0 THEN
        RAISE EXCEPTION 'CHECKIN_BLOQUEADO_SEM_PAGAMENTO_MES'
            USING HINT = 'Mensalidade do mês vigente não encontrada. Realize o pagamento para treinar.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_checkin_financeiro
    BEFORE INSERT ON checkins
    FOR EACH ROW EXECUTE FUNCTION fn_validar_checkin_financeiro();

-- =============================================================================
-- TRIGGER: atualiza coluna atualizado_em automaticamente
-- =============================================================================

CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_timestamp_academias
    BEFORE UPDATE ON academias
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_profiles
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_wods
    BEFORE UPDATE ON wods
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_aulas
    BEFORE UPDATE ON aulas_agenda
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

CREATE TRIGGER set_timestamp_faturas
    BEFORE UPDATE ON faturas
    FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE academias              ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE wods                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE aulas_agenda           ENABLE ROW LEVEL SECURITY;
ALTER TABLE checkins               ENABLE ROW LEVEL SECURITY;
ALTER TABLE resultados_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE faturas                ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- FUNÇÕES AUXILIARES RLS
-- =============================================================================

CREATE OR REPLACE FUNCTION minha_academia_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
    SELECT academia_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION meu_role()
RETURNS user_role LANGUAGE sql STABLE AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- =============================================================================
-- RLS: academias
-- =============================================================================

CREATE POLICY "academias_select" ON academias FOR SELECT
    USING (meu_role() = 'saas_admin' OR id = minha_academia_id());

CREATE POLICY "academias_insert" ON academias FOR INSERT
    WITH CHECK (meu_role() = 'saas_admin');

CREATE POLICY "academias_update" ON academias FOR UPDATE
    USING (meu_role() = 'saas_admin');

CREATE POLICY "academias_delete" ON academias FOR DELETE
    USING (meu_role() = 'saas_admin');

-- =============================================================================
-- RLS: profiles
-- =============================================================================

CREATE POLICY "profiles_select" ON profiles FOR SELECT
    USING (
        meu_role() = 'saas_admin'
        OR academia_id = minha_academia_id()
        OR id = auth.uid()
    );

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
    WITH CHECK (
        meu_role() = 'saas_admin'
        OR (meu_role() = 'dono' AND academia_id = minha_academia_id())
    );

CREATE POLICY "profiles_update" ON profiles FOR UPDATE
    USING (
        meu_role() = 'saas_admin'
        OR (meu_role() = 'dono' AND academia_id = minha_academia_id())
        OR id = auth.uid()
    );

-- =============================================================================
-- RLS: wods (professor pode criar/editar)
-- =============================================================================

CREATE POLICY "wods_select" ON wods FOR SELECT
    USING (meu_role() = 'saas_admin' OR academia_id = minha_academia_id());

CREATE POLICY "wods_insert" ON wods FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

CREATE POLICY "wods_update" ON wods FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

CREATE POLICY "wods_delete" ON wods FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

-- =============================================================================
-- RLS: aulas_agenda (professor pode criar/editar)
-- =============================================================================

CREATE POLICY "aulas_select" ON aulas_agenda FOR SELECT
    USING (meu_role() = 'saas_admin' OR academia_id = minha_academia_id());

CREATE POLICY "aulas_insert" ON aulas_agenda FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

CREATE POLICY "aulas_update" ON aulas_agenda FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

CREATE POLICY "aulas_delete" ON aulas_agenda FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

-- =============================================================================
-- RLS: checkins
-- =============================================================================

CREATE POLICY "checkins_select" ON checkins FOR SELECT
    USING (meu_role() = 'saas_admin' OR academia_id = minha_academia_id());

-- Aluno faz check-in em si mesmo; staff (dono/professor) pode registrar manualmente
CREATE POLICY "checkins_insert" ON checkins FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND (
            aluno_id = auth.uid()
            OR meu_role() IN ('saas_admin', 'dono', 'professor')
        )
    );

CREATE POLICY "checkins_delete" ON checkins FOR DELETE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono', 'professor')
    );

-- =============================================================================
-- RLS: resultados_performance
-- =============================================================================

CREATE POLICY "resultados_select" ON resultados_performance FOR SELECT
    USING (meu_role() = 'saas_admin' OR academia_id = minha_academia_id());

CREATE POLICY "resultados_insert" ON resultados_performance FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND (
            aluno_id = auth.uid()
            OR meu_role() IN ('saas_admin', 'dono', 'professor')
        )
    );

CREATE POLICY "resultados_update" ON resultados_performance FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND (
            aluno_id = auth.uid()
            OR meu_role() IN ('saas_admin', 'dono', 'professor')
        )
    );

-- =============================================================================
-- RLS: faturas
-- RULES.md §2: "Professor BLOQUEADO no financeiro."
-- Estratégia: políticas permissivas listam APENAS saas_admin, dono e o próprio
-- aluno. O role 'professor' não consta em NENHUMA política → acesso negado em
-- todas as operações (SELECT, INSERT, UPDATE, DELETE).
-- =============================================================================

-- SELECT: saas_admin vê tudo | dono vê da sua academia | aluno vê apenas as suas
CREATE POLICY "faturas_select" ON faturas FOR SELECT
    USING (
        meu_role() = 'saas_admin'
        OR (meu_role() = 'dono'  AND academia_id = minha_academia_id())
        OR (meu_role() = 'aluno' AND aluno_id = auth.uid())
        -- professor: ausente → NEGADO
    );

-- INSERT: sistema cria via webhook do Asaas (service_role) ou dono manualmente
CREATE POLICY "faturas_insert" ON faturas FOR INSERT
    WITH CHECK (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono')
        -- professor: ausente → NEGADO
    );

-- UPDATE: apenas reconciliação manual por dono ou saas_admin
CREATE POLICY "faturas_update" ON faturas FOR UPDATE
    USING (
        academia_id = minha_academia_id()
        AND meu_role() IN ('saas_admin', 'dono')
        -- professor: ausente → NEGADO
    );

-- DELETE: apenas saas_admin pode excluir faturas
CREATE POLICY "faturas_delete" ON faturas FOR DELETE
    USING (
        meu_role() = 'saas_admin'
        -- professor e dono: NEGADOS
    );

-- =============================================================================
-- VIEW: ranking_geral
-- Agrega resultados por WOD, com data/hora da aula para histórico cronológico.
-- Filtrável por: wod_id, academia_id, data_aula (range), rx_scaled.
-- Respeita RLS das tabelas subjacentes (SECURITY INVOKER por padrão).
-- =============================================================================

CREATE OR REPLACE VIEW ranking_geral
    WITH (security_invoker = true)   -- herda RLS do usuário chamador
AS
SELECT
    -- Identificadores
    r.id                AS resultado_id,
    r.academia_id,
    r.aluno_id,
    p.nome_completo     AS aluno_nome,

    -- WOD (conteúdo)
    w.id                AS wod_id,
    w.nome              AS wod_nome,
    w.score_type,

    -- Aula (evento com data/hora)
    a.id                AS aula_id,
    a.data_aula,
    a.horario_inicio,
    a.horario_fim,

    -- Score
    r.tempo,
    r.repeticoes,
    r.carga_kg,
    r.rounds,
    r.reps_extra,
    r.passou,
    r.rx_scaled,
    r.observacao,
    r.registrado_em

FROM resultados_performance r
JOIN aulas_agenda a ON a.id = r.aula_id
JOIN wods         w ON w.id = a.wod_id
JOIN profiles     p ON p.id = r.aluno_id

-- Exclui aulas sem WOD vinculado (não há nada para rankear)
WHERE a.wod_id IS NOT NULL;

-- Exemplos de consulta à view:
--   Por WOD:        WHERE wod_id = '<uuid>' ORDER BY tempo ASC
--   Por academia:   WHERE academia_id = '<uuid>'
--   Por período:    WHERE data_aula BETWEEN '2026-04-01' AND '2026-04-30'
--   Só RX:          WHERE rx_scaled = true
