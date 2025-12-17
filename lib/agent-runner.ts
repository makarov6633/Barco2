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

function applyWhatsAppExpansions(value?: string) {
  let s = String(value || '');
  s = s.replace(/\u00A0/g, ' ');
  s = s.toLowerCase();

  s = s.replace(/(^|\s)p\s*\/\s*/g, '$1para ');
  s = s.replace(/\bqto\b/g, 'quanto');
  s = s.replace(/\bqnt\b/g, 'quanto');
  s = s.replace(/\bqtos\b/g, 'quantos');
  s = s.replace(/\bqtas\b/g, 'quantas');
  s = s.replace(/\bqro\b/g, 'quero');
  s = s.replace(/\bkero\b/g, 'quero');
  s = s.replace(/\bvc\b/g, 'voce');
  s = s.replace(/\bvcs\b/g, 'voces');
  s = s.replace(/\bpq\b/g, 'porque');
  s = s.replace(/\bpfv\b/g, 'por favor');
  s = s.replace(/\bpls\b/g, 'por favor');
  s = s.replace(/\bhj\b/g, 'hoje');
  s = s.replace(/\bamnh\b/g, 'amanha');
  s = s.replace(/\bdps\b/g, 'depois');
  s = s.replace(/\bprx\b/g, 'proximo');
  s = s.replace(/\bprox\b/g, 'proximo');
  s = s.replace(/\bopenbar\b/g, 'open bar');
  s = s.replace(/\bopenfood\b/g, 'open food');
  s = s.replace(/\bbraco\b/g, 'barco');
  s = s.replace(/\bbarc\b/g, 'barco');
  s = s.replace(/\bjet\s*ski\b/g, 'jetski');
  s = s.replace(/\b(\d{1,2})\s*(?:p|pax)\b/g, '$1 pessoas');

  return s;
}

function normalizeWhatsApp(value?: string) {
  return normalizeString(applyWhatsAppExpansions(value));
}

function tokenizeForMatch(normalized: string) {
  return Array.from(new Set((normalized || '').split(' ').map(t => t.trim()).filter(t => t.length >= 2)));
}

function diceCoefficient(a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;

  const n = a.length < 6 || b.length < 6 ? 2 : 3;

  const build = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i <= s.length - n; i++) {
      const g = s.slice(i, i + n);
      m.set(g, (m.get(g) || 0) + 1);
    }
    return m;
  };

  const ma = build(a);
  const mb = build(b);

  let overlap = 0;
  let ca = 0;
  let cb = 0;

  for (const v of ma.values()) ca += v;
  for (const v of mb.values()) cb += v;

  for (const [g, countA] of ma.entries()) {
    const countB = mb.get(g) || 0;
    overlap += Math.min(countA, countB);
  }

  if (ca + cb === 0) return 0;
  return (2 * overlap) / (ca + cb);
}

function tokenJaccard(a: string, b: string) {
  const ta = tokenizeForMatch(a);
  const tb = tokenizeForMatch(b);
  if (!ta.length || !tb.length) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);

  let inter = 0;
  for (const t of setA) {
    if (setB.has(t)) inter++;
  }

  const union = setA.size + setB.size - inter;
  return union > 0 ? inter / union : 0;
}

function similarityScore(queryNorm: string, optionNorm: string) {
  if (!queryNorm || !optionNorm) return 0;
  if (queryNorm === optionNorm) return 1;

  const q = queryNorm;
  const o = optionNorm;

  if (q.length >= 4 && (o.includes(q) || q.includes(o))) return 0.95;

  const dice = diceCoefficient(q, o);
  const jac = tokenJaccard(q, o);
  return 0.62 * dice + 0.38 * jac;
}

function bestFuzzyOptionIndex(userMessage: string, options: string[]) {
  const q = normalizeWhatsApp(userMessage);
  if (!q) return undefined;

  let bestIdx = -1;
  let best = 0;
  let second = 0;

  for (let i = 0; i < options.length; i++) {
    const o = normalizeWhatsApp(options[i]);
    const score = similarityScore(q, o);
    if (score > best) {
      second = best;
      best = score;
      bestIdx = i;
    } else if (score > second) {
      second = score;
    }
  }

  if (bestIdx < 0) return undefined;
  return { index: bestIdx, score: best, secondScore: second };
}

function selectHistoryForPrompt(history: Array<{ role: string; content: string }>): ChatMessage[] {
  const selected: ChatMessage[] = [];

  let dialogCount = 0;
  let toolCount = 0;

  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    const role = h?.role as any;
    const content = typeof h?.content === 'string' ? h.content : '';
    if (!content) continue;

    if (role === 'assistant') {
      if (/\[TOOL:/i.test(content)) continue;
      if (dialogCount >= 12) continue;
      selected.push({ role, content });
      dialogCount += 1;
      continue;
    }

    if (role === 'user') {
      if (dialogCount >= 12) continue;
      selected.push({ role, content });
      dialogCount += 1;
      continue;
    }

    if (role === 'system') {
      if (/^INSTRUÇÃO:/i.test(content)) continue;
      if (!/<tool_result\b/i.test(content)) continue;
      if (toolCount >= 6) continue;
      selected.push({ role, content });
      toolCount += 1;
      continue;
    }
  }

  selected.reverse();
  return selected;
}

type PaymentType = 'PIX' | 'BOLETO';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

type PlannedToolCall = { name: ToolName; params: any };

type PlannerDecision = {
  action: 'tool' | 'reply';
  tool_calls?: PlannedToolCall[];
  reply?: string;
  wants_menu?: boolean;
};

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
  const t = normalizeWhatsApp(message);
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

  const compact = raw.match(/\b(\d{1,2})\s*(?:p|pax)\b/i);
  if (compact) {
    const n = Number.parseInt(compact[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 99) return n;
  }

  const m = raw.match(/\b(\d{1,3})\s*(pessoas?|adultos?|criancas?|crianças?)\b/i);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (Number.isFinite(n) && n > 0 && n <= 99) return n;
  }

  const lower = normalizeWhatsApp(raw);
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
  const t = normalizeWhatsApp(message);
  if (!t) return undefined;

  const m = t.match(/^(?:opcao|op|numero|num|n)?\s*(\d{1,2})$/i);
  if (!m?.[1]) return undefined;

  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1 || n > max) return undefined;
  return n;
}

function extractOptionIndexLoose(message: string) {
  const t = normalizeWhatsApp(message);
  if (!t) return undefined;

  const m = t.match(/^(?:opcao|op|numero|num|n)?\s*(\d{1,2})$/i);
  if (!m?.[1]) return undefined;

  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

function hasWord(t: string, word: string) {
  if (!t || !word) return false;
  const re = new RegExp(`\\b${word}\\b`, 'i');
  return re.test(t);
}

function isNegatedMention(t: string, term: string) {
  if (!t || !term) return false;
  if (!hasWord(t, term)) return false;
  const re = new RegExp(`\\b(nao|sem|dispenso|nem)\\b(?:\\s+\\w+){0,4}\\s+${term}\\b`, 'i');
  return re.test(t);
}

function hasPositiveMention(t: string, term: string) {
  return hasWord(t, term) && !isNegatedMention(t, term);
}

function looksLikeStall(text: string) {
  const t = normalizeWhatsApp(text);
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

  return `Você é assistente de vendas da Caleb's Tour (passeios em Arraial do Cabo/RJ). Data: ${todayBR}.

REGRAS CRÍTICAS:
1. TODO catálogo/preço/disponibilidade vem do Supabase via ferramentas - NUNCA invente/negue sem consultar
2. Para perguntas de regras/logística/políticas (cancelamento, reembolso, taxa de embarque, ponto de encontro, crianças, horários, o que inclui): chame consultar_conhecimento ANTES de responder
3. Para dúvidas de valores/opções ou quando citar um passeio (barco, buggy, quadriciclo, mergulho, transfer, city tour etc.): chame consultar_passeios (ou buscar_passeio_especifico se tiver nome) ANTES de responder
4. Se o cliente apenas cumprimentar (oi/olá/bom dia/boa tarde/boa noite): responda educado e ofereça ver os passeios e valores; pergunte a preferência (Barco, Buggy, Quadriciclo, Mergulho, Transfer)
5. NUNCA diga "não temos X" sem consultar_passeios ou buscar_passeio_especifico
6. Tom: calmo, educado, direto e vendedor
7. Se o cliente pedir para ver passeios/valores/opções: liste opções com preço e peça para responder o número. Só peça data e número de pessoas depois que ele escolher o passeio.
8. Para "passeio de barco": ao consultar catálogo, use termo curto (ex: {"termo":"barco"}) para trazer opções relacionadas (inclusive city tour/combos cujo texto mencione barco). Não use termos longos tipo "passeio de barco".
9. Mensagens CURTAS (máx 3 linhas), sem emojis, sem repetição
10. Use dados do <tool_result> para responder - nunca mostre JSON/IDs/tags ao cliente

FERRAMENTAS (sintaxe: [TOOL:nome]{json}[/TOOL]):
- consultar_passeios: busca catálogo (termo opcional)
- buscar_passeio_especifico: busca por nome exato
- consultar_conhecimento: FAQ/políticas
- criar_reserva: cria reserva (requer nome, passeio_id, data, num_pessoas)
- gerar_pagamento: gera PIX/boleto (requer reserva_id, cpf)
- gerar_voucher: gera voucher
- cancelar_reserva: cancela

COLETA DE DADOS (NÃO REPITA):
- Nome, passeio, data, qtd pessoas
- CPF só no final após cliente autorizar pagamento

RESPOSTA:
- Ao listar opções: numere e mostre preço (ex: "1) Buggy Exclusivo — R$ 1.200,00")
- Máximo 12 opções
- Curto e direto`;
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
  const selected = selectHistoryForPrompt(history);

  if (!selected.length) {
    messages.push({ role: 'system', content: buildStateSummary(context) });
    return messages;
  }

  const last = selected[selected.length - 1];
  const rest = selected.slice(0, -1);
  messages.push(...rest);
  messages.push({ role: 'system', content: buildStateSummary(context) });
  messages.push(last);

  return messages;
}

function looksLikeQuestionOrSlotRequest(text: string) {
  if (!text) return false;
  if (text.includes('?')) return true;

  const t = normalizeWhatsApp(text);
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
  const t = normalizeWhatsApp(userMessage);
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
  const nowISO = new Date().toISOString();

  const cpf = extractCpfCnpjDigits(userMessage);
  if (cpf) context.tempData.cpf = cpf;

  const email = extractEmail(userMessage);
  if (email) context.tempData.email = email;

  const expanded = applyWhatsAppExpansions(userMessage);

  const paymentChoice = detectPaymentType(expanded);
  if (paymentChoice) context.tempData.tipoPagamento = paymentChoice;

  const dateISO = normalizeDateToISO(expanded);
  if (dateISO) {
    context.tempData.data = dateISO;
    context.tempData.dataUpdatedAt = nowISO;
  }

  const pessoas = extractNumPessoas(expanded);
  if (pessoas != null) {
    context.tempData.numPessoas = pessoas;
    context.tempData.numPessoasUpdatedAt = nowISO;
  }

  const name = extractNameCandidate(userMessage);
  if (name && !context.nome) {
    context.nome = name;
    context.tempData.nomeUpdatedAt = nowISO;
  }
}

function handleOptionSelection(context: ConversationContext, userMessage: string): boolean {
  const ids = Array.isArray(context.tempData?.optionIds) ? context.tempData?.optionIds : [];
  const options = Array.isArray(context.tempData?.optionList) ? context.tempData?.optionList : [];
  const rawOptions = Array.isArray((context.tempData as any)?.optionRawList) ? (context.tempData as any).optionRawList : [];

  const max = Math.max(ids.length, options.length, rawOptions.length);
  if (max <= 0) return false;

  let idx = extractOptionIndexStrict(userMessage, max);

  const matchAgainst = rawOptions.length ? rawOptions : options;

  if (idx == null && matchAgainst.length > 0) {
    const match = bestFuzzyOptionIndex(userMessage, matchAgainst);
    if (match && match.score >= 0.62 && match.score - (match.secondScore ?? 0) >= 0.08) {
      idx = match.index + 1;
    }
  }

  if (idx == null) return false;

  const selectedName = rawOptions[idx - 1] || options[idx - 1];
  if (!selectedName) return false;

  const selectedId = ids[idx - 1];

  context.tempData ||= {};
  if (selectedId) context.tempData.passeioId = selectedId;
  context.tempData.passeioNome = selectedName;
  context.tempData.passeioSelectedAt = new Date().toISOString();

  if (context.tempData.passeioNome && (context.tempData.passeioNome.includes('—') || context.tempData.passeioNome.includes('–'))) {
     context.tempData.passeioNome = context.tempData.passeioNome.split(/(?:—|–)/)[0].trim();
  }

  return true;
}

function buildPostSelectionResponse(context: ConversationContext): string {
  const passeio = context.tempData?.passeioNome || context.tempData?.passeio || 'o passeio';
  const nome = context.nome;
  const dataISO = context.tempData?.data;
  const pessoas = context.tempData?.numPessoas;

  const todayISO = getBrazilTodayISO();
  const dateLooksValid = !!(dataISO && /^\d{4}-\d{2}-\d{2}$/.test(dataISO) && dataISO >= todayISO);

  const missing: string[] = [];
  if (!nome) missing.push('seu nome');
  if (!dateLooksValid || !context.tempData?.dataUpdatedAt) missing.push('a data');
  if (pessoas == null || !context.tempData?.numPessoasUpdatedAt) missing.push('quantas pessoas');

  if (missing.length === 3) {
    return `Escolheu ${passeio}. Preciso de: seu nome, data e quantas pessoas.`;
  }

  if (missing.length === 1) {
    return `Escolheu ${passeio}. Só falta: ${missing[0]}.`;
  }

  if (missing.length === 0) {
    return `Escolheu ${passeio}. Confirme: ${formatISOToBR(dataISO)} para ${pessoas} pessoa(s).`;
  }

  return `Escolheu ${passeio}. Faltam: ${missing.join(', ')}.`;
}

type PasseiosPrefetchPlan = { should: boolean; termo?: string; wantsAll?: boolean };

type PrefetchMenuResponsePlan =
  | { kind: 'none' }
  | { kind: 'buggy' }
  | { kind: 'list' };

function formatOptionsMenuLines(options: string[]) {
  const limited = (Array.isArray(options) ? options : []).slice(0, 12);
  if (!limited.length) return '';
  return limited.map((o, i) => `${i + 1}) ${o}`).join('\n');
}

function getPrefetchMenuResponsePlan(userMessage: string, prefetch: PasseiosPrefetchPlan): PrefetchMenuResponsePlan {
  if (!prefetch?.should) return { kind: 'none' };

  const t = normalizeWhatsApp(userMessage);
  if (!t) return { kind: 'none' };

  if (prefetch?.termo === 'buggy' || hasPositiveMention(t, 'buggy')) return { kind: 'buggy' };

  const wantsAll =
    (t.includes('todos os passeios') || t.includes('todas as opcoes') || t.includes('todas opcoes')) ||
    (t.includes('cade') && (t.includes('passeios') || t.includes('passeio')));

  const wantsList =
    wantsAll ||
    t.includes('opcoes') ||
    t.includes('opcao') ||
    t.includes('catalogo') ||
    t.includes('outro passeio') ||
    t.includes('outros passeios') ||
    t.includes('quero outro') ||
    t.includes('quero ver') ||
    t.includes('mostrar passeios');

  if (wantsList) return { kind: 'list' };
  if (prefetch.termo) return { kind: 'list' };

  return { kind: 'none' };
}

function buildPrefetchMenuResponse(userMessage: string, context: ConversationContext, prefetch: PasseiosPrefetchPlan): string | undefined {
  const plan = getPrefetchMenuResponsePlan(userMessage, prefetch);
  if (plan.kind === 'none') return undefined;

  const options = Array.isArray(context.tempData?.optionList) ? context.tempData.optionList : [];
  const lines = formatOptionsMenuLines(options);

  if (plan.kind === 'buggy') {
    if (!lines) {
      return 'Não encontrei buggy cadastrado no sistema. Tem o nome exato ou link do passeio?';
    }
    return `Opções de buggy:\n${lines}\n\nResponda o número.`;
  }

  if (!lines) {
    return 'Nenhuma opção disponível no momento.';
  }

  const hint = (context.tempData as any)?.typoHint;
  if (hint) delete (context.tempData as any).typoHint;
  const prefix = hint === 'braco' ? 'Você quis dizer passeio de barco?\n' : '';
  return `${prefix}Passeios disponíveis:\n${lines}\n\nResponda o número.`;
}

function getRecentOptionStrings(context: ConversationContext) {
  const raw = Array.isArray((context.tempData as any)?.optionRawList) ? ((context.tempData as any).optionRawList as string[]) : [];
  const pretty = Array.isArray(context.tempData?.optionList) ? (context.tempData?.optionList as string[]) : [];
  return raw.length ? raw : pretty;
}

function optionsLikelyContain(context: ConversationContext, term: string) {
  const opts = getRecentOptionStrings(context);
  if (!opts.length) return false;
  const hay = normalizeWhatsApp(opts.join(' | '));
  const needle = normalizeWhatsApp(term);
  if (!needle) return false;
  return hay.includes(needle);
}

function getPasseiosPrefetchPlan(userMessage: string, context: ConversationContext): PasseiosPrefetchPlan {
  const t = normalizeWhatsApp(userMessage);
  if (!t) return { should: false };

  const wantsAll =
    (t.includes('todos os passeios') || t.includes('todas as opcoes') || t.includes('todas opcoes')) ||
    (t.includes('cade') && (t.includes('passeios') || t.includes('passeio'))) ||
    t.includes('quais passeios') ||
    t.includes('quais outros passeios');

  const wantsList =
    wantsAll ||
    t.includes('opcoes') ||
    t.includes('opcao') ||
    t.includes('catalogo') ||
    t.includes('outro passeio') ||
    t.includes('outros passeios') ||
    t.includes('quero outro') ||
    t.includes('quero ver') ||
    t.includes('mostrar passeios') ||
    t.includes('quais passeios');

  let termo: string | undefined;
  if (hasPositiveMention(t, 'buggy')) termo = 'buggy';
  else if (hasPositiveMention(t, 'quadriciclo')) termo = 'quadriciclo';
  else if (hasPositiveMention(t, 'toboagua')) termo = 'toboagua';
  else if (t.includes('open bar') || t.includes('open food')) termo = 'open bar';
  else if (hasPositiveMention(t, 'transfer')) termo = 'transfer';
  else if (hasPositiveMention(t, 'city')) termo = 'city';
  else if (hasPositiveMention(t, 'barco')) termo = 'barco';
  else if (hasPositiveMention(t, 'mergulho')) termo = 'mergulho';
  else if (hasPositiveMention(t, 'jetski')) termo = 'jetski';

  const shouldConsider = wantsList || !!termo;
  if (!shouldConsider) return { should: false };

  if (wantsAll) return { should: true, wantsAll: true };
  if (wantsList) return { should: true, termo };
  if (termo) return { should: true, termo };

  return { should: false };
}

function stripDeepSeekThink(text: string) {
  return (text || '')
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim();
}

function extractJsonObject(raw: string) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return {};

  const cleaned = trimmed
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido');
    return JSON.parse(match[0]);
  }
}

function buildPlannerPrompt(context: ConversationContext) {
  const todayISO = getBrazilTodayISO();
  const todayBR = formatISOToBR(todayISO);

  return `Você é um PLANNER de ferramentas para um atendente da Caleb's Tour (WhatsApp). Data: ${todayBR}.

Responda APENAS com JSON válido (sem texto antes/depois). Schema:
{
  "action": "tool" | "reply",
  "tool_calls"?: [{"name": string, "params": object}],
  "reply"?: string,
  "wants_menu"?: boolean
}

Regras:
- Se a mensagem pede preço/valores/catálogo/opções, SEMPRE action="tool" e chame consultar_passeios.
- Se a mensagem pede regras/logística/políticas (cancelamento, reembolso, taxa, ponto de encontro, crianças, horários, o que inclui), SEMPRE action="tool" e chame consultar_conhecimento.
- Se o cliente cita um tipo de passeio (barco/buggy/quadriciclo/mergulho/transfer/city/combo), use consultar_passeios com termo curto (ex: "barco").
- Se o cliente já escolheu um passeio (ESTADO mostra Passeio selecionado), não chame consultar_passeios só para listar de novo.
- Se a mensagem estiver ambígua (possível erro de digitação) e você precisar confirmar, use action="reply" para pedir esclarecimento.
- Se você não tiver certeza do assunto, prefira action="tool" e chame consultar_conhecimento com {"termo": "<mensagem do cliente>"}.
- Não invente parâmetros; se não tiver termo, use {}.
- Nunca chame ferramenta que não exista.

Ferramentas permitidas: consultar_passeios, buscar_passeio_especifico, consultar_conhecimento, criar_reserva, gerar_pagamento, gerar_voucher, cancelar_reserva.

${buildStateSummary(context)}`;
}

function parsePlannerDecision(raw: string): PlannerDecision | undefined {
  try {
    const obj = extractJsonObject(stripDeepSeekThink(raw));
    if (!obj || typeof obj !== 'object') return undefined;

    const actionRaw = String((obj as any).action || '').toLowerCase();
    const action = actionRaw === 'tool' || actionRaw === 'reply' ? (actionRaw as any) : undefined;
    if (!action) return undefined;

    const wants_menu = (obj as any).wants_menu === true;

    const tool_calls = Array.isArray((obj as any).tool_calls)
      ? (obj as any).tool_calls
          .map((c: any) => ({
            name: String(c?.name || '').toLowerCase() as ToolName,
            params: c?.params && typeof c.params === 'object' && !Array.isArray(c.params) ? c.params : {}
          }))
          .filter((c: any) => !!c.name)
      : undefined;

    const reply = typeof (obj as any).reply === 'string' ? String((obj as any).reply).trim() : undefined;

    return { action, tool_calls, reply, wants_menu };
  } catch {
    return undefined;
  }
}

function buildHeuristicToolCalls(userMessage: string, context: ConversationContext): PlannedToolCall[] {
  const t = normalizeWhatsApp(userMessage);

  const policyTerms = [
    'cancelar',
    'cancelamento',
    'reembolso',
    'estorno',
    'taxa',
    'embarque',
    'ponto',
    'encontro',
    'endereco',
    'endereço',
    'crianca',
    'criança',
    'horario',
    'horário',
    'inclui',
    'o que inclui',
    'politica',
    'política'
  ];

  const wantsPolicy = policyTerms.some((k) => t.includes(normalizeWhatsApp(k)));
  if (wantsPolicy) {
    return [{ name: 'consultar_conhecimento', params: { termo: userMessage } }];
  }

  const prefetch = getPasseiosPrefetchPlan(userMessage, context);
  const termo = prefetch?.wantsAll ? undefined : prefetch?.termo;

  if (t.includes('valores') || t.includes('catalogo') || t.includes('catálogo') || t.includes('todos os passeios') || t.includes('todas as opcoes') || t.includes('todas opcoes')) {
    return [{ name: 'consultar_passeios', params: {} }];
  }

  if (termo) {
    return [{ name: 'consultar_passeios', params: { termo } }];
  }

  return [{ name: 'consultar_passeios', params: {} }];
}

async function runPlannerToolPhase(params: {
  telefone: string;
  userMessage: string;
  context: ConversationContext;
  allowedTools: Set<ToolName>;
}) {
  const { telefone, userMessage, context, allowedTools } = params;

  const plannerMessages: ChatMessage[] = [
    { role: 'system', content: buildPlannerPrompt(context) },
    { role: 'user', content: userMessage }
  ];

  let decision: PlannerDecision | undefined;
  try {
    const raw = await groqChat({ messages: plannerMessages, temperature: 0.05, max_tokens: 220 });
    decision = parsePlannerDecision(raw);
  } catch {
    decision = undefined;
  }

  if (decision?.action === 'reply' && typeof decision.reply === 'string' && decision.reply.trim()) {
    return { kind: 'reply' as const, text: stripEmojis(decision.reply.trim()) };
  }

  let toolCalls = (decision?.action === 'tool' ? (decision?.tool_calls || []) : []).filter((c) => allowedTools.has(c.name));
  if (!toolCalls.length) {
    toolCalls = buildHeuristicToolCalls(userMessage, context).filter((c) => allowedTools.has(c.name));
  }

  const executed = await Promise.all(
    toolCalls.map(async (call) => {
      const name = call.name;
      const toolParams = enrichToolParams(name, call.params || {}, context);

      let result: any;
      try {
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timed out')), 10000));
        result = await Promise.race([
          executeTool(name, toolParams, { telefone, conversation: context }),
          timeoutPromise
        ]);
      } catch {
        result = {
          success: false,
          error: { code: 'timeout', message: 'A ferramenta demorou muito para responder.' }
        };
      }

      const tag = `<tool_result name="${name}">${JSON.stringify(result)}</tool_result>`;
      return { name, result, tag };
    })
  );

  executed.forEach((r) => context.conversationHistory.push({ role: 'system', content: r.tag }));

  const wantsMenu = decision?.wants_menu === true || (() => {
    const t = normalizeWhatsApp(userMessage);
    if (!t) return false;
    const cues = ['opcoes','opcao','catalogo','valores','valor','preco','quanto','custa','passeio','passeios','barco','buggy','quadriciclo','mergulho','transfer','city','combo'];
    return cues.some((c) => t.includes(c));
  })();

  const hadCatalog = executed.some(
    (r) => (r.name === 'consultar_passeios' || r.name === 'buscar_passeio_especifico') && r.result?.success
  );

  if (wantsMenu && hadCatalog) {
    const options = Array.isArray(context.tempData?.optionList) ? context.tempData.optionList : [];
    const lines = formatOptionsMenuLines(options);
    if (lines) {
      const hint = (context.tempData as any)?.typoHint;
      if (hint) delete (context.tempData as any).typoHint;
      const prefix = hint === 'braco' ? 'Você quis dizer passeio de barco?\n' : '';
      return { kind: 'menu' as const, text: `${prefix}Passeios disponíveis:\n${lines}\n\nResponda o número.` };
    }
  }

  const todayISO = getBrazilTodayISO();
  const systemPrompt = buildSystemPrompt(todayISO);
  const state = buildStateSummary(context);
  const evidence = `DADOS DAS FERRAMENTAS (não mostrar ao cliente):\n${executed.map((r) => r.tag).join('\n')}\n\nResponda agora ao cliente em texto curto, calmo e vendedor, sem emojis, sem JSON e sem tags internas.`;

  const replyRaw = await groqChat({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'system', content: state },
      { role: 'system', content: evidence },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.18,
    max_tokens: 380
  });

  const cleaned = stripEmojis(stripToolBlocks(stripDeepSeekThink(replyRaw)));

  return { kind: 'reply' as const, text: cleaned || 'Desculpe, tive uma instabilidade. Pode enviar novamente sua solicitação em uma frase?' };
}

export async function runAgentLoop(params: {
  telefone: string;
  userMessage: string;
  context: ConversationContext;
}) {
  const { telefone, context } = params;
  const originalUserMessage = params.userMessage;
  let effectiveUserMessage = originalUserMessage;
  const loopStartTime = Date.now();
  const GLOBAL_TIMEOUT_MS = 25000;

  context.conversationHistory ||= [];
  context.tempData ||= {};

  const nowISO = new Date().toISOString();
  const rawLower = String(originalUserMessage || '').toLowerCase();

  const isYes = (msg: string) => {
    const t = normalizeWhatsApp(msg);
    if (!t) return false;
    return ['sim', 'isso', 'exato', 'correto', 's', 'ss', 'barco'].includes(t) || t.startsWith('sim ') || t === 'isso ai' || t === 'isso mesmo';
  };

  const awaitingTerm = String((context.tempData as any)?.awaitingTypoConfirmTerm || '').trim();
  const awaitingAt = String((context.tempData as any)?.awaitingTypoConfirmAt || '').trim();
  const awaitingAgeOk = (() => {
    if (!awaitingAt) return false;
    const ts = Date.parse(awaitingAt);
    if (!Number.isFinite(ts)) return false;
    return (Date.now() - ts) <= 10 * 60 * 1000;
  })();

  if (awaitingTerm && awaitingAgeOk && isYes(originalUserMessage)) {
    (context.tempData as any).awaitingTypoConfirmTerm = undefined;
    (context.tempData as any).awaitingTypoConfirmAt = undefined;
    effectiveUserMessage = awaitingTerm;
  } else if (awaitingTerm && !awaitingAgeOk) {
    (context.tempData as any).awaitingTypoConfirmTerm = undefined;
    (context.tempData as any).awaitingTypoConfirmAt = undefined;
  }

  if (rawLower.includes('braco') && !rawLower.includes('barco')) {
    (context.tempData as any).awaitingTypoConfirmTerm = 'barco';
    (context.tempData as any).awaitingTypoConfirmAt = nowISO;
    const clarification = "O senhor está falando de barco? Você digitou 'braco'.";
    context.conversationHistory.push({ role: 'user', content: originalUserMessage });
    context.conversationHistory.push({ role: 'assistant', content: clarification });
    return clarification;
  }

  let userMessage = effectiveUserMessage;

  context.conversationHistory.push({ role: 'user', content: originalUserMessage });

  updateSlotsFromUserMessage(context, userMessage);
  const justSelected = handleOptionSelection(context, userMessage);

  if (justSelected) {
    const todayISO = getBrazilTodayISO();
    const nome = context.nome;
    const dataISO = context.tempData?.data;
    const pessoas = context.tempData?.numPessoas;

    const missing: string[] = [];
    if (!nome) missing.push('seu nome');

    const dateLooksValid = !!(dataISO && /^\d{4}-\d{2}-\d{2}$/.test(dataISO) && dataISO >= todayISO);
    if (!dateLooksValid || !context.tempData?.dataUpdatedAt) missing.push('a data');

    if (pessoas == null || !context.tempData?.numPessoasUpdatedAt) missing.push('quantas pessoas');

    if (missing.length) {
      const directReply = buildPostSelectionResponse(context);
      context.conversationHistory.push({ role: 'assistant', content: directReply });
      return directReply;
    }

    try {
      const result = await executeTool('criar_reserva', {}, { telefone, conversation: context });
      const tag = `<tool_result name="criar_reserva">${JSON.stringify(result)}</tool_result>`;
      context.conversationHistory.push({ role: 'system', content: tag });

      if (result?.success) {
        const data = result.data || {};
        const passeioNome = data.passeio_nome || context.tempData?.passeioNome || 'o passeio';
        const when = data.data || context.tempData?.data || '';
        const np = data.num_pessoas || context.tempData?.numPessoas;
        const total = typeof data.valor_total === 'number' ? `R$ ${data.valor_total.toFixed(2).replace('.', ',')}` : undefined;
        const line1 = `Reserva criada: ${passeioNome} — ${formatISOToBR(when)} (${np} pessoa(s)).`;
        const line2 = total ? `Total: ${total}.` : '';
        const line3 = 'PIX ou BOLETO?';
        const reply = [line1, line2, line3].filter(Boolean).join('\n');
        context.conversationHistory.push({ role: 'assistant', content: reply });
        return reply;
      }

      const directReply = buildPostSelectionResponse(context);
      context.conversationHistory.push({ role: 'assistant', content: directReply });
      return directReply;
    } catch {
      const directReply = buildPostSelectionResponse(context);
      context.conversationHistory.push({ role: 'assistant', content: directReply });
      return directReply;
    }
  }

  const looseIdx = extractOptionIndexLoose(userMessage);
  if (looseIdx != null) {
    const ids = Array.isArray(context.tempData?.optionIds) ? context.tempData.optionIds : [];
    const options = Array.isArray(context.tempData?.optionList) ? context.tempData.optionList : [];
    const rawOptions = Array.isArray((context.tempData as any)?.optionRawList) ? (context.tempData as any).optionRawList : [];
    const max = Math.max(ids.length, options.length, rawOptions.length);

    if (max > 0 && (looseIdx < 1 || looseIdx > max)) {
      const lines = formatOptionsMenuLines(options.length ? options : rawOptions);
      if (!lines) return `Opção inválida. Responda um número de 1 a ${max}.`;
      return `Opção inválida. Responda um número de 1 a ${max}.\n${lines}`;
    }
  }

  const allowedTools = new Set<ToolName>([
    'consultar_passeios',
    'buscar_passeio_especifico',
    'consultar_conhecimento',
    'criar_reserva',
    'gerar_pagamento',
    'gerar_voucher',
    'cancelar_reserva'
  ]);

  const maxSteps = 8;
  let hasToolResultThisRun = false;

  try {
    const planned = await runPlannerToolPhase({ telefone, userMessage, context, allowedTools });
    context.conversationHistory.push({ role: 'assistant', content: planned.text });
    return planned.text;
  } catch {
    // continue to legacy loop
  }

  for (let step = 0; step < maxSteps; step++) {
    if (Date.now() - loopStartTime > GLOBAL_TIMEOUT_MS) {
       return 'Desculpe, a operação demorou muito. Poderia tentar novamente?';
    }

    const messages = buildMessages(context);
    const assistantRaw = await groqChat({ messages, temperature: 0.18, max_tokens: 380 });
    const assistant = stripDeepSeekThink(assistantRaw);

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
        const force = shouldForceToolForUserMessage(userMessage);

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

    // Parallel Tool Execution using n8n-style efficiency
    // We execute ALL valid tool calls found in the response, not just the first one.
    
    context.conversationHistory.push({ role: 'assistant', content: assistant });

    const validCalls = calls.filter(c => allowedTools.has(c.name.toLowerCase() as ToolName));
    const invalidCalls = calls.filter(c => !allowedTools.has(c.name.toLowerCase() as ToolName));

    if (invalidCalls.length > 0) {
      for (const call of invalidCalls) {
        context.conversationHistory.push({
          role: 'system',
          content: `<tool_result name="${call.name}">${JSON.stringify({
            success: false,
            error: { code: 'unknown_tool', message: 'Ferramenta não permitida.' }
          })}</tool_result>`
        });
      }
      hasToolResultThisRun = true;
    }

    if (validCalls.length > 0) {
      const promises = validCalls.map(async (call) => {
        const name = call.name.toLowerCase() as ToolName;
        const toolParams = enrichToolParams(name, call.params || {}, context);
        let result: any;
        try {
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timed out')), 10000));
          result = await Promise.race([
            executeTool(name, toolParams, { telefone, conversation: context }),
            timeoutPromise
          ]);
        } catch {
          result = {
            success: false,
            error: { code: 'timeout', message: 'A ferramenta demorou muito para responder.' }
          };
        }

        const tag = `<tool_result name="${name}">${JSON.stringify(result)}</tool_result>`;
        return { name, result, tag };
      });

      const executed = await Promise.all(promises);
      executed.forEach((r) => context.conversationHistory.push({ role: 'system', content: r.tag }));
      hasToolResultThisRun = true;

      const wantsMenu = (() => {
        const t = normalizeWhatsApp(userMessage);
        if (!t) return false;
        const cues = [
          'opcoes',
          'opcao',
          'catalogo',
          'valores',
          'valor',
          'preco',
          'quanto',
          'custa',
          'passeio',
          'passeios',
          'barco',
          'buggy',
          'quadriciclo',
          'mergulho',
          'transfer',
          'city',
          'combo'
        ];
        return cues.some((c) => t.includes(c));
      })();

      const hadCatalog = executed.some(
        (r) => (r.name === 'consultar_passeios' || r.name === 'buscar_passeio_especifico') && r.result?.success
      );

      if (wantsMenu && hadCatalog) {
        const options = Array.isArray(context.tempData?.optionList) ? context.tempData.optionList : [];
        const lines = formatOptionsMenuLines(options);
        if (lines) {
          const hint = (context.tempData as any)?.typoHint;
          if (hint) delete (context.tempData as any).typoHint;
          const prefix = hint === 'braco' ? 'Você quis dizer passeio de barco?\n' : '';
          return `${prefix}Passeios disponíveis:\n${lines}\n\nResponda o número.`;
        }
      }

      context.conversationHistory.push({
        role: 'system',
        content:
          'INSTRUÇÃO: Agora responda em TEXTO FINAL ao cliente usando os últimos <tool_result>. Não chame mais ferramentas e não escreva blocos [TOOL:...] nesta resposta.'
      });
    }
  }

  return 'Desculpe, tive uma instabilidade. Pode enviar novamente sua solicitação em uma frase?';
}
