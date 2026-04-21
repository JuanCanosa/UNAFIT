import { defineMiddleware } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = new URL(context.request.url);

  // Só intervém em rotas do dashboard (não em /onboarding, /login, etc.)
  const isDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  if (!isDashboard) return next();

  // Não redireciona se já estiver em /onboarding (evita loop)
  if (pathname === '/dashboard/onboarding') return next();

  try {
    const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return parseCookieHeader(context.request.headers.get('Cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            context.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return next();

    // Usa service role para evitar RLS race conditions no middleware
    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: profile } = await adminClient
      .from('profiles')
      .select('role, academia_id')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'dono') return next();

    const { data: academia } = await adminClient
      .from('academias')
      .select('onboarding_completo')
      .eq('id', profile.academia_id)
      .single();

    if (academia && !academia.onboarding_completo) {
      return context.redirect('/onboarding');
    }
  } catch {
    // Não bloqueia a requisição em caso de erro
  }

  return next();
});
