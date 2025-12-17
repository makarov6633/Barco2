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

function mdEscape(text) {
  return String(text ?? '').replace(/\r\n/g, '\n');
}

function toMarkdown(sections) {
  const lines = [];
  lines.push(`# Export Supabase knowledge_chunks`);
  lines.push(`Gerado em: ${new Date().toISOString()}`);
  lines.push(`Total chunks: ${sections.length}`);
  lines.push('');

  for (const c of sections) {
    const slug = c.slug ?? '';
    const title = c.title ?? '';
    const tags = Array.isArray(c.tags) ? c.tags.join(', ') : (c.tags ?? '');
    const source = c.source ?? '';

    lines.push(`---`);
    lines.push(`slug: ${slug}`);
    lines.push(`title: ${title}`);
    if (tags) lines.push(`tags: ${tags}`);
    if (source) lines.push(`source: ${source}`);
    if (c.created_at) lines.push(`created_at: ${c.created_at}`);
    if (c.updated_at) lines.push(`updated_at: ${c.updated_at}`);
    lines.push('');
    lines.push(mdEscape(c.content ?? ''));
    lines.push('');
  }

  return lines.join('\n');
}

async function main() {
  const outDir = process.argv[2] || '/project/workspace';
  const baseName = process.argv[3] || 'knowledge_chunks_export';

  const [chunks, passeios] = await Promise.all([fetchAll('knowledge_chunks'), fetchAll('passeios')]);

  const jsonPath = path.join(outDir, `${baseName}.json`);
  const mdPath = path.join(outDir, `${baseName}.md`);
  const siteJsonPath = path.join(outDir, `${baseName}_with_passeios.json`);

  chunks.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  passeios.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || '')));

  fs.writeFileSync(jsonPath, JSON.stringify(chunks, null, 2), 'utf8');
  fs.writeFileSync(mdPath, toMarkdown(chunks), 'utf8');

  fs.writeFileSync(
    siteJsonPath,
    JSON.stringify({ knowledge_chunks: chunks, passeios }, null, 2),
    'utf8'
  );

  console.log('Wrote:');
  console.log(' -', jsonPath);
  console.log(' -', mdPath);
  console.log(' -', siteJsonPath);
  console.log('Counts:', { knowledge_chunks: chunks.length, passeios: passeios.length });
}

main().catch((err) => {
  console.error('Failed:', err?.message || err);
  process.exit(1);
});
