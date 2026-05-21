-- Função auxiliar segura para buscar um auth.users.id por email.
-- Substitui o padrão listUsers({perPage:50000}) que carrega todos os usuários
-- para fazer um find() em JS — O(n) → O(1) com índice existente em auth.users.email.
CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM auth.users WHERE email = lower(p_email) LIMIT 1;
$$;
