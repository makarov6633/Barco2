import dotenv from 'dotenv';

dotenv.config({ path: '/project/workspace/.env.local', override: true });
dotenv.config({ path: '/project/workspace/makarov6633/Barco2/.env.local', override: true });

process.env.TWILIO_DISABLE = 'true';
process.env.NODE_ENV = 'production';

import { executeTool } from '../lib/agent-tools';
import type { ConversationContext } from '../lib/supabase';

function assert(condition: any, message: string) {
  if (!condition) throw new Error(message);
}

function safeId(id?: string, keep = 8) {
  if (!id) return 'N/A';
  if (id.length <= keep) return id;
  return `…${id.slice(-keep)}`;
}

async function main() {
  const telefone = `+55977777${Math.floor(1000 + Math.random() * 8999)}`;

  const conversation: ConversationContext = {
    telefone,
    conversationHistory: [],
    tempData: {},
    metadata: { memories: [] }
  };

  const ctx = { telefone, conversation };

  const passeiosRes = await executeTool('consultar_passeios', {}, ctx);
  assert(passeiosRes.success, 'Falha ao listar passeios');

  const passeios = (passeiosRes as any).data as any[];
  assert(Array.isArray(passeios) && passeios.length > 0, 'Sem passeios no Supabase');

  const candidates = passeios
    .map((p) => {
      const min = p?.preco_min;
      const max = p?.preco_max;
      if (min == null && max == null) return null;
      if (min != null && max != null && Number(min) !== Number(max)) return null;
      const value = Number(min ?? max);
      if (!Number.isFinite(value) || value <= 0) return null;
      return { p, value };
    })
    .filter(Boolean) as Array<{ p: any; value: number }>;

  candidates.sort((a, b) => a.value - b.value);
  const selected = candidates[0]?.p;

  assert(!!selected?.id, 'Nenhum passeio com preço fixo encontrado para testar pagamento');

  const reservaRes = await executeTool(
    'criar_reserva',
    {
      nome: 'Teste Integracao',
      passeio_id: selected.id,
      data: 'amanhã',
      num_pessoas: 1
    },
    ctx
  );

  assert(reservaRes.success, 'Falha ao criar reserva');
  const reservaId = (reservaRes as any).data?.reserva_id as string | undefined;
  assert(!!reservaId, 'Reserva sem id');

  const pagamentoRes = await executeTool(
    'gerar_pagamento',
    {
      tipo_pagamento: 'PIX',
      cpf: '11144477735'
    },
    ctx
  );

  assert(pagamentoRes.success, `Falha ao gerar pagamento: ${(pagamentoRes as any).error?.message || 'unknown'}`);
  const asaasId = (pagamentoRes as any).data?.asaas_id as string | undefined;
  assert(!!asaasId, 'Pagamento sem asaas_id');

  console.log(JSON.stringify({
    selectedPasseio: selected.nome,
    reservaId: safeId(reservaId),
    asaasId: safeId(asaasId)
  }));

  const webhookRes = await fetch('http://localhost:3000/api/webhook/asaas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'PAYMENT_RECEIVED', payment: { id: asaasId } })
  });

  const webhookJson = await webhookRes.json().catch(() => null);
  assert(webhookRes.ok, `Webhook HTTP ${webhookRes.status}`);
  assert(webhookJson?.received === true, 'Webhook não confirmou recebimento');

  const voucherRes = await executeTool('gerar_voucher', { reserva_id: reservaId }, ctx);
  assert(voucherRes.success, 'Voucher não gerou após webhook');

  console.log(JSON.stringify({
    ok: true,
    voucherCode: (voucherRes as any).data?.voucher_code,
    passeio: (voucherRes as any).data?.passeio_nome
  }));
}

main().catch((err) => {
  console.error('webhook-flow-test-failed', err?.message || err);
  process.exit(1);
});
