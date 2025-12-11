const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkTable(name) {
  const { data, error } = await supabase.from(name).select('*').limit(1);
  if (error) {
    console.error(`❌ Erro na tabela ${name}:`, error.message);
    return;
  }
  if (!data || data.length === 0) {
    console.log(`ℹ️ Tabela ${name} sem linhas (ok), colunas disponíveis serão inferidas pelo schema do Supabase.`);
  } else {
    console.log(`✅ Tabela ${name} ok. Colunas:`, Object.keys(data[0]));
  }
}

async function main() {
  console.log('🔎 Testando conexão com Supabase:', url);

  await checkTable('clientes');
  await checkTable('passeios');
  await checkTable('reservas');
  await checkTable('conversation_contexts');

  console.log('\n✅ Teste Supabase finalizado');
}

main().catch(err => {
  console.error('❌ Erro geral no teste Supabase:', err);
  process.exit(1);
});