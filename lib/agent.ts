import { 
  getConversationContext, 
  saveConversationContext, 
  getOrCreateCliente,
  getAllPasseios,
  createReserva,
  generateVoucherCode,
  ConversationContext 
} from './supabase';
import { generateAIResponse, detectIntentWithAI } from './groq-ai';
import { notifyBusiness, formatVoucher } from './twilio';

export async function processMessage(telefone: string, message: string): Promise<string> {
  const startTime = Date.now();
  
  try {
    console.log(`📥 ${telefone}: ${message}`);

    const context = await getConversationContext(telefone);
    
    // Análise com IA
    const analysis = await detectIntentWithAI(message);
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

    // PRIORIDADE 4: Conversa normal com IA
    const response = await generateAIResponse(
      message, 
      context.conversationHistory,
      context.nome
    );

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
  const hasPasseio = !!context.tempData.passeio;
  const hasData = !!context.tempData.data;
  const hasPessoas = !!context.tempData.numPessoas;
  const hasNome = !!context.nome;

  // Coletar informações faltantes
  if (!hasPasseio) {
    const passeios = await getAllPasseios();
    const top3 = passeios.slice(0, 3);
    return `Legal! Vamos fazer sua reserva 😊\n\nQual passeio te interessa?\n\n${top3.map((p, i) => `${i+1}. ${p.nome.split('-')[0].trim()} (R$ ${p.preco_min}-${p.preco_max})`).join('\n')}\n\nOu me diz qual você quer!`;
  }

  if (!hasData) {
    return `Show! ${context.nome ? context.nome.split(' ')[0] + ', ' : ''}pra qual dia você quer ir?\n\nPode ser: "amanhã", "sábado", "15/02"...`;
  }

  if (!hasPessoas) {
    return `Beleza! Quantas pessoas vão no passeio?`;
  }

  if (!hasNome) {
    return `Perfeito! Só preciso do seu nome completo pra gerar o voucher 😊`;
  }

  // TEM TUDO - Criar reserva
  return await criarReservaFinal(telefone, context);
}

async function criarReservaFinal(telefone: string, context: ConversationContext): Promise<string> {
  try {
    const passeios = await getAllPasseios();
    const passeioSelecionado = passeios.find(p => 
      p.nome.toLowerCase().includes(context.tempData!.passeio!) ||
      p.categoria?.toLowerCase().includes(context.tempData!.passeio!)
    );

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
    const valorPorPessoa = passeioSelecionado.preco_min && passeioSelecionado.preco_max
      ? (passeioSelecionado.preco_min + passeioSelecionado.preco_max) / 2
      : 200;
    const numPessoas = context.tempData!.numPessoas!;
    const dataPasseio = context.tempData!.data!;
    const valorTotal = valorPorPessoa * numPessoas;

    const reserva = await createReserva({
      cliente_id: cliente.id,
      passeio_id: passeioSelecionado.id,
      data_passeio: dataPasseio,
      num_pessoas: numPessoas,
      voucher: voucherCode,
      status: 'PENDENTE',
      valor_total: valorTotal,
      observacoes: 'Reserva via WhatsApp'
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
        data: dataPasseio,
        numPessoas,
        voucher: voucherCode,
        valor: valorTotal,
        status: 'PENDENTE'
      }
    });

    // Resetar fluxo
    context.currentFlow = undefined;
    context.flowStep = undefined;
    context.tempData = {};

    // Gerar voucher formatado
    const voucherMessage = formatVoucher({
      voucherCode,
      clienteNome: context.nome!,
      passeioNome: passeioSelecionado.nome,
      data: dataPasseio || 'A confirmar',
      horario: '09:00',
      numPessoas: numPessoas || 1,
      valorTotal,
      pontoEncontro: 'Cais da Praia dos Anjos - Arraial do Cabo'
    });

    return voucherMessage;

  } catch (error) {
    console.error('❌ Erro ao criar reserva final:', error);
    context.currentFlow = undefined;
    context.tempData = {};
    return 'Ops, deu erro ao finalizar 😔\nLiga pra gente: (22) 99824-9911';
  }
}
