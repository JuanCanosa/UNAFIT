/**
 * POST /api/aula-exercicios/adicionar
 * Adiciona um exercício a uma seção de aula (mobilidade | skills | wod).
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
  const { aula_id, secao, exercicio_id, novo_nome, repeticoes, carga, distancia, observacao } = body;

  if (!aula_id) {
    return new Response(JSON.stringify({ error: 'aula_id é obrigatório' }), { status: 400 });
  }

  if (!secao || secao !== 'aquecimento') {
    return new Response(JSON.stringify({ error: 'secao inválida' }), { status: 400 });
  }

  // Verifica que a aula pertence à academia
  const { data: aula } = await supabase
    .from('aulas_agenda')
    .select('id')
    .eq('id', aula_id)
    .eq('academia_id', profile.academia_id!)
    .single();

  if (!aula) {
    return new Response(JSON.stringify({ error: 'Aula não encontrada' }), { status: 404 });
  }

  let exId = exercicio_id as string | null;

  // Se não passou exercicio_id, cria (ou recupera) o exercício pelo nome
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

  // Determina a próxima ordem dentro da seção desta aula
  const { count } = await supabase
    .from('aula_exercicios')
    .select('id', { count: 'exact', head: true })
    .eq('aula_id', aula_id)
    .eq('secao', secao);

  const proxOrdem = (count ?? 0) + 1;

  const { error: insErr } = await supabase.from('aula_exercicios').insert({
    aula_id,
    academia_id:  profile.academia_id,
    secao,
    exercicio_id: exId,
    ordem:        proxOrdem,
    repeticoes:   repeticoes || null,
    carga:        carga || null,
    distancia:    distancia || null,
    observacao:   observacao || null,
  });

  if (insErr) {
    return new Response(JSON.stringify({ error: insErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
