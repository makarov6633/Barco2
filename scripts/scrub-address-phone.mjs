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

const WHATSAPP_1 = '+55 22 99824-9911';
const WHATSAPP_2 = '+55 22 99728-5249';
const WHATSAPP_BOTH = `${WHATSAPP_1} e ${WHATSAPP_2}`;

async function fetchAll(table) {
  const out = [];
  const page = 1000;
  for (let offset = 0; offset < 200000; offset += page) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`;
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

function scrubPhones(text) {
  let s = String(text ?? '');
  if (!s) return s;

  // Replace explicit contact lines
  s = s
    .split(/\r?\n/)
    .map((line) => {
      const t = line.toLowerCase();
      if (t.includes('whatsapp') || t.includes('telefone') || t.includes('telefones') || t.includes('contato')) {
        // Keep social handles if present, but force whatsapp numbers
        if (t.includes('@')) {
          return line.replace(/\b(whatsapp|telefones|telefone|contato)\b.*$/i, `WhatsApp: ${WHATSAPP_BOTH}.`);
        }
        return `WhatsApp: ${WHATSAPP_BOTH}.`;
      }
      return line;
    })
    .join('\n');

  // Replace any remaining Brazilian phone-like patterns with the official WhatsApp numbers
  const phoneRe = /(\+?55\s*)?\(?\b\d{2}\b\)?\s*9\d{4}[-\s]?\d{4}/g;
  s = s.replace(phoneRe, WHATSAPP_BOTH);

  return s;
}

function scrubAddressLine(line) {
  let out = line;

  // Normalize common detailed address patterns down to bairro + cidade
  out = out.replace(/Endere[cç]o:\s*Pra[cç]a\s+Lions\s+Club[^,\n]*,\s*[^–\-\n]*[–\-]\s*Praia\s+Grande,\s*Arraial\s+do\s+Cabo\s*\/?RJ\.?/gi, 'Endereço: Praia Grande, Arraial do Cabo/RJ.');
  out = out.replace(/Check-?in:\s*Pra[cç]a\s+Lions\s+Club[^,\n]*,\s*[^–\-\n]*[–\-]\s*Praia\s+Grande,\s*Arraial\s+do\s+Cabo\s*\/?RJ\.?/gi, 'Check-in: Praia Grande, Arraial do Cabo/RJ.');

  // Remove numbers/loja/reference phrases anywhere
  out = out.replace(/\bn[ºo]\s*\d+\b/gi, '').replace(/\bloja\s*\d+\b/gi, '');
  out = out.replace(/\bRefer[eê]ncia:.*$/i, '').replace(/\bao\s+lado\s+.*$/i, '');

  // Convert street-level address for company base to bairro/cidade only
  out = out.replace(/Travessa\s+Beija-Flor\s*,\s*([^,\n]+)\s*,\s*([^\n-]+)\s*-\s*RJ/gi, '$1, $2/RJ');

  // Clean extra punctuation/spaces
  out = out.replace(/\s+,/g, ',').replace(/,{2,}/g, ',').replace(/\s{2,}/g, ' ').trim();
  out = out.replace(/^Endere[cç]o:\s*,\s*/i, 'Endereço: ').replace(/\s+-\s+RJ\b/gi, '/RJ');

  // If line became empty or only label, return empty to drop
  const compact = out.replace(/\s+/g, ' ').trim();
  if (/^Refer[eê]ncia:$/i.test(compact)) return '';
  if (/^Endere[cç]o:\s*$/i.test(compact)) return '';

  return out;
}

function scrubAddresses(text) {
  let s = String(text ?? '');
  if (!s) return s;

  // Remove overly detailed check-in directions for pier/restaurant, keep bairro/cidade
  s = s.replace(/Check-?in\s+at[eé]\s+11h\s+no\s+p[íi]er\s+da\s+Praia\s+dos\s+Anjos\s*\([^\)]*\)\.?/gi, 'Check-in até 11h: Praia dos Anjos, Arraial do Cabo/RJ.');
  s = s.replace(/Check-?in\s+at[eé]\s+11h\s+no\s+p[íi]er\s+da\s+Praia\s+dos\s+Anjos\b\.?/gi, 'Check-in até 11h: Praia dos Anjos, Arraial do Cabo/RJ.');

  // Apply line-based scrubbing
  const lines = s.split(/\r?\n/);
  const cleaned = [];
  for (const line of lines) {
    const t = line.toLowerCase();
    if (t.includes('referência:')) continue;
    if (t.includes('ao lado do')) continue;

    const out = scrubAddressLine(line);
    if (!out) continue;
    cleaned.push(out);
  }

  s = cleaned.join('\n');

  // Drop lingering detailed tokens
  s = s.replace(/\s*\(entrada[^\)]*\)/gi, '').replace(/\s{2,}/g, ' ');
  s = s.replace(/\n{4,}/g, '\n\n\n').trim();

  return s;
}

function scrubTitle(title) {
  let s = String(title ?? '').trim();
  if (!s) return s;
  s = s.replace(/–\s*Pra[cç]a\s+Lions\s+Club/gi, '— Praia Grande, Arraial do Cabo');
  s = s.replace(/\s*\(1\s*andar\)\s*–\s*check-?in\s+.*$/i, ' (1 andar) — check-in');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}

async function patchKnowledgeChunk(id, payload) {
  const url = `${SUPABASE_URL}/rest/v1/knowledge_chunks?id=eq.${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PATCH failed ${res.status}: ${text.slice(0, 300)}`);
  }
}

async function main() {
  const chunks = await fetchAll('knowledge_chunks');
  const changed = [];

  for (const c of chunks) {
    const before = {
      title: String(c.title ?? ''),
      source: String(c.source ?? ''),
      content: String(c.content ?? '')
    };

    let title = scrubTitle(before.title);
    let source = scrubPhones(scrubAddresses(before.source));
    let content = scrubPhones(scrubAddresses(before.content));

    // Special-case: keep company-only location statement if present
    content = content.replace(/Travessa\s+Beija-Flor[^\n]*/gi, 'Jacaré, Cabo Frio/RJ');

    const after = { title, source, content };

    const dirty = after.title !== before.title || after.source !== before.source || after.content !== before.content;
    if (!dirty) continue;

    const payload = {};
    if (after.title !== before.title) payload.title = after.title;
    if (after.source !== before.source) payload.source = after.source;
    if (after.content !== before.content) payload.content = after.content;

    await patchKnowledgeChunk(c.id, payload);
    changed.push({ id: c.id, slug: c.slug, fields: Object.keys(payload) });
  }

  console.log(JSON.stringify({ total: chunks.length, updated: changed.length, updated_samples: changed.slice(0, 30) }, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
