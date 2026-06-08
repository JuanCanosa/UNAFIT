-- =============================================================================
-- FIX: políticas RLS "FOR ALL" sem checagem de role (introduzidas em 0012)
--
-- Problema: as políticas "academia_alunos", "academia_planos",
-- "academia_pagamentos", "academia_aluno_planos", "academia_categorias_alunos",
-- "academia_checkins" e "academia_checkin_resultados" usam apenas
--   academia_id IN (SELECT academia_id FROM profiles WHERE id = auth.uid())
-- sem FOR <comando> e sem checar meu_role(). Isso cria políticas permissivas
-- para SELECT/INSERT/UPDATE/DELETE simultaneamente — e como políticas
-- permissivas são combinadas com OR, qualquer usuário autenticado da academia
-- (inclusive role 'aluno') pode ler, criar, alterar e apagar registros de
-- QUALQUER outro membro: CPF/endereço/telefone (alunos), valores e status de
-- cobrança (pagamentos), assinaturas (aluno_planos), planos e check-ins.
--
-- Correção: remove essas políticas amplas e substitui por políticas
-- específicas por comando, alinhadas ao papel real de cada role observado
-- no código da aplicação (dono/colaborador = staff da academia; aluno = vê
-- apenas o próprio registro).
-- =============================================================================

DROP POLICY IF EXISTS "academia_alunos"             ON alunos;
DROP POLICY IF EXISTS "academia_planos"             ON planos;
DROP POLICY IF EXISTS "academia_pagamentos"         ON pagamentos;
DROP POLICY IF EXISTS "academia_aluno_planos"       ON aluno_planos;
DROP POLICY IF EXISTS "academia_categorias_alunos"  ON categorias_alunos;
DROP POLICY IF EXISTS "academia_checkins"           ON checkins;
DROP POLICY IF EXISTS "academia_checkin_resultados" ON checkin_resultados;

-- =============================================================================
-- alunos
-- INSERT/UPDATE/DELETE já cobertos por "alunos_insert/update/delete" (0017,
-- staff apenas). Falta apenas o SELECT: staff vê todos da academia; o próprio
-- aluno vê unicamente o seu registro (casado por e-mail, como faz
-- /dashboard/faturas.astro — não há vínculo direto profiles.id ↔ alunos.id).
-- =============================================================================

CREATE POLICY "alunos_select" ON alunos FOR SELECT
    USING (
        (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id)
        OR (meu_role() = 'aluno' AND academia_id = minha_academia_id() AND email = auth.email())
    );

-- =============================================================================
-- planos — configuração comercial da academia. Leitura: staff. Escrita: apenas
-- dono/saas_admin (página /dashboard/planos já restringe a esses dois roles).
-- =============================================================================

CREATE POLICY "planos_select" ON planos FOR SELECT
    USING (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id);

CREATE POLICY "planos_insert" ON planos FOR INSERT
    WITH CHECK (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "planos_update" ON planos FOR UPDATE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "planos_delete" ON planos FOR DELETE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

-- =============================================================================
-- pagamentos — dado financeiro sensível. Leitura: dono/saas_admin (colaborador
-- NÃO tem acesso ao financeiro, conforme canVerFinanceiro em alunos/[id].astro)
-- e o próprio aluno vê apenas os seus (casado via alunos.email = auth.email()).
-- Escrita: apenas dono/saas_admin — webhooks usam service_role (bypassa RLS).
-- =============================================================================

CREATE POLICY "pagamentos_select" ON pagamentos FOR SELECT
    USING (
        (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id)
        OR (
            meu_role() = 'aluno'
            AND EXISTS (
                SELECT 1 FROM alunos a
                WHERE a.id = pagamentos.aluno_id
                  AND a.academia_id = minha_academia_id()
                  AND a.email = auth.email()
            )
        )
    );

CREATE POLICY "pagamentos_insert" ON pagamentos FOR INSERT
    WITH CHECK (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "pagamentos_update" ON pagamentos FOR UPDATE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "pagamentos_delete" ON pagamentos FOR DELETE
    USING (meu_role() = 'saas_admin' AND minha_academia_id() = academia_id);

-- =============================================================================
-- aluno_planos — vínculo aluno × plano (inclui asaas_subscription_id).
-- Leitura: staff da academia. Escrita: dono/saas_admin (a maior parte das
-- escritas reais ocorre via service_role em adminPlano, RLS aqui é backstop).
-- =============================================================================

CREATE POLICY "aluno_planos_select" ON aluno_planos FOR SELECT
    USING (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id);

CREATE POLICY "aluno_planos_insert" ON aluno_planos FOR INSERT
    WITH CHECK (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "aluno_planos_update" ON aluno_planos FOR UPDATE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

CREATE POLICY "aluno_planos_delete" ON aluno_planos FOR DELETE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

-- =============================================================================
-- categorias_alunos — metadado de baixo risco (rótulos/cores). Mantém CRUD
-- para staff da academia, mas agora com checagem de role.
-- =============================================================================

CREATE POLICY "categorias_alunos_select" ON categorias_alunos FOR SELECT
    USING (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id);

CREATE POLICY "categorias_alunos_insert" ON categorias_alunos FOR INSERT
    WITH CHECK (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id);

CREATE POLICY "categorias_alunos_update" ON categorias_alunos FOR UPDATE
    USING (meu_role() IN ('saas_admin', 'dono', 'colaborador') AND minha_academia_id() = academia_id);

CREATE POLICY "categorias_alunos_delete" ON categorias_alunos FOR DELETE
    USING (meu_role() IN ('saas_admin', 'dono') AND minha_academia_id() = academia_id);

-- =============================================================================
-- checkins — a remoção de "academia_checkins" deixa em vigor apenas as
-- políticas já corretas: checkins_select / checkins_insert / checkins_insert_staff
-- / checkins_delete (ver 0001 e 0017). Nenhuma substituição necessária.
--
-- checkin_resultados — tabela legada, não referenciada em nenhum lugar do
-- código da aplicação (o módulo de performance usa "prs", ver 0026). Removida
-- a política ampla, a tabela fica sem políticas == sem acesso via roles
-- públicos (apenas service_role), o que é seguro pois nada a utiliza.
-- =============================================================================
