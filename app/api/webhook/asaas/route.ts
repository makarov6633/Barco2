import { NextRequest, NextResponse } from 'next/server';
import {
  getCobrancaByAsaasId,
  updateCobrancaByAsaasId,
  getReservaById,
  updateReservaStatus,
  getClienteById,
  getPasseioById,
  generateVoucherCode
} from '@/lib/supabase';
import { sendWhatsAppMessage, formatVoucher, notifyBusiness } from '@/lib/twilio';

function getWebhookToken(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7) : undefined;

  return (
    req.headers.get('asaas-token') ||
    req.headers.get('x-asaas-token') ||
    req.headers.get('x-webhook-token') ||
    bearer ||
    new URL(req.url).searchParams.get('token') ||
    undefined
  );
}

function isAuthorized(req: NextRequest) {
  const expected = process.env.ASAAS_WEBHOOK_TOKEN;
  if (!expected) return true;
  const provided = getWebhookToken(req);
  return !!provided && provided === expected;
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { event, payment } = body || {};
    const paymentId = payment?.id as string | undefined;

    if (!paymentId) return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 });

    const cobranca = await getCobrancaByAsaasId(paymentId);
    if (!cobranca) {
      return NextResponse.json({ received: true, event, message: 'Cobranca not found' });
    }

    if ((event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') && cobranca.status === 'CONFIRMADO') {
      return NextResponse.json({ received: true, event, idempotent: true });
    }

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      await updateCobrancaByAsaasId(paymentId, { status: 'CONFIRMADO', pago_em: new Date().toISOString() });

      const reserva = await getReservaById(cobranca.reserva_id);
      if (!reserva) {
        return NextResponse.json({ received: true, event, message: 'Reserva not found' });
      }

      if (reserva.voucher && reserva.voucher !== 'AGUARDANDO_PAGAMENTO' && reserva.status === 'CONFIRMADO') {
        return NextResponse.json({ received: true, event, idempotent: true, message: 'Reserva already confirmed' });
      }

      const voucherCode = generateVoucherCode();
      await updateReservaStatus(cobranca.reserva_id, 'CONFIRMADO', voucherCode);

      const [cliente, passeio] = await Promise.all([
        getClienteById(cobranca.cliente_id),
        getPasseioById(reserva.passeio_id)
      ]);

      if (cliente?.telefone) {
        const voucherMessage = formatVoucher({
          voucherCode,
          clienteNome: cliente.nome,
          passeioNome: passeio?.nome || 'Passeio',
          data: reserva.data_passeio,
          horario: '09:00',
          numPessoas: reserva.num_pessoas,
          valorTotal: reserva.valor_total,
          pontoEncontro: passeio?.local || 'Cais da Praia dos Anjos'
        });

        const whatsappTo = cliente.telefone.startsWith('whatsapp:')
          ? cliente.telefone
          : `whatsapp:${cliente.telefone}`;

        await sendWhatsAppMessage(whatsappTo, voucherMessage);
      }

      await notifyBusiness({
        type: 'NOVA_RESERVA',
        data: {
          nome: cliente?.nome,
          telefone: cliente?.telefone,
          passeio: passeio?.nome,
          data: reserva.data_passeio,
          numPessoas: reserva.num_pessoas,
          voucher: voucherCode,
          valor: reserva.valor_total,
          status: 'PAGO ✅'
        }
      });

      return NextResponse.json({ received: true, event });
    }

    if (event === 'PAYMENT_OVERDUE') {
      await updateCobrancaByAsaasId(paymentId, { status: 'EXPIRADO' });
      await updateReservaStatus(cobranca.reserva_id, 'EXPIRADO');
      return NextResponse.json({ received: true, event });
    }

    if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      await updateCobrancaByAsaasId(paymentId, { status: 'CANCELADO' });
      await updateReservaStatus(cobranca.reserva_id, 'CANCELADO');
      return NextResponse.json({ received: true, event });
    }

    return NextResponse.json({ received: true, event });
  } catch (error) {
    console.error('❌ Erro webhook Asaas:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  const tokenConfigured = !!process.env.ASAAS_WEBHOOK_TOKEN;
  return NextResponse.json({
    status: '🟢 ONLINE',
    service: 'Asaas Webhook',
    tokenConfigured,
    timestamp: new Date().toISOString()
  });
}
