import { defineMiddleware } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabase';

const SUPABASE_URL      = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

export const onRequest = defineMiddleware(async (context, next) => {
  // Cria o cliente Supabase UMA VEZ por request e disponibiliza via Astro.locals
  // Isso evita múltiplos getUser() / setAll() que causam o aviso de cookie
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
      },
      setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          context.cookies.set(name, value, options);
        });
      },
    },
  });

  // getUser() aqui é o ÚNICO ponto onde cookies de sessão são renovados
  const { data: { user } } = await supabase.auth.getUser();

  // Guarda no locals para reusar em layouts e páginas sem nova chamada getUser()
  context.locals.supabase = supabase as any;
  context.locals.user     = user ?? null;

  const { pathname } = new URL(context.request.url);
  const isDashboard   = pathname === '/dashboard' || pathname.startsWith('/dashboard/');

  // Verifica onboarding apenas para donos em rotas do dashboard
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
      // Não bloqueia a requisição em caso de erro
    }
  }

  return next();
});
