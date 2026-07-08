import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';

// ─── C12 — نقطة التعادل ─────────────────────────────────────────────────────
// endpoints:
//   POST /api/finance/break-even              — يحسب ويخزّن
//   GET  /api/finance/break-even/:companyId/latest
//   GET  /api/finance/break-even/:companyId/history
//
// المصدر الوحيد للحقيقة = القاعدة. المدخلات المخزَّنة + المخرجات المحسوبة كلها
// في جدول BreakEven، ولا اعتماد على أي localStorage على الكلاينت.

const breakEvenSchema = z.object({
  companyId: z.string().uuid(),
  fixedCosts: z.number().nonnegative().finite(),
  variableCostPerUnit: z.number().nonnegative().finite(),
  pricePerUnit: z.number().nonnegative().finite(),
  // إن وُجد يُحسب `safetyMargin`؛ إن غاب نتخطّاه بلطف.
  currentRevenue: z.number().nonnegative().finite().optional(),
});

type Severity = 'GOOD' | 'WARNING' | 'CRITICAL';

interface Insight {
  severity: Severity;
  message: string;
  action?: string;
}

interface BreakEvenResult {
  contributionMargin: number;
  contributionMarginPct: number | null;
  breakEvenUnits: number | null;
  breakEvenRevenue: number | null;
  safetyMarginPct: number | null;
  headline: string;
  insights: Insight[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// منطق الحساب المرجعي (من أساسات نقطة التعادل — انظر ملحق الخطة C12):
//   contributionMargin    = pricePerUnit − variableCostPerUnit
//   breakEvenUnits        = fixedCosts / contributionMargin
//   contributionMarginPct = (contributionMargin / pricePerUnit) × 100
//   safetyMargin%         = ((currentRevenue − breakEvenRevenue) / currentRevenue) × 100
function calculate(
  fixedCosts: number,
  variableCostPerUnit: number,
  pricePerUnit: number,
  currentRevenue?: number
): BreakEvenResult {
  const cm = pricePerUnit - variableCostPerUnit;
  const cmPct = pricePerUnit > 0 ? (cm / pricePerUnit) * 100 : null;

  const beUnits = cm > 0 ? Math.ceil(fixedCosts / cm) : null;
  const beRevenue = beUnits !== null ? beUnits * pricePerUnit : null;

  let safetyPct: number | null = null;
  if (currentRevenue !== undefined && currentRevenue > 0 && beRevenue !== null) {
    safetyPct = ((currentRevenue - beRevenue) / currentRevenue) * 100;
  }

  const insights: Insight[] = [];
  if (cm <= 0) {
    insights.push({
      severity: 'CRITICAL',
      message: 'هامش المساهمة سالب أو صفري — كل وحدة تُباع تُكبّد خسارة.',
      action: 'ارفع السعر أو خفّض التكلفة المتغيّرة قبل التوسّع.',
    });
  }
  if (safetyPct !== null) {
    if (safetyPct < 0) {
      insights.push({
        severity: 'CRITICAL',
        message: 'تحت نقطة التعادل — الشركة تخسر بالحجم الحالي.',
        action: 'رفع الإيراد أو خفض التكاليف الثابتة فوراً.',
      });
    } else if (safetyPct < 15) {
      insights.push({
        severity: 'WARNING',
        message: 'هامش أمان منخفض — أقل من 15% فوق نقطة التعادل.',
        action: 'تنويع مصادر الإيراد وبناء احتياطي نقدي.',
      });
    } else {
      insights.push({
        severity: 'GOOD',
        message: 'وضع مستقر، مساحة للنموّ فوق نقطة التعادل.',
      });
    }
  }

  const headline = beUnits !== null
    ? `نقطة التعادل = ${beUnits.toLocaleString('ar-SA')} وحدة سنوياً`
    : 'نقطة التعادل غير قابلة للحساب — سعر الوحدة يجب أن يتجاوز التكلفة المتغيّرة.';

  return {
    contributionMargin: round2(cm),
    contributionMarginPct: cmPct === null ? null : round2(cmPct),
    breakEvenUnits: beUnits,
    breakEvenRevenue: beRevenue === null ? null : round2(beRevenue),
    safetyMarginPct: safetyPct === null ? null : round2(safetyPct),
    headline,
    insights,
  };
}

// ─── POST /api/finance/break-even ──────────────────────────────────────────
export const createBreakEven: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = breakEvenSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const result = calculate(
      body.fixedCosts,
      body.variableCostPerUnit,
      body.pricePerUnit,
      body.currentRevenue
    );

    const row = await prisma.breakEven.create({
      data: {
        companyId: body.companyId,
        fixedCosts: body.fixedCosts,
        variableCostPerUnit: body.variableCostPerUnit,
        pricePerUnit: body.pricePerUnit,
        currentRevenue: body.currentRevenue ?? null,
        result: result as unknown as object,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/finance/break-even/:companyId/latest ─────────────────────────
export const getLatestBreakEven: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const latest = await prisma.breakEven.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ breakEven: latest });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/finance/break-even/:companyId/history ────────────────────────
export const getBreakEvenHistory: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.breakEven.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// C13 — تحليل Dupont
// ═══════════════════════════════════════════════════════════════════════════
// ROE = netMargin × assetTurnover × equityMultiplier
//   netMargin        = صافي الربح / الإيراد
//   assetTurnover    = الإيراد / إجمالي الأصول
//   equityMultiplier = إجمالي الأصول / حقوق الملكية
// نستقبل الأرقام الخام ونستنبط العوامل الثلاثة داخل السيرفر (مصدر واحد للحقيقة).

const dupontSchema = z.object({
  companyId: z.string().uuid(),
  netIncome: z.number().finite(),
  revenue: z.number().positive().finite(),
  totalAssets: z.number().positive().finite(),
  equity: z.number().positive().finite(),
});

// ─── POST /api/finance/dupont ──────────────────────────────────────────────
export const createDupont: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = dupontSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const netMargin = body.netIncome / body.revenue;
    const assetTurnover = body.revenue / body.totalAssets;
    const equityMultiplier = body.totalAssets / body.equity;
    const roe = netMargin * assetTurnover * equityMultiplier;

    const row = await prisma.dupontAnalysis.create({
      data: {
        companyId: body.companyId,
        netMargin: round4(netMargin),
        assetTurnover: round4(assetTurnover),
        equityMultiplier: round4(equityMultiplier),
        roe: round4(roe),
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/finance/dupont/:companyId/latest ─────────────────────────────
export const getLatestDupont: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const latest = await prisma.dupontAnalysis.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ dupont: latest });
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// C13 — محاكاة Monte Carlo
// ═══════════════════════════════════════════════════════════════════════════
// نموذج ربح مبسّط لكن مفيد للتوقّعات:
//   profit_i = revenue_i × (1 − variableCostPct_i) − fixedCosts_i
// كل متغيّر من الثلاثة يتبع توزيعاً مثلثياً { min, likely, max }.
// النتائج: المتوسط + p10/p50/p90 + احتمالية الخسارة (profit < 0).

const triangularVar = z.object({
  min: z.number().finite(),
  likely: z.number().finite(),
  max: z.number().finite(),
});

const monteCarloSchema = z.object({
  companyId: z.string().uuid(),
  revenue: triangularVar,
  variableCostPct: triangularVar,
  fixedCosts: triangularVar,
  iterations: z.number().int().min(100).max(50_000).default(10_000),
});

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// عيّنة من توزيع مثلثي (a=min, c=likely, b=max).
// المرجع: CDF-inverse — يضمن انحياز التوزيع نحو likely بدقّة.
function sampleTriangular(min: number, likely: number, max: number): number {
  if (!(min < max)) return likely;
  const clampedLikely = Math.min(Math.max(likely, min), max);
  const u = Math.random();
  const fc = (clampedLikely - min) / (max - min);
  if (u < fc) return min + Math.sqrt(u * (max - min) * (clampedLikely - min));
  return max - Math.sqrt((1 - u) * (max - min) * (max - clampedLikely));
}

function validateTriangular(name: string, v: { min: number; likely: number; max: number }): void {
  if (!(v.min <= v.likely && v.likely <= v.max)) {
    throw new HttpError(400, `توزيع ${name} غير صالح — يجب أن يكون min ≤ likely ≤ max`);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

// ─── POST /api/finance/monte-carlo ─────────────────────────────────────────
export const createMonteCarloRun: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = monteCarloSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    validateTriangular('الإيراد', body.revenue);
    validateTriangular('نسبة التكاليف المتغيّرة', body.variableCostPct);
    validateTriangular('التكاليف الثابتة', body.fixedCosts);

    const profits: number[] = [];
    let lossCount = 0;
    let sum = 0;
    for (let i = 0; i < body.iterations; i++) {
      const rev = sampleTriangular(body.revenue.min, body.revenue.likely, body.revenue.max);
      const vc = sampleTriangular(body.variableCostPct.min, body.variableCostPct.likely, body.variableCostPct.max);
      const fc = sampleTriangular(body.fixedCosts.min, body.fixedCosts.likely, body.fixedCosts.max);
      const profit = rev * (1 - vc) - fc;
      profits.push(profit);
      sum += profit;
      if (profit < 0) lossCount++;
    }
    profits.sort((a, b) => a - b);

    const mean = sum / body.iterations;
    const results = {
      iterations: body.iterations,
      mean: Math.round(mean),
      p10: Math.round(percentile(profits, 10)),
      p50: Math.round(percentile(profits, 50)),
      p90: Math.round(percentile(profits, 90)),
      probLoss: Math.round((lossCount / body.iterations) * 10_000) / 10_000,
    };

    const row = await prisma.monteCarloRun.create({
      data: {
        companyId: body.companyId,
        inputs: {
          revenue: body.revenue,
          variableCostPct: body.variableCostPct,
          fixedCosts: body.fixedCosts,
        } as unknown as object,
        iterations: body.iterations,
        results: results as unknown as object,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/finance/monte-carlo/:companyId/latest ────────────────────────
export const getLatestMonteCarloRun: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const latest = await prisma.monteCarloRun.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ monteCarlo: latest });
  } catch (err) {
    next(err);
  }
};
