import twilio from 'twilio';

let cachedClient: any | null = null;

function getTwilioClient() {
  if ((process.env.TWILIO_DISABLE || '').toLowerCase() === 'true') {
    return null;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    return null;
  }

  cachedClient ||= twilio(accountSid, authToken);
  return cachedClient;
}

export async function sendWhatsAppMessage(to: string, message: string): Promise<boolean> {
  try {
    const client = getTwilioClient();
    if (!client) {
      return false;
    }

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
        message = `🔔 *NOVA RESERVA*

👤 ${notification.data.nome}
📞 ${notification.data.telefone}
🚤 ${notification.data.passeio}
📅 ${notification.data.data}
👥 ${notification.data.numPessoas} pessoa(s)
💰 R$ ${notification.data.valor?.toFixed(2)}
🎫 Voucher: ${notification.data.voucher}

Status: *${notification.data.status}*`;
        break;

      case 'RECLAMACAO':
        message = `🚨 *RECLAMAÇÃO URGENTE*

📞 ${notification.data.telefone}
👤 ${notification.data.nome || 'Cliente'}

💬 "${notification.data.mensagem}"

⚠️ *ATENDER IMEDIATAMENTE!*`;
        break;

      case 'CANCELAMENTO':
        message = `❌ *CANCELAMENTO*

📞 ${notification.data.telefone}
🎫 Voucher: ${notification.data.voucher}
💬 ${notification.data.motivo || 'Sem motivo informado'}`;
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
  return `✅ *RESERVA CONFIRMADA!*

🎫 *Voucher:* ${data.voucherCode}

👤 ${data.clienteNome}
🚤 ${data.passeioNome}
📅 ${data.data} às ${data.horario}
👥 ${data.numPessoas} pessoa(s)
💰 R$ ${data.valorTotal.toFixed(2)}

📍 *Ponto de Encontro:*
${data.pontoEncontro}

⚠️ *Importante:*
• Chegar 15 min antes
• Trazer este voucher
• Confirmar 1 dia antes

📞 Dúvidas: (22) 99824-9911

_Caleb's Tour - CNPJ 26.096.072/0001-78_`;
}
