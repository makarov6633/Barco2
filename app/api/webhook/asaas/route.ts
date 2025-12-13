import { NextRequest, NextResponse } from 'next/server';
import { getCobrancaByAsaasId, updateCobrancaByAsaasId, getReservaById, updateReservaStatus, getClienteById, getPasseioById, generateVoucherCode } from '@/lib/supabase';
import { sendWhatsAppMessage, formatVoucher, notifyBusiness } from '@/lib/twilio';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('🔔 Webhook Asaas:', JSON.stringify(body, null, 2));
    const { event, payment } = body;
    if (!payment?.id) return NextResponse.json({ error: 'Payment ID missing' }, { status: 400 });

    const cobranca = await getCobrancaByAsaasId(payment.id);
    if (!cobranca) {
      console.log('⚠️ Cobrança não encontrada:', payment.id);
      return NextResponse.json({ received: true, message: 'Cobranca not found' });
    }

    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
      console.log('💰 Pagamento confirmado:', payment.id);
      await updateCobrancaByAsaasId(payment.id, { status: 'CONFIRMADO', pago_em: new Date().toISOString() });

      const reserva = await getReservaById(cobranca.reserva_id);
      if (!reserva) break;

      const voucherCode = generateVoucherCode();
      await updateReservaStatus(cobranca.reserva_id, 'CONFIRMADO', voucherCode);

      const [cliente, passeio] = await Promise.all([getClienteById(cobranca.cliente_id), getPasseioById(reserva.passeio_id)]);

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
        const whatsappTo = cliente.telefone.startsWith('whatsapp:') ? cliente.telefone : `whatsapp:${cliente.telefone}`;
        await sendWhatsAppMessage(whatsappTo, voucherMessage);
        console.log('✅ Voucher enviado para:', cliente.telefone);
      }

      await notifyBusiness({ type: 'NOVA_RESERVA', data: { nome: cliente?.nome, telefone: cliente?.telefone, passeio: passeio?.nome, data: reserva.data_passeio, numPessoas: reserva.num_pessoas, voucher: voucherCode, valor: reserva.valor_total, status: 'PAGO ✅' } });
    } else if (event === 'PAYMENT_OVERDUE') {
      await updateCobrancaByAsaasId(payment.id, { status: 'EXPIRADO' });
      await updateReservaStatus(cobranca.reserva_id, 'EXPIRADO');
    } else if (event === 'PAYMENT_DELETED' || event === 'PAYMENT_REFUNDED') {
      await updateCobrancaByAsaasId(payment.id, { status: 'CANCELADO' });
      await updateReservaStatus(cobranca.reserva_id, 'CANCELADO');
    }

    return NextResponse.json({ received: true, event });
  } catch (error) {
    console.error('❌ Erro webhook Asaas:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: '🟢 ONLINE', service: 'Asaas Webhook', timestamp: new Date().toISOString() });
}
