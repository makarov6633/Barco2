import Groq from 'groq-sdk';

let cached: Groq | null = null;

function getEnvInt(name: string, fallback: number) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function getStatusCode(err: any): number | undefined {
  const direct = err?.status ?? err?.statusCode ?? err?.response?.status;
  if (typeof direct === 'number') return direct;

  const msg = String(err?.message || '');
  const m = msg.match(/\b(4\d\d|5\d\d)\b/);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    return Number.isFinite(n) ? n : undefined;
  }

  return undefined;
}

function isRetryableError(err: any) {
  const status = getStatusCode(err);
  if (status === 429) return true;
  if (status != null && status >= 500) return true;

  const code = String(err?.code || '').toUpperCase();
  if (['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(code)) return true;

  const msg = String(err?.message || '').toLowerCase();
  if (msg.includes('timeout')) return true;
  if (msg.includes('rate limit')) return true;

  return false;
}

function jitter(ms: number) {
  const factor = 0.25;
  const delta = ms * factor;
  const r = (Math.random() * 2 - 1) * delta;
  return Math.max(0, Math.round(ms + r));
}

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

  const model = params.model || process.env.GROQ_REASONING_MODEL || 'deepseek-r1-distill-llama-70b';
  const maxRetries = getEnvInt('GROQ_MAX_RETRIES', 1);
  const timeoutMs = getEnvInt('GROQ_TIMEOUT_MS', 9000);

  let lastErr: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const payload = {
        model,
        messages: params.messages,
        temperature: params.temperature ?? 0.4,
        max_tokens: params.max_tokens ?? 450,
        top_p: params.top_p ?? 0.9
      };

      let completion: any;
      try {
        completion = await (groq.chat.completions.create as any)(payload, { signal: controller.signal });
      } catch (err: any) {
        const msg = String(err?.message || '').toLowerCase();
        if (msg.includes('signal') || msg.includes('unexpected') || msg.includes('unknown')) {
           // If we are retrying a weird signal error, we MUST still respect a timeout, 
           // otherwise we risk hanging forever. We'll use a slightly shorter fallback timeout 
           // for this second-chance call to ensure we don't blow the budget.
           const fallbackController = new AbortController();
           const fallbackTimer = setTimeout(() => fallbackController.abort(), 10000);
           try {
             completion = await (groq.chat.completions.create as any)(payload, { signal: fallbackController.signal });
           } finally {
             clearTimeout(fallbackTimer);
           }
        } else {
          throw err;
        }
      }

      const content = completion?.choices?.[0]?.message?.content;
      return (content || '').trim();
    } catch (err: any) {
      lastErr = err;
      const shouldRetry = attempt < maxRetries && isRetryableError(err);
      if (!shouldRetry) throw err;

      const base = 900;
      const backoff = Math.min(12000, base * Math.pow(2, attempt));
      await sleep(jitter(backoff));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastErr;
}
