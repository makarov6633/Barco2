import { ConversationContext } from './supabase';
import { executeTool, normalizeDateToISO, ToolName } from './agent-tools';
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

type PaymentType = 'PIX' | 'BOLETO';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function stripEmojis(text: string) {
  const raw = String(text || '');
  try {
    return raw
      .replace(/[\p{Extended_Pictographic}]/gu, '')
      .replace(/[\uFE0F\u200D]/g, '')
      .replace(/\s+\n/g, '\n')
      .trim();
  } catch {
    return raw
      .replace(/[\u2190-\u21FF\u2300-\u23FF\u2460-\u24FF\u2600-\u27BF\u2900-\u297F\u2B00-\u2BFF\uD83C-\uDBFF\uDC00-\uDFFF]/g, '')
      .replace(/[\uFE0F\u200D]/g, '')
      .replace(/\s+\n/g, '\n')
      .trim();
  }
}

function extractCpfCnpjDigits(message: string) {
  const digits = String(message || '').replace(/\D/g, '');
  if (digits.length === 11 || digits.length === 14) return digits;
  return undefined;
}

function extractEmail(message: string) {
  const m = String(message || '').match(/[^\s@]+@[^\s@]+\.[^\s@]+/);
  return m ? m[0] : undefined;
}

function detectPaymentType(message: string): PaymentType | undefined {
  const t = normalizeString(message);
  if (!t) return undefined;
  const compact = t.replace(/\s+/g, '');
  if (compact.includes('boleto') || compact === 'bol' || compact === 'bolet') return 'BOLETO';
  if (compact.includes('pix') || /^p?ix$/.test(compact)) return 'PIX';
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  uma: 1,
  um: 1,
  duas: 2,
  dois: 2,
  tres: 3,
  treses: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10
};

function extractNumPessoas(message: string) {
  const raw = String(message || '');
  const m = raw.match(/\b(\d{1,3})\s*(pessoas?|adultos?|criancas?|crianças?)\b/i);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 99) return n;
  }

  const lower = normalizeString(raw);
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (lower.includes(`${w} pessoa`) || lower.includes(`${w} pessoas`)) return n;
  }

  return undefined;
}

function titleCaseName(value: string) {
  const parts = String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean);

  if (!parts.length) return '';

  return parts
    .map((p) => {
      const low = p.toLowerCase();
      if (['da', 'de', 'do', 'das', 'dos', 'e'].includes(low)) return low;
      return low.charAt(0).toUpperCase() + low.slice(1);
    })
    .join(' ')
    .trim();
}

function extractNameCandidate(message: string) {
  const raw = String(message || '').trim();
  if (!raw) return undefined;

  const explicit = raw.match(/\b(?:meu nome e|meu nome é|me chamo|sou o|sou a)\s+([^.,\n]+)/i);
  if (explicit?.[1]) {
    const name = titleCaseName(explicit[1]);
    if (name.split(' ').length >= 2) return name;
  }

  const firstPart = raw.split(',')[0]?.trim();
  if (!firstPart) return undefined;
  if (/\d/.test(firstPart)) return undefined;

  const words = firstPart.replace(/\s+/g, ' ').split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 5) return undefined;

  const norm = normalizeString(firstPart);
  const blocked = ['passeio', 'barco', 'buggy', 'quadriciclo', 'mergulho', 'transfer', 'city', 'combo', 'open', 'food', 'toboagua', 'toboagua'];
  if (blocked.some((k) => norm.includes(k))) return undefined;

  const name = titleCaseName(firstPart);
  return name.split(' ').length >= 2 ? name : undefined;
}

function extractOptionIndexStrict(message: string, max: number) {
  const t = normalizeString(message);
  if (!t) return undefined;

  const m = t.match(/^(?:opcao|op|numero|num|n)?\s*(\d{1,2})$/i);
  if (!m?.[1]) return undefined;

  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > max) return undefined;
  return n;
}

function looksLikeStall(text: string) {
  const t = normalizeString(text);
  if (!t) return false;

  const markers = [
    'vou verificar',
    'vou confirmar',
    'vou ver',
    'aguarde',
    'um instante',
    'um momento',
    'so um momento',
    'so um minuto',
    'um minuto',
    'ja estou verificando',
    'ja vou ver'
  ];

  return markers.some((m) => t.includes(m)) && t.length < 260;
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

function formatISOToBR(iso?: string) {
  const raw = String(iso || '').trim();
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function buildSystemPrompt(todayISO: string) {
  const todayBR = formatISOToBR(todayISO);

  return `# PAPEL E COMPORTAMENTO\nVocê é um assistente de vendas de passeios turísticos da Caleb's Tour.\n- Seu tom deve ser: profissional, acolhedor, educado e prestativo.\n- RESTRIÇÃO CRÍTICA: NUNCA use emojis.\n- Use linguagem culta e gentil.\n- O objetivo é converter vendas, mas agindo como um consultor humano, não um robô.\n\n# INFORMAÇÕES GERAIS\n- Data de hoje (America/Sao_Paulo): ${todayBR}.\n- Local: Arraial do Cabo / Região dos Lagos.\n\n# CATÁLOGO DE SERVIÇOS\n1. Combo Barco + Quadriciclo (2 pessoas): R$ 300,00\n2. Passeio de Barco (Open Bar + Open Food): R$ 169,90\n3. Passeio de Barco com Toboágua: R$ 59,90\n4. Passeio de Barco Exclusivo: R$ 2400,00\n5. City Tour Arraial (Saída RJ): R$ 280,00\n\n# INSTRUÇÕES DE LÓGICA (LEIA O HISTÓRICO)\nAntes de responder, analise as mensagens anteriores do usuário e o estado extraído para verificar quais dados já foram fornecidos:\n- [ ] Nome do cliente\n- [ ] Data do passeio (interprete datas relativas com base na data de hoje)\n- [ ] Quantidade de pessoas\n- [ ] Pacote escolhido\n\n# REGRAS DE INTERAÇÃO\n1. Não seja repetitivo: se um dado já foi informado, não pergunte novamente.\n2. Coleta de dados: pergunte apenas o que estiver faltando e apenas uma coisa por vez.\n3. Pagamento: CPF/CNPJ é o último passo. Só peça CPF/CNPJ depois de confirmar pacote, data e quantidade e após o cliente autorizar a emissão do pagamento.\n4. Explique que o CPF/CNPJ é necessário para gerar um link de pagamento seguro.\n\n# FERRAMENTAS (OBRIGATÓRIO PARA AÇÕES E DADOS)\n- Se a mensagem exigir dados factuais (preço, horário, local, políticas) ou qualquer ação (criar reserva, gerar pagamento, gerar voucher, cancelar), você DEVE chamar uma ferramenta.\n- Você só pode usar dados vindos de <tool_result>.\n- Nunca mostre JSON, IDs internos, nem tags <tool_result> ao cliente.\n\nSintaxe exata para chamar ferramenta (sem texto antes/depois):\n[TOOL:nome]{json}[/TOOL]\n\nFerramentas disponíveis:\n- consultar_passeios\n- buscar_passeio_especifico\n- consultar_conhecimento\n- criar_reserva\n- gerar_pagamento\n- gerar_voucher\n- cancelar_reserva\n\n# ESTILO DE RESPOSTA\n- Mensagens curtas e objetivas, adequadas para WhatsApp.\n- Não use gírias.\n- Não use emojis.\n- Antes de responder, faça um checklist mental: intenção -> dados já coletados -> próximo passo -> resposta.`;
}

function buildStateSummary(context: ConversationContext) {
  const dataISO = context.tempData?.data;
  const pessoas = context.tempData?.numPessoas;
  const passeio = context.tempData?.passeioNome || context.tempData?.passeio;
  const hasCpf = !!context.tempData?.cpf;
  const hasEmail = !!context.tempData?.email;
  const tipoPagamento = context.tempData?.tipoPagamento;
  const hasReserva = !!context.tempData?.reservaId;
  const valor = context.tempData?.valorTotal;

  const lines: string[] = [];
  lines.push('ESTADO EXTRAÍDO (use para evitar repetição):');
  lines.push(`- Nome: ${context.nome ? context.nome : 'não informado'}`);
  lines.push(`- Passeio: ${passeio ? passeio : 'não selecionado'}`);
  lines.push(`- Data (ISO): ${dataISO ? dataISO : 'não informada'}`);
  lines.push(`- Pessoas: ${pessoas != null ? pessoas : 'não informado'}`);
  lines.push(`- Reserva criada: ${hasReserva ? 'sim' : 'não'}`);
  if (valor != null) lines.push(`- Valor total (se aplicável): ${Number(valor).toFixed(2)}`);
  lines.push(`- Pagamento (tipo): ${tipoPagamento ? tipoPagamento : 'não definido'}`);
  lines.push(`- CPF/CNPJ disponível: ${hasCpf ? 'sim' : 'não'}`);
  lines.push(`- E-mail disponível: ${hasEmail ? 'sim' : 'não'}`);

  const options = Array.isArray(context.tempData?.optionList) ? context.tempData?.optionList : [];
  if (options?.length) {
    const limited = options.slice(0, 10);
    lines.push('Opções apresentadas mais recentemente (o cliente pode responder com o número):');
    for (let i = 0; i < limited.length; i++) {
      lines.push(`${i + 1}) ${limited[i]}`);
    }
  }

  return lines.join('\n');
}

function buildMessages(context: ConversationContext): ChatMessage[] {
  const todayISO = getBrazilTodayISO();

  const messages: ChatMessage[] = [{ role: 'system', content: buildSystemPrompt(todayISO) }];

  const history = Array.isArray(context.conversationHistory) ? context.conversationHistory : [];
  const recent = history
    .slice(-20)
    .filter((m) => m?.role && typeof m.content === 'string')
    .filter((m) => m.role === 'system' || m.role === 'user' || m.role === 'assistant') as Array<ChatMessage>;

  if (!recent.length) {
    messages.push({ role: 'system', content: buildStateSummary(context) });
    return messages;
  }

  const last = recent[recent.length - 1];
  const rest = recent.slice(0, -1);
  messages.push(...rest);
  messages.push({ role: 'system', content: buildStateSummary(context) });
  messages.push(last);

  return messages;
}

function looksLikeQuestionOrSlotRequest(text: string) {
  if (!text) return false;
  if (text.includes('?')) return true;

  const t = normalizeString(text);
  const cues = [
    'qual',
    'quando',
    'quantas',
    'quantos',
    'para qual',
    'pra qual',
    'poderia',
    'pode me informar',
    'me informe',
    'me diga',
    'por gentileza',
    'cpf',
    'cnpj',
    'e mail',
    'email'
  ];

  return cues.some((c) => t.startsWith(c) || t.includes(c));
}

function shouldForceToolForUserMessage(userMessage: string) {
  const t = normalizeString(userMessage);
  if (!t) return false;

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
    'reservar',
    'reserva',
    'agendar',
    'pagamento',
    'pagar',
    'pix',
    'boleto',
    'voucher',
    'cancelar',
    'cancelamento',
    'taxa',
    'embarque',
    'checkin',
    'check in',
    'check-in',
    'horario',
    'hora',
    'onde',
    'endereco',
    'localizacao',
    'politica',
    'reembolso',
    'estorno'
  ];

  return keywords.some((k) => t.includes(k));
}

function enrichToolParams(name: ToolName, rawParams: any, context: ConversationContext) {
  const params = rawParams && typeof rawParams === 'object' && !Array.isArray(rawParams) ? { ...rawParams } : {};

  if (name === 'criar_reserva') {
    if (params.nome == null && context.nome) params.nome = context.nome;
    if (params.data == null && context.tempData?.data) params.data = context.tempData.data;
    if (params.num_pessoas == null && params.numPessoas == null && context.tempData?.numPessoas != null) {
      params.num_pessoas = context.tempData.numPessoas;
    }
    if (params.passeio_id == null && params.passeioId == null && context.tempData?.passeioId) {
      params.passeio_id = context.tempData.passeioId;
    }
    if ((params.passeio == null || params.passeio === '') && context.tempData?.passeioNome) {
      params.passeio = context.tempData.passeioNome;
    }
  }

  if (name === 'gerar_pagamento') {
    if (params.reserva_id == null && params.reservaId == null && context.tempData?.reservaId) {
      params.reserva_id = context.tempData.reservaId;
    }
    if (params.tipo_pagamento == null && params.tipoPagamento == null && context.tempData?.tipoPagamento) {
      params.tipo_pagamento = context.tempData.tipoPagamento;
    }
    if (params.cpf == null && context.tempData?.cpf) {
      params.cpf = context.tempData.cpf;
    }
    if (params.email == null && context.tempData?.email) {
      params.email = context.tempData.email;
    }
  }

  if (name === 'gerar_voucher') {
    if (params.reserva_id == null && params.reservaId == null && context.tempData?.reservaId) {
      params.reserva_id = context.tempData.reservaId;
    }
  }

  return params;
}

function updateSlotsFromUserMessage(context: ConversationContext, userMessage: string) {
  context.tempData ||= {};

  const cpf = extractCpfCnpjDigits(userMessage);
  if (cpf) context.tempData.cpf = cpf;

  const email = extractEmail(userMessage);
  if (email) context.tempData.email = email;

  const paymentChoice = detectPaymentType(userMessage);
  if (paymentChoice) context.tempData.tipoPagamento = paymentChoice;

  const dateISO = normalizeDateToISO(userMessage);
  if (dateISO) context.tempData.data = dateISO;

  const pessoas = extractNumPessoas(userMessage);
  if (pessoas != null) context.tempData.numPessoas = pessoas;

  const name = extractNameCandidate(userMessage);
  if (name && !context.nome) context.nome = name;
}

function handleOptionSelection(context: ConversationContext, userMessage: string) {
  const ids = Array.isArray(context.tempData?.optionIds) ? context.tempData?.optionIds : [];
  if (!ids.length) return;

  const idx = extractOptionIndexStrict(userMessage, ids.length);
  if (idx == null) return;

  context.tempData ||= {};
  context.tempData.passeioId = ids[idx - 1];
  context.tempData.passeioNome = context.tempData.optionList?.[idx - 1];

  delete context.tempData.optionIds;
  delete context.tempData.optionList;

  context.conversationHistory.push({
    role: 'system',
    content:
      'INSTRUÇÃO: O cliente escolheu um passeio pelo número. Use o passeio selecionado e o histórico para coletar apenas o que estiver faltando e então criar a reserva.'
  });
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

  updateSlotsFromUserMessage(context, userMessage);
  handleOptionSelection(context, userMessage);

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
  let hasToolResultThisRun = false;

  for (let step = 0; step < maxSteps; step++) {
    const messages = buildMessages(context);
    const assistant = await groqChat({ messages, temperature: 0.22, max_tokens: 700 });

    const calls = parseToolCalls(assistant);

    if (!calls.length) {
      const cleanedRaw = stripToolBlocks(assistant);
      const cleaned = stripEmojis(cleanedRaw);

      if (!cleaned) {
        context.conversationHistory.push({
          role: 'system',
          content:
            hasToolResultThisRun
              ? 'INSTRUÇÃO: Sua resposta veio vazia. Responda com texto final ao cliente usando o último <tool_result> como fonte.'
              : 'INSTRUÇÃO: Sua resposta veio vazia. Se precisar de dados ou ação, chame uma ferramenta; caso contrário, responda em texto.'
        });
        continue;
      }

      const stall = looksLikeStall(cleaned);
      const hallucinated = looksLikeHallucinatedToolResult(cleaned);
      const isQuestion = looksLikeQuestionOrSlotRequest(cleaned);

      if (!hasToolResultThisRun) {
        const hasAnyToolResultInHistory = (context.conversationHistory || []).some((m) =>
          m?.role === 'system' && typeof m.content === 'string' && /<tool_result\b/i.test(m.content)
        );

        const force = !hasAnyToolResultInHistory && shouldForceToolForUserMessage(userMessage) && !isQuestion;

        if (force || stall || hallucinated) {
          context.conversationHistory.push({
            role: 'system',
            content:
              'INSTRUÇÃO: Sua resposta anterior foi inválida. Se precisar de dados ou ação, responda APENAS com um bloco [TOOL:...]...[/TOOL] apropriado. Não escreva texto.'
          });
          continue;
        }
      }

      if (hasToolResultThisRun && (stall || hallucinated)) {
        context.conversationHistory.push({
          role: 'system',
          content:
            'INSTRUÇÃO: Responda agora com texto final e direto ao cliente usando o último <tool_result>. Não enrole e não mostre JSON/tags internas.'
        });
        continue;
      }

      return cleaned;
    }

    const first = calls[0];
    const name = (first.name || '').toLowerCase() as ToolName;

    if (!allowedTools.has(name)) {
      context.conversationHistory.push({ role: 'assistant', content: assistant });
      context.conversationHistory.push({
        role: 'system',
        content: `<tool_result name="${name}">${JSON.stringify({
          success: false,
          error: { code: 'unknown_tool', message: 'Ferramenta não permitida.' }
        })}</tool_result>`
      });
      hasToolResultThisRun = true;
      continue;
    }

    context.conversationHistory.push({ role: 'assistant', content: assistant });

    const toolParams = enrichToolParams(name, first.params || {}, context);
    const toolResult = await executeTool(name, toolParams, { telefone, conversation: context });

    context.conversationHistory.push({
      role: 'system',
      content: `<tool_result name="${name}">${JSON.stringify(toolResult)}</tool_result>`
    });

    hasToolResultThisRun = true;
  }

  return 'Desculpe, tive uma instabilidade. Pode enviar novamente sua solicitação em uma frase?';
}
