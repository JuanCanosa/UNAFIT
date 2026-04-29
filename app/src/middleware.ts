import { defineMiddleware } from 'astro:middleware';
import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import { createSupabaseAdminClient } from '@/lib/supabase';

const SUPABASE_URL = import.meta.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY;

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
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            context.cookies.set(name, value, options);
          });
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return next();

    // Usa service role para evitar RLS race conditions no middleware
    const adminClient = createSupabaseAdminClient();

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
