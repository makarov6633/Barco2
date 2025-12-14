type AsaasEnvironment = 'sandbox' | 'production';

type AsaasBillingType = 'PIX' | 'BOLETO';

type AsaasCustomerCreateInput = {
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
};

type AsaasCustomer = {
  id: string;
};

type AsaasPaymentCreateInput = {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
};

type AsaasPayment = {
  id: string;
  billingType?: AsaasBillingType;
  status?: string;
  value?: number;
  dueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

function getAsaasEnv(): AsaasEnvironment {
  const raw = (process.env.ASAAS_ENV || '').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  return 'sandbox';
}

function getAsaasBaseUrl(): string {
  const explicit = process.env.ASAAS_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const env = getAsaasEnv();
  return env === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}

function getAsaasApiKey(): string | undefined {
  const key = process.env.ASAAS_API_KEY;
  return key && key.trim() ? key.trim() : undefined;
}

export function isAsaasEnabled(): boolean {
  return !!getAsaasApiKey();
}

function isProductionChargesAllowed(): boolean {
  return (process.env.ASAAS_ALLOW_PRODUCTION_CHARGES || '').toLowerCase() === 'true';
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeCpfCnpj(value?: string): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  return undefined;
}

function normalizePhoneBR(value?: string): string | undefined {
  if (!value) return undefined;
  const digitsRaw = value.replace(/\D/g, '');
  if (!digitsRaw) return undefined;

  const digits = digitsRaw.startsWith('55') && digitsRaw.length > 11
    ? digitsRaw.slice(2)
    : digitsRaw;

  if (digits.length === 10 || digits.length === 11) {
    return digits;
  }

  return undefined;
}

async function asaasRequest<T>(
  path: string,
  options: { method: string; body?: any }
): Promise<T> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) {
    throw new Error('ASAAS_API_KEY is missing');
  }

  const baseUrl = getAsaasBaseUrl();
  const env = getAsaasEnv();
  if (env === 'production' && !isProductionChargesAllowed()) {
    throw new Error('Asaas production charges are disabled (set ASAAS_ALLOW_PRODUCTION_CHARGES=true to override)');
  }

  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

  const res = await fetch(url, {
    method: options.method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': process.env.ASAAS_USER_AGENT || 'capy-barco2-agent/1.0',
      access_token: apiKey
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Asaas request failed ${res.status}: ${text.substring(0, 600)}`);
  }

  return res.json() as Promise<T>;
}

export async function createAsaasCustomer(input: AsaasCustomerCreateInput): Promise<AsaasCustomer> {
  const payload: any = {
    name: input.name
  };

  if (input.email) {
    payload.email = input.email;
  }

  const mobilePhone = normalizePhoneBR(input.mobilePhone);
  if (mobilePhone && (process.env.ASAAS_SEND_MOBILE_PHONE || '').toLowerCase() === 'true') {
    payload.mobilePhone = mobilePhone;
  }

  const cpfCnpj = normalizeCpfCnpj(input.cpfCnpj);
  if (cpfCnpj) {
    payload.cpfCnpj = cpfCnpj;
  }

  return asaasRequest<AsaasCustomer>('/customers', { method: 'POST', body: payload });
}

export async function createAsaasPayment(input: AsaasPaymentCreateInput): Promise<AsaasPayment> {
  const payload: any = {
    customer: input.customer,
    billingType: input.billingType,
    value: Number(input.value.toFixed(2)),
    dueDate: input.dueDate
  };

  if (input.description) payload.description = input.description;
  if (input.externalReference) payload.externalReference = input.externalReference;

  return asaasRequest<AsaasPayment>('/payments', { method: 'POST', body: payload });
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, { method: 'GET' });
}

export function buildDefaultDueDate(daysFromNow = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, daysFromNow));
  return formatDateYMD(date);
}
