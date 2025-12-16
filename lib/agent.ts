import { ConversationContext, getConversationContext, saveConversationContext } from './supabase';
import { runAgentLoop } from './agent-runner';

function stripToolBlocks(text: string) {
  return (text || '').replace(/\[TOOL:[a-zA-Z0-9_]+\][\s\S]*?\[\/TOOL\]/gi, '').trim();
}

function compactConversationHistory(history: Array<{ role: string; content: string }>) {
  const normalized = (Array.isArray(history) ? history : [])
    .map((entry) => ({
      role: typeof entry?.role === 'string' ? entry.role : 'user',
      content: typeof entry?.content === 'string' ? entry.content : ''
    }))
    .map((entry) => {
      if (entry.role === 'assistant' && /\[TOOL:/i.test(entry.content)) {
        const stripped = stripToolBlocks(entry.content);
        return { ...entry, content: stripped };
      }
      return entry;
    })
    .filter((entry) => entry.content)
    .filter((entry) => !(entry.role === 'system' && /^INSTRUÇÃO:/i.test(entry.content)));

  const out: Array<{ role: string; content: string }> = [];
  let dialogCount = 0;
  let toolCount = 0;

  for (let i = normalized.length - 1; i >= 0; i--) {
    const entry = normalized[i];

    if (entry.role === 'user' || entry.role === 'assistant') {
      if (dialogCount >= 40) continue;
      out.push(entry);
      dialogCount += 1;
      continue;
    }

    if (entry.role === 'system') {
      if (/<tool_result\b/i.test(entry.content)) {
        if (toolCount >= 12) continue;
        out.push(entry);
        toolCount += 1;
      }
      continue;
    }
  }

  out.reverse();
  return out;
}

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();

  try {
    let context: ConversationContext;

    try {
      context = await getConversationContext(telefone);
    } catch (error) {
      console.error('Erro ao carregar contexto (fallback stateless):', error);
      context = {
        telefone,
        conversationHistory: [],
        tempData: {},
        metadata: { memories: [] }
      };
    }

    const userMessage = (message || '').trim();

    if (!userMessage) {
      return 'Por favor, envie sua solicitação em texto para eu te ajudar.';
    }

    if (userMessage.length > 2000) {
      return 'Sua mensagem ficou muito longa. Pode resumir em até 2 frases (passeio, data e quantidade de pessoas)?';
    }

    const response = await runAgentLoop({ telefone, userMessage, context });

    context.lastMessage = userMessage;
    context.lastMessageTime = new Date().toISOString();
    context.conversationHistory ||= [];
    context.conversationHistory.push({ role: 'assistant', content: response });
    context.conversationHistory = compactConversationHistory(context.conversationHistory);

    try {
      await saveConversationContext(context);
    } catch (error) {
      console.error('Erro ao salvar contexto (ignorando):', error);
    }

    console.log(`Respondido em ${Date.now() - startTime}ms`);
    return response;
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return 'Desculpe, tive um problema técnico. Pode enviar novamente sua mensagem, por favor?';
  }
}
