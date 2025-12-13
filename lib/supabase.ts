import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env vars missing: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  }

  cachedSupabase ||= createClient(supabaseUrl, supabaseKey);
  return cachedSupabase;
}

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

export interface MemoryEntry {
  id: string;
  type: 'profile' | 'preference' | 'booking' | 'history';
  value: string;
  createdAt: string;
  tags?: string[];
}

export interface ConversationMetadata {
  memories?: MemoryEntry[];
  [key: string]: any;
}

export interface ConversationContext {
  telefone: string;
  nome?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentFlow?: 'reserva' | 'consulta' | 'cancelamento' | 'pagamento';
  flowStep?: string;
  tempData?: {
    passeio?: string;
    passeioId?: string;
    data?: string;
    numPessoas?: number;
    cpf?: string;
    email?: string;
    optionList?: string[];
    optionIds?: string[];
    reservaId?: string;
    valorTotal?: number;
    passeioNome?: string;
  };
  lastIntent?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  metadata?: ConversationMetadata;
}

export async function getOrCreateCliente(telefone: string, nome?: string): Promise<Cliente | null> {
  try {
    const supabase = getSupabase();

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
    const supabase = getSupabase();

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
    const supabase = getSupabase();

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
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (data) {
      const metadata: ConversationMetadata = data.metadata || {};
      if (!Array.isArray(metadata.memories)) {
        metadata.memories = [];
      }

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
        metadata
      };
    }

    return {
      telefone,
      conversationHistory: [],
      tempData: {},
      metadata: { memories: [] }
    };
  } catch (error) {
    return {
      telefone,
      conversationHistory: [],
      tempData: {},
      metadata: { memories: [] }
    };
  }
}

export async function saveConversationContext(context: ConversationContext): Promise<void> {
  try {
    const supabase = getSupabase();

    const { data: existing } = await supabase
      .from('conversation_contexts')
      .select('telefone')
      .eq('telefone', context.telefone)
      .single();

    const metadata: ConversationMetadata = context.metadata || {};
    if (!Array.isArray(metadata.memories)) {
      metadata.memories = [];
    }
    context.metadata = metadata;

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
      metadata
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

export interface KnowledgeChunk {
  id: string;
  slug: string;
  title: string;
  content: string;
  source?: string;
  tags?: string[];
  created_at?: string;
}

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Erro ao buscar knowledge_chunks:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Erro ao buscar knowledge_chunks:', error);
    return [];
  }
}

export interface Cobranca {
  id?: string;
  reserva_id: string;
  cliente_id: string;
  asaas_id?: string;
  tipo: 'PIX' | 'BOLETO';
  valor: number;
  status: 'PENDENTE' | 'CONFIRMADO' | 'EXPIRADO' | 'CANCELADO';
  pix_qrcode?: string;
  pix_copiacola?: string;
  boleto_url?: string;
  vencimento: string;
  pago_em?: string;
}

export async function createCobranca(cobranca: Omit<Cobranca, 'id'>): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('cobrancas').insert(cobranca).select().single();
    if (error) { console.error('Erro ao criar cobrança:', error); return null; }
    return data;
  } catch (error) { console.error('Erro ao criar cobrança:', error); return null; }
}

export async function updateCobrancaByAsaasId(asaasId: string, updates: Partial<Cobranca>): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('cobrancas').update(updates).eq('asaas_id', asaasId).select().single();
    if (error) return null;
    return data;
  } catch { return null; }
}

export async function getCobrancaByAsaasId(asaasId: string): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('cobrancas').select('*').eq('asaas_id', asaasId).single();
    return data;
  } catch { return null; }
}

export async function getReservaById(reservaId: string): Promise<Reserva | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('reservas').select('*').eq('id', reservaId).single();
    return data;
  } catch { return null; }
}

export async function updateReservaStatus(reservaId: string, status: string, voucher?: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const updates: any = { status };
    if (voucher) updates.voucher = voucher;
    const { error } = await supabase.from('reservas').update(updates).eq('id', reservaId);
    return !error;
  } catch { return false; }
}

export async function getClienteById(clienteId: string): Promise<Cliente | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
    return data;
  } catch { return null; }
}

export async function getPasseioById(passeioId: string): Promise<Passeio | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('passeios').select('*').eq('id', passeioId).single();
    return data;
  } catch { return null; }
}
