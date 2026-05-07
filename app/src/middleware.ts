import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

export const onRequest = defineMiddleware(async (context, next) => {
  // Cria o cliente Supabase UMA VEZ por request usando a função centralizada
  // (que já tem os fallbacks process.env corretos)
  const supabase = createSupabaseServerClient(context.request, context.cookies);

  // getUser() aqui é o ÚNICO ponto de renovação de token de sessão
  const { data: { user } } = await supabase.auth.getUser();

  // Disponibiliza para layouts e páginas — sem novo getUser() durante streaming
  context.locals.supabase = supabase as any;
  context.locals.user     = user ?? null;

  // Verificação de onboarding apenas para donos em rotas do dashboard
  const { pathname } = new URL(context.request.url);
  const isDashboard   = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  if (isDashboard && user) {
    try {
      const adminClient = createSupabaseAdminClient();

      const { data: profile } = await adminClient
        .from('profiles')
        .select('role, academia_id')
        .eq('id', user.id)
        .single();

      if (profile?.role === 'dono' && profile.academia_id) {
        const { data: academia } = await adminClient
          .from('academias')
          .select('onboarding_completo')
          .eq('id', profile.academia_id)
          .single();

        if (academia && !academia.onboarding_completo) {
          return context.redirect('/onboarding');
        }
      }
    } catch {
      // Não bloqueia a requisição em caso de erro de admin
    }
  }

  return next();
});
