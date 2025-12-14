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

    const telefone = from.replace(/^whatsapp:/, '');
    const message = body.trim();

    console.log(`\n📨 Nova mensagem de ${telefone}`);
    console.log(`💬 Mensagem recebida (${message.length} chars)\n`);

    const response = await processMessage(telefone, message);

    const twiml = new MessagingResponse();
    twiml.message(response);

    console.log(`📤 Resposta enviada (${response.length} chars)\n`);

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

  return NextResponse.json({
    status: '🟢 ONLINE',
    agent: "Ana - Caleb's Tour",
    timestamp: new Date().toISOString(),
    services: {
      groq: hasGroq ? '✅ Conectado (openai/gpt-oss-120b)' : '❌ Desconectado',
      supabase: hasSupabase ? '✅ Conectado' : '❌ Desconectado',
      twilio: hasTwilio ? '✅ Conectado' : '❌ Desconectado'
    }
  });
}
