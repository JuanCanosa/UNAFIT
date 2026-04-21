ALTER TABLE academias ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT false;
-- Academias já existentes são marcadas como completas
UPDATE academias SET onboarding_completo = true WHERE criado_em IS NOT NULL;
