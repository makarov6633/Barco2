import { 
  getConversationContext, 
  saveConversationContext, 
  getOrCreateCliente,
  getAllPasseios,
  createReserva,
  createCobranca,
  generateVoucherCode,
  ConversationContext,
  MemoryEntry 
} from './supabase';
import { generateAIResponse, detectIntentWithAI } from './groq-ai';
import { notifyBusiness, formatVoucher } from './twilio';
import { findOrCreateCustomer, createPixPayment, createBoletoPayment, formatPixMessage, formatBoletoMessage } from './asaas';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`📥 ${telefone}: ${message}`);
    const context = await getConversationContext(telefone);
    ensureMemoryContainer(context);
    
    const analysis = await detectIntentWithAI(message);
    console.log(`🎯 Intent: ${analysis.intent} (${Math.round(analysis.confidence * 100)}%)`);

    if (analysis.entities.nome && !context.nome) context.nome = analysis.entities.nome;
    if (analysis.entities.data && context.tempData) context.tempData.data = analysis.entities.data;
    if (analysis.entities.numPessoas && context.tempData) context.tempData.numPessoas = analysis.entities.numPessoas;
    if (analysis.entities.passeio && context.tempData) context.tempData.passeio = analysis.entities.passeio;

    if (analysis.intent === 'reclamacao') {
      await notifyBusiness({ type: 'RECLAMACAO', data: { telefone, nome: context.nome, mensagem: message } });
    }

    if ((analysis.intent === 'pagamento' || analysis.intent === 'pix' || analysis.intent === 'boleto') && context.tempData?.reservaId && context.tempData?.valorTotal) {
      const formaPagamento = analysis.entities.formaPagamento || (message.toLowerCase().includes('boleto') ? 'boleto' : 'pix');
      const response = await gerarCobranca(telefone, context, formaPagamento);
      context.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: response });
      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);
      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    if (context.currentFlow === 'reserva') {
      const response = await handleReservaFlow(telefone, message, context, analysis);
      captureMemoriesFromInteraction(context, analysis, message);
      context.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: response });
      if (context.conversationHistory.length > 20) context.conversationHistory = context.conversationHistory.slice(-20);
      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);
      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    if (analysis.intent === 'reserva' && analysis.confidence > 0.6) {
      context.currentFlow = 'reserva';
      context.flowStep = 'inicial';
      context.tempData = { passeio: analysis.entities.passeio, data: analysis.entities.data, numPessoas: analysis.entities.numPessoas };
      const response = await handleReservaFlow(telefone, message, context, analysis);
      captureMemoriesFromInteraction(context, analysis, message);
      context.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: response });
      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);
      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    const memoryPrompts = buildMemoryPrompts(context);
    const response = await generateAIResponse(message, context.conversationHistory, context.nome, memoryPrompts);
    captureMemoriesFromInteraction(context, analysis, message);
    context.conversationHistory.push({ role: 'user', content: message }, { role: 'assistant', content: response });
    if (context.conversationHistory.length > 20) context.conversationHistory = context.conversationHistory.slice(-20);
    context.lastMessage = message;
    context.lastIntent = analysis.intent;
    context.lastMessageTime = new Date().toISOString();
    await saveConversationContext(context);
    console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
    return response;

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Ops, deu um probleminha aqui! 😅\nMe manda de novo ou liga: (22) 99824-9911';
  }
}

async function handleReservaFlow(telefone: string, message: string, context: ConversationContext, analysis: any): Promise<string> {
  if (!context.tempData) context.tempData = {};

  let hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  const hasData = !!context.tempData.data;
  const hasPessoas = !!context.tempData.numPessoas;
  const hasNome = !!context.nome;

  if (!hasPasseio && context.tempData.optionList?.length) {
    const normalizedMessage = normalizeString(message);
    const selectionIndex = detectOptionSelection(normalizedMessage);
    if (selectionIndex !== null && context.tempData.optionList[selectionIndex]) {
      context.tempData.passeio = context.tempData.optionList[selectionIndex];
      if (context.tempData.optionIds?.[selectionIndex]) context.tempData.passeioId = context.tempData.optionIds[selectionIndex];
      context.tempData.optionList = undefined;
      context.tempData.optionIds = undefined;
    }
    hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  }

  if (!hasPasseio) {
    const passeios = await getAllPasseios();
    const top5 = passeios.slice(0, 5);
    context.tempData.optionList = top5.map(p => p.nome);
    context.tempData.optionIds = top5.map(p => p.id);
    const opcoes = top5.map((p, i) => {
      const faixa = (p.preco_min != null && p.preco_max != null)
        ? `R$ ${p.preco_min}-${p.preco_max}`
        : (p.preco_min != null)
          ? `R$ ${p.preco_min}`
          : (p.preco_max != null)
            ? `R$ ${p.preco_max}`
            : 'Consulte';
      return `${i + 1}. ${p.nome.split('-')[0].trim()} (${faixa})`;
    }).join('\n');
    return `Legal! Vamos fazer sua reserva 😊\n\nQual passeio te interessa?\n\n${opcoes}\n\nResponde com o número ou nome!`;
  }

  if (!hasData) return `Show! ${context.nome ? context.nome.split(' ')[0] + ', ' : ''}pra qual dia você quer ir?\n\nPode ser: "amanhã", "sábado", "15/01"...`;
  if (!hasPessoas) return `Beleza! Quantas pessoas vão no passeio? 👥`;
  if (!hasNome) return `Perfeito! Qual seu nome completo? 😊\n(Preciso pra gerar o voucher)`;

  return await criarReservaECobrar(telefone, context);
}

async function criarReservaECobrar(telefone: string, context: ConversationContext): Promise<string> {
  try {
    const passeios = await getAllPasseios();
    let passeioSelecionado = context.tempData?.passeioId ? passeios.find(p => p.id === context.tempData!.passeioId) : undefined;
    if (!passeioSelecionado && context.tempData?.passeio) {
      const target = normalizeString(context.tempData.passeio);
      passeioSelecionado = passeios.find(p => normalizeString(p.nome).includes(target) || normalizeString(p.categoria || '').includes(target));
    }

    if (!passeioSelecionado) {
      context.currentFlow = undefined;
      context.tempData = {};
      return 'Hmm, não encontrei esse passeio 🤔\nQuer ver a lista? Me diz "ver passeios"';
    }

    const cliente = await getOrCreateCliente(telefone, context.nome);
    if (!cliente) return 'Ops, erro ao criar seu cadastro 😔\nLiga: (22) 99824-9911';

    const valorPorPessoa = (passeioSelecionado.preco_min != null && passeioSelecionado.preco_max != null)
      ? Math.round((passeioSelecionado.preco_min + passeioSelecionado.preco_max) / 2)
      : (passeioSelecionado.preco_min != null)
        ? passeioSelecionado.preco_min
        : (passeioSelecionado.preco_max != null)
          ? passeioSelecionado.preco_max
          : null;

    if (valorPorPessoa == null) {
      context.currentFlow = undefined;
      return 'No momento eu não tenho o valor desse passeio cadastrado na tabela 😔\nVou confirmar com a equipe e já te retorno.\n\nSe preferir, chama no (22) 99824-9911.';
    }
    const numPessoas = context.tempData!.numPessoas!;
    const dataPasseio = context.tempData!.data!;
    const valorTotal = valorPorPessoa * numPessoas;

    const reserva = await createReserva({
      cliente_id: cliente.id,
      passeio_id: passeioSelecionado.id,
      data_passeio: dataPasseio,
      num_pessoas: numPessoas,
      voucher: 'AGUARDANDO_PAGAMENTO',
      status: 'PENDENTE',
      valor_total: valorTotal,
      observacoes: 'Reserva via WhatsApp'
    });

    if (!reserva) return 'Erro ao criar reserva 😔\nLiga: (22) 99824-9911';

    context.tempData!.reservaId = reserva.id;
    context.tempData!.valorTotal = valorTotal;
    context.tempData!.passeioNome = passeioSelecionado.nome;

    const primeiroNome = context.nome?.split(' ')[0] || 'cliente';
    return `Perfeito, ${primeiroNome}! 🎉\n\n📋 *Resumo da Reserva:*\n🚤 ${passeioSelecionado.nome}\n📅 ${dataPasseio}\n👥 ${numPessoas} pessoa(s)\n💰 *Total: R$ ${valorTotal.toFixed(2)}*\n\nComo prefere pagar?\n\n1️⃣ *PIX* (aprovação instantânea ⚡)\n2️⃣ *Boleto* (até 3 dias úteis)\n\nResponde "PIX" ou "Boleto" 😊`;
  } catch (error) {
    console.error('❌ Erro ao criar reserva:', error);
    context.currentFlow = undefined;
    context.tempData = {};
    return 'Ops, deu erro ao finalizar 😔\nLiga: (22) 99824-9911';
  }
}

async function gerarCobranca(telefone: string, context: ConversationContext, tipo: 'pix' | 'boleto'): Promise<string> {
  try {
    const { reservaId, valorTotal, passeioNome } = context.tempData || {};
    if (!reservaId || !valorTotal) return 'Não encontrei sua reserva pendente 🤔\nQuer fazer uma nova? Me diz "quero reservar"';

    const cliente = await getOrCreateCliente(telefone, context.nome);
    if (!cliente) return 'Erro ao acessar seus dados 😔\nLiga: (22) 99824-9911';

    const asaasCustomer = await findOrCreateCustomer({ name: context.nome || 'Cliente', phone: telefone.replace(/\D/g, ''), email: cliente.email || undefined });

    if (tipo === 'pix') {
      const { payment, pixQrCode } = await createPixPayment({ customerId: asaasCustomer.id, value: valorTotal, description: `${passeioNome || 'Passeio'} - ${context.tempData?.data}`, externalReference: reservaId });
      await createCobranca({ reserva_id: reservaId, cliente_id: cliente.id, asaas_id: payment.id, tipo: 'PIX', valor: valorTotal, status: 'PENDENTE', pix_qrcode: pixQrCode.encodedImage, pix_copiacola: pixQrCode.payload, vencimento: pixQrCode.expirationDate });
      context.currentFlow = undefined;
      context.flowStep = undefined;
      return formatPixMessage(pixQrCode, valorTotal);
    } else {
      const payment = await createBoletoPayment({ customerId: asaasCustomer.id, value: valorTotal, description: `${passeioNome || 'Passeio'} - ${context.tempData?.data}`, externalReference: reservaId });
      await createCobranca({ reserva_id: reservaId, cliente_id: cliente.id, asaas_id: payment.id, tipo: 'BOLETO', valor: valorTotal, status: 'PENDENTE', boleto_url: payment.bankSlipUrl, vencimento: payment.dueDate });
      context.currentFlow = undefined;
      context.flowStep = undefined;
      return formatBoletoMessage(payment, valorTotal);
    }
  } catch (error) {
    console.error('❌ Erro ao gerar cobrança:', error);
    return `Ops, erro ao gerar ${tipo === 'pix' ? 'PIX' : 'boleto'} 😔\n\nVocê pode pagar direto via PIX manual:\n📱 CNPJ: 26.096.072/0001-78\n🏦 Banco Inter\n\nDepois me manda o comprovante!\n📞 (22) 99824-9911`;
  }
}

function normalizeString(value?: string): string {
  if (!value) return '';
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

const OPTION_KEYWORDS: Record<string, number> = { 'primeiro': 0, 'primeira': 0, 'um': 0, '1': 0, 'segundo': 1, 'segunda': 1, 'dois': 1, '2': 1, 'terceiro': 2, 'terceira': 2, 'tres': 2, '3': 2, 'quarto': 3, 'quatro': 3, '4': 3, 'quinto': 4, 'cinco': 4, '5': 4 };

function detectOptionSelection(message: string): number | null {
  if (!message) return null;
  const numericMatch = message.match(/\b([1-5])\b/);
  if (numericMatch) return parseInt(numericMatch[1], 10) - 1;
  for (const [keyword, index] of Object.entries(OPTION_KEYWORDS)) {
    if (message.includes(keyword)) return index;
  }
  return null;
}

function ensureMemoryContainer(context: ConversationContext) {
  if (!context.metadata) context.metadata = { memories: [] };
  if (!Array.isArray(context.metadata.memories)) context.metadata.memories = [];
}

function rememberMemory(context: ConversationContext, entry: { type: MemoryEntry['type']; value: string; tags?: string[] }) {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;
  const duplicate = memories.find(m => m.type === entry.type && m.value.toLowerCase() === entry.value.toLowerCase());
  if (duplicate) return;
  memories.push({ id: `${entry.type}-${Date.now()}`, type: entry.type, value: entry.value, createdAt: new Date().toISOString(), tags: entry.tags });
  if (memories.length > 40) context.metadata!.memories = memories.slice(-40);
}

function buildMemoryPrompts(context: ConversationContext): string[] {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;
  return memories.slice(-5).map(m => m.value);
}

function captureMemoriesFromInteraction(context: ConversationContext, analysis: any, message: string) {
  ensureMemoryContainer(context);
  const normalized = normalizeString(message);
  if (context.nome) rememberMemory(context, { type: 'profile', value: `Prefere ser chamado de ${context.nome.split(' ')[0]}`, tags: ['nome'] });
  if (normalized.includes('lua de mel')) rememberMemory(context, { type: 'profile', value: 'Planejando lua de mel', tags: ['lua-de-mel'] });
  if (normalized.includes('aniversar')) rememberMemory(context, { type: 'history', value: 'Passeio para aniversário', tags: ['aniversario'] });
  if (normalized.includes('crianca') || normalized.includes('filh')) rememberMemory(context, { type: 'profile', value: 'Viaja com crianças', tags: ['criancas'] });
}
