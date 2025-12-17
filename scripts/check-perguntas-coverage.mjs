import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(envPath) {
  try {
    const raw = fs.readFileSync(envPath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      let value = trimmed.slice(idx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] == null) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore
  }
}

loadEnvFile('/project/workspace/.env.local');
loadEnvFile('/project/workspace/makarov6633/Barco2/.env.local');
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(2);
}

function normalizeString(value = '') {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function applyQueryExpansions(value = '') {
  let s = String(value || '');
  s = s.replace(/\u00A0/g, ' ');
  s = s.toLowerCase();
  s = s.replace(/\bqto\b/g, 'quanto');
  s = s.replace(/\bqnt\b/g, 'quanto');
  s = s.replace(/\bqro\b/g, 'quero');
  s = s.replace(/\bkero\b/g, 'quero');
  s = s.replace(/\bvc\b/g, 'voce');
  s = s.replace(/\bvcs\b/g, 'voces');
  s = s.replace(/\bpq\b/g, 'porque');
  s = s.replace(/\bhj\b/g, 'hoje');
  s = s.replace(/\bamnh\b/g, 'amanha');
  s = s.replace(/\bdps\b/g, 'depois');
  s = s.replace(/\bprx\b/g, 'proximo');
  s = s.replace(/\bprox\b/g, 'proximo');
  s = s.replace(/\bbarc\b/g, 'barco');
  s = s.replace(/\bopenbar\b/g, 'open bar');
  s = s.replace(/\bopenfood\b/g, 'open food');
  return s;
}

function normalizeQuery(value = '') {
  return normalizeString(applyQueryExpansions(value));
}

function extractQuestions(text) {
  const out = [];
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

const KNOW_STOP = new Set([
  'a','o','os','as','um','uma','uns','umas',
  'de','do','da','dos','das','no','na','nos','nas',
  'e','ou','pra','para','por','com','sem','em','ao','aos','à','às',
  'que','qual','quais','quando','quanto','quantos','quantas','onde','como','porque','por que',
  'tem','tenho','tive','ser','estar','fica','pode','posso','precisa','necessario','necessária'
]);

function bestKnowledgeMatch(chunks, term) {
  const q = normalizeString(term);
  if (!q) return { hit: false, hits: 0, tokens: 0, score: 0 };

  const rawTokens = q.split(' ').map(t => t.trim()).filter(Boolean);
  const tokens = Array.from(new Set(rawTokens.filter(t => t.length >= 2 && !KNOW_STOP.has(t))));

  if (!tokens.length) {
    const fallback = chunks
      .map((c) => {
        const hay = normalizeString(`${c.title} ${c.slug} ${(c.tags || []).join(' ')} ${c.content}`);
        const exactIdx = hay.indexOf(q);
        const score = exactIdx === -1 ? 0 : 100 + Math.max(0, 30 - exactIdx);
        return { c, score, hits: score > 0 ? 1 : 0 };
      })
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)[0];

    if (!fallback) return { hit: false, hits: 0, tokens: 0, score: 0 };
    return {
      hit: true,
      hits: fallback.hits,
      tokens: 0,
      score: fallback.score,
      slug: fallback.c.slug,
      title: fallback.c.title
    };
  }

  const best = chunks
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
    .filter(x => x.hits > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return { hit: false, hits: 0, tokens: tokens.length, score: 0 };

  return {
    hit: true,
    hits: best.hits,
    tokens: tokens.length,
    score: best.score,
    slug: best.c.slug,
    title: best.c.title
  };
}

function bestPasseioMatch(passeios, term) {
  const query = normalizeQuery(term);
  if (!query) return { hit: false, hits: 0, tokens: 0, score: 0 };

  const tokens = Array.from(new Set(query.split(' ').filter(t => t.length >= 3)));
  if (!tokens.length) return { hit: false, hits: 0, tokens: 0, score: 0 };

  const best = passeios
    .map((p) => {
      const hay = normalizeString(`${p.nome} ${p.categoria || ''} ${p.local || ''} ${p.descricao || ''} ${p.includes || ''} ${p.horarios || ''}`);
      let hits = 0;
      for (const t of tokens) {
        if (hay.includes(t)) hits += 1;
      }
      const exactIdx = hay.indexOf(query);
      const score = hits * 100 + (exactIdx === -1 ? 0 : 50) + (exactIdx === -1 ? 0 : Math.max(0, 30 - exactIdx));
      return { p, score, hits };
    })
    .filter(x => x.hits > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (!best) return { hit: false, hits: 0, tokens: tokens.length, score: 0 };

  return {
    hit: true,
    hits: best.hits,
    tokens: tokens.length,
    score: best.score,
    id: best.p.id,
    nome: best.p.nome,
    categoria: best.p.categoria || ''
  };
}

function levelFrom(hits, tokens) {
  if (hits <= 0) return 'none';
  const ratio = tokens > 0 ? hits / tokens : 0;
  if (hits >= 4 || (hits >= 2 && ratio >= 0.45)) return 'strong';
  if (hits >= 2) return 'medium';
  return 'weak';
}

async function fetchAll(table, select) {
  const out = [];
  const page = 1000;
  for (let offset = 0; offset < 100000; offset += page) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=${page}&offset=${offset}`;
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`
      }
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status} on ${table}: ${text.slice(0, 300)}`);
    }

    const data = await res.json();
    if (!Array.isArray(data)) break;
    out.push(...data);
    if (data.length < page) break;
  }
  return out;
}

async function main() {
  const perguntasPath = process.argv[2] || '/project/workspace/perguntas.txt';
  const raw = fs.readFileSync(perguntasPath, 'utf8');
  const questions = extractQuestions(raw);

  const [chunks, passeios] = await Promise.all([
    fetchAll('knowledge_chunks', '*'),
    fetchAll('passeios', '*')
  ]);

  const counters = {
    knowledge: { none: 0, weak: 0, medium: 0, strong: 0 },
    passeios: { none: 0, weak: 0, medium: 0, strong: 0 },
    any: { none: 0, weak: 0, medium: 0, strong: 0 }
  };

  const misses = [];
  const weakOverall = [];

  for (const q of questions) {
    const km = bestKnowledgeMatch(chunks, q.text);
    const pm = bestPasseioMatch(passeios, q.text);

    const kLevel = levelFrom(km.hits, km.tokens);
    const pLevel = levelFrom(pm.hits, pm.tokens);

    counters.knowledge[kLevel] += 1;
    counters.passeios[pLevel] += 1;

    const anyLevelOrder = ['none', 'weak', 'medium', 'strong'];
    const anyLevel = anyLevelOrder[Math.max(anyLevelOrder.indexOf(kLevel), anyLevelOrder.indexOf(pLevel))];
    counters.any[anyLevel] += 1;

    if (anyLevel === 'none') {
      misses.push({ n: q.n, text: q.text, kLevel, pLevel, km, pm });
    }

    if (anyLevel === 'weak') {
      weakOverall.push({ n: q.n, text: q.text, kLevel, pLevel, km, pm });
    }
  }

  console.log(`Total perguntas: ${questions.length}`);
  console.log('Knowledge match:', counters.knowledge);
  console.log('Passeios match:', counters.passeios);
  console.log('Any source match:', counters.any);

  if (misses.length) {
    console.log('\nSem match em nenhuma fonte (top 30):');
    for (const m of misses.slice(0, 30)) {
      console.log(`${m.n}. ${m.text}`);
    }
    if (misses.length > 30) console.log(`... +${misses.length - 30} outras`);
  }

  if (weakOverall.length) {
    console.log(`\nMatch fraco (top 40 de ${weakOverall.length}):`);
    for (const m of weakOverall.slice(0, 40)) {
      const k = m.km?.title ? `K: ${m.km.title}` : 'K: -';
      const p = m.pm?.nome ? `P: ${m.pm.nome}` : 'P: -';
      console.log(`${m.n}. ${m.text} | ${k} | ${p}`);
    }
    if (weakOverall.length > 40) console.log(`... +${weakOverall.length - 40} outras`);
  }
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
