/**
 * POST /api/saas/gerar-cobranca
 * Gera cobrança Asaas para uma saas_fatura e salva os dados de pagamento.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';
import { buscarOuCriarCliente, gerarCobrancaCompleta } from '@/lib/asaas';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ erro: 'Não autorizado' }), { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'saas_admin') {
    return new Response(JSON.stringify({ erro: 'Acesso negado' }), { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { fatura_id } = body;
  if (!fatura_id) return new Response(JSON.stringify({ erro: 'fatura_id obrigatório' }), { status: 400 });

  const admin = createSupabaseAdminClient();

  // Busca fatura + dados da academia
  const { data: fatura } = await admin
    .from('saas_faturas')
    .select('id, academia_id, descricao, valor, data_vencimento, asaas_payment_id')
    .eq('id', fatura_id)
    .single();

  if (!fatura) return new Response(JSON.stringify({ erro: 'Fatura não encontrada' }), { status: 404 });
  if (fatura.asaas_payment_id) {
    return new Response(JSON.stringify({ erro: 'Cobrança já gerada para esta fatura' }), { status: 409 });
  }

  const { data: academia } = await admin
    .from('academias')
    .select('id, nome, email, responsavel_cpf_cnpj, telefone, asaas_customer_id')
    .eq('id', fatura.academia_id)
    .single();

  if (!academia?.email) {
    return new Response(JSON.stringify({ erro: 'Academia sem e-mail cadastrado' }), { status: 422 });
  }

  try {
    // 1. Garante cliente no Asaas
    let customerId = academia.asaas_customer_id;
    if (!customerId) {
      const cliente = await buscarOuCriarCliente({
        nome:     academia.nome,
        email:    academia.email,
        cpfCnpj:  academia.responsavel_cpf_cnpj,
        telefone: academia.telefone,
      });
      customerId = cliente.id;
      await admin.from('academias').update({ asaas_customer_id: customerId }).eq('id', academia.id);
    }

    // 2. Gera cobrança completa (PIX + Boleto + Cartão via invoiceUrl)
    const cobranca = await gerarCobrancaCompleta({
      customerId,
      valor:       Number(fatura.valor),
      descricao:   fatura.descricao,
      vencimento:  fatura.data_vencimento,
      externalRef: fatura.id,
    });

    // 3. Salva na fatura
    await admin.from('saas_faturas').update({
      asaas_payment_id: cobranca.paymentId,
      invoice_url:      cobranca.invoiceUrl,
      boleto_url:       cobranca.boletoUrl,
      boleto_linha:     cobranca.boletoCodigo,
      pix_qr_code_base64: cobranca.pixQrCodeBase64,
      pix_copia_cola:   cobranca.pixCopiaCola,
      status:           'pendente',
    }).eq('id', fatura.id);

    return new Response(JSON.stringify({ ok: true, ...cobranca }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e: any) {
    return new Response(JSON.stringify({ erro: e.message }), { status: 500 });
  }
};
