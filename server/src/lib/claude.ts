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

export function claudeConfigured(): boolean {
  return Boolean(apiKey);
}

/** Default model for richer strategy work. */
export const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
/** Fast model for short, conversational tasks (Smart Guide, simple suggestions). */
export const CLAUDE_FAST_MODEL = process.env.CLAUDE_FAST_MODEL ?? 'claude-haiku-4-5-20251001';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Build a Claude `messages` array from a chat history. */
export function toMessages(history: ChatMessage[]): Anthropic.MessageParam[] {
  return history.map((m) => ({ role: m.role, content: m.content }));
}

/**
 * One-shot text completion. Returns the raw text.
 */
export async function claudeText(args: {
  system?: string;
  prompt: string;
  history?: ChatMessage[];
  maxTokens?: number;
  model?: string;
}): Promise<string> {
  const messages: Anthropic.MessageParam[] = args.history ? toMessages(args.history) : [];
  messages.push({ role: 'user', content: args.prompt });
  const res = await claude().messages.create({
    model: args.model ?? CLAUDE_MODEL,
    max_tokens: args.maxTokens ?? 2048,
    system: args.system,
    messages,
  });
  return res.content
    .filter((c): c is Anthropic.TextBlock => c.type === 'text')
    .map((c) => c.text)
    .join('');
}

/**
 * Parse-and-return JSON inside a Claude response. The model is instructed
 * (via system) to return JSON only; we tolerate prose around it.
 */
export async function claudeJSON<T = unknown>(args: {
  system?: string;
  prompt: string;
  maxTokens?: number;
  model?: string;
}): Promise<T> {
  const text = await claudeText({ ...args });
  // Find the first balanced JSON object / array in the text
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) throw new Error('Claude response did not contain JSON');
  return JSON.parse(match[0]) as T;
}

/**
 * Streaming completion. Yields text deltas as they arrive.
 * Caller is responsible for piping to Express SSE / fetch ReadableStream.
 */
export async function* claudeStream(args: {
  system?: string;
  history?: ChatMessage[];
  prompt: string;
  maxTokens?: number;
  model?: string;
}): AsyncGenerator<string, void, void> {
  const messages: Anthropic.MessageParam[] = args.history ? toMessages(args.history) : [];
  messages.push({ role: 'user', content: args.prompt });

  const stream = claude().messages.stream({
    model: args.model ?? CLAUDE_MODEL,
    max_tokens: args.maxTokens ?? 2048,
    system: args.system,
    messages,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      yield event.delta.text;
    }
  }
}
