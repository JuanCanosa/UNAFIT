/**
 * Integração Asaas — stub pronto para ativar quando a chave API for configurada.
 * Para ativar: adicione ASAAS_API_KEY no .env (sandbox: https://sandbox.asaas.com/api/v3)
 */

const ASAAS_API_KEY = import.meta.env.ASAAS_API_KEY ?? process.env.ASAAS_API_KEY ?? null;
const ASAAS_BASE_URL = process.env.ASAAS_ENV === 'production'
  ? 'https://api.asaas.com/v3'
  : 'https://sandbox.asaas.com/api/v3';

function isConfigured(): boolean {
  return !!ASAAS_API_KEY;
}

async function asaasRequest(method: string, path: string, body?: object) {
  if (!isConfigured()) return null;
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    method,
    headers: {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Asaas ${method} ${path}: ${err}`);
  }
  return res.json();
}

/** Cria cliente no Asaas e retorna o customerId */
export async function criarClienteAsaas(aluno: {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  endereco_cep?: string | null;
  endereco_rua?: string | null;
  endereco_numero?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
}): Promise<string | null> {
  if (!isConfigured()) return null;
  const data = await asaasRequest('POST', '/customers', {
    name: aluno.nome,
    email: aluno.email,
    cpfCnpj: aluno.cpf.replace(/\D/g, ''),
    mobilePhone: aluno.telefone.replace(/\D/g, ''),
    postalCode: aluno.endereco_cep?.replace(/\D/g, ''),
    address: aluno.endereco_rua,
    addressNumber: aluno.endereco_numero,
    province: aluno.endereco_bairro,
    city: aluno.endereco_cidade,
  });
  return data?.id ?? null;
}

/** Cria cobrança avulsa (mensalidade manual) */
export async function criarCobrancaAsaas(params: {
  customerId: string;
  valor: number;
  dataVencimento: string; // YYYY-MM-DD
  descricao: string;
}): Promise<{ id: string; invoiceUrl: string } | null> {
  if (!isConfigured()) return null;
  const data = await asaasRequest('POST', '/payments', {
    customer: params.customerId,
    billingType: 'UNDEFINED', // aceita PIX, boleto ou cartão
    value: params.valor,
    dueDate: params.dataVencimento,
    description: params.descricao,
  });
  return data ? { id: data.id, invoiceUrl: data.invoiceUrl } : null;
}

/** Cria assinatura recorrente */
export async function criarAssinaturaAsaas(params: {
  customerId: string;
  valor: number;
  vencimentoDia: number;
  descricao: string;
}): Promise<string | null> {
  if (!isConfigured()) return null;
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, '0');
  const dia = String(params.vencimentoDia).padStart(2, '0');
  const data = await asaasRequest('POST', '/subscriptions', {
    customer: params.customerId,
    billingType: 'UNDEFINED',
    value: params.valor,
    nextDueDate: `${ano}-${mes}-${dia}`,
    cycle: 'MONTHLY',
    description: params.descricao,
  });
  return data?.id ?? null;
}

/** Cancela assinatura */
export async function cancelarAssinaturaAsaas(subscriptionId: string): Promise<boolean> {
  if (!isConfigured()) return false;
  await asaasRequest('DELETE', `/subscriptions/${subscriptionId}`);
  return true;
}

export { isConfigured as asaasConfigurado };
