import { getAllPasseios, getOrCreateCliente, createReserva, generateVoucherCode } from './supabase';
import { createOrGetCustomer, createPayment } from './asaas';
import { formatVoucher } from './twilio';

export interface ToolCall {
  name: string;
  parameters: any;
}

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Ferramentas disponíveis para a IA chamar
 */
export const AVAILABLE_TOOLS = [
  {
    name: 'consultar_passeios',
    description: 'Busca todos os passeios disponíveis no banco de dados com preços, durações e descrições.',
    parameters: {}
  },
  {
    name: 'buscar_passeio_especifico',
    description: 'Busca um passeio específico por nome ou categoria.',
    parameters: {
      termo: 'string - Nome ou categoria do passeio (ex: "barco", "arraial", "mergulho")'
    }
  },
  {
    name: 'criar_reserva',
    description: 'Cria uma reserva no sistema. Necessita: telefone, nome do cliente, ID do passeio, data, número de pessoas.',
    parameters: {
      telefone: 'string - Telefone do cliente',
      nome: 'string - Nome completo do cliente',
      passeio_id: 'string - ID do passeio',
      data: 'string - Data do passeio',
      num_pessoas: 'number - Número de pessoas'
    }
  },
  {
    name: 'gerar_pagamento',
    description: 'Gera um pagamento via Asaas (PIX ou Boleto). Necessita reserva já criada.',
    parameters: {
      reserva_id: 'string - ID da reserva',
      tipo_pagamento: 'string - "PIX" ou "BOLETO"',
      cliente_nome: 'string - Nome do cliente',
      cliente_telefone: 'string - Telefone do cliente',
      cliente_cpf: 'string - CPF do cliente (opcional)',
      valor: 'number - Valor total em reais'
    }
  },
  {
    name: 'gerar_voucher',
    description: 'Gera e formata um voucher de confirmação após pagamento.',
    parameters: {
      reserva_id: 'string - ID da reserva',
      voucher_code: 'string - Código do voucher',
      cliente_nome: 'string - Nome do cliente',
      passeio_nome: 'string - Nome do passeio',
      data: 'string - Data do passeio',
      num_pessoas: 'number - Número de pessoas',
      valor_total: 'number - Valor total pago'
    }
  }
];

/**
 * Executa uma ferramenta baseado na decisão da IA
 */
export async function executeTool(toolCall: ToolCall): Promise<ToolResult> {
  try {
    switch (toolCall.name) {
      case 'consultar_passeios':
        return await consultarPasseios();
      
      case 'buscar_passeio_especifico':
        return await buscarPasseioEspecifico(toolCall.parameters.termo);
      
      case 'criar_reserva':
        return await criarReservaViaTool(toolCall.parameters);
      
      case 'gerar_pagamento':
        return await gerarPagamentoViaTool(toolCall.parameters);
      
      case 'gerar_voucher':
        return await gerarVoucherViaTool(toolCall.parameters);
      
      default:
        return { success: false, error: `Ferramenta ${toolCall.name} não encontrada` };
    }
  } catch (error: any) {
    console.error(`Erro ao executar ferramenta ${toolCall.name}:`, error);
    return { success: false, error: error.message || 'Erro desconhecido' };
  }
}

async function consultarPasseios(): Promise<ToolResult> {
  const passeios = await getAllPasseios();
  return {
    success: true,
    data: passeios.map(p => ({
      id: p.id,
      nome: p.nome,
      categoria: p.categoria,
      preco_min: p.preco_min,
      preco_max: p.preco_max,
      duracao: p.duracao,
      local: p.local,
      descricao: p.descricao
    }))
  };
}

async function buscarPasseioEspecifico(termo: string): Promise<ToolResult> {
  const passeios = await getAllPasseios();
  const termoLower = termo.toLowerCase();
  
  const encontrado = passeios.find(p => 
    p.nome.toLowerCase().includes(termoLower) ||
    p.categoria?.toLowerCase().includes(termoLower)
  );

  if (!encontrado) {
    return { success: false, error: 'Passeio não encontrado' };
  }

  return { success: true, data: encontrado };
}

async function criarReservaViaTool(params: any): Promise<ToolResult> {
  const { telefone, nome, passeio_id, data, num_pessoas } = params;

  const cliente = await getOrCreateCliente(telefone, nome);
  if (!cliente) {
    return { success: false, error: 'Erro ao criar cliente' };
  }

  const passeios = await getAllPasseios();
  const passeio = passeios.find(p => p.id === passeio_id);
  if (!passeio) {
    return { success: false, error: 'Passeio não encontrado' };
  }

  const voucherCode = generateVoucherCode();
  const valorPorPessoa = passeio.preco_min && passeio.preco_max
    ? (passeio.preco_min + passeio.preco_max) / 2
    : passeio.preco_min || passeio.preco_max || 0;
  const valorTotal = valorPorPessoa * num_pessoas;

  const reserva = await createReserva({
    cliente_id: cliente.id,
    passeio_id: passeio.id,
    data_passeio: data,
    num_pessoas,
    voucher: voucherCode,
    status: 'PENDENTE',
    valor_total: valorTotal,
    observacoes: 'Reserva via WhatsApp'
  });

  if (!reserva) {
    return { success: false, error: 'Erro ao criar reserva' };
  }

  return {
    success: true,
    data: {
      reserva_id: reserva.id,
      voucher_code: voucherCode,
      valor_total: valorTotal,
      passeio_nome: passeio.nome
    }
  };
}

async function gerarPagamentoViaTool(params: any): Promise<ToolResult> {
  const { tipo_pagamento, cliente_nome, cliente_telefone, cliente_cpf, valor, reserva_id } = params;

  // Criar/buscar cliente no Asaas
  const customerId = await createOrGetCustomer({
    name: cliente_nome,
    mobilePhone: cliente_telefone,
    cpfCnpj: cliente_cpf
  });

  // Calcular data de vencimento (3 dias a partir de hoje)
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 3);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  // Criar pagamento
  const payment = await createPayment({
    customer: customerId,
    billingType: tipo_pagamento === 'PIX' ? 'PIX' : 'BOLETO',
    value: valor,
    dueDate: dueDateStr,
    description: `Reserva ${reserva_id} - Caleb's Tour`,
    externalReference: reserva_id
  });

  return {
    success: true,
    data: {
      payment_id: payment.id,
      tipo: tipo_pagamento,
      pix_qrcode: payment.pixQrCodeUrl,
      pix_copia_cola: payment.pixCopiaECola,
      boleto_url: payment.bankSlipUrl,
      invoice_url: payment.invoiceUrl,
      status: payment.status
    }
  };
}

async function gerarVoucherViaTool(params: any): Promise<ToolResult> {
  const { voucher_code, cliente_nome, passeio_nome, data, num_pessoas, valor_total } = params;

  const voucherMessage = formatVoucher({
    voucherCode: voucher_code,
    clienteNome: cliente_nome,
    passeioNome: passeio_nome,
    data: data || 'A confirmar',
    horario: '09:00',
    numPessoas: num_pessoas || 1,
    valorTotal: valor_total,
    pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo'
  });

  return {
    success: true,
    data: { voucher_message: voucherMessage }
  };
}
