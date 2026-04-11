-- Adiciona data de aplicação ao WOD
ALTER TABLE wods ADD COLUMN IF NOT EXISTS data_aplicacao DATE;

-- Remove secao 'wod' do ENUM pois exercícios do WOD ficam em wod_exercicios
-- A aula_exercicios só guarda 'aquecimento' a partir de agora
ALTER TABLE aula_exercicios ALTER COLUMN secao DROP DEFAULT;
ALTER TABLE aula_exercicios ALTER COLUMN secao TYPE TEXT;
DELETE FROM aula_exercicios WHERE secao = 'wod';
DROP TYPE IF EXISTS secao_aula;
CREATE TYPE secao_aula AS ENUM ('aquecimento');
ALTER TABLE aula_exercicios ALTER COLUMN secao TYPE secao_aula USING secao::secao_aula;
ALTER TABLE aula_exercicios ALTER COLUMN secao SET DEFAULT 'aquecimento';
