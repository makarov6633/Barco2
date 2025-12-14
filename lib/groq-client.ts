import Groq from 'groq-sdk';

let cached: Groq | null = null;

export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY environment variable is missing or empty.');
  cached ||= new Groq({ apiKey });
  return cached;
}

export async function groqChat(params: {
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
  model?: string;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}) {
  const groq = getGroqClient();
  const completion = await groq.chat.completions.create({
    model: params.model || process.env.GROQ_REASONING_MODEL || 'openai/gpt-oss-120b',
    messages: params.messages,
    temperature: params.temperature ?? 0.4,
    max_tokens: params.max_tokens ?? 700,
    top_p: params.top_p ?? 0.9
  });

  const content = completion.choices[0]?.message?.content;
  return (content || '').trim();
}
