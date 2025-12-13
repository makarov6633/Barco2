import axios from 'axios';

const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
const ASAAS_BASE_URL = process.env.ASAAS_SANDBOX === 'true' 
  ? 'https://sandbox.asaas.com/api/v3' 
  : 'https://api.asaas.com/v3';

interface AsaasCustomer {
  id?: string;
  name: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

interface AsaasPayment {
  customer: string;
  billingType: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  value: number;
  dueDate: string;
  description: string;
  externalReference?: string;
}

interface AsaasPaymentResponse {
  id: string;
  invoiceUrl: string;
  invoiceNumber?: string;
  pixQrCodeUrl?: string;
  pixCopiaECola?: string;
  bankSlipUrl?: string;
  status: string;
}

export async function createOrGetCustomer(customer: AsaasCustomer): Promise<string> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  try {
    // Buscar cliente existente por CPF/telefone
    if (customer.cpfCnpj) {
      const { data: customers } = await axios.get(`${ASAAS_BASE_URL}/customers`, {
        headers: { access_token: ASAAS_API_KEY },
        params: { cpfCnpj: customer.cpfCnpj }
      });

      if (customers.data && customers.data.length > 0) {
        return customers.data[0].id;
      }
    }

    // Criar novo cliente
    const { data } = await axios.post(`${ASAAS_BASE_URL}/customers`, customer, {
      headers: { 
        access_token: ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    return data.id;
  } catch (error: any) {
    console.error('Erro ao criar/buscar cliente Asaas:', error.response?.data || error);
    throw new Error('Falha ao processar cliente no sistema de pagamento');
  }
}

export async function createPayment(payment: AsaasPayment): Promise<AsaasPaymentResponse> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  try {
    const { data } = await axios.post(`${ASAAS_BASE_URL}/payments`, payment, {
      headers: { 
        access_token: ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    return {
      id: data.id,
      invoiceUrl: data.invoiceUrl,
      invoiceNumber: data.invoiceNumber,
      pixQrCodeUrl: data.pixQrCodeUrl,
      pixCopiaECola: data.pixCopiaECola,
      bankSlipUrl: data.bankSlipUrl,
      status: data.status
    };
  } catch (error: any) {
    console.error('Erro ao criar pagamento Asaas:', error.response?.data || error);
    throw new Error('Falha ao gerar pagamento');
  }
}

export async function getPaymentStatus(paymentId: string): Promise<any> {
  if (!ASAAS_API_KEY) {
    throw new Error('ASAAS_API_KEY não configurada');
  }

  try {
    const { data } = await axios.get(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
      headers: { access_token: ASAAS_API_KEY }
    });

    return data;
  } catch (error: any) {
    console.error('Erro ao consultar status do pagamento:', error.response?.data || error);
    throw new Error('Falha ao consultar pagamento');
  }
}
