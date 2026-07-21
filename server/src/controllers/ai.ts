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
import { TEMPLATES, type ModelType } from '../lib/assessmentTemplates';

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

// ═══════════════════════════════════════════════════════════════════════════
// C20 — توليد معايير تقييم مخصّصة للقطاع
// ═══════════════════════════════════════════════════════════════════════════
// يأخذ (companyId, modelType). يقرأ سياق الشركة + قالب النموذج، ثم يطلب من
// Claude اقتراح 2-3 معايير قطاعية لكل بُعد. الرد JSON يُحفظ لاحقاً عبر
// endpoints C18 (لا نكتب هنا في القاعدة — الوظيفة اقتراحية بحتة).
// خلف requirePlan('PROFESSIONAL'). يتحلل بأمان بلا مفتاح Claude (503 عربي).

const generateAssessmentSchema = z.object({
  companyId: z.string().uuid(),
  modelType: z.enum(['BSC', 'EFQM', 'PESTEL', 'PORTER', 'OKR']),
});

interface GeneratedDimension {
  name: string;
  criteria: { name: string; weight: number }[];
}

interface GeneratedAssessment {
  dimensions: GeneratedDimension[];
}

export const generateAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    ensureClaude();
    const body = generateAssessmentSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);
    const template = TEMPLATES[body.modelType as ModelType];

    // نصنع قائمة بأسماء الأبعاد (لن نمسّ أوزانها هنا — Claude يقترح المعايير فقط).
    const dimensionsList = template.dimensions
      .map((d, i) => `${i + 1}) ${d.name}`)
      .join('\n');

    const prompt = [
      `أنت مستشار تقييم مؤسسي. مهمتك اقتراح معايير قطاعية لتقييم "${template.displayName}".`,
      '',
      companyDescriptor(ctx, latestPath),
      '',
      'الأبعاد الثابتة للنموذج (لا تُغيّرها):',
      dimensionsList,
      '',
      'لكل بُعد اقترح من 2 إلى 3 معايير قطاعية عربية موجزة (سطر واحد لكل معيار).',
      'أعطِ كل معيار وزناً كنسبة داخل بُعده بحيث يكون مجموع أوزان معايير كل بُعد = 100.',
      'حاذِ المعايير مع القطاع والحجم والمرحلة أعلاه — لا تُكرّر أسماء عامّة.',
      '',
      'أعد JSON فقط بالشكل التالي حرفياً بدون شرح خارجي:',
      '{"dimensions":[{"name":"اسم البُعد","criteria":[{"name":"معيار","weight":50}]}]}',
      'رتّب الأبعاد بنفس الترتيب أعلاه.',
    ].join('\n');

    const result = await claudeJSON<GeneratedAssessment>({
      system: 'أرجع JSON خالص بدون أي نص خارجي. اللغة العربية مهنية.',
      prompt,
      maxTokens: 2000,
      model: CLAUDE_MODEL,
    });

    // Post-validation: تأكّد أن Claude أعاد نفس عدد الأبعاد وأسماءها.
    const suggestions: GeneratedDimension[] = [];
    for (const templateDim of template.dimensions) {
      const match = result.dimensions.find((d) => d.name.trim() === templateDim.name.trim());
      // إن غاب بُعد نُبقيه فارغاً — الواجهة تُظهر placeholder.
      suggestions.push(match ? { name: templateDim.name, criteria: match.criteria } : { name: templateDim.name, criteria: [] });
    }

    res.json({
      modelType: body.modelType,
      dimensions: template.dimensions.map((d, i) => ({
        name: d.name,
        weight: d.weight,
        order: d.order,
        criteria: suggestions[i]?.criteria ?? [],
      })),
    });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/ai/initiative-breakdown ───────────────────────────────────────
// يفكّك مبادرةً (قد تضمّ عدّة مواضيع مدمجة) إلى خطّة عمل ذكيّة: فهمها، حجمها،
// مكوّناتها، الأقسام والجهات المشاركة، الأدوات، التكلفة التقديريّة، والمهام
// الفرعيّة الملموسة (دفع/شراء/دعم/تكامل…). يساعد المدير على ترتيب أفكاره.

const initiativeBreakdownSchema = z.object({
  companyId: z.string().uuid(),
  title: z.string().min(3).max(500),
  description: z.string().max(2000).optional(),
});

interface InitiativeBreakdown {
  understanding: string;
  size: string;
  sizeReason: string;
  components: { title: string; dept: string; purpose: string }[];
  departments: string[];
  stakeholders: string[];
  tools: string[];
  estimatedCost: string;
  costNotes: string;
  subTasks: { title: string; component: string; kind: string; estimate: string }[];
  /** true حين يُبنى محليّاً بلا Claude (تقديريّ) — الواجهة تُظهر شارة. */
  heuristic?: boolean;
}

// ─── تحليل تقديريّ محليّ (بلا Claude) — يتحلّل بأمان عند غياب المفتاح ─────────
// يفكّك العنوان إلى مكوّنات، ويستنتج الأقسام/الجهات/الأدوات/التكلفة والمهامّ
// الفرعيّة (شراء/دفع/دعم/تكامل) من كلمات مفتاحيّة. أقلّ ذكاءً من Claude لكنّه
// يمنع الطريق المسدود ويعطي نقطة انطلاق حقيقيّة.
const HEURISTIC_DEPTS: { kw: string[]; dept: string }[] = [
  { kw: ['شراء', 'مشتريات', 'مورد', 'مورّد', 'توريد', 'عقد', 'عرض أسعار'], dept: 'المشتريات' },
  { kw: ['رواتب', 'مالي', 'ماليّ', 'دفع', 'بنك', 'تأمين', 'فاتورة', 'فوتر', 'محاسب', 'تكلفة', 'ميزاني'], dept: 'المالية' },
  { kw: ['توظيف', 'تعيين', 'موظف', 'موارد بشرية', 'تدريب', 'self-service', 'hr'], dept: 'الموارد البشرية' },
  { kw: ['نظام', 'رقمي', 'رقمنة', 'تقني', 'تقنية', 'برمج', 'تكامل', 'dashboard', 'منصّة', 'منصة', 'لوحة', 'software', 'erp', 'api', 'سيرفر', 'أمن'], dept: 'تقنية المعلومات' },
  { kw: ['تسويق', 'مبيعات', 'عميل', 'عملاء', 'حملة', 'علامة'], dept: 'التسويق والمبيعات' },
  { kw: ['عمليات', 'إنتاج', 'جودة', 'مخزون', 'لوجست', 'تشغيل'], dept: 'العمليات' },
];

function heuristicDeptFor(text: string): string {
  const t = text.toLowerCase();
  for (const e of HEURISTIC_DEPTS) if (e.kw.some((k) => t.includes(k))) return e.dept;
  return 'الإدارة العامة';
}

function splitComponents(title: string): string[] {
  // أزل الشارة والبادئة «…:» ثم قسّم على الفواصل الصريحة (+ ، ثم) دون «و» المتّصلة.
  const body = title.replace(/^🔧\s*/, '').replace(/^\[[^\]]+\]\s*/, '').replace(/^[^:：]{3,40}[:：]\s*/, '');
  return body
    .split(/\s*\+\s*|\s*،\s*|\s+ثم\s+|\s*;\s*/)
    .map((s) => s.trim().replace(/[.،]$/, ''))
    .filter((s) => s.length > 2)
    .slice(0, 8);
}

function buildHeuristicBreakdown(title: string, description?: string): InitiativeBreakdown {
  const full = `${title} ${description ?? ''}`.toLowerCase();
  const parts = splitComponents(title);
  const components = (parts.length ? parts : [title]).map((p) => ({
    title: p,
    dept: heuristicDeptFor(p),
    purpose: `تنفيذ «${p}» كجزء من المبادرة.`,
  }));
  const departments = Array.from(new Set(components.map((c) => c.dept)));

  const needs = (kws: string[]) => kws.some((k) => full.includes(k));
  const involvesSystem = needs(['نظام', 'رقمي', 'تقني', 'تكامل', 'dashboard', 'منصّة', 'منصة', 'برمج', 'erp', 'api', 'self-service']);
  const involvesBuy = needs(['شراء', 'مشتريات', 'مورد', 'مورّد', 'توريد', 'عقد', 'ترخيص', 'اشتراك']);
  const involvesPay = needs(['دفع', 'رواتب', 'بنك', 'فاتورة', 'فوتر', 'تكلفة', 'اشتراك', 'مالي']);
  const involvesHR = needs(['توظيف', 'تعيين', 'تدريب', 'موظف', 'موارد بشرية']);

  const stakeholders = new Set<string>(['إدارة العميل']);
  if (involvesBuy || involvesSystem) { stakeholders.add('المشتريات'); stakeholders.add('مورّد/مزوّد النظام'); }
  if (involvesPay) { stakeholders.add('الإدارة المالية'); stakeholders.add('البنك'); }
  if (full.includes('تأمين')) stakeholders.add('التأمينات الاجتماعية (GOSI)');
  if (involvesHR) stakeholders.add('الموارد البشرية');
  if (involvesSystem) stakeholders.add('الدعم الفنّي/تقنية المعلومات');

  const tools = new Set<string>();
  if (involvesSystem) { tools.add('نظام/منصّة مناسبة (SaaS أو داخليّة)'); tools.add('واجهة تكامل (API)'); }
  if (full.includes('dashboard') || full.includes('لوحة')) tools.add('لوحة مؤشّرات (Dashboard)');
  if (involvesPay || full.includes('رواتب')) tools.add('نظام رواتب/مالي');
  if (involvesBuy) tools.add('نموذج طلب شراء + مقارنة عروض');
  if (!tools.size) tools.add('أدوات مكتبيّة (Excel/Sheets) + قالب متابعة');

  const n = components.length;
  const size = n >= 4 ? 'كبيرة' : n >= 2 ? 'متوسطة' : 'صغيرة';
  const estimatedCost = n >= 4 ? '150,000–400,000 ريال' : n >= 2 ? '40,000–150,000 ريال' : '5,000–40,000 ريال';

  const subTasks: InitiativeBreakdown['subTasks'] = [];
  // مهمّة تنفيذ ملموسة لكل مكوّن.
  for (const c of components) {
    subTasks.push({ title: `حدّد متطلّبات «${c.title}» ونطاق تسليمه`, component: c.title, kind: 'تنفيذ', estimate: 'يوم' });
  }
  // مهامّ عابرة للمكوّنات — الشراء/الدفع/الدعم التي سأل عنها المستخدم صراحةً.
  if (involvesBuy || involvesSystem) {
    subTasks.push({ title: 'اطلب عروض أسعار من ٣ مورّدين وقارنها', component: 'مشترك', kind: 'شراء', estimate: 'يومان' });
    subTasks.push({ title: 'ارفع طلب شراء واعتمد المورّد', component: 'مشترك', kind: 'موافقة', estimate: 'يوم' });
  }
  if (involvesPay) {
    subTasks.push({ title: 'جهّز الدفعة الأولى ونفّذ الدفع للمورّد', component: 'مشترك', kind: 'دفع', estimate: 'نصف يوم' });
  }
  if (involvesSystem) {
    subTasks.push({ title: 'اطلب دعم التكامل والربط مع الأنظمة القائمة', component: 'مشترك', kind: 'تكامل', estimate: '٣ أيام' });
    subTasks.push({ title: 'نفّذ تشغيلاً تجريبيّاً ثم درّب المستخدمين', component: 'مشترك', kind: 'تدريب', estimate: 'يومان' });
  }
  subTasks.push({ title: 'عرّف مسؤول التشغيل والدعم بعد الإطلاق', component: 'مشترك', kind: 'دعم', estimate: 'ساعة' });

  return {
    understanding: `المبادرة تضمّ ${n} ${n === 1 ? 'مكوّناً' : 'مكوّنات'} رئيسيّة تشارك فيها ${departments.length} ${departments.length === 1 ? 'إدارة' : 'إدارات'}. الخطة أدناه تقديريّة لترتيب التنفيذ.`,
    size,
    sizeReason: `اشتُقّ الحجم من عدد المكوّنات (${n}) والجهات المشاركة (${stakeholders.size}).`,
    components,
    departments,
    stakeholders: Array.from(stakeholders),
    tools: Array.from(tools),
    estimatedCost,
    costNotes: 'تقدير مبدئيّ يعتمد على حجم المبادرة — يُراجَع بعد عروض الأسعار.',
    subTasks,
    heuristic: true,
  };
}

export const initiativeBreakdown: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = initiativeBreakdownSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    // بلا مفتاح Claude → تحليل تقديريّ محليّ (لا طريق مسدود).
    if (!claudeConfigured()) {
      res.json(buildHeuristicBreakdown(body.title, body.description));
      return;
    }

    const { ctx, latestPath } = await loadCompanyContext(body.companyId);

    const prompt = [
      'أنت مستشار تنفيذي خبير. أمامك «مبادرة» قد تضمّ عدّة مواضيع مدمجة في جملة واحدة.',
      'مهمّتك تفكيكها إلى خطّة عمل ذكيّة تساعد المدير على ترتيب أفكاره وفهم ما يلزم لإنجاحها.',
      '',
      companyDescriptor(ctx, latestPath),
      '',
      `عنوان المبادرة: ${body.title}`,
      body.description ? `تفاصيل إضافيّة: ${body.description}` : '',
      '',
      'حلّلها وأعِد النتائج التالية بواقعيّة للسوق السعودي:',
      '1) understanding: فهم المبادرة في جملتين واضحتين.',
      '2) size + sizeReason: الحجم (صغيرة | متوسطة | كبيرة) وسبب مختصر.',
      '3) components: المواضيع/المكوّنات المستقلّة داخلها (فكّك المبادرة المركّبة) — لكلٍّ: title، dept (القسم المسؤول)، purpose (الغرض).',
      '4) departments: الأقسام التي ستشارك في التنفيذ.',
      '5) stakeholders: الجهات المساعِدة داخليّة وخارجيّة (المالية، المشتريات، مورّد، بنك، جهة حكوميّة، مزوّد نظام…).',
      '6) tools: الأدوات/الأنظمة المطلوبة لنجاح المبادرة.',
      '7) estimatedCost + costNotes: نطاق تكلفة تقديريّ بالريال السعودي + ملاحظة موجزة عن أساس التقدير.',
      '8) subTasks: مهام فرعيّة ملموسة تُفتَح لتنفيذها. غطِّ صراحةً — عند الحاجة — مهامّ الدفع، الشراء/طلبات الشراء، والدعم/التكامل. لكل مهمّة: title (فعل مباشر)، component (لأيّ مكوّن تتبع)، kind (تنفيذ|شراء|دفع|دعم|تدريب|تكامل|موافقة)، estimate (وقت متوقّع).',
      '',
      'أعِد JSON فقط بهذا الشكل تماماً بلا أيّ نصّ خارجي:',
      '{"understanding":"...","size":"...","sizeReason":"...","components":[{"title":"...","dept":"...","purpose":"..."}],"departments":["..."],"stakeholders":["..."],"tools":["..."],"estimatedCost":"...","costNotes":"...","subTasks":[{"title":"...","component":"...","kind":"...","estimate":"..."}]}',
    ].filter(Boolean).join('\n');

    try {
      const result = await claudeJSON<InitiativeBreakdown>({
        system: 'أرجع JSON خالصاً بالعربية بلا نصّ خارجي. كن واقعيّاً ومحدّداً. المهامّ الفرعيّة مباشرة قابلة للتنفيذ فوراً.',
        prompt,
        maxTokens: 2800,
      });
      res.json(result);
    } catch {
      // تعذّر Claude (خطأ/تجاوز حصّة) → نتحلّل للتحليل التقديري بدل الفشل.
      res.json(buildHeuristicBreakdown(body.title, body.description));
    }
  } catch (err) {
    next(err);
  }
};
