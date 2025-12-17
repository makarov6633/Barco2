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

async function fetchAll(table) {
  const out = [];
  const page = 1000;
  for (let offset = 0; offset < 200000; offset += page) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=${page}&offset=${offset}`;
    const res = await fetch(url, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
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

function dedupeWhatsapp(text) {
  let s = String(text ?? '');
  if (!s) return s;

  // Collapse duplicated "WhatsApp: <both> e <both>" patterns
  const bothEsc = WHATSAPP_BOTH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`WhatsApp:\\s*${bothEsc}(?:\\s*e\\s*${bothEsc})+\\.?`, 'gi');
  s = s.replace(re, `WhatsApp: ${WHATSAPP_BOTH}.`);

  // If a line contains multiple repeated both numbers, keep one
  s = s.replace(new RegExp(`(${bothEsc})(?:\\s*e\\s*${bothEsc})+`, 'gi'), WHATSAPP_BOTH);

  // Ensure exactly one WhatsApp line at most (keep first)
  const lines = s.split(/\r?\n/);
  let seen = false;
  const out = [];
  for (const line of lines) {
    if (/^\s*WhatsApp\s*:/i.test(line)) {
      if (seen) continue;
      seen = true;
      out.push(`WhatsApp: ${WHATSAPP_BOTH}.`);
      continue;
    }
    out.push(line);
  }
  s = out.join('\n');

  return s;
}

function removeRemainingDetailedAddress(text) {
  let s = String(text ?? '');
  if (!s) return s;

  s = s.replace(/Pra[cç]a\s+Lions\s+Club/gi, 'Praia Grande');
  s = s.replace(/Check-?in:\s*Praia\s+Grande\s*,?\s*Praia\s+Grande/gi, 'Check-in: Praia Grande');

  // Ensure the city is included when check-in only has bairro
  s = s.replace(/Check-?in:\s*Praia\s+Grande(?!.*Arraial)/gi, 'Check-in: Praia Grande, Arraial do Cabo/RJ');

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
    const before = String(c.content ?? '');
    let content = before;

    content = removeRemainingDetailedAddress(content);
    content = dedupeWhatsapp(content);

    if (content !== before) {
      await patchKnowledgeChunk(c.id, { content });
      changed.push({ id: c.id, slug: c.slug });
    }
  }

  console.log(JSON.stringify({ updated: changed.length, samples: changed.slice(0, 30) }, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
