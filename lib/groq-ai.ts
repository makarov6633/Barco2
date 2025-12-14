import Groq from 'groq-sdk';
import { TOURS_INFO, CALEB_INFO } from './knowledge-base';

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

const TOURS_SUMMARY = Object.values(TOURS_INFO)
  .map((tour: any) => {
    const name = tour?.nome ? String(tour.nome) : '';
    const categoria = tour?.categoria ? ` (${String(tour.categoria)})` : '';
    const duracao = tour?.duracao ? ` • ${String(tour.duracao)}` : '';
    const saidas = Array.isArray(tour?.saidas) && tour.saidas.length ? ` • saídas: ${tour.saidas.join('/')}` : '';
    const desc = tour?.descricao_curta ? ` • ${String(tour.descricao_curta)}` : '';
    return `- ${name}${categoria}${duracao}${saidas}${desc}`.trim();
  })
  .filter(Boolean)
  .join('\n');

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorStatus(error: any): number | undefined {
  const status = error?.status ?? error?.statusCode ?? error?.response?.status;
  return typeof status === 'number' ? status : undefined;
}

function readHeader(headers: any, key: string): string | undefined {
  if (!headers) return undefined;
  const lower = key.toLowerCase();

  if (typeof headers.get === 'function') {
    const value = headers.get(lower) ?? headers.get(key);
    return typeof value === 'string' ? value : undefined;
  }

  if (typeof headers === 'object') {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== lower) continue;
      if (typeof v === 'string') return v;
      if (Array.isArray(v) && typeof v[0] === 'string') return v[0];
    }
  }

  return undefined;
}

function extractRetryAfterMs(error: any): number | undefined {
  const headers = error?.headers ?? error?.response?.headers;
  const retryAfter = readHeader(headers, 'retry-after');
  if (!retryAfter) return undefined;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(retryAfter);
  if (!Number.isNaN(dateMs)) {
    const diff = dateMs - Date.now();
    return diff > 0 ? diff : undefined;
  }

  return undefined;
}

function isRetryableGroqError(error: any): boolean {
  const status = getErrorStatus(error);
  if (status === 429) return true;
  if (status && status >= 500 && status <= 599) return true;
  return false;
}

async function withGroqRetry<T>(fn: () => Promise<T>): Promise<T> {
  const maxRetries = 2;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= maxRetries || !isRetryableGroqError(error)) {
        throw error;
      }

      const retryAfterMs = extractRetryAfterMs(error);
      const backoffMs = 450 * Math.pow(2, attempt);
      const delayMs = Math.min(2500, retryAfterMs ?? backoffMs) + Math.floor(Math.random() * 120);
      await sleep(delayMs);
    }
  }
}

const SYSTEM_PROMPT = `Você é a Ana, atendente da Caleb's Tour (CTC) no WhatsApp.
Tom: carioca, calorosa, humana, prestativa (sem soar robô).

CONTATO HUMANO: (22) 99824-9911.
PAGAMENTO: Pix, dinheiro e cartão (crédito/débito). Pode pedir sinal para garantir a reserva.

DADOS OFICIAIS:
${CALEB_INFO}

PASSEIOS (resumo rápido):
${TOURS_SUMMARY}

REGRAS:
- Responda curto (2-3 frases) e com parágrafos curtos.
- Emojis pontuais.
- Chame o cliente pelo primeiro nome quando souber.
- Sempre finalize com uma pergunta/convite para avançar.
- Não invente preços/dados: se faltar, diga que vai confirmar e peça data + nº de pessoas.`;

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
  { value: 'toboagua', keywords: ['toboagua', 'tobo agua', 'tobo-agua', 'toboágua'] },
  { value: 'openbar', keywords: ['open bar'] },
  { value: 'openfood', keywords: ['open food'] },
  { value: 'arraial', keywords: ['arraial', 'arraial do cabo', 'caribe brasileiro'] },
  { value: 'cabo_frio', keywords: ['cabo frio'] },
  { value: 'escuna', keywords: ['escuna', 'buzios', 'búzios'] },
  { value: 'catamara', keywords: ['catamara', 'catamarã', 'black diamond'] },
  { value: 'lancha', keywords: ['lancha', 'privado', 'vip'] },
  { value: 'quadri', keywords: ['quadriciclo', 'quadri', 'utv'] },
  { value: 'buggy', keywords: ['buggy'] },
  { value: 'jet', keywords: ['jet ski', 'jetski', 'jet'] },
  { value: 'mergulho', keywords: ['mergulho', 'cilindro', 'snorkel'] },
  { value: 'barco', keywords: ['barco', 'passeio de barco', 'catamarã', 'catamara'] },
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
  longTermMemories: string[] = []
): Promise<string> {
  try {
    const messages: any[] = [
      { role: 'system', content: SYSTEM_PROMPT }
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

    const recentHistory = conversationHistory.slice(-6);
    messages.push(...recentHistory);

    messages.push({
      role: 'user',
      content: friendlyName ? `${friendlyName}: ${userMessage}` : userMessage
    });

    const groq = getGroq();
    const completion = await withGroqRetry(() =>
      groq.chat.completions.create({
        model: REASONING_MODEL,
        messages,
        temperature: 0.65,
        max_tokens: 420,
        top_p: 0.9
      })
    );

    const response = completion.choices[0]?.message?.content ||
      'Opa, falhou aqui! Me manda de novo? 😅';

    return response.trim();
  } catch (error) {
    const status = getErrorStatus(error);
    if (status === 429) {
      return 'Tô com muita demanda aqui 😅\nPode tentar de novo em 20s?';
    }
    console.error('Erro Groq:', error);
    return 'Ops, minha conexão oscilou 😔\nMas não desiste de mim! Pode repetir?';
  }
}

export async function detectIntentWithAI(
  message: string,
  options: { mode?: 'auto' | 'ai' | 'heuristic' } = {}
): Promise<{
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

  const mode = options.mode || 'auto';

  if (mode === 'heuristic') {
    return fallbackIntent(trimmed);
  }

  if (mode === 'auto') {
    const heuristic = fallbackIntent(trimmed);
    if (heuristic.intent !== 'duvida' && heuristic.intent !== 'desconhecido') {
      return heuristic;
    }
  }

  try {
    const groq = getGroq();
    const completion = await withGroqRetry(() =>
      groq.chat.completions.create({
        model: INTENT_MODEL,
        messages: [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          { role: 'user', content: trimmed }
        ],
        temperature: 0.2,
        max_tokens: 220
      })
    );

    const content = completion.choices[0]?.message?.content ?? undefined;
    const parsed = parseIntentResponse(content);
    if (parsed) {
      return sanitizeIntentPayload(parsed, trimmed);
    }
  } catch (error) {
    const status = getErrorStatus(error);
    if (status !== 429) {
      console.error('Erro detectIntent:', error);
    }
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
  const passeioFromModel = typeof entities.passeio === 'string' ? entities.passeio : undefined;
  const passeioDetected = detectPasseioKeyword(originalMessage);
  const passeio = passeioFromModel === 'barco' && passeioDetected && passeioDetected !== 'barco'
    ? passeioDetected
    : passeioFromModel || passeioDetected;
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

  if (matches(text, ['quero reservar', 'fazer reserva', 'fechar', 'confirmar passeio', 'pode reservar', 'reservar'])) {
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
  const normalized = normalizeLoose(text);
  for (const item of PASSEIO_KEYWORDS) {
    if (item.keywords.some(keyword => normalized.includes(normalizeLoose(keyword)))) {
      return item.value;
    }
  }
  return undefined;
}

function normalizeLoose(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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

export async function generateVoucherMessage(data: {
  voucherCode: string;
  clienteNome: string;
  passeioNome: string;
  dataPasseio: string;
  horario?: string;
  numPessoas: number;
  valorTotal?: number;
  pontoEncontro?: string;
  pagamento?: {
    metodo: 'pix' | 'boleto';
    invoiceUrl?: string;
    pixCopiaECola?: string;
    boletoUrl?: string;
    vencimento?: string;
  };
}): Promise<string> {
  const payload = {
    voucher: data.voucherCode,
    cliente: data.clienteNome,
    passeio: data.passeioNome,
    data: data.dataPasseio,
    horario: data.horario || 'a confirmar',
    pessoas: data.numPessoas,
    valorTotal: typeof data.valorTotal === 'number' ? Number(data.valorTotal.toFixed(2)) : undefined,
    pontoEncontro: data.pontoEncontro || 'a confirmar',
    pagamento: data.pagamento
  };

  const system = `Você é a Ana (Caleb's Tour) no WhatsApp. Gere uma mensagem de confirmação (voucher) curta, carioca e humanizada.
Regras:
- Use APENAS os dados do JSON do usuário (não invente valores, horários, links).
- Se faltar algo, escreva "a confirmar".
- Use formatação do WhatsApp (negrito com *texto*). NÃO use markdown com **.
- Inclua sempre (se existir no JSON): voucher, passeio, data, horário, pessoas, ponto de encontro e valor total.
- Se existir pagamento, inclua método e link (invoiceUrl/boletoUrl).
- A ÚLTIMA LINHA deve ser uma pergunta e deve terminar com "?" (sem emoji depois).
- 6 a 10 linhas no máximo.`;

  const groq = getGroq();
  const completion = await withGroqRetry(() =>
    groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: JSON.stringify(payload) }
      ],
      temperature: 0.25,
      max_tokens: 520,
      top_p: 0.9
    })
  );

  const response = completion.choices[0]?.message?.content || '';
  return response.trim();
}

export async function generatePriceMessage(data: {
  passeioNome: string;
  precoMin?: number;
  precoMax?: number;
  duracao?: string;
  local?: string;
  userName?: string;
}): Promise<string> {
  const payload = {
    passeio: data.passeioNome,
    precoMin: typeof data.precoMin === 'number' ? Number(data.precoMin.toFixed(2)) : undefined,
    precoMax: typeof data.precoMax === 'number' ? Number(data.precoMax.toFixed(2)) : undefined,
    duracao: data.duracao,
    local: data.local
  };

  const name = data.userName ? data.userName.split(' ')[0] : undefined;

  const system = `Você é a Ana (Caleb's Tour) no WhatsApp. Responda curto, carioca e humano.
Regras:
- Use APENAS os dados do JSON do usuário (não invente preços).
- NÃO diga "por pessoa"/"por casal"/"por máquina" a menos que isso esteja explicitamente no JSON.
- Se tiver faixa (min/max diferentes), diga a faixa.
- Se só tiver um valor, diga só o valor.
- Termine perguntando data e número de pessoas pra avançar.`;

  const groq = getGroq();
  const completion = await withGroqRetry(() =>
    groq.chat.completions.create({
      model: REASONING_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: name ? `${name}: ${JSON.stringify(payload)}` : JSON.stringify(payload) }
      ],
      temperature: 0.55,
      max_tokens: 260,
      top_p: 0.9
    })
  );

  const response = completion.choices[0]?.message?.content || '';
  return response.trim();
}
