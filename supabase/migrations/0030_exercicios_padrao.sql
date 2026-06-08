-- =============================================================================
-- UNAFIT — Exercícios padrão CrossFit para ranking de PRs
--
-- 1. Adiciona `categoria` e `is_padrao` à tabela exercicios
-- 2. Cria função criar_exercicios_padrao(academia_id) para semear
--    os 56 exercícios padrão em qualquer academia
-- 3. Executa para todas as academias existentes
-- =============================================================================

-- Categorias disponíveis
ALTER TABLE exercicios
  ADD COLUMN IF NOT EXISTS categoria TEXT
    CHECK (categoria IN ('ginastico', 'ginastico_unbroken', 'condicionamento', 'peso', 'heroes_girls')),
  ADD COLUMN IF NOT EXISTS is_padrao BOOLEAN NOT NULL DEFAULT false;

-- =============================================================================
-- Função de semeadura — segura para re-executar (ON CONFLICT só atualiza
-- categoria/is_padrao, nunca altera tipo_resultado de exercício já existente)
-- =============================================================================
CREATE OR REPLACE FUNCTION criar_exercicios_padrao(p_academia_id UUID)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO exercicios (academia_id, nome, tipo_resultado, categoria, is_padrao) VALUES

    -- ── GINÁSTICO — 1 Rep Máx ──────────────────────────────────────────────
    (p_academia_id, 'Air Squat',         'reps', 'ginastico', true),
    (p_academia_id, 'Push Up',           'reps', 'ginastico', true),
    (p_academia_id, 'Pull Up',           'reps', 'ginastico', true),
    (p_academia_id, 'Toes to Bar',       'reps', 'ginastico', true),
    (p_academia_id, 'HSPU',              'reps', 'ginastico', true),
    (p_academia_id, 'Sit Up',            'reps', 'ginastico', true),
    (p_academia_id, 'Pistol',            'reps', 'ginastico', true),
    (p_academia_id, 'Bar Muscle Up',     'reps', 'ginastico', true),
    (p_academia_id, 'Double Under',      'reps', 'ginastico', true),
    (p_academia_id, 'Single Under',      'reps', 'ginastico', true),
    (p_academia_id, 'Box Jump',          'reps', 'ginastico', true),
    (p_academia_id, 'Box Jump Over',     'reps', 'ginastico', true),

    -- ── GINÁSTICO — Unbroken ───────────────────────────────────────────────
    (p_academia_id, 'Air Squat (Unbroken)',     'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Push Up (Unbroken)',       'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Pull Up (Unbroken)',       'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Toes to Bar (Unbroken)',   'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'HSPU (Unbroken)',          'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Sit Up (Unbroken)',        'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Pistol (Unbroken)',        'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Bar Muscle Up (Unbroken)', 'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Double Under (Unbroken)',  'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Single Under (Unbroken)',  'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Box Jump (Unbroken)',      'reps', 'ginastico_unbroken', true),
    (p_academia_id, 'Box Jump Over (Unbroken)', 'reps', 'ginastico_unbroken', true),

    -- ── CONDICIONAMENTO — Máx Reps em Tempo ───────────────────────────────
    (p_academia_id, 'Burpee 5 Min',  'reps', 'condicionamento', true),
    (p_academia_id, 'Burpee 3 Min',  'reps', 'condicionamento', true),
    (p_academia_id, 'Burpee 1 Min',  'reps', 'condicionamento', true),

    -- ── CONDICIONAMENTO — Para Tempo ──────────────────────────────────────
    (p_academia_id, 'Corrida 1km',   'tempo', 'condicionamento', true),
    (p_academia_id, 'Corrida 5km',   'tempo', 'condicionamento', true),
    (p_academia_id, 'Corrida 10km',  'tempo', 'condicionamento', true),
    (p_academia_id, '50 Double Under', 'tempo', 'condicionamento', true),
    (p_academia_id, '50 Burpee',     'tempo', 'condicionamento', true),

    -- ── PESO ──────────────────────────────────────────────────────────────
    (p_academia_id, 'Muscle Clean',       'peso', 'peso', true),
    (p_academia_id, 'Power Clean',        'peso', 'peso', true),
    (p_academia_id, 'Hang Power Clean',   'peso', 'peso', true),
    (p_academia_id, 'Squat Clean',        'peso', 'peso', true),
    (p_academia_id, 'Hang Squat Clean',   'peso', 'peso', true),
    (p_academia_id, 'Shoulder Press',     'peso', 'peso', true),
    (p_academia_id, 'Push Press',         'peso', 'peso', true),
    (p_academia_id, 'Push Jerk',          'peso', 'peso', true),
    (p_academia_id, 'Clean and Jerk',     'peso', 'peso', true),
    (p_academia_id, 'Thruster',           'peso', 'peso', true),
    (p_academia_id, 'Muscle Snatch',      'peso', 'peso', true),
    (p_academia_id, 'Power Snatch',       'peso', 'peso', true),
    (p_academia_id, 'Hang Power Snatch',  'peso', 'peso', true),
    (p_academia_id, 'Squat Snatch',       'peso', 'peso', true),
    (p_academia_id, 'Hang Squat Snatch',  'peso', 'peso', true),
    (p_academia_id, 'OHS',               'peso', 'peso', true),
    (p_academia_id, 'Deadlift',          'peso', 'peso', true),
    (p_academia_id, 'Back Squat',        'peso', 'peso', true),
    (p_academia_id, 'Front Squat',       'peso', 'peso', true),

    -- ── HEROES / GIRLS ────────────────────────────────────────────────────
    (p_academia_id, 'Isabel',  'tempo', 'heroes_girls', true),
    (p_academia_id, 'Grace',   'tempo', 'heroes_girls', true),
    (p_academia_id, 'Karen',   'tempo', 'heroes_girls', true),
    (p_academia_id, 'Annie',   'tempo', 'heroes_girls', true),
    (p_academia_id, 'Fran',    'tempo', 'heroes_girls', true)

  ON CONFLICT (academia_id, nome) DO UPDATE
    SET categoria  = EXCLUDED.categoria,
        is_padrao  = true;
END;
$$;

-- =============================================================================
-- Semeia para todas as academias existentes
-- =============================================================================
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM academias LOOP
    PERFORM criar_exercicios_padrao(r.id);
  END LOOP;
END $$;
