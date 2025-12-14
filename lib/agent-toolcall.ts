export type ToolCall = {
  name: string;
  params: any;
};

function extractJson(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return {};

  const cleaned = trimmed
    .replace(/^```json/i, '')
    .replace(/^```/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON inválido');
    return JSON.parse(match[0]);
  }
}

export function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = [];
  if (!text) return calls;

  const regex = /\[TOOL:([a-zA-Z0-9_]+)\]([\s\S]*?)\[\/TOOL\]/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const name = m[1]?.trim();
    const rawParams = (m[2] ?? '').trim();
    if (!name) continue;

    let params: any = {};
    try {
      params = extractJson(rawParams);
    } catch {
      params = {};
    }

    calls.push({ name, params });
  }

  return calls;
}

export function stripToolBlocks(text: string) {
  return (text || '').replace(/\[TOOL:[a-zA-Z0-9_]+\][\s\S]*?\[\/TOOL\]/g, '').trim();
}
