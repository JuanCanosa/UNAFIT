/**
 * POST /api/webhooks/asaas
 * Recebe eventos de pagamento do Asaas.
 * Configure a URL https://unafit.com.br/api/webhooks/asaas no painel Asaas → Configurações → Webhooks
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { buscarPixQrCode, buscarLinhaDigitavel } from '@/lib/asaas';

export const POST: APIRoute = async ({ request }) => {
  // Valida token de autenticação do Asaas
  const WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN ?? '';
  if (WEBHOOK_TOKEN) {
    const receivedToken = request.headers.get('asaas-access-token') ?? '';
    if (receivedToken !== WEBHOOK_TOKEN) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { event, payment } = body ?? {};
  if (!event || !payment?.id) {
    return new Response('OK', { status: 200 });
  }

  const admin = createSupabaseAdminClient();

  // ── PAYMENT_CREATED: novo ciclo mensal gerado pela assinatura recorrente ────
  // Precisa ser tratado ANTES do lookup de fatura, pois ainda não existe no DB.
  if (event === 'PAYMENT_CREATED' && payment.subscription) {
    // Idempotência: ignora se já existe fatura para este payment
    const { data: existente } = await admin
      .from('saas_faturas')
      .select('id')
      .eq('asaas_payment_id', payment.id)
      .maybeSingle();

    if (!existente) {
      // Localiza a assinatura pelo ID da subscription Asaas
      const { data: assinatura } = await admin
        .from('saas_assinaturas')
        .select('id, academia_id, saas_planos(nome)')
        .eq('asaas_subscription_id', payment.subscription)
        .maybeSingle();

      if (assinatura) {
        const mes = new Date((payment.dueDate ?? payment.originalDueDate) + 'T12:00:00')
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const { data: novaFatura } = await admin
          .from('saas_faturas')
          .insert({
            academia_id:        assinatura.academia_id,
            saas_assinatura_id: assinatura.id,
            descricao:          `Mensalidade ${(assinatura as any).saas_planos?.nome ?? 'Assinatura'} — ${mes}`,
            valor:              payment.value,
            data_vencimento:    payment.dueDate ?? payment.originalDueDate,
            status:             'pendente',
            asaas_payment_id:   payment.id,
            invoice_url:        payment.invoiceUrl ?? null,
          })
          .select('id')
          .single();

        // Busca PIX e boleto em paralelo
        if (novaFatura?.id) {
          try {
            const [pix, linha] = await Promise.all([
              buscarPixQrCode(payment.id),
              buscarLinhaDigitavel(payment.id),
            ]);
            await admin.from('saas_faturas').update({
              pix_qr_code_base64: pix?.encodedImage ?? null,
              pix_copia_cola:     pix?.payload ?? null,
              boleto_url:         payment.bankSlipUrl ?? null,
              boleto_linha:       linha,
            }).eq('id', novaFatura.id);
          } catch (_) {}
        }
      }
    }

    return new Response('OK', { status: 200 });
  }

  // ── Para todos os outros eventos: localiza a fatura existente ────────────────
  const { data: fatura } = await admin
    .from('saas_faturas')
    .select('id, academia_id, saas_assinatura_id, status')
    .eq('asaas_payment_id', payment.id)
    .maybeSingle();

  if (!fatura) {
    return new Response('OK', { status: 200 }); // não é nossa fatura
  }

  switch (event) {

    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED_IN_CASH': {
      await admin.from('saas_faturas').update({
        status:           'pago',
        pago_em:          payment.paymentDate ?? new Date().toISOString().split('T')[0],
        metodo_pagamento: payment.billingType ?? null,
      }).eq('id', fatura.id);

      // Reativa assinatura caso estivesse suspensa
      if (fatura.saas_assinatura_id) {
        await admin.from('saas_assinaturas')
          .update({ status: 'ativa' })
          .eq('id', fatura.saas_assinatura_id);
      }
      break;
    }

    case 'PAYMENT_OVERDUE': {
      await admin.from('saas_faturas').update({ status: 'vencido' }).eq('id', fatura.id);
      if (fatura.saas_assinatura_id) {
        await admin.from('saas_assinaturas')
          .update({ status: 'suspensa' })
          .eq('id', fatura.saas_assinatura_id);
      }
      break;
    }

    case 'PAYMENT_DELETED':
    case 'PAYMENT_CANCELLED':
    case 'PAYMENT_REFUNDED': {
      await admin.from('saas_faturas').update({ status: 'cancelado' }).eq('id', fatura.id);
      break;
    }
  }

  return new Response('OK', { status: 200 });
};

// Asaas envia GET como teste de conectividade
export const GET: APIRoute = () => new Response('UNAFIT Asaas Webhook OK', { status: 200 });
