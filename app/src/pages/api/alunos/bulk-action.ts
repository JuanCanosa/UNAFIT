/**
 * POST /api/alunos/bulk-action
 * Ações em massa sobre alunos: inativar ou excluir.
 * Uso exclusivo do dono (role = dono).
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';
import { createAsaasClient } from '@/lib/asaas';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ erro: 'Não autenticado' }, 401);

  const { data: profile } = await supabase
    .from('profiles').select('role, academia_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'dono') return json({ erro: 'Acesso negado' }, 403);

  let body: { action: string; ids: string[] };
  try { body = await request.json(); } catch { return json({ erro: 'JSON inválido' }, 400); }

  const { action, ids } = body ?? {};
  if (!action || !Array.isArray(ids) || ids.length === 0) return json({ erro: 'Parâmetros inválidos' }, 400);
  if (ids.length > 500) return json({ erro: 'Máximo de 500 alunos por operação' }, 400);
  if (!['inativar', 'excluir'].includes(action)) return json({ erro: 'Ação inválida' }, 400);

  const admin = createSupabaseAdminClient();

  // Garante que todos os IDs pertencem à academia do dono (segurança)
  const { data: alunosVerif } = await admin
    .from('alunos').select('id').eq('academia_id', profile.academia_id!).in('id', ids);
  const idsValidos = (alunosVerif ?? []).map(a => a.id);
  if (idsValidos.length === 0) return json({ erro: 'Nenhum aluno válido encontrado' }, 400);

  // Busca assinaturas Asaas ativas para cancelar
  const { data: planos } = await admin
    .from('aluno_planos')
    .select('asaas_subscription_id')
    .in('aluno_id', idsValidos)
    .eq('status', 'ativo')
    .not('asaas_subscription_id', 'is', null);

  const subscriptionIds = (planos ?? [])
    .map(p => p.asaas_subscription_id)
    .filter(Boolean) as string[];

  if (subscriptionIds.length > 0) {
    const { data: acad } = await admin
      .from('academias').select('asaas_api_key, asaas_sandbox').eq('id', profile.academia_id!).single();
    if (acad?.asaas_api_key) {
      const cli = createAsaasClient(acad.asaas_api_key, acad.asaas_sandbox !== false);
      for (const subId of subscriptionIds) {
        try { await cli.cancelarAssinatura(subId); } catch (_) {}
      }
    }
  }

  if (action === 'inativar') {
    // Cancela planos ativos e inativa os alunos
    await admin.from('aluno_planos')
      .update({ status: 'cancelado', data_fim: new Date().toISOString().split('T')[0] })
      .in('aluno_id', idsValidos).eq('status', 'ativo');

    await admin.from('alunos')
      .update({ status: 'inativo' })
      .in('id', idsValidos).eq('academia_id', profile.academia_id!);

    return json({ ok: true, processados: idsValidos.length });
  }

  if (action === 'excluir') {
    // Cascata via FK: aluno_planos, pagamentos, checkins, etc. são deletados pelo banco
    await admin.from('alunos')
      .delete()
      .in('id', idsValidos).eq('academia_id', profile.academia_id!);

    return json({ ok: true, processados: idsValidos.length });
  }

  return json({ erro: 'Ação não tratada' }, 400);
};

function json(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
