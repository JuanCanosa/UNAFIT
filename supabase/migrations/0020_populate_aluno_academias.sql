-- Popula aluno_academias com os vínculos já existentes (alunos que têm perfil ativo)
-- Faz o join via auth.users para correlacionar profile_id ↔ aluno por email ou CPF

INSERT INTO aluno_academias (profile_id, academia_id, aluno_id, ativo)
SELECT
  p.id          AS profile_id,
  p.academia_id,
  a.id          AS aluno_id,
  true
FROM profiles p
JOIN auth.users u ON u.id = p.id
JOIN alunos a ON
  a.academia_id = p.academia_id
  AND (
    -- aluno tem email real que coincide com a conta auth
    (a.email IS NOT NULL AND a.email = u.email)
    -- OU aluno usa CPF como identificador de login
    OR (a.email IS NULL AND a.cpf = split_part(u.email, '@', 1))
  )
WHERE p.role = 'aluno'
  AND p.academia_id IS NOT NULL
ON CONFLICT (profile_id, academia_id) DO NOTHING;
