-- Modalidades de aula configuráveis por academia
CREATE TABLE modalidades (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academia_id uuid NOT NULL REFERENCES academias(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  cor         TEXT NOT NULL DEFAULT 'azul',
  ordem       int  NOT NULL DEFAULT 0,
  ativo       boolean NOT NULL DEFAULT true,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(academia_id, nome)
);

ALTER TABLE modalidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros leem modalidades da academia"
  ON modalidades FOR SELECT
  USING (academia_id = minha_academia_id());

CREATE POLICY "Dono gerencia modalidades"
  ON modalidades FOR ALL
  USING (academia_id = minha_academia_id() AND meu_role() IN ('dono', 'saas_admin'));

-- Seed: 3 defaults para todas as academias já existentes
INSERT INTO modalidades (academia_id, nome, cor, ordem)
SELECT id, 'CrossFit',         'vermelho', 0 FROM academias
UNION ALL
SELECT id, 'Treino Livre',     'verde',    1 FROM academias
UNION ALL
SELECT id, 'Treino Funcional', 'laranja',  2 FROM academias
ON CONFLICT (academia_id, nome) DO NOTHING;
