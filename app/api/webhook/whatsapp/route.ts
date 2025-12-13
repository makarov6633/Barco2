import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/agent';

const MessagingResponse = require('twilio').twiml.MessagingResponse;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;

    if (!from || !body) {
      console.error('❌ Dados incompletos:', { from, body });
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    const telefone = from.replace('whatsapp:', '');
    const message = body.trim();

    console.log(`\n📨 Nova mensagem de ${telefone}`);
    console.log(`💬 "${message}"\n`);

    const response = await processMessage(telefone, message);

    const twiml = new MessagingResponse();
    twiml.message(response);

    console.log(`📤 Resposta: "${response.substring(0, 100)}..."\n`);

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    });

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    
    const twiml = new MessagingResponse();
    twiml.message('Ops! Erro técnico 😔\nChama (22) 99824-9911!');

    return new NextResponse(twiml.toString(), {
      status: 200,
      headers: {
        'Content-Type': 'text/xml'
      }
    });
  }
}

export async function GET() {
  const hasGroq = !!process.env.GROQ_API_KEY;
  const hasSupabase = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasTwilio = !!process.env.TWILIO_ACCOUNT_SID;
  const hasAsaas = !!process.env.ASAAS_API_KEY;
  const groqModel = process.env.GROQ_REASONING_MODEL || 'llama-3.3-70b-versatile';

  return NextResponse.json({
    status: '🟢 ONLINE',
    agent: 'Ana - Caleb\'s Tour',
    version: '5.0-PAGAMENTOS',
    timestamp: new Date().toISOString(),
    services: {
      groq: hasGroq ? `✅ Conectado (${groqModel})` : '❌ Desconectado',
      supabase: hasSupabase ? '✅ Conectado' : '❌ Desconectado',
      twilio: hasTwilio ? '✅ Conectado' : '❌ Desconectado',
      asaas: hasAsaas ? '✅ Conectado (PIX/Boleto)' : '❌ Desconectado'
    },
    features: [
      '🧠 IA com Knowledge Base do Supabase',
      '💳 Pagamentos PIX e Boleto via Asaas',
      '🎫 Voucher Automático após Pagamento',
      '💬 Contexto de Conversa Persistente',
      '🎯 Detecção de Intenção Avançada',
      '📱 Notificações em Tempo Real',
      '🔄 Fluxo de Reserva Inteligente',
      '😊 Personalidade Brasileira Autêntica'
    ],
    webhooks: {
      whatsapp: '/api/webhook/whatsapp',
      asaas: '/api/webhook/asaas'
    }
  });
}
