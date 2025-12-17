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
      if (key && process.env[key] == null) process.env[key] = value;
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

const WHATSAPP_1 = '+55 22 99824-9911';
const WHATSAPP_2 = '+55 22 99728-5249';
const WHATSAPP_BOTH = `${WHATSAPP_1} e ${WHATSAPP_2}`;

function stripEmojis(text) {
  const raw = String(text ?? '');
  try {
    return raw.replace(/[\p{Extended_Pictographic}]/gu, '').replace(/[\uFE0F\u200D]/g, '');
  } catch {
    return raw;
  }
}

function normalizeWhitespace(text) {
  return String(text ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[\t\u00A0]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .trim();
}

function sanitizeText(text) {
  let s = normalizeWhitespace(stripEmojis(text));

  s = s.replace(/\bPADI\b\/?\bCMAS\b/gi, 'instrutor credenciado');

  s = s.replace(/\bWhatsApp\b/gi, `WhatsApp (${WHATSAPP_BOTH})`);
  s = s.replace(/\bvia\s+WhatsApp\b/gi, `pelo WhatsApp (${WHATSAPP_BOTH})`);
  s = s.replace(/\bno\s+WhatsApp\b/gi, `no WhatsApp (${WHATSAPP_BOTH})`);

  s = s.replace(/\bcaleb\s*tour\b/gi, "Caleb's Tour");
  s = s.replace(/\bctc\b/gi, 'CTC');

  const forbidden = [/\bArraial\s*Tour\s*Sun\b/gi, /\bArraial\s*Sun\b/gi, /\barraialsun\b/gi];
  for (const re of forbidden) s = s.replace(re, 'CTC');

  s = s
    .split('\n')
    .map((line) => {
      const t = line.toLowerCase();
      if (t.includes('travessa') || t.includes('rua ') || t.includes('avenida') || t.includes('nº') || t.includes('loja')) {
        return line
          .replace(/\b(n[ºo]\s*\d+|loja\s*\d+)\b/gi, '')
          .replace(/\s{2,}/g, ' ')
          .trim();
      }
      return line;
    })
    .filter(Boolean)
    .join('\n');

  s = s.replace(/\n{3,}/g, '\n\n').trim();
  return s;
}

function firstPartOnly(text) {
  const marker = 'INFORMAÇÕES GERAIS & CONTATO';
  const idx1 = text.indexOf(marker);
  if (idx1 === -1) return text;
  const idx2 = text.indexOf(marker, idx1 + marker.length);
  if (idx2 === -1) return text;
  return text.slice(0, idx2).trim();
}

function sliceBetween(full, startLabel, endLabel) {
  const a = full.indexOf(startLabel);
  if (a === -1) return '';
  const b = full.indexOf(endLabel, a + startLabel.length);
  const segment = b === -1 ? full.slice(a) : full.slice(a, b);
  return segment.trim();
}

function makeChunk(slug, title, tags, content, source) {
  const cleaned = sanitizeText(content);
  const suffix = `\n\nWhatsApp: ${WHATSAPP_BOTH}.`;
  const final = cleaned.toLowerCase().includes('whatsapp') ? cleaned : (cleaned + suffix);

  return {
    slug,
    title: sanitizeText(title),
    tags,
    source,
    content: final.slice(0, 6000)
  };
}

function splitIfTooLong(chunk, max = 2100) {
  const text = chunk.content;
  if (text.length <= max) return [chunk];

  const parts = [];
  const paras = text.split(/\n\n/);
  let current = '';
  let idx = 1;

  for (const p of paras) {
    const next = current ? `${current}\n\n${p}` : p;
    if (next.length > max && current) {
      parts.push({ ...chunk, slug: `${chunk.slug}-${idx}`, title: `${chunk.title} (parte ${idx})`, content: current });
      idx += 1;
      current = p;
      continue;
    }
    current = next;
  }

  if (current) {
    parts.push({ ...chunk, slug: `${chunk.slug}-${idx}`, title: `${chunk.title} (parte ${idx})`, content: current });
  }

  return parts;
}

async function insertChunks(chunks) {
  const url = `${SUPABASE_URL}/rest/v1/knowledge_chunks`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(chunks)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Insert failed ${res.status}: ${text.slice(0, 500)}`);
  }

  return await res.json();
}

async function main() {
  const inputPath = process.argv[2] || '/project/workspace/a.txt';
  const raw = fs.readFileSync(inputPath, 'utf8');
  const base = firstPartOnly(raw);

  const general = sliceBetween(base, 'INFORMAÇÕES GERAIS & CONTATO', 'PASSEIO DE BARCO');
  const barco = sliceBetween(base, 'PASSEIO DE BARCO', 'PASSEIOS DE BUGGY');
  const buggy = sliceBetween(base, 'PASSEIOS DE BUGGY', 'QUADRICICLO');
  const quadri = sliceBetween(base, 'QUADRICICLO', 'MERGULHO');
  const mergulho = sliceBetween(base, 'MERGULHO', 'ESPORTES AQUÁTICOS');
  const esportes = sliceBetween(base, 'ESPORTES AQUÁTICOS', 'COMBOS');
  const combos = sliceBetween(base, 'COMBOS', 'LANCHAS PRIVADAS');
  const lanchas = sliceBetween(base, 'LANCHAS PRIVADAS', 'TRANSPORTE');
  const transfer = sliceBetween(base, 'TRANSPORTE', 'DETALHES TÉCNICOS');
  const tecnicos = sliceBetween(base, 'DETALHES TÉCNICOS', 'PREÇO, CUSTO-BENEFÍCIO');
  const subjetivas = sliceBetween(base, 'PREÇO, CUSTO-BENEFÍCIO', 'PERGUNTAS DE COMPARAÇÃO');
  const recomendacoes = sliceBetween(base, 'PERGUNTAS DE COMPARAÇÃO', '');

  const source = 'CTC a.txt 2025-12-17';

  const chunks = [];
  chunks.push(makeChunk('kb/ctc-a-txt/gerais-pagamento-cancelamento', "FAQ geral: pagamento, sinal, cancelamento e ponto de encontro (CTC)", ['faq','pagamento','cancelamento','ponto-encontro','cnpj'], general, source));
  chunks.push(makeChunk('kb/ctc-a-txt/barco-faq', 'FAQ barco: tradicional, open bar, open food, taxa e regras (CTC)', ['faq','barco','taxa','criancas','transfer'], barco, source));
  chunks.push(makeChunk('kb/ctc-a-txt/buggy-faq', 'FAQ buggy: capacidade, roteiro, fotos e regras (CTC)', ['faq','buggy','roteiro','seguranca'], buggy, source));
  chunks.push(makeChunk('kb/ctc-a-txt/quadriciclo-faq', 'FAQ quadriciclo: CNH, idade, trajeto e segurança (CTC)', ['faq','quadriciclo','cnh','seguranca'], quadri, source));
  chunks.push(makeChunk('kb/ctc-a-txt/mergulho-faq', 'FAQ mergulho: batismo, acompanhamento, profundidade e saúde (CTC)', ['faq','mergulho','seguranca'], mergulho, source));
  chunks.push(makeChunk('kb/ctc-a-txt/esportes-nao-cobertos', 'Esportes e atividades: quando não há detalhe no material (CTC)', ['faq','jetski','paramotor','surf','caiaque','canoa'], esportes, source));
  chunks.push(makeChunk('kb/ctc-a-txt/combos-city', 'Combos e city tours: regras gerais e flexibilidade (CTC)', ['faq','combo','city-tour'], combos, source));
  chunks.push(makeChunk('kb/ctc-a-txt/lanchas-escunas', 'Lanchas privativas e escunas: roteiro, capacidade e churrasco (CTC)', ['faq','lancha','escuna','privativo'], lanchas, source));
  chunks.push(makeChunk('kb/ctc-a-txt/transfer', 'Transfer e transporte: aeroporto, malas e modalidades (CTC)', ['faq','transfer','van','aeroporto'], transfer, source));
  chunks.push(makeChunk('kb/ctc-a-txt/respostas-padrao-tecnicas', 'Respostas padrão: detalhes técnicos e regulamentação (CTC)', ['faq','padrao','seguranca','regulamentacao'], tecnicos, source));
  chunks.push(makeChunk('kb/ctc-a-txt/respostas-padrao-subjetivas', 'Respostas padrão: avaliações subjetivas e custo-benefício (CTC)', ['faq','padrao','recomendacao'], subjetivas, source));
  chunks.push(makeChunk('kb/ctc-a-txt/respostas-padrao-recomendacoes', 'Respostas padrão: comparação e recomendação de passeios (CTC)', ['faq','padrao','comparacao','recomendacao'], recomendacoes, source));

  const expanded = chunks.flatMap((c) => splitIfTooLong(c, 2100));

  const toInsert = expanded
    .map((c) => ({
      slug: c.slug,
      title: c.title,
      tags: c.tags,
      source: c.source,
      content: c.content
    }))
    .filter((c) => c.content && c.title && c.slug);

  const inserted = await insertChunks(toInsert);
  console.log(JSON.stringify({ inserted: inserted.length, slugs: inserted.map((x) => x.slug).slice(0, 40) }, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
