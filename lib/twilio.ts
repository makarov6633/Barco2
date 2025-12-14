import twilio from 'twilio';

let cachedClient: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio não configurado (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN).');
  }
  cachedClient ||= twilio(accountSid, authToken);
  return cachedClient;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const client = getTwilioClient();
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    await client.messages.create({
      body: message,
      from,
      to
    });

    console.log(`✅ Mensagem enviada para ${to}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    return false;
  }
}

export async function notifyBusiness(notification: {
  type: 'NOVA_RESERVA' | 'RECLAMACAO' | 'CANCELAMENTO';
  data: any;
}): Promise<void> {
  try {
    const businessNumber = process.env.TWILIO_BUSINESS_WHATSAPP;
    if (!businessNumber) return;

    let message = '';

    switch (notification.type) {
      case 'NOVA_RESERVA':
        message = `🔔 *NOVA RESERVA*\n\n👤 ${notification.data.nome}\n📞 ${notification.data.telefone}\n🚤 ${notification.data.passeio}\n📅 ${notification.data.data}\n👥 ${notification.data.numPessoas} pessoa(s)\n💰 R$ ${notification.data.valor?.toFixed(2)}\n🎫 Voucher: ${notification.data.voucher}\n\nStatus: *${notification.data.status}*`;
        break;

      case 'RECLAMACAO':
        message = `🚨 *RECLAMAÇÃO URGENTE*\n\n📞 ${notification.data.telefone}\n👤 ${notification.data.nome || 'Cliente'}\n\n💬 "${notification.data.mensagem}"\n\n⚠️ *ATENDER IMEDIATAMENTE!*`;
        break;

      case 'CANCELAMENTO':
        message = `❌ *CANCELAMENTO*\n\n📞 ${notification.data.telefone}\n🎫 Voucher: ${notification.data.voucher}\n💬 ${notification.data.motivo || 'Sem motivo informado'}`;
        break;
    }

    await sendWhatsAppMessage(businessNumber, message);
  } catch (error) {
    console.error('❌ Erro ao notificar empresa:', error);
  }
}

export function formatVoucher(data: {
  voucherCode: string;
  clienteNome: string;
  passeioNome: string;
  data: string;
  horario: string;
  numPessoas: number;
  valorTotal: number;
  pontoEncontro: string;
}): string {
  return `✅ *RESERVA CONFIRMADA!*\n\n🎫 *Voucher:* ${data.voucherCode}\n\n👤 ${data.clienteNome}\n🚤 ${data.passeioNome}\n📅 ${data.data} às ${data.horario}\n👥 ${data.numPessoas} pessoa(s)\n💰 R$ ${data.valorTotal.toFixed(2)}\n\n📍 *Ponto de Encontro:*\n${data.pontoEncontro}\n\n⚠️ *Importante:*\n• Chegar 15 min antes\n• Trazer este voucher\n• Confirmar 1 dia antes\n\n📞 Dúvidas: (22) 99824-9911\n\n_Caleb's Tour - CNPJ 26.096.072/0001-78_`;
}
