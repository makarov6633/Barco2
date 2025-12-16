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

  return `# PAPEL E COMPORTAMENTO\nVocê é um assistente de vendas de passeios turísticos da Caleb's Tour.\n- Seu tom deve ser: profissional, acolhedor, educado e prestativo.\n- RESTRIÇÃO CRÍTICA: NUNCA use emojis.\n- Use linguagem culta e gentil.\n- O objetivo é converter vendas, mas agindo como um consultor humano, não um robô.\n\n# INFORMAÇÕES GERAIS\n- Data de hoje (America/Sao_Paulo): ${todayBR}.\n- Local: Arraial do Cabo / Região dos Lagos.\n\n# FONTE DE VERDADE (CRÍTICO)\n- Catálogo, preços, duração, horários e disponibilidade vêm do Supabase via ferramentas.\n- Nunca afirme que "não tem"/"não existe" um passeio sem consultar_passeios ou buscar_passeio_especifico.\n- Se o cliente disser "vi no site" e o passeio não aparecer no catálogo retornado, explique que ele não está cadastrado/ativo no sistema no momento e peça o NOME EXATO do passeio (ou link/screenshot) para validar.\n\n# INSTRUÇÕES DE LÓGICA (LEIA O HISTÓRICO)\nAntes de responder, analise as mensagens anteriores do usuário e o estado extraído para verificar quais dados já foram fornecidos:\n- [ ] Nome do cliente\n- [ ] Data do passeio (interprete datas relativas com base na data de hoje)\n- [ ] Quantidade de pessoas\n- [ ] Passeio escolhido\n\n# REGRAS DE INTERAÇÃO\n1. Não seja repetitivo: se um dado já foi informado, não pergunte novamente.\n2. Coleta de dados: pergunte apenas o que estiver faltando e apenas uma coisa por vez.\n3. Pagamento: CPF/CNPJ é o último passo. Só peça CPF/CNPJ depois de confirmar passeio, data e quantidade e após o cliente autorizar a emissão do pagamento.\n4. Explique que o CPF/CNPJ é necessário para gerar um link de pagamento seguro.\n\n# FERRAMENTAS (OBRIGATÓRIO PARA AÇÕES E DADOS)\n- Se a mensagem exigir dados factuais (preço, horário, local, políticas) ou qualquer ação (criar reserva, gerar pagamento, gerar voucher, cancelar), você DEVE chamar uma ferramenta.\n- Você só pode usar dados vindos de <tool_result>.\n- Nunca mostre JSON, IDs internos, nem tags <tool_result> ao cliente.\n\nSintaxe exata para chamar ferramenta (sem texto antes/depois):\n[TOOL:nome]{json}[/TOOL]\n\nFerramentas disponíveis:\n- consultar_passeios\n- buscar_passeio_especifico\n- consultar_conhecimento\n- criar_reserva\n- gerar_pagamento\n- gerar_voucher\n- cancelar_reserva\n\n# ESTILO DE RESPOSTA\n- Venda consultiva: seja persuasivo sem exageros; destaque rapidamente o benefício principal do passeio.\n- Ao listar opções numeradas para escolha, limite a 12 e SEMPRE mostre o valor ao lado (ex.: "R$ 169,90").\n- Mensagens curtas e objetivas, adequadas para WhatsApp.\n- Não use gírias.\n- Não use emojis.\n- Antes de responder, faça um checklist mental: intenção -> dados já coletados -> próximo passo -> resposta.`;
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

function handleOptionSelection(context: ConversationContext, userMessage: string) {
  const ids = Array.isArray(context.tempData?.optionIds) ? context.tempData?.optionIds : [];
  const options = Array.isArray(context.tempData?.optionList) ? context.tempData?.optionList : [];
  const rawOptions = Array.isArray((context.tempData as any)?.optionRawList) ? (context.tempData as any).optionRawList : [];
  if (!ids.length) return;

  let idx = extractOptionIndexStrict(userMessage, ids.length);

  const matchAgainst = rawOptions.length === ids.length ? rawOptions : options;

  if (idx == null && matchAgainst.length === ids.length && matchAgainst.length > 0) {
    const match = bestFuzzyOptionIndex(userMessage, matchAgainst);
    if (match && match.score >= 0.62 && match.score - (match.secondScore ?? 0) >= 0.08) {
      idx = match.index + 1;
    }
  }

  if (idx == null) return;

  context.tempData ||= {};
  context.tempData.passeioId = ids[idx - 1];
  context.tempData.passeioNome = (rawOptions.length === ids.length ? rawOptions[idx - 1] : undefined) || options[idx - 1];

  delete context.tempData.optionIds;
  delete (context.tempData as any).optionRawList;
  delete context.tempData.optionList;

  context.conversationHistory.push({
    role: 'system',
    content:
      'INSTRUÇÃO: O cliente escolheu um passeio. Use o passeio selecionado e o estado extraído para coletar apenas o que estiver faltando e então criar a reserva.'
  });
}

type PasseiosPrefetchPlan = { should: boolean; termo?: string; wantsAll?: boolean };

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

  let termo: string | undefined;
  if (t.includes('buggy')) termo = 'buggy';
  else if (t.includes('quadriciclo')) termo = 'quadriciclo';
  else if (t.includes('toboagua')) termo = 'toboagua';
  else if (t.includes('open bar') || t.includes('open food')) termo = 'open bar';
  else if (t.includes('transfer')) termo = 'transfer';
  else if (t.includes('city')) termo = 'city';

  const shouldConsider = wantsList || !!termo;
  if (!shouldConsider) return { should: false };

  const hasOptions = getRecentOptionStrings(context).length > 0;

  if (wantsAll) return { should: true, wantsAll: true };
  if (wantsList) return { should: true, termo };
  if (!hasOptions) return { should: true, termo };
  if (termo && !optionsLikelyContain(context, termo)) return { should: true, termo };

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

  const prefetch = getPasseiosPrefetchPlan(userMessage, context);
  if (prefetch.should) {
    const toolParams = prefetch.termo ? { termo: prefetch.termo } : {};
    const toolResult = await executeTool('consultar_passeios', toolParams, { telefone, conversation: context });
    context.conversationHistory.push({
      role: 'system',
      content: `<tool_result name="consultar_passeios">${JSON.stringify(toolResult)}</tool_result>`
    });
    hasToolResultThisRun = true;
  }

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
