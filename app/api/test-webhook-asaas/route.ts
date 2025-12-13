import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
    const webhookUrl = host ? `${proto}://${host}/api/webhook/asaas` : '/api/webhook/asaas';

    return NextResponse.json({
      status: '✅ Webhook recebido com sucesso',
      received: body,
      timestamp: new Date().toISOString(),
      webhookUrl
    });
  } catch (error) {
    return NextResponse.json({
      status: '❌ Erro ao processar webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  const webhookUrl = host ? `${proto}://${host}/api/webhook/asaas` : '/api/webhook/asaas';

  return NextResponse.json({
    status: '✅ Endpoint ativo',
    method: 'Este endpoint aceita POST requests do Asaas',
    webhookUrl,
    events: ['PAYMENT_OVERDUE', 'PAYMENT_CREATED', 'PAYMENT_RECEIVED'],
    docs: 'https://docs.asaas.com/reference/webhooks'
  });
}
