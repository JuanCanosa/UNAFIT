/**
 * Helper compartilhado para criar assinatura Asaas ao atribuir um plano a um aluno.
 * Usado em: novo.astro, [id].astro (adicionar_plano), asaas-sync.ts
 *
 * - Ignora silenciosamente se academia não tiver API key
 * - Ignora planos cortesia (valor = 0)
 * - Cria cliente Asaas se o aluno ainda não tiver asaas_customer_id
 * - Cria assinatura recorrente mensal
 * - Registra primeiro pagamento em `pagamentos`
 * - Lança erro se a criação da assinatura falhar (permite exibição ao usuário)
 */

import { createAsaasClient } from './asaas';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function criarAssinaturaAluno(
  admin: SupabaseClient,
  params: {
    academiaId: string;
    alunoId: string;
    alunoPlanoId: string;
    planoId: string;
  }
): Promise<void> {
  const { academiaId, alunoId, alunoPlanoId, planoId } = params;

  const [{ data: acad }, { data: planoData }, { data: alunoData }] = await Promise.all([
    admin.from('academias').select('asaas_api_key, asaas_sandbox, nome').eq('id', academiaId).single(),
    admin.from('planos').select('nome, valor, vencimento_dia').eq('id', planoId).single(),
    admin.from('alunos').select('nome, email, cpf, telefone, asaas_customer_id').eq('id', alunoId).single(),
  ]);

  if (!acad?.asaas_api_key) return;
  if (Number(planoData?.valor ?? 0) === 0) return;

  const cli = createAsaasClient(acad.asaas_api_key, acad.asaas_sandbox !== false);

  // Garante que o cliente existe no Asaas
  let customerId = alunoData?.asaas_customer_id as string | undefined;
  if (!customerId) {
    const authEmail = alunoData?.email || `${(alunoData?.cpf ?? '').replace(/\D/g, '')}@aluno.unafit.com.br`;
    const cliente = await cli.buscarOuCriarCliente({
      nome:     alunoData?.nome ?? '',
      email:    authEmail,
      cpfCnpj:  alunoData?.cpf,
      telefone: alunoData?.telefone,
    });
    customerId = cliente.id;
    await admin.from('alunos').update({ asaas_customer_id: customerId }).eq('id', alunoId);
  }

  // Próxima data de vencimento conforme dia configurado no plano
  const diaVenc = planoData?.vencimento_dia ?? 10;
  const hoje    = new Date();
  let dataVenc  = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc);
  if (dataVenc <= hoje) dataVenc = new Date(hoje.getFullYear(), hoje.getMonth() + 1, diaVenc);
  const dataVencStr = dataVenc.toISOString().split('T')[0];

  // Cria assinatura mensal recorrente
  const sub = await cli.criarAssinatura({
    customerId:  customerId!,
    valor:       Number(planoData!.valor),
    descricao:   `Mensalidade ${planoData!.nome} — ${acad.nome}`,
    nextDueDate: dataVencStr,
    externalRef: alunoPlanoId,
  });

  await admin.from('aluno_planos')
    .update({ asaas_subscription_id: sub.id })
    .eq('id', alunoPlanoId);

  // Registra o primeiro pagamento gerado pela assinatura
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
        academia_id:        academiaId,
        aluno_id:           alunoId,
        aluno_plano_id:     alunoPlanoId,
        valor:              planoData!.valor,
        data_vencimento:    dataVencStr,
        status:             'pendente',
        asaas_payment_id:   pag.id,
        link_pagamento:     pag.invoiceUrl ?? null,
        descricao:          `Mensalidade ${planoData!.nome} — ${mes}`,
        mes_referencia:     dataVencStr,
        pix_qr_code_base64: pix?.encodedImage ?? null,
        pix_copia_cola:     pix?.payload ?? null,
        boleto_url:         (pag as any).bankSlipUrl ?? null,
        boleto_linha:       linha,
      });
    }
  }
}
