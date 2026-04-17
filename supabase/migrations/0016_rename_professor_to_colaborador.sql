-- ─── Adiciona 'colaborador' ao enum user_role ────────────────────────────────
-- Deve estar em transação separada antes de usar o novo valor
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'colaborador';
