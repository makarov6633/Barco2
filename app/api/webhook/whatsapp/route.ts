import { NextRequest, NextResponse } from 'next/server';
import { processMessage } from '@/lib/agent';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const MessagingResponse = require('twilio').twiml.MessagingResponse;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const from = String(formData.get('From') || '').trim();
    const bodyRaw = String(formData.get('Body') || '');

    const numMediaRaw = String(formData.get('NumMedia') || '0');
    const numMedia = Number.parseInt(numMediaRaw, 10) || 0;

    const mediaTypes: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      const ct = formData.get(`MediaContentType${i}`);
      if (ct) mediaTypes.push(String(ct));
    }

    const hasMedia = numMedia > 0;
    const hasAudio = mediaTypes.some((t) => t.toLowerCase().startsWith('audio/'));

    const twiml = new MessagingResponse();

    if (!from) {
      twiml.message('Não consegui identificar seu número. Pode tentar novamente em texto?');
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    const telefone = from.replace(/^whatsapp:/, '');
    const message = bodyRaw.trim();

    if (hasMedia && !message) {
      twiml.message(
        hasAudio
          ? 'Recebi seu áudio. No momento, para eu te atender com precisão, preciso que você digite sua mensagem em texto, por favor. (PT/EN/ES)'
          : 'Recebi sua mídia. Para eu te atender com precisão, pode descrever em texto o que você precisa, por favor? (PT/EN/ES)'
      );
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    if (!message) {
      twiml.message('Para eu te ajudar, me envie sua mensagem em texto, por favor. (PT/EN/ES)');
      return new NextResponse(twiml.toString(), {
        status: 200,
        headers: { 'Content-Type': 'text/xml' }
      });
    }

    console.log(`\n📨 Nova mensagem de ${telefone}`);
    console.log(`💬 Mensagem recebida (${message.length} chars)\n`);

    const response = await processMessage(telefone, message);

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
    twiml.message('Desculpe, tive um problema técnico. Pode tentar novamente em texto?');

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
    agent: 'Ana - Caleb\'s Tour',
    version: '4.0-FINAL',
    timestamp: new Date().toISOString(),
    services: {
      groq: hasGroq ? '✅ Conectado (openai/gpt-oss-120b)' : '❌ Desconectado',
      supabase: hasSupabase ? '✅ Conectado' : '❌ Desconectado',
      twilio: hasTwilio ? '✅ Conectado' : '❌ Desconectado'
    },
    features: [
      '🧠 IA Conversacional Natural com Groq',
      '💬 Contexto Ilimitado',
      '🎯 Detecção de Intenção Avançada',
      '🎫 Geração de Vouchers Automática',
      '📱 Notificações em Tempo Real',
      '🔄 Fluxo de Reserva Inteligente',
      '😊 Personalidade Brasileira Autêntica',
      '⚡ Respostas em <1 segundo'
    ],
    bestPractices: [
      'Tom natural e humano',
      'Respostas curtas para WhatsApp',
      'Reconhecimento de emoções',
      'Contexto conversacional',
      'Adaptação ao ritmo do usuário'
    ]
  });
}
