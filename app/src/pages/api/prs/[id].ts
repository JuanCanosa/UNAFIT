/**
 * PUT  /api/prs/[id] — atualiza um PR do aluno
 * DELETE /api/prs/[id] — exclui um PR do aluno
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

async function getAluno(request: Request, cookies: any) {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles').select('role, academia_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'aluno') return null;
  return { user, profile };
}

export const DELETE: APIRoute = async ({ params, request, cookies }) => {
  const ctx = await getAluno(request, cookies);
  if (!ctx) return json({ error: 'Não autorizado.' }, 401);

  const admin = createSupabaseAdminClient();
  const { data: pr } = await admin.from('prs')
    .select('id, aluno_id').eq('id', params.id!).maybeSingle();

  if (!pr) return json({ error: 'Registro não encontrado.' }, 404);
  if (pr.aluno_id !== ctx.user.id) return json({ error: 'Sem permissão.' }, 403);

  const { error } = await admin.from('prs').delete().eq('id', params.id!);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
};

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  const ctx = await getAluno(request, cookies);
  if (!ctx) return json({ error: 'Não autorizado.' }, 401);

  const admin = createSupabaseAdminClient();
  const { data: pr } = await admin.from('prs')
    .select('id, aluno_id, tipo').eq('id', params.id!).maybeSingle();

  if (!pr) return json({ error: 'Registro não encontrado.' }, 404);
  if (pr.aluno_id !== ctx.user.id) return json({ error: 'Sem permissão.' }, 403);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

  const { categoria, valor_peso, valor_tempo_seg, valor_reps,
          valor_rounds, valor_reps_extra, observacao, data_registro } = body;

  const cat = (categoria as string) || 'rx';
  const update: Record<string, unknown> = {
    categoria: cat,
    rx: cat === 'rx',
    observacao: observacao || null,
    data_registro: data_registro || new Date().toLocaleDateString('en-CA'),
  };

  if (pr.tipo === 'peso') {
    const v = parseFloat(valor_peso);
    if (!v || v <= 0) return json({ error: 'Informe a carga em kg.' }, 400);
    update.valor_peso = v;
  } else if (pr.tipo === 'tempo') {
    const v = parseInt(valor_tempo_seg);
    if (!v || v <= 0) return json({ error: 'Informe o tempo.' }, 400);
    update.valor_tempo_seg = v;
  } else if (pr.tipo === 'reps') {
    const v = parseInt(valor_reps);
    if (!v || v <= 0) return json({ error: 'Informe as repetições.' }, 400);
    update.valor_reps = v;
  } else if (pr.tipo === 'rounds_reps') {
    update.valor_rounds     = parseInt(valor_rounds)     || 0;
    update.valor_reps_extra = parseInt(valor_reps_extra) || 0;
  }

  const { error } = await admin.from('prs').update(update).eq('id', params.id!);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
