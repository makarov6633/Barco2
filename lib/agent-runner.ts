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
2. Se cliente pedir "buggy", "quadriciclo", "barco", ou qualquer produto: chame consultar_passeios ANTES de responder
3. NUNCA diga "não temos X" sem consultar_passeios ou buscar_passeio_especifico
4. Mensagens CURTAS (máx 3 linhas), sem emojis, sem repetição
5. Use dados do <tool_result> para responder - nunca mostre JSON/IDs/tags ao cliente

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

  const cpf = extractCpfCnpjDigits(userMessage);
  if (cpf) context.tempData.cpf = cpf;

  const email = extractEmail(userMessage);
  if (email) context.tempData.email = email;

  const expanded = applyWhatsAppExpansions(userMessage);

  const paymentChoice = detectPaymentType(expanded);
  if (paymentChoice) context.tempData.tipoPagamento = paymentChoice;

  const dateISO = normalizeDateToISO(expanded);
  if (dateISO) context.tempData.data = dateISO;

  const pessoas = extractNumPessoas(expanded);
  if (pessoas != null) context.tempData.numPessoas = pessoas;

  const name = extractNameCandidate(userMessage);
  if (name && !context.nome) context.nome = name;
}

function handleOptionSelection(context: ConversationContext, userMessage: string): boolean {
  const ids = Array.isArray(context.tempData?.optionIds) ? context.tempData?.optionIds : [];
  const options = Array.isArray(context.tempData?.optionList) ? context.tempData?.optionList : [];
  const rawOptions = Array.isArray((context.tempData as any)?.optionRawList) ? (context.tempData as any).optionRawList : [];
  if (!ids.length) return false;

  let idx = extractOptionIndexStrict(userMessage, ids.length);

  const matchAgainst = rawOptions.length === ids.length ? rawOptions : options;

  if (idx == null && matchAgainst.length === ids.length && matchAgainst.length > 0) {
    const match = bestFuzzyOptionIndex(userMessage, matchAgainst);
    if (match && match.score >= 0.62 && match.score - (match.secondScore ?? 0) >= 0.08) {
      idx = match.index + 1;
    }
  }

  if (idx == null) return false;

  context.tempData ||= {};
  context.tempData.passeioId = ids[idx - 1];
  context.tempData.passeioNome = (rawOptions.length === ids.length ? rawOptions[idx - 1] : undefined) || options[idx - 1];

  delete context.tempData.optionIds;
  delete (context.tempData as any).optionRawList;
  delete context.tempData.optionList;

  return true;
}

function buildPostSelectionResponse(context: ConversationContext): string {
  const passeio = context.tempData?.passeioNome || context.tempData?.passeio || 'o passeio';
  const nome = context.nome;
  const data = context.tempData?.data;
  const pessoas = context.tempData?.numPessoas;

  const missing: string[] = [];
  if (!nome) missing.push('seu nome');
  if (!data) missing.push('a data');
  if (pessoas == null) missing.push('quantas pessoas');

  if (missing.length === 0) {
    return `Perfeito! Vou criar a reserva de ${passeio}. Um momento.`;
  }

  if (missing.length === 3) {
    return `Escolheu ${passeio}. Preciso de: seu nome, data e quantas pessoas.`;
  }

  if (missing.length === 1) {
    return `Escolheu ${passeio}. Só falta: ${missing[0]}.`;
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

  if (t.includes('buggy')) return { kind: 'buggy' };

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

  return `Passeios disponíveis:\n${lines}\n\nResponda o número.`;
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
  if (t.includes('buggy')) termo = 'buggy';
  else if (t.includes('quadriciclo')) termo = 'quadriciclo';
  else if (t.includes('toboagua')) termo = 'toboagua';
  else if (t.includes('open bar') || t.includes('open food')) termo = 'open bar';
  else if (t.includes('transfer')) termo = 'transfer';
  else if (t.includes('city')) termo = 'city';
  else if (t.includes('barco')) termo = 'barco';
  else if (t.includes('mergulho')) termo = 'mergulho';
  else if (t.includes('jetski') || t.includes('jet ski')) termo = 'jetski';

  const shouldConsider = wantsList || !!termo;
  if (!shouldConsider) return { should: false };

  if (wantsAll) return { should: true, wantsAll: true };
  if (wantsList) return { should: true, termo };
  if (termo) return { should: true, termo };

  return { should: false };
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
  const justSelected = handleOptionSelection(context, userMessage);

  if (justSelected) {
    const directReply = buildPostSelectionResponse(context);
    context.conversationHistory.push({ role: 'assistant', content: directReply });
    return directReply;
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

  const maxSteps = 16;
  let hasToolResultThisRun = false;

  const prefetch = getPasseiosPrefetchPlan(userMessage, context);
  if (prefetch.should) {
    const toolParams = prefetch.termo ? { termo: prefetch.termo } : {};
    const toolResult = await executeTool('consultar_passeios', toolParams, { telefone, conversation: context });
    context.conversationHistory.push({
      role: 'system',
      content: `<tool_result name="consultar_passeios">${JSON.stringify(toolResult)}</tool_result>`
    });
    hasToolResultThisRun = true;

    const direct = buildPrefetchMenuResponse(userMessage, context, prefetch);
    if (direct) return direct;
  }

  for (let step = 0; step < maxSteps; step++) {
    const messages = buildMessages(context);
    const assistant = await groqChat({ messages, temperature: 0.18, max_tokens: 380 });

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
