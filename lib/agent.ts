import { 
  getConversationContext, 
  saveConversationContext, 
  getOrCreateCliente,
  getAllPasseios,
  createReserva,
  generateVoucherCode,
  ConversationContext,
  MemoryEntry 
} from './supabase';
import { generateAIResponse, detectIntentWithAI } from './groq-ai';
import { notifyBusiness, formatVoucher, sendWhatsAppMessage } from './twilio';
import {
  findOrCreateCustomer,
  createPixPayment,
  createBoletoPayment,
  formatPixMessage,
  formatBoletoMessage
} from './asaas';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`📥 ${telefone}: ${message}`);

    const context = await getConversationContext(telefone);
    ensureMemoryContainer(context);
    
    const analysis = await detectIntentWithAI(message);
    console.log(`🎯 Intent: ${analysis.intent} (${Math.round(analysis.confidence * 100)}%)`);

    if (analysis.entities.nome && !context.nome) {
      context.nome = analysis.entities.nome;
    }
    if (analysis.entities.data && context.tempData) {
      context.tempData.data = analysis.entities.data;
    }
    if (analysis.entities.numPessoas && context.tempData) {
      context.tempData.numPessoas = analysis.entities.numPessoas;
    }
    if (analysis.entities.passeio && context.tempData) {
      context.tempData.passeio = analysis.entities.passeio;
    }
    if (analysis.entities.cpf && context.tempData) {
      context.tempData.cpf = analysis.entities.cpf;
    }

    if (analysis.intent === 'reclamacao') {
      await notifyBusiness({
        type: 'RECLAMACAO',
        data: {
          telefone,
          nome: context.nome,
          mensagem: message
        }
      });
    }

    if (context.currentFlow === 'pagamento') {
      const response = await handlePagamentoFlow(telefone, message, context, analysis);
      await saveAndLogContext(context, message, analysis, response, startTime);
      return response;
    }

    if (context.currentFlow === 'reserva') {
      const response = await handleReservaFlow(telefone, message, context, analysis);
      await saveAndLogContext(context, message, analysis, response, startTime);
      return response;
    }

    if (analysis.intent === 'pagamento' && analysis.confidence > 0.6) {
      context.currentFlow = 'pagamento';
      context.flowStep = 'inicial';
      if (!context.tempData) context.tempData = {};
      context.tempData.cpf = analysis.entities.cpf;
      
      const response = await handlePagamentoFlow(telefone, message, context, analysis);
      await saveAndLogContext(context, message, analysis, response, startTime);
      return response;
    }

    if (analysis.intent === 'reserva' && analysis.confidence > 0.6) {
      context.currentFlow = 'reserva';
      context.flowStep = 'inicial';
      context.tempData = {
        passeio: analysis.entities.passeio,
        data: analysis.entities.data,
        numPessoas: analysis.entities.numPessoas
      };

      const response = await handleReservaFlow(telefone, message, context, analysis);
      await saveAndLogContext(context, message, analysis, response, startTime);
      return response;
    }

    const memoryPrompts = buildMemoryPrompts(context);
    const response = await generateAIResponse(
      message, 
      context.conversationHistory,
      context.nome,
      memoryPrompts
    );

    captureMemoriesFromInteraction(context, analysis, message);
    await saveAndLogContext(context, message, analysis, response, startTime);
    return response;

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Ops, deu um probleminha aqui! 😅\nMe manda de novo ou liga: (22) 99824-9911';
  }
}

async function saveAndLogContext(
  context: ConversationContext,
  message: string,
  analysis: any,
  response: string,
  startTime: number
): Promise<void> {
  context.conversationHistory.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  if (context.conversationHistory.length > 20) {
    context.conversationHistory = context.conversationHistory.slice(-20);
  }

  context.lastMessage = message;
  context.lastIntent = analysis.intent;
  context.lastMessageTime = new Date().toISOString();
  await saveConversationContext(context);

  console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
}

async function handlePagamentoFlow(
  telefone: string,
  message: string,
  context: ConversationContext,
  analysis: any
): Promise<string> {
  if (!context.tempData) {
    context.tempData = {};
  }

  const hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  const hasData = !!context.tempData.data;
  const hasPessoas = !!context.tempData.numPessoas;
  const hasNome = !!context.nome;
  const hasCpf = !!context.tempData.cpf;

  if (!hasPasseio || !hasData || !hasPessoas || !hasNome) {
    context.currentFlow = 'reserva';
    context.flowStep = 'inicial';
    return await handleReservaFlow(telefone, message, context, analysis);
  }

  if (!hasCpf) {
    const cpfFromMessage = extractCPFFromMessage(message);
    if (cpfFromMessage) {
      context.tempData.cpf = cpfFromMessage;
    } else {
      return `${context.nome?.split(' ')[0]}, pra gerar o pagamento preciso do seu CPF 📋\n\nPode mandar? (só os números tá bom)`;
    }
  }

  const formaPagamento = analysis.entities.formaPagamento || detectPaymentFromMessage(message);

  if (!formaPagamento && context.flowStep !== 'aguardando_pagamento') {
    context.flowStep = 'escolha_pagamento';
    return `Beleza ${context.nome?.split(' ')[0]}! 😊\n\nComo você prefere pagar?\n\n1️⃣ *PIX* (instantâneo)\n2️⃣ *Boleto* (até 3 dias)\n\nResponde com 1 ou 2, ou escreve "pix" ou "boleto"`;
  }

  if (context.flowStep === 'aguardando_pagamento') {
    return `Seu pagamento já foi gerado! 😊\n\nAssim que identificarmos o pagamento, você receberá o voucher automaticamente.\n\nPrecisa de ajuda? Liga: (22) 99824-9911`;
  }

  const selectedPayment = formaPagamento || (message.includes('1') ? 'pix' : message.includes('2') ? 'boleto' : null);

  if (!selectedPayment) {
    return `Não entendi 🤔\n\nDigita *1* para PIX ou *2* para Boleto`;
  }

  try {
    const passeios = await getAllPasseios();
    let passeioSelecionado = context.tempData.passeioId
      ? passeios.find(p => p.id === context.tempData!.passeioId)
      : passeios.find(p => {
          const target = normalizeString(context.tempData!.passeio || '');
          const nome = normalizeString(p.nome);
          return nome.includes(target) || target.includes(normalizeString(p.nome.split('-')[0]));
        });

    if (!passeioSelecionado) {
      passeioSelecionado = passeios[0];
    }

    const valorPorPessoa = passeioSelecionado.preco_min && passeioSelecionado.preco_max
      ? (passeioSelecionado.preco_min + passeioSelecionado.preco_max) / 2
      : passeioSelecionado.preco_min || passeioSelecionado.preco_max || 200;
    const valorTotal = valorPorPessoa * (context.tempData.numPessoas || 1);

    const asaasCustomer = await findOrCreateCustomer({
      name: context.nome!,
      cpfCnpj: context.tempData.cpf!,
      phone: telefone
    });

    const voucherCode = generateVoucherCode();
    const externalRef = `${voucherCode}-${telefone}`;

    if (selectedPayment === 'pix') {
      const pixPayment = await createPixPayment({
        customerId: asaasCustomer.id,
        value: valorTotal,
        description: `${passeioSelecionado.nome} - ${context.tempData.numPessoas} pessoa(s) - ${context.tempData.data}`,
        externalReference: externalRef
      });

      context.tempData.paymentId = pixPayment.paymentId;
      context.tempData.voucherCode = voucherCode;
      context.flowStep = 'aguardando_pagamento';

      await saveReservaPendente(telefone, context, passeioSelecionado, valorTotal, voucherCode, pixPayment.paymentId);

      return formatPixMessage({
        pixCopiaECola: pixPayment.pixCopiaECola,
        value: valorTotal,
        passeioNome: passeioSelecionado.nome,
        clienteNome: context.nome!
      });

    } else {
      const boletoPayment = await createBoletoPayment({
        customerId: asaasCustomer.id,
        value: valorTotal,
        description: `${passeioSelecionado.nome} - ${context.tempData.numPessoas} pessoa(s) - ${context.tempData.data}`,
        externalReference: externalRef
      });

      context.tempData.paymentId = boletoPayment.paymentId;
      context.tempData.voucherCode = voucherCode;
      context.flowStep = 'aguardando_pagamento';

      await saveReservaPendente(telefone, context, passeioSelecionado, valorTotal, voucherCode, boletoPayment.paymentId);

      return formatBoletoMessage({
        boletoUrl: boletoPayment.boletoUrl,
        barCode: boletoPayment.barCode,
        value: valorTotal,
        dueDate: boletoPayment.dueDate,
        passeioNome: passeioSelecionado.nome,
        clienteNome: context.nome!
      });
    }

  } catch (error) {
    console.error('❌ Erro ao gerar pagamento:', error);
    context.currentFlow = undefined;
    context.flowStep = undefined;
    return `Ops, deu um erro ao gerar o pagamento 😔\n\nPode tentar de novo ou ligar: (22) 99824-9911`;
  }
}

async function saveReservaPendente(
  telefone: string,
  context: ConversationContext,
  passeio: any,
  valorTotal: number,
  voucherCode: string,
  paymentId: string
): Promise<void> {
  try {
    const cliente = await getOrCreateCliente(telefone, context.nome);
    if (!cliente) return;

    await createReserva({
      cliente_id: cliente.id,
      passeio_id: passeio.id,
      data_passeio: context.tempData!.data!,
      num_pessoas: context.tempData!.numPessoas!,
      voucher: voucherCode,
      status: 'PENDENTE',
      valor_total: valorTotal,
      observacoes: `Aguardando pagamento - ID: ${paymentId}`
    });

    await notifyBusiness({
      type: 'NOVA_RESERVA',
      data: {
        nome: context.nome,
        telefone,
        passeio: passeio.nome,
        data: context.tempData!.data,
        numPessoas: context.tempData!.numPessoas,
        voucher: voucherCode,
        valor: valorTotal,
        status: 'AGUARDANDO PAGAMENTO'
      }
    });
  } catch (error) {
    console.error('Erro ao salvar reserva pendente:', error);
  }
}

async function handleReservaFlow(
  telefone: string,
  message: string,
  context: ConversationContext,
  analysis: any
): Promise<string> {
  
  if (!context.tempData) {
    context.tempData = {};
  }

  let hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  const hasData = !!context.tempData.data;
  const hasPessoas = !!context.tempData.numPessoas;
  const hasNome = !!context.nome;

  if (!hasPasseio && context.tempData.optionList?.length) {
    const normalizedMessage = normalizeString(message);
    const selectionIndex = detectOptionSelection(normalizedMessage);

    if (selectionIndex !== null && context.tempData.optionList[selectionIndex]) {
      context.tempData.passeio = context.tempData.optionList[selectionIndex];
      if (context.tempData.optionIds?.[selectionIndex]) {
        context.tempData.passeioId = context.tempData.optionIds[selectionIndex];
      }
      context.tempData.optionList = undefined;
      context.tempData.optionIds = undefined;
    } else {
      const matchedIndex = context.tempData.optionList.findIndex(option =>
        normalizedMessage.includes(normalizeString(option.split('-')[0]))
      );

      if (matchedIndex >= 0) {
        context.tempData.passeio = context.tempData.optionList[matchedIndex];
        if (context.tempData.optionIds?.[matchedIndex]) {
          context.tempData.passeioId = context.tempData.optionIds[matchedIndex];
        }
        context.tempData.optionList = undefined;
        context.tempData.optionIds = undefined;
      }
    }

    hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  }

  if (!hasPasseio) {
    const passeios = await getAllPasseios();
    const top3 = passeios.slice(0, 3);

    context.tempData.optionList = top3.map((p) => p.nome);
    context.tempData.optionIds = top3.map((p) => p.id);

    const opcoes = top3.map((p, i) => {
      const nome = p.nome.split('-')[0].trim();
      const faixa = p.preco_min && p.preco_max ? `R$ ${p.preco_min}-${p.preco_max}` : 'Consulte';
      return `${i + 1}. ${nome} (${faixa})`;
    }).join('\n');

    return `Legal! Vamos fazer sua reserva 😊\n\nQual passeio te interessa?\n\n${opcoes}\n\nPode responder com o número (1, 2 ou 3) ou digitar o nome.\nSe preferir outro, é só me contar!`;
  }

  if (!hasData) {
    return `Show! ${context.nome ? context.nome.split(' ')[0] + ', ' : ''}pra qual dia você quer ir?\n\nPode ser: "amanhã", "sábado", "15/02"...`;
  }

  if (!hasPessoas) {
    return `Beleza! Quantas pessoas vão no passeio?`;
  }

  if (!hasNome) {
    return `Perfeito! Só preciso do seu nome completo pra reserva 😊`;
  }

  context.currentFlow = 'pagamento';
  context.flowStep = 'inicial';

  const passeios = await getAllPasseios();
  let passeioSelecionado = context.tempData.passeioId
    ? passeios.find(p => p.id === context.tempData!.passeioId)
    : passeios.find(p => {
        const target = normalizeString(context.tempData!.passeio || '');
        const nome = normalizeString(p.nome);
        return nome.includes(target) || target.includes(normalizeString(p.nome.split('-')[0]));
      });

  if (!passeioSelecionado) {
    passeioSelecionado = passeios[0];
  }

  const valorPorPessoa = passeioSelecionado?.preco_min && passeioSelecionado?.preco_max
    ? (passeioSelecionado.preco_min + passeioSelecionado.preco_max) / 2
    : passeioSelecionado?.preco_min || passeioSelecionado?.preco_max || 200;
  const valorTotal = valorPorPessoa * (context.tempData.numPessoas || 1);

  return `Perfeito ${context.nome?.split(' ')[0]}! 🎉\n\n📋 *Resumo da Reserva:*\n🚤 ${passeioSelecionado?.nome}\n📅 ${context.tempData.data}\n👥 ${context.tempData.numPessoas} pessoa(s)\n💰 *R$ ${valorTotal.toFixed(2)}*\n\nPra confirmar, preciso do seu CPF e forma de pagamento:\n\n1️⃣ *PIX* (confirma na hora)\n2️⃣ *Boleto* (até 3 dias)\n\nManda seu CPF e escolhe: "pix" ou "boleto" 😊`;
}

export async function processPaymentConfirmation(
  paymentId: string,
  externalReference: string,
  status: string
): Promise<void> {
  if (!['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(status)) {
    return;
  }

  try {
    const [voucherCode, telefone] = externalReference.split('-');
    if (!telefone) return;

    const context = await getConversationContext(telefone);

    const passeios = await getAllPasseios();
    let passeioSelecionado = context.tempData?.passeioId
      ? passeios.find(p => p.id === context.tempData!.passeioId)
      : passeios.find(p => {
          const target = normalizeString(context.tempData?.passeio || '');
          return normalizeString(p.nome).includes(target);
        });

    if (!passeioSelecionado) {
      passeioSelecionado = passeios[0];
    }

    const valorPorPessoa = passeioSelecionado?.preco_min || 200;
    const valorTotal = valorPorPessoa * (context.tempData?.numPessoas || 1);

    const voucherMessage = formatVoucher({
      voucherCode: voucherCode || context.tempData?.voucherCode || generateVoucherCode(),
      clienteNome: context.nome || 'Cliente',
      passeioNome: passeioSelecionado?.nome || 'Passeio',
      data: context.tempData?.data || 'A confirmar',
      horario: '09:00',
      numPessoas: context.tempData?.numPessoas || 1,
      valorTotal,
      pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo'
    });

    await sendWhatsAppMessage(`whatsapp:${telefone}`, `✅ *PAGAMENTO CONFIRMADO!*\n\n${voucherMessage}`);

    context.currentFlow = undefined;
    context.flowStep = undefined;
    context.tempData = {};
    await saveConversationContext(context);

    rememberMemory(context, {
      type: 'booking',
      value: `Reserva confirmada: ${passeioSelecionado?.nome} em ${context.tempData?.data}. Voucher: ${voucherCode}`,
      tags: ['reserva_confirmada']
    });

  } catch (error) {
    console.error('Erro ao processar confirmação de pagamento:', error);
  }
}

function extractCPFFromMessage(message: string): string | undefined {
  const cpfMatch = message.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (cpfMatch) {
    return cpfMatch[0].replace(/\D/g, '');
  }

  const numbersOnly = message.replace(/\D/g, '');
  if (numbersOnly.length === 11) {
    return numbersOnly;
  }

  return undefined;
}

function detectPaymentFromMessage(message: string): 'pix' | 'boleto' | null {
  const lower = message.toLowerCase();
  if (lower.includes('pix')) return 'pix';
  if (lower.includes('boleto')) return 'boleto';
  return null;
}

function normalizeString(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OPTION_KEYWORDS: Record<string, number> = {
  'primeiro': 0, 'primeira': 0, 'opcao 1': 0, 'opção 1': 0,
  'numero 1': 0, 'número 1': 0, 'um': 0, 'uma': 0,
  'segundo': 1, 'segunda': 1, 'opcao 2': 1, 'opção 2': 1,
  'numero 2': 1, 'número 2': 1, 'dois': 1, 'duas': 1,
  'terceiro': 2, 'terceira': 2, 'opcao 3': 2, 'opção 3': 2,
  'numero 3': 2, 'número 3': 2, 'tres': 2, 'três': 2
};

function detectOptionSelection(message: string): number | null {
  if (!message) return null;

  const numericMatch = message.match(/\b([1-9])\b/);
  if (numericMatch) {
    const idx = parseInt(numericMatch[1], 10) - 1;
    if (idx >= 0) {
      return idx;
    }
  }

  for (const [keyword, index] of Object.entries(OPTION_KEYWORDS)) {
    if (message.includes(keyword)) {
      return index;
    }
  }

  return null;
}

function ensureMemoryContainer(context: ConversationContext) {
  if (!context.metadata) {
    context.metadata = { memories: [] };
  }
  if (!Array.isArray(context.metadata.memories)) {
    context.metadata.memories = [];
  }
}

function rememberMemory(
  context: ConversationContext,
  entry: { type: MemoryEntry['type']; value: string; tags?: string[] }
) {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;

  const existingWithSameTag = entry.tags?.[0]
    ? memories.findIndex(memory => memory.type === entry.type && memory.tags?.includes(entry.tags![0]))
    : -1;
  if (existingWithSameTag >= 0) {
    memories.splice(existingWithSameTag, 1);
  }

  const duplicate = memories.find(memory =>
    memory.type === entry.type && memory.value.toLowerCase() === entry.value.toLowerCase()
  );
  if (duplicate) {
    return;
  }

  const newEntry: MemoryEntry = {
    id: `${entry.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: entry.type,
    value: entry.value,
    createdAt: new Date().toISOString(),
    tags: entry.tags
  };

  memories.push(newEntry);
  if (memories.length > 40) {
    context.metadata!.memories = memories.slice(-40);
  }
}

function buildMemoryPrompts(context: ConversationContext): string[] {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;
  if (!memories.length) {
    return [];
  }
  return memories.slice(-5).map(memory => memory.value);
}

function captureMemoriesFromInteraction(context: ConversationContext, analysis: any, message: string) {
  ensureMemoryContainer(context);
  const normalized = normalizeString(message);

  if (context.nome) {
    const preferredName = context.nome.split(' ')[0];
    rememberMemory(context, {
      type: 'profile',
      value: `Prefere ser chamado de ${preferredName}`,
      tags: ['nome']
    });
  }

  const passeioEntity = analysis?.entities?.passeio;
  if (passeioEntity) {
    const preferenceKeywords = ['prefir', 'gost', 'amo', 'ador', 'sempre', 'sonho', 'quero muito'];
    if (preferenceKeywords.some(keyword => normalized.includes(keyword))) {
      rememberMemory(context, {
        type: 'preference',
        value: `Curte o passeio ${passeioEntity}`,
        tags: ['passeio', passeioEntity]
      });
    }
  }

  if (normalized.includes('lua de mel')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Está planejando lua de mel',
      tags: ['lua-de-mel']
    });
  }

  if (normalized.includes('aniversar')) {
    rememberMemory(context, {
      type: 'history',
      value: 'Busca um passeio para aniversário',
      tags: ['aniversario']
    });
  }

  if (normalized.includes('famil') || normalized.includes('esposa') || normalized.includes('esposo')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Normalmente viaja em família/casal',
      tags: ['familia']
    });
  }

  if (normalized.includes('crianca') || normalized.includes('criancas') || normalized.includes('filh')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Viaja com crianças',
      tags: ['criancas']
    });
  }

  const groupSize = analysis?.entities?.numPessoas;
  if (groupSize && (normalized.includes('somos') || normalized.includes('vamos') || normalized.includes('seremos'))) {
    rememberMemory(context, {
      type: 'profile',
      value: `Costuma viajar em grupo de ${groupSize} pessoa(s)`,
      tags: ['grupo']
    });
  }
}
