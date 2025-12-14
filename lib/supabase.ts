import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

type ConversationContextStorageMode = 'unknown' | 'json' | 'columns';
let cachedConversationContextStorageMode: ConversationContextStorageMode = 'unknown';

function normalizeConversationHistory(raw: any): Array<{ role: string; content: string }> {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => ({
      role: typeof entry?.role === 'string' ? entry.role : 'user',
      content: typeof entry?.content === 'string' ? entry.content : ''
    }))
    .filter((entry) => entry.content);
}

function normalizeMetadata(raw: any): ConversationMetadata {
  const metadata: ConversationMetadata = raw && typeof raw === 'object' ? raw : {};
  if (!Array.isArray(metadata.memories)) {
    metadata.memories = [];
  }
  return metadata;
}

function normalizeTempData(raw: any): ConversationContext['tempData'] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return raw;
}

async function getConversationContextStorageMode(
  supabase: SupabaseClient
): Promise<Exclude<ConversationContextStorageMode, 'unknown'>> {
  if (cachedConversationContextStorageMode !== 'unknown') {
    return cachedConversationContextStorageMode;
  }

  const { error } = await supabase.from('conversation_contexts').select('context').limit(1);
  if (!error) {
    cachedConversationContextStorageMode = 'json';
    return cachedConversationContextStorageMode;
  }

  const msg = `${(error as any)?.message || ''}`.toLowerCase();
  if (msg.includes('context') && msg.includes('column')) {
    cachedConversationContextStorageMode = 'columns';
    return cachedConversationContextStorageMode;
  }

  cachedConversationContextStorageMode = 'columns';
  return cachedConversationContextStorageMode;
}

function mapRowToConversationContext(row: any, telefoneFallback: string): ConversationContext {
  const telefone = typeof row?.telefone === 'string' ? row.telefone : telefoneFallback;

  const stored = row?.context && typeof row.context === 'object' ? row.context : null;
  if (stored) {
    const metadata = normalizeMetadata(stored.metadata ?? row.metadata);
    return {
      telefone,
      nome: stored.nome ?? row.nome,
      conversationHistory: normalizeConversationHistory(stored.conversationHistory ?? stored.conversation_history),
      currentFlow: stored.currentFlow ?? stored.current_flow,
      flowStep: stored.flowStep ?? stored.flow_step,
      tempData: normalizeTempData(stored.tempData ?? stored.temp_data),
      lastIntent: stored.lastIntent ?? stored.last_intent,
      lastMessage: stored.lastMessage ?? stored.last_message,
      lastMessageTime: stored.lastMessageTime ?? stored.last_message_time,
      metadata
    };
  }

  const metadata = normalizeMetadata(row?.metadata);
  return {
    telefone,
    nome: row?.nome,
    conversationHistory: normalizeConversationHistory(row?.conversation_history),
    currentFlow: row?.current_flow,
    flowStep: row?.flow_step,
    tempData: normalizeTempData(row?.temp_data),
    lastIntent: row?.last_intent,
    lastMessage: row?.last_message,
    lastMessageTime: row?.last_message_time,
    metadata
  };
}

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
  asaasCustomerId?: string;
  [key: string]: any;
}

export interface ConversationContext {
  telefone: string;
  nome?: string;
  conversationHistory: Array<{ role: string; content: string }>;
  currentFlow?: 'reserva' | 'consulta' | 'cancelamento';
  flowStep?: string;
  tempData?: {
    passeio?: string;
    passeioId?: string;
    data?: string;
    numPessoas?: number;
    cpf?: string;
    email?: string;
    paymentMethod?: 'pix' | 'boleto';
    paymentId?: string;
    paymentInvoiceUrl?: string;
    paymentPixPayload?: string;
    paymentBankSlipUrl?: string;
    paymentDueDate?: string;
    optionList?: string[];
    optionIds?: string[];
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
      .select('id,nome,categoria,preco_min,preco_max,duracao,local')
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
  const fallback: ConversationContext = {
    telefone,
    conversationHistory: [],
    tempData: {},
    metadata: { memories: [] }
  };

  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('conversation_contexts')
      .select('*')
      .eq('telefone', telefone)
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return fallback;
    }

    return mapRowToConversationContext(data, telefone);
  } catch {
    return fallback;
  }
}

export async function saveConversationContext(context: ConversationContext): Promise<void> {
  try {
    const supabase = getSupabase();

    const metadata = normalizeMetadata(context.metadata);

    const safeContext: ConversationContext = {
      ...context,
      conversationHistory: normalizeConversationHistory(context.conversationHistory),
      tempData: normalizeTempData(context.tempData),
      lastMessageTime: context.lastMessageTime || new Date().toISOString(),
      metadata
    };

    const mode = await getConversationContextStorageMode(supabase);

    const { data: existing } = await supabase
      .from('conversation_contexts')
      .select('id')
      .eq('telefone', safeContext.telefone)
      .limit(1)
      .maybeSingle();

    if (mode === 'json') {
      const minimalPayload: any = {
        telefone: safeContext.telefone,
        context: safeContext
      };

      const extendedPayload: any = {
        ...minimalPayload,
        last_message: safeContext.lastMessage,
        last_intent: safeContext.lastIntent,
        last_updated: safeContext.lastMessageTime,
        metadata: safeContext.metadata
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('conversation_contexts')
          .update(extendedPayload)
          .eq('id', existing.id);

        if (error) {
          const msg = `${(error as any)?.message || ''}`.toLowerCase();
          if (msg.includes('column')) {
            await supabase
              .from('conversation_contexts')
              .update(minimalPayload)
              .eq('id', existing.id);
          }
        }
      } else {
        const { error } = await supabase
          .from('conversation_contexts')
          .insert(extendedPayload);

        if (error) {
          const msg = `${(error as any)?.message || ''}`.toLowerCase();
          if (msg.includes('column')) {
            await supabase
              .from('conversation_contexts')
              .insert(minimalPayload);
          }
        }
      }

      return;
    }

    const payload: any = {
      telefone: safeContext.telefone,
      nome: safeContext.nome,
      conversation_history: safeContext.conversationHistory,
      current_flow: safeContext.currentFlow,
      flow_step: safeContext.flowStep,
      temp_data: safeContext.tempData,
      last_intent: safeContext.lastIntent,
      last_message: safeContext.lastMessage,
      last_message_time: safeContext.lastMessageTime,
      metadata: safeContext.metadata
    };

    if (existing?.id) {
      await supabase
        .from('conversation_contexts')
        .update(payload)
        .eq('id', existing.id);
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
