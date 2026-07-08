import { RequestHandler } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma';
import { HttpError } from '../middleware/error';
import { assertCompanyAccess, paramOf } from '../lib/companyGuard';
import { TEMPLATES, templateToCreateData } from '../lib/assessmentTemplates';

// ─── C18 — محرك التقييم: CRUD + حساب النضج ──────────────────────────────────
// CRUD كامل لـ 4 مستويات: Assessment → Dimension → Criterion → Indicator.
// كل مستوى نتحقّق من الوصول عبر أقرب companyId (فحص شركة → صعود شجرة العلاقة).
// النضج المحسوب: weighted avg للأبعاد → أوزان الأبعاد يجب أن تجمع 100%.

const MODEL_TYPES = ['BSC', 'EFQM', 'PESTEL', 'PORTER', 'OKR', 'CUSTOM'] as const;
const STATUSES = ['draft', 'active', 'completed', 'archived'] as const;

// ═══════════════════════════════════════════════════════════════════════════
// Helpers للوصول
// ═══════════════════════════════════════════════════════════════════════════

async function assertAssessmentAccess(assessmentId: string, userId: string) {
  const a = await prisma.assessment.findUnique({ where: { id: assessmentId } });
  if (!a) throw new HttpError(404, 'التقييم غير موجود');
  await assertCompanyAccess(userId, a.companyId);
  return a;
}

async function assertDimensionAccess(dimensionId: string, userId: string) {
  const d = await prisma.dimension.findUnique({
    where: { id: dimensionId },
    include: { assessment: true },
  });
  if (!d) throw new HttpError(404, 'البُعد غير موجود');
  await assertCompanyAccess(userId, d.assessment.companyId);
  return d;
}

async function assertCriterionAccess(criterionId: string, userId: string) {
  const c = await prisma.criterion.findUnique({
    where: { id: criterionId },
    include: { dimension: { include: { assessment: true } } },
  });
  if (!c) throw new HttpError(404, 'المعيار غير موجود');
  await assertCompanyAccess(userId, c.dimension.assessment.companyId);
  return c;
}

async function assertIndicatorAccess(indicatorId: string, userId: string) {
  const i = await prisma.indicator.findUnique({
    where: { id: indicatorId },
    include: { criterion: { include: { dimension: { include: { assessment: true } } } } },
  });
  if (!i) throw new HttpError(404, 'المؤشر غير موجود');
  await assertCompanyAccess(userId, i.criterion.dimension.assessment.companyId);
  return i;
}

// ═══════════════════════════════════════════════════════════════════════════
// Assessment CRUD
// ═══════════════════════════════════════════════════════════════════════════

const createAssessmentSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  modelType: z.enum(MODEL_TYPES),
  status: z.enum(STATUSES).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

const updateAssessmentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  modelType: z.enum(MODEL_TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  endDate: z.string().datetime().nullable().optional(),
});

export const listAssessments: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const companyId = paramOf(req, 'companyId');
    await assertCompanyAccess(req.auth.sub, companyId);
    const rows = await prisma.assessment.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

export const getAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertAssessmentAccess(id, req.auth.sub);
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        dimensions: {
          orderBy: { order: 'asc' },
          include: {
            criteria: {
              include: { indicators: true },
            },
          },
        },
      },
    });
    res.json(assessment);
  } catch (err) {
    next(err);
  }
};

export const createAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createAssessmentSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const row = await prisma.assessment.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        modelType: body.modelType,
        status: body.status ?? 'draft',
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

export const updateAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertAssessmentAccess(id, req.auth.sub);
    const body = updateAssessmentSchema.parse(req.body);
    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.modelType !== undefined) data.modelType = body.modelType;
    if (body.status !== undefined) data.status = body.status;
    if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
    if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;
    const row = await prisma.assessment.update({ where: { id }, data });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

export const deleteAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertAssessmentAccess(id, req.auth.sub);
    await prisma.assessment.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Dimension CRUD
// ═══════════════════════════════════════════════════════════════════════════

const createDimensionSchema = z.object({
  assessmentId: z.string().uuid(),
  name: z.string().min(1).max(200),
  weight: z.number().nonnegative().finite(),
  order: z.number().int().min(0).optional(),
});

const updateDimensionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  weight: z.number().nonnegative().finite().optional(),
  order: z.number().int().min(0).optional(),
});

export const createDimension: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createDimensionSchema.parse(req.body);
    await assertAssessmentAccess(body.assessmentId, req.auth.sub);
    const row = await prisma.dimension.create({
      data: {
        assessmentId: body.assessmentId,
        name: body.name,
        weight: body.weight,
        order: body.order ?? 0,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

export const updateDimension: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertDimensionAccess(id, req.auth.sub);
    const body = updateDimensionSchema.parse(req.body);
    const row = await prisma.dimension.update({ where: { id }, data: body });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

export const deleteDimension: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertDimensionAccess(id, req.auth.sub);
    await prisma.dimension.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Criterion CRUD
// ═══════════════════════════════════════════════════════════════════════════

const createCriterionSchema = z.object({
  dimensionId: z.string().uuid(),
  name: z.string().min(1).max(200),
  weight: z.number().nonnegative().finite(),
  score: z.number().min(0).max(100).finite().optional(),
});

const updateCriterionSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  weight: z.number().nonnegative().finite().optional(),
  score: z.number().min(0).max(100).finite().nullable().optional(),
});

export const createCriterion: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createCriterionSchema.parse(req.body);
    await assertDimensionAccess(body.dimensionId, req.auth.sub);
    const row = await prisma.criterion.create({
      data: {
        dimensionId: body.dimensionId,
        name: body.name,
        weight: body.weight,
        score: body.score,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

export const updateCriterion: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertCriterionAccess(id, req.auth.sub);
    const body = updateCriterionSchema.parse(req.body);
    const row = await prisma.criterion.update({ where: { id }, data: body });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

export const deleteCriterion: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertCriterionAccess(id, req.auth.sub);
    await prisma.criterion.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// Indicator CRUD
// ═══════════════════════════════════════════════════════════════════════════

const createIndicatorSchema = z.object({
  criterionId: z.string().uuid(),
  name: z.string().min(1).max(200),
  value: z.number().finite().optional(),
  target: z.number().finite().optional(),
  unit: z.string().max(40).optional(),
});

const updateIndicatorSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  value: z.number().finite().nullable().optional(),
  target: z.number().finite().nullable().optional(),
  unit: z.string().max(40).nullable().optional(),
});

export const createIndicator: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = createIndicatorSchema.parse(req.body);
    await assertCriterionAccess(body.criterionId, req.auth.sub);
    const row = await prisma.indicator.create({
      data: {
        criterionId: body.criterionId,
        name: body.name,
        value: body.value,
        target: body.target,
        unit: body.unit,
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

export const updateIndicator: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertIndicatorAccess(id, req.auth.sub);
    const body = updateIndicatorSchema.parse(req.body);
    const row = await prisma.indicator.update({ where: { id }, data: body });
    res.json(row);
  } catch (err) {
    next(err);
  }
};

export const deleteIndicator: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertIndicatorAccess(id, req.auth.sub);
    await prisma.indicator.delete({ where: { id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// C19 — قوالب النماذج
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /api/assessments/templates — لا يحتاج companyId ────────────────────
export const listTemplates: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    // نُرجِع البيانات الوصفية فقط (بدون الحقول العميقة) — الواجهة تعرضها
    // كخيارات في المعالج. الشكل الكامل يُستهلَك عند from-template.
    const summaries = Object.values(TEMPLATES).map((t) => ({
      modelType: t.modelType,
      displayName: t.displayName,
      description: t.description,
      dimensionsCount: t.dimensions.length,
      criteriaCount: t.dimensions.reduce((s, d) => s + d.criteria.length, 0),
    }));
    res.json(summaries);
  } catch (err) {
    next(err);
  }
};

const fromTemplateSchema = z.object({
  companyId: z.string().uuid(),
  modelType: z.enum(['BSC', 'EFQM', 'PESTEL', 'PORTER', 'OKR']),
  name: z.string().min(1).max(200).optional(),
  status: z.enum(STATUSES).optional(),
});

const buildDimensionSchema = z.object({
  name: z.string().min(1).max(200),
  weight: z.number().nonnegative().finite(),
  order: z.number().int().min(0).optional(),
  criteria: z.array(z.object({
    name: z.string().min(1).max(200),
    weight: z.number().nonnegative().finite(),
    score: z.number().min(0).max(100).finite().optional(),
  })).default([]),
});

const buildAssessmentSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(200),
  modelType: z.enum(MODEL_TYPES),
  status: z.enum(STATUSES).optional(),
  dimensions: z.array(buildDimensionSchema).min(1),
});

// ─── POST /api/assessments/build — يُنشئ تقييماً كاملاً من مسوّدة المعالج ──
// يستخدمها معالج C20 لإطلاق التقييم بعد أن يعدّل المستخدم الأوزان والمعايير.
// يفرض assertCompanyAccess ويتحقّق مبدئياً من مجموع أوزان الأبعاد = 100.
export const buildAssessment: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = buildAssessmentSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);

    const dimWeightSum = body.dimensions.reduce((s, d) => s + d.weight, 0);
    if (Math.abs(dimWeightSum - 100) > WEIGHT_TOLERANCE) {
      throw new HttpError(400, `مجموع أوزان الأبعاد يجب أن يساوي 100% (الحالي: ${Math.round(dimWeightSum * 100) / 100}%)`);
    }

    const row = await prisma.assessment.create({
      data: {
        companyId: body.companyId,
        name: body.name,
        modelType: body.modelType,
        status: body.status ?? 'draft',
        dimensions: {
          create: body.dimensions.map((d, i) => ({
            name: d.name,
            weight: d.weight,
            order: d.order ?? i + 1,
            criteria: {
              create: d.criteria.map((c) => ({
                name: c.name,
                weight: c.weight,
                score: c.score,
              })),
            },
          })),
        },
      },
      include: {
        dimensions: {
          orderBy: { order: 'asc' },
          include: { criteria: true },
        },
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/assessments/from-template — يُنشئ تقييماً كاملاً من قالب ────
export const createFromTemplate: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const body = fromTemplateSchema.parse(req.body);
    await assertCompanyAccess(req.auth.sub, body.companyId);
    const template = TEMPLATES[body.modelType];
    const data = templateToCreateData(body.companyId, template, {
      name: body.name,
      status: body.status,
    });
    const row = await prisma.assessment.create({
      data,
      include: {
        dimensions: {
          orderBy: { order: 'asc' },
          include: { criteria: true },
        },
      },
    });
    res.status(201).json(row);
  } catch (err) {
    next(err);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// حساب النضج
// ═══════════════════════════════════════════════════════════════════════════
//
// المعادلة (منسوبة إلى 100):
//   dimAvg[k]      = Σ(critWeight × critScore) / Σ(critWeight)   في البُعد k
//   maturityScore  = Σ(dimWeight × dimAvg) / 100                 عبر كل الأبعاد
//
// الشروط:
//   - يجب وجود بُعد واحد على الأقل.
//   - مجموع أوزان الأبعاد = 100 (± tolerance صغير للأخطاء العشرية).
//   - المعيار بدون score يُحسَب بـ 0 (لا يفشل الحساب).
//   - بُعد بلا معايير → dimAvg = 0.

const WEIGHT_TOLERANCE = 0.01;

export const calculateMaturity: RequestHandler = async (req, res, next) => {
  try {
    if (!req.auth) throw new HttpError(401, 'غير مصادق');
    const id = paramOf(req, 'id');
    await assertAssessmentAccess(id, req.auth.sub);

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        dimensions: {
          include: { criteria: true },
        },
      },
    });
    if (!assessment) throw new HttpError(404, 'التقييم غير موجود');
    if (assessment.dimensions.length === 0) {
      throw new HttpError(400, 'أضف بُعداً واحداً على الأقل قبل الحساب');
    }

    const dimWeightSum = assessment.dimensions.reduce((s, d) => s + d.weight, 0);
    if (Math.abs(dimWeightSum - 100) > WEIGHT_TOLERANCE) {
      throw new HttpError(400, `مجموع أوزان الأبعاد يجب أن يساوي 100% (الحالي: ${Math.round(dimWeightSum * 100) / 100}%)`);
    }

    let weightedSum = 0;
    const breakdown = assessment.dimensions.map((d) => {
      const critWeightSum = d.criteria.reduce((s, c) => s + c.weight, 0);
      let dimAvg = 0;
      if (d.criteria.length > 0 && critWeightSum > 0) {
        const sumScoreWeighted = d.criteria.reduce((s, c) => s + c.weight * (c.score ?? 0), 0);
        dimAvg = sumScoreWeighted / critWeightSum;
      }
      weightedSum += d.weight * dimAvg;
      return {
        dimensionId: d.id,
        dimensionName: d.name,
        weight: d.weight,
        dimensionAvg: Math.round(dimAvg * 100) / 100,
        contribution: Math.round(((d.weight * dimAvg) / 100) * 100) / 100,
      };
    });

    const maturityScore = Math.round((weightedSum / 100) * 100) / 100;

    const updated = await prisma.assessment.update({
      where: { id },
      data: { maturityScore },
    });

    res.json({ assessment: updated, breakdown, maturityScore });
  } catch (err) {
    next(err);
  }
};
