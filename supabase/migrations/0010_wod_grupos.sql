-- Grupos de rounds dentro de um WOD
CREATE TABLE wod_grupos (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wod_id    UUID NOT NULL REFERENCES wods(id) ON DELETE CASCADE,
  rounds    INTEGER NOT NULL DEFAULT 1,
  ordem     INTEGER NOT NULL DEFAULT 1,
  criado_em TIMESTAMPTZ DEFAULT now()
);

-- Exercício pode pertencer a um grupo
ALTER TABLE wod_exercicios
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES wod_grupos(id) ON DELETE SET NULL;
