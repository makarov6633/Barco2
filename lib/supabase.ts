import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

type ConversationContextStorageMode = 'unknown' | 'json' | 'columns';
let cachedConversationContextStorageMode: ConversationContextStorageMode = 'unknown';

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
  status: 'PENDENTE' | 'CONFIRMADO' | 'CANCELADO' | 'EXPIRADO';
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

export async function getOrCreateCliente(telefone: string, nome?: string): Promise<Cliente | null> {
  try {
    const supabase = getSupabase();

    const { data } = await supabase
      .from('clientes')
      .select('*')
      .eq('telefone', telefone)
      .single();

    if (data) {
      if (nome && nome !== (data as any).nome) {
        await supabase
          .from('clientes')
          .update({ nome })
          .eq('id', (data as any).id);
        return { ...(data as any), nome };
      }
      return data as any;
    }

    const { data: newCliente } = await supabase
      .from('clientes')
      .insert({ telefone, nome: nome || 'Cliente' })
      .select()
      .single();

    return newCliente as any;
  } catch (error) {
    console.error('Erro ao buscar/criar cliente:', error);
    return null;
  }
}

export async function getAllPasseios(): Promise<Passeio[]> {
  try {
    const supabase = getSupabase();

    const { data } = await supabase
      .from('passeios')
      .select('*')
      .order('nome');

    return (data as any) || [];
  } catch (error) {
    console.error('Erro ao buscar passeios:', error);
    return [];
  }
}

export async function createReserva(reserva: Omit<Reserva, 'id' | 'created_at'>): Promise<Reserva | null> {
  try {
    const supabase = getSupabase();

    const { data } = await supabase
      .from('reservas')
      .insert(reserva)
      .select()
      .single();

    return (data as any) || null;
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
          .eq('id', (existing as any).id);

        if (error) {
          const msg = `${(error as any)?.message || ''}`.toLowerCase();
          if (msg.includes('column')) {
            await supabase
              .from('conversation_contexts')
              .update(minimalPayload)
              .eq('id', (existing as any).id);
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
        .eq('id', (existing as any).id);
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
    return (data as any) || [];
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
    if (error) {
      console.error('Erro ao criar cobrança:', error);
      return null;
    }
    return (data as any) || null;
  } catch (error) {
    console.error('Erro ao criar cobrança:', error);
    return null;
  }
}

export async function updateCobrancaByAsaasId(asaasId: string, updates: Partial<Cobranca>): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('cobrancas').update(updates).eq('asaas_id', asaasId).select().single();
    if (error) return null;
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function getCobrancaByAsaasId(asaasId: string): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('cobrancas').select('*').eq('asaas_id', asaasId).single();
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function getPendingCobrancaByReservaId(reservaId: string, tipo: Cobranca['tipo']): Promise<Cobranca | null> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('cobrancas')
      .select('*')
      .eq('reserva_id', reservaId)
      .eq('tipo', tipo)
      .eq('status', 'PENDENTE')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (error) return null;
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function getReservaById(reservaId: string): Promise<Reserva | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('reservas').select('*').eq('id', reservaId).single();
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function updateReservaStatus(reservaId: string, status: string, voucher?: string): Promise<boolean> {
  try {
    const supabase = getSupabase();
    const updates: any = { status };
    if (voucher) updates.voucher = voucher;
    const { error } = await supabase.from('reservas').update(updates).eq('id', reservaId);
    return !error;
  } catch {
    return false;
  }
}

export async function getClienteById(clienteId: string): Promise<Cliente | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('clientes').select('*').eq('id', clienteId).single();
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function getPasseioById(passeioId: string): Promise<Passeio | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('passeios').select('*').eq('id', passeioId).single();
    return (data as any) || null;
  } catch {
    return null;
  }
}

export async function getReservaByVoucher(voucher: string): Promise<Reserva | null> {
  const v = String(voucher || '').trim();
  if (!v) return null;

  try {
    const supabase = getSupabase();
    const { data } = await supabase.from('reservas').select('*').eq('voucher', v).single();
    return (data as any) || null;
  } catch {
    return null;
  }
}
