/**
 * POST /api/prs/salvar
 * Aluno registra PR avulso (sem aula_id). Requer migração 0033_prs_categoria.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: 'Não autenticado' }, 401);

  const { data: profile } = await supabase
    .from('profiles').select('role, academia_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'aluno')
    return json({ error: 'Apenas alunos podem registrar resultados.' }, 403);

  let body: any;
  try { body = await request.json(); } catch { return json({ error: 'Body inválido.' }, 400); }

  const {
    exercicio_id, categoria,
    valor_peso, valor_tempo_seg, valor_reps,
    valor_rounds, valor_reps_extra,
    observacao, data_registro,
  } = body;

  if (!exercicio_id) return json({ error: 'Exercício obrigatório.' }, 400);

  const admin = createSupabaseAdminClient();

  const { data: ex } = await admin
    .from('exercicios')
    .select('id, tipo_resultado')
    .eq('id', exercicio_id)
    .eq('academia_id', profile.academia_id!)
    .maybeSingle();
  if (!ex) return json({ error: 'Exercício não encontrado.' }, 404);

  const tipo = ex.tipo_resultado as string;
  const cat  = (categoria as string) || 'rx';
  const today = new Date().toLocaleDateString('en-CA');

  let insert: Record<string, unknown> = {
    academia_id:   profile.academia_id,
    aluno_id:      user.id,
    exercicio_id,
    tipo,
    categoria:     cat,
    rx:            cat === 'rx',
    data_registro: data_registro || today,
    observacao:    observacao || null,
  };

  if (tipo === 'peso') {
    const v = parseFloat(valor_peso);
    if (!v || v <= 0) return json({ error: 'Informe a carga em kg.' }, 400);
    insert.valor_peso = v;
  } else if (tipo === 'tempo') {
    const v = parseInt(valor_tempo_seg);
    if (!v || v <= 0) return json({ error: 'Informe o tempo.' }, 400);
    insert.valor_tempo_seg = v;
  } else if (tipo === 'reps') {
    const v = parseInt(valor_reps);
    if (!v || v <= 0) return json({ error: 'Informe as repetições.' }, 400);
    insert.valor_reps = v;
  } else if (tipo === 'rounds_reps') {
    insert.valor_rounds     = parseInt(valor_rounds)     || 0;
    insert.valor_reps_extra = parseInt(valor_reps_extra) || 0;
  }

  const { error } = await admin.from('prs').insert(insert);
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
