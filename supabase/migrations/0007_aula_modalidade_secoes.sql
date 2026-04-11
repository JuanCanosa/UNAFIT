-- Adiciona modalidade à aula
ALTER TABLE aulas_agenda ADD COLUMN IF NOT EXISTS modalidade TEXT NOT NULL DEFAULT 'CrossFit';

-- Recria secao_aula com apenas 'aquecimento' e 'wod'
-- Passo 1: remove o default para liberar dependência do enum
ALTER TABLE aula_exercicios ALTER COLUMN secao DROP DEFAULT;

-- Passo 2: converte coluna para TEXT
ALTER TABLE aula_exercicios ALTER COLUMN secao TYPE TEXT;

-- Passo 3: migra valores antigos
UPDATE aula_exercicios SET secao = 'aquecimento' WHERE secao IN ('mobilidade', 'skills');

-- Passo 4: dropa e recria o ENUM
DROP TYPE IF EXISTS secao_aula;
CREATE TYPE secao_aula AS ENUM ('aquecimento', 'wod');

-- Passo 5: reconverte a coluna e restaura o default
ALTER TABLE aula_exercicios ALTER COLUMN secao TYPE secao_aula USING secao::secao_aula;
ALTER TABLE aula_exercicios ALTER COLUMN secao SET DEFAULT 'wod';
