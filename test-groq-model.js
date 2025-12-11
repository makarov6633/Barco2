const Groq = require('groq-sdk');
require('dotenv').config({ path: '.env.local' });

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

async function testModel() {
  console.log('🔍 Testando modelo GPT-OSS 120B...');
  
  const models = ['gpt-oss-120b', 'openai/gpt-oss-120b', 'gpt-4o-mini', 'llama-3.3-70b-versatile'];
  
  for (const model of models) {
    try {
      console.log(`\nTentando modelo: ${model}`);
      const completion = await groq.chat.completions.create({
        model: model,
        messages: [{ role: 'user', content: 'Oi, funcione por favor!' }],
        max_tokens: 10
      });
      console.log(`✅ SUCESSO com ${model}!`);
      console.log(`Resposta: ${completion.choices[0].message.content}`);
      return; // Encontrou um que funciona
    } catch (error) {
      console.log(`❌ Falha com ${model}: ${error.message?.substring(0, 100)}`);
    }
  }
}

testModel();
