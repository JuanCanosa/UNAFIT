/**
 * POST /api/exercicios/reordenar
 * Atualiza a ordem dos exercícios de um WOD.
 * Body: { wod_id: string, ids: string[] }  — ids na nova ordem
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, academia_id')
    .eq('id', user.id)
    .single();

  if (!profile || !['dono','colaborador','saas_admin'].includes(profile.role)) {
    return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403 });
  }

  const { wod_id, ids } = await request.json() as { wod_id: string; ids: string[] };
  if (!wod_id || !Array.isArray(ids)) {
    return new Response(JSON.stringify({ error: 'Dados inválidos' }), { status: 400 });
  }

  // Atualiza cada linha com sua nova ordem
  const updates = ids.map((id, i) =>
    supabase.from('wod_exercicios').update({ ordem: i + 1 }).eq('id', id).eq('wod_id', wod_id)
  );
  await Promise.all(updates);

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
