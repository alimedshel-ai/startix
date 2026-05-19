import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';
import { claudeConfigured, claudeStream, CLAUDE_MODEL, type ChatMessage } from '../lib/claude';

const MESSAGE_KEY_REGEX = /^(user|assistant)$/;

const advisorSchema = z.object({
  companyId: z.string().uuid(),
  history: z.array(
    z.object({
      role: z.string().refine((r) => MESSAGE_KEY_REGEX.test(r), 'role must be user|assistant'),
      content: z.string().min(1).max(8000),
    }),
  ).max(40),
  message: z.string().min(1).max(8000),
});

interface CompanyContext {
  name: string;
  sector: string | null;
  size: string;
  stage: string | null;
}

async function loadCompanyContext(companyId: string): Promise<{ ctx: CompanyContext; latestPath: string | null }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true, sector: true, size: true, stage: true },
  });
  if (!company) throw new HttpError(404, 'Company not found');
  const diagnostic = await prisma.diagnostic.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: { strategicPath: true },
  });
  return { ctx: company, latestPath: diagnostic?.strategicPath ?? null };
}

function buildAdvisorSystem(ctx: CompanyContext, path: string | null): string {
  return [
    'أنت مستشار استراتيجي عربي يساعد أصحاب الأعمال والمدراء السعوديين.',
    'استخدم لغة عربية مهنية واضحة، وأمثلة محلية حين تكون مناسبة.',
    'كن مختصراً ومباشراً، واطرح أسئلة توضيحية عند الحاجة.',
    'استند للسياق التالي عن الشركة:',
    `- الاسم: ${ctx.name}`,
    `- القطاع: ${ctx.sector ?? 'غير محدد'}`,
    `- الحجم: ${ctx.size}`,
    `- المرحلة: ${ctx.stage ?? 'غير محددة'}`,
    path ? `- المسار الاستراتيجي الموصى به: ${path}` : '- لم يجرَ التشخيص بعد.',
  ].join('\n');
}

// ─── POST /api/ai/advisor — streaming SSE ────────────────────────────────────
export const advisorChat: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'Not authenticated');
    if (!claudeConfigured()) {
      throw new HttpError(503, 'لم يُعدّ مفتاح Claude — أضف ANTHROPIC_API_KEY في server/.env');
    }
    const body = advisorSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);
    const system = buildAdvisorSystem(ctx, latestPath);

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const history: ChatMessage[] = body.history.map((m) => ({
      role: m.role as ChatMessage['role'],
      content: m.content,
    }));

    let aborted = false;
    req.on('close', () => { aborted = true });

    try {
      for await (const delta of claudeStream({ system, history, prompt: body.message, model: CLAUDE_MODEL })) {
        if (aborted) break;
        res.write(`data: ${JSON.stringify({ type: 'delta', text: delta })}\n\n`);
      }
      if (!aborted) res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    } catch (err) {
      const message = (err as Error).message ?? 'AI error';
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`);
    } finally {
      res.end();
    }
  } catch (err) {
    next(err);
  }
};

// Placeholders for the other endpoints — implemented in later batches
const placeholderSchema = z.object({ companyId: z.string().uuid() });

export const towsSuggestions: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: 'سيُنفّذ في الدفعة 2' });
};
export const generatePresentation: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: 'سيُنفّذ في الدفعة 2' });
};
export const painScreen: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: 'سيُنفّذ في الدفعة 2' });
};
export const getPredictions: RequestHandler = async (req, res, next) => {
  try {
    placeholderSchema.parse({ companyId: paramOf(req, 'companyId') });
    res.status(501).json({ error: 'سيُنفّذ في الدفعة 3' });
  } catch (err) {
    next(err);
  }
};
export const runSimulation: RequestHandler = async (_req, res) => {
  res.status(501).json({ error: 'سيُنفّذ في الدفعة 3' });
};
