require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing Supabase env vars.');
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  Prefer: 'return=representation'
};

async function fetchJson(endpoint) {
  const res = await fetch(`${url}${endpoint}`, { headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Request failed ${res.status}: ${text}`);
  }
  return res.json();
}

(async () => {
  const tables = await fetchJson('/rest/v1/information_schema.tables?table_schema=eq.public&select=table_name&order=table_name');
  console.log('Public tables found:\n');
  tables.forEach(t => console.log(`- ${t.table_name}`));

  const targets = ['clientes','reservas','conversation_contexts','passeios','chat_messages','knowledge_chunks'];

  for (const table of targets) {
    console.log(`\nColumns for ${table}:`);
    try {
      const cols = await fetchJson(`/rest/v1/information_schema.columns?table_schema=eq.public&table_name=eq.${table}&select=column_name,data_type,is_nullable,character_maximum_length&order=ordinal_position`);
      if (!cols.length) {
        console.log('  (table not found)');
        continue;
      }
      cols.forEach(col => {
        const extra = col.character_maximum_length ? ` (len ${col.character_maximum_length})` : '';
        console.log(`  - ${col.column_name}: ${col.data_type}${extra}${col.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
    } catch (err) {
      console.log(`  Error: ${err.message}`);
    }
  }
})();
