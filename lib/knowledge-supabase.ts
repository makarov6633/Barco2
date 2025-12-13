import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedSupabase: SupabaseClient | null = null;

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase env vars missing');
  }

  cachedSupabase ||= createClient(supabaseUrl, supabaseKey);
  return cachedSupabase;
}

export interface KnowledgeChunk {
  id: string;
  slug: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  created_at?: string;
}

let knowledgeCache: KnowledgeChunk[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000;

export async function getAllKnowledgeChunks(): Promise<KnowledgeChunk[]> {
  const now = Date.now();
  if (knowledgeCache && (now - cacheTimestamp) < CACHE_TTL) {
    return knowledgeCache;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('knowledge_chunks')
      .select('*')
      .order('title');

    if (error) {
      console.error('Erro ao buscar knowledge_chunks:', error);
      return knowledgeCache || [];
    }

    knowledgeCache = data || [];
    cacheTimestamp = now;
    return knowledgeCache;
  } catch (error) {
    console.error('Erro ao buscar knowledge_chunks:', error);
    return knowledgeCache || [];
  }
}

export async function searchKnowledge(query: string): Promise<KnowledgeChunk[]> {
  const chunks = await getAllKnowledgeChunks();
  const queryLower = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2);

  const scored = chunks.map(chunk => {
    const titleLower = (chunk.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const contentLower = (chunk.content || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slugLower = (chunk.slug || '').toLowerCase();
    const categoryLower = (chunk.category || '').toLowerCase();

    let score = 0;

    for (const term of queryTerms) {
      if (titleLower.includes(term)) score += 10;
      if (slugLower.includes(term)) score += 8;
      if (categoryLower.includes(term)) score += 6;
      if (contentLower.includes(term)) score += 3;
    }

    if (queryLower.includes('preco') || queryLower.includes('valor') || queryLower.includes('quanto')) {
      if (contentLower.includes('r$') || contentLower.includes('preco') || contentLower.includes('valor')) {
        score += 15;
      }
    }

    if (queryLower.includes('barco') && (slugLower.includes('barco') || titleLower.includes('barco'))) {
      score += 20;
    }
    if (queryLower.includes('quadri') && (slugLower.includes('quadri') || titleLower.includes('quadri'))) {
      score += 20;
    }
    if (queryLower.includes('mergulho') && (slugLower.includes('mergulho') || titleLower.includes('mergulho'))) {
      score += 20;
    }
    if (queryLower.includes('buggy') && (slugLower.includes('buggy') || titleLower.includes('buggy'))) {
      score += 20;
    }
    if (queryLower.includes('escuna') && (slugLower.includes('escuna') || titleLower.includes('escuna'))) {
      score += 20;
    }
    if (queryLower.includes('jet') && (slugLower.includes('jet') || titleLower.includes('jet'))) {
      score += 20;
    }

    return { chunk, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(s => s.chunk);
}

export async function buildKnowledgeContext(query: string): Promise<string> {
  const relevantChunks = await searchKnowledge(query);

  if (relevantChunks.length === 0) {
    const allChunks = await getAllKnowledgeChunks();
    const generalChunks = allChunks.slice(0, 3);
    if (generalChunks.length === 0) {
      return 'Base de conhecimento não disponível no momento.';
    }
    return generalChunks.map(c => `### ${c.title}\n${c.content}`).join('\n\n---\n\n');
  }

  return relevantChunks.map(c => `### ${c.title}\n${c.content}`).join('\n\n---\n\n');
}

export async function getPasseioInfo(passeioName: string): Promise<KnowledgeChunk | null> {
  const chunks = await getAllKnowledgeChunks();
  const nameLower = passeioName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  for (const chunk of chunks) {
    const titleLower = (chunk.title || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const slugLower = (chunk.slug || '').toLowerCase();

    if (titleLower.includes(nameLower) || slugLower.includes(nameLower) || nameLower.includes(slugLower)) {
      return chunk;
    }
  }

  return null;
}

export async function getPriceInfo(): Promise<string> {
  const chunks = await getAllKnowledgeChunks();
  const priceChunks = chunks.filter(c => {
    const content = (c.content || '').toLowerCase();
    const title = (c.title || '').toLowerCase();
    return content.includes('r$') || content.includes('preco') || title.includes('preco') || title.includes('tabela');
  });

  if (priceChunks.length === 0) {
    return 'Informações de preço não encontradas. Consulte nossa equipe.';
  }

  return priceChunks.map(c => `**${c.title}**\n${c.content}`).join('\n\n');
}
