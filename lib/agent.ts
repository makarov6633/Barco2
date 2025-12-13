import { 
  getConversationContext, 
  saveConversationContext, 
  getAllPasseios,
  ConversationContext,
  MemoryEntry 
} from './supabase';
import { generateAIResponse, detectIntentWithAI } from './groq-ai';
import { notifyBusiness } from './twilio';
import { executeTool, AVAILABLE_TOOLS, ToolCall } from './tools';

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

    // PRIORIDADE 2: Atualizar dados com análise
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
    }

    // PRIORIDADE 3: Conversa com IA (sempre)
    const memoryPrompts = buildMemoryPrompts(context);

    // Buscar passeios do banco de dados
    const passeios = await getAllPasseios();
    const passeiosInfo = passeios.map(p => 
      `ID: ${p.id} | ${p.nome} | R$ ${p.preco_min || 'Consulte'}-${p.preco_max || 'Consulte'} | ${p.duracao || 'Consultar'} | ${p.local || ''}`
    ).join('\n');

    // Preparar contexto da conversa
    let conversationContext = '';
    if (context.currentFlow === 'reserva' && context.tempData) {
      const info = [];
      if (context.tempData.passeio) info.push(`Passeio: ${context.tempData.passeio}`);
      if (context.tempData.passeioId) info.push(`ID Passeio: ${context.tempData.passeioId}`);
      if (context.tempData.data) info.push(`Data: ${context.tempData.data}`);
      if (context.tempData.numPessoas) info.push(`Pessoas: ${context.tempData.numPessoas}`);
      if (context.nome) info.push(`Nome: ${context.nome}`);
      if (info.length > 0) {
        conversationContext = `DADOS COLETADOS DA RESERVA: ${info.join(', ')}`;
      }
    }

    // Gerar resposta com IA (pode incluir chamada de ferramenta)
    const aiResult = await generateAIResponse(
      message, 
      context.conversationHistory,
      context.nome,
      memoryPrompts,
      passeiosInfo,
      conversationContext,
      telefone
    );

    let finalResponse = aiResult.response;

    // Se a IA decidiu chamar uma ferramenta, executar
    if (aiResult.toolCall) {
      console.log(`🛠️ IA decidiu usar ferramenta: ${aiResult.toolCall.name}`);
      const toolResult = await executeTool(aiResult.toolCall);
      
      if (toolResult.success) {
        // Passar resultado da ferramenta de volta para IA formular resposta
        const followUpResult = await generateAIResponse(
          `[RESULTADO DA FERRAMENTA ${aiResult.toolCall.name}: ${JSON.stringify(toolResult.data)}]`,
          [...context.conversationHistory, 
            { role: 'user', content: message },
            { role: 'assistant', content: aiResult.response }
          ],
          context.nome,
          memoryPrompts,
          passeiosInfo,
          conversationContext,
          telefone
        );
        finalResponse = followUpResult.response;

        // Se criou reserva, atualizar contexto
        if (aiResult.toolCall.name === 'criar_reserva' && toolResult.data) {
          context.tempData = context.tempData || {};
          context.tempData.reserva_id = toolResult.data.reserva_id;
          context.tempData.voucher_code = toolResult.data.voucher_code;
        }
      } else {
        finalResponse += `\n\n[Erro ao processar: ${toolResult.error}]`;
      }
    }

    captureMemoriesFromInteraction(context, analysis, message);

    // Atualizar histórico
    context.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: finalResponse }
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
    return finalResponse;

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Ops, deu um probleminha aqui! 😅\nMe manda de novo ou liga: (22) 99824-9911';
  }
}



// Funções antigas removidas - IA gerencia tudo via tools

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
