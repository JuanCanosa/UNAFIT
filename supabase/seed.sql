-- =============================================================================
-- UNAFIT — SEED DE DESENVOLVIMENTO
-- Dados fictícios para testar o sistema localmente.
-- Execute APÓS aplicar 0001_initial_schema.sql.
--
-- Cenário de teste:
--   Academia:  CrossFit Exemplo
--   Usuários:  1 dono, 1 professor, 2 alunos (RX e Scaled)
--   WOD:       "Fran" vinculado a 2 aulas no mesmo dia (19h e 20h)
--   Faturas:   Aluno RX → PAGA | Aluno Scaled → PENDENTE
--   Resultado: Aluno RX pode fazer check-in; Aluno Scaled é bloqueado
-- =============================================================================

-- Hash bcrypt pré-computado para 'Senha@123' (cost=10)
-- Gerado com: bcrypt.hashSync('Senha@123', 10)
-- Evita dependência de pgcrypto/gen_salt no seed

-- UUIDs (apenas hex: 0-9, a-f)
-- academia  : ace00000-0000-0000-0000-000000000001
-- dono      : d011a000-0000-0000-0000-000000000001
-- professor : b022b000-0000-0000-0000-000000000001
-- aluno_rx  : a033c000-0000-0000-0000-000000000001  (fatura paga)
-- aluno_sc  : a044d000-0000-0000-0000-000000000002  (fatura pendente)
-- wod_fran  : e055e000-0000-0000-0000-000000000001
-- aula_19h  : f066f000-0000-0000-0000-000000000001
-- aula_20h  : f0770000-0000-0000-0000-000000000002

-- =============================================================================
-- 1. ACADEMIA
-- =============================================================================

INSERT INTO academias (id, nome, slug, ativo)
VALUES (
    'ace00000-0000-0000-0000-000000000001',
    'CrossFit Exemplo',
    'crossfit-exemplo',
    true
);

-- =============================================================================
-- 2. USUÁRIOS — auth.users
-- =============================================================================

INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES
-- Dono
(
    'd011a000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'dono@crossfit-exemplo.com',
    extensions.crypt('Senha@123', extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}'
),
-- Professor
(
    'b022b000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'professor@crossfit-exemplo.com',
    extensions.crypt('Senha@123', extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}'
),
-- Aluno RX (fatura paga → pode fazer check-in)
(
    'a033c000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'joao.rx@email.com',
    extensions.crypt('Senha@123', extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}'
),
-- Aluno Scaled (fatura pendente → CHECK-IN BLOQUEADO)
(
    'a044d000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'maria.scaled@email.com',
    extensions.crypt('Senha@123', extensions.gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{}'
);

-- =============================================================================
-- 3. PROFILES
-- =============================================================================

INSERT INTO profiles (id, academia_id, role, nome_completo, telefone, asaas_cliente_id, ativo)
VALUES
(
    'd011a000-0000-0000-0000-000000000001',
    'ace00000-0000-0000-0000-000000000001',
    'dono', 'Carlos Dono', '(11) 99001-0001', 'aas_cust_dono_001', true
),
(
    'b022b000-0000-0000-0000-000000000001',
    'ace00000-0000-0000-0000-000000000001',
    'professor', 'Ana Professora', '(11) 99002-0002', NULL, true
),
(
    'a033c000-0000-0000-0000-000000000001',
    'ace00000-0000-0000-0000-000000000001',
    'aluno', 'João RX', '(11) 99003-0003', 'aas_cust_aluno_rx_001', true
),
(
    'a044d000-0000-0000-0000-000000000002',
    'ace00000-0000-0000-0000-000000000001',
    'aluno', 'Maria Scaled', '(11) 99004-0004', 'aas_cust_aluno_sc_002', true
);

-- =============================================================================
-- 4. WOD: "Fran"
-- =============================================================================

INSERT INTO wods (id, academia_id, nome, homenagem, mobilidade, aquecimento, treino, score_type, criado_por)
VALUES (
    'e055e000-0000-0000-0000-000000000001',
    'ace00000-0000-0000-0000-000000000001',
    'Fran',
    'Um dos WODs benchmark mais icônicos do CrossFit, criado por Greg Glassman.',
    '2 rounds: 10 dislocates + 10 pass-throughs com PVC',
    '3 rounds: 10 air squats + 10 kipping swings + 5 thrusters leves',
    '21-15-9 reps de:
- Thruster (43kg / 29kg)
- Pull-up
Para Tempo.',
    'tempo',
    'b022b000-0000-0000-0000-000000000001'
);

-- =============================================================================
-- 5. AULAS — mesmo WOD (Fran) em dois horários do dia 10/04/2026
-- =============================================================================

INSERT INTO aulas_agenda (id, academia_id, wod_id, data_aula, horario_inicio, horario_fim, capacidade_max, criado_por)
VALUES
(
    'f066f000-0000-0000-0000-000000000001',
    'ace00000-0000-0000-0000-000000000001',
    'e055e000-0000-0000-0000-000000000001',
    '2026-04-10', '19:00', '20:00', 15,
    'b022b000-0000-0000-0000-000000000001'
),
(
    'f0770000-0000-0000-0000-000000000002',
    'ace00000-0000-0000-0000-000000000001',
    'e055e000-0000-0000-0000-000000000001',
    '2026-04-10', '20:00', '21:00', 15,
    'b022b000-0000-0000-0000-000000000001'
);

-- =============================================================================
-- 6. FATURAS
-- =============================================================================

INSERT INTO faturas (
    academia_id, aluno_id,
    asaas_pagamento_id, valor, status,
    vencimento, pago_em, mes_referencia, descricao
) VALUES
-- João RX → PAGA (pode fazer check-in)
(
    'ace00000-0000-0000-0000-000000000001',
    'a033c000-0000-0000-0000-000000000001',
    'pay_joao_rx_abr2026', 150.00, 'paga',
    '2026-04-05', '2026-04-03 10:22:00+00',
    '2026-04-01', 'Mensalidade Abril/2026 — João RX'
),
-- Maria Scaled → PENDENTE (check-in BLOQUEADO)
(
    'ace00000-0000-0000-0000-000000000001',
    'a044d000-0000-0000-0000-000000000002',
    'pay_maria_sc_abr2026', 150.00, 'pendente',
    '2026-04-05', NULL,
    '2026-04-01', 'Mensalidade Abril/2026 — Maria Scaled'
);

-- =============================================================================
-- 7. CHECK-IN + RESULTADO (João RX — aula das 19h)
--    Trigger desabilitado durante seed pois não há sessão auth ativa
-- =============================================================================

ALTER TABLE checkins DISABLE TRIGGER trg_checkin_financeiro;

INSERT INTO checkins (academia_id, aula_id, aluno_id)
VALUES (
    'ace00000-0000-0000-0000-000000000001',
    'f066f000-0000-0000-0000-000000000001',
    'a033c000-0000-0000-0000-000000000001'
);

ALTER TABLE checkins ENABLE TRIGGER trg_checkin_financeiro;

INSERT INTO resultados_performance (
    academia_id, aula_id, aluno_id,
    tempo, rx_scaled, observacao
) VALUES (
    'ace00000-0000-0000-0000-000000000001',
    'f066f000-0000-0000-0000-000000000001',
    'a033c000-0000-0000-0000-000000000001',
    '00:08:32', true,
    'Unbroken nos thrusters, 2 breaks nos pull-ups.'
);

-- =============================================================================
-- Credenciais de teste:
--   dono@crossfit-exemplo.com      / Senha@123
--   professor@crossfit-exemplo.com / Senha@123
--   joao.rx@email.com              / Senha@123  ← fatura PAGA
--   maria.scaled@email.com         / Senha@123  ← fatura PENDENTE
-- =============================================================================
