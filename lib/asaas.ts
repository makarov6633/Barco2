import { Cliente } from './supabase';

const ASAAS_API_URL = 'https://www.asaas.com/api/v3';

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  mobilePhone?: string;
  phone?: string;
}

export interface AsaasPayment {
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  description: string;
  billingType: 'BOLETO' | 'CREDIT_CARD' | 'PIX' | 'UNDEFINED';
  status: 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'RECEIVED_IN_CASH' | 'REFUND_REQUESTED' | 'CHARGEBACK_REQUESTED' | 'CHARGEBACK_DISPUTE' | 'AWAITING_CHARGEBACK_REVERSAL' | 'DUNNING_REQUESTED' | 'DUNNING_RECEIVED' | 'AWAITING_RISK_ANALYSIS';
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
}

async function fetchAsaas(endpoint: string, options: RequestInit = {}) {
  const url = `${ASAAS_API_URL}${endpoint}`;
  const apiKey = process.env.ASAAS_API_KEY;
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY environment variable is missing or empty.');
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': apiKey,
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Asaas API Error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  return response.json();
}

/**
 * Creates or retrieves a customer in Asaas
 */
export async function createAsaasCustomer(cliente: Cliente): Promise<AsaasCustomer> {
  // First search if exists (by CPF or Email)
  // Note: Asaas allows searching by cpfCnpj or email
  let searchParams = '';
  if (cliente.cpf) searchParams = `cpfCnpj=${cliente.cpf}`;
  else if (cliente.email) searchParams = `email=${cliente.email}`;

  if (searchParams) {
    const searchResult = await fetchAsaas(`/customers?${searchParams}`);
    if (searchResult.data && searchResult.data.length > 0) {
      return searchResult.data[0];
    }
  }

  // If not found, create
  const payload = {
    name: cliente.nome,
    email: cliente.email || `cliente_${cliente.telefone}@temp.com`, // Email is often required
    cpfCnpj: cliente.cpf,
    mobilePhone: cliente.telefone,
    externalReference: cliente.id
  };

  const newCustomer = await fetchAsaas('/customers', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  return newCustomer;
}

/**
 * Retrieves a customer by ID
 */
export async function getCustomer(customerId: string): Promise<AsaasCustomer> {
  return fetchAsaas(`/customers/${customerId}`);
}

/**
 * Creates a Pix payment charge
 */
export async function createPixCharge(
  asaasCustomerId: string, 
  value: number, 
  dueDate: string, 
  description: string,
  externalReference?: string
): Promise<AsaasPayment> {
  const payload = {
    customer: asaasCustomerId,
    billingType: 'PIX',
    value,
    dueDate,
    description,
    externalReference
  };

  return fetchAsaas('/payments', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

/**
 * Gets the Pix QR Code and Payload for a payment
 */
export async function getPixQrCode(paymentId: string): Promise<{ encodedImage: string, payload: string, expirationDate: string }> {
  return fetchAsaas(`/payments/${paymentId}/pixQrCode`);
}

/**
 * Retrieves a payment by ID
 */
export async function getPayment(paymentId: string): Promise<AsaasPayment> {
  return fetchAsaas(`/payments/${paymentId}`);
}
