import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, academia_id').eq('id', user.id).single();

  if (!profile) return new Response(JSON.stringify({ error: 'Perfil não encontrado' }), { status: 403 });

  const body = await request.json();
  const {
    aluno_id, exercicio_id, tipo,
    valor_peso, valor_tempo_seg, valor_reps, valor_rounds, valor_reps_extra,
    rx = true, data_registro, aula_id, observacao,
  } = body;

  // Aluno só pode registrar para si mesmo
  const targetAlunoId = profile.role === 'aluno' ? user.id : aluno_id;
  if (!targetAlunoId || !exercicio_id || !tipo) {
    return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400 });
  }

  const { data, error } = await supabase.from('prs').insert({
    academia_id:      profile.academia_id,
    aluno_id:         targetAlunoId,
    exercicio_id,
    tipo,
    valor_peso:       valor_peso       ?? null,
    valor_tempo_seg:  valor_tempo_seg  ?? null,
    valor_reps:       valor_reps       ?? null,
    valor_rounds:     valor_rounds     ?? null,
    valor_reps_extra: valor_reps_extra ?? null,
    rx,
    data_registro:    data_registro    ?? new Date().toISOString().split('T')[0],
    aula_id:          aula_id          ?? null,
    registrado_por:   user.id,
    observacao:       observacao        ?? null,
  }).select().single();

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ pr: data }), { status: 201 });
};

export const DELETE: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });

  const { id } = await request.json();
  if (!id) return new Response(JSON.stringify({ error: 'ID obrigatório' }), { status: 400 });

  const { error } = await supabase.from('prs').delete().eq('id', id);
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
