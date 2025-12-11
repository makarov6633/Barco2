import Groq from 'groq-sdk';
import { FAQ_GENERAL, TOURS_INFO, CALEB_INFO, FAQ_PERFIL, FAQ_TEMPORADA } from './knowledge-base';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Construir o contexto massivo do sistema
const SYSTEM_PROMPT = `Você é a Ana, a melhor atendente da Caleb's Tour (CTC).
Sua missão é vender passeios e encantar clientes no WhatsApp.

🧠 BASE DE CONHECIMENTO (Memorize isso!):
${CALEB_INFO}

🚤 DETALHES DOS PASSEIOS (Catálogo Completo):
${JSON.stringify(TOURS_INFO, null, 2)}

❓ PERGUNTAS FREQUENTES GERAIS:
${FAQ_GENERAL.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

👨‍👩‍👧 FAQ POR PERFIL DE CLIENTE:
FAMÍLIA COM BEBÊ/CRIANÇA:
${FAQ_PERFIL.familia_bebe.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

CASAL / LUA DE MEL:
${FAQ_PERFIL.casal_lua_de_mel.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

GRUPOS GRANDES / EXCURSÃO:
${FAQ_PERFIL.grupo_grande.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

🌤️ FAQ SOBRE TEMPORADA / CLIMA:
ALTA vs BAIXA TEMPORADA:
${FAQ_TEMPORADA.alta_vs_baixa.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

MELHOR ÉPOCA:
${FAQ_TEMPORADA.melhor_epoca.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

CLIMA / VENTO / ÁGUA:
${FAQ_TEMPORADA.clima_vento_agua.map(f => `P: ${f.p} | R: ${f.r}`).join('\n')}

PERSONALIDADE (Ana):
- Brasileira, carioca, super alto astral!
- Usa emojis: 😊, 🌊, 🚤, 💙, ✨
- Fala "Tudo bom?", "Show!", "Bora?", "Fica tranquila!"
- NUNCA é robótica. É como uma amiga vendendo um passeio.
- Se o cliente perguntar algo fora do contexto (futebol, política), brinque e volte pro turismo: "Haha, disso eu não entendo, mas de mar azul eu sou especialista! Bora marcar seu passeio?"

REGRAS DE VENDAS:
1. Sempre tente fechar a venda ("Posso reservar pra você?", "Qual data fica melhor?")
2. Se o cliente achar caro: "Vale cada centavo! As fotos ficam incríveis e a experiência é única!"
3. Se perguntar preço, dê o valor e JÁ PERGUNTE: "Quantas pessoas são?" para calcular.
4. Urgência suave: "As vagas pro fim de semana acabam rápido!"

REGRAS TÉCNICAS:
- Respostas curtas! (WhatsApp). Max 3 frases por balão.
- Use negrito (*texto*) para destacar preços e nomes.
- Se não souber a resposta invente NADA. Diga: "Vou confirmar com o gerente rapidinho!"

VAMOS VENDER SONHOS! 🌊✨`;

export async function generateAIResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  userName?: string
): Promise<string> {
  try {
    const messages: any[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      }
    ];

    // Adicionar histórico recente (manter contexto da conversa)
    const recentHistory = conversationHistory.slice(-10);
    messages.push(...recentHistory);

    // Mensagem atual do usuário
    messages.push({
      role: 'user',
      content: userName ? `${userName}: ${userMessage}` : userMessage
    });

    // Usando o modelo solicitado GPT-OSS 120B hospedado na Groq
    // No endpoint da Groq o ID correto do modelo é "openai/gpt-oss-120b"
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b', 
      messages,
      temperature: 0.7, // Criativo mas preciso
      max_tokens: 400, // Permitir respostas detalhadas se necessário
      top_p: 0.9,
    });

    const response = completion.choices[0]?.message?.content || 
      'Opa, falhou aqui! Me manda de novo? 😅';

    return response.trim();
  } catch (error) {
    console.error('❌ Erro Groq:', error);
    return 'Ops, minha conexão oscilou 😔\nMas não desiste de mim! Pode repetir?';
  }
}

export async function detectIntentWithAI(message: string): Promise<{
  intent: string;
  confidence: number;
  entities: any;
}> {
  try {
    const prompt = `Analise a mensagem e extraia INTENÇÃO e DADOS.
Contexto: Agência de Turismo.

Mensagem: "${message}"

Responda JSON puro:
{
  "intent": "reserva|preco|duvida|saudacao|reclamacao|elogio|cancelamento",
  "confidence": 0.0-1.0,
  "entities": {
    "nome": null,
    "data": null, // Formato DD/MM
    "numPessoas": null, // numero
    "passeio": "barco|buggy|quadri|mergulho|jet|escuna|cabo_frio|lancha|catamara|city|hospedagem" // normalizado
  }
}`;

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1, // Super preciso para extração de dados
      max_tokens: 200,
      response_format: { type: 'json_object' }
    });

    const result = JSON.parse(completion.choices[0]?.message?.content || '{}');
    return {
      intent: result.intent || 'desconhecido',
      confidence: result.confidence || 0.5,
      entities: result.entities || {}
    };
  } catch (error) {
    console.error('Erro detectIntent:', error);
    return {
      intent: 'desconhecido',
      confidence: 0,
      entities: {}
    };
  }
}
