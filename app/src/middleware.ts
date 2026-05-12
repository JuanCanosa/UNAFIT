import { defineMiddleware } from 'astro:middleware';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';

// Rotas que donos/colaboradores podem acessar mesmo com assinatura suspensa
const ROTAS_LIBERADAS = ['/assinatura-pendente', '/logout', '/conta-desativada'];

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createSupabaseServerClient(context.request, context.cookies);
  const { data: { user } } = await supabase.auth.getUser();

  context.locals.supabase = supabase as any;
  context.locals.user     = user ?? null;

  const { pathname } = new URL(context.request.url);
  const isDashboard   = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const isRotaLiberada = ROTAS_LIBERADAS.some(r => pathname.startsWith(r));

  if (isDashboard && user && !isRotaLiberada) {
    try {
      const adminClient = createSupabaseAdminClient();

      const { data: profile } = await adminClient
        .from('profiles')
        .select('role, academia_id')
        .eq('id', user.id)
        .single();

      if (!profile) return next();

      // ── Onboarding (dono sem setup completo) ────────────────────────────────
      if (profile.role === 'dono' && profile.academia_id) {
        const { data: academia } = await adminClient
          .from('academias')
          .select('onboarding_completo')
          .eq('id', profile.academia_id)
          .single();

        if (academia && !academia.onboarding_completo) {
          return context.redirect('/onboarding');
        }
      }

      // ── Bloqueio por assinatura SaaS suspensa/cancelada ou fatura vencida ────
      if ((profile.role === 'dono' || profile.role === 'colaborador') && profile.academia_id) {
        const { data: assinatura } = await adminClient
          .from('saas_assinaturas')
          .select('id, status, saas_planos(valor)')
          .eq('academia_id', profile.academia_id)
          .maybeSingle();

        // Plano cortesia (valor = 0): nunca bloqueia, nunca verifica faturas
        const isCourtesy = Number((assinatura as any)?.saas_planos?.valor ?? 0) === 0;

        if (!isCourtesy) {
          if (assinatura?.status === 'suspensa' || assinatura?.status === 'cancelada') {
            return context.redirect('/assinatura-pendente');
          }

          // Carência de 10 dias: bloqueia se há fatura pendente/vencida com
          // data_vencimento < (hoje - 10 dias)
          if (assinatura && (assinatura.status === 'ativa' || assinatura.status === 'trial')) {
            const carencia = new Date();
            carencia.setDate(carencia.getDate() - 10);
            const carenciaStr = carencia.toISOString().split('T')[0];

            const { data: faturaAtraso } = await adminClient
              .from('saas_faturas')
              .select('id')
              .eq('academia_id', profile.academia_id)
              .in('status', ['pendente', 'vencido'])
              .lt('data_vencimento', carenciaStr)
              .limit(1)
              .maybeSingle();

            if (faturaAtraso) {
              // Suspende automaticamente após carência
              await adminClient.from('saas_assinaturas')
                .update({ status: 'suspensa' }).eq('id', assinatura.id);
              return context.redirect('/assinatura-pendente');
            }
          }
        }
      }

    } catch {
      // Não bloqueia em caso de erro
    }
  }

  return next();
});
