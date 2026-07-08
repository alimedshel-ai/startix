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
