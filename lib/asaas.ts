const ASAAS_API_URL = 'https://api.asaas.com/v3';

function getAsaasApiKey(): string {
  const key = process.env.ASAAS_API_KEY;
  if (!key) throw new Error('ASAAS_API_KEY não configurada');
  return key;
}

async function asaasRequest(endpoint: string, options: RequestInit = {}) {
  const apiKey = getAsaasApiKey();
  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'access_token': apiKey, ...options.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Asaas API Error:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro na API Asaas');
  }
  return data;
}

export interface AsaasCustomer { id: string; name: string; cpfCnpj?: string; email?: string; phone?: string; }
export interface AsaasPayment { id: string; customer: string; value: number; billingType: string; status: string; dueDate: string; bankSlipUrl?: string; }
export interface AsaasPixQrCode { encodedImage: string; payload: string; expirationDate: string; }

export async function findOrCreateCustomer(params: { name: string; cpfCnpj?: string; email?: string; phone?: string; }): Promise<AsaasCustomer> {
  if (params.cpfCnpj) {
    const cleanCpf = params.cpfCnpj.replace(/\D/g, '');
    const existing = await asaasRequest(`/customers?cpfCnpj=${cleanCpf}`);
    if (existing.data?.length > 0) return existing.data[0];
  }
  return asaasRequest('/customers', {
    method: 'POST',
    body: JSON.stringify({ name: params.name, cpfCnpj: params.cpfCnpj?.replace(/\D/g, ''), email: params.email, mobilePhone: params.phone?.replace(/\D/g, '') }),
  });
}

export async function createPixPayment(params: { customerId: string; value: number; description: string; externalReference?: string; }): Promise<{ payment: AsaasPayment; pixQrCode: AsaasPixQrCode }> {
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const payment = await asaasRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({ customer: params.customerId, billingType: 'PIX', value: params.value, dueDate, description: params.description, externalReference: params.externalReference }),
  });
  const pixQrCode = await asaasRequest(`/payments/${payment.id}/pixQrCode`);
  return { payment, pixQrCode };
}

export async function createBoletoPayment(params: { customerId: string; value: number; description: string; externalReference?: string; }): Promise<AsaasPayment> {
  const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return asaasRequest('/payments', {
    method: 'POST',
    body: JSON.stringify({ customer: params.customerId, billingType: 'BOLETO', value: params.value, dueDate, description: params.description, externalReference: params.externalReference }),
  });
}

export function formatPixMessage(pixQrCode: AsaasPixQrCode, valor: number): string {
  return `💳 *PAGAMENTO VIA PIX*\n\n💰 Valor: R$ ${valor.toFixed(2)}\n\n📱 *Copie o código abaixo:*\n\`\`\`\n${pixQrCode.payload}\n\`\`\`\n\n⏰ Válido até: ${new Date(pixQrCode.expirationDate).toLocaleString('pt-BR')}\n\n✅ Após o pagamento, você receberá seu voucher automaticamente!\n\n📞 Dúvidas: (22) 99824-9911`;
}

export function formatBoletoMessage(payment: AsaasPayment, valor: number): string {
  return `💳 *PAGAMENTO VIA BOLETO*\n\n💰 Valor: R$ ${valor.toFixed(2)}\n\n🔗 *Link do boleto:*\n${payment.bankSlipUrl}\n\n📅 Vencimento: ${new Date(payment.dueDate).toLocaleDateString('pt-BR')}\n\n✅ Após o pagamento, você receberá seu voucher automaticamente.\n\n📞 Dúvidas: (22) 99824-9911`;
}
