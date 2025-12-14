import dotenv from 'dotenv';

dotenv.config({ path: '/project/workspace/.env.local' });
dotenv.config({ path: '/project/workspace/makarov6633/Barco2/.env.local' });

process.env.TWILIO_DISABLE = 'true';

import { processMessage } from '../lib/agent';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function extractVoucher(text: string) {
  const m = text.match(/\bCB[A-Z2-9]{8}\b/);
  return m ? m[0] : null;
}

function normalize(text: string) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickNextUserMessage(lastAssistant: string) {
  const t = normalize(lastAssistant);

  if (t.includes('qual') && (t.includes('1') || t.includes('1️⃣')) && (t.includes('2') || t.includes('2️⃣'))) {
    return '1';
  }

  if (
    (t.includes('data') && (t.includes('qual') || t.includes('pra') || t.includes('para'))) ||
    t.includes('pra qual dia') ||
    t.includes('para qual dia')
  ) {
    return 'amanhã';
  }

  if (t.includes('quantas pessoas') || t.includes('qtd') || t.includes('pessoas vao') || t.includes('pessoas vão')) {
    return '2 pessoas';
  }

  if ((t.includes('forma de pagamento') || t.includes('pagamento')) && (t.includes('pix') || t.includes('boleto'))) {
    return 'Prefiro pagar depois. Só cria a reserva e me manda o voucher, por favor.';
  }

  if (t.includes('seu nome') || t.includes('nome completo') || (t.includes('qual') && t.includes('nome'))) {
    return 'João da Silva';
  }

  return null;
}

async function main() {
  const telefone = `+55977777${Math.floor(1000 + Math.random() * 8999)}`;

  console.log(`\n=== Reserva + Cancelamento (${telefone}) ===\n`);

  let voucher: string | null = null;
  let lastAssistant = '';

  const userStart = 'Quero reservar o passeio de Quadriciclo Automático com Direção Elétrica.';
  let user = userStart;

  for (let i = 0; i < 10; i++) {
    const reply = await processMessage(telefone, user);
    lastAssistant = reply;

    console.log(`U${i + 1}: ${user}`);
    console.log(`A${i + 1}: ${reply}\n`);

    voucher = extractVoucher(reply) || voucher;
    if (voucher) break;

    const next = pickNextUserMessage(reply);
    if (!next) {
      throw new Error('Fluxo não avançou para criar reserva/voucher.');
    }
    user = next;
  }

  assert(!!voucher, 'Não consegui extrair voucher da conversa.');

  const cancelMsg = `Quero cancelar minha reserva. Voucher ${voucher}`;
  const cancelReply = await processMessage(telefone, cancelMsg);
  console.log(`U_final: ${cancelMsg}`);
  console.log(`A_final: ${cancelReply}\n`);

  const cancelNorm = normalize(cancelReply);
  assert(cancelNorm.includes('cancel'), 'Esperava confirmação de cancelamento na resposta.');

  console.log('✅ Cancelamento ok');
}

main().catch((err) => {
  console.error('\n❌ Falha no teste de cancelamento:', err?.message || err);
  process.exit(1);
});
