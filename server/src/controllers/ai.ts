import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';
import {
  claudeConfigured,
  claudeJSON,
  claudeStream,
  claudeText,
  CLAUDE_FAST_MODEL,
  CLAUDE_MODEL,
  type ChatMessage,
} from '../lib/claude';

// ─── Shared helpers ─────────────────────────────────────────────────────────

interface CompanyContext {
  id: string;
  name: string;
  sector: string | null;
  size: string;
  stage: string | null;
}

async function loadCompanyContext(companyId: string): Promise<{ ctx: CompanyContext; latestPath: string | null }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { id: true, name: true, sector: true, size: true, stage: true },
  });
  if (!company) throw new HttpError(404, 'الشركة غير موجودة');
  const diagnostic = await prisma.diagnostic.findFirst({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    select: { strategicPath: true },
  });
  return { ctx: company, latestPath: diagnostic?.strategicPath ?? null };
}

function companyDescriptor(ctx: CompanyContext, path: string | null): string {
  return [
    `الشركة: ${ctx.name}`,
    `القطاع: ${ctx.sector ?? 'غير محدد'}`,
    `الحجم: ${ctx.size}`,
    `المرحلة: ${ctx.stage ?? 'غير محددة'}`,
    `المسار الاستراتيجي: ${path ?? 'لم يجرَ التشخيص بعد'}`,
  ].join('\n');
}

function ensureClaude(): void {
  if (!claudeConfigured()) {
    throw new HttpError(503, 'لم يُعدّ مفتاح Claude — أضف ANTHROPIC_API_KEY في server/.env');
  }
}

// ─── POST /api/ai/advisor — streaming SSE ────────────────────────────────────

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

function advisorSystem(ctx: CompanyContext, path: string | null): string {
  return [
    'أنت مستشار استراتيجي عربي يساعد أصحاب الأعمال والمدراء السعوديين.',
    'استخدم لغة عربية مهنية واضحة، وأمثلة محلية حين تكون مناسبة.',
    'كن مختصراً ومباشراً، واطرح أسئلة توضيحية عند الحاجة.',
    'سياق الشركة:',
    companyDescriptor(ctx, path),
  ].join('\n');
}

export const advisorChat: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureClaude();
    const body = advisorSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);
    const system = advisorSystem(ctx, latestPath);

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

// ─── POST /api/ai/tows-suggestions ──────────────────────────────────────────

const towsBodySchema = z.object({
  companyId: z.string().uuid(),
  swot: z.object({
    strengths:     z.array(z.string()).optional(),
    weaknesses:    z.array(z.string()).optional(),
    opportunities: z.array(z.string()).optional(),
    threats:       z.array(z.string()).optional(),
  }).optional(),
});

interface TOWSResult {
  so: string[];
  wo: string[];
  st: string[];
  wt: string[];
}

export const towsSuggestions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureClaude();
    const body = towsBodySchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    let swot = body.swot;
    if (!swot || (!swot.strengths?.length && !swot.weaknesses?.length && !swot.opportunities?.length && !swot.threats?.length)) {
      const stored = await prisma.sWOT.findFirst({ where: { companyId: body.companyId }, orderBy: { updatedAt: 'desc' } });
      if (!stored) throw new HttpError(409, 'لا يوجد تحليل SWOT — أنشئ واحداً قبل توليد TOWS');
      swot = {
        strengths:     stored.strengths     as unknown as string[],
        weaknesses:    stored.weaknesses    as unknown as string[],
        opportunities: stored.opportunities as unknown as string[],
        threats:       stored.threats       as unknown as string[],
      };
    }

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);

    const prompt = [
      'أنت مستشار استراتيجي. مهمتك توليد مصفوفة TOWS (8-12 استراتيجية إجمالاً) من تحليل SWOT التالي.',
      '',
      companyDescriptor(ctx, latestPath),
      '',
      'تحليل SWOT:',
      `- نقاط القوة: ${(swot.strengths ?? []).join('، ') || '—'}`,
      `- نقاط الضعف: ${(swot.weaknesses ?? []).join('، ') || '—'}`,
      `- الفرص: ${(swot.opportunities ?? []).join('، ') || '—'}`,
      `- التهديدات: ${(swot.threats ?? []).join('، ') || '—'}`,
      '',
      'أنشئ 2-3 استراتيجيات لكل ربع من الأرباع الأربعة:',
      '- SO: استخدام نقاط القوة لاقتناص الفرص',
      '- WO: معالجة نقاط الضعف لاقتناص الفرص',
      '- ST: استخدام نقاط القوة لمواجهة التهديدات',
      '- WT: معالجة نقاط الضعف لتفادي التهديدات',
      '',
      'أعد JSON فقط بهذا الشكل تماماً (بدون شرح خارجي):',
      '{"so":["..."],"wo":["..."],"st":["..."],"wt":["..."]}',
    ].join('\n');

    const result = await claudeJSON<TOWSResult>({
      system: 'أرجع JSON خالص بدون نص خارجي. كل عنصر استراتيجية بالعربية، جملة واحدة تنفيذية واضحة.',
      prompt,
      maxTokens: 1500,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ai/presentation ──────────────────────────────────────────────

const presentationSchema = z.object({
  companyId: z.string().uuid(),
});

interface PresentationResult {
  title: string;
  slides: { title: string; bullets: string[] }[];
}

export const generatePresentation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureClaude();
    const body = presentationSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);

    const [diagnostic, swot, objectives, depts] = await Promise.all([
      prisma.diagnostic.findFirst({ where: { companyId: body.companyId }, orderBy: { createdAt: 'desc' } }),
      prisma.sWOT.findFirst({ where: { companyId: body.companyId }, orderBy: { updatedAt: 'desc' } }),
      prisma.objective.findMany({ where: { companyId: body.companyId }, take: 5 }),
      prisma.department.findMany({ where: { companyId: body.companyId } }),
    ]);

    const snapshot = {
      maturityScore: diagnostic?.maturityScore ?? null,
      weaknesses: (diagnostic?.weaknesses as unknown as { label: string; pct: number }[] | null)?.slice(0, 3) ?? [],
      strengths: (swot?.strengths as unknown as string[] | null)?.slice(0, 5) ?? [],
      objectives: objectives.map((o) => o.title),
      auditedDepts: depts.filter((d) => d.auditScore != null).length,
      totalDepts: depts.length,
    };

    const prompt = [
      'أنشئ محتوى عرض تقديمي احترافي للجهات المعنية (٧ شرائح) باللغة العربية.',
      '',
      companyDescriptor(ctx, latestPath),
      '',
      'لقطة الشركة:',
      JSON.stringify(snapshot, null, 2),
      '',
      'الشرائح المطلوبة:',
      '1. عنوان الشركة + الرؤية المختصرة',
      '2. الوضع الاستراتيجي الحالي (المسار، النضج)',
      '3. أبرز نقاط القوة',
      '4. أبرز التحديات / نقاط الضعف',
      '5. الأهداف الاستراتيجية المختارة',
      '6. خطة التنفيذ في ٩٠ يوم القادمة',
      '7. ما المطلوب من الجهات المعنية',
      '',
      'أعد JSON خالص بهذا الشكل:',
      '{"title":"...","slides":[{"title":"...","bullets":["..."]}]}',
      'كل شريحة تحتوي 3-5 bullets موجزة.',
    ].join('\n');

    const result = await claudeJSON<PresentationResult>({
      system: 'أرجع JSON خالص بدون أي نص خارجي. اللغة عربية مهنية.',
      prompt,
      maxTokens: 2200,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ai/pain-screen ───────────────────────────────────────────────

const painScreenSchema = z.object({
  companyId: z.string().uuid(),
  answers: z.array(z.object({
    question: z.string().min(1).max(300),
    answer: z.string().min(1).max(1000),
  })).min(1).max(20),
});

interface PainResult {
  pains: {
    title: string;
    severity: number; // 1-5
    rootCause?: string;
    recommendedTools: { label: string; to: string }[];
  }[];
}

const ROUTE_HINTS: { label: string; to: string }[] = [
  { label: 'تحليل الفجوة',         to: '/gap-analysis' },
  { label: 'تحليل SWOT',           to: '/swot' },
  { label: 'الأهداف الاستراتيجية',  to: '/objectives' },
  { label: 'مؤشرات الأداء',         to: '/kpis' },
  { label: 'تدقيق المالية',         to: '/manager/finance/audit' },
  { label: 'تدقيق المبيعات',        to: '/manager/sales/audit' },
  { label: 'تدقيق التسويق',         to: '/manager/marketing/audit' },
  { label: 'تدقيق العمليات',        to: '/manager/operations/audit' },
  { label: 'تدقيق الموارد البشرية', to: '/manager/hr/audit' },
  { label: 'تدقيق الامتثال',        to: '/manager/compliance/audit' },
  { label: 'فجوة الطموح',           to: '/ambition-gap' },
  { label: 'خريطة المخاطر',         to: '/risk-map' },
];

export const painScreen: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureClaude();
    const body = painScreenSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);

    const prompt = [
      'أنت محلل أعمال. حلل إجابات المستخدم وحدد أهم ٣ نقاط ألم في الشركة.',
      '',
      companyDescriptor(ctx, latestPath),
      '',
      'الإجابات:',
      ...body.answers.map((a, i) => `${i + 1}. س: ${a.question}\n   ج: ${a.answer}`),
      '',
      'الأدوات المتاحة في المنصة (اقتبس "label" و"to" منها فقط):',
      JSON.stringify(ROUTE_HINTS),
      '',
      'أعد JSON خالص بهذا الشكل:',
      '{"pains":[{"title":"...","severity":1..5,"rootCause":"...","recommendedTools":[{"label":"...","to":"/..."}]}]}',
      'حدد بالضبط ٣ نقاط ألم. لكل واحدة 1-3 أدوات موصى بها.',
    ].join('\n');

    const result = await claudeJSON<PainResult>({
      system: 'أرجع JSON خالص بدون أي نص خارجي. اللغة عربية واضحة.',
      prompt,
      maxTokens: 1500,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ai/smart-guide — short next-action hint ──────────────────────

const smartGuideSchema = z.object({
  companyId: z.string().uuid(),
  path: z.string().min(1).max(120),
});

export const smartGuide: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    if (!claudeConfigured()) {
      res.json({ suggestion: null, configured: false });
      return;
    }
    const body = smartGuideSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);
    const prompt = [
      `صفحة الواجهة الحالية: ${body.path}`,
      companyDescriptor(ctx, latestPath),
      '',
      'بناءً على الصفحة وسياق الشركة، اقترح خطوة عملية واحدة بسيطة (1-2 جملة بالعربية) يجب على المستخدم القيام بها الآن.',
      'لا تستعمل قوائم أو تنسيقاً. جملة واحدة قصيرة فقط.',
    ].join('\n');

    const suggestion = await claudeText({
      system: 'أنت مرشد ذكي مختصر. اللغة عربية واضحة. جملة واحدة.',
      prompt,
      maxTokens: 220,
      model: CLAUDE_FAST_MODEL,
    });

    res.json({ suggestion: suggestion.trim(), configured: true });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/ai/predictions/:companyId — 90-day forecast per KPI ───────────

interface SeriesPoint { date: string; value: number }
interface ForecastSeries {
  kpiId: string;
  name: string;
  unit: string;
  target: number;
  history: SeriesPoint[];
  forecast: SeriesPoint[];
  slopePerDay: number;
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number } {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0 };
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

export const getPredictions: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = z.string().uuid().parse(paramOf(req, 'companyId'));
    await assertCompanyAccess(req.auth.sub, companyId);

    const kpis = await prisma.kPI.findMany({
      where: { companyId },
      include: { entries: { orderBy: { enteredAt: 'asc' } } },
    });

    const series: ForecastSeries[] = kpis.map((k) => {
      const entries = k.entries;
      if (entries.length < 2) {
        // Not enough data to forecast — synthesize flat line from currentValue
        const today = new Date();
        const history: SeriesPoint[] = entries.map((e) => ({
          date: e.enteredAt.toISOString(),
          value: e.value,
        }));
        const forecast: SeriesPoint[] = [30, 60, 90].map((d) => ({
          date: new Date(today.getTime() + d * 86400000).toISOString(),
          value: k.currentValue,
        }));
        return { kpiId: k.id, name: k.name, unit: k.unit, target: k.targetValue, history, forecast, slopePerDay: 0 };
      }
      const first = entries[0].enteredAt.getTime();
      const last = entries[entries.length - 1].enteredAt.getTime();
      const spanDays = (last - first) / 86400000;
      const today = new Date();
      const lastValue = entries[entries.length - 1].value;

      // Need at least 7 days of span to compute a meaningful daily slope.
      // Otherwise project a flat line at the latest value.
      let slope = 0;
      let intercept = lastValue;
      if (spanDays >= 7) {
        const points = entries.map((e) => ({
          x: (e.enteredAt.getTime() - first) / 86400000,
          y: e.value,
        }));
        const lr = linearRegression(points);
        slope = lr.slope;
        intercept = lr.intercept;
        // Clamp daily slope to ≤ 50% of the latest value per 30 days
        // (prevents runaway forecasts on noisy short series).
        const maxMonthlySwing = Math.max(1, Math.abs(lastValue) * 0.5);
        const maxDailySlope = maxMonthlySwing / 30;
        if (slope > maxDailySlope) slope = maxDailySlope;
        if (slope < -maxDailySlope) slope = -maxDailySlope;
      }

      const forecast: SeriesPoint[] = [30, 60, 90].map((d) => {
        const x = spanDays + d;
        const projected = spanDays >= 7 ? intercept + slope * x : lastValue;
        return {
          date: new Date(today.getTime() + d * 86400000).toISOString(),
          value: Math.max(0, projected),
        };
      });
      return {
        kpiId: k.id,
        name: k.name,
        unit: k.unit,
        target: k.targetValue,
        history: entries.map((e) => ({ date: e.enteredAt.toISOString(), value: e.value })),
        forecast,
        slopePerDay: slope,
      };
    });

    let narrative: string | null = null;
    if (claudeConfigured() && series.length > 0) {
      try {
        const { ctx, latestPath } = await loadCompanyContext(companyId);
        const summary = series.map((s) => {
          const last = s.history[s.history.length - 1]?.value ?? null;
          const ninetyDay = s.forecast[s.forecast.length - 1]?.value ?? null;
          const onTrack = last !== null && ninetyDay !== null && ninetyDay >= s.target;
          return `- ${s.name}: حالي ${last ?? '—'} ${s.unit}، توقّع 90 يوم ${ninetyDay?.toFixed(1) ?? '—'}، هدف ${s.target}، ${onTrack ? 'في المسار' : 'ليس في المسار'}`;
        }).join('\n');
        narrative = await claudeText({
          system: 'أنت محلل بيانات. اللغة عربية واضحة. لا تستعمل قوائم؛ فقرة قصيرة فقط (3-5 جمل).',
          prompt: `${companyDescriptor(ctx, latestPath)}\n\nتوقعات ٩٠ يوم للمؤشرات:\n${summary}\n\nاكتب فقرة تلخّص: ما المؤشرات الأكثر إيجابية، الأكثر خطورة، وما الإجراء العاجل المقترح. فقرة واحدة بدون قوائم.`,
          maxTokens: 500,
          model: CLAUDE_FAST_MODEL,
        });
      } catch {
        narrative = null;
      }
    }

    res.json({ series, narrative });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ai/simulate — what-if math + optional Claude narrative ───────

const simulateSchema = z.object({
  companyId: z.string().uuid(),
  revenueGrowthPct: z.number().min(-100).max(500),
  costReductionPct: z.number().min(-100).max(100),
  baseRevenue: z.number().min(0),
  baseCost: z.number().min(0),
  investment: z.number().min(0),
});

export const runSimulation: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = simulateSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const projectedRevenue = body.baseRevenue * (1 + body.revenueGrowthPct / 100);
    const projectedCost = body.baseCost * (1 - body.costReductionPct / 100);
    const currentProfit = body.baseRevenue - body.baseCost;
    const projectedProfit = projectedRevenue - projectedCost;
    const netBenefit = projectedProfit - currentProfit;
    const roi = body.investment > 0 ? netBenefit / body.investment : 0;
    const paybackMonths = netBenefit > 0 ? body.investment / (netBenefit / 12) : Number.POSITIVE_INFINITY;

    let narrative: string | undefined;
    if (claudeConfigured()) {
      try {
        const { ctx, latestPath } = await loadCompanyContext(body.companyId);
        narrative = await claudeText({
          system: 'أنت مستشار مالي. اللغة عربية. لا تستعمل قوائم. 2-3 جمل قصيرة فقط.',
          prompt: [
            companyDescriptor(ctx, latestPath),
            '',
            'سيناريو محاكاة:',
            `- الإيراد الحالي: ${body.baseRevenue.toLocaleString('en-US')} SAR`,
            `- التكلفة الحالية: ${body.baseCost.toLocaleString('en-US')} SAR`,
            `- نمو الإيراد المفترض: ${body.revenueGrowthPct}%`,
            `- تخفيض التكلفة المفترض: ${body.costReductionPct}%`,
            `- الاستثمار المطلوب: ${body.investment.toLocaleString('en-US')} SAR`,
            '',
            'النتائج:',
            `- إيراد متوقع: ${projectedRevenue.toFixed(0)}`,
            `- تكلفة متوقعة: ${projectedCost.toFixed(0)}`,
            `- صافي الفائدة: ${netBenefit.toFixed(0)}`,
            `- العائد على الاستثمار: ${(roi * 100).toFixed(1)}%`,
            `- الاسترداد: ${Number.isFinite(paybackMonths) ? `${paybackMonths.toFixed(1)} شهر` : 'غير قابل للاسترداد'}`,
            '',
            'اكتب 2-3 جمل بالعربية تقيّم جدوى السيناريو وتقترح المخاطر / الفرصة.',
          ].join('\n'),
          maxTokens: 350,
          model: CLAUDE_FAST_MODEL,
        });
      } catch {
        narrative = undefined;
      }
    }

    res.json({
      projectedRevenue,
      projectedCost,
      netBenefit,
      roi,
      paybackMonths: Number.isFinite(paybackMonths) ? paybackMonths : null,
      narrative,
    });
  } catch (err) {
    next(err);
  }
};
