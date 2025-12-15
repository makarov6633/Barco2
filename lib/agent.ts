import { getConversationContext, saveConversationContext } from './supabase';
import { runAgentLoop } from './agent-runner';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();

  try {
    const context = await getConversationContext(telefone);
    const userMessage = (message || '').trim();

    if (!userMessage) {
      return 'Por favor, envie sua solicitação em texto para eu te ajudar.';
    }

    const response = await runAgentLoop({ telefone, userMessage, context });

    context.lastMessage = userMessage;
    context.lastMessageTime = new Date().toISOString();
    context.conversationHistory ||= [];
    context.conversationHistory.push({ role: 'assistant', content: response });
    if (context.conversationHistory.length > 60) {
      context.conversationHistory = context.conversationHistory.slice(-60);
    }

    await saveConversationContext(context);
    console.log(`Respondido em ${Date.now() - startTime}ms`);
    return response;
  } catch (error) {
    console.error('Erro ao processar mensagem:', error);
    return 'Desculpe, tive um problema técnico. Pode enviar novamente sua mensagem, por favor?';
  }
}
