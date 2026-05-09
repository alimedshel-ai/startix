import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

export function claude(): Anthropic {
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY must be set');
  }
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';

export async function claudeJSON<T = unknown>(args: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const res = await claude().messages.create({
    model: args.model ?? CLAUDE_MODEL,
    max_tokens: args.maxTokens ?? 2048,
    system: args.system,
    messages: [{ role: 'user', content: args.prompt }],
  });
  const text = res.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('Claude response did not contain JSON');
  return JSON.parse(match[0]) as T;
}
