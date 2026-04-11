/**
 * POST /api/exercicios/vincular
 * Vincula um exercício a um WOD.
 * Se exercicio_id for null e novo_nome estiver preenchido, cria o exercício antes.
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

  if (!profile || (profile.role !== 'dono' && profile.role !== 'professor' && profile.role !== 'saas_admin')) {
    return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403 });
  }

  const body = await request.json();
  const { wod_id, exercicio_id, novo_nome, repeticoes, carga, distancia, observacao, grupo_id } = body;

  if (!wod_id) {
    return new Response(JSON.stringify({ error: 'wod_id é obrigatório' }), { status: 400 });
  }

  // Verifica que o WOD pertence à academia
  const { data: wod } = await supabase
    .from('wods')
    .select('id')
    .eq('id', wod_id)
    .eq('academia_id', profile.academia_id!)
    .single();

  if (!wod) {
    return new Response(JSON.stringify({ error: 'WOD não encontrado' }), { status: 404 });
  }

  let exId = exercicio_id as string | null;

  // Se não passou exercicio_id, cria o exercício
  if (!exId) {
    const nome = (novo_nome as string)?.trim();
    if (!nome) {
      return new Response(JSON.stringify({ error: 'Informe o exercício ou um nome para criar' }), { status: 400 });
    }

    const { data: criado, error: createErr } = await supabase
      .from('exercicios')
      .upsert(
        { academia_id: profile.academia_id, nome },
        { onConflict: 'academia_id,nome', ignoreDuplicates: false }
      )
      .select('id')
      .single();

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 500 });
    }
    exId = criado!.id;
  }

  // Determina a ordem (próximo número disponível)
  const { count } = await supabase
    .from('wod_exercicios')
    .select('id', { count: 'exact', head: true })
    .eq('wod_id', wod_id);

  const proxOrdem = (count ?? 0) + 1;

  // Vincula
  const { error: vincErr } = await supabase.from('wod_exercicios').insert({
    wod_id,
    academia_id:  profile.academia_id,
    exercicio_id: exId,
    ordem:        proxOrdem,
    repeticoes:   repeticoes || null,
    carga:        carga || null,
    distancia:    distancia || null,
    observacao:   observacao || null,
    grupo_id:     grupo_id  || null,
  });

  if (vincErr) {
    return new Response(JSON.stringify({ error: vincErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
