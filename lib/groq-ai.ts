import Groq from 'groq-sdk';
import { FAQ_GENERAL, TOURS_INFO, CALEB_INFO, FAQ_PERFIL, FAQ_TEMPORADA } from './knowledge-base';

let cachedGroq: Groq | null = null;

function getGroq() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is missing or empty.');
  }
  cachedGroq ||= new Groq({ apiKey });
  return cachedGroq;
}

const REASONING_MODEL = process.env.GROQ_REASONING_MODEL || 'openai/gpt-oss-120b';
const INTENT_MODEL = process.env.GROQ_INTENT_MODEL || 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `Você é a Ana, atendente estrela da Caleb's Tour (CTC) no WhatsApp.
Sua missão é encantar clientes, vender passeios e manter um papo humano, divertido e acolhedor.

⚠️ REGRA DE OURO: SEMPRE use APENAS os dados dos passeios disponíveis no banco de dados que serão fornecidos. NUNCA invente preços, horários ou informações.

BASE DE CONHECIMENTO DA EMPRESA:
${CALEB_INFO}

FAQ GERAL:
${FAQ_GENERAL.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

FAQ POR PERFIL:
Famílias: ${FAQ_PERFIL.familia_bebe.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}
Casais: ${FAQ_PERFIL.casal_lua_de_mel.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}
Grupos: ${FAQ_PERFIL.grupo_grande.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

FAQ TEMPORADA:
${Object.values(FAQ_TEMPORADA).flat().map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

COMO RESPONDER:
1. SOBRE PREÇOS: Consulte a lista de passeios do banco de dados e mencione a faixa de preço exata (R$ X - R$ Y). Pergunte quantas pessoas vão para calcular o valor total.

2. SOBRE RESERVAS: Quando o cliente quiser fazer uma reserva, você precisa coletar de forma natural e conversacional:
   - Qual passeio (se não souber, sugira os 3 principais do banco de dados)
   - Data desejada
   - Número de pessoas
   - Nome completo do cliente
   Vá perguntando uma coisa de cada vez de forma amigável. Se o cliente fornecer várias informações de uma vez, reconheça e peça apenas o que falta.

3. DÚVIDAS GERAIS: Responda baseado no FAQ e sempre ofereça ajuda adicional.

PERSONALIDADE:
- Brasileira, carioca, calorosa. Use "Tudo certo?", "Partiu?", "Beleza!".
- Mensagens com 2-3 frases curtas, parágrafos curtos.
- Emojis estratégicos: 😊🌊🚤✨🤿💙
- Chame pelo primeiro nome quando souber.
- Seja proativa: sugira, recomende, convide para próximos passos.
- Demonstre empatia real com o tom do cliente.

IMPORTANTE:
- Use APENAS dados do banco fornecido (preços, durações, locais).
- Se não souber algo, diga que vai confirmar com o gerente.
- Mantenha consistência: não repita informações já dadas.
- Finalize sempre com pergunta ou convite para ação.`;

const INTENT_SYSTEM_PROMPT = `Você é um analisador de intenções para uma agência de turismo que vende passeios em Arraial do Cabo, Cabo Frio e região.
Receba a mensagem do cliente e retorne APENAS JSON válido e minificado seguindo exatamente esta estrutura:
{"intent":"reserva|preco|duvida|saudacao|reclamacao|elogio|cancelamento","confidence":0.0-1.0,"entities":{"nome":string|null,"data":string|null,"numPessoas":number|null,"passeio":"barco|buggy|quadri|mergulho|jet|escuna|cabo_frio|lancha|catamara|city|hospedagem"|null}}
Regras:
- Identifique intenção principal considerando contexto de vendas.
- Extraia número de pessoas mesmo se escrito por extenso (ex: "duas pessoas" = 2).
- Datas podem ser relativas ("amanhã", "sábado", "15/02").
- Passeios devem ser classificados pelas categorias do catálogo.
- Se não tiver certeza, use null e reduza a confiança, mas mantenha JSON válido.`;

const ALLOWED_INTENTS = new Set([
  'reserva',
  'preco',
  'duvida',
  'saudacao',
  'reclamacao',
  'elogio',
  'cancelamento',
  'desconhecido'
]);

const PASSEIO_KEYWORDS = [
  { value: 'arraial', keywords: ['arraial', 'arraial do cabo', 'caribe brasileiro'] },
  { value: 'cabo_frio', keywords: ['cabo frio'] },
  { value: 'barco', keywords: ['barco', 'escuna', 'catamarã', 'catamara'] },
  { value: 'buggy', keywords: ['buggy', 'quadriciclo', 'quadri'] },
  { value: 'lancha', keywords: ['lancha', 'privado', 'vip'] },
  { value: 'mergulho', keywords: ['mergulho', 'cilindro', 'snorkel'] },
  { value: 'city', keywords: ['city tour', 'rio', 'cristoredentor', 'cristo redentor'] },
  { value: 'hospedagem', keywords: ['pousada', 'hotel', 'hospedagem'] }
];

const NUMBER_WORDS: Record<string, number> = {
  'uma': 1,
  'um': 1,
  'duas': 2,
  'dois': 2,
  'três': 3,
  'tres': 3,
  'quatro': 4,
  'cinco': 5,
  'seis': 6,
  'sete': 7,
  'oito': 8,
  'nove': 9,
  'dez': 10
};

export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userName?: string,
  longTermMemories: string[] = [],
  passeiosDisponiveis?: string,
  specialContext?: string
): Promise<string> {
  try {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
    ];

    const friendlyName = userName ? userName.split(' ')[0] : null;

    if (friendlyName) {
      messages.push({ role: 'system', content: `O cliente se chama ${friendlyName} e gosta de ser tratado pelo nome.` });
    }

    if (passeiosDisponiveis) {
      messages.push({
        role: 'system',
        content: `PASSEIOS DISPONÍVEIS NO BANCO DE DADOS (USE APENAS ESTES DADOS REAIS):\n${passeiosDisponiveis}`
      });
    }

    if (specialContext) {
      messages.push({
        role: 'system',
        content: specialContext
      });
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
      temperature: 0.65,
      max_tokens: 520,
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
      max_tokens: 220
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
      passeio: passeio || undefined
    }
  };
}

function fallbackIntent(message: string) {
  const text = message.toLowerCase();

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

  if (matches(text, ['preço', 'valor', 'quanto', 'quanto sai', 'tabela'])) {
    return {
      intent: 'preco',
      confidence: 0.72,
      entities: {
        passeio: detectPasseioKeyword(text),
        numPessoas: extractNumPessoas(text)
      }
    };
  }

  if (matches(text, ['bom dia', 'boa tarde', 'boa noite', 'oi', 'olá', 'ola', 'tudo bem'])) {
    return {
      intent: 'saudacao',
      confidence: 0.7,
      entities: {}
    };
  }

  if (matches(text, ['quero reservar', 'fazer reserva', 'fechar', 'confirmar passeio', 'pode reservar'])) {
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

function detectPasseioKeyword(text: string) {
  for (const item of PASSEIO_KEYWORDS) {
    if (item.keywords.some(keyword => text.includes(keyword))) {
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

function capitalize(value: string) {
  if (!value) return value;
  return value.split(' ').map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join(' ');
}
