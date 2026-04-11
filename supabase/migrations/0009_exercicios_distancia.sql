-- Adiciona campo distância nos exercícios de aula e de WOD
ALTER TABLE aula_exercicios ADD COLUMN IF NOT EXISTS distancia TEXT;
ALTER TABLE wod_exercicios  ADD COLUMN IF NOT EXISTS distancia TEXT;
