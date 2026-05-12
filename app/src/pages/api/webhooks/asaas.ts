/**
 * POST /api/webhooks/asaas
 * Recebe eventos de pagamento do Asaas.
 * Configure a URL https://unafit.com.br/api/webhooks/asaas no painel Asaas → Configurações → Webhooks
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { event, payment } = body ?? {};
  if (!event || !payment?.id) {
    return new Response('OK', { status: 200 }); // ignora eventos sem payment
  }

  const admin = createSupabaseAdminClient();

  // Localiza a fatura pelo asaas_payment_id
  const { data: fatura } = await admin
    .from('saas_faturas')
    .select('id, academia_id, saas_assinatura_id, status')
    .eq('asaas_payment_id', payment.id)
    .maybeSingle();

  if (!fatura) {
    return new Response('OK', { status: 200 }); // não é nossa fatura
  }

  // ── Mapeamento de eventos ──────────────────────────────────────────────────
  switch (event) {

    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED_IN_CASH': {
      // Marca fatura como paga
      await admin.from('saas_faturas').update({
        status:            'pago',
        pago_em:           payment.paymentDate ?? new Date().toISOString().split('T')[0],
        metodo_pagamento:  payment.billingType ?? null,
      }).eq('id', fatura.id);

      // Mantém (ou reativa) a assinatura
      if (fatura.saas_assinatura_id) {
        await admin.from('saas_assinaturas')
          .update({ status: 'ativa' })
          .eq('id', fatura.saas_assinatura_id);
      }
      break;
    }

    case 'PAYMENT_OVERDUE': {
      await admin.from('saas_faturas').update({ status: 'vencido' }).eq('id', fatura.id);
      // Suspende a assinatura após vencimento
      if (fatura.saas_assinatura_id) {
        await admin.from('saas_assinaturas')
          .update({ status: 'suspensa' })
          .eq('id', fatura.saas_assinatura_id);
      }
      break;
    }

    case 'PAYMENT_DELETED':
    case 'PAYMENT_CANCELLED': {
      await admin.from('saas_faturas').update({ status: 'cancelado' }).eq('id', fatura.id);
      break;
    }

    case 'PAYMENT_REFUNDED': {
      await admin.from('saas_faturas').update({ status: 'cancelado' }).eq('id', fatura.id);
      break;
    }
  }

  return new Response('OK', { status: 200 });
};

// Asaas envia GET como teste de conectividade
export const GET: APIRoute = () => new Response('UNAFIT Asaas Webhook OK', { status: 200 });
