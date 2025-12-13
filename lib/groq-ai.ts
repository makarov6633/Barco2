import Groq from 'groq-sdk';
import { getAllKnowledgeChunks, getAllPasseios, KnowledgeChunk } from './supabase';

let cachedGroq: Groq | null = null;
let cachedKnowledge: string | null = null;
let knowledgeCacheTime: number = 0;
const CACHE_TTL = 5 * 60 * 1000;

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is missing or empty.');
  }
  cachedGroq ||= new Groq({ apiKey });
  return cachedGroq;
}

const REASONING_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const INTENT_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

async function getKnowledgeBase(): Promise<string> {
  const now = Date.now();
  if (cachedKnowledge && (now - knowledgeCacheTime) < CACHE_TTL) {
    return cachedKnowledge;
  }

  try {
    const [chunks, passeios] = await Promise.all([
      getAllKnowledgeChunks(),
      getAllPasseios()
    ]);

    const knowledgeText = chunks.map(chunk => 
      `## ${chunk.title}\n${chunk.content}\nFonte: ${chunk.source || 'Base interna'}\nTags: ${chunk.tags?.join(', ') || 'N/A'}`
    ).join('\n\n---\n\n');

    const passeiosText = passeios.map(p => 
      `• ${p.nome} (${p.categoria || 'Geral'}): R$ ${p.preco_min || '?'} - R$ ${p.preco_max || '?'} | Duração: ${p.duracao || 'Consultar'} | Local: ${p.local || 'Região dos Lagos'}`
    ).join('\n');

    cachedKnowledge = `
=== BASE DE CONHECIMENTO OFICIAL CALEB'S TOUR ===

${knowledgeText}

=== CATÁLOGO DE PASSEIOS (SUPABASE) ===
${passeiosText}

=== INFORMAÇÕES DA EMPRESA ===
Nome: Caleb's Tour Company (CTC)
CNPJ: 26.096.072/0001-78
Slogan: "O Caribe Brasileiro é aqui!"
Instagram: @calebstour
Localização: Região dos Lagos (Arraial do Cabo, Cabo Frio, Búzios)
Contato: (22) 99824-9911
PIX: CNPJ 26.096.072/0001-78 (Banco Inter)

Formas de pagamento: PIX (preferencial), Boleto, Cartão (5% acréscimo em alguns passeios)
`;
    knowledgeCacheTime = now;
    return cachedKnowledge;
  } catch (error) {
    console.error('Erro ao carregar knowledge base:', error);
    return 'Base de conhecimento temporariamente indisponível. Contato: (22) 99824-9911';
  }
}

async function buildSystemPrompt(): Promise<string> {
  const knowledge = await getKnowledgeBase();
  
  return `Você é a Ana, atendente virtual da Caleb's Tour Company (CTC) no WhatsApp.
Sua missão é responder com precisão usando APENAS os dados da base de conhecimento abaixo.

${knowledge}

REGRAS CRÍTICAS:
1. NUNCA invente preços ou informações. Use SOMENTE os dados acima.
2. Se não souber algo, diga "Vou confirmar com a equipe" e peça para aguardar.
3. Respostas curtas (2-4 frases), estilo WhatsApp brasileiro.
4. Use emojis estratégicos: 😊🌊🚤✨🤿💙
5. Sempre pergunte data e número de pessoas para avançar a reserva.
6. Ofereça PIX como forma preferencial de pagamento.
7. Chame o cliente pelo primeiro nome quando souber.
8. Para pagamentos, gere cobrança PIX ou boleto pelo sistema.

FLUXO DE VENDA:
1. Cumprimente e identifique interesse
2. Informe preços EXATOS da base de conhecimento
3. Pergunte data + número de pessoas
4. Gere cobrança (PIX preferencial)
5. Após pagamento confirmado, envie voucher

PERSONALIDADE:
- Brasileira, carioca, calorosa
- Empática e vendedora (sem ser invasiva)
- Proativa em fechar reservas
- Sempre oferece ajuda adicional`;
}

export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userName?: string,
  longTermMemories: string[] = []
): Promise<string> {
  try {
    const systemPrompt = await buildSystemPrompt();
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    const friendlyName = userName ? userName.split(' ')[0] : null;

    if (friendlyName) {
      messages.push({ role: 'system', content: `O cliente se chama ${friendlyName}. Trate-o pelo nome.` });
    }

    if (longTermMemories.length) {
      messages.push({
        role: 'system',
        content: `Contexto do cliente:\n${longTermMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')}`
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
      temperature: 0.5,
      max_tokens: 600,
      top_p: 0.9
    });

    const response = completion.choices[0]?.message?.content ||
      'Opa, tive um probleminha! Me manda de novo? 😅';

    return response.trim();
  } catch (error) {
    console.error('Erro Groq:', error);
    return 'Ops, minha conexão oscilou 😔\nPode repetir? Ou liga: (22) 99824-9911';
  }
}

const INTENT_SYSTEM_PROMPT = `Você é um analisador de intenções para a Caleb's Tour (agência de turismo).
Analise a mensagem e retorne APENAS JSON válido:

{"intent":"reserva|preco|pagamento|duvida|saudacao|reclamacao|elogio|cancelamento|pix|boleto","confidence":0.0-1.0,"entities":{"nome":string|null,"data":string|null,"numPessoas":number|null,"passeio":string|null,"formaPagamento":"pix"|"boleto"|null}}

Regras:
- "quero pagar", "pix", "boleto", "gerar cobrança" = intent "pagamento"
- Extraia número de pessoas mesmo por extenso
- Datas relativas: "amanhã", "sábado", "15/02"
- Retorne JSON minificado válido`;

const ALLOWED_INTENTS = new Set([
  'reserva', 'preco', 'pagamento', 'duvida', 'saudacao',
  'reclamacao', 'elogio', 'cancelamento', 'pix', 'boleto', 'desconhecido'
]);

export async function detectIntentWithAI(message: string): Promise<{
  intent: string;
  confidence: number;
  entities: any;
}> {
  const trimmed = message?.trim();
  if (!trimmed) {
    return { intent: 'desconhecido', confidence: 0, entities: {} };
  }

  try {
    const groq = getGroq();
    const completion = await groq.chat.completions.create({
      model: INTENT_MODEL,
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: trimmed }
      ],
      temperature: 0.1,
      max_tokens: 200
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
  const extractedDate = entities.data?.trim() || extractDate(originalMessage);
  const extractedName = entities.nome?.trim() || extractName(originalMessage);
  const formaPagamento = entities.formaPagamento || detectFormaPagamento(originalMessage);

  return {
    intent,
    confidence: typeof payload?.confidence === 'number'
      ? Math.min(Math.max(payload.confidence, 0), 1)
      : intent === 'desconhecido' ? 0.4 : 0.75,
    entities: {
      nome: extractedName || undefined,
      data: extractedDate || undefined,
      numPessoas: extractedNum || undefined,
      passeio: passeio || undefined,
      formaPagamento: formaPagamento || undefined
    }
  };
}

function fallbackIntent(message: string) {
  const text = message.toLowerCase();

  if (matches(text, ['pix', 'boleto', 'pagar', 'pagamento', 'cobrança', 'gerar'])) {
    return {
      intent: 'pagamento',
      confidence: 0.85,
      entities: {
        formaPagamento: text.includes('boleto') ? 'boleto' : 'pix',
        passeio: detectPasseioKeyword(text),
        numPessoas: extractNumPessoas(text)
      }
    };
  }

  if (matches(text, ['reclama', 'péssimo', 'ruim', 'horrível', 'problema', 'atraso'])) {
    return {
      intent: 'reclamacao',
      confidence: 0.82,
      entities: { passeio: detectPasseioKeyword(text) }
    };
  }

  if (matches(text, ['cancelar', 'desmarcar', 'não vou', 'cancelei'])) {
    return {
      intent: 'cancelamento',
      confidence: 0.8,
      entities: { passeio: detectPasseioKeyword(text), data: extractDate(text) }
    };
  }

  if (matches(text, ['preço', 'valor', 'quanto', 'quanto sai', 'tabela', 'custa'])) {
    return {
      intent: 'preco',
      confidence: 0.72,
      entities: { passeio: detectPasseioKeyword(text), numPessoas: extractNumPessoas(text) }
    };
  }

  if (matches(text, ['bom dia', 'boa tarde', 'boa noite', 'oi', 'olá', 'ola', 'tudo bem', 'eai', 'e aí'])) {
    return {
      intent: 'saudacao',
      confidence: 0.7,
      entities: {}
    };
  }

  if (matches(text, ['quero reservar', 'fazer reserva', 'fechar', 'confirmar', 'pode reservar', 'agendar'])) {
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
  return patterns.some(p => text.includes(p));
}

const PASSEIO_KEYWORDS = [
  { value: 'barco_arraial', keywords: ['arraial', 'caribe', 'farol'] },
  { value: 'barco_cabofrio', keywords: ['cabo frio', 'japonês', 'papagaios'] },
  { value: 'escuna_buzios', keywords: ['búzios', 'buzios', 'escuna'] },
  { value: 'barco', keywords: ['barco', 'embarcação'] },
  { value: 'quadriciclo', keywords: ['quadriciclo', 'quadri'] },
  { value: 'buggy', keywords: ['buggy', 'dunas'] },
  { value: 'lancha', keywords: ['lancha', 'privado', 'vip', 'exclusivo'] },
  { value: 'mergulho', keywords: ['mergulho', 'cilindro', 'batismo'] },
  { value: 'jet_ski', keywords: ['jet ski', 'jetski', 'jet'] },
  { value: 'city_rio', keywords: ['city tour', 'rio', 'cristo', 'pão de açúcar'] },
  { value: 'transfer', keywords: ['transfer', 'transporte', 'van'] }
];

function detectPasseioKeyword(text: string) {
  const lower = text.toLowerCase();
  for (const item of PASSEIO_KEYWORDS) {
    if (item.keywords.some(k => lower.includes(k))) {
      return item.value;
    }
  }
  return undefined;
}

function detectFormaPagamento(text: string): 'pix' | 'boleto' | undefined {
  const lower = text.toLowerCase();
  if (lower.includes('boleto')) return 'boleto';
  if (lower.includes('pix')) return 'pix';
  return undefined;
}

const NUMBER_WORDS: Record<string, number> = {
  'uma': 1, 'um': 1, 'duas': 2, 'dois': 2, 'três': 3, 'tres': 3,
  'quatro': 4, 'cinco': 5, 'seis': 6, 'sete': 7, 'oito': 8, 'nove': 9, 'dez': 10
};

function parseNumber(value: any) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const numeric = parseInt(value.replace(/\D/g, ''), 10);
    if (!Number.isNaN(numeric)) return numeric;
  }
  return undefined;
}

function extractNumPessoas(text: string) {
  const explicit = text.match(/(\d+)\s*(pessoas?|adultos?|crianças?)/i);
  if (explicit) return parseInt(explicit[1], 10);

  for (const [word, value] of Object.entries(NUMBER_WORDS)) {
    if (text.includes(`${word} pessoa`) || text.includes(`${word} pessoas`)) {
      return value;
    }
  }
  return undefined;
}

function extractDate(text: string) {
  const absolute = text.match(/(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)/);
  if (absolute) return absolute[1].replace(/-/g, '/');

  if (text.includes('amanh')) return 'amanhã';
  if (text.includes('hoje')) return 'hoje';
  if (text.includes('depois de amanhã')) return 'depois de amanhã';

  const weekdays = [
    { key: 'segunda', value: 'segunda-feira' },
    { key: 'terça', value: 'terça-feira' },
    { key: 'quarta', value: 'quarta-feira' },
    { key: 'quinta', value: 'quinta-feira' },
    { key: 'sexta', value: 'sexta-feira' },
    { key: 'sábado', value: 'sábado' },
    { key: 'sabado', value: 'sábado' },
    { key: 'domingo', value: 'domingo' }
  ];

  const weekday = weekdays.find(d => text.includes(d.key));
  return weekday?.value;
}

function extractName(text: string) {
  const match = text.match(/meu nome é ([^.,!\n]+)/i) || 
                text.match(/sou o ([^.,!\n]+)/i) || 
                text.match(/sou a ([^.,!\n]+)/i) ||
                text.match(/me chamo ([^.,!\n]+)/i);
  if (match) {
    return match[1].trim().split(' ').map(p => 
      p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
    ).join(' ');
  }
  return undefined;
}
