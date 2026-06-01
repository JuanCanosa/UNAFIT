/**
 * POST /api/prs/registrar
 * Aluno registra o próprio resultado de um WOD após o check-in.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

const TIPO_MAP: Record<string, string> = {
  tempo:       'tempo',
  reps:        'reps',
  carga:       'peso',
  rounds_reps: 'rounds_reps',
};

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

  const { aula_id, score_type, valor_min, valor_sec, valor_reps,
          valor_peso, valor_rounds, valor_reps_extra, rx, observacao } = body;

  if (!aula_id || !score_type) return json({ error: 'Campos obrigatórios ausentes.' }, 400);

  const admin = createSupabaseAdminClient();

  const { data: checkin } = await admin.from('checkins')
    .select('id').eq('aula_id', aula_id).eq('aluno_id', user.id).maybeSingle();
  if (!checkin) return json({ error: 'Você não fez check-in nesta aula.' }, 403);

  const { data: aula } = await admin.from('aulas_agenda')
    .select('id, academia_id, data_aula, wods(id, nome)')
    .eq('id', aula_id).single();

  if (!aula || aula.academia_id !== profile.academia_id)
    return json({ error: 'Aula não encontrada.' }, 404);

  const wod = (aula as any).wods;
  if (!wod) return json({ error: 'Esta aula não tem WOD vinculado.' }, 400);

  const tipo = TIPO_MAP[score_type] ?? 'reps';
  let valor_tempo_seg: number | null = null;

  if (score_type === 'tempo') {
    const min = parseInt(valor_min) || 0;
    const sec = parseInt(valor_sec) || 0;
    valor_tempo_seg = min * 60 + sec;
    if (valor_tempo_seg === 0) return json({ error: 'Informe o tempo.' }, 400);
  }

  let { data: exercicio } = await admin.from('exercicios')
    .select('id').eq('academia_id', profile.academia_id!).eq('nome', wod.nome).maybeSingle();

  if (!exercicio) {
    const { data: novo } = await admin.from('exercicios').insert({
      academia_id: profile.academia_id, nome: wod.nome, tipo_resultado: tipo,
    }).select('id').single();
    exercicio = novo;
  }
  if (!exercicio) return json({ error: 'Erro ao criar exercício.' }, 500);

  await admin.from('prs').delete().eq('aula_id', aula_id).eq('aluno_id', user.id);

  const { error } = await admin.from('prs').insert({
    academia_id:      profile.academia_id,
    aluno_id:         user.id,
    exercicio_id:     exercicio.id,
    tipo,
    rx:               rx === true || rx === 'true',
    data_registro:    aula.data_aula,
    aula_id,
    registrado_por:   user.id,
    observacao:       observacao || null,
    valor_tempo_seg,
    valor_reps:       score_type === 'reps'        ? (parseInt(valor_reps)   || null) : null,
    valor_peso:       score_type === 'carga'       ? (parseFloat(valor_peso) || null) : null,
    valor_rounds:     score_type === 'rounds_reps' ? (parseInt(valor_rounds) || null) : null,
    valor_reps_extra: score_type === 'rounds_reps' ? (parseInt(valor_reps_extra) || 0)  : null,
  });

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
