const fs = require('fs');

function loadEnvFile(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    raw.split(/\r?\n/).forEach(line => {
      const trimmed = String(line || '').trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq === -1) return;
      const k = trimmed.slice(0, eq).trim();
      let v = trimmed.slice(eq + 1).trim();
      if (!k) return;
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (process.env[k] == null) process.env[k] = v;
    });
  } catch {
  }
}

loadEnvFile('/project/workspace/.env.local');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: 'return=representation'
};

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchJson(endpoint) {
  const res = await fetch(`${url}${endpoint}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json();
}

function parseBRL(value) {
  if (!value) return null;
  const m = String(value).match(/(\d+[\d\.]*,\d{2}|\d+)/);
  if (!m) return null;
  const raw = m[1];
  if (raw.includes(',')) {
    return Number(raw.replace(/\./g, '').replace(',', '.'));
  }
  return Number(raw);
}

function extractSiteTours() {
  const file = '/project/workspace/makarov6633/Barco2/app/page.tsx';
  const content = fs.readFileSync(file, 'utf8');

  const start = content.indexOf('const tours = [');
  if (start === -1) return [];
  const end = content.indexOf('];', start);
  if (end === -1) return [];

  const block = content.slice(start, end);

  const items = [];
  const objRegex = /\{[\s\S]*?\}/g;
  const objs = block.match(objRegex) || [];

  for (const obj of objs) {
    const id = (obj.match(/id:\s*'([^']+)'/) || [])[1];
    const title = (obj.match(/title:\s*'([^']+)'/) || [])[1];
    const startingAt = (obj.match(/startingAt:\s*'([^']+)'/) || [])[1];
    if (!id || !title) continue;
    items.push({ id, title, startingAt, startingAtValue: parseBRL(startingAt) });
  }

  return items;
}

function bestMatch(dbPasseios, tour) {
  const q = normalize(`${tour.id} ${tour.title}`);
  const keywords = q
    .split(' ')
    .filter(w => w.length >= 4)
    .slice(0, 8);

  const scored = dbPasseios
    .map(p => {
      const hay = normalize(`${p.nome} ${p.categoria || ''} ${p.local || ''}`);
      let score = 0;
      for (const k of keywords) {
        if (hay.includes(k)) score += 1;
      }
      return { p, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.length ? scored[0].p : null;
}

(async () => {
  const siteTours = extractSiteTours();
  const dbPasseios = await fetchJson('/rest/v1/passeios?select=id,nome,categoria,preco_min,preco_max&order=nome');

  console.log('\nSITE (app/page.tsx) — startingAt (hardcoded):');
  siteTours.forEach(t => {
    console.log(`- ${t.id} | ${t.title} | ${t.startingAt || 'N/A'}`);
  });

  console.log('\nDB (Supabase.passeios) — preco_min/preco_max:');
  dbPasseios.forEach(p => {
    console.log(`- ${p.id} | ${p.nome} | ${p.preco_min ?? 'null'} - ${p.preco_max ?? 'null'}`);
  });

  console.log('\nAUTO-MATCH (heurístico) — site vs DB (apenas para inspeção rápida):');
  siteTours.forEach(t => {
    const m = bestMatch(dbPasseios, t);
    if (!m) {
      console.log(`- ${t.id} -> (sem match)`);
      return;
    }

    const min = m.preco_min != null ? Number(m.preco_min) : null;
    const max = m.preco_max != null ? Number(m.preco_max) : null;

    let ok = 'N/A';
    if (t.startingAtValue != null && min != null && max != null) {
      ok = t.startingAtValue >= min && t.startingAtValue <= max ? 'OK' : 'DIFF';
    } else if (t.startingAtValue != null && min != null && max == null) {
      ok = t.startingAtValue === min ? 'OK' : 'DIFF';
    }

    console.log(`- ${t.id} -> ${m.nome} | site=${t.startingAtValue ?? 'null'} | db=${min ?? 'null'}-${max ?? 'null'} | ${ok}`);
  });
})();
