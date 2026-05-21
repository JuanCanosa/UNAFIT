import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Retorna o auth user ID correspondente a um e-mail, sem carregar todos os usuários
 * (substitui o anti-pattern: listUsers({perPage:50000}).find(u => u.email === x))
 *
 * Usa generateLink internamente — a função retorna o user sem enviar e-mail.
 * Retorna null se não encontrar.
 */
export async function getAuthUserIdByEmail(
  adminClient: SupabaseClient,
  email: string
): Promise<string | null> {
  try {
    const { data } = await (adminClient.auth.admin as any).generateLink({
      type: 'recovery',
      email: email.toLowerCase(),
    });
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
