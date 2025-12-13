import { NextRequest, NextResponse } from 'next/server';
import { processPaymentConfirmation } from '@/lib/agent';
import { processWebhookPayment, isPaymentConfirmed } from '@/lib/asaas';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    console.log('📥 Webhook Asaas recebido:', JSON.stringify(payload, null, 2));

    const paymentInfo = await processWebhookPayment(payload);

    console.log(`💳 Pagamento ${paymentInfo.paymentId}: ${paymentInfo.status}`);

    if (isPaymentConfirmed(paymentInfo.status) && paymentInfo.externalReference) {
      console.log(`✅ Pagamento confirmado! Ref: ${paymentInfo.externalReference}`);

      await processPaymentConfirmation(
        paymentInfo.paymentId,
        paymentInfo.externalReference,
        paymentInfo.status
      );
    }

    return NextResponse.json({ 
      received: true,
      paymentId: paymentInfo.paymentId,
      status: paymentInfo.status
    });

  } catch (error) {
    console.error('❌ Erro no webhook Asaas:', error);
    return NextResponse.json({ 
      error: 'Erro ao processar webhook',
      received: true
    }, { status: 200 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: '🟢 Asaas Webhook ONLINE',
    version: '1.0',
    timestamp: new Date().toISOString(),
    events: [
      'PAYMENT_CREATED',
      'PAYMENT_UPDATED',
      'PAYMENT_CONFIRMED',
      'PAYMENT_RECEIVED',
      'PAYMENT_OVERDUE',
      'PAYMENT_REFUNDED'
    ],
    description: 'Webhook para receber notificações de pagamento do Asaas'
  });
}
