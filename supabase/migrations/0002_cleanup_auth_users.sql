-- =============================================================================
-- UNAFIT — Limpeza de auth.users corrompidos
-- Remove entradas inseridas manualmente (sem GoTrue) que quebram a Admin API.
-- Depois disso, recriar via Admin API com recreate-users.mjs
-- =============================================================================

-- 1. Remove identities vinculadas (FK cascade pode não existir)
DELETE FROM auth.identities
WHERE user_id IN (
  'd011a000-0000-0000-0000-000000000001',
  'b022b000-0000-0000-0000-000000000001',
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

-- 2. Remove sessions
DELETE FROM auth.sessions
WHERE user_id IN (
  'd011a000-0000-0000-0000-000000000001',
  'b022b000-0000-0000-0000-000000000001',
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

-- 3. Remove refresh tokens
DELETE FROM auth.refresh_tokens
WHERE user_id IN (
  'd011a000-0000-0000-0000-000000000001',
  'b022b000-0000-0000-0000-000000000001',
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

-- 4. Remove checkins e resultados vinculados aos alunos (FK de public schema)
ALTER TABLE checkins DISABLE TRIGGER trg_checkin_financeiro;

DELETE FROM resultados_performance
WHERE aluno_id IN (
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

DELETE FROM checkins
WHERE aluno_id IN (
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

ALTER TABLE checkins ENABLE TRIGGER trg_checkin_financeiro;

-- 5. Remove faturas dos alunos
DELETE FROM faturas
WHERE aluno_id IN (
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

-- 6. Remove profiles (FK on auth.users)
DELETE FROM profiles
WHERE id IN (
  'd011a000-0000-0000-0000-000000000001',
  'b022b000-0000-0000-0000-000000000001',
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
);

-- 7. Finalmente, remove as entradas corrompidas de auth.users
DELETE FROM auth.users
WHERE id IN (
  'd011a000-0000-0000-0000-000000000001',
  'b022b000-0000-0000-0000-000000000001',
  'a033c000-0000-0000-0000-000000000001',
  'a044d000-0000-0000-0000-000000000002'
)
OR email IN (
  'dono@crossfit-exemplo.com',
  'professor@crossfit-exemplo.com',
  'joao.rx@email.com',
  'maria.scaled@email.com'
);
