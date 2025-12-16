import twilio from 'twilio';

let cachedClient: ReturnType<typeof twilio> | null = null;

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
    if (!client) return false;
    const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

    await client.messages.create({
      body: message,
      from,
      to
    });

    console.log(`Mensagem enviada para ${to}`);
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
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
        message = `*NOVA RESERVA*\n\nNome: ${notification.data.nome}\nTelefone: ${notification.data.telefone}\nPasseio: ${notification.data.passeio}\nData: ${notification.data.data}\nPessoas: ${notification.data.numPessoas} pessoa(s)\nTotal: R$ ${notification.data.valor?.toFixed(2)}\nVoucher: ${notification.data.voucher}\n\nStatus: *${notification.data.status}*`;
        break;

      case 'RECLAMACAO':
        message = `*RECLAMAÇÃO URGENTE*\n\nTelefone: ${notification.data.telefone}\nNome: ${notification.data.nome || 'Cliente'}\n\nMensagem: "${notification.data.mensagem}"\n\nAção: atender imediatamente.`;
        break;

      case 'CANCELAMENTO':
        message = `*CANCELAMENTO*\n\nTelefone: ${notification.data.telefone}\nVoucher: ${notification.data.voucher}\nMotivo: ${notification.data.motivo || 'Sem motivo informado'}`;
        break;
    }

    await sendWhatsAppMessage(businessNumber, message);
  } catch (error) {
    console.error('Erro ao notificar empresa:', error);
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
  return `*RESERVA CONFIRMADA*\n\n*Voucher:* ${data.voucherCode}\n\nCliente: ${data.clienteNome}\nPasseio: ${data.passeioNome}\nData: ${data.data} às ${data.horario}\nPessoas: ${data.numPessoas} pessoa(s)\nTotal: R$ ${data.valorTotal.toFixed(2)}\n\n*Ponto de encontro:*\n${data.pontoEncontro}\n\n*Importante:*\n- Chegar 15 min antes\n- Trazer este voucher\n- Confirmar 1 dia antes\n\nDúvidas: (22) 99824-9911\n\nCaleb's Tour - CNPJ 26.096.072/0001-78`;
}
