import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('/project/workspace/.env.local'), override: true });
dotenv.config({ path: path.resolve('/project/workspace/makarov6633/Barco2/.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { getAllKnowledgeChunks, getAllPasseios, KnowledgeChunk, Passeio } from '../lib/supabase';

type Question = { n: number; text: string };

type MatchLevel = 'none' | 'weak' | 'medium' | 'strong';

type KnowledgeMatch = {
  level: MatchLevel;
  hits: number;
  tokens: number;
  score: number;
  chunk?: Pick<KnowledgeChunk, 'slug' | 'title'>;
};

type PasseioMatch = {
  level: MatchLevel;
  hits: number;
  tokens: number;
  score: number;
  passeio?: Pick<Passeio, 'id' | 'nome' | 'categoria'>;
};

function normalizeString(value?: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractQuestions(text: string): Question[] {
  const out: Question[] = [];
  const lines = String(text || '').split(/\r?\n/);

  for (const line of lines) {
    const m = line.match(/^\s*(\d{1,4})\.\s+(.+?)\s*$/);
    if (!m) continue;
    const n = Number.parseInt(m[1], 10);
    const q = String(m[2] || '').trim();
    if (!Number.isFinite(n) || !q) continue;
    out.push({ n, text: q });
  }

  out.sort((a, b) => a.n - b.n);
  return out;
}

function classifyMatch(hits: number, tokens: number) {
  if (hits <= 0) return 'none' as const;
  const ratio = tokens > 0 ? hits / tokens : 0;
  if (hits >= 4 || (hits >= 2 && ratio >= 0.45)) return 'strong' as const;
  if (hits >= 2) return 'medium' as const;
  return 'weak' as const;
}

const STOPWORDS = new Set([
  'a','o','os','as','um','uma','uns','umas',
  'de','do','da','dos','das','no','na','nos','nas',
  'e','ou','pra','para','por','com','sem','em','ao','aos','à','às',
  'que','qual','quais','quando','quanto','quantos','quantas','onde','como','porque','por','por que',
  'tem','tenho','tive','ser','estar','fica','pode','posso','precisa','preciso','necessario','necessária','necessaria',
  'vocês','voces','voce','vcs','ctc','caleb','calebs'
]);

function tokenizeQuery(raw: string, opts?: { minLen?: number; ignore?: Set<string> }) {
  const minLen = opts?.minLen ?? 2;
  const ignore = opts?.ignore;

  const q = normalizeString(raw);
  if (!q) return { q, tokens: [] as string[] };

  const rawTokens = q.split(' ').map(t => t.trim()).filter(Boolean);
  const tokens = Array.from(
    new Set(
      rawTokens
        .filter(t => t.length >= minLen)
        .filter(t => !STOPWORDS.has(t))
        .filter(t => !(ignore && ignore.has(t)))
    )
  );

  return { q, tokens };
}

function bestKnowledgeMatch(chunks: KnowledgeChunk[], question: string): KnowledgeMatch {
  const { q, tokens } = tokenizeQuery(question, { minLen: 2 });
  if (!q) {
    return { level: 'none', hits: 0, tokens: 0, score: 0 };
  }

  let best: { c: KnowledgeChunk; score: number; hits: number } | undefined;

  const scored = chunks
    .map((c) => {
      const hay = normalizeString(`${c.title} ${c.slug} ${(c.tags || []).join(' ')} ${c.content}`);
      let hits = 0;
      for (const t of tokens) {
        if (hay.includes(t)) hits += 1;
      }
      const exactIdx = hay.indexOf(q);
      const score = hits * 100 + (exactIdx === -1 ? 0 : 40) + (exactIdx === -1 ? 0 : Math.max(0, 20 - exactIdx));
      return { c, score, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.score - a.score);

  best = scored[0];

  const hits = best?.hits ?? 0;
  const score = best?.score ?? 0;
  const level = classifyMatch(hits, tokens.length);

  return {
    level,
    hits,
    tokens: tokens.length,
    score,
    chunk: best ? { slug: best.c.slug, title: best.c.title } : undefined
  };
}

const PASSEIOS_IGNORE = new Set([
  'passeio','passeios','tour','roteiro','opcao','opcoes','valor','valores','preco','precos','quanto','custa','quero','reservar','reserva','agendar','fechar',
  'barco','buggy','quadriciclo','mergulho','transfer','lancha','escuna','jetski','jet','ski','open','bar','food'
]);

function bestPasseioMatch(passeios: Passeio[], question: string): PasseioMatch {
  const { q, tokens } = tokenizeQuery(question, { minLen: 3, ignore: PASSEIOS_IGNORE });

  if (!q) {
    return { level: 'none', hits: 0, tokens: 0, score: 0 };
  }

  let best: { p: Passeio; score: number; hits: number } | undefined;

  const scored = passeios
    .map((p) => {
      const hay = normalizeString(`${p.nome} ${p.categoria || ''} ${p.local || ''} ${p.descricao || ''} ${(p as any)?.includes || ''} ${p.horarios || ''}`);
      let hits = 0;
      for (const t of tokens) {
        if (hay.includes(t)) hits += 1;
      }
      const exactIdx = hay.indexOf(q);
      const score = hits * 100 + (exactIdx === -1 ? 0 : 50) + (exactIdx === -1 ? 0 : Math.max(0, 30 - exactIdx));
      return { p, score, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.score - a.score);

  best = scored[0];

  const hits = best?.hits ?? 0;
  const score = best?.score ?? 0;
  const level = classifyMatch(hits, tokens.length);

  return {
    level,
    hits,
    tokens: tokens.length,
    score,
    passeio: best ? { id: best.p.id, nome: best.p.nome, categoria: best.p.categoria } : undefined
  };
}

function csvEscape(value: any) {
  const s = String(value ?? '');
  if (!/[\n\r,\"]/g.test(s)) return s;
  return `"${s.replace(/\"/g, '""')}"`;
}

async function main() {
  const inputPath = process.argv[2] || '/project/workspace/perguntas.txt';
  const outputPath = process.argv[3];

  const hasSupabase = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    console.error('Create a .env.local with these values and rerun.');
    process.exit(2);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const questions = extractQuestions(raw);

  if (!questions.length) {
    console.error('No numbered questions found in file:', inputPath);
    process.exit(1);
  }

  const [chunks, passeios] = await Promise.all([getAllKnowledgeChunks(), getAllPasseios()]);

  const header = [
    'n',
    'question',
    'knowledge_level','knowledge_hits','knowledge_tokens','knowledge_score','knowledge_title','knowledge_slug',
    'passeios_level','passeios_hits','passeios_tokens','passeios_score','passeio_nome','passeio_categoria','passeio_id'
  ];

  const rows: string[] = [];
  rows.push(header.join(','));

  const counters = {
    knowledge: { none: 0, weak: 0, medium: 0, strong: 0 },
    passeios: { none: 0, weak: 0, medium: 0, strong: 0 }
  } as const;

  for (const q of questions) {
    const km = bestKnowledgeMatch(chunks, q.text);
    const pm = bestPasseioMatch(passeios, q.text);

    (counters.knowledge as any)[km.level] += 1;
    (counters.passeios as any)[pm.level] += 1;

    rows.push([
      q.n,
      csvEscape(q.text),
      km.level,
      km.hits,
      km.tokens,
      km.score,
      csvEscape(km.chunk?.title || ''),
      csvEscape(km.chunk?.slug || ''),
      pm.level,
      pm.hits,
      pm.tokens,
      pm.score,
      csvEscape(pm.passeio?.nome || ''),
      csvEscape(pm.passeio?.categoria || ''),
      csvEscape(pm.passeio?.id || '')
    ].join(','));
  }

  const summary = [
    '',
    '# Summary',
    `knowledge_none=${counters.knowledge.none}`,
    `knowledge_weak=${counters.knowledge.weak}`,
    `knowledge_medium=${counters.knowledge.medium}`,
    `knowledge_strong=${counters.knowledge.strong}`,
    `passeios_none=${counters.passeios.none}`,
    `passeios_weak=${counters.passeios.weak}`,
    `passeios_medium=${counters.passeios.medium}`,
    `passeios_strong=${counters.passeios.strong}`
  ].join('\n');

  if (outputPath) {
    fs.writeFileSync(outputPath, rows.join('\n') + '\n' + summary + '\n', 'utf8');
    console.log('Wrote:', outputPath);
  } else {
    process.stdout.write(rows.join('\n') + '\n' + summary + '\n');
  }
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
