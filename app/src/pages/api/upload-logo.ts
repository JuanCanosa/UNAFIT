import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request, cookies }) => {
  const json = (body: object, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  try {
    const supabase = createSupabaseServerClient(request, cookies);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Não autorizado.' }, 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'saas_admin') return json({ error: 'Acesso negado.' }, 403);

    const form = await request.formData();
    const file = form.get('logo') as File | null;
    const academiaId = (form.get('academia_id') as string)?.trim();

    if (!file || file.size === 0) return json({ error: 'Nenhuma imagem enviada.' }, 400);
    if (!academiaId) return json({ error: 'ID da academia não informado.' }, 400);

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return json({ error: 'Use PNG, JPG ou WebP.' }, 400);
    if (file.size > 2 * 1024 * 1024) return json({ error: 'Máximo 2 MB.' }, 400);

    const adminClient = createSupabaseAdminClient();
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${academiaId}/logo.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { data: uploadData, error: uploadErr } = await adminClient.storage
      .from('academia-logos')
      .upload(path, bytes, { contentType: file.type, upsert: true });

    if (uploadErr) return json({ error: uploadErr.message }, 500);

    const { data: { publicUrl } } = adminClient.storage
      .from('academia-logos')
      .getPublicUrl(uploadData.path);

    const urlFinal = `${publicUrl}?t=${Date.now()}`;
    await adminClient.from('academias').update({ logo_url: urlFinal }).eq('id', academiaId);

    return json({ url: urlFinal });
  } catch (e: any) {
    return json({ error: e?.message ?? 'Erro interno.' }, 500);
  }
};
