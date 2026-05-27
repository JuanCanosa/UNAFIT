/**
 * POST /api/asaas-sync
 * Cria clientes + assinaturas no Asaas para alunos com planos ativos
 * que ainda não têm asaas_customer_id ou asaas_subscription_id.
 * Uso exclusivo do dono da academia.
 */
import type { APIRoute } from 'astro';
import { createSupabaseServerClient, createSupabaseAdminClient } from '@/lib/supabase';
import { createAsaasClient } from '@/lib/asaas';

export const POST: APIRoute = async ({ request, cookies }) => {
  const supabase = createSupabaseServerClient(request, cookies);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ erro: 'Não autenticado' }), { status: 401 });

  const { data: profile } = await supabase
    .from('profiles').select('role, academia_id').eq('id', user.id).single();
  if (!profile || profile.role !== 'dono') {
    return new Response(JSON.stringify({ erro: 'Acesso negado' }), { status: 403 });
  }

  const admin = createSupabaseAdminClient();

  const { data: acad } = await admin
    .from('academias')
    .select('id, nome, asaas_api_key, asaas_sandbox')
    .eq('id', profile.academia_id!)
    .single();

  if (!acad?.asaas_api_key) {
    return new Response(JSON.stringify({ erro: 'Asaas não configurado.' }), { status: 400 });
  }

  const cli = createAsaasClient(acad.asaas_api_key, acad.asaas_sandbox !== false);

  // Alunos ativos com plano ativo mas sem asaas_customer_id ou sem asaas_subscription_id
  const { data: planosAtivos } = await admin
    .from('aluno_planos')
    .select(`
      id,
      asaas_subscription_id,
      planos(nome, valor, vencimento_dia),
      alunos(id, nome, email, cpf, telefone, asaas_customer_id)
    `)
    .eq('academia_id', profile.academia_id!)
    .eq('status', 'ativo');

  if (!planosAtivos?.length) {
    return new Response(JSON.stringify({ sincronizados: 0, erros: [] }), { status: 200 });
  }

  let sincronizados = 0;
  const erros: string[] = [];

  for (const ap of planosAtivos) {
    const aluno    = (ap as any).alunos;
    const plano    = (ap as any).planos;
    if (!aluno || !plano || Number(plano.valor ?? 0) === 0) continue;
    if (ap.asaas_subscription_id) continue; // já sincronizado

    try {
      let customerId = aluno.asaas_customer_id as string | undefined;

      if (!customerId) {
        const authEmail = aluno.email || `${(aluno.cpf ?? '').replace(/\D/g, '')}@aluno.unafit.com.br`;
        const cliente = await cli.buscarOuCriarCliente({
          nome: aluno.nome, email: authEmail,
          cpfCnpj: aluno.cpf, telefone: aluno.telefone,
        });
        customerId = cliente.id;
        await admin.from('alunos').update({ asaas_customer_id: customerId }).eq('id', aluno.id);
      }

      const diaVenc = plano.vencimento_dia ?? 10;
      const hoje    = new Date();
      let dataVenc  = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
      if (dataVenc <= hoje) dataVenc = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVenc);
      const dataVencStr = dataVenc.toISOString().split('T')[0];

      const sub = await cli.criarAssinatura({
        customerId: customerId!,
        valor:       Number(plano.valor),
        descricao:   `Mensalidade ${plano.nome} — ${acad.nome}`,
        nextDueDate: dataVencStr,
        externalRef: ap.id,
      });

      await admin.from('aluno_planos').update({ asaas_subscription_id: sub.id }).eq('id', ap.id);

      // Cria pagamento local com o primeiro vencimento
      const pag = await cli.buscarPrimeiroPagamento(sub.id);
      if (pag) {
        const [pix, linha] = await Promise.all([
          cli.buscarPixQrCode(pag.id),
          cli.buscarLinhaDigitavel(pag.id),
        ]);
        const mes = dataVenc.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

        const { data: existente } = await admin
          .from('pagamentos').select('id').eq('asaas_payment_id', pag.id).maybeSingle();
        if (!existente) {
          await admin.from('pagamentos').insert({
            academia_id:        profile.academia_id,
            aluno_id:           aluno.id,
            aluno_plano_id:     ap.id,
            valor:              plano.valor,
            data_vencimento:    dataVencStr,
            status:             'pendente',
            asaas_payment_id:   pag.id,
            link_pagamento:     pag.invoiceUrl ?? null,
            descricao:          `Mensalidade ${plano.nome} — ${mes}`,
            mes_referencia:     dataVencStr,
            pix_qr_code_base64: pix?.encodedImage ?? null,
            pix_copia_cola:     pix?.payload ?? null,
            boleto_url:         (pag as any).bankSlipUrl ?? null,
            boleto_linha:       linha,
          });
        }
      }

      sincronizados++;
    } catch (e: any) {
      erros.push(`${aluno.nome}: ${e?.message ?? 'erro'}`);
    }
  }

  return new Response(JSON.stringify({ sincronizados, erros }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
