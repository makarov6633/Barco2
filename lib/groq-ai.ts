import Groq from 'groq-sdk';
import { buildKnowledgeContext, getPriceInfo, getAllKnowledgeChunks } from './knowledge-supabase';

let cachedGroq: Groq | null = null;

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is missing or empty.');
  }
  cachedGroq ||= new Groq({ apiKey });
  return cachedGroq;
}

const REASONING_MODEL = process.env.GROQ_REASONING_MODEL || 'llama-3.3-70b-versatile';
const INTENT_MODEL = process.env.GROQ_INTENT_MODEL || 'llama-3.3-70b-versatile';

async function buildDynamicSystemPrompt(userMessage: string): Promise<string> {
  const knowledgeContext = await buildKnowledgeContext(userMessage);

  return `Você é a Ana, atendente estrela da Caleb's Tour Company (CTC) no WhatsApp.
Sua missão é encantar clientes, vender passeios e manter um papo humano, divertido e acolhedor.

INFORMAÇÕES DA EMPRESA:
- Nome: Caleb's Tour Company (CTC)
- CNPJ: 26.096.072/0001-78
- Instagram: @calebstour
- Telefone: (22) 99824-9911
- Localização: Região dos Lagos (Arraial do Cabo, Cabo Frio, Búzios)

=== BASE DE CONHECIMENTO (USE ESTAS INFORMAÇÕES PARA RESPONDER) ===
${knowledgeContext}
=== FIM DA BASE DE CONHECIMENTO ===

REGRAS IMPORTANTES:
1. Use APENAS as informações da base de conhecimento acima para responder sobre preços, passeios e detalhes.
2. Se uma informação não estiver na base de conhecimento, diga que vai confirmar com a equipe.
3. Nunca invente preços ou informações.
4. Seja vendedora: sempre tente avançar para a reserva.
5. Responda de forma curta e objetiva (estilo WhatsApp).

PERSONALIDADE:
- Brasileira, carioca, calorosa
- Usa expressões como "Tudo certo?", "Partiu?", "Fica tranquila"
- Mensagens com 2-3 frases curtas
- Emojis estratégicos: 😊🌊🚤✨🤿💙🔥
- Chame o cliente pelo primeiro nome quando souber
- Sempre finalize com convite ou pergunta para avançar

FORMAS DE PAGAMENTO:
- PIX (pagamento instantâneo)
- Boleto bancário
- Cartão de crédito/débito (presencial)
- Dinheiro (no embarque)

Quando o cliente quiser pagar ou fechar reserva, pergunte:
1. CPF (para emitir o comprovante)
2. Forma de pagamento preferida (PIX ou Boleto)
3. Confirme os dados antes de gerar o pagamento`;
}

export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userName?: string,
  longTermMemories: string[] = []
): Promise<string> {
  try {
    const systemPrompt = await buildDynamicSystemPrompt(userMessage);

    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    const friendlyName = userName ? userName.split(' ')[0] : null;

    if (friendlyName) {
      messages.push({ role: 'system', content: `O cliente se chama ${friendlyName} e gosta de ser tratado pelo nome.` });
    }

    if (longTermMemories.length) {
      messages.push({
        role: 'system',
        content: `Memórias importantes do cliente:\n${longTermMemories.map((memory, index) => `${index + 1}. ${memory}`).join('\n')}`
      });
    }

    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);

    messages.push({
      role: 'user',
      content: friendlyName ? `${friendlyName}: ${userMessage}` : userMessage
    });

    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: REASONING_MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 600,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content ||
      'Opa, falhou aqui! Me manda de novo? 😅';

    return response.trim();
  } catch (error) {
    console.error('Erro Groq:', error);
    return 'Ops, minha conexão oscilou 😔\nMas não desiste de mim! Pode repetir?';
  }
}

const INTENT_SYSTEM_PROMPT = `Você é um analisador de intenções para uma agência de turismo.
Analise a mensagem e retorne APENAS JSON válido seguindo esta estrutura:
{"intent":"reserva|preco|pagamento|duvida|saudacao|reclamacao|elogio|cancelamento","confidence":0.0-1.0,"entities":{"nome":string|null,"data":string|null,"numPessoas":number|null,"passeio":string|null,"cpf":string|null,"formaPagamento":"pix|boleto|cartao"|null}}

Regras:
- "pagamento" = quando menciona pagar, PIX, boleto, quero fechar, confirmar pagamento
- "reserva" = quando quer reservar, agendar, marcar
- "preco" = quando pergunta valor, quanto custa, tabela de preços
- Extraia CPF se mencionado (11 dígitos)
- Extraia forma de pagamento se mencionada`;

const ALLOWED_INTENTS = new Set([
  'reserva',
  'preco',
  'pagamento',
  'duvida',
  'saudacao',
  'reclamacao',
  'elogio',
  'cancelamento',
  'desconhecido'
]);

export async function detectIntentWithAI(message: string): Promise<{
  intent: string;
  confidence: number;
  entities: any;
}> {
  const trimmed = message?.trim();
  if (!trimmed) {
    return {
      intent: 'desconhecido',
      confidence: 0,
      entities: {}
    };
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: INTENT_MODEL,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: trimmed }
      ],
      temperature: 0.2,
      max_tokens: 250
    });

    const content = completion.choices[0]?.message?.content ?? undefined;
    const parsed = parseIntentResponse(content);
    if (parsed) {
      return sanitizeIntentPayload(parsed, trimmed);
    }
  } catch (error) {
    console.error('Erro detectIntent:', error);
  }

  return fallbackIntent(trimmed);
}

function parseIntentResponse(raw?: string) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function sanitizeIntentPayload(payload: any, originalMessage: string) {
  const intentRaw = typeof payload?.intent === 'string' ? payload.intent.toLowerCase() : 'desconhecido';
  const intent = ALLOWED_INTENTS.has(intentRaw) ? intentRaw : 'desconhecido';
  const entities = payload?.entities || {};

  const passeio = entities.passeio || detectPasseioKeyword(originalMessage);
  const numFromModel = typeof entities.numPessoas === 'number' ? entities.numPessoas : parseNumber(entities.numPessoas);
  const extractedNum = Number.isFinite(numFromModel) ? numFromModel : extractNumPessoas(originalMessage);
  const extractedDate = entities.data && typeof entities.data === 'string' && entities.data.trim()
    ? entities.data.trim()
    : extractDate(originalMessage);
  const extractedName = entities.nome && typeof entities.nome === 'string' && entities.nome.trim()
    ? entities.nome.trim()
    : extractName(originalMessage);
  const extractedCpf = entities.cpf || extractCPF(originalMessage);
  const extractedPayment = entities.formaPagamento || detectPaymentMethod(originalMessage);

  return {
    intent,
    confidence: typeof payload?.confidence === 'number'
      ? Math.min(Math.max(payload.confidence, 0), 1)
      : intent === 'desconhecido'
        ? 0.4
        : 0.75,
    entities: {
      nome: extractedName || undefined,
      data: extractedDate || undefined,
      numPessoas: extractedNum || undefined,
      passeio: passeio || undefined,
      cpf: extractedCpf || undefined,
      formaPagamento: extractedPayment || undefined
    }
  };
}

function fallbackIntent(message: string) {
  const text = message.toLowerCase();

  if (matches(text, ['pix', 'boleto', 'pagar', 'pagamento', 'quero fechar', 'vou pagar', 'pode gerar'])) {
    return {
      intent: 'pagamento',
      confidence: 0.85,
      entities: {
        passeio: detectPasseioKeyword(text),
        cpf: extractCPF(text),
        formaPagamento: detectPaymentMethod(text)
      }
    };
  }

  if (matches(text, ['reclama', 'péssimo', 'ruim', 'horrível', 'problema', 'atraso'])) {
    return {
      intent: 'reclamacao',
      confidence: 0.82,
      entities: {
        passeio: detectPasseioKeyword(text),
        numPessoas: extractNumPessoas(text),
        data: extractDate(text),
        nome: extractName(text)
      }
    };
  }

  if (matches(text, ['cancelar', 'desmarcar', 'não vou', 'nao vou', 'cancelei'])) {
    return {
      intent: 'cancelamento',
      confidence: 0.8,
      entities: {
        passeio: detectPasseioKeyword(text),
        data: extractDate(text)
      }
    };
  }

  if (matches(text, ['preço', 'preco', 'valor', 'quanto', 'quanto sai', 'tabela', 'quanto custa'])) {
    return {
      intent: 'preco',
      confidence: 0.78,
      entities: {
        passeio: detectPasseioKeyword(text),
        numPessoas: extractNumPessoas(text)
      }
    };
  }

  if (matches(text, ['bom dia', 'boa tarde', 'boa noite', 'oi', 'olá', 'ola', 'tudo bem', 'eai', 'e ai'])) {
    return {
      intent: 'saudacao',
      confidence: 0.7,
      entities: {}
    };
  }

  if (matches(text, ['quero reservar', 'fazer reserva', 'fechar', 'confirmar passeio', 'pode reservar', 'quero agendar', 'marcar'])) {
    return {
      intent: 'reserva',
      confidence: 0.78,
      entities: {
        passeio: detectPasseioKeyword(text),
        numPessoas: extractNumPessoas(text),
        data: extractDate(text),
        nome: extractName(text)
      }
    };
  }

  return {
    intent: 'duvida',
    confidence: 0.5,
    entities: {
      passeio: detectPasseioKeyword(text),
      numPessoas: extractNumPessoas(text),
      data: extractDate(text)
    }
  };
}

function matches(text: string, patterns: string[]) {
  return patterns.some(pattern => text.includes(pattern));
}

const PASSEIO_KEYWORDS = [
  { value: 'barco_arraial', keywords: ['barco', 'arraial', 'caribe'] },
  { value: 'escuna', keywords: ['escuna', 'buzios', 'búzios'] },
  { value: 'quadriciclo', keywords: ['quadriciclo', 'quadri', 'quad'] },
  { value: 'buggy', keywords: ['buggy', 'dunas'] },
  { value: 'mergulho', keywords: ['mergulho', 'cilindro', 'batismo'] },
  { value: 'jet_ski', keywords: ['jet', 'jetski', 'jet ski'] },
  { value: 'lancha', keywords: ['lancha', 'privado', 'vip', 'exclusivo'] },
  { value: 'city_tour', keywords: ['city', 'tour', 'rio', 'cristo'] }
];

function detectPasseioKeyword(text: string) {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const item of PASSEIO_KEYWORDS) {
    if (item.keywords.some(keyword => normalized.includes(keyword))) {
      return item.value;
    }
  }
  return undefined;
}

function parseNumber(value: any) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = parseInt(value.replace(/\D/g, ''), 10);
    if (!Number.isNaN(numeric)) return numeric;
  }
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  'uma': 1, 'um': 1,
  'duas': 2, 'dois': 2,
  'três': 3, 'tres': 3,
  'quatro': 4, 'cinco': 5,
  'seis': 6, 'sete': 7,
  'oito': 8, 'nove': 9, 'dez': 10
};

function extractNumPessoas(text: string) {
  const explicit = text.match(/(\d+)\s*(pessoas|pessoa|adultos?|criancas?|crianças?)/i);
  if (explicit) {
    return parseInt(explicit[1], 10);
  }

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(`${word} pessoa`) || text.includes(`${word} pessoas`)) {
      return value;
    }
  }

  return undefined;
}

function extractDate(text: string) {
  const absolute = text.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
  if (absolute) {
    return absolute[1].replace(/-/g, '/');
  }

  if (text.includes('amanh')) return 'amanhã';
  if (text.includes('hoje')) return 'hoje';
  if (text.includes('depois de amanhã')) return 'depois de amanhã';

  const weekdays = [
    { key: 'segunda', value: 'segunda-feira' },
    { key: 'terça', value: 'terça-feira' },
    { key: 'terca', value: 'terça-feira' },
    { key: 'quarta', value: 'quarta-feira' },
    { key: 'quinta', value: 'quinta-feira' },
    { key: 'sexta', value: 'sexta-feira' },
    { key: 'sábado', value: 'sábado' },
    { key: 'sabado', value: 'sábado' },
    { key: 'domingo', value: 'domingo' }
  ];

  const weekday = weekdays.find(day => text.includes(day.key));
  return weekday?.value;
}

function extractName(text: string) {
  const nameMatch = text.match(/meu nome é ([^.,!\n]+)/i) || text.match(/sou o ([^.,!\n]+)/i) || text.match(/sou a ([^.,!\n]+)/i);
  if (nameMatch) {
    return capitalize(nameMatch[1].trim());
  }
  return undefined;
}

function extractCPF(text: string): string | undefined {
  const cpfMatch = text.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
  if (cpfMatch) {
    return cpfMatch[0].replace(/\D/g, '');
  }

  const numbersOnly = text.replace(/\D/g, '');
  if (numbersOnly.length === 11) {
    return numbersOnly;
  }

  return undefined;
}

function detectPaymentMethod(text: string): 'pix' | 'boleto' | 'cartao' | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('pix')) return 'pix';
  if (lower.includes('boleto')) return 'boleto';
  if (lower.includes('cartao') || lower.includes('cartão') || lower.includes('credito') || lower.includes('crédito')) return 'cartao';
  return undefined;
}

function capitalize(value: string) {
  if (!value) return value;
  return value.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}
