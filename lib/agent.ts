import { getConversationContext, saveConversationContext } from './supabase';
import { runAgentLoop } from './agent-runner';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();

  try {
    const context = await getConversationContext(telefone);
    const userMessage = (message || '').trim();

    if (!userMessage) {
      return 'Me manda sua dúvida em uma frase rapidinho 😊';
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
    console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
    return response;
  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Ops, deu um probleminha aqui 😅\nPode mandar de novo?';
  }
}
