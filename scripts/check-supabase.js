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
  const contexts = await fetchJson('/rest/v1/conversation_contexts?select=telefone,context&limit=3');
  const reservas = await fetchJson('/rest/v1/reservas?select=*,clientes(nome,telefone)&limit=1');

  console.log('\nSample conversation contexts:\n');
  contexts.forEach(entry => {
    console.log(JSON.stringify(entry, null, 2));
  });

  console.log('\nSample reserva record (ensuring joins work):\n');
  reservas.forEach(entry => {
    console.log(JSON.stringify(entry, null, 2));
  });
})();
