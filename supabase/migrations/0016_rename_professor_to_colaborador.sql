-- ─── Renomeia role 'professor' para 'colaborador' ─────────────────────────────

-- Atualiza dados existentes
UPDATE profiles SET role = 'colaborador' WHERE role = 'professor';

-- Recria políticas RLS que referenciam 'professor'

-- wods
DROP POLICY IF EXISTS "wods_insert" ON wods;
DROP POLICY IF EXISTS "wods_update" ON wods;
DROP POLICY IF EXISTS "wods_delete" ON wods;

CREATE POLICY "wods_insert" ON wods FOR INSERT
  WITH CHECK (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "wods_update" ON wods FOR UPDATE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "wods_delete" ON wods FOR DELETE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);

-- aulas_agenda
DROP POLICY IF EXISTS "aulas_agenda_insert" ON aulas_agenda;
DROP POLICY IF EXISTS "aulas_agenda_update" ON aulas_agenda;
DROP POLICY IF EXISTS "aulas_agenda_delete" ON aulas_agenda;

CREATE POLICY "aulas_agenda_insert" ON aulas_agenda FOR INSERT
  WITH CHECK (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "aulas_agenda_update" ON aulas_agenda FOR UPDATE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "aulas_agenda_delete" ON aulas_agenda FOR DELETE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);

-- checkins (staff pode registrar)
DROP POLICY IF EXISTS "checkins_insert_staff" ON checkins;
DROP POLICY IF EXISTS "checkins_delete" ON checkins;

CREATE POLICY "checkins_insert_staff" ON checkins FOR INSERT
  TO authenticated
  WITH CHECK (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "checkins_delete" ON checkins FOR DELETE
  USING (meu_role() IN ('saas_admin','dono','colaborador'));

-- resultados_performance
DROP POLICY IF EXISTS "resultados_insert_staff" ON resultados_performance;
DROP POLICY IF EXISTS "resultados_update_staff" ON resultados_performance;

CREATE POLICY "resultados_insert_staff" ON resultados_performance FOR INSERT
  TO authenticated
  WITH CHECK (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "resultados_update_staff" ON resultados_performance FOR UPDATE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);

-- profiles (dono pode gerenciar colaboradores)
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;

CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  WITH CHECK (
    meu_role() = 'saas_admin'
    OR (meu_role() = 'dono' AND minha_academia_id() = academia_id AND NEW.role IN ('colaborador','aluno'))
  );
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (
    meu_role() = 'saas_admin'
    OR (meu_role() = 'dono' AND minha_academia_id() = academia_id)
    OR id = auth.uid()
  );

-- alunos (colaborador pode gerenciar)
DROP POLICY IF EXISTS "alunos_insert" ON alunos;
DROP POLICY IF EXISTS "alunos_update" ON alunos;
DROP POLICY IF EXISTS "alunos_delete" ON alunos;

CREATE POLICY "alunos_insert" ON alunos FOR INSERT
  WITH CHECK (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "alunos_update" ON alunos FOR UPDATE
  USING (meu_role() IN ('saas_admin','dono','colaborador') AND minha_academia_id() = academia_id);
CREATE POLICY "alunos_delete" ON alunos FOR DELETE
  USING (meu_role() IN ('saas_admin','dono') AND minha_academia_id() = academia_id);
