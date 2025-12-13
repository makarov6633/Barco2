/**
 * Script de Teste do Agente de IA
 * 
 * Execute: node test-agent.js
 */

console.log('\n🧪 TESTE DO AGENTE DE IA - Caleb\'s Tour\n');

// Verificar .env.local
console.log('📋 Verificando variáveis de ambiente...\n');

require('dotenv').config({ path: '.env.local' });

const checks = [
  { name: 'Supabase URL', key: 'NEXT_PUBLIC_SUPABASE_URL' },
  { name: 'Supabase Anon Key', key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY' },
  { name: 'Supabase Service Key', key: 'SUPABASE_SERVICE_ROLE_KEY' },
  { name: 'Twilio Account SID', key: 'TWILIO_ACCOUNT_SID' },
  { name: 'Twilio Auth Token', key: 'TWILIO_AUTH_TOKEN' },
  { name: 'Twilio WhatsApp From', key: 'TWILIO_WHATSAPP_FROM' },
  { name: 'Twilio Business Number', key: 'TWILIO_BUSINESS_WHATSAPP' },
  { name: 'Groq API Key', key: 'GROQ_API_KEY' }
];

let allGood = true;

checks.forEach(check => {
  const value = process.env[check.key];
  const status = value ? '✅' : '❌';
  const display = value ? 'CONFIGURADO' : 'NÃO CONFIGURADO';
  console.log(`${status} ${check.name}: ${display}`);
  if (!value) allGood = false;
});

console.log('\n📦 Verificando arquivos do sistema...\n');

const fs = require('fs');
const files = [
  'lib/supabase.ts',
  'lib/groq-ai.ts',
  'lib/twilio.ts',
  'lib/agent.ts',
  'app/api/webhook/whatsapp/route.ts',
  'SUPABASE_SETUP.sql',
  '.env.local'
];

files.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`${status} ${file}`);
  if (!exists) allGood = false;
});

console.log('\n' + '='.repeat(60));

if (allGood) {
  console.log('✅ SISTEMA CONFIGURADO CORRETAMENTE!\n');
  console.log('📝 Próximos passos:');
  console.log('   1. Execute o SQL no Supabase (SUPABASE_SETUP.sql)');
  console.log('   2. Configure o webhook no Twilio');
  console.log('   3. Deploy na Vercel: vercel --prod');
  console.log('   4. Teste enviando mensagem no WhatsApp!\n');
} else {
  console.log('❌ CONFIGURAÇÃO INCOMPLETA\n');
  console.log('📝 Verifique:');
  console.log('   - Arquivo .env.local com todas as variáveis');
  console.log('   - Todos os arquivos do sistema estão presentes\n');
}

console.log('📚 Documentação completa: README-AGENTE-IA.md\n');
