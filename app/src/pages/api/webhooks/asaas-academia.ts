/**
 * POST /api/webhooks/asaas-academia
 * Recebe eventos Asaas das contas próprias das academias.
 * Configure no painel Asaas de cada academia: Configurações → Webhooks
 * URL: https://unafit.com.br/api/webhooks/asaas-academia
 *
 * O externalReference dos pagamentos deve ser o aluno_plano_id.
 */
import type { APIRoute } from 'astro';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { createAsaasClient } from '@/lib/asaas';
import { enviarEmailPagamentoRecebido } from '@/lib/email';

export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try { body = await request.json(); } catch { return new Response('Bad JSON', { status: 400 }); }

  const { event, payment } = body ?? {};
  if (!event || !payment?.id) return new Response('OK', { status: 200 });

  const admin = createSupabaseAdminClient();

  // ── PAYMENT_CREATED: novo ciclo mensal da assinatura do aluno ────────────────
  if (event === 'PAYMENT_CREATED' && payment.subscription) {
    const { data: existente } = await admin
      .from('pagamentos').select('id').eq('asaas_payment_id', payment.id).maybeSingle();

    if (!existente) {
      // Localiza aluno_plano pelo asaas_subscription_id
      const { data: alunoPlan } = await admin
        .from('aluno_planos')
        .select('id, academia_id, aluno_id, planos(nome, valor)')
        .eq('asaas_subscription_id', payment.subscription)
        .maybeSingle();

      if (alunoPlan) {
        const { data: acad } = await admin
          .from('academias').select('asaas_api_key, asaas_sandbox').eq('id', alunoPlan.academia_id).single();

        const dataVenc = payment.dueDate ?? payment.originalDueDate;
        const mes = new Date(dataVenc + 'T12:00:00')
          .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        const nomePlano = (alunoPlan as any).planos?.nome ?? 'Mensalidade';

        const { data: novo } = await admin.from('pagamentos').insert({
          academia_id:      alunoPlan.academia_id,
          aluno_id:         alunoPlan.aluno_id,
          aluno_plano_id:   alunoPlan.id,
          valor:            payment.value ?? (alunoPlan as any).planos?.valor,
          data_vencimento:  dataVenc,
          status:           'pendente',
          asaas_payment_id: payment.id,
          link_pagamento:   payment.invoiceUrl ?? null,
          descricao:        `Mensalidade ${nomePlano} — ${mes}`,
          mes_referencia:   dataVenc,
        }).select('id').single();

        // Busca PIX e boleto em paralelo
        if (novo?.id && acad?.asaas_api_key) {
          try {
            const cli = createAsaasClient(acad.asaas_api_key, acad.asaas_sandbox !== false);
            const [pix, linha] = await Promise.all([
              cli.buscarPixQrCode(payment.id),
              cli.buscarLinhaDigitavel(payment.id),
            ]);
            await admin.from('pagamentos').update({
              pix_qr_code_base64: pix?.encodedImage ?? null,
              pix_copia_cola:     pix?.payload ?? null,
              boleto_url:         payment.bankSlipUrl ?? null,
              boleto_linha:       linha,
            }).eq('id', novo.id);
          } catch (_) {}
        }
      }
    }
    return new Response('OK', { status: 200 });
  }

  // ── Outros eventos: localiza pagamento existente ──────────────────────────────
  const { data: pag } = await admin
    .from('pagamentos').select('id, aluno_plano_id').eq('asaas_payment_id', payment.id).maybeSingle();

  if (!pag) return new Response('OK', { status: 200 });

  switch (event) {
    case 'PAYMENT_RECEIVED':
    case 'PAYMENT_CONFIRMED':
    case 'PAYMENT_RECEIVED_IN_CASH': {
      const dataPag = payment.paymentDate ?? new Date().toISOString().split('T')[0];
      await admin.from('pagamentos').update({ status: 'pago', data_pagamento: dataPag }).eq('id', pag.id);

      // Notifica o dono por e-mail
      try {
        const { data: pagFull } = await admin
          .from('pagamentos')
          .select('valor, descricao, aluno_id, academia_id')
          .eq('id', pag.id).single();
        if (pagFull) {
          const [{ data: aluno }, { data: acad }, { data: donoPerfil }] = await Promise.all([
            admin.from('alunos').select('nome').eq('id', pagFull.aluno_id).single(),
            admin.from('academias').select('nome, email, logo_url').eq('id', pagFull.academia_id).single(),
            admin.from('profiles').select('nome_completo').eq('academia_id', pagFull.academia_id).eq('role', 'dono').limit(1).single(),
          ]);
          if (acad?.email) {
            await enviarEmailPagamentoRecebido({
              emailDono:     acad.email,
              nomeAcademia:  acad.nome,
              logoUrl:       acad.logo_url ?? null,
              nomeAluno:     aluno?.nome ?? 'Aluno',
              descricao:     pagFull.descricao ?? 'Mensalidade',
              valor:         Number(pagFull.valor),
              dataPagamento: dataPag,
            });
          }
        }
      } catch (_) {}
      break;
    }

    case 'PAYMENT_OVERDUE':
      await admin.from('pagamentos').update({ status: 'vencido' }).eq('id', pag.id);
      break;

    case 'PAYMENT_DELETED':
    case 'PAYMENT_CANCELLED':
    case 'PAYMENT_REFUNDED':
      await admin.from('pagamentos').update({ status: 'cancelado' }).eq('id', pag.id);
      break;
  }

  return new Response('OK', { status: 200 });
};

export const GET: APIRoute = () => new Response('UNAFIT Academia Webhook OK', { status: 200 });
