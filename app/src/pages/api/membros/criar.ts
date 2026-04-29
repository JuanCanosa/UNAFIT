import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, academia_id')
    .eq('id', user.id)
    .single();

  if (!profile || (profile.role !== 'dono' && profile.role !== 'saas_admin')) {
    return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403 });
  }

  const body = await request.json();
  const { email, nome_completo, telefone } = body;

  if (!email || !nome_completo) {
    return new Response(JSON.stringify({ error: 'Nome e e-mail são obrigatórios' }), { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Gera senha temporária aleatória — aluno redefine pelo link enviado pelo dono
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const senhaTemp = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

  const { data, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: senhaTemp,
    email_confirm: true,
    user_metadata: { nome_completo },
  });

  if (createErr) {
    return new Response(JSON.stringify({ error: createErr.message }), { status: 400 });
  }

  // Cria o profile vinculado à academia
  const { error: profileErr } = await admin.from('profiles').insert({
    id:           data.user.id,
    academia_id:  profile.academia_id,
    role:         'aluno',
    nome_completo,
    telefone:     telefone || null,
    ativo:        true,
  });

  if (profileErr) {
    // Rollback: remove o usuário criado
    await admin.auth.admin.deleteUser(data.user.id);
    return new Response(JSON.stringify({ error: profileErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, id: data.user.id }), { status: 200 });
};
