import { ConversationContext } from './supabase';
import { executeTool, getToolsForPrompt, ToolName } from './agent-tools';
import { groqChat } from './groq-client';
import { parseToolCalls, stripToolBlocks } from './agent-toolcall';

function getBrazilTodayISO() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const y = parts.find(p => p.type === 'year')?.value;
  const m = parts.find(p => p.type === 'month')?.value;
  const d = parts.find(p => p.type === 'day')?.value;

  if (!y || !m || !d) {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return `${y}-${m}-${d}`;
}

function buildSystemPrompt() {
  const tools = getToolsForPrompt();
  const toolsText = tools
    .map(t => {
      const params = JSON.stringify(t.params);
      return `- ${t.name}: ${t.description}\n  params: ${params}`;
    })
    .join('\n');

  return `# IDENTITY\nVocê é o CALEB, assistente virtual da Caleb's Tour em Cabo Frio/RJ. Você é um guia local: simpático, praiano, direto e convidativo.\n\n# OBJETIVO\nAjudar o cliente a escolher passeios, tirar dúvidas, fechar reserva e gerar pagamento (PIX ou boleto).\n\n# REGRAS INVIOLÁVEIS\n1) DADOS REAIS: não invente preços, roteiros, horários ou regras. Se precisar de informação, use uma ferramenta.\n2) RESULTADO DE FERRAMENTA É VERDADE: quando receber \"Resultado da ferramenta ...\", use o JSON como fonte oficial para responder.\n3) NUNCA fale que está consultando banco/sistema; fale como humano (ex: \"Deixa eu ver pra você\").\n4) SEM RESPOSTAS ENGESSADAS: varie e responda de forma contextual ao que a pessoa falou.\n5) Não recomece do zero nem se reapresente a cada mensagem. Use o histórico para entender respostas curtas tipo \"1\", \"amanhã\", \"PIX\".\n6) Se faltar alguma informação para reservar/pagar, faça 1 pergunta objetiva por vez.\n7) Mensagens curtas estilo WhatsApp (normalmente 2–6 linhas).\n\n# FERRAMENTAS\nQuando precisar agir, responda com APENAS o bloco da ferramenta (nenhum texto antes/depois).\nSintaxe: [TOOL:nome]{json}[/TOOL]\nChame apenas 1 ferramenta por vez.\n\nFerramentas disponíveis:\n${toolsText}\n\n# COMO CONDUZIR\n- Perguntas de preço/roteiro: use consultar_passeios ou buscar_passeio_especifico e responda com os dados retornados.\n- Reserva: só chame criar_reserva quando tiver (nome, passeio_id ou passeio, data e num_pessoas).\n- Pagamento: só chame gerar_pagamento quando tiver reserva_id. Se a pessoa pedir pagamento sem reserva, crie a reserva primeiro.\n- Se a ferramenta retornar success=false, explique de forma humana e peça exatamente os dados que faltam.\n\n# ESTILO\nPortuguês-BR, informal, com emojis moderados (🌊🚤☀️😊✨).`;
}

function buildMessages(context: ConversationContext) {
  const systemPrompt = buildSystemPrompt();
  const today = getBrazilTodayISO();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    { role: 'system', content: `Data atual (America/Sao_Paulo): ${today}` }
  ];

  if (context.nome) {
    messages.push({ role: 'system', content: `Nome do cliente (se útil): ${context.nome}` });
  }

  const memories = context.metadata?.memories;
  if (Array.isArray(memories) && memories.length) {
    const last = memories.slice(-5).map(m => `- ${m.value}`).join('\n');
    messages.push({ role: 'system', content: `Memórias do cliente:\n${last}` });
  }

  const history = Array.isArray(context.conversationHistory) ? context.conversationHistory : [];
  const recent = history.slice(-30).filter(m => m?.role && typeof m.content === 'string');

  for (const m of recent) {
    if (m.role === 'system' || m.role === 'user' || m.role === 'assistant') {
      messages.push({ role: m.role as any, content: m.content });
    }
  }

  return messages;
}

export async function runAgentLoop(params: {
  telefone: string;
  userMessage: string;
  context: ConversationContext;
}) {
  const { telefone, userMessage, context } = params;

  context.conversationHistory ||= [];
  context.tempData ||= {};

  context.conversationHistory.push({ role: 'user', content: userMessage });

  const maxSteps = 6;
  let assistant = '';

  for (let step = 0; step < maxSteps; step++) {
    const messages = buildMessages(context);
    assistant = await groqChat({ messages });

    const calls = parseToolCalls(assistant);
    if (!calls.length) {
      const cleaned = stripToolBlocks(assistant);
      return cleaned || 'Tive um erro rapidinho aqui 😅 Pode repetir em uma frase?';
    }

    const first = calls[0];
    const name = first.name as ToolName;

    if (!['consultar_passeios', 'buscar_passeio_especifico', 'criar_reserva', 'gerar_pagamento', 'gerar_voucher'].includes(name)) {
      context.conversationHistory.push({ role: 'assistant', content: assistant });
      context.conversationHistory.push({ role: 'system', content: `Resultado da ferramenta ${first.name}: ${JSON.stringify({ success: false, error: { code: 'unknown_tool', message: 'Ferramenta não permitida.' } })}` });
      continue;
    }

    context.conversationHistory.push({ role: 'assistant', content: assistant });

    const toolResult = await executeTool(name, first.params || {}, { telefone, conversation: context });
    context.conversationHistory.push({ role: 'system', content: `Resultado da ferramenta ${name}: ${JSON.stringify(toolResult)}` });
  }

  return 'Ops! Meu sistema ficou preso aqui 😅 Pode me dizer de novo o que você quer (passeio + data + pessoas)?';
}
