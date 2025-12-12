import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    return NextResponse.json({
      status: '✅ Webhook recebido com sucesso',
      received: body,
      timestamp: new Date().toISOString(),
      info: 'Este é o endpoint correto. Configure no Asaas: https://calebtourctc.vercel.app/api/webhook/asaas'
    });
  } catch (error) {
    return NextResponse.json({
      status: '❌ Erro ao processar webhook',
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({
    status: '✅ Endpoint ativo',
    method: 'Este endpoint aceita POST requests do Asaas',
    webhookUrl: 'https://calebtourctc.vercel.app/api/webhook/asaas',
    events: ['PAYMENT_OVERDUE', 'PAYMENT_CREATED', 'PAYMENT_RECEIVED'],
    docs: 'https://docs.asaas.com/reference/webhooks'
  });
}
