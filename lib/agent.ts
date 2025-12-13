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
import { notifyBusiness, formatVoucher } from './twilio';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`📥 ${telefone}: ${message}`);

    const context = await getConversationContext(telefone);
    ensureMemoryContainer(context);
    
    // Análise com IA
    const analysis = await detectIntentWithAI(message);
    console.log(`🎯 Intent: ${analysis.intent} (${Math.round(analysis.confidence * 100)}%)`);

    // Atualizar contexto com entidades detectadas
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

    // PRIORIDADE 1: Reclamações (alertar equipe)
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

    // PRIORIDADE 2: Atualizar dados da reserva com análise
    if (context.currentFlow === 'reserva') {
      // Atualizar tempData com entidades detectadas
      if (analysis.entities.passeio && !context.tempData?.passeio) {
        context.tempData = context.tempData || {};
        context.tempData.passeio = analysis.entities.passeio;
      }
      if (analysis.entities.data && !context.tempData?.data) {
        context.tempData = context.tempData || {};
        context.tempData.data = analysis.entities.data;
      }
      if (analysis.entities.numPessoas && !context.tempData?.numPessoas) {
        context.tempData = context.tempData || {};
        context.tempData.numPessoas = analysis.entities.numPessoas;
      }
      if (analysis.entities.nome && !context.nome) {
        context.nome = analysis.entities.nome;
      }
      
      // Se for uma seleção numérica e temos opções
      if (context.tempData?.optionList?.length) {
        const normalizedMessage = normalizeString(message);
        const selectionIndex = detectOptionSelection(normalizedMessage);

        if (selectionIndex !== null && context.tempData.optionList[selectionIndex]) {
          context.tempData.passeio = context.tempData.optionList[selectionIndex];
          if (context.tempData.optionIds?.[selectionIndex]) {
            context.tempData.passeioId = context.tempData.optionIds[selectionIndex];
          }
          context.tempData.optionList = undefined;
          context.tempData.optionIds = undefined;
        }
      }
    }

    // PRIORIDADE 3: Conversa com contexto especial (preço, reserva, etc)
    // A IA interpreta e responde naturalmente com os dados do banco

    // PRIORIDADE 4: Conversa com IA (sempre)
    const memoryPrompts = buildMemoryPrompts(context);

    // Buscar passeios do banco de dados para fornecer informações precisas
    const passeios = await getAllPasseios();
    const passeiosInfo = passeios.map(p => 
      `${p.nome} - R$ ${p.preco_min || 'Consulte'} a R$ ${p.preco_max || 'Consulte'} - ${p.duracao || 'Consulte duração'} - ${p.local || ''}`
    ).join('\n');

    // Preparar contexto especial baseado na intenção
    let specialContext = '';
    if (analysis.intent === 'reserva' || context.currentFlow === 'reserva') {
      if (!context.currentFlow) {
        context.currentFlow = 'reserva';
        context.tempData = {
          passeio: analysis.entities.passeio,
          data: analysis.entities.data,
          numPessoas: analysis.entities.numPessoas
        };
      }
      
      const faltando = [];
      if (!context.tempData?.passeio && !context.tempData?.passeioId) faltando.push('qual passeio');
      if (!context.tempData?.data) faltando.push('data');
      if (!context.tempData?.numPessoas) faltando.push('número de pessoas');
      if (!context.nome) faltando.push('nome completo');
      
      if (faltando.length > 0) {
        specialContext = `MODO RESERVA ATIVO: Você está coletando informações para uma reserva. Ainda falta: ${faltando.join(', ')}. Pergunte de forma natural e amigável.`;
      } else {
        // Criar reserva
        const reservaResult = await criarReservaFinal(telefone, context);
        context.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: reservaResult }
        );
        context.lastMessage = message;
        context.lastIntent = analysis.intent;
        context.lastMessageTime = new Date().toISOString();
        await saveConversationContext(context);
        console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
        return reservaResult;
      }
    }

    const response = await generateAIResponse(
      message, 
      context.conversationHistory,
      context.nome,
      memoryPrompts,
      passeiosInfo,
      specialContext
    );

    captureMemoriesFromInteraction(context, analysis, message);

    // Atualizar histórico
    context.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );

    if (context.conversationHistory.length > 20) {
      context.conversationHistory = context.conversationHistory.slice(-20);
    }

    // Salvar contexto
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



async function criarReservaFinal(telefone: string, context: ConversationContext): Promise<string> {
  try {
    const passeios = await getAllPasseios();

    let passeioSelecionado = context.tempData?.passeioId
      ? passeios.find(p => p.id === context.tempData!.passeioId)
      : undefined;

    if (!passeioSelecionado && context.tempData?.passeio) {
      const target = normalizeString(context.tempData.passeio);
      passeioSelecionado = passeios.find(p => {
        const nomeNormalizado = normalizeString(p.nome);
        const categoriaNormalizada = normalizeString(p.categoria || '');
        return nomeNormalizado.includes(target) || categoriaNormalizada.includes(target);
      });
    }

    if (!passeioSelecionado) {
      context.currentFlow = undefined;
      context.tempData = {};
      return 'Hmm, não encontrei esse passeio 🤔\nQuer ver a lista completa? Me diz "ver passeios"';
    }

    const cliente = await getOrCreateCliente(telefone, context.nome);
    if (!cliente) {
      return 'Ops, erro ao criar seu cadastro 😔\nTenta de novo ou liga: (22) 99824-9911';
    }

    const voucherCode = generateVoucherCode();
    const valorPorPessoa = passeioSelecionado.preco_min && passeioSelecionado.preco_max
      ? (passeioSelecionado.preco_min + passeioSelecionado.preco_max) / 2
      : passeioSelecionado.preco_min || passeioSelecionado.preco_max || 200;
    const numPessoas = context.tempData!.numPessoas!;
    const dataPasseio = context.tempData!.data!;
    const valorTotal = valorPorPessoa * numPessoas;

    const reserva = await createReserva({
      cliente_id: cliente.id,
      passeio_id: passeioSelecionado.id,
      data_passeio: dataPasseio,
      num_pessoas: numPessoas,
      voucher: voucherCode,
      status: 'PENDENTE',
      valor_total: valorTotal,
      observacoes: 'Reserva via WhatsApp'
    });

    if (!reserva) {
      return 'Erro ao criar reserva 😔\nLiga pra gente: (22) 99824-9911';
    }

    // Notificar empresa
    await notifyBusiness({
      type: 'NOVA_RESERVA',
      data: {
        nome: context.nome,
        telefone,
        passeio: passeioSelecionado.nome,
        data: dataPasseio,
        numPessoas,
        voucher: voucherCode,
        valor: valorTotal,
        status: 'PENDENTE'
      }
    });

    rememberMemory(context, {
      type: 'booking',
      value: `Reserva ${passeioSelecionado.nome} em ${dataPasseio} para ${numPessoas} pessoa(s). Voucher ${voucherCode}.`,
      tags: ['reserva', passeioSelecionado.id]
    });

    // Resetar fluxo
    context.currentFlow = undefined;
    context.flowStep = undefined;
    context.tempData = {};

    // Gerar voucher formatado
    const voucherMessage = formatVoucher({
      voucherCode,
      clienteNome: context.nome!,
      passeioNome: passeioSelecionado.nome,
      data: dataPasseio || 'A confirmar',
      horario: '09:00',
      numPessoas: numPessoas || 1,
      valorTotal,
      pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo'
    });

    return voucherMessage;

  } catch (error) {
    console.error('❌ Erro ao criar reserva final:', error);
    context.currentFlow = undefined;
    context.tempData = {};
    return 'Ops, deu erro ao finalizar 😔\nLiga pra gente: (22) 99824-9911';
  }
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
  'primeiro': 0,
  'primeira': 0,
  'opcao 1': 0,
  'opção 1': 0,
  'numero 1': 0,
  'número 1': 0,
  'um': 0,
  'uma': 0,
  'segundo': 1,
  'segunda': 1,
  'opcao 2': 1,
  'opção 2': 1,
  'numero 2': 1,
  'número 2': 1,
  'dois': 1,
  'duas': 1,
  'terceiro': 2,
  'terceira': 2,
  'opcao 3': 2,
  'opção 3': 2,
  'numero 3': 2,
  'número 3': 2,
  'tres': 2,
  'três': 2
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
