import dotenv from 'dotenv';

dotenv.config({ path: '/project/workspace/.env.local', override: true });
dotenv.config({ path: '/project/workspace/makarov6633/Barco2/.env.local', override: true });

import {
  buildDefaultDueDate,
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasPixQrCode
} from '../lib/asaas';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function safeLast(value?: string, n = 8) {
  if (!value) return undefined;
  if (value.length <= n) return value;
  return value.slice(-n);
}

async function main() {
  assert(!!process.env.ASAAS_API_KEY, 'ASAAS_API_KEY não está definido');

  const customer = await createAsaasCustomer({
    name: 'Capy Teste',
    cpfCnpj: '11144477735',
    email: 'teste+asaas@calebstour.com'
  });

  console.log('customerId', customer.id);

  const dueDate = buildDefaultDueDate(1);

  const pixPayment = await createAsaasPayment({
    customer: customer.id,
    billingType: 'PIX',
    value: 5.0,
    dueDate,
    description: 'Capy Teste PIX',
    externalReference: `capy-${Date.now()}`
  });

  console.log('pixPayment', {
    id: pixPayment.id,
    invoiceUrl: pixPayment.invoiceUrl ? '[present]' : undefined,
    status: pixPayment.status,
    value: pixPayment.value,
    dueDate: pixPayment.dueDate
  });

  const qr = await getAsaasPixQrCode(pixPayment.id);
  console.log('pixQrCode', {
    payloadLast8: safeLast(qr.payload, 8),
    hasEncodedImage: !!qr.encodedImage,
    expirationDate: qr.expirationDate
  });

  const boletoPayment = await createAsaasPayment({
    customer: customer.id,
    billingType: 'BOLETO',
    value: 5.0,
    dueDate,
    description: 'Capy Teste BOLETO',
    externalReference: `capy-${Date.now()}`
  });

  console.log('boletoPayment', {
    id: boletoPayment.id,
    invoiceUrl: boletoPayment.invoiceUrl ? '[present]' : undefined,
    bankSlipUrl: boletoPayment.bankSlipUrl ? '[present]' : undefined,
    status: boletoPayment.status,
    value: boletoPayment.value,
    dueDate: boletoPayment.dueDate
  });
}

main().catch((err) => {
  console.error('asaas-test-error', err?.message || err);
  process.exit(1);
});
