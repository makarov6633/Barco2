import { 
  getConversationContext, 
  saveConversationContext, 
  getOrCreateCliente,
  getAllPasseios,
  createReserva,
  generateVoucherCode,
  ConversationContext,
  MemoryEntry 
} from './supabase';
import { generateAIResponse, detectIntentWithAI, generateVoucherMessage, generatePriceMessage } from './groq-ai';
import { notifyBusiness, formatVoucher } from './twilio';
import {
  buildDefaultDueDate,
  createAsaasCustomer,
  createAsaasPayment,
  getAsaasPixQrCode,
  isAsaasEnabled
} from './asaas';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`📥 ${telefone}: ${message}`);

    const context = await getConversationContext(telefone);
    ensureMemoryContainer(context);
    
    // Análise com IA
    const analysis = await detectIntentWithAI(message, {
      mode: context.currentFlow === 'reserva' ? 'heuristic' : 'auto'
    });
    console.log(`🎯 Intent: ${analysis.intent} (${Math.round(analysis.confidence * 100)}%)`);

    // Atualizar contexto com entidades detectadas
    if (analysis.entities.nome && !context.nome) {
      context.nome = analysis.entities.nome;
    }
    if (analysis.entities.data && context.tempData) {
      context.tempData.data = analysis.entities.data;
    }
    if (analysis.entities.numPessoas && context.tempData) {
      context.tempData.numPessoas = analysis.entities.numPessoas;
    }
    if (analysis.entities.passeio && context.tempData) {
      context.tempData.passeio = analysis.entities.passeio;
    }

    // PRIORIDADE 1: Reclamações (alertar equipe)
    if (analysis.intent === 'reclamacao') {
      await notifyBusiness({
        type: 'RECLAMACAO',
        data: {
          telefone,
          nome: context.nome,
          mensagem: message
        }
      });
    }

    // PRIORIDADE 2: Fluxo de reserva ativo
    if (context.currentFlow === 'reserva') {
      const response = await handleReservaFlow(telefone, message, context, analysis);
      
      captureMemoriesFromInteraction(context, analysis, message);

      // Adicionar ao histórico
      context.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      );

      // Limitar histórico
      if (context.conversationHistory.length > 20) {
        context.conversationHistory = context.conversationHistory.slice(-20);
      }

      // Salvar contexto
      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);

      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    // PRIORIDADE 3: Iniciar fluxo de reserva
    if (analysis.intent === 'reserva' && analysis.confidence > 0.6) {
      context.currentFlow = 'reserva';
      context.flowStep = 'inicial';
      context.tempData = {
        passeio: analysis.entities.passeio,
        data: analysis.entities.data,
        numPessoas: analysis.entities.numPessoas
      };

      const response = await handleReservaFlow(telefone, message, context, analysis);
      
      captureMemoriesFromInteraction(context, analysis, message);

      context.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      );

      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);

      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    if (analysis.intent === 'preco' && analysis.confidence >= 0.55) {
      const response = await handlePrecoIntent(message, context);

      captureMemoriesFromInteraction(context, analysis, message);

      context.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: response }
      );

      if (context.conversationHistory.length > 20) {
        context.conversationHistory = context.conversationHistory.slice(-20);
      }

      context.lastMessage = message;
      context.lastIntent = analysis.intent;
      context.lastMessageTime = new Date().toISOString();
      await saveConversationContext(context);

      console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
      return response;
    }

    const memoryPrompts = buildMemoryPrompts(context);

    const response = await generateAIResponse(
      message,
      context.conversationHistory,
      context.nome,
      memoryPrompts
    );

    captureMemoriesFromInteraction(context, analysis, message);

    // Atualizar histórico
    context.conversationHistory.push(
      { role: 'user', content: message },
      { role: 'assistant', content: response }
    );

    if (context.conversationHistory.length > 20) {
      context.conversationHistory = context.conversationHistory.slice(-20);
    }

    // Salvar contexto
    context.lastMessage = message;
    context.lastIntent = analysis.intent;
    context.lastMessageTime = new Date().toISOString();
    await saveConversationContext(context);

    console.log(`✅ Respondido em ${Date.now() - startTime}ms`);
    return response;

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    return 'Ops, deu um probleminha aqui! 😅\nMe manda de novo ou liga: (22) 99824-9911';
  }
}

async function handleReservaFlow(
  telefone: string,
  message: string,
  context: ConversationContext,
  analysis: any
): Promise<string> {
  
  if (!context.tempData) {
    context.tempData = {};
  }

  // Verificar se tem todas as informações
  let hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  const hasData = !!context.tempData.data;
  let hasPessoas = !!context.tempData.numPessoas;
  let hasNome = !!context.nome;

  // Interpretar seleção numérica/textual quando acabamos de sugerir opções
  if (!hasPasseio && context.tempData.optionList?.length) {
    const normalizedMessage = normalizeString(message);
    const selectionIndex = detectOptionSelection(normalizedMessage);

    if (selectionIndex !== null && context.tempData.optionList[selectionIndex]) {
      context.tempData.passeio = context.tempData.optionList[selectionIndex];
      if (context.tempData.optionIds?.[selectionIndex]) {
        context.tempData.passeioId = context.tempData.optionIds[selectionIndex];
      }
      context.tempData.optionList = undefined;
      context.tempData.optionIds = undefined;
    } else {
      const matchedIndex = context.tempData.optionList.findIndex(option =>
        normalizedMessage.includes(normalizeString(option.split('-')[0]))
      );

      if (matchedIndex >= 0) {
        context.tempData.passeio = context.tempData.optionList[matchedIndex];
        if (context.tempData.optionIds?.[matchedIndex]) {
          context.tempData.passeioId = context.tempData.optionIds[matchedIndex];
        }
        context.tempData.optionList = undefined;
        context.tempData.optionIds = undefined;
      }
    }

    hasPasseio = !!(context.tempData.passeio || context.tempData.passeioId);
  }

  // Coletar informações faltantes
  if (!hasPasseio) {
    const passeios = await getAllPasseios();
    const top3 = passeios.slice(0, 3);

    context.tempData.optionList = top3.map((p) => p.nome);
    context.tempData.optionIds = top3.map((p) => p.id);

    const opcoes = top3.map((p, i) => {
      const nome = p.nome.split('-')[0].trim();
      const faixa = p.preco_min && p.preco_max ? `R$ ${p.preco_min}-${p.preco_max}` : 'Consulte';
      return `${i + 1}. ${nome} (${faixa})`;
    }).join('\n');

    return `Legal! Vamos fazer sua reserva 😊\n\nQual passeio te interessa?\n\n${opcoes}\n\nPode responder com o número (1, 2 ou 3) ou digitar o nome.\nSe preferir outro, é só me contar!`;
  }

  if (!hasData) {
    return `Show! ${context.nome ? context.nome.split(' ')[0] + ', ' : ''}pra qual dia você quer ir?\n\nPode ser: "amanhã", "sábado", "15/02"...`;
  }

  if (!hasPessoas && hasPasseio && hasData) {
    const extracted = extractPeopleCountCandidate(message);
    if (typeof extracted === 'number') {
      context.tempData.numPessoas = extracted;
      hasPessoas = true;
    }
  }

  if (!hasPessoas) {
    return `Beleza! Quantas pessoas vão no passeio?`;
  }

  if (!hasNome && hasPasseio && hasData && hasPessoas) {
    const candidate = extractFullNameCandidate(message);
    if (candidate) {
      context.nome = candidate;
      hasNome = true;
    }
  }

  if (!hasNome) {
    return `Perfeito! Só preciso do seu nome completo pra gerar o voucher 😊`;
  }

  if (isAsaasEnabled()) {
    const normalizedMessage = normalizeString(message);

    if (!context.tempData.paymentMethod) {
      const method = detectPaymentMethod(normalizedMessage);
      if (method) {
        context.tempData.paymentMethod = method;
      } else {
        return `Fechou! 😊
Pra eu te mandar o Pix/boleto certinho, você prefere:

1) Pix
2) Boleto

Responde 1 ou 2.`;
      }
    }

    if (!context.tempData.cpf) {
      const cpf = extractCpfCandidate(message);
      if (cpf) {
        context.tempData.cpf = cpf;
      }
    }

    if (!context.tempData.cpf) {
      return `Fechou 😊\nPra eu gerar o Pix/boleto no sistema, preciso do seu CPF (só números).`;
    }

    if (context.tempData.paymentMethod === 'boleto') {
      if (!context.tempData.email) {
        const email = extractEmailCandidate(message);
        if (email) {
          context.tempData.email = email;
        }
      }

      if (!context.tempData.email) {
        return `Boa 😊\nAgora me passa seu e-mail pra eu gerar o boleto.`;
      }
    }
  }

  // TEM TUDO - Criar reserva
  return await criarReservaFinal(telefone, context);
}

async function handlePrecoIntent(message: string, context: ConversationContext): Promise<string> {
  try {
    const passeios = await getAllPasseios();
    if (!passeios.length) {
      return 'Tô sem acesso à tabela de preços agora 😔\nMe diz qual passeio você quer e a data que eu confirmo rapidinho.';
    }

    const normalizedMessage = normalizeString(message);
    const msgTokens = new Set(normalizedMessage.split(' ').filter(token => token.length >= 3));

    let best: { passeio: any; score: number } | null = null;

    for (const passeio of passeios) {
      const nome = normalizeString(passeio.nome);
      const categoria = normalizeString(passeio.categoria || '');

      let score = 0;
      if (nome && normalizedMessage.includes(nome)) {
        score += 8;
      }

      if (nome.includes('passeio de quadriciclo')) {
        score += 6;
      }

      if (nome.includes('combo') && !normalizedMessage.includes('combo')) {
        score -= 4;
      }

      if (normalizedMessage.includes('quadriciclo') && !normalizedMessage.includes('barco') && nome.includes('barco')) {
        score -= 2;
      }

      const nameTokens = nome.split(' ').filter(token => token.length >= 3);
      for (const token of nameTokens) {
        if (msgTokens.has(token)) score += 2;
      }

      const catTokens = categoria.split(' ').filter(token => token.length >= 3);
      for (const token of catTokens) {
        if (msgTokens.has(token)) score += 1;
      }

      if (score > 0 && (!best || score > best.score)) {
        best = { passeio, score };
      }
    }

    if (!best) {
      const top = passeios.slice(0, 5).map((p: any, i: number) => {
        const faixa = typeof p.preco_min === 'number' && typeof p.preco_max === 'number'
          ? `R$ ${p.preco_min}-${p.preco_max}`
          : typeof p.preco_min === 'number'
            ? `R$ ${p.preco_min}`
            : typeof p.preco_max === 'number'
              ? `R$ ${p.preco_max}`
              : 'Consulte';
        return `${i + 1}. ${p.nome.split('-')[0].trim()} (${faixa})`;
      }).join('\n');

      return `Consigo sim 😊\nQual passeio você quer?\n\n${top}\n\nPode responder com o número ou o nome.`;
    }

    const passeio = best.passeio;

    try {
      const reply = await generatePriceMessage({
        passeioNome: passeio.nome,
        precoMin: passeio.preco_min ?? undefined,
        precoMax: passeio.preco_max ?? undefined,
        duracao: passeio.duracao,
        local: passeio.local,
        userName: context.nome
      });
      if (reply) return reply;
    } catch {
    }

    const min = typeof passeio.preco_min === 'number' ? passeio.preco_min : undefined;
    const max = typeof passeio.preco_max === 'number' ? passeio.preco_max : undefined;

    if (typeof min === 'number' && typeof max === 'number' && min !== max) {
      return `O ${passeio.nome.split('-')[0].trim()} fica entre R$ ${min} e R$ ${max} 😊\nQual data você quer e quantas pessoas vão?`;
    }

    const value = typeof min === 'number' ? min : max;
    if (typeof value === 'number') {
      return `O ${passeio.nome.split('-')[0].trim()} sai por R$ ${value} 😊\nQual data você quer e quantas pessoas vão?`;
    }

    return `Consigo ver sim 😊\nMe diz a data e quantas pessoas vão, que eu confirmo o valor certinho desse passeio.`;
  } catch {
    return 'Tô com uma instabilidade aqui 😅\nMe manda de novo: qual passeio e qual data você quer?';
  }
}

async function criarReservaFinal(telefone: string, context: ConversationContext): Promise<string> {
  try {
    const passeios = await getAllPasseios();

    let passeioSelecionado = context.tempData?.passeioId
      ? passeios.find(p => p.id === context.tempData!.passeioId)
      : undefined;

    if (!passeioSelecionado && context.tempData?.passeio) {
      passeioSelecionado = matchPasseioForBooking(passeios, context.tempData.passeio);
    }

    if (!passeioSelecionado) {
      context.currentFlow = undefined;
      context.tempData = {};
      return 'Hmm, não encontrei esse passeio 🤔\nQuer ver a lista completa? Me diz "ver passeios"';
    }

    const cliente = await getOrCreateCliente(telefone, context.nome);
    if (!cliente) {
      return 'Ops, erro ao criar seu cadastro 😔\nTenta de novo ou liga: (22) 99824-9911';
    }

    const voucherCode = generateVoucherCode();

    const numPessoas = context.tempData!.numPessoas!;
    const dataPasseioRaw = context.tempData!.data!;
    const dataPasseioISO = normalizeDateToISO(dataPasseioRaw);

    if (!dataPasseioISO) {
      context.currentFlow = 'reserva';
      context.flowStep = 'data';
      return `Perfeito 😊\nSó me manda a data nesse formato aqui: 15/02 ou 15/02/2026.`;
    }

    const dataPasseioDisplay = formatISODateToBR(dataPasseioISO);

    const precoMin = passeioSelecionado.preco_min;
    const precoMax = passeioSelecionado.preco_max;

    const valorBase = typeof precoMin === 'number'
      ? precoMin
      : typeof precoMax === 'number'
        ? precoMax
        : undefined;

    if (typeof valorBase !== 'number') {
      context.currentFlow = 'reserva';
      context.flowStep = 'confirmar_valor';
      return `Consigo reservar sim 😊
Só preciso confirmar o valor certinho desse passeio aqui, rapidinho.

Pra qual *horário* você prefere?`;
    }

    const valorTotal = computeValorTotal(passeioSelecionado, valorBase, numPessoas);
    if (typeof valorTotal !== 'number') {
      context.currentFlow = 'reserva';
      context.flowStep = 'confirmar_valor';
      return `Boa! 😊\nEsse passeio tem um valor que depende do formato (ex: pacote/por veículo).\n\nMe confirma: vai ser pra ${numPessoas} pessoa(s) mesmo?`;
    }

    let pagamento: {
      metodo: 'pix' | 'boleto';
      invoiceUrl?: string;
      pixCopiaECola?: string;
      boletoUrl?: string;
      vencimento?: string;
    } | undefined;

    let observacoes = 'Reserva via WhatsApp';

    if (isAsaasEnabled() && context.tempData?.paymentMethod) {
      try {
        ensureMemoryContainer(context);

        if (!context.metadata?.asaasCustomerId) {
          const customer = await createAsaasCustomer({
            name: context.nome || 'Cliente',
            cpfCnpj: context.tempData.cpf,
            email: context.tempData.email,
            mobilePhone: telefone
          });
          context.metadata!.asaasCustomerId = customer.id;
        }

        const billingType = context.tempData.paymentMethod === 'pix' ? 'PIX' : 'BOLETO';
        const dueDate = context.tempData.paymentDueDate || buildDefaultDueDate(1);

        const payment = await createAsaasPayment({
          customer: context.metadata!.asaasCustomerId!,
          billingType,
          value: valorTotal,
          dueDate,
          description: `${passeioSelecionado.nome} - ${dataPasseioDisplay} - ${numPessoas} pessoa(s)`,
          externalReference: voucherCode
        });

        const invoiceUrl = payment.invoiceUrl;
        const boletoUrl = payment.bankSlipUrl;

        if (billingType === 'PIX') {
          await getAsaasPixQrCode(payment.id);
        }

        pagamento = {
          metodo: context.tempData.paymentMethod,
          invoiceUrl,
          boletoUrl,
          vencimento: dueDate
        };

        observacoes = `${observacoes} | asaas:${payment.id}`;
      } catch {
        pagamento = undefined;
      }
    }

    const reserva = await createReserva({
      cliente_id: cliente.id,
      passeio_id: passeioSelecionado.id,
      data_passeio: dataPasseioISO,
      num_pessoas: numPessoas,
      voucher: voucherCode,
      status: 'PENDENTE',
      valor_total: valorTotal,
      observacoes
    });

    if (!reserva) {
      return 'Erro ao criar reserva 😔\nLiga pra gente: (22) 99824-9911';
    }

    // Notificar empresa
    await notifyBusiness({
      type: 'NOVA_RESERVA',
      data: {
        nome: context.nome,
        telefone,
        passeio: passeioSelecionado.nome,
        data: dataPasseioDisplay,
        numPessoas,
        voucher: voucherCode,
        valor: valorTotal,
        status: 'PENDENTE'
      }
    });

    rememberMemory(context, {
      type: 'booking',
      value: `Reserva ${passeioSelecionado.nome} em ${dataPasseioDisplay} para ${numPessoas} pessoa(s). Voucher ${voucherCode}.`,
      tags: ['reserva', passeioSelecionado.id]
    });

    // Resetar fluxo
    context.currentFlow = undefined;
    context.flowStep = undefined;
    context.tempData = {};

    const voucherInput = {
      voucherCode,
      clienteNome: context.nome!,
      passeioNome: passeioSelecionado.nome,
      dataPasseio: dataPasseioDisplay || 'a confirmar',
      horario: '09:00',
      numPessoas: numPessoas || 1,
      valorTotal,
      pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo',
      pagamento
    };

    let voucherAi = await generateVoucherMessage(voucherInput);
    if (!looksLikeVoucherOk(voucherAi, voucherCode, passeioSelecionado.nome, valorTotal, !!pagamento)) {
      try {
        voucherAi = await generateVoucherMessage(voucherInput);
      } catch {
      }
    }

    if (voucherAi && looksLikeVoucherOk(voucherAi, voucherCode, passeioSelecionado.nome, valorTotal, !!pagamento)) {
      return voucherAi;
    }

    const voucherMessage = formatVoucher({
      voucherCode,
      clienteNome: context.nome!,
      passeioNome: passeioSelecionado.nome,
      data: dataPasseioDisplay || 'A confirmar',
      horario: '09:00',
      numPessoas: numPessoas || 1,
      valorTotal,
      pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo'
    });

    if (!pagamento) {
      return voucherMessage;
    }

    const extra = pagamento.metodo === 'pix'
      ? `\n\n💳 *Pix*\n${pagamento.invoiceUrl ? `Link: ${pagamento.invoiceUrl}\n` : ''}${pagamento.pixCopiaECola ? `Copia e cola: ${pagamento.pixCopiaECola}` : ''}`
      : `\n\n💳 *Boleto*\n${pagamento.boletoUrl ? `Link: ${pagamento.boletoUrl}` : pagamento.invoiceUrl ? `Link: ${pagamento.invoiceUrl}` : ''}`;

    return `${voucherMessage}${extra}`;

  } catch (error) {
    console.error('❌ Erro ao criar reserva final:', error);
    context.currentFlow = undefined;
    context.tempData = {};
    return 'Ops, deu erro ao finalizar 😔\nLiga pra gente: (22) 99824-9911';
  }
}

function normalizeString(value?: string): string {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatISODateToBR(iso: string): string {
  const parts = iso.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function normalizeDateToISO(input?: string): string | undefined {
  const raw = input?.trim();
  if (!raw) return undefined;

  const normalized = normalizeString(raw);
  const now = new Date();

  if (normalized.includes('depois de amanha')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  }

  if (normalized.includes('amanha')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }

  if (normalized.includes('hoje')) {
    return now.toISOString().slice(0, 10);
  }

  const match = raw.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      const yearRaw = match[3];
      const year = yearRaw
        ? yearRaw.length === 2
          ? 2000 + parseInt(yearRaw, 10)
          : parseInt(yearRaw, 10)
        : now.getFullYear();

      const candidate = new Date(year, month - 1, day);
      if (!yearRaw && candidate < new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }

      return candidate.toISOString().slice(0, 10);
    }
  }

  const weekdays: Record<string, number> = {
    'domingo': 0,
    'segunda': 1,
    'terca': 2,
    'quarta': 3,
    'quinta': 4,
    'sexta': 5,
    'sabado': 6
  };

  const weekdayKey = Object.keys(weekdays).find((key) => normalized.includes(key));
  if (weekdayKey) {
    const target = weekdays[weekdayKey];
    const d = new Date(now);
    const current = d.getDay();
    const diff = (target - current + 7) % 7;
    d.setDate(d.getDate() + (diff === 0 ? 7 : diff));
    return d.toISOString().slice(0, 10);
  }

  return undefined;
}

function matchPasseioForBooking(passeios: Array<{ nome: string; categoria?: string }>, query: string) {
  const q = normalizeString(query);
  if (!q) return undefined;

  const wantsCombo = q.includes('combo');
  const wantsQuadri = q === 'quadri' || q.includes('quadri') || q.includes('quadriciclo');
  const wantsBuggy = q === 'buggy' || q.includes('buggy');
  const wantsBarco = q === 'barco' || q.includes('barco') || q.includes('escuna') || q.includes('catamara');
  const wantsMergulho = q === 'mergulho' || q.includes('mergulho');
  const wantsJet = q === 'jet' || q.includes('jet');

  let best: { passeio: any; score: number } | null = null;

  for (const passeio of passeios) {
    const name = normalizeString(passeio.nome);
    const cat = normalizeString(passeio.categoria || '');

    let score = 0;

    if (q.length >= 4 && name.includes(q)) score += 6;
    if (q.length >= 4 && cat.includes(q)) score += 3;

    if (name.includes('combo') && !wantsCombo) score -= 4;

    if (wantsQuadri) {
      if (name.includes('quadriciclo')) score += 10;
      if (name.includes('combo') && !wantsCombo) score -= 6;
    }

    if (wantsBuggy && name.includes('buggy')) score += 8;
    if (wantsBarco && name.includes('barco')) score += 6;
    if (wantsMergulho && name.includes('mergulho')) score += 8;
    if (wantsJet && name.includes('jet')) score += 8;

    if (score > 0 && (!best || score > best.score)) {
      best = { passeio, score };
    }
  }

  return best?.passeio;
}

function computeValorTotal(
  passeio: { nome: string; categoria?: string },
  basePrice: number,
  numPessoas: number
): number | undefined {
  if (!Number.isFinite(basePrice) || basePrice <= 0) return undefined;
  if (!Number.isFinite(numPessoas) || numPessoas <= 0) return undefined;

  const name = normalizeString(passeio.nome);
  const categoria = normalizeString(passeio.categoria || '');

  const isComboFor2 = /para\s*0?2\s*pessoas/.test(name);
  if (isComboFor2) {
    return numPessoas === 2 ? basePrice : undefined;
  }

  if (name.includes('quadriciclo')) {
    const maquinas = Math.ceil(numPessoas / 2);
    return basePrice * maquinas;
  }

  if (name.includes('exclusivo') || categoria.includes('servicos') || name.includes('transfer')) {
    return basePrice;
  }

  return basePrice * numPessoas;
}

function looksLikeVoucherOk(
  text: string,
  voucherCode: string,
  passeioNome: string,
  valorTotal?: number,
  expectPaymentLink?: boolean
) {
  if (!text || text.length < 40) return false;

  const trimmed = text.trim();
  if (!trimmed.includes('?')) {
    return false;
  }

  if (/[a-z0-9]$/i.test(trimmed)) {
    return false;
  }

  if (!voucherCode || !trimmed.includes(voucherCode)) return false;

  const normalized = normalizeString(trimmed);
  const passeioTokens = normalizeString(passeioNome).split(' ').filter(token => token.length >= 4);
  const passeioHitCount = passeioTokens.reduce((acc, token) => acc + (normalized.includes(token) ? 1 : 0), 0);
  if (passeioHitCount < 1) return false;

  if (typeof valorTotal === 'number' && Number.isFinite(valorTotal)) {
    const hasCurrency = /r\$\s*\d/.test(trimmed.toLowerCase());
    if (!hasCurrency) return false;
  }

  if (expectPaymentLink) {
    const hasUrl = /https?:\/\/\S{8,}/i.test(trimmed);
    if (!hasUrl) return false;
  }

  return true;
}

function extractFullNameCandidate(message: string): string | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length < 4 || trimmed.length > 80) return undefined;
  if (/\d/.test(trimmed)) return undefined;
  if (trimmed.includes('@')) return undefined;

  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return undefined;

  const normalized = normalizeString(trimmed);
  const blocked = [
    'amanha',
    'hoje',
    'depois de amanha',
    'segunda',
    'terca',
    'quarta',
    'quinta',
    'sexta',
    'sabado',
    'domingo',
    'pessoa',
    'pessoas',
    'barco',
    'quadriciclo',
    'buggy',
    'mergulho',
    'jet',
    'pix',
    'boleto',
    'cartao',
    'valor',
    'preco',
    'tabela',
    'reserva',
    'sim',
    'nao',
    'ok'
  ];

  if (blocked.some((word) => normalized.includes(word))) {
    return undefined;
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function detectPaymentMethod(message: string): 'pix' | 'boleto' | null {
  if (!message) return null;

  const numericMatch = message.match(/\b([1-2])\b/);
  if (numericMatch) {
    return numericMatch[1] === '1' ? 'pix' : 'boleto';
  }

  if (message.includes('pix')) return 'pix';
  if (message.includes('boleto')) return 'boleto';
  if (message.includes('codigo pix') || message.includes('copia e cola')) return 'pix';

  return null;
}

function extractCpfCandidate(message: string): string | undefined {
  const digits = message?.replace(/\D/g, '');
  if (!digits) return undefined;
  if (digits.length === 11 || digits.length === 14) return digits;
  return undefined;
}

function extractEmailCandidate(message: string): string | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : undefined;
}

function extractPeopleCountCandidate(message: string): number | undefined {
  const trimmed = message?.trim();
  if (!trimmed) return undefined;

  const numericOnly = trimmed.match(/^\d{1,3}$/);
  if (numericOnly) {
    const value = parseInt(numericOnly[0], 10);
    if (value >= 1 && value <= 100) {
      return value;
    }
  }

  const explicit = trimmed.match(/\b(\d{1,3})\b\s*(pessoas|pessoa|adultos?|criancas?|crianças?)/i);
  if (explicit) {
    const value = parseInt(explicit[1], 10);
    if (value >= 1 && value <= 100) {
      return value;
    }
  }

  return undefined;
}

const OPTION_KEYWORDS: Record<string, number> = {
  'primeiro': 0,
  'primeira': 0,
  'opcao 1': 0,
  'opção 1': 0,
  'numero 1': 0,
  'número 1': 0,
  'um': 0,
  'uma': 0,
  'segundo': 1,
  'segunda': 1,
  'opcao 2': 1,
  'opção 2': 1,
  'numero 2': 1,
  'número 2': 1,
  'dois': 1,
  'duas': 1,
  'terceiro': 2,
  'terceira': 2,
  'opcao 3': 2,
  'opção 3': 2,
  'numero 3': 2,
  'número 3': 2,
  'tres': 2,
  'três': 2
};

function detectOptionSelection(message: string): number | null {
  if (!message) return null;

  const numericMatch = message.match(/\b([1-9])\b/);
  if (numericMatch) {
    const idx = parseInt(numericMatch[1], 10) - 1;
    if (idx >= 0) {
      return idx;
    }
  }

  for (const [keyword, index] of Object.entries(OPTION_KEYWORDS)) {
    if (message.includes(keyword)) {
      return index;
    }
  }

  return null;
}

function ensureMemoryContainer(context: ConversationContext) {
  if (!context.metadata) {
    context.metadata = { memories: [] };
  }
  if (!Array.isArray(context.metadata.memories)) {
    context.metadata.memories = [];
  }
}

function rememberMemory(
  context: ConversationContext,
  entry: { type: MemoryEntry['type']; value: string; tags?: string[] }
) {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;

  const existingWithSameTag = entry.tags?.[0]
    ? memories.findIndex(memory => memory.type === entry.type && memory.tags?.includes(entry.tags![0]))
    : -1;
  if (existingWithSameTag >= 0) {
    memories.splice(existingWithSameTag, 1);
  }

  const duplicate = memories.find(memory =>
    memory.type === entry.type && memory.value.toLowerCase() === entry.value.toLowerCase()
  );
  if (duplicate) {
    return;
  }

  const newEntry: MemoryEntry = {
    id: `${entry.type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type: entry.type,
    value: entry.value,
    createdAt: new Date().toISOString(),
    tags: entry.tags
  };

  memories.push(newEntry);
  if (memories.length > 40) {
    context.metadata!.memories = memories.slice(-40);
  }
}

function buildMemoryPrompts(context: ConversationContext): string[] {
  ensureMemoryContainer(context);
  const memories = context.metadata!.memories!;
  if (!memories.length) {
    return [];
  }
  return memories.slice(-3).map(memory => memory.value);
}

function captureMemoriesFromInteraction(context: ConversationContext, analysis: any, message: string) {
  ensureMemoryContainer(context);
  const normalized = normalizeString(message);

  if (context.nome) {
    const preferredName = context.nome.split(' ')[0];
    rememberMemory(context, {
      type: 'profile',
      value: `Prefere ser chamado de ${preferredName}`,
      tags: ['nome']
    });
  }

  const passeioEntity = analysis?.entities?.passeio;
  if (passeioEntity) {
    const preferenceKeywords = ['prefir', 'gost', 'amo', 'ador', 'sempre', 'sonho', 'quero muito'];
    if (preferenceKeywords.some(keyword => normalized.includes(keyword))) {
      rememberMemory(context, {
        type: 'preference',
        value: `Curte o passeio ${passeioEntity}`,
        tags: ['passeio', passeioEntity]
      });
    }
  }

  if (normalized.includes('lua de mel')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Está planejando lua de mel',
      tags: ['lua-de-mel']
    });
  }

  if (normalized.includes('aniversar')) {
    rememberMemory(context, {
      type: 'history',
      value: 'Busca um passeio para aniversário',
      tags: ['aniversario']
    });
  }

  if (normalized.includes('famil') || normalized.includes('esposa') || normalized.includes('esposo')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Normalmente viaja em família/casal',
      tags: ['familia']
    });
  }

  if (normalized.includes('crianca') || normalized.includes('criancas') || normalized.includes('filh')) {
    rememberMemory(context, {
      type: 'profile',
      value: 'Viaja com crianças',
      tags: ['criancas']
    });
  }

  const groupSize = analysis?.entities?.numPessoas;
  if (groupSize && (normalized.includes('somos') || normalized.includes('vamos') || normalized.includes('seremos'))) {
    rememberMemory(context, {
      type: 'profile',
      value: `Costuma viajar em grupo de ${groupSize} pessoa(s)`,
      tags: ['grupo']
    });
  }
}
