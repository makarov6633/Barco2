const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

interface AsaasCustomer {
  id: string;
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

interface AsaasPayment {
  id: string;
  customer: string;
  billingType: 'BOLETO' | 'PIX' | 'CREDIT_CARD';
  value: number;
  dueDate: string;
  description?: string;
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  invoiceUrl?: string;
  bankSlipUrl?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
}

async function asaasRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  const response = await fetch(`${ASAAS_API_URL}${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Erro Asaas:', data);
    throw new Error(data.errors?.[0]?.description || 'Erro na API Asaas');
  }

  return data;
}

export async function findOrCreateCustomer(data: {
  name: string;
  cpfCnpj: string;
  email?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const cpfLimpo = data.cpfCnpj.replace(/\D/g, '');

  try {
    const searchResponse = await asaasRequest(`/customers?cpfCnpj=${cpfLimpo}`);
    if (searchResponse.data && searchResponse.data.length > 0) {
      return searchResponse.data[0];
    }
  } catch (error) {
    console.log('Cliente não encontrado, criando novo...');
  }

  const newCustomer = await asaasRequest('/customers', 'POST', {
    name: data.name,
    cpfCnpj: cpfLimpo,
    email: data.email,
    mobilePhone: data.phone?.replace(/\D/g, '')
  });

  return newCustomer;
}

export async function createPixPayment(data: {
  customerId: string;
  value: number;
  description: string;
  dueDate?: string;
  externalReference?: string;
}): Promise<{
  paymentId: string;
  pixQrCodeUrl: string;
  pixCopiaECola: string;
  value: number;
  dueDate: string;
}> {
  const dueDate = data.dueDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payment = await asaasRequest('/payments', 'POST', {
    customer: data.customerId,
    billingType: 'PIX',
    value: data.value,
    dueDate,
    description: data.description,
    externalReference: data.externalReference
  });

  const pixInfo = await asaasRequest(`/payments/${payment.id}/pixQrCode`);

  return {
    paymentId: payment.id,
    pixQrCodeUrl: pixInfo.encodedImage ? `data:image/png;base64,${pixInfo.encodedImage}` : '',
    pixCopiaECola: pixInfo.payload || '',
    value: payment.value,
    dueDate: payment.dueDate
  };
}

export async function createBoletoPayment(data: {
  customerId: string;
  value: number;
  description: string;
  dueDate?: string;
  externalReference?: string;
}): Promise<{
  paymentId: string;
  boletoUrl: string;
  barCode: string;
  value: number;
  dueDate: string;
}> {
  const dueDate = data.dueDate || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const payment = await asaasRequest('/payments', 'POST', {
    customer: data.customerId,
    billingType: 'BOLETO',
    value: data.value,
    dueDate,
    description: data.description,
    externalReference: data.externalReference
  });

  return {
    paymentId: payment.id,
    boletoUrl: payment.bankSlipUrl || '',
    barCode: payment.nossoNumero || '',
    value: payment.value,
    dueDate: payment.dueDate
  };
}

export async function getPaymentStatus(paymentId: string): Promise<{
  status: string;
  value: number;
  confirmedDate?: string;
}> {
  const payment = await asaasRequest(`/payments/${paymentId}`);

  return {
    status: payment.status,
    value: payment.value,
    confirmedDate: payment.confirmedDate
  };
}

export async function processWebhookPayment(payload: any): Promise<{
  event: string;
  paymentId: string;
  status: string;
  value: number;
  externalReference?: string;
  customerName?: string;
  confirmedDate?: string;
}> {
  const { event, payment } = payload;

  return {
    event,
    paymentId: payment?.id,
    status: payment?.status,
    value: payment?.value,
    externalReference: payment?.externalReference,
    customerName: payment?.customer?.name,
    confirmedDate: payment?.confirmedDate
  };
}

export function isPaymentConfirmed(status: string): boolean {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status);
}

export function formatPixMessage(data: {
  pixCopiaECola: string;
  value: number;
  passeioNome: string;
  clienteNome: string;
}): string {
  return `💳 *PAGAMENTO VIA PIX*

Olá ${data.clienteNome.split(' ')[0]}! 😊

Para confirmar sua reserva no *${data.passeioNome}*, faça o PIX:

💰 *Valor:* R$ ${data.value.toFixed(2)}

📋 *Copia e Cola:*
\`\`\`
${data.pixCopiaECola}
\`\`\`

⏰ O código é válido por 24 horas.

Assim que identificarmos o pagamento, você receberá seu voucher automaticamente! ✅

_Caleb's Tour - CNPJ 26.096.072/0001-78_`;
}

export function formatBoletoMessage(data: {
  boletoUrl: string;
  barCode: string;
  value: number;
  dueDate: string;
  passeioNome: string;
  clienteNome: string;
}): string {
  return `💳 *PAGAMENTO VIA BOLETO*

Olá ${data.clienteNome.split(' ')[0]}! 😊

Para confirmar sua reserva no *${data.passeioNome}*:

💰 *Valor:* R$ ${data.value.toFixed(2)}
📅 *Vencimento:* ${data.dueDate}

🔗 *Link do Boleto:*
${data.boletoUrl}

Assim que identificarmos o pagamento, você receberá seu voucher automaticamente! ✅

_Caleb's Tour - CNPJ 26.096.072/0001-78_`;
}
