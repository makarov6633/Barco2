require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';

console.log('\n🔍 TESTANDO TWILIO\n');
console.log('AccountSid:', accountSid ? `${accountSid.substring(0, 10)}...` : '❌ NÃO CONFIGURADO');
console.log('AuthToken:', authToken ? `${authToken.substring(0, 10)}...` : '❌ NÃO CONFIGURADO');
console.log('From:', from);
console.log('\n---\n');

if (!accountSid || !authToken) {
  console.error('❌ Faltam credenciais do Twilio no .env\n');
  console.log('Configure:');
  console.log('  TWILIO_ACCOUNT_SID=seu_account_sid');
  console.log('  TWILIO_AUTH_TOKEN=seu_auth_token');
  console.log('  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886\n');
  process.exit(1);
}

const client = twilio(accountSid, authToken);

const testNumber = process.argv[2];

if (!testNumber) {
  console.error('❌ Você precisa passar um número de teste!\n');
  console.log('Uso: node test-twilio.js whatsapp:+5522999999999\n');
  console.log('⚠️  Formato obrigatório: whatsapp:+[código do país][DDD][número]\n');
  process.exit(1);
}

if (!testNumber.startsWith('whatsapp:+')) {
  console.error('❌ Formato incorreto!\n');
  console.log('Use: whatsapp:+5522999999999 (com + e código do país)\n');
  process.exit(1);
}

console.log(`📤 Enviando mensagem de teste para ${testNumber}...\n`);

client.messages
  .create({
    body: '🎉 Teste do Twilio WhatsApp funcionando! Se você recebeu essa mensagem, a integração está OK.',
    from,
    to: testNumber
  })
  .then(message => {
    console.log('✅ SUCESSO!\n');
    console.log('Message SID:', message.sid);
    console.log('Status:', message.status);
    console.log('\n📱 Verifique seu WhatsApp!\n');
  })
  .catch(error => {
    console.error('❌ ERRO AO ENVIAR:\n');
    console.error('Código:', error.code);
    console.error('Mensagem:', error.message);
    console.error('\n');
    
    if (error.code === 21608) {
      console.log('💡 SOLUÇÃO:');
      console.log('Esse número não está autorizado no Sandbox do Twilio.\n');
      console.log('Passos:');
      console.log('1. Acesse: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn');
      console.log('2. Envie o código pelo WhatsApp (ex: join [seu-codigo])');
      console.log('3. Aguarde a confirmação');
      console.log('4. Rode o teste novamente\n');
    } else if (error.code === 20003) {
      console.log('💡 SOLUÇÃO:');
      console.log('Suas credenciais do Twilio estão incorretas.\n');
      console.log('Verifique se o TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN estão corretos.\n');
    } else {
      console.log('💡 Possíveis causas:');
      console.log('- Sandbox do WhatsApp não está ativo');
      console.log('- Número não está no formato E.164 (whatsapp:+5522...)');
      console.log('- Conta Twilio sem créditos\n');
    }
  });
