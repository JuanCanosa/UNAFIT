/**
 * GET /api/exercicios/buscar?q=thruster
 * Live search de exercícios da academia.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase';

export const GET: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('academia_id')
    .eq('id', user.id)
    .single();

  if (!profile) return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), { status: 404 });

  const url = new URL(request.url);
  const q   = url.searchParams.get('q')?.trim() ?? '';

  if (!q) return new Response(JSON.stringify({ exercicios: [] }), { status: 200 });

  const { data: exercicios } = await supabase
    .from('exercicios')
    .select('id, nome, descricao')
    .eq('academia_id', profile.academia_id!)
    .ilike('nome', `%${q}%`)
    .order('nome')
    .limit(10);

  return new Response(JSON.stringify({ exercicios: exercicios ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
