import type { APIRoute } from 'astro';
import { createSupabaseServerClient } from '@/lib/supabase';
import { validarCheckin } from '@/lib/checkin-validator';
import type { Profile } from '@/types/database';

const MENSAGENS: Record<string, string> = {
  FORA_DA_JANELA:      'Check-in indisponível no momento. Tente entre 10 minutos antes do início e 10 minutos após o fim da aula.',
  JA_REALIZADO:        'Você já realizou check-in nesta aula.',
  AULA_NAO_ENCONTRADA: 'Aula não encontrada.',
  ALUNO_INATIVO:       'Sua conta está inativa. Contate a academia.',
  SEM_VAGAS:           'Não há vagas disponíveis nesta aula.',
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ ok: false, motivo: 'Não autenticado.' }, 401);

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, academia_id, ativo')
    .eq('id', user.id)
    .single<Pick<Profile, 'role' | 'academia_id' | 'ativo'>>();

  if (!profile || !profile.ativo) return json({ ok: false, motivo: MENSAGENS['ALUNO_INATIVO'] }, 403);
  if (profile.role !== 'aluno') return json({ ok: false, motivo: 'Apenas alunos podem usar este endpoint.' }, 403);
  if (!profile.academia_id) return json({ ok: false, motivo: 'Aluno não vinculado a uma academia.' }, 400);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, motivo: 'Body inválido.' }, 400); }

  const aulaId = (body as Record<string, unknown>)?.aula_id;
  if (typeof aulaId !== 'string' || !aulaId) return json({ ok: false, motivo: 'Campo aula_id é obrigatório.' }, 400);

  const resultado = await validarCheckin({ aulaId, alunoId: user.id, academiaId: profile.academia_id });
  if (!resultado.permitido) return json({ ok: false, motivo: MENSAGENS[resultado.motivo] ?? resultado.motivo }, 400);

  const { error: insertError } = await supabase
    .from('checkins')
    .insert({ aula_id: aulaId, aluno_id: user.id, academia_id: profile.academia_id });

  if (insertError) return json({ ok: false, motivo: 'Erro interno ao registrar check-in.' }, 500);

  return json({ ok: true }, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
