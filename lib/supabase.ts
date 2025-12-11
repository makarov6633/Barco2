import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface Cliente {
  id: string;
  nome: string;
  telefone: string;
  email?: string;
  cpf?: string;
  created_at?: string;
}

export interface Passeio {
  id: string;
  nome: string;
  categoria?: string;
  descricao?: string;
  local?: string;
  duracao?: string;
  preco_min?: number;
  preco_max?: number;
  includes?: string;
  horarios?: string;
}

export interface Reserva {
  id?: string;
  cliente_id: string;
  passeio_id: string;
  data_passeio: string;
  num_pessoas: number;
  voucher: string;
  status: 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO';
  valor_total: number;
  observacoes?: string;
  created_at?: string;
}

export interface ConversationContext {
  telefone: string;
  nome?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentFlow?: 'reserva' | 'consulta' | 'cancelamento';
  flowStep?: string;
  tempData?: {
    passeio?: string;
    data?: string;
    numPessoas?: number;
    cpf?: string;
    email?: string;
  };
  lastIntent?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  metadata?: any;
}

export async function getOrCreateCliente(telefone: string, nome?: string): Promise<Cliente | null> {
  try {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (data) {
      if (nome && nome !== data.nome) {
        await supabase
          .from('clientes')
          .update({ nome })
          .eq('id', data.id);
        return { ...data, nome };
      }
      return data;
    }

    const { data: newCliente, error: createError } = await supabase
      .from('clientes')
      .insert({ telefone, nome: nome || 'Cliente' })
      .select()
      .single();

    return newCliente;
  } catch (error) {
    console.error('Erro ao buscar/criar cliente:', error);
    return null;
  }
}

export async function getAllPasseios(): Promise<Passeio[]> {
  try {
    const { data, error } = await supabase
      .from('passeios')
      .select('*')
      .order('nome');

    return data || [];
  } catch (error) {
    console.error('Erro ao buscar passeios:', error);
    return [];
  }
}

export async function createReserva(reserva: Omit<Reserva, 'id' | 'created_at'>): Promise<Reserva | null> {
  try {
    const { data, error } = await supabase
      .from('reservas')
      .insert(reserva)
      .select()
      .single();

    return data;
  } catch (error) {
    console.error('Erro ao criar reserva:', error);
    return null;
  }
}

export async function getConversationContext(telefone: string): Promise<ConversationContext> {
  try {
    const { data, error } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (data) {
      return {
        telefone: data.telefone,
        nome: data.nome,
        conversationHistory: data.conversation_history || [],
        currentFlow: data.current_flow,
        flowStep: data.flow_step,
        tempData: data.temp_data || {},
        lastIntent: data.last_intent,
        lastMessage: data.last_message,
        lastMessageTime: data.last_message_time,
        metadata: data.metadata || {}
      };
    }

    return {
      telefone,
      conversationHistory: [],
      tempData: {},
      metadata: {}
    };
  } catch (error) {
    return {
      telefone,
      conversationHistory: [],
      tempData: {},
      metadata: {}
    };
  }
}

export async function saveConversationContext(context: ConversationContext): Promise<void> {
  try {
    const { data: existing } = await supabase
      .from('conversation_contexts')
      .select('telefone')
      .eq('telefone', context.telefone)
      .single();

    const payload = {
      telefone: context.telefone,
      nome: context.nome,
      conversation_history: context.conversationHistory,
      current_flow: context.currentFlow,
      flow_step: context.flowStep,
      temp_data: context.tempData,
      last_intent: context.lastIntent,
      last_message: context.lastMessage,
      last_message_time: context.lastMessageTime || new Date().toISOString(),
      metadata: context.metadata
    };

    if (existing) {
      await supabase
        .from('conversation_contexts')
        .update(payload)
        .eq('telefone', context.telefone);
    } else {
      await supabase
        .from('conversation_contexts')
        .insert(payload);
    }
  } catch (error) {
    console.error('Erro ao salvar contexto:', error);
  }
}

export function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'CB';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
