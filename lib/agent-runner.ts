import { ConversationContext } from './supabase';
import { executeTool, ToolName } from './agent-tools';
import { groqChat } from './groq-client';
import { parseToolCalls, stripToolBlocks } from './agent-toolcall';

function normalizeString(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shouldForceToolForUserMessage(userMessage: string) {
  const t = normalizeString(userMessage);
  if (!t) return false;

  const refusals = [
    'nao vou passar cpf',
    'nao passo cpf',
    'sem cpf',
    'nao tenho cpf',
    'nao vou informar cpf',
    'i dont have cpf',
    'i won t give cpf',
    'no cpf',
    'without cpf',
    'nao vou passar cnpj',
    'nao passo cnpj',
    'sem cnpj',
    'nao tenho cnpj'
  ];
  if (refusals.some(r => t.includes(r))) return false;

  const keywords = [
    'preco',
    'valor',
    'quanto',
    'custa',
    'tabela',
    'passeio',
    'barco',
    'buggy',
    'quadriciclo',
    'mergulho',
    'snorkel',
    'paramotor',
    'jetski',
    'jet ski',
    'escuna',
    'lancha',
    'transfer',
    'city',
    'combo',
    'open bar',
    'price',
    'cost',
    'how much',
    'book',
    'booking',
    'reserve',
    'reservation',
    'availability',
    'available',
    'pay',
    'payment',
    'invoice',
    'bill',
    'precio',
    'cuanto',
    'reservar',
    'pagar',
    'pago',
    'factura',
    'cancelar',
    'cancelamento',
    'cancel',
    'cancellation',
    'refund',
    'reembolso',
    'estorno',
    'taxa',
    'fee',
    'tax',
    'embarque',
    'checkin',
    'check in',
    'check-in',
    'horario',
    'hora',
    'schedule',
    'time',
    'onde',
    'where',
    'address',
    'endereco',
    'location',
    'localizacao',
    'crianca',
    'criança',
    'child',
    'kids',
    'idade',
    'age',
    'politica',
    'policy'
  ];

  return keywords.some(k => t.includes(k));
}

function looksLikeStall(text: string) {
  const t = normalizeString(text);
  if (!t) return false;
  return (
    (t.includes('deixa eu ver') ||
      t.includes('aguarde') ||
      t.includes('um instante') ||
      t.includes('ja estou verificando') ||
      t.includes('ja vou ver')) &&
    t.length < 180
  );
}

function looksLikeHallucinatedToolResult(text: string) {
  if (!text) return false;
  if (/<tool_result/i.test(text)) return true;
  if (/resultado\s+da\s+ferramenta/i.test(text)) return true;
  if (/"success"\s*:/i.test(text)) return true;
  if (/\btool_result\b/i.test(text)) return true;
  if (/<\|assistant/i.test(text) || /<\|channel\|>/i.test(text)) return true;
  return false;
}

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
  return `# IDENTITY
Você é o CALEB, assistente virtual da Caleb's Tour em Cabo Frio/RJ. Você é um guia local: simpático, praiano, direto e convidativo.

# OBJETIVO
Ajudar o cliente a escolher passeios, tirar dúvidas, fechar reserva e gerar pagamento (PIX ou boleto).

# REGRAS INVIOLÁVEIS
1) DADOS REAIS: não invente preços, roteiros, horários, regras ou disponibilidade.
2) SEM FERRAMENTA = SEM DADO: se a mensagem exigir dados factuais (preço/roteiro/horário/taxa/localização/políticas/reserva/pagamento), você DEVE chamar uma ferramenta.
3) RESULTADOS SÓ VÊM DO SISTEMA: você só tem acesso a resultados quando receber uma mensagem system no formato:
   <tool_result name="NOME">{"success":...}</tool_result>
4) PROIBIDO INVENTAR TOOL RESULT: nunca escreva "Resultado da ferramenta", nunca invente JSON e nunca simule que chamou ferramenta.
5) NUNCA diga "consultando banco/sistema". Fale como humano (ex: "Deixa eu ver pra você").
6) Não recomece do zero nem se reapresente a cada mensagem. Use o histórico para entender respostas curtas tipo "1", "amanhã", "PIX".
7) Se faltar alguma informação para reservar/pagar, faça 1 pergunta objetiva por vez.
8) Não mostre IDs, JSON ou tags internas para o cliente.
9) VOUCHER: só envie voucher quando o pagamento estiver CONFIRMADO. Antes disso, diga que a reserva fica pendente até o pagamento.
10) IDIOMA: responda no idioma do cliente. Se ele falar em English/Spanish, responda nesse idioma.
11) SEGURANÇA/LEI: seja respeitoso. Se pedirem algo ilegal, perigoso, discriminatório ou conteúdo adulto, recuse e ofereça ajuda segura.

# FERRAMENTAS
Quando precisar agir, responda com APENAS o bloco da ferramenta (nada antes/depois).
Sintaxe EXATA (maiúsculas):
[TOOL:nome]{json}[/TOOL]
Chame apenas 1 ferramenta por vez.

Ferramentas disponíveis:
- consultar_passeios: lista passeios do Supabase (pode filtrar por termo).
  exemplo: [TOOL:consultar_passeios]{}[/TOOL] ou [TOOL:consultar_passeios]{"termo":"barco"}[/TOOL]
- buscar_passeio_especifico: busca passeio por termo (nome/categoria/local).
  exemplo: [TOOL:buscar_passeio_especifico]{"termo":"quadriciclo"}[/TOOL]
- consultar_conhecimento: busca informações oficiais (FAQ/políticas/check-in/taxas/logística) na base interna.
  exemplo: [TOOL:consultar_conhecimento]{"termo":"cancelamento"}[/TOOL]
- criar_reserva: cria reserva (precisa nome, passeio_id ou passeio, data, num_pessoas).
  exemplo: [TOOL:criar_reserva]{"nome":"Lucas Vargas","passeio":"barco com toboagua","data":"amanhã","num_pessoas":2}[/TOOL]
- gerar_pagamento: gera cobrança (PIX/BOLETO) a partir de reserva_id.
  exemplo: [TOOL:gerar_pagamento]{"reserva_id":"uuid","tipo_pagamento":"PIX"}[/TOOL]
- gerar_voucher: retorna dados do voucher para reserva confirmada.
  exemplo: [TOOL:gerar_voucher]{"reserva_id":"uuid"}[/TOOL]
- cancelar_reserva: cancela uma reserva por reserva_id ou voucher.
  exemplo: [TOOL:cancelar_reserva]{"voucher":"CBXXXXXXX"}[/TOOL]

# COMO RESPONDER
- Se a ferramenta retornar success=false, explique de forma humana e peça exatamente o que falta.
- Mensagens curtas estilo WhatsApp.
- Para gerar pagamento, normalmente você vai precisar pedir CPF/CNPJ (e e-mail no boleto). Se o cliente não tiver, peça um CPF/CNPJ do responsável ou ofereça atendimento humano.
- Emojis moderados (🌊🚤☀️😊✨).`;
}

function buildMessages(context: ConversationContext) {
  const today = getBrazilTodayISO();

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildSystemPrompt() },
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
  const recent = history.slice(-20).filter(m => m?.role && typeof m.content === 'string');

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

  const allowedTools = new Set<ToolName>([
    'consultar_passeios',
    'buscar_passeio_especifico',
    'consultar_conhecimento',
    'criar_reserva',
    'gerar_pagamento',
    'gerar_voucher',
    'cancelar_reserva'
  ]);

  const maxSteps = 16;
  let hasToolResult = false;

  for (let step = 0; step < maxSteps; step++) {
    const messages = buildMessages(context);
    const assistant = await groqChat({ messages, temperature: 0.15 });

    const calls = parseToolCalls(assistant);

    if (!calls.length) {
      const cleaned = stripToolBlocks(assistant);

      if (!cleaned) {
        context.conversationHistory.push({
          role: 'system',
          content: hasToolResult
            ? 'INSTRUÇÃO: Sua resposta veio vazia. Responda com texto natural para o cliente usando o último <tool_result>.'
            : 'INSTRUÇÃO: Sua resposta veio vazia. Se precisar de dados, chame uma ferramenta; caso contrário, responda em texto.'
        });
        continue;
      }

      if (!hasToolResult) {
        const force = shouldForceToolForUserMessage(userMessage);
        const stall = looksLikeStall(cleaned);
        const hallucinated = looksLikeHallucinatedToolResult(cleaned);

        if (force || stall || hallucinated) {
          context.conversationHistory.push({
            role: 'system',
            content:
              'INSTRUÇÃO: Sua resposta anterior foi inválida porque você não chamou uma ferramenta quando precisava. Agora responda APENAS com um bloco [TOOL:...]...[/TOOL] adequado. Não escreva texto.'
          });
          continue;
        }
      }

      if (hasToolResult && looksLikeHallucinatedToolResult(cleaned)) {
        context.conversationHistory.push({
          role: 'system',
          content:
            'INSTRUÇÃO: Não mostre JSON/tags internas ao cliente. Responda apenas com texto natural, usando o último <tool_result> como fonte.'
        });
        continue;
      }

      return cleaned || 'Tive um erro rapidinho aqui 😅 Pode repetir em uma frase?';
    }

    const first = calls[0];
    const name = first.name as ToolName;

    if (!allowedTools.has(name)) {
      context.conversationHistory.push({ role: 'assistant', content: assistant });
      context.conversationHistory.push({
        role: 'system',
        content: `<tool_result name="${first.name}">${JSON.stringify({ success: false, error: { code: 'unknown_tool', message: 'Ferramenta não permitida.' } })}</tool_result>`
      });
      hasToolResult = true;
      continue;
    }

    context.conversationHistory.push({ role: 'assistant', content: assistant });

    const toolResult = await executeTool(name, first.params || {}, { telefone, conversation: context });
    context.conversationHistory.push({
      role: 'system',
      content: `<tool_result name="${name}">${JSON.stringify(toolResult)}</tool_result>`
    });
    hasToolResult = true;
  }

  return 'Ops! Meu sistema ficou preso aqui 😅 Pode me dizer de novo o que você quer (passeio + data + pessoas)?';
}
