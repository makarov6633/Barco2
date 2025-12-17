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

function scrubText(raw) {
  let s = String(raw ?? '');
  if (!s) return s;

  // Remove explicit third-party brand / partner mentions requested
  s = s.replace(/\bArraial\s*Tour\s*Sun\b/gi, 'CTC');
  s = s.replace(/\bArraial\s*Sun\b/gi, 'CTC');
  s = s.replace(/\bArraial\s*do\s*Cabo\s*Trips\b/gi, 'CTC');

  // Remove personal holder name in Pix references (keep company only)
  s = s.replace(/\s*,?\s*titular\s+[^,\)\n]+/gi, '');

  // Remove emails
  s = s.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[removido]');

  // Remove specific vessel/venue names to keep only company name
  s = s.replace(/\bValentyna\b/gi, 'embarcação parceira');
  s = s.replace(/\bSaint\s*Tropez\b/gi, 'restaurante local');

  // Remove lines that are clearly third-party operational contact blocks
  s = s
    .split(/\r?\n/)
    .filter((line) => {
      const t = line.toLowerCase();
      if (t.includes('contato operacional citado')) return false;
      if (t.includes('arraial do cabo trips')) return false;
      if (t.includes('arraialsun')) return false;
      return true;
    })
    .join('\n');

  // Normalize whitespace (keep formatting)
  s = s.replace(/\n{4,}/g, '\n\n\n').trim();
  return s;
}

function scrubSource(raw) {
  let s = String(raw ?? '').trim();
  if (!s) return s;
  s = s.replace(/\bArraial\s*Tour\s*Sun\b/gi, 'CTC');
  s = s.replace(/\bArraial\s*Sun\b/gi, 'CTC');
  s = s.replace(/Carlospereira-[A-Za-z0-9_-]+\.pdf/gi, 'voucher.pdf');
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

    const after = {
      title: scrubText(before.title),
      source: scrubSource(before.source),
      content: scrubText(before.content)
    };

    const dirty = after.title !== before.title || after.source !== before.source || after.content !== before.content;
    if (!dirty) continue;

    const payload = {};
    if (after.title !== before.title) payload.title = after.title;
    if (after.source !== before.source) payload.source = after.source;
    if (after.content !== before.content) payload.content = after.content;

    await patchKnowledgeChunk(c.id, payload);
    changed.push({ id: c.id, slug: c.slug, fields: Object.keys(payload) });
  }

  console.log(JSON.stringify({ total: chunks.length, updated: changed.length, updated_samples: changed.slice(0, 20) }, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
