-- =============================================================================
-- UNAFIT — Corrige funções auxiliares de RLS
-- minha_academia_id() e meu_role() precisam de SECURITY DEFINER para evitar
-- recursão infinita quando chamadas dentro de políticas RLS de profiles.
-- =============================================================================

CREATE OR REPLACE FUNCTION minha_academia_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT academia_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION meu_role()
RETURNS user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT role FROM profiles WHERE id = auth.uid();
$$;
