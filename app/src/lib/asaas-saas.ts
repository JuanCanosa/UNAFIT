/**
 * Integração Asaas — conta do UNAFIT (SaaS billing).
 * Usado para cobrar as academias pela assinatura do sistema.
 *
 * Para ativar: adicione ASAAS_SAAS_API_KEY no .env do servidor.
 * Sandbox: ASAAS_SAAS_ENV=sandbox | Produção: ASAAS_SAAS_ENV=production
 */

const ASAAS_SAAS_KEY = import.meta.env.ASAAS_SAAS_API_KEY ?? process.env.ASAAS_SAAS_API_KEY ?? null;
const ASAAS_BASE_URL = (process.env.ASAAS_SAAS_ENV ?? 'sandbox') === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

export function asaasSaasConfigurado(): boolean {
  return !!ASAAS_SAAS_KEY;
}

async function req(method: string, path: string, body?: object) {
  if (!ASAAS_SAAS_KEY) return null;
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: { 'access_token': ASAAS_SAAS_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Asaas SaaS ${method} ${path}: ${await res.text()}`);
  return res.json();
}

/** Cria o cliente da academia no Asaas do UNAFIT */
export async function criarClienteSaas(academia: {
  nome: string;
  email: string;
  cpfCnpj?: string;
}): Promise<string | null> {
  if (!ASAAS_SAAS_KEY) return null;
  const data = await req('POST', '/customers', {
    name:     academia.nome,
    email:    academia.email,
    cpfCnpj: academia.cpfCnpj?.replace(/\D/g, '') ?? undefined,
  });
  return data?.id ?? null;
}

/** Cria assinatura recorrente mensal da academia */
export async function criarAssinaturaSaas(params: {
  customerId: string;
  valor: number;
  descricao: string;
  vencimentoDia?: number;
}): Promise<string | null> {
  if (!ASAAS_SAAS_KEY) return null;
  const hoje = new Date();
  const dia  = String(params.vencimentoDia ?? 10).padStart(2, '0');
  const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
  const ano  = hoje.getFullYear();
  const data = await req('POST', '/subscriptions', {
    customer:    params.customerId,
    billingType: 'UNDEFINED',
    value:       params.valor,
    nextDueDate: `${ano}-${mes}-${dia}`,
    cycle:       'MONTHLY',
    description: params.descricao,
  });
  return data?.id ?? null;
}

/** Cria cobrança avulsa (ex: primeira mensalidade) */
export async function criarCobrancaSaas(params: {
  customerId: string;
  valor: number;
  dataVencimento: string;
  descricao: string;
}): Promise<{ id: string; invoiceUrl: string } | null> {
  if (!ASAAS_SAAS_KEY) return null;
  const data = await req('POST', '/payments', {
    customer:    params.customerId,
    billingType: 'UNDEFINED',
    value:       params.valor,
    dueDate:     params.dataVencimento,
    description: params.descricao,
  });
  return data ? { id: data.id, invoiceUrl: data.invoiceUrl } : null;
}

/** Cancela assinatura */
export async function cancelarAssinaturaSaas(subscriptionId: string): Promise<boolean> {
  if (!ASAAS_SAAS_KEY) return false;
  await req('DELETE', `/subscriptions/${subscriptionId}`);
  return true;
}
