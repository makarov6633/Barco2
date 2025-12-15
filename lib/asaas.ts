type AsaasEnvironment = 'sandbox' | 'production';

type AsaasBillingType = 'PIX' | 'BOLETO';

type AsaasCustomerCreateInput = {
  name: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
};

type AsaasCustomerListResponse = {
  data?: AsaasCustomer[];
};

type AsaasPaymentCreateInput = {
  customer: string;
  billingType: AsaasBillingType;
  value: number;
  dueDate: string;
  description?: string;
  externalReference?: string;
};

export type AsaasCustomer = {
  id: string;
  name?: string;
  cpfCnpj?: string;
  email?: string;
  mobilePhone?: string;
};

export type AsaasPayment = {
  id: string;
  customer?: string;
  billingType?: AsaasBillingType;
  status?: string;
  value?: number;
  dueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
};

export type AsaasPixQrCode = {
  encodedImage?: string;
  payload?: string;
  expirationDate?: string;
};

function getAsaasEnv(): AsaasEnvironment {
  const raw = (process.env.ASAAS_ENV || '').toLowerCase();
  if (raw === 'production' || raw === 'prod') return 'production';
  if (raw === 'sandbox' || raw === 'test') return 'sandbox';

  const sandboxRaw = (process.env.ASAAS_SANDBOX || '').toLowerCase();
  const sandbox = sandboxRaw === 'true' || sandboxRaw === '1' || sandboxRaw === 'yes';
  return sandbox ? 'sandbox' : 'production';
}

function getAsaasBaseUrl(): string {
  const explicit = process.env.ASAAS_BASE_URL;
  if (explicit && explicit.trim()) return explicit.trim().replace(/\/$/, '');

  const env = getAsaasEnv();
  return env === 'production' ? 'https://api.asaas.com/v3' : 'https://api-sandbox.asaas.com/v3';
}

function getAsaasApiKey(): string | undefined {
  const key = process.env.ASAAS_API_KEY;
  const trimmed = key && key.trim() ? key.trim() : undefined;
  if (!trimmed) return undefined;
  return trimmed.replace(/\\\$/g, '$');
}

export function isAsaasEnabled(): boolean {
  return !!getAsaasApiKey();
}

function isProductionChargesAllowedOutsideProd(): boolean {
  const raw = (process.env.ASAAS_ALLOW_PRODUCTION_CHARGES || '').toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function buildDefaultDueDate(daysFromNow = 1): string {
  const date = new Date();
  date.setDate(date.getDate() + Math.max(0, daysFromNow));
  return formatDateYMD(date);
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

  const digits = digitsRaw.startsWith('55') && digitsRaw.length > 11 ? digitsRaw.slice(2) : digitsRaw;
  if (digits.length === 10 || digits.length === 11) return digits;

  return undefined;
}

function normalizeAsaasErrorMessage(payload: any): string {
  const first = payload?.errors?.[0];
  const desc = first?.description || first?.message;
  if (typeof desc === 'string' && desc.trim()) return desc.trim();
  if (typeof payload?.message === 'string' && payload.message.trim()) return payload.message.trim();
  return 'Erro na API Asaas';
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function asaasRequest<T>(
  path: string,
  options: { method: string; body?: any }
): Promise<T> {
  const apiKey = getAsaasApiKey();
  if (!apiKey) throw new Error('ASAAS_API_KEY is missing');

  const baseUrl = getAsaasBaseUrl();
  const env = getAsaasEnv();

  if (env === 'production' && process.env.NODE_ENV !== 'production' && !isProductionChargesAllowedOutsideProd()) {
    throw new Error('Asaas production charges are disabled outside production (set ASAAS_ALLOW_PRODUCTION_CHARGES=true to override)');
  }

  const url = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  const userAgent = process.env.ASAAS_USER_AGENT || 'capy-barco2/1.0';

  const maxAttempts = 3;
  let lastErr: any;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: options.method,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          access_token: apiKey
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      });

      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);

      if (res.ok) {
        return data as T;
      }

      const status = res.status;
      const retryable = status === 429 || status >= 500;

      if (!retryable) {
        if (isJson) {
          throw new Error(normalizeAsaasErrorMessage(data));
        }
        const text = typeof data === 'string' ? data : '';
        throw new Error(`Asaas request failed ${status}: ${text.substring(0, 600)}`);
      }

      lastErr = new Error(isJson ? normalizeAsaasErrorMessage(data) : `Asaas request failed ${status}`);
    } catch (err: any) {
      lastErr = err;
    }

    if (attempt < maxAttempts - 1) {
      const backoff = 250 * Math.pow(2, attempt);
      await sleep(backoff);
    }
  }

  throw lastErr || new Error('Erro na API Asaas');
}

export async function createAsaasCustomer(input: AsaasCustomerCreateInput): Promise<AsaasCustomer> {
  const payload: any = { name: input.name };

  if (input.email) {
    payload.email = input.email;
  }

  const cpfCnpj = normalizeCpfCnpj(input.cpfCnpj);
  if (cpfCnpj) {
    payload.cpfCnpj = cpfCnpj;
  }

  const mobilePhone = normalizePhoneBR(input.mobilePhone);
  if (mobilePhone && (process.env.ASAAS_SEND_MOBILE_PHONE || '').toLowerCase() === 'true') {
    payload.mobilePhone = mobilePhone;
  }

  return asaasRequest<AsaasCustomer>('/customers', { method: 'POST', body: payload });
}

export async function createAsaasPayment(input: AsaasPaymentCreateInput): Promise<AsaasPayment> {
  const payload: any = {
    customer: input.customer,
    billingType: input.billingType,
    value: Number(Number(input.value).toFixed(2)),
    dueDate: input.dueDate
  };

  if (input.description) payload.description = input.description;
  if (input.externalReference) payload.externalReference = input.externalReference;

  return asaasRequest<AsaasPayment>('/payments', { method: 'POST', body: payload });
}

export async function getAsaasPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>(`/payments/${paymentId}/pixQrCode`, { method: 'GET' });
}

export async function findOrCreateCustomer(params: {
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
}): Promise<AsaasCustomer> {
  const cpfCnpj = normalizeCpfCnpj(params.cpfCnpj);

  if (cpfCnpj) {
    const existing = await asaasRequest<AsaasCustomerListResponse>(`/customers?cpfCnpj=${cpfCnpj}`, { method: 'GET' });
    if (existing?.data?.length) {
      return existing.data[0];
    }
  }

  return createAsaasCustomer({
    name: params.name,
    cpfCnpj,
    email: params.email,
    mobilePhone: params.phone
  });
}

export async function createPixPayment(params: {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
}): Promise<{ payment: AsaasPayment; pixQrCode: AsaasPixQrCode }> {
  const dueDate = buildDefaultDueDate(1);

  const payment = await createAsaasPayment({
    customer: params.customerId,
    billingType: 'PIX',
    value: params.value,
    dueDate,
    description: params.description,
    externalReference: params.externalReference
  });

  const pixQrCode = await getAsaasPixQrCode(payment.id);
  return { payment, pixQrCode };
}

export async function createBoletoPayment(params: {
  customerId: string;
  value: number;
  description: string;
  externalReference?: string;
}): Promise<AsaasPayment> {
  const dueDate = buildDefaultDueDate(3);

  return createAsaasPayment({
    customer: params.customerId,
    billingType: 'BOLETO',
    value: params.value,
    dueDate,
    description: params.description,
    externalReference: params.externalReference
  });
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment> {
  const id = String(paymentId || '').trim();
  if (!id) throw new Error('paymentId is required');
  return asaasRequest<AsaasPayment>(`/payments/${id}`, { method: 'GET' });
}
