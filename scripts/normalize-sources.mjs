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

async function fetchAll(table) {
  const out = [];
  const page = 1000;
  for (let offset = 0; offset < 200000; offset += page) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=id,slug,source&limit=${page}&offset=${offset}`;
    const res = await fetch(url, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } });
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

async function patch(id, payload) {
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
  const rows = await fetchAll('knowledge_chunks');
  const changed = [];

  for (const r of rows) {
    const src = String(r.source ?? '').trim();
    if (!src) continue;

    if (/^whatsapp\s*:/i.test(src)) {
      await patch(r.id, { source: 'WhatsApp' });
      changed.push({ id: r.id, slug: r.slug, source: 'WhatsApp' });
      continue;
    }

    if (/whatsapp\s*:/i.test(src)) {
      const cleaned = src.replace(/whatsapp\s*:[^,\n]+/gi, 'WhatsApp').replace(/\s{2,}/g, ' ').trim();
      if (cleaned !== src) {
        await patch(r.id, { source: cleaned });
        changed.push({ id: r.id, slug: r.slug, source: cleaned });
      }
    }
  }

  console.log(JSON.stringify({ updated: changed.length, samples: changed.slice(0, 30) }, null, 2));
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
