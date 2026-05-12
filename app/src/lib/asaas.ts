/**
 * Cliente Asaas — integração com a API de pagamentos brasileira.
 * Sandbox: https://sandbox.asaas.com/api/v3
 * Produção: https://api.asaas.com/api/v3
 *
 * .env: ASAAS_API_KEY=sua_chave   ASAAS_SANDBOX=true
 */

// Usar process.env em SSR Node.js — seguro e sem dependência de import.meta.env
const API_KEY  = process.env.ASAAS_API_KEY  ?? '';
const SANDBOX  = (process.env.ASAAS_SANDBOX ?? 'true') !== 'false';
const BASE_URL = SANDBOX
  ? 'https://sandbox.asaas.com/api/v3'
  : 'https://api.asaas.com/api/v3';

// ── Request helper ────────────────────────────────────────────────────────────

async function req<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: object,
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'access_token': API_KEY,
      'Content-Type': 'application/json',
      'User-Agent': 'UNAFIT/1.0',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any).errors?.[0]?.description ?? `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return json as T;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type BillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
export type PaymentStatus =
  | 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE'
  | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'CANCELLED';

export interface AsaasCustomer { id: string; name: string; email: string; }
export interface AsaasPayment  {
  id: string; status: PaymentStatus; value: number;
  dueDate: string; invoiceUrl: string; bankSlipUrl?: string;
  billingType: BillingType;
}
export interface PixQrCode {
  encodedImage: string;   // base64 PNG
  payload: string;        // copia e cola
  expirationDate: string;
}

// ── Clientes ──────────────────────────────────────────────────────────────────

/** Busca cliente pelo e-mail ou cria novo. */
export async function buscarOuCriarCliente(params: {
  nome: string; email: string; cpfCnpj?: string | null; telefone?: string | null;
}): Promise<AsaasCustomer> {
  const lista = await req<{ data: AsaasCustomer[] }>(
    'GET', `/customers?email=${encodeURIComponent(params.email)}&limit=1`
  );
  if (lista.data?.length > 0) return lista.data[0]!;
  return req<AsaasCustomer>('POST', '/customers', {
    name:     params.nome,
    email:    params.email,
    cpfCnpj:  params.cpfCnpj?.replace(/\D/g, '') || undefined,
    phone:    params.telefone?.replace(/\D/g, '') || undefined,
    notificationDisabled: false,
  });
}

// ── Cobranças ─────────────────────────────────────────────────────────────────

export async function criarCobranca(params: {
  customerId: string; valor: number; descricao: string;
  vencimento: string; externalRef?: string; billingType?: BillingType;
}): Promise<AsaasPayment> {
  return req<AsaasPayment>('POST', '/payments', {
    customer:          params.customerId,
    billingType:       params.billingType ?? 'UNDEFINED',
    value:             params.valor,
    dueDate:           params.vencimento,
    description:       params.descricao,
    externalReference: params.externalRef,
    postalService:     false,
  });
}

export async function buscarPixQrCode(paymentId: string): Promise<PixQrCode | null> {
  try { return await req<PixQrCode>('GET', `/payments/${paymentId}/pixQrCode`); }
  catch { return null; }
}

export async function buscarLinhaDigitavel(paymentId: string): Promise<string | null> {
  try {
    const d = await req<{ identificationField: string }>('GET', `/payments/${paymentId}/identificationField`);
    return d.identificationField ?? null;
  } catch { return null; }
}

export async function consultarPagamento(paymentId: string): Promise<AsaasPayment> {
  return req<AsaasPayment>('GET', `/payments/${paymentId}`);
}

export async function cancelarPagamento(paymentId: string): Promise<void> {
  await req('DELETE', `/payments/${paymentId}`);
}

/**
 * Gera cobrança completa: UNDEFINED (cliente escolhe método no checkout)
 * + busca PIX QR Code automaticamente.
 */
export async function gerarCobrancaCompleta(params: {
  customerId: string; valor: number; descricao: string;
  vencimento: string; externalRef: string;
}) {
  const pag = await criarCobranca({ ...params, billingType: 'UNDEFINED' });
  const pix = await buscarPixQrCode(pag.id);
  const linha = pag.billingType !== 'PIX' ? await buscarLinhaDigitavel(pag.id) : null;

  return {
    paymentId:       pag.id,
    status:          pag.status,
    invoiceUrl:      pag.invoiceUrl,       // link universal (PIX + Boleto + Cartão)
    boletoUrl:       pag.bankSlipUrl ?? null,
    boletoCodigo:    linha,
    pixQrCodeBase64: pix?.encodedImage ?? null,
    pixCopiaCola:    pix?.payload ?? null,
  };
}
